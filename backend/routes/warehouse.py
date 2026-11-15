"""Warehouse & accounting routes: stock, movements (receipt/writeoff), finance."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from database import db, get_current_user

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
    warehouse_id: str
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


# ==================== Warehouses & per-warehouse stock ====================

DEFAULT_DELIVERY_SETTINGS = {
    "in_region": {"label": "В наличии в вашем регионе", "color": "#16a34a", "days_min": 1, "days_max": 1},
    "other_region": {"label": "В наличии на другом складе", "color": "#eab308", "days_min": 3, "days_max": 7},
    "out_of_stock": {"label": "Под заказ", "color": "#dc2626", "days_min": 7, "days_max": 21},
}


async def recompute_product_stock(product_id: str):
    """product.stock = sum of per-warehouse quantities; product.stock_regions = regions with qty>0."""
    levels = await db.stock_levels.find({"product_id": product_id}, {"_id": 0, "warehouse_id": 1, "quantity": 1}).to_list(2000)
    total = sum(int(l.get("quantity", 0) or 0) for l in levels)
    wh_ids = [l["warehouse_id"] for l in levels if (l.get("quantity", 0) or 0) > 0]
    regions: List[str] = []
    if wh_ids:
        whs = await db.warehouses.find({"id": {"$in": wh_ids}}, {"_id": 0, "id": 1, "region": 1}).to_list(2000)
        regions = sorted({(w.get("region") or "").strip() for w in whs if (w.get("region") or "").strip()})
    before = await db.products.find_one({"id": product_id}, {"_id": 0, "price": 1, "stock": 1, "name": 1})
    await db.products.update_one({"id": product_id}, {"$set": {"stock": total, "stock_regions": regions}})
    if before and (before.get("stock") or 0) <= 0 < total:
        from notify import notify_favorites_change
        await notify_favorites_change(product_id, before, {**before, "stock": total})
    return total


async def add_stock(product_id: str, warehouse_id: str, qty: int):
    await db.stock_levels.update_one(
        {"product_id": product_id, "warehouse_id": warehouse_id},
        {"$inc": {"quantity": qty}, "$setOnInsert": {"id": str(uuid.uuid4())}},
        upsert=True,
    )
    await recompute_product_stock(product_id)


async def warehouse_qty(product_id: str, warehouse_id: str) -> int:
    lvl = await db.stock_levels.find_one({"product_id": product_id, "warehouse_id": warehouse_id}, {"_id": 0, "quantity": 1})
    return int((lvl or {}).get("quantity", 0) or 0)


async def allocate_stock(product_id: str, qty: int, region: Optional[str] = None):
    """Decrement qty from stock_levels, preferring the client's region. Returns allocations list or None if insufficient."""
    levels = await db.stock_levels.find({"product_id": product_id, "quantity": {"$gt": 0}}, {"_id": 0, "warehouse_id": 1, "quantity": 1}).to_list(2000)
    if sum(int(l["quantity"]) for l in levels) < qty:
        return None
    wh_ids = [l["warehouse_id"] for l in levels]
    whs = await db.warehouses.find({"id": {"$in": wh_ids}}, {"_id": 0, "id": 1, "region": 1}).to_list(2000)
    wh_region = {w["id"]: (w.get("region") or "") for w in whs}
    levels.sort(key=lambda l: (0 if region and wh_region.get(l["warehouse_id"]) == region else 1, -int(l["quantity"])))
    allocations = []
    remaining = qty
    for l in levels:
        if remaining <= 0:
            break
        take = min(remaining, int(l["quantity"]))
        await db.stock_levels.update_one(
            {"product_id": product_id, "warehouse_id": l["warehouse_id"]},
            {"$inc": {"quantity": -take}},
        )
        allocations.append({"warehouse_id": l["warehouse_id"], "quantity": take})
        remaining -= take
    await recompute_product_stock(product_id)
    return allocations


async def restore_stock(product_id: str, allocations):
    for a in (allocations or []):
        await db.stock_levels.update_one(
            {"product_id": product_id, "warehouse_id": a["warehouse_id"]},
            {"$inc": {"quantity": int(a.get("quantity", 0) or 0)}, "$setOnInsert": {"id": str(uuid.uuid4())}},
            upsert=True,
        )
    await recompute_product_stock(product_id)


async def restore_order_stock(order):
    """Restore stock for a cancelled/returned order (per-warehouse when allocations exist)."""
    from routes.rewards import refund_order_cashback
    await refund_order_cashback(order)
    allocs = order.get("stock_allocations")
    if allocs:
        for a in allocs:
            await restore_stock(a.get("product_id"), a.get("allocations", []))
    else:
        for item in order.get("items", []):
            await db.products.update_one({"id": item.get("product_id")}, {"$inc": {"stock": item.get("quantity", 0)}})


async def migrate_legacy_stock():
    """Idempotent: seed stock_levels from legacy products.stock onto a default warehouse.
    Runs once per product (skips products that already have any stock_levels rows)."""
    products = await db.products.find({"stock": {"$gt": 0}}, {"_id": 0, "id": 1, "stock": 1}).to_list(100000)
    if not products:
        return 0
    # pick or create a default warehouse
    default_wh = await db.warehouses.find_one({}, {"_id": 0, "id": 1}, sort=[("created_at", 1)])
    if not default_wh:
        default_wh = {"id": str(uuid.uuid4()), "name": "Основной склад", "region": "Москва", "address": "", "created_at": datetime.now(timezone.utc).isoformat()}
        await db.warehouses.insert_one(dict(default_wh))
    wh_id = default_wh["id"]
    migrated = 0
    for p in products:
        has_levels = await db.stock_levels.find_one({"product_id": p["id"]}, {"_id": 1})
        if has_levels:
            continue
        await db.stock_levels.insert_one({"id": str(uuid.uuid4()), "product_id": p["id"], "warehouse_id": wh_id, "quantity": int(p.get("stock", 0) or 0)})
        await recompute_product_stock(p["id"])
        migrated += 1
    return migrated


class WarehouseIn(BaseModel):
    name: str
    region: str
    address: Optional[str] = ""
    phone: Optional[str] = ""
    hours: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_public: Optional[bool] = True


class RegionIn(BaseModel):
    name: str


async def _wh_fields(data: WarehouseIn):
    name, region = data.name.strip(), data.region.strip()
    if not name or not region:
        raise HTTPException(status_code=400, detail="Название и регион обязательны")
    if not await db.regions.find_one({"name": region}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="Выберите регион из справочника регионов")
    if (data.lat is None) != (data.lng is None):
        raise HTTPException(status_code=400, detail="Укажите обе координаты точки на карте")
    if data.lat is not None and not (-90 <= data.lat <= 90 and -180 <= data.lng <= 180):
        raise HTTPException(status_code=400, detail="Некорректные координаты")
    return {
        "name": name, "region": region,
        "address": (data.address or "").strip(),
        "phone": (data.phone or "").strip()[:60],
        "hours": (data.hours or "").strip()[:120],
        "lat": data.lat, "lng": data.lng,
        "is_public": data.is_public is not False,
    }


async def migrate_regions():
    """Idempotent: make sure every region used by a warehouse exists in the regions directory."""
    added = 0
    for name in await db.warehouses.distinct("region"):
        name = (name or "").strip()
        if name and not await db.regions.find_one({"name": name}, {"_id": 1}):
            await db.regions.insert_one({"id": str(uuid.uuid4()), "name": name, "created_at": datetime.now(timezone.utc).isoformat()})
            added += 1
    return added


@router.get("/admin/regions")
async def list_regions(user=Depends(get_current_user)):
    await _ensure_admin(user)
    regions = await db.regions.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    for r in regions:
        r["warehouses_count"] = await db.warehouses.count_documents({"region": r["name"]})
    return regions


@router.post("/admin/regions")
async def create_region(data: RegionIn, user=Depends(get_current_user)):
    await _ensure_admin(user)
    name = data.name.strip()[:60]
    if not name:
        raise HTTPException(status_code=400, detail="Введите название региона")
    existing = await db.regions.find({}, {"_id": 0, "name": 1}).to_list(1000)
    if any(r["name"].lower() == name.lower() for r in existing):
        raise HTTPException(status_code=400, detail="Такой регион уже есть в справочнике")
    region = {"id": str(uuid.uuid4()), "name": name, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.regions.insert_one(dict(region))
    return region


@router.put("/admin/regions/{region_id}")
async def rename_region(region_id: str, data: RegionIn, user=Depends(get_current_user)):
    await _ensure_admin(user)
    name = data.name.strip()[:60]
    if not name:
        raise HTTPException(status_code=400, detail="Введите название региона")
    region = await db.regions.find_one({"id": region_id}, {"_id": 0})
    if not region:
        raise HTTPException(status_code=404, detail="Регион не найден")
    others = await db.regions.find({"id": {"$ne": region_id}}, {"_id": 0, "name": 1}).to_list(1000)
    if any(r["name"].lower() == name.lower() for r in others):
        raise HTTPException(status_code=400, detail="Такой регион уже есть в справочнике")
    old = region["name"]
    await db.regions.update_one({"id": region_id}, {"$set": {"name": name}})
    if old != name:
        wh_ids = [w["id"] for w in await db.warehouses.find({"region": old}, {"_id": 0, "id": 1}).to_list(2000)]
        await db.warehouses.update_many({"region": old}, {"$set": {"region": name}})
        await db.users.update_many({"region": old}, {"$set": {"region": name}})
        if wh_ids:
            for pid in await db.stock_levels.distinct("product_id", {"warehouse_id": {"$in": wh_ids}}):
                await recompute_product_stock(pid)
    return {"success": True}


@router.delete("/admin/regions/{region_id}")
async def delete_region(region_id: str, user=Depends(get_current_user)):
    await _ensure_admin(user)
    region = await db.regions.find_one({"id": region_id}, {"_id": 0})
    if not region:
        raise HTTPException(status_code=404, detail="Регион не найден")
    if await db.warehouses.count_documents({"region": region["name"]}) > 0:
        raise HTTPException(status_code=400, detail="Нельзя удалить регион, к которому привязаны склады")
    await db.regions.delete_one({"id": region_id})
    return {"success": True}


@router.get("/warehouses/public")
async def public_warehouses():
    """Public: warehouses / pickup points for the client map."""
    return await db.warehouses.find(
        {"is_public": {"$ne": False}},
        {"_id": 0, "id": 1, "name": 1, "region": 1, "address": 1, "phone": 1, "hours": 1, "lat": 1, "lng": 1},
    ).sort("region", 1).to_list(500)


@router.get("/admin/warehouses")
async def list_warehouses(user=Depends(get_current_user)):
    await _ensure_admin(user)
    whs = await db.warehouses.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    # attach total units per warehouse
    for w in whs:
        agg = await db.stock_levels.aggregate([
            {"$match": {"warehouse_id": w["id"], "quantity": {"$gt": 0}}},
            {"$group": {"_id": None, "units": {"$sum": "$quantity"}, "skus": {"$sum": 1}}},
        ]).to_list(1)
        w["total_units"] = int(agg[0]["units"]) if agg else 0
        w["total_skus"] = int(agg[0]["skus"]) if agg else 0
    return whs


@router.post("/admin/warehouses")
async def create_warehouse(data: WarehouseIn, user=Depends(get_current_user)):
    await _ensure_admin(user)
    wh = {
        "id": str(uuid.uuid4()),
        **(await _wh_fields(data)),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.warehouses.insert_one(wh)
    wh.pop("_id", None)
    return wh


@router.put("/admin/warehouses/{wh_id}")
async def update_warehouse(wh_id: str, data: WarehouseIn, user=Depends(get_current_user)):
    await _ensure_admin(user)
    res = await db.warehouses.update_one({"id": wh_id}, {"$set": await _wh_fields(data)})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Склад не найден")
    # regions may have changed -> recompute affected products' stock_regions
    pids = await db.stock_levels.distinct("product_id", {"warehouse_id": wh_id})
    for pid in pids:
        await recompute_product_stock(pid)
    return {"success": True}


@router.delete("/admin/warehouses/{wh_id}")
async def delete_warehouse(wh_id: str, user=Depends(get_current_user)):
    await _ensure_admin(user)
    wh = await db.warehouses.find_one({"id": wh_id}, {"_id": 1})
    if not wh:
        raise HTTPException(status_code=404, detail="Склад не найден")
    units = await db.stock_levels.aggregate([
        {"$match": {"warehouse_id": wh_id, "quantity": {"$gt": 0}}},
        {"$group": {"_id": None, "units": {"$sum": "$quantity"}}},
    ]).to_list(1)
    if units and int(units[0]["units"]) > 0:
        raise HTTPException(status_code=400, detail="Нельзя удалить склад с остатками. Сначала переместите или спишите товар.")
    await db.stock_levels.delete_many({"warehouse_id": wh_id})
    await db.warehouses.delete_one({"id": wh_id})
    return {"success": True}


@router.get("/regions")
async def public_regions():
    """Public: distinct warehouse regions for the client region selector."""
    regions = await db.warehouses.distinct("region")
    return {"regions": sorted([r for r in regions if r])}


@router.put("/me/region")
async def set_my_region(payload: dict, user=Depends(get_current_user)):
    region = (payload.get("region") or "").strip()
    await db.users.update_one({"id": user["id"]}, {"$set": {"region": region}})
    return {"success": True, "region": region}


@router.get("/delivery-display")
async def get_delivery_display():
    """Public: 3-state delivery display configuration (region-based badges)."""
    s = await db.settings.find_one({"key": "delivery_display_settings"}, {"_id": 0})
    val = (s or {}).get("value") or {}
    out = {}
    for k, default in DEFAULT_DELIVERY_SETTINGS.items():
        out[k] = {**default, **(val.get(k) or {})}
    return out


@router.put("/admin/delivery-display")
async def update_delivery_display(payload: dict, user=Depends(get_current_user)):
    await _ensure_admin(user)
    clean = {}
    for k in DEFAULT_DELIVERY_SETTINGS:
        src = payload.get(k) or {}
        try:
            dmin = max(0, int(src.get("days_min", DEFAULT_DELIVERY_SETTINGS[k]["days_min"]) or 0))
        except (ValueError, TypeError):
            dmin = DEFAULT_DELIVERY_SETTINGS[k]["days_min"]
        try:
            dmax = max(0, int(src.get("days_max", DEFAULT_DELIVERY_SETTINGS[k]["days_max"]) or 0))
        except (ValueError, TypeError):
            dmax = DEFAULT_DELIVERY_SETTINGS[k]["days_max"]
        if dmax < dmin:
            dmax = dmin
        clean[k] = {
            "label": str(src.get("label", DEFAULT_DELIVERY_SETTINGS[k]["label"]))[:120],
            "color": str(src.get("color", DEFAULT_DELIVERY_SETTINGS[k]["color"]))[:32],
            "days_min": dmin,
            "days_max": dmax,
        }
    await db.settings.update_one({"key": "delivery_display_settings"}, {"$set": {"value": clean}}, upsert=True)
    return clean


class TransferIn(BaseModel):
    product_id: str
    from_warehouse_id: str
    to_warehouse_id: str
    quantity: int


@router.post("/admin/warehouse/transfer")
async def transfer_stock(data: TransferIn, user=Depends(get_current_user)):
    await _ensure_admin(user)
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Количество должно быть больше 0")
    if data.from_warehouse_id == data.to_warehouse_id:
        raise HTTPException(status_code=400, detail="Склады должны отличаться")
    if not await db.products.find_one({"id": data.product_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Товар не найден")
    if not await db.warehouses.find_one({"id": data.from_warehouse_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Склад-источник не найден")
    if not await db.warehouses.find_one({"id": data.to_warehouse_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Склад-получатель не найден")
    res = await db.stock_levels.update_one(
        {"product_id": data.product_id, "warehouse_id": data.from_warehouse_id, "quantity": {"$gte": data.quantity}},
        {"$inc": {"quantity": -data.quantity}},
    )
    if res.modified_count == 0:
        have = await warehouse_qty(data.product_id, data.from_warehouse_id)
        raise HTTPException(status_code=400, detail=f"На складе-источнике только {have} шт.")
    await add_stock(data.product_id, data.to_warehouse_id, data.quantity)
    return {"success": True}


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

    # per-warehouse stock levels for listed products
    pids = [p["id"] for p in products]
    levels = await db.stock_levels.find({"product_id": {"$in": pids}, "quantity": {"$gt": 0}}, {"_id": 0, "product_id": 1, "warehouse_id": 1, "quantity": 1}).to_list(20000)
    whs = await db.warehouses.find({}, {"_id": 0, "id": 1, "name": 1, "region": 1}).to_list(500)
    wh_map = {w["id"]: w for w in whs}
    levels_by_product = {}
    for l in levels:
        wh = wh_map.get(l["warehouse_id"])
        if not wh:
            continue
        levels_by_product.setdefault(l["product_id"], []).append({
            "warehouse_id": l["warehouse_id"],
            "warehouse_name": wh.get("name", ""),
            "region": wh.get("region", ""),
            "quantity": int(l["quantity"]),
        })

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
        wh_breakdown = levels_by_product.get(p.get("id"), [])
        items.append({
            **p,
            "purchase_price": pp,
            "reserved": reserved,
            "available": available,
            "stock_cost_value": cost_value,
            "stock_revenue_value": revenue_value,
            "margin": round(price - pp, 2),
            "is_low": is_low,
            "warehouses": wh_breakdown,
            "regions": sorted({w["region"] for w in wh_breakdown if w.get("region")}),
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
    wh = await db.warehouses.find_one({"id": data.warehouse_id}, {"_id": 0, "id": 1, "name": 1, "region": 1})
    if not wh:
        raise HTTPException(status_code=404, detail="Склад не найден")

    stock_before = product.get("stock", 0) or 0
    unit_cost = product.get("purchase_price", 0) or 0
    set_fields = {}
    if data.type == "receipt" and data.purchase_price is not None and data.purchase_price >= 0:
        unit_cost = data.purchase_price
        set_fields["purchase_price"] = data.purchase_price

    if data.type == "receipt":
        if set_fields:
            await db.products.update_one({"id": data.product_id}, {"$set": set_fields})
        await add_stock(data.product_id, data.warehouse_id, data.quantity)
    else:  # writeoff
        here = await warehouse_qty(data.product_id, data.warehouse_id)
        if data.quantity > here:
            raise HTTPException(status_code=400, detail=f"На складе «{wh.get('name')}» только {here} шт.")
        await db.stock_levels.update_one({"product_id": data.product_id, "warehouse_id": data.warehouse_id}, {"$inc": {"quantity": -data.quantity}})
        await recompute_product_stock(data.product_id)

    delta = data.quantity if data.type == "receipt" else -data.quantity
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
        "warehouse_id": data.warehouse_id,
        "warehouse_name": wh.get("name", ""),
        "warehouse_region": wh.get("region", ""),
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
    warehouse_id: str
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
    wh = await db.warehouses.find_one({"id": data.warehouse_id}, {"_id": 0, "id": 1, "name": 1, "region": 1})
    if not wh:
        raise HTTPException(status_code=404, detail="Склад не найден")

    now = datetime.now(timezone.utc).isoformat()
    processed = 0
    skipped = []
    for pid in data.product_ids:
        product = await db.products.find_one({"id": pid}, {"_id": 0, "id": 1, "name": 1, "article": 1, "stock": 1, "purchase_price": 1})
        if not product:
            skipped.append({"id": pid, "reason": "не найден"})
            continue
        stock_before = product.get("stock", 0) or 0
        unit_cost = product.get("purchase_price", 0) or 0
        if data.type == "receipt":
            if data.purchase_price is not None and data.purchase_price >= 0:
                unit_cost = data.purchase_price
                await db.products.update_one({"id": pid}, {"$set": {"purchase_price": data.purchase_price}})
            await add_stock(pid, data.warehouse_id, data.quantity)
        else:  # writeoff
            here = await warehouse_qty(pid, data.warehouse_id)
            if data.quantity > here:
                skipped.append({"id": pid, "name": product.get("name", ""), "reason": f"на складе {here}"})
                continue
            await db.stock_levels.update_one({"product_id": pid, "warehouse_id": data.warehouse_id}, {"$inc": {"quantity": -data.quantity}})
            await recompute_product_stock(pid)
        delta = data.quantity if data.type == "receipt" else -data.quantity
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
            "warehouse_id": data.warehouse_id,
            "warehouse_name": wh.get("name", ""),
            "warehouse_region": wh.get("region", ""),
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
    min_price: Optional[float] = None


class ReceiptCreate(BaseModel):
    supplier: Optional[str] = ""
    comment: Optional[str] = ""
    date: Optional[str] = None  # ISO
    warehouse_id: str
    items: list  # list[ReceiptItemIn]


@router.post("/admin/warehouse/receipts")
async def create_receipt(data: ReceiptCreate, user=Depends(get_current_user)):
    await _ensure_admin(user)
    raw_items = data.items or []
    if not raw_items:
        raise HTTPException(status_code=400, detail="Добавьте хотя бы один товар")
    wh = await db.warehouses.find_one({"id": data.warehouse_id}, {"_id": 0, "id": 1, "name": 1, "region": 1})
    if not wh:
        raise HTTPException(status_code=400, detail="Выберите склад приёмки")

    parsed = []
    for it in raw_items:
        pid = it.get("product_id")
        qty = int(it.get("quantity") or 0)
        pp = it.get("purchase_price")
        if not pid or qty <= 0:
            continue
        parsed.append({"product_id": pid, "quantity": qty, "purchase_price": pp, "min_price": it.get("min_price")})
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
            {"_id": 0, "id": 1, "name": 1, "article": 1, "stock": 1, "purchase_price": 1, "min_price": 1},
        )
        if not product:
            continue
        stock_before = product.get("stock", 0) or 0
        unit_cost = product.get("purchase_price", 0) or 0
        prod_set = {}
        if it["purchase_price"] is not None and it["purchase_price"] >= 0:
            unit_cost = float(it["purchase_price"])
            prod_set["purchase_price"] = unit_cost
        # Floor price: explicit value, else default to purchase+30% when product has none
        if it.get("min_price") is not None and it["min_price"] >= 0:
            prod_set["min_price"] = round(float(it["min_price"]), 2)
        elif not (product.get("min_price") or 0) and unit_cost:
            prod_set["min_price"] = round(unit_cost * 1.3, 2)
        if prod_set:
            await db.products.update_one({"id": it["product_id"]}, {"$set": prod_set})
        await add_stock(it["product_id"], data.warehouse_id, it["quantity"])
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
            "warehouse_id": data.warehouse_id,
            "warehouse_name": wh.get("name", ""),
            "warehouse_region": wh.get("region", ""),
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
        "warehouse_id": data.warehouse_id,
        "warehouse_name": wh.get("name", ""),
        "warehouse_region": wh.get("region", ""),
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
