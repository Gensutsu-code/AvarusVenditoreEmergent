"""Discount request routes for individual pricing"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
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


class AccountDiscountBody(BaseModel):
    discount_percent: float
    response_message: str = ""


class ClientRejectBody(BaseModel):
    reason: str = ""


# --- Account-wide individual discount: approve immediately / counter-offer / client accept-reject ---

@router.put("/admin/discount-requests/{request_id}/approve-discount")
async def approve_account_discount(request_id: str, data: AccountDiscountBody, user=Depends(get_current_user)):
    """Admin applies an account-wide individual discount immediately."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    req = await db.discount_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req.get("status") not in ("pending", "offered"):
        raise HTTPException(status_code=400, detail="Запрос уже обработан")
    if data.discount_percent <= 0 or data.discount_percent > 90:
        raise HTTPException(status_code=400, detail="Скидка должна быть от 1 до 90%")
    now = datetime.now(timezone.utc).isoformat()
    await db.discount_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "approved_discount": data.discount_percent, "admin_response": data.response_message, "updated_at": now}},
    )
    await db.users.update_one({"id": req["user_id"]}, {"$set": {"individual_discount": data.discount_percent}})
    await notify_user(
        req["user_id"], "discount_approved", "Индивидуальная скидка одобрена",
        data.response_message or f"Вам одобрена индивидуальная скидка {data.discount_percent:.0f}% (при оплате с баланса).",
        "/contact",
    )
    return await db.discount_requests.find_one({"id": request_id}, {"_id": 0})


@router.put("/admin/discount-requests/{request_id}/offer-discount")
async def offer_account_discount(request_id: str, data: AccountDiscountBody, user=Depends(get_current_user)):
    """Admin proposes a counter individual-discount %. Applied only after the client accepts."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    req = await db.discount_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req.get("status") not in ("pending", "offered"):
        raise HTTPException(status_code=400, detail="Запрос уже обработан")
    if data.discount_percent <= 0 or data.discount_percent > 90:
        raise HTTPException(status_code=400, detail="Скидка должна быть от 1 до 90%")
    now = datetime.now(timezone.utc).isoformat()
    await db.discount_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "offered", "offered_discount": data.discount_percent, "admin_response": data.response_message, "updated_at": now}},
    )
    await notify_user(
        req["user_id"], "discount_offer", "Предложение по индивидуальной скидке",
        (data.response_message + " " if data.response_message else "") + f"Предложена скидка {data.discount_percent:.0f}%. Примите или отклоните в разделе «Мои обращения».",
        "/contact",
    )
    return await db.discount_requests.find_one({"id": request_id}, {"_id": 0})


@router.post("/discount-requests/{request_id}/accept")
async def accept_discount_offer(request_id: str, user=Depends(get_current_user)):
    """Client accepts the admin's counter individual-discount offer."""
    req = await db.discount_requests.find_one({"id": request_id, "user_id": user["id"]}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req.get("status") != "offered":
        raise HTTPException(status_code=400, detail="Нет активного предложения для принятия")
    pct = req.get("offered_discount", 0) or 0
    now = datetime.now(timezone.utc).isoformat()
    await db.discount_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "accepted", "approved_discount": pct, "client_decision_at": now, "updated_at": now}},
    )
    await db.users.update_one({"id": req["user_id"]}, {"$set": {"individual_discount": pct}})
    await notify_admin(
        "discount_request", "Клиент принял индивидуальную скидку",
        f"{user.get('name', user.get('email',''))} принял индивидуальную скидку {pct:.0f}%.",
        "/admin/chats",
    )
    return await db.discount_requests.find_one({"id": request_id}, {"_id": 0})


@router.post("/discount-requests/{request_id}/reject")
async def reject_discount_offer(request_id: str, data: ClientRejectBody, user=Depends(get_current_user)):
    """Client rejects the admin's counter individual-discount offer."""
    req = await db.discount_requests.find_one({"id": request_id, "user_id": user["id"]}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req.get("status") != "offered":
        raise HTTPException(status_code=400, detail="Нет активного предложения для отклонения")
    now = datetime.now(timezone.utc).isoformat()
    await db.discount_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected_by_client", "client_reject_reason": (data.reason or "").strip(), "client_decision_at": now, "updated_at": now}},
    )
    reason_txt = f" Причина: {data.reason.strip()}" if (data.reason and data.reason.strip()) else ""
    await notify_admin(
        "discount_request", "Клиент отклонил индивидуальную скидку",
        f"{user.get('name', user.get('email',''))} отклонил предложенную индивидуальную скидку.{reason_txt}",
        "/admin/chats",
    )
    return await db.discount_requests.find_one({"id": request_id}, {"_id": 0})


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
