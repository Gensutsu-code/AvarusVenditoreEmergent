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

# Order states considered as "reserving" stock (placed but not paid / not finalized)
RESERVE_PAYMENT_STATUSES = ["unpaid", "deferred", "awaiting_payment", "awaiting_confirmation"]
RESERVE_EXCLUDE_STATUSES = ["cancelled", "completed", "delivered"]


async def _reserved_by_product():
    """Sum of item quantities across open unpaid/deferred orders, grouped by product."""
    pipeline = [
        {"$match": {
            "payment_status": {"$in": RESERVE_PAYMENT_STATUSES},
            "status": {"$nin": RESERVE_EXCLUDE_STATUSES},
        }},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "qty": {"$sum": "$items.quantity"}}},
    ]
    reserved = {}
    async for row in db.orders.aggregate(pipeline):
        if row.get("_id"):
            reserved[row["_id"]] = int(row.get("qty", 0) or 0)
    return reserved


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

    reserved_map = await _reserved_by_product()

    items = []
    total_units = 0
    total_cost = 0.0
    total_revenue = 0.0
    total_reserved = 0
    low_count = 0
    threshold = low_stock if low_stock is not None else 5
    for p in products:
        stock = p.get("stock", 0) or 0
        pp = p.get("purchase_price", 0) or 0
        price = p.get("price", 0) or 0
        reserved = reserved_map.get(p.get("id"), 0)
        available = stock - reserved
        cost_value = round(stock * pp, 2)
        revenue_value = round(stock * price, 2)
        total_units += stock
        total_cost += cost_value
        total_revenue += revenue_value
        total_reserved += reserved
        is_low = stock <= threshold
        if is_low:
            low_count += 1
        items.append({
            **p,
            "purchase_price": pp,
            "reserved": reserved,
            "available": available,
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
            "total_reserved": total_reserved,
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


# --- Receipt documents (приёмки: одна поставка = много товаров) ---

class ReceiptItemIn(BaseModel):
    product_id: str
    quantity: int
    purchase_price: Optional[float] = None


class ReceiptCreate(BaseModel):
    supplier: Optional[str] = ""
    comment: Optional[str] = ""
    date: Optional[str] = None  # ISO
    items: list  # list[ReceiptItemIn]


@router.post("/admin/warehouse/receipts")
async def create_receipt(data: ReceiptCreate, user=Depends(get_current_user)):
    await _ensure_admin(user)
    raw_items = data.items or []
    if not raw_items:
        raise HTTPException(status_code=400, detail="Добавьте хотя бы один товар")

    parsed = []
    for it in raw_items:
        pid = it.get("product_id")
        qty = int(it.get("quantity") or 0)
        pp = it.get("purchase_price")
        if not pid or qty <= 0:
            continue
        parsed.append({"product_id": pid, "quantity": qty, "purchase_price": pp})
    if not parsed:
        raise HTTPException(status_code=400, detail="Нет корректных позиций (количество должно быть > 0)")

    now = datetime.now(timezone.utc).isoformat()
    date = data.date or now
    seq = await db.stock_receipts.count_documents({}) + 1
    number = f"П-{seq:06d}"
    receipt_id = str(uuid.uuid4())
    by = user.get("name", user.get("email", ""))

    doc_items = []
    total_cost = 0.0
    total_units = 0
    for it in parsed:
        product = await db.products.find_one(
            {"id": it["product_id"]},
            {"_id": 0, "id": 1, "name": 1, "article": 1, "stock": 1, "purchase_price": 1},
        )
        if not product:
            continue
        stock_before = product.get("stock", 0) or 0
        unit_cost = product.get("purchase_price", 0) or 0
        set_fields = {}
        if it["purchase_price"] is not None and it["purchase_price"] >= 0:
            unit_cost = float(it["purchase_price"])
            set_fields["purchase_price"] = unit_cost
        update = {"$inc": {"stock": it["quantity"]}}
        if set_fields:
            update["$set"] = set_fields
        await db.products.update_one({"id": it["product_id"]}, update)
        line_cost = round(it["quantity"] * unit_cost, 2)
        total_cost += line_cost
        total_units += it["quantity"]
        doc_items.append({
            "product_id": it["product_id"],
            "product_name": product.get("name", ""),
            "product_article": product.get("article", ""),
            "quantity": it["quantity"],
            "unit_cost": unit_cost,
            "line_cost": line_cost,
            "stock_before": stock_before,
            "stock_after": stock_before + it["quantity"],
        })
        await db.stock_movements.insert_one({
            "id": str(uuid.uuid4()),
            "product_id": it["product_id"],
            "product_name": product.get("name", ""),
            "product_article": product.get("article", ""),
            "type": "receipt",
            "quantity": it["quantity"],
            "unit_cost": unit_cost,
            "total_cost": line_cost,
            "supplier": data.supplier or "",
            "reason": "",
            "comment": f"Приёмка {number}",
            "receipt_id": receipt_id,
            "stock_before": stock_before,
            "stock_after": stock_before + it["quantity"],
            "created_at": now,
            "created_by": by,
        })

    if not doc_items:
        raise HTTPException(status_code=404, detail="Товары не найдены")

    receipt = {
        "id": receipt_id,
        "number": number,
        "supplier": data.supplier or "",
        "comment": data.comment or "",
        "date": date,
        "items": doc_items,
        "total_cost": round(total_cost, 2),
        "total_units": total_units,
        "positions": len(doc_items),
        "created_at": now,
        "created_by": by,
    }
    await db.stock_receipts.insert_one(receipt)
    receipt.pop("_id", None)
    return receipt


@router.get("/admin/warehouse/receipts")
async def list_receipts(limit: int = 100, user=Depends(get_current_user)):
    await _ensure_admin(user)
    docs = await db.stock_receipts.find(
        {}, {"_id": 0, "items": 0}
    ).sort("created_at", -1).to_list(limit)
    return docs


@router.get("/admin/warehouse/receipts/{receipt_id}")
async def get_receipt(receipt_id: str, user=Depends(get_current_user)):
    await _ensure_admin(user)
    doc = await db.stock_receipts.find_one({"id": receipt_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    return doc


# --- Profit / COGS report (по проданным товарам) ---

@router.get("/admin/warehouse/cogs-report")
async def cogs_report(start: Optional[str] = None, end: Optional[str] = None, user=Depends(get_current_user)):
    await _ensure_admin(user)
    if not start or not end:
        start, end = _month_range()

    sales = await db.stock_movements.find(
        {"type": "sale", "created_at": {"$gte": start, "$lte": end}}, {"_id": 0},
    ).to_list(50000)

    # Cache orders to backfill revenue for legacy movements lacking line_revenue
    order_price_cache = {}

    async def _line_revenue(mv):
        lr = mv.get("line_revenue")
        if lr is not None:
            return float(lr)
        up = mv.get("unit_price")
        if up is not None:
            return round(float(up) * (mv.get("quantity", 0) or 0), 2)
        oid = mv.get("order_id")
        if oid:
            if oid not in order_price_cache:
                o = await db.orders.find_one({"id": oid}, {"_id": 0, "items": 1})
                order_price_cache[oid] = {i.get("product_id"): i.get("price", 0) for i in (o.get("items", []) if o else [])}
            price = order_price_cache[oid].get(mv.get("product_id"), 0) or 0
            return round(float(price) * (mv.get("quantity", 0) or 0), 2)
        return 0.0

    total_revenue = 0.0
    total_cogs = 0.0
    total_units = 0
    per_product = {}
    for mv in sales:
        rev = await _line_revenue(mv)
        cogs = float(mv.get("total_cost", 0) or 0)
        qty = int(mv.get("quantity", 0) or 0)
        total_revenue += rev
        total_cogs += cogs
        total_units += qty
        pid = mv.get("product_id")
        if pid not in per_product:
            per_product[pid] = {
                "product_id": pid,
                "product_name": mv.get("product_name", ""),
                "product_article": mv.get("product_article", ""),
                "quantity": 0, "revenue": 0.0, "cogs": 0.0,
            }
        pp = per_product[pid]
        pp["quantity"] += qty
        pp["revenue"] += rev
        pp["cogs"] += cogs

    products_list = []
    for pp in per_product.values():
        pp["revenue"] = round(pp["revenue"], 2)
        pp["cogs"] = round(pp["cogs"], 2)
        pp["profit"] = round(pp["revenue"] - pp["cogs"], 2)
        pp["margin_percent"] = round((pp["profit"] / pp["revenue"] * 100), 1) if pp["revenue"] > 0 else 0
        products_list.append(pp)
    products_list.sort(key=lambda x: x["profit"], reverse=True)

    profit = round(total_revenue - total_cogs, 2)
    return {
        "period": {"start": start, "end": end},
        "total_revenue": round(total_revenue, 2),
        "total_cogs": round(total_cogs, 2),
        "profit": profit,
        "margin_percent": round((profit / total_revenue * 100), 1) if total_revenue > 0 else 0,
        "total_units": total_units,
        "sales_count": len(sales),
        "products": products_list,
    }
