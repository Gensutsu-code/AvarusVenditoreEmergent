"""Bonus program routes"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from database import db, get_current_user
from routes.action_logs import log_action

router = APIRouter(tags=["bonus"])


# ==================== MODELS ====================

class BonusProgramCreate(BaseModel):
    title: str = "Бонусная программа"
    description: str = ""
    full_description: str = ""
    image_url: str = ""
    banner_url: str = ""
    banner_height: int = 200
    header_font_size: int = 14
    max_amount: float = 50000
    contribution_type: str = "order_total"
    contribution_percent: float = 100
    enabled: bool = True
    prizes: List[dict] = []
    levels: List[dict] = []


# ==================== HELPERS ====================

async def get_all_bonus_programs():
    return await db.bonus_programs.find({}, {"_id": 0}).to_list(100)


async def get_bonus_program(program_id: str):
    return await db.bonus_programs.find_one({"id": program_id}, {"_id": 0})


async def get_user_program_progress(user_id: str, program_id: str):
    progress = await db.bonus_progress.find_one(
        {"user_id": user_id, "program_id": program_id}, {"_id": 0}
    )
    if not progress:
        progress = {
            "user_id": user_id,
            "program_id": program_id,
            "current_amount": 0,
            "bonus_requested": False,
            "request_date": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bonus_progress.insert_one(progress)
        progress = await db.bonus_progress.find_one(
            {"user_id": user_id, "program_id": program_id}, {"_id": 0}
        )
    return progress


async def _calc_bonus_eligible_total(order_items: list, fallback_total: float) -> float:
    """Calculate the portion of order total that counts for bonus accrual.
    Only items whose product has bonus_eligible != False are counted."""
    if not order_items:
        return fallback_total
    eligible = 0.0
    has_any = False
    for item in order_items:
        pid = item.get("product_id")
        if not pid:
            continue
        product = await db.products.find_one({"id": pid}, {"_id": 0, "bonus_eligible": 1})
        # Default True if missing (backward compatibility)
        if product is None or product.get("bonus_eligible", True):
            eligible += (item.get("price", 0) or 0) * (item.get("quantity", 0) or 0)
            has_any = True
    # If product lookups failed for all items, fall back to the provided total
    return eligible if has_any or eligible > 0 else fallback_total


async def update_bonus_on_order_delivered(user_id: str, order_total: float, order_items: list = None):
    """Called when order status changes to 'completed'.
    Only bonus_eligible items contribute to the accrual base."""
    from notify import notify_user

    programs = await get_all_bonus_programs()

    current_year = datetime.now(timezone.utc).year
    year_start = f"{current_year}-01-01T00:00:00"
    year_end = f"{current_year}-12-31T23:59:59"

    yearly_orders = await db.orders.find({
        "user_id": user_id,
        "status": "completed",
        "created_at": {"$gte": year_start, "$lte": year_end}
    }, {"_id": 0, "total": 1}).to_list(1000)

    yearly_total = sum(order.get("total", 0) for order in yearly_orders)

    # Compute eligible amount (only products with bonus_eligible != False)
    eligible_total = await _calc_bonus_eligible_total(order_items or [], order_total)

    for program in programs:
        if not program.get("enabled"):
            continue

        program_id = program["id"]
        progress = await get_user_program_progress(user_id, program_id)

        contribution_type = program.get("contribution_type", "order_total")
        contribution_percent = program.get("contribution_percent", 100)

        if contribution_type == "percentage":
            base_amount = eligible_total * (contribution_percent / 100)
        else:
            base_amount = eligible_total

        levels = program.get("levels", [])
        levels_sorted = sorted(levels, key=lambda x: x.get("min_points", 0))

        current_level = None
        for level in levels_sorted:
            if yearly_total >= level.get("min_points", 0):
                current_level = level

        if current_level and current_level.get("cashback_percent", 0) > 0:
            bonus_points = base_amount * (current_level["cashback_percent"] / 100)
        else:
            bonus_points = base_amount

        new_points = progress.get("current_amount", 0) + bonus_points

        await db.bonus_progress.update_one(
            {"user_id": user_id, "program_id": program_id},
            {"$set": {"current_amount": new_points}},
            upsert=True
        )

        # Notify user about bonus accrual
        if bonus_points > 0:
            await notify_user(
                user_id,
                "bonus",
                "Начисление баллов",
                f"Вам начислено {int(bonus_points)} бонусных баллов за выполненный заказ. Баланс: {int(new_points)} баллов",
                "/bonus"
            )

    return {"updated": True}


@router.get("/bonus/cart-preview")
async def cart_bonus_preview(user=Depends(get_current_user)):
    """Preview bonus points the user would earn for their current cart."""
    from routes.orders import _build_cart
    cart = await _build_cart(user)
    items = cart.get("items", [])
    if not items:
        return {"total_points": 0, "programs": []}

    order_total = sum((i.get("price", 0) or 0) * (i.get("quantity", 0) or 0) for i in items)
    eligible_total = await _calc_bonus_eligible_total(items, order_total)

    programs = await get_all_bonus_programs()
    current_year = datetime.now(timezone.utc).year
    year_start = f"{current_year}-01-01T00:00:00"
    year_end = f"{current_year}-12-31T23:59:59"
    yearly_orders = await db.orders.find({
        "user_id": user["id"], "status": "completed",
        "created_at": {"$gte": year_start, "$lte": year_end}
    }, {"_id": 0, "total": 1}).to_list(1000)
    yearly_total = sum(o.get("total", 0) for o in yearly_orders)

    result_programs = []
    total_points = 0.0
    for program in programs:
        if not program.get("enabled"):
            continue
        contribution_type = program.get("contribution_type", "order_total")
        contribution_percent = program.get("contribution_percent", 100)
        base_amount = eligible_total * (contribution_percent / 100) if contribution_type == "percentage" else eligible_total
        levels_sorted = sorted(program.get("levels", []), key=lambda x: x.get("min_points", 0))
        current_level = None
        for level in levels_sorted:
            if yearly_total >= level.get("min_points", 0):
                current_level = level
        if current_level and current_level.get("cashback_percent", 0) > 0:
            pts = base_amount * (current_level["cashback_percent"] / 100)
        else:
            pts = base_amount
        pts = round(pts, 2)
        if pts > 0:
            result_programs.append({"program_id": program["id"], "title": program.get("title", "Бонусы"), "points": pts})
            total_points += pts

    return {"total_points": round(total_points, 2), "programs": result_programs}


@router.post("/admin/bonus/recalculate")
async def recalculate_all_bonuses(user=Depends(get_current_user)):
    """Recalculate bonus points for all users based on completed orders"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    programs = await get_all_bonus_programs()
    if not programs:
        return {"message": "No bonus programs found", "updated_users": 0}
    
    # Get all unique user_ids with completed orders
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": "$user_id", "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ]
    user_totals = await db.orders.aggregate(pipeline).to_list(10000)
    
    updated = 0
    for ut in user_totals:
        uid = ut["_id"]
        order_total = ut["total"]
        
        for program in programs:
            if not program.get("enabled"):
                continue
            
            program_id = program["id"]
            
            contribution_type = program.get("contribution_type", "order_total")
            contribution_percent = program.get("contribution_percent", 100)
            
            if contribution_type == "percentage":
                base_amount = order_total * (contribution_percent / 100)
            else:
                base_amount = order_total
            
            levels = program.get("levels", [])
            levels_sorted = sorted(levels, key=lambda x: x.get("min_points", 0))
            
            current_level = None
            for level in levels_sorted:
                if order_total >= level.get("min_points", 0):
                    current_level = level
            
            if current_level and current_level.get("cashback_percent", 0) > 0:
                bonus_points = base_amount * (current_level["cashback_percent"] / 100)
            else:
                bonus_points = base_amount
            
            await db.bonus_progress.update_one(
                {"user_id": uid, "program_id": program_id},
                {"$set": {"current_amount": bonus_points, "updated_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True
            )
            updated += 1
    
    return {"message": f"Recalculated bonuses for {len(user_totals)} users", "updated_users": len(user_totals)}


# ==================== USER ROUTES ====================

@router.get("/bonus/programs")
async def get_user_bonus_programs(user=Depends(get_current_user)):
    """Get all bonus programs with user's progress"""
    programs = await get_all_bonus_programs()
    
    current_year = datetime.now(timezone.utc).year
    year_start = f"{current_year}-01-01T00:00:00"
    year_end = f"{current_year}-12-31T23:59:59"
    
    yearly_orders = await db.orders.find({
        "user_id": user["id"],
        "status": "completed",
        "created_at": {"$gte": year_start, "$lte": year_end}
    }, {"_id": 0, "total": 1}).to_list(1000)
    
    yearly_total = sum(order.get("total", 0) for order in yearly_orders)
    yearly_order_count = len(yearly_orders)
    
    result = []
    for program in programs:
        if not program.get("enabled"):
            continue
        
        progress = await get_user_program_progress(user["id"], program["id"])
        
        levels = program.get("levels", [])
        levels_sorted = sorted(levels, key=lambda x: x.get("min_points", 0))
        
        current_level = None
        next_level = None
        
        for i, level in enumerate(levels_sorted):
            if yearly_total >= level.get("min_points", 0):
                current_level = level
                if i + 1 < len(levels_sorted):
                    next_level = levels_sorted[i + 1]
        
        level_percentage = 0
        if next_level:
            current_min = current_level.get("min_points", 0) if current_level else 0
            next_min = next_level.get("min_points", 0)
            if next_min > current_min:
                level_percentage = min(100, ((yearly_total - current_min) / (next_min - current_min)) * 100)
        elif current_level:
            level_percentage = 100
        
        result.append({
            **program,
            "progress": progress,
            "current_level": current_level,
            "next_level": next_level,
            "level_percentage": round(level_percentage, 1),
            "yearly_total": yearly_total,
            "yearly_order_count": yearly_order_count
        })
    
    return result


@router.get("/bonus/my-redemptions")
async def get_my_prize_redemptions(user=Depends(get_current_user)):
    """Get user's prize redemption history"""
    redemptions = await db.prize_redemptions.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"redemptions": redemptions}


@router.post("/bonus/redeem-prize")
async def redeem_prize(data: dict, user=Depends(get_current_user)):
    """Redeem a prize with bonus points"""
    program_id = data.get("program_id")
    prize_id = data.get("prize_id")
    
    if not program_id or not prize_id:
        raise HTTPException(status_code=400, detail="Требуется program_id и prize_id")
    
    program = await get_bonus_program(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Программа не найдена")
    
    prize = next((p for p in program.get("prizes", []) if p.get("id") == prize_id), None)
    if not prize:
        raise HTTPException(status_code=404, detail="Приз не найден")
    
    if not prize.get("enabled", True):
        raise HTTPException(status_code=400, detail="Приз недоступен")
    
    progress = await get_user_program_progress(user["id"], program_id)
    current_points = progress.get("current_amount", 0)
    points_cost = prize.get("points_cost", 0)
    
    if current_points < points_cost:
        raise HTTPException(status_code=400, detail="Недостаточно баллов")
    
    if prize.get("quantity", -1) == 0:
        raise HTTPException(status_code=400, detail="Приз закончился")
    
    redemption = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "program_id": program_id,
        "prize_id": prize_id,
        "prize_name": prize.get("name", ""),
        "points_cost": points_cost,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.prize_redemptions.insert_one(redemption)

    # Notify admin about prize request
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": "ADMIN",
        "type": "prize_request",
        "title": "Запрос приза",
        "message": f"Клиент {user.get('name') or user.get('email')} запросил приз «{prize.get('name', '')}» ({points_cost} баллов)",
        "link": "/admin",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    new_points = current_points - points_cost
    await db.bonus_progress.update_one(
        {"user_id": user["id"], "program_id": program_id},
        {"$set": {"current_amount": new_points}}
    )
    
    if prize.get("quantity", -1) > 0:
        prizes = program.get("prizes", [])
        for p in prizes:
            if p.get("id") == prize_id:
                p["quantity"] = max(0, p.get("quantity", 0) - 1)
                break
        await db.bonus_programs.update_one({"id": program_id}, {"$set": {"prizes": prizes}})
    
    return {"success": True, "new_points": new_points}


# ==================== ADMIN ROUTES ====================

@router.get("/admin/bonus/programs")
async def get_admin_bonus_programs(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    programs = await get_all_bonus_programs()
    
    for program in programs:
        pending_count = await db.prize_redemptions.count_documents({
            "program_id": program["id"],
            "status": "pending"
        })
        program["pending_requests"] = pending_count
    
    return programs


@router.post("/admin/bonus/programs")
async def create_bonus_program(data: BonusProgramCreate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    program_id = str(uuid.uuid4())
    prizes = data.prizes
    for prize in prizes:
        if not prize.get("id"):
            prize["id"] = str(uuid.uuid4())
    
    levels = data.levels
    for level in levels:
        if not level.get("id"):
            level["id"] = str(uuid.uuid4())
    
    program = {
        "id": program_id,
        **data.model_dump(),
        "prizes": prizes,
        "levels": levels,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bonus_programs.insert_one(program)
    return {k: v for k, v in program.items() if k != "_id"}


@router.put("/admin/bonus/programs/{program_id}")
async def update_bonus_program(program_id: str, data: BonusProgramCreate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    prizes = data.prizes
    for prize in prizes:
        if not prize.get("id"):
            prize["id"] = str(uuid.uuid4())
    
    levels = data.levels
    for level in levels:
        if not level.get("id"):
            level["id"] = str(uuid.uuid4())
    
    update_data = {
        **data.model_dump(),
        "prizes": prizes,
        "levels": levels
    }
    
    await db.bonus_programs.update_one({"id": program_id}, {"$set": update_data})
    return {"success": True}


@router.delete("/admin/bonus/programs/{program_id}")
async def delete_bonus_program(program_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.bonus_programs.delete_one({"id": program_id})
    await db.bonus_progress.delete_many({"program_id": program_id})
    return {"success": True}


@router.get("/admin/bonus/prize-redemptions")
async def get_admin_prize_redemptions(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    redemptions = await db.prize_redemptions.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"redemptions": redemptions}


@router.put("/admin/bonus/prize-redemptions/{redemption_id}/status")
async def update_prize_redemption_status(redemption_id: str, status: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    valid_statuses = ["pending", "approved", "issued", "rejected"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    redemption = await db.prize_redemptions.find_one({"id": redemption_id}, {"_id": 0})
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
    
    old_status = redemption.get("status")
    
    if status == "rejected" and old_status == "pending":
        points_cost = redemption.get("points_cost", 0)
        await db.bonus_progress.update_one(
            {"user_id": redemption["user_id"], "program_id": redemption["program_id"]},
            {"$inc": {"current_amount": points_cost}}
        )
    
    await db.prize_redemptions.update_one(
        {"id": redemption_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Log for revert
    status_labels = {"approved": "одобрен", "issued": "выдан", "rejected": "отклонён", "pending": "ожидает"}
    await log_action(
        action=f"Статус приза: {redemption.get('prize_name', '')} → {status_labels.get(status, status)}",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="PUT",
        path=f"/admin/bonus/prize-redemptions/{redemption_id}/status",
        status_code=200,
        details={"old_status": old_status, "new_status": status, "prize_name": redemption.get("prize_name")},
        before_state={**redemption},
        after_state={"status": status},
        collection_name="prize_redemptions",
        document_id=redemption_id,
    )

    # Notify client about status change
    status_messages = {
        "approved": f"Ваш запрос на приз «{redemption.get('prize_name', '')}» одобрен!",
        "issued": f"Приз «{redemption.get('prize_name', '')}» выдан! Свяжитесь с администратором для получения.",
        "rejected": f"Ваш запрос на приз «{redemption.get('prize_name', '')}» отклонён. Баллы возвращены.",
    }
    status_titles = {
        "approved": "Приз одобрен",
        "issued": "Приз выдан",
        "rejected": "Запрос отклонён",
    }
    if status in status_messages:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": redemption["user_id"],
            "type": "prize_status",
            "title": status_titles[status],
            "message": status_messages[status],
            "link": "/bonus",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    return {"success": True}


@router.get("/admin/bonus/programs/{program_id}/users")
async def get_bonus_program_users(program_id: str, user=Depends(get_current_user)):
    """Get all users with their progress for a specific bonus program"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    program = await get_bonus_program(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Программа не найдена")

    # Get all progress records for this program
    progress_list = await db.bonus_progress.find(
        {"program_id": program_id}, {"_id": 0}
    ).to_list(10000)

    if not progress_list:
        return {"users": []}

    levels = sorted(program.get("levels", []), key=lambda x: x.get("min_points", 0))

    result = []
    for progress in progress_list:
        uid = progress.get("user_id")
        u = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "email": 1})
        if not u:
            continue

        current_amount = progress.get("current_amount", 0)

        # Determine current level
        current_level = None
        for level in levels:
            if current_amount >= level.get("min_points", 0):
                current_level = level

        result.append({
            "id": u["id"],
            "name": u.get("name") or u.get("email", "—"),
            "email": u.get("email", ""),
            "current_amount": current_amount,
            "current_level": current_level,
        })

    # Sort by points desc
    result.sort(key=lambda x: -x["current_amount"])

    return {"users": result}


# ==================== COMPATIBILITY ALIASES ====================

@router.get("/admin/prize-redemptions")
async def get_admin_prize_redemptions_alias(user=Depends(get_current_user)):
    """Alias for /admin/bonus/prize-redemptions"""
    return await get_admin_prize_redemptions(user)


@router.put("/admin/prize-redemptions/{redemption_id}")
async def update_prize_redemption_alias(redemption_id: str, status: str, user=Depends(get_current_user)):
    """Alias for /admin/bonus/prize-redemptions/{id}/status"""
    return await update_prize_redemption_status(redemption_id, status, user)


@router.get("/admin/bonus/history")
async def get_admin_bonus_history(user=Depends(get_current_user)):
    """Get bonus history for admin"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Return recent bonus activities - redemptions + progress changes
    redemptions = await db.prize_redemptions.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    
    history = []
    for r in redemptions:
        history.append({
            "id": r.get("id"),
            "type": "prize_redemption",
            "user_name": r.get("user_name", ""),
            "prize_name": r.get("prize_name", ""),
            "points_cost": r.get("points_cost", 0),
            "status": r.get("status", "pending"),
            "created_at": r.get("created_at")
        })
    
    return {"history": history}




# ==================== ADMIN BONUS POINTS MANAGEMENT ====================

class PointsAction(BaseModel):
    amount: float
    reason: str = ""


@router.post("/admin/bonus/programs/{program_id}/users/{user_id}/add-points")
async def admin_add_points(program_id: str, user_id: str, body: PointsAction, user=Depends(get_current_user)):
    """Admin: add bonus points to a user"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    progress = await get_user_program_progress(user_id, program_id)
    old_amount = progress.get("current_amount", 0)
    new_amount = old_amount + body.amount

    await db.bonus_progress.update_one(
        {"user_id": user_id, "program_id": program_id},
        {"$set": {"current_amount": new_amount, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

    target = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
    target_name = (target.get("name") or target.get("email", "")) if target else ""

    # Notify user
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "bonus_points",
        "title": "Начисление баллов",
        "message": f"Вам начислено {body.amount:.0f} баллов. {body.reason}".strip(),
        "link": "/bonus",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # Log for revert
    await log_action(
        action=f"Начисление баллов: +{body.amount:.0f} → {target_name}",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="POST",
        path=f"/admin/bonus/programs/{program_id}/users/{user_id}/add-points",
        status_code=200,
        details={"amount": body.amount, "reason": body.reason, "target_user": user_id},
        before_state={"current_amount": old_amount},
        after_state={"current_amount": new_amount},
        collection_name="bonus_progress",
        document_query={"user_id": user_id, "program_id": program_id},
    )

    return {"success": True, "old_amount": old_amount, "new_amount": new_amount, "user_name": target_name}


@router.post("/admin/bonus/programs/{program_id}/users/{user_id}/remove-points")
async def admin_remove_points(program_id: str, user_id: str, body: PointsAction, user=Depends(get_current_user)):
    """Admin: remove bonus points from a user"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    progress = await get_user_program_progress(user_id, program_id)
    old_amount = progress.get("current_amount", 0)
    new_amount = max(0, old_amount - body.amount)

    await db.bonus_progress.update_one(
        {"user_id": user_id, "program_id": program_id},
        {"$set": {"current_amount": new_amount, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

    target = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
    target_name = (target.get("name") or target.get("email", "")) if target else ""

    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "bonus_points",
        "title": "Списание баллов",
        "message": f"Списано {body.amount:.0f} баллов. {body.reason}".strip(),
        "link": "/bonus",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # Log for revert
    await log_action(
        action=f"Списание баллов: -{body.amount:.0f} ← {target_name}",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="POST",
        path=f"/admin/bonus/programs/{program_id}/users/{user_id}/remove-points",
        status_code=200,
        details={"amount": body.amount, "reason": body.reason, "target_user": user_id},
        before_state={"current_amount": old_amount},
        after_state={"current_amount": new_amount},
        collection_name="bonus_progress",
        document_query={"user_id": user_id, "program_id": program_id},
    )

    return {"success": True, "old_amount": old_amount, "new_amount": new_amount, "user_name": target_name}


@router.post("/admin/bonus/programs/{program_id}/users/{user_id}/reset-points")
async def admin_reset_points(program_id: str, user_id: str, user=Depends(get_current_user)):
    """Admin: reset bonus points to zero"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    progress = await get_user_program_progress(user_id, program_id)
    old_amount = progress.get("current_amount", 0)

    await db.bonus_progress.update_one(
        {"user_id": user_id, "program_id": program_id},
        {"$set": {"current_amount": 0, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

    target = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
    target_name = (target.get("name") or target.get("email", "")) if target else ""

    # Log for revert
    await log_action(
        action=f"Сброс баллов: {old_amount:.0f} → 0 ({target_name})",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="POST",
        path=f"/admin/bonus/programs/{program_id}/users/{user_id}/reset-points",
        status_code=200,
        details={"old_amount": old_amount, "target_user": user_id},
        before_state={"current_amount": old_amount},
        after_state={"current_amount": 0},
        collection_name="bonus_progress",
        document_query={"user_id": user_id, "program_id": program_id},
    )

    return {"success": True, "old_amount": old_amount, "new_amount": 0}


# ==================== DELETE PRIZE REDEMPTIONS ====================

@router.delete("/admin/bonus/prize-redemptions/{redemption_id}")
async def delete_prize_redemption(redemption_id: str, user=Depends(get_current_user)):
    """Admin: delete a prize redemption from history"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    redemption = await db.prize_redemptions.find_one({"id": redemption_id}, {"_id": 0})
    if not redemption:
        raise HTTPException(status_code=404, detail="Not found")

    result = await db.prize_redemptions.delete_one({"id": redemption_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")

    # Log for revert (re-insert on revert)
    await log_action(
        action=f"Удаление заявки на приз: {redemption.get('prize_name', '')}",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="DELETE",
        path=f"/admin/bonus/prize-redemptions/{redemption_id}",
        status_code=200,
        details={"prize_name": redemption.get("prize_name"), "user_name": redemption.get("user_name")},
        before_state={**redemption},
        collection_name="prize_redemptions",
        document_id=redemption_id,
    )

    return {"success": True}


@router.delete("/admin/prize-redemptions/{redemption_id}")
async def delete_prize_redemption_alias(redemption_id: str, user=Depends(get_current_user)):
    """Alias"""
    return await delete_prize_redemption(redemption_id, user)


@router.delete("/bonus/my-redemptions/{redemption_id}")
async def delete_my_redemption(redemption_id: str, user=Depends(get_current_user)):
    """Client: delete own prize redemption from history (only issued/rejected)"""
    redemption = await db.prize_redemptions.find_one({"id": redemption_id, "user_id": user["id"]}, {"_id": 0})
    if not redemption:
        raise HTTPException(status_code=404, detail="Not found")
    if redemption.get("status") not in ("issued", "rejected"):
        raise HTTPException(status_code=400, detail="Can only delete completed or rejected requests")
    await db.prize_redemptions.delete_one({"id": redemption_id})
    return {"success": True}
