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
    photos = data.get("photos", [])  # list of image URLs

    if not return_type or return_type not in ("return", "warranty"):
        raise HTTPException(status_code=400, detail="Invalid return type")
    if not order_id or not items:
        raise HTTPException(status_code=400, detail="Order and items required")

    # Load admin-configured return rules
    rs_doc = await db.settings.find_one({"key": "return_settings"})
    rs = rs_doc.get("value", {}) if rs_doc else {}
    fee_percent = float(rs.get("fee_percent", 10))
    min_photos = int(rs.get("min_photos", 1))
    return_window_days = int(rs.get("return_window_days", 0))
    warranty_enabled = bool(rs.get("warranty_enabled", True))

    if return_type == "warranty" and not warranty_enabled:
        raise HTTPException(status_code=400, detail="Гарантийный возврат сейчас недоступен")
    if min_photos > 0 and (not isinstance(photos, list) or len(photos) < min_photos):
        raise HTTPException(status_code=400, detail=f"Необходимо приложить минимум {min_photos} фото")

    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Only completed orders can be returned")

    # Enforce return window (days since completion) when configured
    if return_window_days > 0:
        ref_str = order.get("completed_at") or order.get("created_at")
        if ref_str:
            try:
                ref_dt = datetime.fromisoformat(ref_str.replace("Z", "+00:00"))
                if ref_dt.tzinfo is None:
                    ref_dt = ref_dt.replace(tzinfo=timezone.utc)
                days_passed = (datetime.now(timezone.utc) - ref_dt).days
                if days_passed > return_window_days:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Срок возврата истёк (возврат возможен в течение {return_window_days} дн. после выполнения заказа)"
                    )
            except HTTPException:
                raise
            except (ValueError, TypeError):
                pass

    # Validate items belong to the order
    order_item_ids = {item.get("product_id") for item in order.get("items", [])}
    for item in items:
        if item.get("product_id") not in order_item_ids:
            raise HTTPException(status_code=400, detail=f"Item {item.get('product_id')} not in order")

    # Check already-returned quantities (pending or approved blocks the quantity)
    existing_returns = await db.returns.find(
        {"order_id": order_id, "status": {"$in": ["pending", "approved"]}},
        {"_id": 0, "items": 1}
    ).to_list(100)
    already_returned = {}
    for r in existing_returns:
        for ri in r.get("items", []):
            pid = ri.get("product_id")
            already_returned[pid] = already_returned.get(pid, 0) + (ri.get("quantity", 0) or 0)

    # Compute available quantities
    for item in items:
        pid = item.get("product_id")
        qty_requested = item.get("quantity", 1) or 1
        order_item = next((oi for oi in order.get("items", []) if oi.get("product_id") == pid), None)
        if not order_item:
            continue
        max_qty = (order_item.get("quantity", 1) or 1) - already_returned.get(pid, 0)
        if qty_requested > max_qty:
            name = order_item.get("name", pid)
            if max_qty <= 0:
                raise HTTPException(status_code=400, detail=f"Товар «{name}» уже был возвращён полностью")
            raise HTTPException(
                status_code=400,
                detail=f"По товару «{name}» можно вернуть не более {max_qty} шт. (остальные уже в заявках)"
            )

    # Get eligibility info for each product
    product_eligibility = {}
    for item in items:
        pid = item.get("product_id")
        product = await db.products.find_one({"id": pid}, {"_id": 0, "bonus_eligible": 1})
        product_eligibility[pid] = (product is None) or product.get("bonus_eligible", True)

    # Calculate refund amounts + per-item bonus breakdown per program
    total_refund = 0.0
    total_deduction = 0.0
    return_items = []

    # Pre-compute user's yearly_total + program level info (for "return" type)
    program_infos = []  # list of dicts {id, cashback_pct, contrib_type, contrib_pct}
    if return_type == "return":
        programs = await db.bonus_programs.find({"enabled": True}, {"_id": 0}).to_list(10)
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
            program_infos.append({
                "id": program["id"],
                "cashback_pct": current_level.get("cashback_percent", 0) if current_level else 0,
                "contrib_type": program.get("contribution_type", "order_total"),
                "contrib_pct": program.get("contribution_percent", 100),
            })

    # Per-program accumulator for total_bonus_deduction
    program_bonus_totals = {p["id"]: 0.0 for p in program_infos}

    for item in items:
        pid = item.get("product_id")
        order_item = next((oi for oi in order.get("items", []) if oi.get("product_id") == pid), None)
        if not order_item:
            continue

        qty = min(item.get("quantity", 1), order_item.get("quantity", 1))
        item_total = order_item.get("price", 0) * qty

        if return_type == "return":
            deduction = round(item_total * (fee_percent / 100), 2)
            refund = round(item_total - deduction, 2)
            total_deduction += deduction
            total_refund += refund
        else:
            refund = 0
            deduction = 0

        # Per-item per-program bonus calculation
        item_program_bonuses = {}
        if return_type == "return" and product_eligibility.get(pid, True):
            for pinfo in program_infos:
                base = item_total
                if pinfo["contrib_type"] == "percentage":
                    base = base * (pinfo["contrib_pct"] / 100)
                if pinfo["cashback_pct"] > 0:
                    b = base * (pinfo["cashback_pct"] / 100)
                else:
                    b = base
                item_program_bonuses[pinfo["id"]] = round(b, 2)
                program_bonus_totals[pinfo["id"]] = program_bonus_totals.get(pinfo["id"], 0.0) + b

        return_items.append({
            "product_id": pid,
            "name": order_item.get("name", ""),
            "article": order_item.get("article", ""),
            "price": order_item.get("price", 0),
            "quantity": qty,
            "image_url": order_item.get("image_url", ""),
            "item_total": item_total,
            "deduction": deduction if return_type == "return" else 0,
            "refund": refund if return_type == "return" else 0,
            "bonus_eligible": product_eligibility.get(pid, True),
            "program_bonuses": item_program_bonuses,  # per-program bonus deduction for this item
        })

    total_bonus_deduction = round(sum(program_bonus_totals.values()), 2)

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
        "photos": photos,
        "status": "pending",
        "fee_percent": fee_percent,
        "total_refund": total_refund,
        "total_deduction": total_deduction,
        "total_bonus_deduction": total_bonus_deduction,
        "program_bonus_totals": {k: round(v, 2) for k, v in program_bonus_totals.items()},
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
    fee_pct = ret.get("fee_percent", 10)
    fee_label = f"{fee_pct:g}%"

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
                "description": f"Возврат по заказу #{ret['order_id'][:8]} (удержание {fee_label})",
                "created_at": datetime.now(timezone.utc).isoformat()
            })

        # Deduct bonus points per-program (uses stored breakdown when available)
        bonus_deduction = ret.get("total_bonus_deduction", 0)
        program_totals = ret.get("program_bonus_totals", {}) or {}
        if bonus_deduction > 0:
            if program_totals:
                # Use stored per-program breakdown
                for program_id, amount in program_totals.items():
                    if amount <= 0:
                        continue
                    progress = await db.bonus_progress.find_one(
                        {"user_id": ret["user_id"], "program_id": program_id},
                        {"_id": 0}
                    )
                    if progress:
                        new_amount = max(0, progress.get("current_amount", 0) - amount)
                        await db.bonus_progress.update_one(
                            {"user_id": ret["user_id"], "program_id": program_id},
                            {"$set": {"current_amount": new_amount}}
                        )
            else:
                # Fallback for legacy returns without breakdown: distribute evenly
                programs = await db.bonus_programs.find({"enabled": True}, {"_id": 0}).to_list(10)
                num_programs = max(1, len(programs))
                per_program_deduction = bonus_deduction / num_programs
                for program in programs:
                    progress = await db.bonus_progress.find_one(
                        {"user_id": ret["user_id"], "program_id": program["id"]},
                        {"_id": 0}
                    )
                    if progress:
                        new_amount = max(0, progress.get("current_amount", 0) - per_program_deduction)
                        await db.bonus_progress.update_one(
                            {"user_id": ret["user_id"], "program_id": program["id"]},
                            {"$set": {"current_amount": new_amount}}
                        )

        await notify_user(
            ret["user_id"], "return",
            "Возврат одобрен",
            f"Ваш возврат по заказу #{ret['order_id'][:8]} одобрен. {refund_amount:.0f} ₽ зачислено на баланс (удержание {fee_label}). Списано {bonus_deduction:.0f} бонусных баллов.",
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
