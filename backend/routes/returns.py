"""Returns management routes"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from database import db, get_current_user
from notify import notify_user, notify_admin

router = APIRouter()


@router.post("/returns")
async def create_return(data: dict, user=Depends(get_current_user)):
    """Create a return request"""
    return_type = data.get("type")  # "return" or "warranty"
    order_id = data.get("order_id")
    items = data.get("items", [])
    reason = data.get("reason", "")

    if not return_type or return_type not in ("return", "warranty"):
        raise HTTPException(status_code=400, detail="Invalid return type")
    if not order_id or not items:
        raise HTTPException(status_code=400, detail="Order and items required")

    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Only completed orders can be returned")

    # Validate items belong to the order
    order_item_ids = {item.get("product_id") for item in order.get("items", [])}
    for item in items:
        if item.get("product_id") not in order_item_ids:
            raise HTTPException(status_code=400, detail=f"Item {item.get('product_id')} not in order")

    # Calculate refund amounts
    total_refund = 0
    total_deduction = 0
    total_bonus_deduction = 0
    return_items = []

    for item in items:
        order_item = next((oi for oi in order.get("items", []) if oi.get("product_id") == item.get("product_id")), None)
        if not order_item:
            continue

        qty = min(item.get("quantity", 1), order_item.get("quantity", 1))
        item_total = order_item.get("price", 0) * qty

        if return_type == "return":
            deduction = round(item_total * 0.10, 2)
            refund = round(item_total - deduction, 2)
            total_deduction += deduction
            total_refund += refund
        else:
            refund = 0
            deduction = 0

        return_items.append({
            "product_id": order_item.get("product_id"),
            "name": order_item.get("name", ""),
            "article": order_item.get("article", ""),
            "price": order_item.get("price", 0),
            "quantity": qty,
            "image_url": order_item.get("image_url", ""),
            "item_total": item_total,
            "deduction": deduction if return_type == "return" else 0,
            "refund": refund if return_type == "return" else 0,
        })

    # Calculate bonus deduction for "return" type
    if return_type == "return":
        programs = await db.bonus_programs.find({"enabled": True}, {"_id": 0}).to_list(10)
        # Compute user's yearly_total to determine current cashback level
        current_year = datetime.now(timezone.utc).year
        year_start = f"{current_year}-01-01T00:00:00"
        year_end = f"{current_year}-12-31T23:59:59"
        yearly_orders = await db.orders.find({
            "user_id": user["id"],
            "status": "completed",
            "created_at": {"$gte": year_start, "$lte": year_end}
        }, {"_id": 0, "total": 1}).to_list(1000)
        yearly_total = sum(o.get("total", 0) for o in yearly_orders)

        for program in programs:
            levels = sorted(program.get("levels", []), key=lambda x: x.get("min_points", 0))
            current_level = None
            for level in levels:
                if yearly_total >= level.get("min_points", 0):
                    current_level = level

            cashback_pct = current_level.get("cashback_percent", 0) if current_level else 0
            contrib_type = program.get("contribution_type", "order_total")
            contrib_pct = program.get("contribution_percent", 100)

            for ri in return_items:
                base = ri["item_total"]
                if contrib_type == "percentage":
                    base = base * (contrib_pct / 100)
                if cashback_pct > 0:
                    bonus = base * (cashback_pct / 100)
                else:
                    bonus = base
                total_bonus_deduction += bonus

    return_id = str(uuid.uuid4())
    return_doc = {
        "id": return_id,
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "order_id": order_id,
        "type": return_type,
        "items": return_items,
        "reason": reason,
        "status": "pending",
        "total_refund": total_refund,
        "total_deduction": total_deduction,
        "total_bonus_deduction": round(total_bonus_deduction, 2),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "admin_comment": ""
    }

    await db.returns.insert_one(return_doc)

    type_label = "Возврат" if return_type == "return" else "Возврат по гарантии"
    await notify_admin(
        "return_request",
        "Запрос на возврат",
        f"{user.get('name', user.get('email', ''))} оформил {type_label.lower()} по заказу #{order_id[:8]}",
        "/admin/returns"
    )
    await notify_user(
        user["id"], "return",
        "Запрос на возврат оформлен",
        f"Ваш запрос на {type_label.lower()} по заказу #{order_id[:8]} принят в обработку",
        "/returns"
    )

    return_doc.pop("_id", None)
    return return_doc


@router.get("/returns")
async def get_my_returns(user=Depends(get_current_user)):
    """Get current user's returns"""
    returns = await db.returns.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return returns


@router.get("/admin/returns")
async def get_all_returns(user=Depends(get_current_user)):
    """Admin: get all return requests"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    returns = await db.returns.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return returns


@router.put("/admin/returns/{return_id}/approve")
async def approve_return(return_id: str, data: dict = None, user=Depends(get_current_user)):
    """Admin: approve return request"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    ret = await db.returns.find_one({"id": return_id}, {"_id": 0})
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    if ret["status"] != "pending":
        raise HTTPException(status_code=400, detail="Return already processed")

    comment = (data or {}).get("comment", "")

    await db.returns.update_one(
        {"id": return_id},
        {"$set": {"status": "approved", "admin_comment": comment, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    if ret["type"] == "return":
        # Credit refund to user balance
        refund_amount = ret.get("total_refund", 0)
        if refund_amount > 0:
            await db.users.update_one(
                {"id": ret["user_id"]},
                {"$inc": {"balance": refund_amount}}
            )
            # Record balance transaction
            await db.balance_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": ret["user_id"],
                "amount": refund_amount,
                "type": "refund",
                "description": f"Возврат по заказу #{ret['order_id'][:8]} (удержание 10%)",
                "created_at": datetime.now(timezone.utc).isoformat()
            })

        # Deduct bonus points
        bonus_deduction = ret.get("total_bonus_deduction", 0)
        if bonus_deduction > 0:
            programs = await db.bonus_programs.find({"enabled": True}, {"_id": 0}).to_list(10)
            for program in programs:
                progress = await db.bonus_progress.find_one(
                    {"user_id": ret["user_id"], "program_id": program["id"]},
                    {"_id": 0}
                )
                if progress:
                    new_amount = max(0, progress.get("current_amount", 0) - bonus_deduction)
                    await db.bonus_progress.update_one(
                        {"user_id": ret["user_id"], "program_id": program["id"]},
                        {"$set": {"current_amount": new_amount}}
                    )

        await notify_user(
            ret["user_id"], "return",
            "Возврат одобрен",
            f"Ваш возврат по заказу #{ret['order_id'][:8]} одобрен. {refund_amount:.0f} ₽ зачислено на баланс (удержание 10%). Списано {bonus_deduction:.0f} бонусных баллов.",
            "/returns"
        )

    elif ret["type"] == "warranty":
        await notify_user(
            ret["user_id"], "return",
            "Возврат по гарантии одобрен",
            f"Ваш запрос на замену товара по гарантии (заказ #{ret['order_id'][:8]}) одобрен. Свяжитесь с нами для замены.",
            "/returns"
        )

    return {"message": "Return approved", "status": "approved"}


@router.put("/admin/returns/{return_id}/reject")
async def reject_return(return_id: str, data: dict = None, user=Depends(get_current_user)):
    """Admin: reject return request"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    ret = await db.returns.find_one({"id": return_id}, {"_id": 0})
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    if ret["status"] != "pending":
        raise HTTPException(status_code=400, detail="Return already processed")

    comment = (data or {}).get("comment", "")

    await db.returns.update_one(
        {"id": return_id},
        {"$set": {"status": "rejected", "admin_comment": comment, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    type_label = "возврат" if ret["type"] == "return" else "возврат по гарантии"
    await notify_user(
        ret["user_id"], "return",
        "Возврат отклонён",
        f"Ваш запрос на {type_label} по заказу #{ret['order_id'][:8]} отклонён." + (f" Причина: {comment}" if comment else ""),
        "/returns"
    )

    return {"message": "Return rejected", "status": "rejected"}
