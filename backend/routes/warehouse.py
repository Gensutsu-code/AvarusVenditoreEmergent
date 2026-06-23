"""Warehouse & accounting routes: stock, movements (receipt/writeoff), finance."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db, get_current_user
from notify import notify_admin

router = APIRouter(tags=["warehouse"])


async def _ensure_admin(user):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _month_range():
    now = datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start.isoformat(), now.isoformat()


class MovementCreate(BaseModel):
    product_id: str
    type: str  # 'receipt' | 'writeoff'
    quantity: int
    purchase_price: Optional[float] = None  # receipt: optional, updates product purchase_price
    supplier: Optional[str] = ""  # receipt
    reason: Optional[str] = ""  # writeoff
    comment: Optional[str] = ""


class FinanceEntryCreate(BaseModel):
    type: str  # 'income' | 'expense'
    amount: float
    category: Optional[str] = ""
    comment: Optional[str] = ""
    date: Optional[str] = None  # ISO


# --- Stock ---

@router.get("/admin/warehouse/stock")
async def warehouse_stock(search: Optional[str] = None, low_stock: Optional[int] = None, user=Depends(get_current_user)):
    await _ensure_admin(user)
    q = {}
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"article": {"$regex": search, "$options": "i"}},
            {"manufacturer": {"$regex": search, "$options": "i"}},
        ]
    products = await db.products.find(q, {
        "_id": 0, "id": 1, "name": 1, "article": 1, "manufacturer": 1,
        "stock": 1, "price": 1, "purchase_price": 1,
    }).to_list(5000)

    items = []
    total_units = 0
    total_cost = 0.0
    total_revenue = 0.0
    low_count = 0
    threshold = low_stock if low_stock is not None else 5
    for p in products:
        stock = p.get("stock", 0) or 0
        pp = p.get("purchase_price", 0) or 0
        price = p.get("price", 0) or 0
        cost_value = round(stock * pp, 2)
        revenue_value = round(stock * price, 2)
        total_units += stock
        total_cost += cost_value
        total_revenue += revenue_value
        is_low = stock <= threshold
        if is_low:
            low_count += 1
        items.append({
            **p,
            "purchase_price": pp,
            "stock_cost_value": cost_value,
            "stock_revenue_value": revenue_value,
            "margin": round(price - pp, 2),
            "is_low": is_low,
        })
    # sort low stock first then by name
    items.sort(key=lambda x: (not x["is_low"], x.get("name", "")))
    return {
        "items": items,
        "summary": {
            "total_products": len(items),
            "total_units": total_units,
            "total_cost_value": round(total_cost, 2),
            "total_revenue_value": round(total_revenue, 2),
            "potential_profit": round(total_revenue - total_cost, 2),
            "low_stock_count": low_count,
            "low_stock_threshold": threshold,
        },
    }


# --- Movements ---

@router.post("/admin/warehouse/movement")
async def create_movement(data: MovementCreate, user=Depends(get_current_user)):
    await _ensure_admin(user)
    if data.type not in ("receipt", "writeoff"):
        raise HTTPException(status_code=400, detail="Тип операции должен быть receipt или writeoff")
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Количество должно быть больше 0")
    product = await db.products.find_one({"id": data.product_id}, {"_id": 0, "id": 1, "name": 1, "article": 1, "stock": 1, "purchase_price": 1})
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    stock_before = product.get("stock", 0) or 0
    if data.type == "writeoff" and data.quantity > stock_before:
        raise HTTPException(status_code=400, detail=f"Нельзя списать {data.quantity}: на складе {stock_before}")

    delta = data.quantity if data.type == "receipt" else -data.quantity
    set_fields = {}
    unit_cost = product.get("purchase_price", 0) or 0
    if data.type == "receipt" and data.purchase_price is not None and data.purchase_price >= 0:
        unit_cost = data.purchase_price
        set_fields["purchase_price"] = data.purchase_price

    update = {"$inc": {"stock": delta}}
    if set_fields:
        update["$set"] = set_fields
    await db.products.update_one({"id": data.product_id}, update)

    total_cost = round(data.quantity * unit_cost, 2)
    now = datetime.now(timezone.utc).isoformat()
    movement = {
        "id": str(uuid.uuid4()),
        "product_id": data.product_id,
        "product_name": product.get("name", ""),
        "product_article": product.get("article", ""),
        "type": data.type,
        "quantity": data.quantity,
        "unit_cost": unit_cost,
        "total_cost": total_cost,
        "supplier": data.supplier or "",
        "reason": data.reason or "",
        "comment": data.comment or "",
        "stock_before": stock_before,
        "stock_after": stock_before + delta,
        "created_at": now,
        "created_by": user.get("name", user.get("email", "")),
    }
    await db.stock_movements.insert_one(movement)
    movement.pop("_id", None)
    return movement


class BulkMovementCreate(BaseModel):
    product_ids: list
    type: str  # 'receipt' | 'writeoff'
    quantity: int
    purchase_price: Optional[float] = None
    supplier: Optional[str] = ""
    reason: Optional[str] = ""
    comment: Optional[str] = ""


@router.post("/admin/warehouse/movements/bulk")
async def create_bulk_movement(data: BulkMovementCreate, user=Depends(get_current_user)):
    await _ensure_admin(user)
    if data.type not in ("receipt", "writeoff"):
        raise HTTPException(status_code=400, detail="Тип операции должен быть receipt или writeoff")
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Количество должно быть больше 0")
    if not data.product_ids:
        raise HTTPException(status_code=400, detail="Не выбраны товары")

    now = datetime.now(timezone.utc).isoformat()
    processed = 0
    skipped = []
    for pid in data.product_ids:
        product = await db.products.find_one({"id": pid}, {"_id": 0, "id": 1, "name": 1, "article": 1, "stock": 1, "purchase_price": 1})
        if not product:
            skipped.append({"id": pid, "reason": "не найден"})
            continue
        stock_before = product.get("stock", 0) or 0
        if data.type == "writeoff" and data.quantity > stock_before:
            skipped.append({"id": pid, "name": product.get("name", ""), "reason": f"остаток {stock_before}"})
            continue
        delta = data.quantity if data.type == "receipt" else -data.quantity
        unit_cost = product.get("purchase_price", 0) or 0
        set_fields = {}
        if data.type == "receipt" and data.purchase_price is not None and data.purchase_price >= 0:
            unit_cost = data.purchase_price
            set_fields["purchase_price"] = data.purchase_price
        update = {"$inc": {"stock": delta}}
        if set_fields:
            update["$set"] = set_fields
        await db.products.update_one({"id": pid}, update)
        await db.stock_movements.insert_one({
            "id": str(uuid.uuid4()),
            "product_id": pid,
            "product_name": product.get("name", ""),
            "product_article": product.get("article", ""),
            "type": data.type,
            "quantity": data.quantity,
            "unit_cost": unit_cost,
            "total_cost": round(data.quantity * unit_cost, 2),
            "supplier": data.supplier or "",
            "reason": data.reason or "",
            "comment": (data.comment or "") + " (массовая операция)",
            "stock_before": stock_before,
            "stock_after": stock_before + delta,
            "created_at": now,
            "created_by": user.get("name", user.get("email", "")),
        })
        processed += 1
    return {"processed": processed, "skipped": skipped}


@router.get("/admin/warehouse/movements")
async def list_movements(type: Optional[str] = None, product_id: Optional[str] = None, limit: int = 200, user=Depends(get_current_user)):
    await _ensure_admin(user)
    q = {}
    if type:
        q["type"] = type
    if product_id:
        q["product_id"] = product_id
    movements = await db.stock_movements.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return movements


# --- Finance ---

@router.get("/admin/finance")
async def finance_summary(start: Optional[str] = None, end: Optional[str] = None, user=Depends(get_current_user)):
    await _ensure_admin(user)
    if not start or not end:
        start, end = _month_range()

    # Auto income: paid orders within period
    paid_orders = await db.orders.find(
        {"payment_status": "paid", "created_at": {"$gte": start, "$lte": end}},
        {"_id": 0, "total": 1},
    ).to_list(20000)
    auto_income = round(sum(o.get("total", 0) or 0 for o in paid_orders), 2)

    # Auto expense: receipts within period
    receipts = await db.stock_movements.find(
        {"type": "receipt", "created_at": {"$gte": start, "$lte": end}},
        {"_id": 0, "total_cost": 1},
    ).to_list(20000)
    auto_expense = round(sum(m.get("total_cost", 0) or 0 for m in receipts), 2)

    # Manual entries
    entries = await db.finance_entries.find(
        {"date": {"$gte": start, "$lte": end}}, {"_id": 0},
    ).sort("date", -1).to_list(5000)
    manual_income = round(sum(e.get("amount", 0) or 0 for e in entries if e.get("type") == "income"), 2)
    manual_expense = round(sum(e.get("amount", 0) or 0 for e in entries if e.get("type") == "expense"), 2)

    total_income = round(auto_income + manual_income, 2)
    total_expense = round(auto_expense + manual_expense, 2)
    return {
        "period": {"start": start, "end": end},
        "auto_income": auto_income,
        "auto_expense": auto_expense,
        "manual_income": manual_income,
        "manual_expense": manual_expense,
        "total_income": total_income,
        "total_expense": total_expense,
        "profit": round(total_income - total_expense, 2),
        "paid_orders_count": len(paid_orders),
        "receipts_count": len(receipts),
        "entries": entries,
    }


@router.post("/admin/finance/entry")
async def create_finance_entry(data: FinanceEntryCreate, user=Depends(get_current_user)):
    await _ensure_admin(user)
    if data.type not in ("income", "expense"):
        raise HTTPException(status_code=400, detail="Тип должен быть income или expense")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше 0")
    entry = {
        "id": str(uuid.uuid4()),
        "type": data.type,
        "amount": round(data.amount, 2),
        "category": data.category or "",
        "comment": data.comment or "",
        "date": data.date or datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("name", user.get("email", "")),
    }
    await db.finance_entries.insert_one(entry)
    entry.pop("_id", None)
    return entry


@router.delete("/admin/finance/entry/{entry_id}")
async def delete_finance_entry(entry_id: str, user=Depends(get_current_user)):
    await _ensure_admin(user)
    res = await db.finance_entries.delete_one({"id": entry_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    return {"success": True}
