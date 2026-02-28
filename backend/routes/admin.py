"""Admin routes for user and order management"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import uuid
import asyncio

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
    completed_orders = await db.orders.count_documents({"status": "completed"})
    
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
        user_orders = await db.orders.find({"user_id": u["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
        
        # Basic stats
        u["orders_count"] = len(user_orders)
        u["total_orders"] = len(user_orders)
        u["total_spent"] = sum(o.get("total", 0) for o in user_orders)
        u["total_items"] = sum(sum(item.get("quantity", 0) for item in o.get("items", [])) for o in user_orders)
        
        # Order dates
        order_dates = [o.get("created_at") for o in user_orders if o.get("created_at")]
        u["first_order_date"] = min(order_dates) if order_dates else None
        u["last_order_date"] = max(order_dates) if order_dates else None
        
        # Popular products for this user
        product_count = defaultdict(lambda: {"name": "", "sku": "", "quantity": 0})
        for o in user_orders:
            for item in o.get("items", []):
                pid = item.get("product_id") or item.get("article", "")
                product_count[pid]["name"] = item.get("name", "")
                product_count[pid]["sku"] = item.get("article", "")
                product_count[pid]["quantity"] += item.get("quantity", 1)
        
        u["popular_products"] = sorted(
            [{"product_id": k, **v} for k, v in product_count.items()],
            key=lambda x: x["quantity"], reverse=True
        )[:3]
        
        # Recent orders (last 3)
        u["recent_orders"] = [
            {
                "id": o.get("id", ""),
                "status": o.get("status", "pending"),
                "total": o.get("total", 0),
                "created_at": o.get("created_at")
            }
            for o in user_orders[:3]
        ]
        
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
    
    delivered_total = sum(o.get("total", 0) for o in user_orders if o.get("status") == "completed")
    
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
    
    # Enrich orders with user data
    user_ids = list(set(o.get("user_id") for o in orders if o.get("user_id")))
    users_data = {}
    if user_ids:
        users_cursor = db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1})
        async for u in users_cursor:
            users_data[u["id"]] = u
    
    for order in orders:
        uid = order.get("user_id")
        if uid and uid in users_data:
            order["customer_name"] = users_data[uid].get("name") or users_data[uid].get("email", "")
            order["customer_email"] = users_data[uid].get("email", "")
    
    return orders


@router.put("/orders/{order_id}")
async def update_admin_order(order_id: str, data: AdminOrderUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get original order to compare changes
    original_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not original_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if "status" in update_data:
        valid_statuses = ["pending", "processing", "completed", "cancelled"]
        if update_data["status"] not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        # Track when order moves to processing for 24-hour cancel window
        if update_data["status"] == "processing" and original_order.get("status") != "processing":
            update_data["processing_started_at"] = datetime.now(timezone.utc).isoformat()
    
    # Track changes for notification
    changes = []
    price_changed = False
    quantity_changed = False
    
    if "items" in update_data:
        original_items = {item.get("product_id", item.get("article")): item for item in original_order.get("items", [])}
        
        for new_item in update_data["items"]:
            item_key = new_item.get("product_id", new_item.get("article"))
            original_item = original_items.get(item_key, {})
            
            # Preserve article from original if missing
            if not new_item.get("article") and original_item.get("article"):
                new_item["article"] = original_item["article"]
            
            if original_item.get("price") != new_item.get("price"):
                price_changed = True
            if original_item.get("quantity") != new_item.get("quantity"):
                quantity_changed = True
        
        # Calculate new total (without discount logic)
        total = 0
        for item in update_data["items"]:
            item_price = item.get("price", 0)
            item_qty = item.get("quantity", 1)
            total += item_price * item_qty
        
        update_data["total"] = round(total, 2)
    
    # If there were changes, mark order for customer confirmation
    if price_changed or quantity_changed:
        update_data["has_changes"] = True
        update_data["changes_at"] = datetime.now(timezone.utc).isoformat()
        expire_time = datetime.now(timezone.utc) + timedelta(hours=24)
        update_data["changes_expire_at"] = expire_time.isoformat()
        
        if price_changed:
            changes.append("price")
        if quantity_changed:
            changes.append("quantity")
        
        update_data["change_types"] = changes
        update_data["awaiting_confirmation"] = True
        
        # Save previous data for comparison
        update_data["previous_items"] = original_order.get("items", [])
        update_data["previous_total"] = original_order.get("total", 0)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Send notification to customer about changes
    if price_changed or quantity_changed:
        change_msg_parts = []
        if price_changed:
            change_msg_parts.append("цена товара")
        if quantity_changed:
            change_msg_parts.append("количество товара")
        
        await create_notification(
            original_order["user_id"], 
            "order_change",
            f"Изменения в заказе #{order_id[:8]}",
            f"Изменилось: {', '.join(change_msg_parts)}. Подтвердите изменения в течение 24 часов.",
            "/orders"
        )
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated_order


@router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    valid_statuses = ["pending", "processing", "completed", "cancelled"]
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
        "pending": "ожидает обработки",
        "processing": "принят в обработку",
        "completed": "выполнен",
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
    
    notifications = await db.notifications.find(
        {"user_id": "ADMIN"},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    unread_count = await db.notifications.count_documents({"user_id": "ADMIN", "read": False})
    
    # Also count old activities for backward compat
    old_unread = await db.activities.count_documents({"is_admin_notification": True, "read": False})
    
    return {"notifications": notifications, "unread_count": unread_count + old_unread, "total": len(notifications)}


@router.post("/notifications/mark-read")
async def mark_admin_notifications_read(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.notifications.update_many(
        {"user_id": "ADMIN", "read": False},
        {"$set": {"read": True}}
    )
    await db.activities.update_many(
        {"is_admin_notification": True, "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "Notifications marked as read"}


@router.put("/notifications/{notification_id}/read")
async def mark_admin_notification_read(notification_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.notifications.update_one(
        {"id": notification_id, "user_id": "ADMIN"},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}



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
    completed_orders = await db.orders.count_documents({"status": "completed"})
    new_orders = await db.orders.count_documents({"status": "pending"})
    
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


# Analytics cache for performance optimization
_analytics_cache = {}
_analytics_cache_time = {}
ANALYTICS_CACHE_TTL = 300  # 5 minutes

@router.get("/analytics/detailed")
async def get_detailed_analytics(period: str = "month", user=Depends(get_current_user)):
    """Get detailed analytics for CRM dashboard - OPTIMIZED"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from datetime import timedelta
    import time
    
    # Check cache first
    cache_key = f"analytics_{period}"
    current_time = time.time()
    if cache_key in _analytics_cache and cache_key in _analytics_cache_time:
        if current_time - _analytics_cache_time[cache_key] < ANALYTICS_CACHE_TTL:
            return _analytics_cache[cache_key]
    
    now = datetime.now(timezone.utc)
    
    # Calculate date range based on period
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    start_str = start_date.isoformat()
    
    # OPTIMIZED: Single aggregation for all basic stats + status counts
    stats_pipeline = [
        {"$match": {"created_at": {"$gte": start_str}}},
        {"$group": {
            "_id": None,
            "total_orders": {"$sum": 1},
            "total_revenue": {"$sum": "$total"},
            "new_count": {"$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}},
            "processing_count": {"$sum": {"$cond": [{"$eq": ["$status", "processing"]}, 1, 0]}},
            "completed_count": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
            "cancelled_count": {"$sum": {"$cond": [{"$eq": ["$status", "cancelled"]}, 1, 0]}}
        }}
    ]
    
    # OPTIMIZED: Single aggregation for daily sales (instead of 30+ queries)
    daily_sales_pipeline = [
        {"$match": {"created_at": {"$gte": start_str}}},
        {"$addFields": {
            "date_only": {"$substr": ["$created_at", 0, 10]}
        }},
        {"$group": {
            "_id": "$date_only",
            "orders": {"$sum": 1},
            "revenue": {"$sum": "$total"}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    # Top products aggregation (already optimized)
    top_products_pipeline = [
        {"$match": {"created_at": {"$gte": start_str}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "name": {"$first": "$items.name"},
            "quantity": {"$sum": "$items.quantity"},
            "revenue": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}}
        }},
        {"$sort": {"quantity": -1}},
        {"$limit": 5}
    ]
    
    # OPTIMIZED: Top customers with user lookup in single aggregation
    top_customers_pipeline = [
        {"$match": {"created_at": {"$gte": start_str}}},
        {"$group": {
            "_id": "$user_id",
            "total_spent": {"$sum": "$total"},
            "orders_count": {"$sum": 1}
        }},
        {"$sort": {"total_spent": -1}},
        {"$limit": 5}
    ]
    
    # Execute all aggregations in parallel
    stats_result, daily_sales_result, top_products, top_customers_raw, new_customers = await asyncio.gather(
        db.orders.aggregate(stats_pipeline).to_list(1),
        db.orders.aggregate(daily_sales_pipeline).to_list(365),
        db.orders.aggregate(top_products_pipeline).to_list(5),
        db.orders.aggregate(top_customers_pipeline).to_list(5),
        db.users.count_documents({"created_at": {"$gte": start_str}, "role": {"$ne": "admin"}})
    )
    
    # Process stats result
    stats = stats_result[0] if stats_result else {
        "total_orders": 0, "total_revenue": 0,
        "new_count": 0, "processing_count": 0, "shipped_count": 0,
        "delivered_count": 0, "cancelled_count": 0
    }
    
    total_orders = stats.get("total_orders", 0)
    total_revenue = stats.get("total_revenue", 0)
    completed_orders = stats.get("delivered_count", 0)
    cancelled_orders = stats.get("cancelled_count", 0)
    
    avg_order = total_revenue / total_orders if total_orders > 0 else 0
    conversion_rate = (completed_orders / total_orders * 100) if total_orders > 0 else 0
    
    # Process daily sales into proper format
    daily_sales_map = {d["_id"]: d for d in daily_sales_result}
    days_data = []
    for i in range(min(30, (now - start_date).days + 1)):
        day = now - timedelta(days=i)
        day_key = day.strftime("%Y-%m-%d")
        day_data = daily_sales_map.get(day_key, {"orders": 0, "revenue": 0})
        days_data.append({
            "date": day.strftime("%d.%m"),
            "orders": day_data.get("orders", 0),
            "revenue": day_data.get("revenue", 0)
        })
    days_data.reverse()
    
    # Batch fetch user data for top customers (instead of N queries)
    user_ids = [c["_id"] for c in top_customers_raw]
    users_data = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1}
    ).to_list(5)
    users_map = {u["id"]: u for u in users_data}
    
    top_customers = []
    for c in top_customers_raw:
        user_data = users_map.get(c["_id"], {})
        top_customers.append({
            "user_id": c["_id"],
            "name": user_data.get("name", "—"),
            "email": user_data.get("email", "—"),
            "total_spent": c["total_spent"],
            "orders_count": c["orders_count"]
        })
    
    # Orders by status from the single aggregation
    status_stats = {
        "pending": stats.get("new_count", 0),
        "processing": stats.get("processing_count", 0),
        "completed": stats.get("completed_count", 0),
        "cancelled": stats.get("cancelled_count", 0)
    }
    
    result = {
        "period": period,
        "summary": {
            "total_orders": total_orders,
            "completed_orders": completed_orders,
            "cancelled_orders": cancelled_orders,
            "new_customers": new_customers,
            "total_revenue": total_revenue,
            "avg_order_value": round(avg_order, 2),
            "conversion_rate": round(conversion_rate, 1)
        },
        "sales_by_day": days_data,
        "top_products": top_products,
        "top_customers": top_customers,
        "orders_by_status": status_stats
    }
    
    # Cache the result
    _analytics_cache[cache_key] = result
    _analytics_cache_time[cache_key] = current_time
    
    return result
