"""Deferred payment (отсрочка) / credit limit routes."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db, get_current_user
from notify import notify_user, notify_admin

router = APIRouter(tags=["credit"])


async def has_overdue_deferral(user_id: str) -> bool:
    """True if user has any unpaid deferral past its due date."""
    now = datetime.now(timezone.utc).isoformat()
    doc = await db.deferrals.find_one({
        "user_id": user_id,
        "status": "unpaid",
        "due_date": {"$ne": None, "$lt": now},
    }, {"_id": 0, "id": 1})
    return doc is not None


class CreditRequestCreate(BaseModel):
    requested_limit: float
    message: str = ""


class CreditApprove(BaseModel):
    limit: float
    term_days: int = 30
    response_message: str = ""


class CreditReject(BaseModel):
    response_message: str = ""


class ClientReject(BaseModel):
    reason: str = ""


async def _credit_summary(user_id: str):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "credit_status": 1, "credit_limit": 1, "credit_term_days": 1})
    status = (u or {}).get("credit_status", "none")
    limit = (u or {}).get("credit_limit", 0) or 0
    term_days = (u or {}).get("credit_term_days", 0) or 0
    deferrals = await db.deferrals.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    debt = sum(d.get("amount", 0) for d in deferrals if d.get("status") == "unpaid")
    available = max(0, limit - debt)
    return {
        "status": status,
        "limit": limit,
        "term_days": term_days,
        "debt": round(debt, 2),
        "available": round(available, 2),
        "deferrals": deferrals,
    }


# --- Client endpoints ---

@router.get("/credit/my")
async def my_credit(user=Depends(get_current_user)):
    summary = await _credit_summary(user["id"])
    pending = await db.credit_requests.find_one(
        {"user_id": user["id"], "status": {"$in": ["pending", "offered"]}}, {"_id": 0}
    )
    summary["pending_request"] = pending
    return summary


@router.post("/credit/requests/{request_id}/accept")
async def accept_credit_offer(request_id: str, user=Depends(get_current_user)):
    """Client accepts the admin's counter-offer for a deferral — grants the credit."""
    req = await db.credit_requests.find_one({"id": request_id, "user_id": user["id"]}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req.get("status") != "offered":
        raise HTTPException(status_code=400, detail="Нет активного предложения для принятия")
    limit = req.get("offered_limit", 0) or 0
    term = req.get("offered_term_days", 30) or 30
    now = datetime.now(timezone.utc).isoformat()
    await db.credit_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "accepted", "approved_limit": limit, "term_days": term, "client_decision_at": now, "updated_at": now}},
    )
    await db.users.update_one(
        {"id": req["user_id"]},
        {"$set": {"credit_status": "approved", "credit_limit": limit, "credit_term_days": term}},
    )
    await notify_admin(
        "credit_request", "Клиент принял условия отсрочки",
        f"{user.get('name', user.get('email',''))} принял отсрочку: лимит {limit:.0f} ₽, срок {term} дн.",
        "/admin/credit",
    )
    return await db.credit_requests.find_one({"id": request_id}, {"_id": 0})


@router.post("/credit/requests/{request_id}/reject")
async def reject_credit_offer(request_id: str, data: ClientReject, user=Depends(get_current_user)):
    """Client rejects the admin's counter-offer for a deferral."""
    req = await db.credit_requests.find_one({"id": request_id, "user_id": user["id"]}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req.get("status") != "offered":
        raise HTTPException(status_code=400, detail="Нет активного предложения для отклонения")
    now = datetime.now(timezone.utc).isoformat()
    await db.credit_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected_by_client", "client_reject_reason": (data.reason or "").strip(), "client_decision_at": now, "updated_at": now}},
    )
    reason_txt = f" Причина: {data.reason.strip()}" if (data.reason and data.reason.strip()) else ""
    await notify_admin(
        "credit_request", "Клиент отклонил условия отсрочки",
        f"{user.get('name', user.get('email',''))} отклонил предложенные условия отсрочки.{reason_txt}",
        "/admin/credit",
    )
    return await db.credit_requests.find_one({"id": request_id}, {"_id": 0})


@router.post("/credit/request")
async def request_credit(data: CreditRequestCreate, user=Depends(get_current_user)):
    if data.requested_limit <= 0:
        raise HTTPException(status_code=400, detail="Укажите сумму лимита")
    existing = await db.credit_requests.find_one({"user_id": user["id"], "status": "pending"})
    if existing:
        raise HTTPException(status_code=400, detail="У вас уже есть запрос на рассмотрении")
    req = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "requested_limit": data.requested_limit,
        "message": data.message,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.credit_requests.insert_one(req)
    await notify_admin(
        "credit_request", "Запрос на отсрочку",
        f"{user.get('name', user.get('email'))} запросил лимит отсрочки {data.requested_limit:.0f} ₽",
        "/admin/credit",
    )
    req.pop("_id", None)
    return req


# --- Admin endpoints ---

async def _ensure_admin(user):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/admin/credit-requests")
async def list_credit_requests(status: Optional[str] = None, user=Depends(get_current_user)):
    await _ensure_admin(user)
    q = {}
    if status:
        q["status"] = status
    reqs = await db.credit_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return reqs


@router.get("/admin/credit-accounts")
async def list_credit_accounts(user=Depends(get_current_user)):
    await _ensure_admin(user)
    users = await db.users.find(
        {"credit_status": "approved"},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "credit_limit": 1, "credit_term_days": 1},
    ).to_list(2000)
    out = []
    for u in users:
        deferrals = await db.deferrals.find({"user_id": u["id"]}, {"_id": 0, "amount": 1, "status": 1}).to_list(1000)
        debt = sum(d.get("amount", 0) for d in deferrals if d.get("status") == "unpaid")
        out.append({**u, "debt": round(debt, 2), "available": round(max(0, (u.get("credit_limit", 0) or 0) - debt), 2)})
    return out


@router.get("/admin/deferrals")
async def list_deferrals(status: Optional[str] = None, user=Depends(get_current_user)):
    await _ensure_admin(user)
    q = {}
    if status:
        q["status"] = status
    deferrals = await db.deferrals.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)
    # enrich with user name
    user_ids = list({d["user_id"] for d in deferrals})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(2000)
    umap = {u["id"]: u for u in users}
    for d in deferrals:
        u = umap.get(d["user_id"], {})
        d["user_name"] = u.get("name", "")
        d["user_email"] = u.get("email", "")
    return deferrals


@router.put("/admin/credit-requests/{request_id}/approve")
async def approve_credit(request_id: str, data: CreditApprove, user=Depends(get_current_user)):
    await _ensure_admin(user)
    req = await db.credit_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if data.limit <= 0:
        raise HTTPException(status_code=400, detail="Лимит должен быть больше 0")
    await db.credit_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "approved_limit": data.limit, "term_days": data.term_days,
                  "response_message": data.response_message, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await db.users.update_one(
        {"id": req["user_id"]},
        {"$set": {"credit_status": "approved", "credit_limit": data.limit, "credit_term_days": data.term_days}},
    )
    await notify_user(
        req["user_id"], "credit_request", "Отсрочка одобрена",
        f"Вам одобрен лимит отсрочки {data.limit:.0f} ₽ (срок оплаты {data.term_days} дн.)",
        "/credit",
    )
    return await db.credit_requests.find_one({"id": request_id}, {"_id": 0})


@router.put("/admin/credit-requests/{request_id}/offer")
async def offer_credit(request_id: str, data: CreditApprove, user=Depends(get_current_user)):
    """Admin proposes counter-terms for a deferral. Credit is granted only after the client accepts."""
    await _ensure_admin(user)
    req = await db.credit_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.get("status") not in ("pending", "offered"):
        raise HTTPException(status_code=400, detail="Запрос уже обработан")
    if data.limit <= 0:
        raise HTTPException(status_code=400, detail="Лимит должен быть больше 0")
    await db.credit_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "offered", "offered_limit": data.limit, "offered_term_days": data.term_days,
                  "response_message": data.response_message, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await notify_user(
        req["user_id"], "credit_offer", "Предложение по отсрочке",
        (data.response_message + " " if data.response_message else "") + f"Предложены условия: лимит {data.limit:.0f} ₽, срок оплаты {data.term_days} дн. Примите или отклоните в разделе «Отсрочка».",
        "/credit",
    )
    return await db.credit_requests.find_one({"id": request_id}, {"_id": 0})


@router.put("/admin/credit-requests/{request_id}/reject")
async def reject_credit(request_id: str, data: CreditReject, user=Depends(get_current_user)):
    await _ensure_admin(user)
    req = await db.credit_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.credit_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "response_message": data.response_message, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await notify_user(
        req["user_id"], "credit_request", "Запрос на отсрочку отклонён",
        data.response_message or "Ваш запрос на отсрочку отклонён.",
        "/credit",
    )
    return await db.credit_requests.find_one({"id": request_id}, {"_id": 0})


@router.put("/admin/credit/{user_id}/set-limit")
async def set_credit_limit(user_id: str, data: CreditApprove, user=Depends(get_current_user)):
    """Directly set / adjust a user's credit limit & term (without a request)."""
    await _ensure_admin(user)
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    status = "approved" if data.limit > 0 else "none"
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"credit_status": status, "credit_limit": data.limit, "credit_term_days": data.term_days}},
    )
    return {"success": True}


@router.put("/admin/deferrals/{deferral_id}/mark-paid")
async def mark_deferral_paid(deferral_id: str, user=Depends(get_current_user)):
    await _ensure_admin(user)
    d = await db.deferrals.find_one({"id": deferral_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Deferral not found")
    if d.get("status") == "paid":
        return {"success": True, "already": True}
    await db.deferrals.update_one(
        {"id": deferral_id},
        {"$set": {"status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}},
    )
    if d.get("order_id"):
        await db.orders.update_one({"id": d["order_id"]}, {"$set": {"payment_status": "paid"}})
    await notify_user(
        d["user_id"], "credit_request", "Отсрочка погашена",
        f"Отсрочка по заказу #{str(d.get('order_id',''))[:8]} на {d.get('amount',0):.0f} ₽ отмечена как оплаченная.",
        "/credit",
    )
    return {"success": True}
