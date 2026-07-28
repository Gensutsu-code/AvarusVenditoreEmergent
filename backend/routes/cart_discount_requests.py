"""Cart-wide discount requests: client asks for a % discount on the whole cart,
admin approves with their own %, discount applies to the cart until one order is placed."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db, get_current_user
from notify import notify_user, notify_admin

router = APIRouter(tags=["cart-discount-requests"])


class CartDiscountCreate(BaseModel):
    requested_percent: float
    message: str = ""


class CartDiscountApprove(BaseModel):
    admin_percent: float
    response_message: str = ""


class CartDiscountReject(BaseModel):
    response_message: str = ""


def _now():
    return datetime.now(timezone.utc).isoformat()


# --- Client endpoints ---

@router.post("/cart-discount-requests")
async def create_cart_discount_request(data: CartDiscountCreate, user=Depends(get_current_user)):
    """Client requests a discount on the whole cart."""
    if data.requested_percent <= 0 or data.requested_percent > 90:
        raise HTTPException(status_code=400, detail="Процент скидки должен быть от 1 до 90")

    existing = await db.cart_discount_requests.find_one({
        "user_id": user["id"],
        "status": {"$in": ["pending", "approved"]}
    })
    if existing:
        if existing["status"] == "pending":
            raise HTTPException(status_code=400, detail="У вас уже есть активный запрос на скидку. Дождитесь ответа администратора.")
        raise HTTPException(status_code=400, detail="У вас уже есть одобренная скидка на корзину. Оформите заказ или дождитесь её использования.")

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "requested_percent": round(float(data.requested_percent), 2),
        "admin_percent": None,
        "message": data.message,
        "status": "pending",
        "admin_response": "",
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.cart_discount_requests.insert_one(doc)
    await notify_admin(
        "cart_discount_request",
        f"Запрос скидки на корзину от {user.get('name', user.get('email', ''))}",
        f"Желаемая скидка: {data.requested_percent:.0f}%" + (f". {data.message}" if data.message else ""),
        "/admin/chats"
    )
    doc.pop("_id", None)
    return doc


@router.get("/cart-discount-requests/my")
async def get_my_cart_discount_requests(user=Depends(get_current_user)):
    reqs = await db.cart_discount_requests.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return reqs


@router.get("/cart-discount/active")
async def get_active_cart_discount(user=Depends(get_current_user)):
    """The currently approved (unused) cart discount for this user, or null."""
    cd = await db.cart_discount_requests.find_one(
        {"user_id": user["id"], "status": "approved"}, {"_id": 0}
    )
    return cd


@router.delete("/cart-discount-requests/{request_id}")
async def cancel_cart_discount_request(request_id: str, user=Depends(get_current_user)):
    """Client cancels their own pending or approved (unused) cart discount."""
    req = await db.cart_discount_requests.find_one({"id": request_id, "user_id": user["id"]}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req["status"] not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail="Этот запрос уже нельзя отменить")
    await db.cart_discount_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "cancelled", "updated_at": _now()}}
    )
    return {"success": True}


# --- Admin endpoints ---

@router.get("/admin/cart-discount-requests")
async def get_all_cart_discount_requests(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    reqs = await db.cart_discount_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return reqs


@router.put("/admin/cart-discount-requests/{request_id}/approve")
async def approve_cart_discount_request(request_id: str, data: CartDiscountApprove, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    req = await db.cart_discount_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Запрос уже обработан")
    if data.admin_percent <= 0 or data.admin_percent > 90:
        raise HTTPException(status_code=400, detail="Процент скидки должен быть от 1 до 90")

    # Supersede any other approved-unused discount for this user (only one active)
    await db.cart_discount_requests.update_many(
        {"user_id": req["user_id"], "status": "approved"},
        {"$set": {"status": "superseded", "updated_at": _now()}}
    )

    await db.cart_discount_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "approved",
            "admin_percent": round(float(data.admin_percent), 2),
            "admin_response": data.response_message,
            "updated_at": _now(),
        }}
    )
    await notify_user(
        req["user_id"],
        "cart_discount_approved",
        "Скидка на корзину одобрена",
        data.response_message or f"Вам одобрена скидка {data.admin_percent:.0f}% на корзину. Она уже применена к вашей корзине.",
        "/checkout"
    )
    updated = await db.cart_discount_requests.find_one({"id": request_id}, {"_id": 0})
    return updated


@router.put("/admin/cart-discount-requests/{request_id}/reject")
async def reject_cart_discount_request(request_id: str, data: CartDiscountReject, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    req = await db.cart_discount_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Запрос уже обработан")
    await db.cart_discount_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "admin_response": data.response_message, "updated_at": _now()}}
    )
    await notify_user(
        req["user_id"],
        "cart_discount_rejected",
        "Запрос скидки на корзину отклонён",
        data.response_message or "К сожалению, мы не можем предоставить скидку на корзину.",
        "/checkout"
    )
    updated = await db.cart_discount_requests.find_one({"id": request_id}, {"_id": 0})
    return updated
