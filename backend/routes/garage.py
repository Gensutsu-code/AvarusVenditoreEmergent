"""Client garage: vehicles / trailers with VIN and the history of parts bought for each of them."""
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db, get_current_user

router = APIRouter(tags=["garage"])
VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
VEHICLE_FIELDS = ("type", "name", "vin", "year", "plate", "note")


class VehicleIn(BaseModel):
    type: str = "truck"  # 'truck' | 'trailer'
    name: str = Field(min_length=1, max_length=120)
    vin: str = Field(min_length=17, max_length=17)
    year: Optional[int] = Field(default=None, ge=1950, le=2100)
    plate: str = Field(default="", max_length=20)
    note: str = Field(default="", max_length=300)


class OrderVehicleIn(BaseModel):
    vehicle_id: Optional[str] = None


def _now():
    return datetime.now(timezone.utc).isoformat()


async def own_vehicle(user_id: str, vehicle_id: str):
    v = await db.garage_vehicles.find_one({"id": vehicle_id, "user_id": user_id, "deleted_at": None}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Авто не найдено в вашем гараже")
    return v


async def _clean(user_id: str, data: VehicleIn, exclude_id: Optional[str] = None):
    if data.type not in ("truck", "trailer"):
        raise HTTPException(status_code=400, detail="Тип: автомобиль или прицеп")
    vin = data.vin.strip().upper()
    if not VIN_RE.match(vin):
        raise HTTPException(status_code=400, detail="VIN: 17 символов, латинские буквы (кроме I, O, Q) и цифры")
    if await db.garage_vehicles.find_one({"user_id": user_id, "vin": vin, "deleted_at": None, "id": {"$ne": exclude_id}}):
        raise HTTPException(status_code=400, detail="Авто с таким VIN уже есть в гараже")
    return {"type": data.type, "name": data.name.strip(), "vin": vin, "year": data.year,
            "plate": data.plate.strip().upper(), "note": data.note.strip()}


def _order_summary(o):
    return {"id": o["id"], "created_at": o.get("created_at"), "total": o.get("total"), "vehicle_id": o.get("vehicle_id"),
            "items": [{"name": i.get("name"), "article": i.get("article"), "quantity": i.get("quantity")} for i in o.get("items", [])]}


@router.get("/garage")
async def get_garage(user=Depends(get_current_user)):
    """Vehicles with bought parts (aggregated per product, with current price/stock for re-buying) + orders without a vehicle."""
    vehicles = await db.garage_vehicles.find({"user_id": user["id"], "deleted_at": None}, {"_id": 0}).sort("created_at", 1).to_list(200)
    orders = await db.orders.find({"user_id": user["id"], "status": {"$ne": "cancelled"}}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    ids = {v["id"] for v in vehicles}
    parts = {v["id"]: {} for v in vehicles}
    orders_by_vehicle = {v["id"]: [] for v in vehicles}
    unassigned = []
    for o in orders:
        vid = o.get("vehicle_id")
        if vid not in ids:
            unassigned.append(_order_summary(o))
            continue
        orders_by_vehicle[vid].append(_order_summary(o))
        for i in o.get("items", []):
            p = parts[vid].setdefault(i.get("product_id"), {"product_id": i.get("product_id"), "name": i.get("name"), "article": i.get("article"),
                                                            "quantity": 0, "times": 0, "last_bought_at": o.get("created_at"), "last_price": i.get("price")})
            p["quantity"] += i.get("quantity") or 0
            p["times"] += 1
    pids = list({pid for d in parts.values() for pid in d})
    live = {p["id"]: p for p in await db.products.find({"id": {"$in": pids}}, {"_id": 0, "id": 1, "price": 1, "stock": 1, "image_url": 1}).to_list(len(pids) or 1)}
    for v in vehicles:
        rows = list(parts[v["id"]].values())
        for r in rows:
            lp = live.get(r["product_id"])
            r["available"] = bool(lp)
            r["price"] = lp.get("price") if lp else None
            r["in_stock"] = bool(lp and (lp.get("stock") or 0) > 0)
            r["image_url"] = lp.get("image_url") if lp else None
        v["parts"] = sorted(rows, key=lambda r: r["last_bought_at"] or "", reverse=True)
        v["orders"] = orders_by_vehicle[v["id"]][:50]
    return {"vehicles": vehicles, "unassigned_orders": unassigned[:30]}


@router.get("/garage/vehicles")
async def list_vehicles(user=Depends(get_current_user)):
    return await db.garage_vehicles.find({"user_id": user["id"], "deleted_at": None}, {"_id": 0}).sort("created_at", 1).to_list(200)


@router.post("/garage/vehicles")
async def add_vehicle(data: VehicleIn, user=Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **(await _clean(user["id"], data)), "deleted_at": None, "created_at": _now()}
    await db.garage_vehicles.insert_one(dict(doc))
    return doc


@router.put("/garage/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, data: VehicleIn, user=Depends(get_current_user)):
    await own_vehicle(user["id"], vehicle_id)
    await db.garage_vehicles.update_one({"id": vehicle_id}, {"$set": await _clean(user["id"], data, vehicle_id)})
    return await own_vehicle(user["id"], vehicle_id)


@router.delete("/garage/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, user=Depends(get_current_user)):
    """Soft delete; its orders become 'without a vehicle'."""
    await own_vehicle(user["id"], vehicle_id)
    await db.garage_vehicles.update_one({"id": vehicle_id}, {"$set": {"deleted_at": _now()}})
    return {"success": True}


@router.put("/garage/orders/{order_id}/vehicle")
async def set_order_vehicle(order_id: str, data: OrderVehicleIn, user=Depends(get_current_user)):
    if data.vehicle_id:
        await own_vehicle(user["id"], data.vehicle_id)
    res = await db.orders.update_one({"id": order_id, "user_id": user["id"]}, {"$set": {"vehicle_id": data.vehicle_id or None}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    return {"success": True}
