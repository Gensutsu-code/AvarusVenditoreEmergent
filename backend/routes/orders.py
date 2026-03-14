"""Cart, Orders, and Favorites routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
from collections import defaultdict
import uuid

from database import db, get_current_user
from models import CartItem, OrderCreate, OrderResponse, FavoriteItem
from notify import notify_user, notify_admin

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
    """Create user notification (checks if client notifications enabled)"""
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
    
    # Fetch active individual prices for this user
    ind_prices = await db.individual_prices.find(
        {"user_id": user["id"], "active": True, "product_id": {"$in": product_ids}},
        {"_id": 0}
    ).to_list(100)
    ind_prices_map = {ip["product_id"]: ip["price"] for ip in ind_prices}
    
    items = []
    subtotal = 0
    used_individual_price_product_ids = []
    
    # Calculate price multiplier based on payment adjustment
    price_multiplier = 1 + (payment_adjustment / 100) if payment_adjustment != 0 else 1
    
    for cart_item in cart["items"]:
        product = products_map.get(cart_item["product_id"])
        if product:
            original_price = product["price"]
            
            # Check for individual price
            ind_price = ind_prices_map.get(cart_item["product_id"])
            if ind_price is not None:
                final_price = ind_price
                used_individual_price_product_ids.append(cart_item["product_id"])
            else:
                # Apply payment discount to unit price
                final_price = round(original_price * price_multiplier, 2)
            
            item_data = {
                "product_id": cart_item["product_id"],
                "name": product["name"],
                "article": product["article"],
                "manufacturer": product.get("manufacturer"),
                "price": final_price,
                "original_price": original_price,
                "quantity": cart_item["quantity"],
                "image_url": product.get("image_url"),
                "warehouse": product.get("warehouse"),
                "delivery_days": product.get("delivery_days"),
                "has_individual_price": ind_price is not None
            }
            items.append(item_data)
            subtotal += final_price * cart_item["quantity"]
    
    # Total is now subtotal (already includes payment adjustment per item)
    total = subtotal
    
    # Apply delivery fee
    delivery_settings = await db.settings.find_one({"key": "delivery_settings"})
    delivery_vals = delivery_settings.get("value", {}) if delivery_settings else {}
    delivery_enabled = delivery_vals.get("delivery_enabled", True)
    min_free = delivery_vals.get("min_free_delivery", 5000)
    delivery_price = delivery_vals.get("delivery_price", 500)
    delivery_fee = 0
    if delivery_enabled and total < min_free:
        delivery_fee = delivery_price
        total += delivery_fee
    
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
            "description": "Оплата заказа"
        }
        await db.balance_transactions.insert_one(balance_transaction)
    
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "user_id": user["id"],
        "items": items,
        "total": total,
        "subtotal": round(subtotal, 2),
        "delivery_fee": delivery_fee,
        "payment_adjustment": payment_adjustment,
        "status": "pending",
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
    await notify_admin("new_order", "Новый заказ", f"Заказ #{order_id[:8]} от {user.get('name', user.get('email', ''))} на {total:.2f} ₽", "/admin/orders")
    
    for cart_item in cart["items"]:
        await db.products.update_one(
            {"id": cart_item["product_id"], "stock": {"$gte": cart_item["quantity"]}},
            {"$inc": {"stock": -cart_item["quantity"]}}
        )
    
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    
    return order


@router.get("/orders/check-expired")
async def check_expired_orders():
    """Check and cancel orders with expired confirmation time"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Find orders awaiting confirmation with expired time
    expired_orders = await db.orders.find({
        "awaiting_confirmation": True,
        "changes_expire_at": {"$lt": now}
    }, {"_id": 0}).to_list(100)
    
    cancelled_count = 0
    for order in expired_orders:
        # Restore stock
        for item in order.get("items", []):
            await db.products.update_one(
                {"id": item.get("product_id")},
                {"$inc": {"stock": item.get("quantity", 0)}}
            )
        
        # Cancel order
        await db.orders.update_one(
            {"id": order["id"]},
            {"$set": {
                "status": "cancelled",
                "cancelled_by": "system",
                "cancelled_reason": "Изменения не подтверждены в течение 24 часов",
                "cancelled_at": now
            }}
        )
        
        # Notify user
        await create_notification(
            order["user_id"], 
            "order",
            f"Заказ #{order['id'][:8]} отменён",
            "Заказ отменён автоматически: изменения не были подтверждены в течение 24 часов",
            "/orders"
        )
        
        cancelled_count += 1
    
    return {"cancelled_count": cancelled_count}


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
    
    delivered_total = sum(o.get("total", 0) for o in orders if o.get("status") == "completed")
    pending_total = sum(o.get("total", 0) for o in orders if o.get("status") in ["pending", "processing"])
    
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


@router.post("/orders/{order_id}/accept-changes")
async def accept_order_changes(order_id: str, user=Depends(get_current_user)):
    """Customer accepts changes made by admin with payment handling"""
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not order.get("awaiting_confirmation"):
        raise HTTPException(status_code=400, detail="No pending changes")
    
    payment_method = order.get("payment_method", "cash")
    current_total = order.get("total", 0)
    previous_total = order.get("previous_total", current_total)
    price_difference = current_total - previous_total
    
    response_data = {
        "message": "Changes accepted",
        "action": "none",
        "amount": 0
    }
    
    if price_difference > 0 and payment_method != "cash":
        # Surcharge needed — return amount, let client choose payment method
        current_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "balance": 1})
        user_balance = current_user.get("balance", 0) if current_user else 0
        
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "awaiting_additional_payment": True,
                "additional_payment_amount": price_difference
            }}
        )
        response_data["action"] = "payment_required"
        response_data["amount"] = price_difference
        response_data["user_balance"] = user_balance
        return response_data
    
    if price_difference < 0 and payment_method != "cash":
        # Refund to balance
        refund_amount = abs(price_difference)
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"balance": refund_amount}}
        )
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "awaiting_confirmation": False,
                "has_changes": False,
                "changes_accepted": True,
                "changes_accepted_at": datetime.now(timezone.utc).isoformat(),
                "refund_amount": refund_amount,
                "refund_to_balance": True
            }}
        )
        await create_notification(user["id"], "balance", "Возврат средств", 
            f"На ваш баланс начислено {refund_amount:.2f} ₽ (переплата по заказу #{order_id[:8]})", "/orders")
        response_data["action"] = "refund_to_balance"
        response_data["amount"] = refund_amount
    else:
        # No difference or cash — just accept
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "awaiting_confirmation": False,
                "has_changes": False,
                "changes_accepted": True,
                "changes_accepted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    await create_notification(user["id"], "order", "Изменения приняты", f"Вы приняли изменения в заказе #{order_id[:8]}", "/orders")
    await notify_admin("order_accepted", "Изменения приняты", f"Клиент {user.get('name', '')} принял изменения в заказе #{order_id[:8]}", "/admin/orders")
    return response_data


@router.get("/user/balance")
async def get_user_balance(user=Depends(get_current_user)):
    """Get current user balance"""
    current_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "balance": 1})
    return {"balance": current_user.get("balance", 0) if current_user else 0}


@router.post("/orders/{order_id}/pay-additional")
async def pay_additional_amount(order_id: str, payment_data: dict, user=Depends(get_current_user)):
    """Pay additional amount after admin increased order price"""
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not order.get("awaiting_additional_payment"):
        raise HTTPException(status_code=400, detail="No additional payment required")
    
    additional_amount = order.get("additional_payment_amount", 0)
    payment_method = payment_data.get("payment_method", order.get("additional_payment_method"))
    
    # Handle different payment methods
    if payment_method == "balance":
        current_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
        user_balance = current_user.get("balance", 0)
        
        if user_balance < additional_amount:
            raise HTTPException(status_code=400, detail="Недостаточно средств на балансе")
        
        # Deduct from balance
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"balance": -additional_amount}}
        )
        
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "awaiting_additional_payment": False,
                "awaiting_confirmation": False,
                "has_changes": False,
                "changes_accepted": True,
                "changes_accepted_at": datetime.now(timezone.utc).isoformat(),
                "additional_payment": additional_amount,
                "additional_payment_method": "balance",
                "additional_paid": True
            }}
        )
        
        await create_notification(user["id"], "order", "Доплата произведена", 
            f"С баланса списано {additional_amount:.2f} ₽ за доплату по заказу #{order_id[:8]}", "/orders")
        
        return {"message": "Payment successful", "method": "balance", "amount": additional_amount}
    
    elif payment_method in ["crypto", "card"]:
        # For crypto/card - return payment info, actual payment handled by checkout flow
        return {
            "message": "Redirect to payment",
            "action": "redirect_to_checkout",
            "order_id": order_id,
            "amount": additional_amount,
            "payment_method": payment_method
        }
    
    raise HTTPException(status_code=400, detail="Invalid payment method")


@router.post("/orders/{order_id}/cancel")
async def cancel_order_by_customer(order_id: str, user=Depends(get_current_user)):
    """Customer cancels order - allowed when awaiting confirmation or within 24h of processing"""
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if order can be cancelled
    if order.get("status") in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Заказ нельзя отменить")
    
    # Always allow cancellation when awaiting confirmation (admin made changes)
    is_awaiting = order.get("awaiting_confirmation", False)
    
    # Check 24 hour window for processing orders (skip if awaiting confirmation)
    if order.get("status") == "processing" and not is_awaiting:
        processing_started = order.get("processing_started_at")
        if processing_started:
            started = datetime.fromisoformat(processing_started.replace('Z', '+00:00'))
            hours_passed = (datetime.now(timezone.utc) - started).total_seconds() / 3600
            if hours_passed > 24:
                raise HTTPException(status_code=400, detail="Время для отмены заказа истекло (24 часа)")
    
    # Restore stock
    for item in order.get("items", []):
        await db.products.update_one(
            {"id": item.get("product_id")},
            {"$inc": {"stock": item.get("quantity", 0)}}
        )
    
    # Refund to balance if order was paid (not cash)
    refund_amount = 0
    payment_method = order.get("payment_method", "cash")
    is_paid = order.get("paid", False)
    paid_from_balance = order.get("paid_from_balance", 0)
    
    if is_paid and payment_method != "cash":
        # Use previous_total if awaiting confirmation, otherwise use total
        refund_amount = order.get("previous_total", order.get("total", 0)) if is_awaiting else order.get("total", 0)
        if refund_amount > 0:
            await db.users.update_one(
                {"id": user["id"]},
                {"$inc": {"balance": refund_amount}}
            )
    elif paid_from_balance > 0:
        refund_amount = paid_from_balance
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"balance": refund_amount}}
        )
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": "customer",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "awaiting_confirmation": False,
            "refund_amount": refund_amount
        }}
    )
    
    notification_msg = f"Заказ #{order_id[:8]} отменён по вашему запросу"
    if refund_amount > 0:
        notification_msg += f". На ваш баланс возвращено {refund_amount:.2f} ₽"
    
    await create_notification(user["id"], "order", "Заказ отменён", notification_msg, "/orders")
    await notify_admin("order_cancelled", "Заказ отменён", f"Клиент {user.get('name', '')} отменил заказ #{order_id[:8]}", "/admin/orders")
    
    return {"message": "Order cancelled", "refund_amount": refund_amount}


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
    """Get user's shipping info from profile"""
    return {
        "full_name": user.get("name", "") or "",
        "address": user.get("address", "") or "",
        "phone": user.get("phone", "") or ""
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


@router.post("/orders/{order_id}/return-to-cart")
async def return_order_to_cart(order_id: str, user=Depends(get_current_user)):
    """Return order items to cart WITHOUT cancelling the order (for payment modal close)"""
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Only allow for unpaid orders in pending status
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Cannot return paid order items")
    
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
    
    # Mark order as payment_pending but keep it active (not cancelled)
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"payment_status": "pending", "items_returned_to_cart": True}}
    )
    
    return {"success": True, "message": "Items returned to cart. Order is still active."}
