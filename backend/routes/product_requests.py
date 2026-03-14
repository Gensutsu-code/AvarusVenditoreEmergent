"""Product request routes - for out-of-stock or not-found products"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db, get_current_user
from notify import notify_user, notify_admin

router = APIRouter(tags=["product-requests"])


class ProductRequestCreate(BaseModel):
    article: str
    quantity: int = 1
    comment: str = ""
    product_id: Optional[str] = None
    product_name: Optional[str] = None


class ProductRequestRespond(BaseModel):
    response_message: str
    status: str = "responded"  # responded, fulfilled, rejected


@router.post("/product-requests")
async def create_product_request(data: ProductRequestCreate, user=Depends(get_current_user)):
    product_info = None
    if data.product_id:
        product_info = await db.products.find_one({"id": data.product_id}, {"_id": 0, "name": 1, "article": 1, "image_url": 1, "price": 1})

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "article": data.article,
        "quantity": data.quantity,
        "comment": data.comment,
        "product_id": data.product_id,
        "product_name": data.product_name or (product_info.get("name") if product_info else None),
        "product_image_url": product_info.get("image_url") if product_info else None,
        "product_price": product_info.get("price") if product_info else None,
        "status": "pending",
        "admin_response": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.product_requests.insert_one(doc)

    await notify_admin(
        "product_request",
        f"Запрос товара от {user.get('name', user.get('email', ''))}",
        f"Артикул: {data.article}, Кол-во: {data.quantity}",
        "/admin/chats"
    )

    doc.pop("_id", None)
    return doc


@router.get("/product-requests/my")
async def get_my_product_requests(user=Depends(get_current_user)):
    requests = await db.product_requests.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return requests


@router.get("/admin/product-requests")
async def get_all_product_requests(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    requests = await db.product_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return requests


@router.put("/admin/product-requests/{request_id}/respond")
async def respond_product_request(request_id: str, data: ProductRequestRespond, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    req = await db.product_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")

    await db.product_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": data.status,
            "admin_response": data.response_message,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    status_text = {
        "responded": "получил ответ",
        "fulfilled": "выполнен",
        "rejected": "отклонён"
    }.get(data.status, "обновлён")

    await notify_user(
        req["user_id"],
        "product_request_response",
        f"Запрос товара {status_text}",
        data.response_message or f"Ваш запрос на артикул {req['article']} {status_text}",
        "/orders"
    )

    updated = await db.product_requests.find_one({"id": request_id}, {"_id": 0})
    return updated
