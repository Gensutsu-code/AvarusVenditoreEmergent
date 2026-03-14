"""Discount request routes for individual pricing"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from database import db, get_current_user
from notify import notify_user, notify_admin

router = APIRouter(tags=["discount-requests"])


class DiscountRequestCreate(BaseModel):
    product_id: str
    message: str = ""
    image_url: Optional[str] = None


class DiscountRequestApprove(BaseModel):
    individual_price: float
    response_message: str = ""


class DiscountRequestReject(BaseModel):
    response_message: str = ""


# --- Client endpoints ---

@router.post("/discount-requests")
async def create_discount_request(data: DiscountRequestCreate, user=Depends(get_current_user)):
    """Client submits a discount request for a product"""
    product = await db.products.find_one({"id": data.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    # Check for existing pending request
    existing = await db.discount_requests.find_one({
        "user_id": user["id"],
        "product_id": data.product_id,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="У вас уже есть активный запрос на скидку для этого товара")

    request_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "product_id": data.product_id,
        "product_name": product.get("name", ""),
        "product_article": product.get("article", ""),
        "product_image_url": product.get("image_url"),
        "current_price": product.get("price", 0),
        "message": data.message,
        "image_url": data.image_url,
        "status": "pending",
        "admin_response": "",
        "individual_price": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    await db.discount_requests.insert_one(request_doc)

    # Notify admin
    await notify_admin(
        "discount_request",
        f"Запрос на скидку от {user.get('name', user.get('email', ''))}",
        f"Товар: {product.get('name', '')} ({product.get('article', '')})",
        "/admin/chats"
    )

    # Return without _id
    request_doc.pop("_id", None)
    return request_doc


@router.get("/discount-requests/my")
async def get_my_discount_requests(user=Depends(get_current_user)):
    """Client gets their discount requests"""
    requests = await db.discount_requests.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return requests


@router.get("/individual-prices/my")
async def get_my_individual_prices(user=Depends(get_current_user)):
    """Client gets their active individual prices"""
    prices = await db.individual_prices.find(
        {"user_id": user["id"], "active": True},
        {"_id": 0}
    ).to_list(100)
    return prices


# --- Admin endpoints ---

@router.get("/admin/discount-requests")
async def get_all_discount_requests(user=Depends(get_current_user)):
    """Admin gets all discount requests"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    requests = await db.discount_requests.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return requests


@router.put("/admin/discount-requests/{request_id}/approve")
async def approve_discount_request(
    request_id: str,
    data: DiscountRequestApprove,
    user=Depends(get_current_user)
):
    """Admin approves a discount request and sets individual price"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    req = await db.discount_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Запрос уже обработан")

    if data.individual_price <= 0:
        raise HTTPException(status_code=400, detail="Цена должна быть больше 0")

    # Update request
    await db.discount_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "approved",
            "individual_price": data.individual_price,
            "admin_response": data.response_message,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Deactivate any existing individual price for this user+product
    await db.individual_prices.update_many(
        {"user_id": req["user_id"], "product_id": req["product_id"]},
        {"$set": {"active": False}}
    )

    # Create individual price record
    price_doc = {
        "id": str(uuid.uuid4()),
        "user_id": req["user_id"],
        "product_id": req["product_id"],
        "price": data.individual_price,
        "request_id": request_id,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.individual_prices.insert_one(price_doc)

    # Notify client
    await notify_user(
        req["user_id"],
        "discount_approved",
        "Запрос на скидку одобрен",
        data.response_message or f"Ваша индивидуальная цена на {req['product_name']}: {data.individual_price} ₽",
        "/catalog"
    )

    updated = await db.discount_requests.find_one({"id": request_id}, {"_id": 0})
    return updated


@router.put("/admin/discount-requests/{request_id}/reject")
async def reject_discount_request(
    request_id: str,
    data: DiscountRequestReject,
    user=Depends(get_current_user)
):
    """Admin rejects a discount request"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    req = await db.discount_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Запрос уже обработан")

    await db.discount_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "rejected",
            "admin_response": data.response_message,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    # Notify client
    await notify_user(
        req["user_id"],
        "discount_rejected",
        "Запрос на скидку отклонён",
        data.response_message or f"К сожалению, мы не можем предложить скидку на {req['product_name']}",
        "/catalog"
    )

    updated = await db.discount_requests.find_one({"id": request_id}, {"_id": 0})
    return updated
