"""Status and discount request routes"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
import uuid

from database import db, get_current_user
from models import StatusUpgradeRequest, IndividualDiscountRequest


router = APIRouter(tags=["requests"])


async def create_admin_activity(user_id: str, user_name: str, activity_type: str, message: str):
    """Create admin activity notification"""
    activity = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "type": activity_type,
        "message": message,
        "is_admin_notification": True,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.activities.insert_one(activity)


async def create_notification(user_id: str, notif_type: str, title: str, message: str, link: str = None):
    """Create user notification"""
    if user_id != "ADMIN":
        settings = await db.settings.find_one({"type": "notification_settings"}, {"_id": 0})
        if settings and not settings.get("client_notifications_enabled", True):
            return
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "link": link,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)


@router.post("/request-status-upgrade")
async def request_status_upgrade(data: StatusUpgradeRequest, user=Depends(get_current_user)):
    """User requests a status upgrade"""
    if data.requested_status not in ("wholesale", "partner"):
        raise HTTPException(status_code=400, detail="Недопустимый статус")
    
    current = user.get("customer_status", "retail")
    status_rank = {"retail": 0, "wholesale": 1, "partner": 2}
    if status_rank.get(current, 0) >= status_rank.get(data.requested_status, 0):
        raise HTTPException(status_code=400, detail="У вас уже есть этот статус или выше")
    
    existing = await db.status_requests.find_one({
        "user_id": user["id"], "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="У вас уже есть активный запрос на повышение статуса")
    
    orders = await db.orders.find({"user_id": user["id"], "status": "delivered"}).to_list(None)
    total_spent = sum(o.get("total", 0) for o in orders)
    
    settings = await db.settings.find_one({"key": "discount_settings"})
    settings_val = settings.get("value", {}) if settings else {}
    threshold = settings_val.get(f"{data.requested_status}_threshold", 50000 if data.requested_status == "wholesale" else 200000)
    
    if total_spent < threshold:
        raise HTTPException(status_code=400, detail=f"Недостаточная сумма заказов. Необходимо: {threshold:,.0f} ₽, у вас: {total_spent:,.0f} ₽")
    
    request_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "current_status": current,
        "requested_status": data.requested_status,
        "total_spent": total_spent,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.status_requests.insert_one(request_doc)
    await create_admin_activity(user["id"], user.get("name", ""), "status_request", f"Запрос на статус: {data.requested_status}")
    return {"success": True, "message": "Запрос на повышение статуса отправлен!"}


@router.post("/request-individual-discount")
async def request_individual_discount(data: IndividualDiscountRequest, user=Depends(get_current_user)):
    """User requests an individual discount"""
    if data.requested_discount <= 0 or data.requested_discount > 50:
        raise HTTPException(status_code=400, detail="Скидка должна быть от 1% до 50%")
    if not data.reason.strip():
        raise HTTPException(status_code=400, detail="Укажите причину запроса")
    
    existing = await db.discount_requests.find_one({
        "user_id": user["id"], "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="У вас уже есть активный запрос на скидку")
    
    request_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "current_discount": user.get("individual_discount", 0),
        "requested_discount": data.requested_discount,
        "reason": data.reason.strip(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.discount_requests.insert_one(request_doc)
    await create_admin_activity(user["id"], user.get("name", ""), "discount_request", f"Запрос на скидку: {data.requested_discount}%")
    return {"success": True, "message": "Запрос на индивидуальную скидку отправлен!"}


@router.get("/my-requests")
async def get_my_requests(user=Depends(get_current_user)):
    """Get current user's pending requests"""
    status_req = await db.status_requests.find_one(
        {"user_id": user["id"], "status": "pending"}, {"_id": 0}
    )
    discount_req = await db.discount_requests.find_one(
        {"user_id": user["id"], "status": "pending"}, {"_id": 0}
    )
    return {
        "status_request": status_req,
        "discount_request": discount_req
    }


@router.get("/my-prize-redemptions")
async def get_my_prize_redemptions(user=Depends(get_current_user)):
    """Get user's prize redemption history"""
    redemptions = await db.prize_redemptions.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"redemptions": redemptions}


@router.get("/admin/all-notifications")
async def get_admin_all_notifications(user=Depends(get_current_user)):
    """Get counts of pending admin notifications"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    status_count = await db.status_requests.count_documents({"status": "pending"})
    discount_count = await db.discount_requests.count_documents({"status": "pending"})
    bonus_count = await db.bonus_progress.count_documents({"bonus_requested": True})
    prize_count = await db.prize_redemptions.count_documents({"status": "pending"})
    order_count = await db.orders.count_documents({"status": "pending"})
    chats = await db.chats.find({}, {"_id": 0}).to_list(None)
    unread_chats = sum(1 for c in chats if c.get("admin_unread", 0) > 0)
    
    return {
        "status_requests": status_count,
        "discount_requests": discount_count,
        "bonus_requests": bonus_count,
        "prize_requests": prize_count,
        "new_orders": order_count,
        "unread_chats": unread_chats,
        "total": status_count + discount_count + bonus_count + prize_count + order_count + unread_chats
    }


@router.get("/admin/status-requests")
async def get_status_requests(user=Depends(get_current_user)):
    """Get all status upgrade requests"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await db.status_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.put("/admin/status-requests/{request_id}")
async def handle_status_request(request_id: str, action: str = Query(...), user=Depends(get_current_user)):
    """Approve or reject a status upgrade request"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")
    
    req = await db.status_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    
    if action == "approve":
        await db.users.update_one(
            {"id": req["user_id"]},
            {"$set": {"customer_status": req["requested_status"]}}
        )
    
    await db.status_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved" if action == "approve" else "rejected",
                  "handled_at": datetime.now(timezone.utc).isoformat()}}
    )
    status_text = "одобрен" if action == "approve" else "отклонён"
    await create_notification(req["user_id"], "status_response", "Запрос на статус", f"Ваш запрос на повышение статуса {status_text}", "/account")
    return {"success": True}


@router.get("/admin/discount-requests")
async def get_discount_requests(user=Depends(get_current_user)):
    """Get all individual discount requests"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await db.discount_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.put("/admin/discount-requests/{request_id}")
async def handle_discount_request(request_id: str, action: str = Query(...), discount: float = Query(None), user=Depends(get_current_user)):
    """Approve or reject a discount request"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")
    
    req = await db.discount_requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    
    if action == "approve":
        final_discount = discount if discount is not None else req["requested_discount"]
        current_user = await db.users.find_one({"id": req["user_id"]}, {"_id": 0})
        current_ind = current_user.get("individual_discount", 0) if current_user else 0
        new_total = current_ind + final_discount
        await db.users.update_one(
            {"id": req["user_id"]},
            {"$set": {"individual_discount": new_total}}
        )
    
    await db.discount_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved" if action == "approve" else "rejected",
                  "handled_at": datetime.now(timezone.utc).isoformat()}}
    )
    status_text = "одобрена" if action == "approve" else "отклонена"
    await create_notification(req["user_id"], "discount_response", "Запрос на скидку", f"Ваша заявка на индивидуальную скидку {status_text}", "/account")
    return {"success": True}
