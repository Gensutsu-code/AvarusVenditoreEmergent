"""Cart, Orders, and Favorites routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import uuid

from database import db, get_current_user
from models import CartItem, OrderCreate, OrderResponse, FavoriteItem
from notify import notify_user, notify_admin
from routes.telegram import send_telegram_order_notification

router = APIRouter(tags=["orders"])


def compute_promo_discount(product: dict, base_price: float, quantity: int = 1) -> tuple:
    """Compute promo discount for a product, considering quantity tiers.
    Returns (discounted_price, discount_amount, is_active).
    
    Tier logic:
    - If product.discount_tiers exists and matches quantity → use that tier's value/type
    - Else → fall back to product.discount_type/discount_value (base discount)
    
    Promo applies on top of any base_price (which may already be individual_price or payment-adjusted).
    """
    if not product or not product.get("discount_active"):
        return base_price, 0.0, False

    # Check expiry
    until = product.get("discount_until")
    if until:
        try:
            until_dt = datetime.fromisoformat(str(until).replace("Z", "+00:00")) if "T" in str(until) else datetime.fromisoformat(f"{until}T23:59:59+00:00")
            if until_dt <= datetime.now(timezone.utc):
                return base_price, 0.0, False
        except Exception:
            pass

    # Determine effective tier
    dtype = product.get("discount_type")
    dval = float(product.get("discount_value") or 0)

    tiers = product.get("discount_tiers") or []
    if tiers:
        # Sort tiers ascending by min_qty, pick the highest matching
        try:
            sorted_tiers = sorted(
                [t for t in tiers if isinstance(t, dict) and t.get("min_qty") is not None],
                key=lambda t: int(t.get("min_qty", 0))
            )
            best = None
            for t in sorted_tiers:
                if int(t.get("min_qty", 0)) <= quantity:
                    best = t
            if best is not None:
                dtype = best.get("type") or dtype
                dval = float(best.get("value") or 0)
        except Exception:
            pass

    if dval <= 0:
        return base_price, 0.0, False

    if dtype == "percent":
        pct = min(99.0, max(0.0, dval))
        amount = round(base_price * pct / 100, 2)
    elif dtype == "amount":
        amount = max(0.0, dval)
    else:
        return base_price, 0.0, False

    final_price = max(0.0, round(base_price - amount, 2))
    return final_price, round(amount, 2), True



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
    return await _build_cart(user)


async def _build_cart(user):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        cart = {"user_id": user["id"], "items": []}
        await db.carts.insert_one(cart)
    
    product_ids = [item["product_id"] for item in cart.get("items", [])]
    if not product_ids:
        return {"items": []}
    
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(100)
    products_map = {p["id"]: p for p in products}
    
    # Fetch active individual prices for this user
    ind_prices = await db.individual_prices.find(
        {"user_id": user["id"], "active": True, "product_id": {"$in": product_ids}},
        {"_id": 0}
    ).to_list(100)
    ind_prices_map = {ip["product_id"]: ip["price"] for ip in ind_prices}
    
    items_with_details = []
    for item in cart.get("items", []):
        product = products_map.get(item["product_id"])
        if product:
            ind_price = ind_prices_map.get(item["product_id"])
            base_price = ind_price if ind_price is not None else product["price"]
            # Apply promo discount on top of base price (with tier-aware quantity)
            promo_final, promo_amount, promo_active = compute_promo_discount(product, base_price, item["quantity"])
            final_unit_price = promo_final if promo_active else base_price
            items_with_details.append({
                "product_id": item["product_id"],
                "name": product["name"],
                "article": product["article"],
                "manufacturer": product.get("manufacturer"),
                "price": final_unit_price,
                "original_price": product["price"],
                "individual_price": ind_price,
                "promo_active": promo_active,
                "promo_amount": promo_amount,
                "promo_discount_type": product.get("discount_type") if promo_active else None,
                "promo_discount_value": product.get("discount_value") if promo_active else None,
                "promo_label": product.get("discount_label") if promo_active else None,
                "promo_until": product.get("discount_until") if promo_active else None,
                "base_price_before_promo": base_price,
                "quantity": item["quantity"],
                "image_url": product.get("image_url"),
                "discount_active": product.get("discount_active", False),
                "discount_until": product.get("discount_until"),
                "discount_tiers": product.get("discount_tiers") or [],
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
    return await _build_cart(user)


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
            
            # Determine base price (individual_price > original) and track flag
            ind_price = ind_prices_map.get(cart_item["product_id"])
            if ind_price is not None:
                base_price = ind_price
                used_individual_price_product_ids.append(cart_item["product_id"])
            else:
                # Apply payment discount to unit price
                base_price = round(original_price * price_multiplier, 2)

            # Apply product promo discount on top of base price (tier-aware)
            promo_final, promo_amount, promo_active = compute_promo_discount(product, base_price, cart_item["quantity"])
            final_price = promo_final if promo_active else base_price
            
            item_data = {
                "product_id": cart_item["product_id"],
                "name": product["name"],
                "article": product["article"],
                "manufacturer": product.get("manufacturer"),
                "price": final_price,
                "original_price": original_price,
                "base_price_before_promo": base_price,
                "promo_active": promo_active,
                "promo_amount": promo_amount,
                "promo_discount_type": product.get("discount_type") if promo_active else None,
                "promo_discount_value": product.get("discount_value") if promo_active else None,
                "promo_label": product.get("discount_label") if promo_active else None,
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

    # Ozon certificate: +500₽ per full 10 000₽ of goods (informational; admin issues manually)
    ozon_certificate = int(subtotal // 10000) * 500

    # Deferred payment (отсрочка): validate approved credit limit & availability
    is_deferral = (payment_method == "deferral")
    deferral_due_date = None
    deferral_term = 0
    if is_deferral:
        ucred = await db.users.find_one({"id": user["id"]}, {"_id": 0, "credit_status": 1, "credit_limit": 1, "credit_term_days": 1})
        if not ucred or ucred.get("credit_status") != "approved" or (ucred.get("credit_limit", 0) or 0) <= 0:
            raise HTTPException(status_code=400, detail="Отсрочка недоступна. Запросите кредитный лимит у администрации.")
        unpaid = await db.deferrals.find({"user_id": user["id"], "status": "unpaid"}, {"_id": 0, "amount": 1}).to_list(1000)
        debt = sum(d.get("amount", 0) for d in unpaid)
        available = (ucred.get("credit_limit", 0) or 0) - debt
        if total > available:
            raise HTTPException(status_code=400, detail=f"Превышен лимит отсрочки. Доступно: {available:.0f} ₽, сумма заказа: {total:.0f} ₽")
        deferral_term = int(ucred.get("credit_term_days", 30) or 30)
        deferral_due_date = (datetime.now(timezone.utc) + timedelta(days=deferral_term)).isoformat()

    # Check if paying with balance
    pay_with_balance = getattr(data, 'pay_with_balance', False) if hasattr(data, 'pay_with_balance') else False
    if is_deferral:
        pay_with_balance = False
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
        "is_deferral": is_deferral,
        "deferral_due_date": deferral_due_date,
        "payment_status": "deferred" if is_deferral else ("paid" if paid_from_balance >= total and total > 0 else "unpaid"),
        "ozon_certificate": ozon_certificate,
        "ozon_certificate_issued": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Link balance transaction to order
    if pay_with_balance:
        await db.balance_transactions.update_one(
            {"id": balance_transaction["id"]},
            {"$set": {"order_id": order_id}}
        )
    
    await db.orders.insert_one(order)

    # Record deferral debt entry
    if is_deferral:
        await db.deferrals.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "order_id": order_id,
            "amount": total,
            "status": "unpaid",
            "term_days": deferral_term,
            "due_date": deferral_due_date,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "paid_at": None,
        })
        await notify_admin("deferral", "Заказ в отсрочку", f"Заказ #{order_id[:8]} оформлен в отсрочку на {total:.0f} ₽ (оплата до {(deferral_due_date or '')[:10]})", "/admin/credit")

    await create_admin_activity(user["id"], user.get("name", ""), "order", f"Новый заказ #{order_id[:8]} на {total} ₽")
    await create_notification(user["id"], "order", "Заказ оформлен", f"Ваш заказ #{order_id[:8]} принят в обработку", "/orders")
    await notify_admin("new_order", "Новый заказ", f"Заказ #{order_id[:8]} от {user.get('name', user.get('email', ''))} на {total:.2f} ₽", "/admin/orders")
    if ozon_certificate > 0:
        await notify_admin("ozon_certificate", "Выдать сертификат Ozon", f"По заказу #{order_id[:8]} нужно выдать сертификат Ozon на {ozon_certificate} ₽", "/admin/orders")
    
    # Send Telegram notification about new order
    await send_telegram_order_notification(order, user)
    
    gsync_setting = await db.settings.find_one({"key": "stock_sync_settings"})
    global_sync = (gsync_setting.get("value", {}) if gsync_setting else {}).get("stock_sync_enabled", True)
    for cart_item in cart["items"]:
        prod = await db.products.find_one(
            {"id": cart_item["product_id"]},
            {"_id": 0, "name": 1, "article": 1, "stock": 1, "purchase_price": 1, "stock_sync_mode": 1, "manual_available": 1}
        )
        if not prod:
            continue
        mode = prod.get("stock_sync_mode") or "inherit"
        synced = True if mode == "on" else (False if mode == "off" else global_sync)
        if not synced:
            continue  # availability is managed manually; do not touch stock
        result = await db.products.update_one(
            {"id": cart_item["product_id"], "stock": {"$gte": cart_item["quantity"]}},
            {"$inc": {"stock": -cart_item["quantity"]}}
        )
        if result.modified_count:
            unit_cost = prod.get("purchase_price", 0) or 0
            stock_after = (prod.get("stock", 0) or 0) - cart_item["quantity"]
            await db.stock_movements.insert_one({
                "id": str(uuid.uuid4()),
                "product_id": cart_item["product_id"],
                "product_name": prod.get("name", ""),
                "product_article": prod.get("article", ""),
                "type": "sale",
                "quantity": cart_item["quantity"],
                "unit_cost": unit_cost,
                "total_cost": round(cart_item["quantity"] * unit_cost, 2),
                "supplier": "",
                "reason": "",
                "comment": f"Заказ #{order_id[:8]}",
                "order_id": order_id,
                "stock_before": stock_after + cart_item["quantity"],
                "stock_after": stock_after,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user.get("name", user.get("email", "")),
            })
    
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
    """Get extended order statistics for current user.
    Clients see only the CURRENT calendar month; admins see all-time (unchanged)."""
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)

    # Clients: restrict stats to the current calendar month
    if user.get("role") != "admin":
        current_month = datetime.now(timezone.utc).strftime("%Y-%m")
        orders = [o for o in orders if (o.get("created_at") or "")[:7] == current_month]
    
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


# ==================== ADMIN: MERGE & PARTIAL FULFILLMENT ====================

@router.post("/admin/orders/merge")
async def merge_orders(payload: dict, user: dict = Depends(get_current_user)):
    """Admin merges multiple orders of the SAME user into one new order.

    Body: {"order_ids": ["...", "..."]}
    Rules:
      - All orders must belong to the same user
      - All statuses must be != 'completed' / 'выполнен' (any pre-completion status allowed)
      - Items with same product_id are aggregated (quantities summed)
      - Originals are DELETED
      - New order takes address/phone/full_name/payment_method from the most recent order
    """
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    order_ids = payload.get("order_ids") or []
    if not isinstance(order_ids, list) or len(order_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 order_ids")

    orders = await db.orders.find({"id": {"$in": order_ids}}, {"_id": 0}).to_list(len(order_ids))
    if len(orders) != len(order_ids):
        raise HTTPException(status_code=404, detail="Some orders not found")

    user_ids = {o.get("user_id") for o in orders}
    if len(user_ids) != 1:
        raise HTTPException(status_code=400, detail="Orders belong to different users")

    completed_statuses = {"completed", "выполнен", "delivered"}
    for o in orders:
        if (o.get("status") or "").lower() in completed_statuses:
            raise HTTPException(status_code=400, detail=f"Order {o['id']} is already completed")

    # Sort by created_at desc → newest first
    def _ts(o):
        try:
            return str(o.get("created_at") or "")
        except Exception:
            return ""
    orders_sorted = sorted(orders, key=_ts, reverse=True)
    newest = orders_sorted[0]

    # Aggregate items
    merged: dict = {}
    for o in orders_sorted:
        for it in (o.get("items") or []):
            pid = it.get("product_id")
            if not pid:
                continue
            if pid in merged:
                merged[pid]["quantity"] = int(merged[pid].get("quantity", 0)) + int(it.get("quantity", 0))
            else:
                merged[pid] = {**it, "quantity_fulfilled": 0}

    merged_items = list(merged.values())
    new_total = sum(float(it.get("price", 0)) * int(it.get("quantity", 0)) for it in merged_items)

    new_order = {
        "id": str(uuid.uuid4()),
        "user_id": newest["user_id"],
        "items": merged_items,
        "total": new_total,
        "original_total": new_total,
        "order_discount_percent": 0,
        "status": "pending",
        "full_name": newest.get("full_name"),
        "address": newest.get("address"),
        "phone": newest.get("phone"),
        "comment": (newest.get("comment") or "") + f"\n\n[Объединено из {len(orders)} заказов администратором]",
        "payment_method": newest.get("payment_method"),
        "paid": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "merged_from": [o["id"] for o in orders_sorted],
    }
    await db.orders.insert_one(new_order)
    await db.orders.delete_many({"id": {"$in": order_ids}})

    # Notify the user
    await notify_user(
        newest["user_id"],
        "order",
        "Заказы объединены",
        f"Администратор объединил {len(orders)} ваших заказов в один (#{new_order['id'][:8]}). Итого: {int(new_total)} ₽",
        f"/orders/{new_order['id']}",
    )

    new_order.pop("_id", None)
    return {"success": True, "order": new_order}


@router.patch("/admin/orders/{order_id}/ozon-certificate")
async def toggle_ozon_certificate(order_id: str, payload: dict, user: dict = Depends(get_current_user)):
    """Admin marks an order's Ozon certificate as issued / not issued."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    issued = bool(payload.get("issued", True))
    result = await db.orders.update_one({"id": order_id}, {"$set": {"ozon_certificate_issued": issued}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"success": True, "ozon_certificate_issued": issued}


@router.patch("/admin/orders/{order_id}/fulfill")
async def fulfill_order_partial(order_id: str, payload: dict, user: dict = Depends(get_current_user)):
    """Admin sets per-item quantity_fulfilled. Recalculates fulfilled total.
    If all items fully fulfilled → order.status = 'completed'; else 'partially_fulfilled'.

    Body: {"items": [{"product_id": "...", "quantity_fulfilled": N}, ...]}
    """
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    items_payload = payload.get("items") or []
    if not isinstance(items_payload, list) or not items_payload:
        raise HTTPException(status_code=400, detail="items required")

    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    fulfill_map = {it.get("product_id"): int(it.get("quantity_fulfilled", 0)) for it in items_payload}
    updated_items = []
    all_fulfilled = True
    any_fulfilled = False
    fulfilled_total = 0.0

    for it in order.get("items", []):
        pid = it.get("product_id")
        qty = int(it.get("quantity", 0))
        qf = fulfill_map.get(pid, int(it.get("quantity_fulfilled", 0)))
        qf = max(0, min(qty, qf))
        new_it = {**it, "quantity_fulfilled": qf}
        updated_items.append(new_it)
        if qf < qty:
            all_fulfilled = False
        if qf > 0:
            any_fulfilled = True
        fulfilled_total += float(it.get("price", 0)) * qf

    if all_fulfilled:
        new_status = "completed"
    elif any_fulfilled:
        new_status = "partially_fulfilled"
    else:
        new_status = order.get("status", "pending")

    set_data = {
        "items": updated_items,
        "status": new_status,
        "fulfilled_total": fulfilled_total,
    }
    if new_status == "completed" and order.get("status") != "completed":
        set_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    await db.orders.update_one(
        {"id": order_id},
        {"$set": set_data},
    )

    # Notify user
    user_id = order.get("user_id")
    if user_id:
        if all_fulfilled:
            title = "Заказ выполнен"
            msg = f"Заказ #{order_id[:8]} полностью выполнен. К списанию: {int(fulfilled_total)} ₽"
        else:
            title = "Частичная отгрузка"
            fulfilled_count = sum(int(it.get("quantity_fulfilled", 0)) for it in updated_items)
            total_count = sum(int(it.get("quantity", 0)) for it in updated_items)
            msg = f"По заказу #{order_id[:8]} отгружено {fulfilled_count} из {total_count} позиций. Сумма к оплате: {int(fulfilled_total)} ₽"
        await notify_user(user_id, "order", title, msg, f"/orders/{order_id}")

    return {"success": True, "status": new_status, "fulfilled_total": fulfilled_total, "items": updated_items}

