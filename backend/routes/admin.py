"""Admin routes for user and order management"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import uuid
import asyncio
import csv
import io

from database import db, get_current_user, hash_password
from models import AdminUserCreate, AdminUserUpdate, AdminOrderUpdate
from routes.bonus import update_bonus_on_order_delivered
from routes.warehouse import restore_order_stock
from routes.action_logs import log_action

router = APIRouter(prefix="/admin", tags=["admin"])


# Helper
async def create_notification(user_id: str, notif_type: str, title: str, message: str, link: str = None):
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
    
    users = await db.users.find({"role": {"$ne": "manager"}}, {"_id": 0, "password": 0}).to_list(1000)
    
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
    
    # delivery_cost may be explicitly cleared (null = site-wide delivery price)
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None or k == "delivery_cost"}

    for field, label in (("individual_discount", "Скидка"), ("delivery_cost", "Стоимость доставки"), ("deferral_days", "Отсрочка"), ("credit_limit", "Лимит")):
        if update_data.get(field) is not None and update_data[field] < 0:
            raise HTTPException(status_code=400, detail=f"{label}: значение не может быть отрицательным")
    if (update_data.get("individual_discount") or 0) > 100:
        raise HTTPException(status_code=400, detail="Скидка не может быть больше 100%")

    # Individual deferral terms set in the client card drive the real deferral logic
    if update_data.get("deferral_days"):
        update_data["credit_term_days"] = update_data["deferral_days"]
    if "credit_limit" in update_data:
        if update_data["credit_limit"] > 0:
            update_data["credit_status"] = "approved"
        else:
            current = await db.users.find_one({"id": user_id}, {"_id": 0, "credit_status": 1})
            if (current or {}).get("credit_status") == "approved":
                update_data["credit_status"] = "none"

    # Check email uniqueness
    if "email" in update_data:
        existing = await db.users.find_one({"email": update_data["email"], "id": {"$ne": user_id}}, {"_id": 0, "id": 1})
        if existing:
            raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    change = {"$set": update_data}
    if "password" in update_data:
        update_data["password"] = hash_password(update_data["password"])
        change["$unset"] = {"password_plain": "", "plain_password": ""}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.users.update_one({"id": user_id}, change)
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
    
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove password from log for security
    log_state = {k: v for k, v in target.items() if k not in ("password", "password_plain", "password_hash")}
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.carts.delete_one({"user_id": user_id})

    # Log for revert (re-insert on revert)
    await log_action(
        action=f"Удаление пользователя: {target.get('name') or target.get('email', '')}",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="DELETE",
        path=f"/admin/users/{user_id}",
        status_code=200,
        details={"deleted_user_email": target.get("email"), "deleted_user_name": target.get("name")},
        before_state=log_state,
        collection_name="users",
        document_id=user_id,
    )

    return {"message": "User deleted"}


@router.post("/users/{user_id}/block")
async def toggle_block_user(user_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")
    
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "blocked": 1, "role": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Нельзя заблокировать администратора")
    
    new_blocked = not target.get("blocked", False)
    await db.users.update_one({"id": user_id}, {"$set": {"blocked": new_blocked}})
    
    return {"blocked": new_blocked}


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
    
    manager_ids = list({o["manager_id"] for o in orders if o.get("manager_id")})
    managers = {}
    if manager_ids:
        async for m in db.users.find({"id": {"$in": manager_ids}}, {"_id": 0, "id": 1, "name": 1}):
            managers[m["id"]] = m.get("name", "")

    for order in orders:
        order["manager_name"] = managers.get(order.get("manager_id"))
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
        # Recalculate total from items
        new_total = sum(item.get("price", 0) * item.get("quantity", 0) for item in update_data["items"])
        update_data["total"] = new_total
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    if update_data.get("status") == "completed" and original_order.get("status") != "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Notify on status change
    if "status" in update_data and update_data["status"] != original_order.get("status"):
        new_status = update_data["status"]
        old_status = original_order.get("status")
        
        # Accrue bonus points when order is completed (idempotent, based on delivered items)
        if new_status == "completed":
            await update_bonus_on_order_delivered(
                original_order["user_id"], 0, order_id=order_id,
            )
        
        # Restore stock when order is cancelled
        if new_status == "cancelled" and old_status != "cancelled":
            await restore_order_stock(original_order)
            from routes.rewards import refund_order_cashback
            await refund_order_cashback(original_order)
        
        status_labels = {
            "pending": "ожидает обработки",
            "processing": "принят в обработку",
            "completed": "выполнен",
            "cancelled": "отменён"
        }
        new_status = update_data["status"]
        await create_notification(
            original_order["user_id"], "order",
            f"Статус заказа #{order_id[:8]}",
            f"Ваш заказ {status_labels.get(new_status, new_status)}",
            "/orders"
        )
    
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
        await restore_order_stock(order)
    
    await db.orders.update_one({"id": order_id}, {"$set": {"status": status, "previous_status": old_status, **({"completed_at": datetime.now(timezone.utc).isoformat()} if status == "completed" and old_status != "completed" else {})}})
    
    # Deactivate individual prices when order is completed
    if status == "completed":
        for item in order.get("items", []):
            if item.get("has_individual_price"):
                await db.individual_prices.update_many(
                    {"user_id": order["user_id"], "product_id": item["product_id"], "active": True},
                    {"$set": {"active": False, "used_in_order_id": order_id}}
                )
        # Accrue bonus points
        await update_bonus_on_order_delivered(order["user_id"], order.get("total", 0), order.get("items", []), delivery_fee=order.get("delivery_fee", 0), order_id=order_id)
    
    # Log for revert
    status_labels = {
        "pending": "ожидает обработки",
        "processing": "принят в обработку",
        "completed": "выполнен",
        "cancelled": "отменён"
    }
    await log_action(
        action=f"Статус заказа #{order_id[:8]}: {status_labels.get(old_status, old_status)} → {status_labels.get(status, status)}",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="PUT",
        path=f"/admin/orders/{order_id}/status",
        status_code=200,
        details={"old_status": old_status, "new_status": status, "order_id": order_id},
        before_state={"status": old_status},
        after_state={"status": status},
        collection_name="orders",
        document_id=order_id,
    )
    
    # Notify user
    await create_notification(
        order["user_id"], "order",
        f"Статус заказа #{order_id[:8]}",
        f"Ваш заказ {status_labels.get(status, status)}",
        "/orders"
    )
    
    return {"message": "Status updated", "status": status, "previous_status": old_status}


@router.put("/orders/{order_id}/rollback-status")
async def rollback_order_status(order_id: str, user=Depends(get_current_user)):
    """Rollback order status one step back in the chain: completed→processing→pending"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    rollback_map = {
        "completed": "processing",
        "processing": "pending",
        "cancelled": "pending",
    }
    current = order.get("status")
    prev = rollback_map.get(current)
    if not prev:
        raise HTTPException(status_code=400, detail="Невозможно откатить этот статус")

    await db.orders.update_one({"id": order_id}, {"$set": {"status": prev, "previous_status": current}})

    # Log for revert
    await log_action(
        action=f"Откат статуса заказа #{order_id[:8]}: {current} → {prev}",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="PUT",
        path=f"/admin/orders/{order_id}/rollback-status",
        status_code=200,
        details={"old_status": current, "new_status": prev, "order_id": order_id},
        before_state={"status": current},
        after_state={"status": prev},
        collection_name="orders",
        document_id=order_id,
    )

    status_labels = {"pending": "ожидает обработки", "processing": "принят в обработку", "completed": "выполнен"}
    await create_notification(
        order["user_id"], "order",
        f"Статус заказа #{order_id[:8]}",
        f"Ваш заказ {status_labels.get(prev, prev)}",
        "/orders"
    )
    return {"message": "Status rolled back", "status": prev, "previous_status": current}


@router.delete("/orders/{order_id}")
async def delete_admin_order(order_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Restore stock
    await restore_order_stock(order)
    
    await db.orders.delete_one({"id": order_id})

    # Log for revert (re-insert on revert)
    await log_action(
        action=f"Удаление заказа #{order_id[:8]}",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="DELETE",
        path=f"/admin/orders/{order_id}",
        status_code=200,
        details={"order_id": order_id, "total": order.get("total", 0)},
        before_state={**order},
        collection_name="orders",
        document_id=order_id,
    )

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
    
    return {"notifications": notifications, "unread_count": unread_count, "total": len(notifications)}


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


# ==================== CSV IMPORT/EXPORT ====================

CSV_COLUMNS = ["name", "article", "manufacturer", "category_id", "price", "stock", "description", "warehouse", "delivery_days", "cross_articles", "image_url"]

@router.get("/products/csv-template")
async def download_csv_template(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(CSV_COLUMNS)
    writer.writerow(["Фильтр масляный MANN W 914/2", "W914/2", "MANN-FILTER", "", "450.00", "100", "Масляный фильтр для ВАЗ 2101-2107", "Москва", "3", "W914;W914/1", ""])
    writer.writerow(["Колодки тормозные передние", "BP1234", "ATE", "", "1200.00", "50", "Тормозные колодки для Kia Rio", "Казань", "5", "", ""])
    
    output.seek(0)
    content = output.getvalue().encode('utf-8-sig')
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products_template.csv"}
    )


@router.get("/products/csv-prompt")
async def download_gpt_prompt(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    prompt = """# Промпт для ChatGPT: Заполнение CSV файла товаров

## Задача
Заполни CSV файл для импорта товаров на мой сайт автозапчастей. Формат CSV: разделитель — точка с запятой (;), кодировка UTF-8.

## Колонки CSV файла (в строгом порядке):
1. **name** — Полное название товара (например: "Фильтр масляный MANN W 914/2")
2. **article** — Артикул/каталожный номер (например: "W914/2"). ОБЯЗАТЕЛЬНОЕ поле
3. **manufacturer** — Производитель (например: "MANN-FILTER", "BOSCH", "ATE")
4. **category_id** — ID категории (оставь пустым, если не знаешь)
5. **price** — Цена в рублях, число с точкой (например: 450.00)
6. **stock** — Количество на складе, целое число (например: 100)
7. **description** — Описание товара (применимость, характеристики)
8. **warehouse** — Склад/город (например: "Москва", "Казань")
9. **delivery_days** — Срок доставки в днях, целое число (например: 3)
10. **cross_articles** — Кросс-артикулы через точку с запятой внутри кавычек (например: "W914;W914/1;OC384")
11. **image_url** — Ссылка на изображение (можно оставить пустым)

## Пример первых строк:
```
name;article;manufacturer;category_id;price;stock;description;warehouse;delivery_days;cross_articles;image_url
Фильтр масляный MANN W 914/2;W914/2;MANN-FILTER;;450.00;100;Масляный фильтр для ВАЗ 2101-2107;Москва;3;W914;W914/1;
Колодки тормозные передние ATE;BP1234;ATE;;1200.00;50;Тормозные колодки для Kia Rio;Казань;5;;
```

## Правила:
- Первая строка — заголовки (скопируй как есть)
- Цены указывай БЕЗ символа ₽, только число
- Артикул — обязательное поле, не оставляй пустым
- Если значение содержит точку с запятой, оберни его в кавычки
- Не используй переносы строк внутри ячеек

## Мой запрос:
[Опиши здесь какие товары нужно добавить, например: "Сгенерируй 50 позиций масляных фильтров разных производителей для японских и немецких автомобилей"]
"""
    
    content = prompt.encode('utf-8')
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=chatgpt_prompt.txt"}
    )


@router.get("/products/csv-export")
async def export_products_csv(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    products_cursor = db.products.find({}, {"_id": 0})
    products_list = await products_cursor.to_list(length=100000)
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(CSV_COLUMNS)
    
    for p in products_list:
        writer.writerow([
            p.get("name", ""),
            p.get("article", ""),
            p.get("manufacturer", ""),
            p.get("category_id", ""),
            p.get("price", 0),
            p.get("stock", 0),
            p.get("description", ""),
            p.get("warehouse", ""),
            p.get("delivery_days", 3),
            p.get("cross_articles", ""),
            p.get("image_url", "")
        ])
    
    output.seek(0)
    content = output.getvalue().encode('utf-8-sig')
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products_export.csv"}
    )


@router.post("/products/import-csv")
async def import_products_csv(file: UploadFile = File(...), user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Файл должен быть в формате CSV")
    
    content = await file.read()
    # Try different encodings
    for encoding in ['utf-8-sig', 'utf-8', 'cp1251', 'latin-1']:
        try:
            text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise HTTPException(status_code=400, detail="Не удалось прочитать файл. Используйте кодировку UTF-8")
    
    reader = csv.DictReader(io.StringIO(text), delimiter=';')
    
    products = []
    errors = []
    row_num = 1
    
    for row in reader:
        row_num += 1
        name = (row.get('name') or '').strip()
        article = (row.get('article') or '').strip()
        price_str = (row.get('price') or '').strip()
        
        if not name:
            errors.append(f"Строка {row_num}: отсутствует название товара")
            continue
        if not article:
            errors.append(f"Строка {row_num}: отсутствует артикул")
            continue
        
        try:
            price = float(price_str.replace(',', '.')) if price_str else 0
        except ValueError:
            errors.append(f"Строка {row_num}: некорректная цена '{price_str}'")
            continue
        
        try:
            stock = int(row.get('stock', '0').strip() or '0')
        except ValueError:
            stock = 0
        
        try:
            delivery_days = int(row.get('delivery_days', '3').strip() or '3')
        except ValueError:
            delivery_days = 3
        
        products.append({
            "id": str(uuid.uuid4()),
            "name": name,
            "article": article,
            "manufacturer": (row.get('manufacturer') or '').strip() or None,
            "category_id": (row.get('category_id') or '').strip() or None,
            "price": price,
            "stock": stock,
            "description": (row.get('description') or '').strip() or None,
            "warehouse": (row.get('warehouse') or '').strip() or None,
            "delivery_days": delivery_days,
            "cross_articles": (row.get('cross_articles') or '').strip() or None,
            "image_url": (row.get('image_url') or '').strip() or None,
            "images": [],
        })
    
    imported = 0
    skipped = 0
    if products:
        # Check for duplicate articles
        articles = [p["article"] for p in products]
        existing = await db.products.find({"article": {"$in": articles}}, {"_id": 0, "article": 1}).to_list(None)
        existing_articles = {e["article"] for e in existing}
        
        new_products = []
        for p in products:
            if p["article"] in existing_articles:
                skipped += 1
                errors.append(f"Артикул '{p['article']}' уже существует — пропущен")
            else:
                new_products.append(p)
        
        if new_products:
            from routes.warehouse import set_total_stock
            stocks = {p["id"]: p["stock"] for p in new_products}
            for p in new_products:
                p["stock"] = 0
            await db.products.insert_many(new_products)
            for pid, qty in stocks.items():
                if qty > 0:
                    await set_total_stock(pid, qty, user.get("name", user.get("email", "")), "Импорт товаров из файла")
            imported = len(new_products)
    
    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:20],
        "total_rows": row_num - 1
    }

