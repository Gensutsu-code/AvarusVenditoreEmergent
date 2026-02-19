"""Admin routes for user and order management"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
from collections import defaultdict
import uuid

from database import db, get_current_user, hash_password
from models import AdminUserCreate, AdminUserUpdate, AdminOrderUpdate

router = APIRouter(prefix="/admin", tags=["admin"])


# Helper
async def create_notification(user_id: str, notif_type: str, title: str, message: str, link: str = None):
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


# ==================== STATS ====================

@router.get("/stats")
async def get_admin_stats(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    completed_orders = await db.orders.count_documents({"status": "delivered"})
    
    pipeline = [{"$group": {"_id": None, "total_revenue": {"$sum": "$total"}}}]
    result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = result[0]["total_revenue"] if result else 0
    
    return {
        "total_users": total_users,
        "total_products": total_products,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "completed_orders": completed_orders,
        "total_revenue": total_revenue
    }


# ==================== USER MANAGEMENT ====================

@router.get("/users")
async def get_admin_users(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    
    for u in users:
        user_orders = await db.orders.find({"user_id": u["id"]}, {"_id": 0}).to_list(1000)
        u["total_orders"] = len(user_orders)
        u["total_spent"] = sum(o.get("total", 0) for o in user_orders)
        if "password" in u:
            del u["password"]
    
    return users


@router.get("/users/{user_id}/details")
async def get_admin_user_details(user_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if "password" in target_user:
        del target_user["password"]
    if "password_hash" in target_user:
        del target_user["password_hash"]
    
    user_orders = await db.orders.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    total_orders = len(user_orders)
    total_spent = sum(o.get("total", 0) for o in user_orders)
    total_items = sum(sum(item.get("quantity", 0) for item in o.get("items", [])) for o in user_orders)
    avg_order_value = total_spent / total_orders if total_orders > 0 else 0
    
    orders_by_status = {}
    for o in user_orders:
        status = o.get("status", "pending")
        orders_by_status[status] = orders_by_status.get(status, 0) + 1
    
    delivered_total = sum(o.get("total", 0) for o in user_orders if o.get("status") == "delivered")
    
    order_dates = [o.get("created_at") for o in user_orders if o.get("created_at")]
    first_order_date = min(order_dates) if order_dates else None
    last_order_date = max(order_dates) if order_dates else None
    
    product_count = defaultdict(lambda: {"name": "", "article": "", "count": 0, "total_spent": 0})
    for o in user_orders:
        for item in o.get("items", []):
            pid = item.get("product_id") or item.get("article", "")
            product_count[pid]["name"] = item.get("name", "")
            product_count[pid]["article"] = item.get("article", "")
            product_count[pid]["count"] += item.get("quantity", 1)
            product_count[pid]["total_spent"] += item.get("price", 0) * item.get("quantity", 1)
    
    favorite_products = sorted(
        [{"product_id": k, **v} for k, v in product_count.items()],
        key=lambda x: x["count"], reverse=True
    )[:5]
    
    bonus_progress = await db.bonus_progress.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    recent_orders = user_orders[:5]
    
    return {
        "user": target_user,
        "statistics": {
            "total_orders": total_orders,
            "total_spent": round(total_spent, 2),
            "total_items": total_items,
            "avg_order_value": round(avg_order_value, 2),
            "delivered_total": round(delivered_total, 2),
            "orders_by_status": orders_by_status,
            "first_order_date": first_order_date,
            "last_order_date": last_order_date,
            "favorite_products": favorite_products
        },
        "bonus_progress": bonus_progress,
        "recent_orders": recent_orders
    }


@router.post("/users")
async def create_admin_user(data: AdminUserCreate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    new_user = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "password_plain": data.password,
        "name": data.name,
        "phone": data.phone,
        "address": data.address,
        "address_comment": data.address_comment,
        "role": data.role,
        "customer_status": "retail",
        "individual_discount": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    await db.carts.insert_one({"user_id": user_id, "items": []})
    
    return {"id": user_id, "email": data.email, "name": data.name, "role": data.role}


@router.put("/users/{user_id}")
async def update_admin_user(user_id: str, data: AdminUserUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if "password" in update_data:
        update_data["password_plain"] = update_data["password"]
        update_data["password"] = hash_password(update_data["password"])
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user


@router.delete("/users/{user_id}")
async def delete_admin_user(user_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.carts.delete_one({"user_id": user_id})
    return {"message": "User deleted"}


# ==================== ORDER MANAGEMENT ====================

@router.get("/orders")
async def get_admin_orders(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders


@router.put("/orders/{order_id}")
async def update_admin_order(order_id: str, data: AdminOrderUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if "status" in update_data:
        valid_statuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
        if update_data["status"] not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status")
    
    if "items" in update_data:
        original_total = 0
        discounted_total = 0
        for item in update_data["items"]:
            item_price = item.get("price", 0)
            item_qty = item.get("quantity", 1)
            item_discount = item.get("discount_percent", 0)
            item_total = item_price * item_qty
            original_total += item_total
            discounted_total += item_total * (1 - item_discount / 100)
        
        update_data["original_total"] = original_total
        order_discount = update_data.get("order_discount_percent", 0)
        if order_discount > 0:
            discounted_total = discounted_total * (1 - order_discount / 100)
        update_data["total"] = round(discounted_total, 2)
    
    elif "order_discount_percent" in update_data:
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if order:
            order_discount = update_data["order_discount_percent"]
            item_total = 0
            for item in order.get("items", []):
                item_price = item.get("price", 0)
                item_qty = item.get("quantity", 1)
                item_discount = item.get("discount_percent", 0)
                item_total += item_price * item_qty * (1 - item_discount / 100)
            update_data["total"] = round(item_total * (1 - order_discount / 100), 2)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated_order


@router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    valid_statuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_status = order.get("status")
    
    # Restore stock if cancelling
    if status == "cancelled" and old_status != "cancelled":
        for item in order.get("items", []):
            await db.products.update_one(
                {"id": item.get("product_id")},
                {"$inc": {"stock": item.get("quantity", 0)}}
            )
    
    await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    
    # Notify user
    status_labels = {
        "pending": "в обработке",
        "processing": "комплектуется",
        "shipped": "отправлен",
        "delivered": "доставлен",
        "cancelled": "отменён"
    }
    await create_notification(
        order["user_id"], "order",
        f"Статус заказа #{order_id[:8]}",
        f"Ваш заказ {status_labels.get(status, status)}",
        "/orders"
    )
    
    return {"message": "Status updated", "status": status}


@router.delete("/orders/{order_id}")
async def delete_admin_order(order_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Restore stock
    for item in order.get("items", []):
        await db.products.update_one(
            {"id": item.get("product_id")},
            {"$inc": {"stock": item.get("quantity", 0)}}
        )
    
    await db.orders.delete_one({"id": order_id})
    return {"message": "Order deleted"}


# ==================== NOTIFICATIONS ====================

@router.get("/notifications")
async def get_admin_notifications(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    notifications = await db.activities.find(
        {"is_admin_notification": True},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    unread_count = await db.activities.count_documents({"is_admin_notification": True, "read": False})
    
    return {"notifications": notifications, "unread_count": unread_count}


@router.post("/notifications/mark-read")
async def mark_admin_notifications_read(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.activities.update_many(
        {"is_admin_notification": True, "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "Notifications marked as read"}



# ==================== ADMIN ACTIVITIES ====================

@router.get("/activities")
async def get_admin_activities(user=Depends(get_current_user)):
    """Get admin activity log"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    activities = await db.activities.find(
        {"is_admin_notification": True}, {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    return activities


@router.put("/activities/read-all")
async def mark_activities_read(user=Depends(get_current_user)):
    """Mark all admin activities as read"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.activities.update_many(
        {"is_admin_notification": True, "read": False},
        {"$set": {"read": True}}
    )
    return {"success": True}


# ==================== ADMIN CREATE ====================

@router.post("/create-admin")
async def create_admin_user_direct(data: AdminUserCreate, user=Depends(get_current_user)):
    """Create admin user directly"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    new_user = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "password_plain": data.password,
        "name": data.name,
        "phone": data.phone,
        "address": data.address,
        "address_comment": data.address_comment,
        "role": "admin",
        "customer_status": "retail",
        "individual_discount": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    
    return {"id": user_id, "email": data.email, "name": data.name, "role": "admin"}


# ==================== EXTENDED STATS ====================

@router.get("/stats/extended")
async def get_admin_stats_extended(user=Depends(get_current_user)):
    """Get extended admin statistics"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    completed_orders = await db.orders.count_documents({"status": "delivered"})
    new_orders = await db.orders.count_documents({"status": "new"})
    
    pipeline = [{"$group": {"_id": None, "total_revenue": {"$sum": "$total"}}}]
    result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = result[0]["total_revenue"] if result else 0
    
    # Monthly stats
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    monthly_orders = await db.orders.count_documents({
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    monthly_revenue_pipeline = [
        {"$match": {"created_at": {"$gte": month_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    monthly_result = await db.orders.aggregate(monthly_revenue_pipeline).to_list(1)
    monthly_revenue = monthly_result[0]["total"] if monthly_result else 0
    
    return {
        "total_users": total_users,
        "total_products": total_products,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "completed_orders": completed_orders,
        "new_orders": new_orders,
        "total_revenue": total_revenue,
        "monthly_orders": monthly_orders,
        "monthly_revenue": monthly_revenue
    }
