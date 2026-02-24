"""Cart, Orders, and Favorites routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
from collections import defaultdict
import uuid

from database import db, get_current_user
from models import CartItem, OrderCreate, OrderResponse, FavoriteItem

router = APIRouter(tags=["orders"])


# Helper functions
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


# ==================== CART ====================

@router.get("/cart")
async def get_cart(user=Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        cart = {"user_id": user["id"], "items": []}
        await db.carts.insert_one(cart)
    
    product_ids = [item["product_id"] for item in cart.get("items", [])]
    if not product_ids:
        return {"items": []}
    
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(100)
    products_map = {p["id"]: p for p in products}
    
    items_with_details = []
    for item in cart.get("items", []):
        product = products_map.get(item["product_id"])
        if product:
            items_with_details.append({
                "product_id": item["product_id"],
                "name": product["name"],
                "article": product["article"],
                "manufacturer": product.get("manufacturer"),
                "price": product["price"],
                "quantity": item["quantity"],
                "image_url": product.get("image_url")
            })
    
    return {"items": items_with_details}


@router.post("/cart/add")
async def add_to_cart(item: CartItem, user=Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        await db.carts.insert_one({"user_id": user["id"], "items": [item.model_dump()]})
    else:
        items = cart.get("items", [])
        existing = next((i for i in items if i["product_id"] == item.product_id), None)
        if existing:
            existing["quantity"] += item.quantity
        else:
            items.append(item.model_dump())
        await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}})
    
    return {"message": "Added to cart"}


@router.post("/cart/update")
async def update_cart_item(item: CartItem, user=Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]})
    if cart:
        items = cart.get("items", [])
        for i in items:
            if i["product_id"] == item.product_id:
                i["quantity"] = item.quantity
                break
        await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}})
    return {"message": "Cart updated"}


@router.delete("/cart/{product_id}")
async def remove_from_cart(product_id: str, user=Depends(get_current_user)):
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$pull": {"items": {"product_id": product_id}}}
    )
    return {"message": "Removed from cart"}


@router.delete("/cart")
async def clear_cart(user=Depends(get_current_user)):
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    return {"message": "Cart cleared"}


# ==================== ORDERS ====================

@router.post("/orders", response_model=OrderResponse)
async def create_order(data: OrderCreate, user=Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Only payment method discounts are used
    payment_settings = await db.settings.find_one({"key": "payment_settings"})
    payment_adjustments = payment_settings.get("value", {}) if payment_settings else {}
    payment_method = data.payment_method or "cash"
    # Get payment adjustment (can be negative for discount or positive for surcharge)
    payment_adjustment = payment_adjustments.get(f"{payment_method}_adjustment", 0)
    
    product_ids = [item["product_id"] for item in cart["items"]]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(100)
    products_map = {p["id"]: p for p in products}
    
    items = []
    subtotal = 0
    
    for cart_item in cart["items"]:
        product = products_map.get(cart_item["product_id"])
        if product:
            price = product["price"]
            item_data = {
                "product_id": cart_item["product_id"],
                "name": product["name"],
                "article": product["article"],
                "manufacturer": product.get("manufacturer"),
                "price": price,
                "quantity": cart_item["quantity"],
                "image_url": product.get("image_url")
            }
            items.append(item_data)
            subtotal += price * cart_item["quantity"]
    
    # Apply payment method discount
    total = subtotal
    if payment_discount > 0:
        total = subtotal * (1 - payment_discount / 100)
    
    total = round(total, 2)
    
    # Check if paying with balance
    pay_with_balance = getattr(data, 'pay_with_balance', False) if hasattr(data, 'pay_with_balance') else False
    paid_from_balance = 0
    
    if pay_with_balance:
        # Get user balance
        user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "balance": 1})
        user_balance = user_data.get("balance", 0) if user_data else 0
        
        if user_balance < total:
            raise HTTPException(status_code=400, detail=f"Недостаточно средств на балансе. Баланс: {user_balance}₽, Сумма: {total}₽")
        
        # Deduct from balance
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"balance": -total}}
        )
        paid_from_balance = total
        
        # Create balance transaction
        balance_transaction = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "payment",
            "amount": -total,
            "method": "balance",
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "description": f"Оплата заказа"
        }
        await db.balance_transactions.insert_one(balance_transaction)
    
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "user_id": user["id"],
        "items": items,
        "total": total,
        "subtotal": round(subtotal, 2),
        "payment_discount": payment_discount,
        "status": "new",
        "full_name": data.full_name,
        "address": data.address,
        "phone": data.phone,
        "comment": data.comment,
        "payment_method": "balance" if pay_with_balance else payment_method,
        "paid_from_balance": paid_from_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Link balance transaction to order
    if pay_with_balance:
        await db.balance_transactions.update_one(
            {"id": balance_transaction["id"]},
            {"$set": {"order_id": order_id}}
        )
    
    await db.orders.insert_one(order)
    
    await create_admin_activity(user["id"], user.get("name", ""), "order", f"Новый заказ #{order_id[:8]} на {total} ₽")
    await create_notification(user["id"], "order", "Заказ оформлен", f"Ваш заказ #{order_id[:8]} принят в обработку", "/orders")
    
    for cart_item in cart["items"]:
        await db.products.update_one(
            {"id": cart_item["product_id"], "stock": {"$gte": cart_item["quantity"]}},
            {"$inc": {"stock": -cart_item["quantity"]}}
        )
    
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    
    return order


@router.get("/orders", response_model=List[OrderResponse])
async def get_orders(user=Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders


@router.get("/orders/stats")
async def get_user_order_stats(user=Depends(get_current_user)):
    """Get extended order statistics for current user"""
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    
    if not orders:
        return {
            "total_orders": 0, "total_spent": 0, "avg_order_value": 0, "total_items": 0,
            "by_status": {}, "by_month": [], "delivered_total": 0, "pending_total": 0,
            "first_order_date": None, "last_order_date": None, "favorite_products": [], "total_products_types": 0
        }
    
    total_orders = len(orders)
    total_spent = sum(o.get("total", 0) for o in orders)
    total_items = sum(sum(item.get("quantity", 0) for item in o.get("items", [])) for o in orders)
    avg_order_value = total_spent / total_orders if total_orders > 0 else 0
    
    delivered_total = sum(o.get("total", 0) for o in orders if o.get("status") == "delivered")
    pending_total = sum(o.get("total", 0) for o in orders if o.get("status") in ["pending", "processing", "shipped"])
    
    by_status = {}
    for o in orders:
        status = o.get("status", "pending")
        by_status[status] = by_status.get(status, 0) + 1
    
    by_month_dict = defaultdict(lambda: {"orders": 0, "total": 0})
    for o in orders:
        created_at = o.get("created_at", "")
        if created_at:
            month_key = created_at[:7]
            by_month_dict[month_key]["orders"] += 1
            by_month_dict[month_key]["total"] += o.get("total", 0)
    
    by_month = sorted([{"month": k, **v} for k, v in by_month_dict.items()], key=lambda x: x["month"], reverse=True)[:12]
    by_month.reverse()
    
    order_dates = [o.get("created_at") for o in orders if o.get("created_at")]
    first_order_date = min(order_dates) if order_dates else None
    last_order_date = max(order_dates) if order_dates else None
    
    product_count = defaultdict(lambda: {"name": "", "article": "", "count": 0, "total_spent": 0})
    unique_products = set()
    for o in orders:
        for item in o.get("items", []):
            pid = item.get("product_id") or item.get("article", "")
            unique_products.add(pid)
            product_count[pid]["name"] = item.get("name", "")
            product_count[pid]["article"] = item.get("article", "")
            product_count[pid]["count"] += item.get("quantity", 1)
            product_count[pid]["total_spent"] += item.get("price", 0) * item.get("quantity", 1)
    
    favorite_products = sorted(
        [{"product_id": k, **v} for k, v in product_count.items()],
        key=lambda x: x["count"], reverse=True
    )[:5]
    
    return {
        "total_orders": total_orders, "total_spent": round(total_spent, 2),
        "avg_order_value": round(avg_order_value, 2), "total_items": total_items,
        "by_status": by_status, "by_month": by_month,
        "delivered_total": round(delivered_total, 2), "pending_total": round(pending_total, 2),
        "first_order_date": first_order_date, "last_order_date": last_order_date,
        "favorite_products": favorite_products, "total_products_types": len(unique_products)
    }


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, user=Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


# ==================== FAVORITES ====================

@router.get("/favorites")
async def get_favorites(user=Depends(get_current_user)):
    favorites = await db.favorites.find_one({"user_id": user["id"]}, {"_id": 0})
    if not favorites:
        return {"items": []}
    
    product_ids = favorites.get("items", [])
    if not product_ids:
        return {"items": []}
    
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(100)
    return {"items": products}


@router.post("/favorites/add")
async def add_to_favorites(item: FavoriteItem, user=Depends(get_current_user)):
    favorites = await db.favorites.find_one({"user_id": user["id"]})
    if not favorites:
        await db.favorites.insert_one({"user_id": user["id"], "items": [item.product_id]})
    else:
        if item.product_id not in favorites.get("items", []):
            await db.favorites.update_one(
                {"user_id": user["id"]},
                {"$push": {"items": item.product_id}}
            )
    return {"message": "Added to favorites"}


@router.delete("/favorites/{product_id}")
async def remove_from_favorites(product_id: str, user=Depends(get_current_user)):
    await db.favorites.update_one(
        {"user_id": user["id"]},
        {"$pull": {"items": product_id}}
    )
    return {"message": "Removed from favorites"}


@router.get("/favorites/check/{product_id}")
async def check_favorite(product_id: str, user=Depends(get_current_user)):
    favorites = await db.favorites.find_one({"user_id": user["id"]}, {"_id": 0})
    is_favorite = product_id in favorites.get("items", []) if favorites else False
    return {"is_favorite": is_favorite}


# ==================== USER HELPERS ====================

@router.get("/user/last-shipping")
async def get_last_shipping(user=Depends(get_current_user)):
    """Get user's last shipping info from orders or profile"""
    last_order = await db.orders.find_one(
        {"user_id": user["id"]},
        {"_id": 0, "full_name": 1, "address": 1, "phone": 1},
        sort=[("created_at", -1)]
    )
    
    if last_order:
        return {
            "full_name": last_order.get("full_name", ""),
            "address": last_order.get("address", ""),
            "phone": last_order.get("phone", "")
        }
    
    return {
        "full_name": user.get("name", ""),
        "address": user.get("address", ""),
        "phone": user.get("phone", "")
    }



# ==================== USER NOTIFICATIONS ====================

@router.get("/my-notifications")
async def get_my_notifications(user=Depends(get_current_user)):
    """Get client notifications"""
    notifs = await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    unread = sum(1 for n in notifs if not n.get("read", False))
    return {"notifications": notifs, "unread_count": unread}


@router.put("/my-notifications/read-all")
async def mark_notifications_read(user=Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"success": True}



@router.put("/my-notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user=Depends(get_current_user)):
    """Mark single notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, user=Depends(get_current_user)):
    """Cancel unpaid order and return items to cart"""
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only allow cancellation of unpaid orders
    if order.get("payment_status") == "paid" or order.get("paid_from_balance", 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot cancel paid order")
    
    if order.get("status") not in ["new", "pending"]:
        raise HTTPException(status_code=400, detail="Cannot cancel order in this status")
    
    # Return items to cart
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        cart = {"user_id": user["id"], "items": []}
    
    existing_items = {item["product_id"]: item for item in cart.get("items", [])}
    
    for order_item in order.get("items", []):
        product_id = order_item.get("product_id")
        quantity = order_item.get("quantity", 1)
        
        if product_id in existing_items:
            existing_items[product_id]["quantity"] += quantity
        else:
            existing_items[product_id] = {"product_id": product_id, "quantity": quantity}
        
        # Restore stock
        await db.products.update_one(
            {"id": product_id},
            {"$inc": {"stock": quantity}}
        )
    
    # Update cart
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"items": list(existing_items.values())}},
        upsert=True
    )
    
    # Update order status
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "Order cancelled and items returned to cart"}
