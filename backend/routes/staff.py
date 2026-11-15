"""Staff (managers), client statuses and their standard/individual conditions, manager statistics."""
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db, get_current_user, hash_password, get_status_conditions, effective_conditions
from notify import notify_admin, notify_user

router = APIRouter(tags=["staff"])

PERIOD_DAYS = {"day": 1, "week": 7, "month": 30, "year": 365}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _now():
    return datetime.now(timezone.utc).isoformat()


def _admin(user):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _manager(user):
    if user.get("role") != "manager":
        raise HTTPException(status_code=403, detail="Доступно только менеджеру")


# ==================== STANDARD CONDITIONS PER STATUS (site settings) ====================

class ClientConditions(BaseModel):
    discount: float = Field(default=0, ge=0, le=100)
    delivery_cost: Optional[float] = Field(default=None, ge=0)  # None = site-wide delivery price
    deferral_days: int = Field(default=0, ge=0, le=365)
    credit_limit: float = Field(default=0, ge=0)


class ManagerConditions(BaseModel):
    commission_percent: float = Field(default=0, ge=0, le=100)


class StatusConditionsIn(BaseModel):
    retail: ClientConditions
    wholesale: ClientConditions
    manager: ManagerConditions


@router.get("/admin/status-conditions")
async def get_conditions(user=Depends(get_current_user)):
    _admin(user)
    return await get_status_conditions()


@router.put("/admin/status-conditions")
async def put_conditions(data: StatusConditionsIn, user=Depends(get_current_user)):
    _admin(user)
    await db.settings.update_one({"key": "status_conditions"}, {"$set": {"value": data.model_dump()}}, upsert=True)
    return await get_status_conditions()


@router.get("/my-conditions")
async def my_conditions(user=Depends(get_current_user)):
    raw = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    eff = effective_conditions(raw, await get_status_conditions())
    pending = await db.conditions_requests.find_one({"user_id": user["id"], "status": "pending"}, {"_id": 0})
    manager = None
    if raw.get("manager_id"):
        m = await db.users.find_one({"id": raw["manager_id"], "role": "manager"}, {"_id": 0, "name": 1, "phone": 1, "email": 1})
        manager = m
    return {**eff, "pending_request": pending, "manager": manager}


# ==================== INDIVIDUAL CONDITIONS (admin / manager / request) ====================

class IndividualConditionsIn(BaseModel):
    individual_discount: float = Field(default=0, ge=0, le=100)
    delivery_cost: Optional[float] = Field(default=None, ge=0)
    deferral_days: int = Field(default=0, ge=0, le=365)
    credit_limit: float = Field(default=0, ge=0)


async def _apply_individual_conditions(user_id: str, data: IndividualConditionsIn, extra: Optional[dict] = None):
    current = await db.users.find_one({"id": user_id}, {"_id": 0, "credit_status": 1})
    upd = {
        "individual_discount": round(data.individual_discount, 2),
        "delivery_cost": data.delivery_cost,
        "deferral_days": data.deferral_days,
        "credit_limit": round(data.credit_limit, 2),
        **(extra or {}),
    }
    if data.deferral_days:
        upd["credit_term_days"] = data.deferral_days
    if data.credit_limit > 0:
        upd["credit_status"] = "approved"
    elif (current or {}).get("credit_status") == "approved":
        upd["credit_status"] = "none"
    await db.users.update_one({"id": user_id}, {"$set": upd})


class ConditionsRequestIn(BaseModel):
    discount: float = Field(default=0, ge=0, le=90)
    deferral_days: int = Field(default=0, ge=0, le=365)
    credit_limit: float = Field(default=0, ge=0)
    comment: str = Field(default="", max_length=1000)


@router.post("/conditions-requests")
async def create_conditions_request(data: ConditionsRequestIn, user=Depends(get_current_user)):
    if user.get("role") != "user":
        raise HTTPException(status_code=400, detail="Запрос доступен только клиентам")
    if data.discount <= 0 and data.deferral_days <= 0 and data.credit_limit <= 0 and not data.comment.strip():
        raise HTTPException(status_code=400, detail="Укажите желаемые условия или опишите их в комментарии")
    if await db.conditions_requests.find_one({"user_id": user["id"], "status": "pending"}):
        raise HTTPException(status_code=400, detail="У вас уже есть запрос на рассмотрении")
    doc = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user.get("name", ""), "user_email": user.get("email", ""),
        "current_status": user.get("customer_status", "retail"),
        "discount": data.discount, "deferral_days": data.deferral_days, "credit_limit": data.credit_limit,
        "comment": data.comment.strip(), "status": "pending", "created_at": _now(),
    }
    await db.conditions_requests.insert_one(dict(doc))
    await notify_admin("conditions_request", "Запрос на индивидуальные условия", f"{doc['user_name']} ({doc['user_email']})", "/admin/staff")
    return doc


@router.get("/admin/conditions-requests")
async def list_conditions_requests(user=Depends(get_current_user)):
    _admin(user)
    return await db.conditions_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)


class ConditionsDecisionIn(IndividualConditionsIn):
    action: str  # 'approve' | 'reject'
    response: str = Field(default="", max_length=500)


@router.put("/admin/conditions-requests/{request_id}")
async def decide_conditions_request(request_id: str, data: ConditionsDecisionIn, user=Depends(get_current_user)):
    _admin(user)
    if data.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Неизвестное действие")
    req = await db.conditions_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Запрос уже обработан")
    upd = {"status": "approved" if data.action == "approve" else "rejected", "handled_at": _now(), "response": data.response.strip()}
    if data.action == "approve":
        # an approved request makes the client a wholesale client with individual conditions
        await _apply_individual_conditions(req["user_id"], data, {"customer_status": "wholesale"})
        upd["approved"] = {"individual_discount": data.individual_discount, "delivery_cost": data.delivery_cost,
                           "deferral_days": data.deferral_days, "credit_limit": data.credit_limit}
    await db.conditions_requests.update_one({"id": request_id}, {"$set": upd})
    text = "Запрос одобрен: вам присвоен статус оптового клиента" if data.action == "approve" else "Запрос на индивидуальные условия отклонён"
    await notify_user(req["user_id"], "conditions", "Индивидуальные условия", text, "/account")
    return {"success": True}


# ==================== STATISTICS ====================

async def _manager_stats(manager: dict, period: str, detailed: bool = True):
    if period not in PERIOD_DAYS and period != "all":
        raise HTTPException(status_code=400, detail="Неизвестный период")
    query = {"manager_id": manager["id"], "status": {"$ne": "cancelled"}}
    if period != "all":
        query["created_at"] = {"$gte": (datetime.now(timezone.utc) - timedelta(days=PERIOD_DAYS[period])).isoformat()}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    order_ids = [o["id"] for o in orders]
    cost_map = {}
    if order_ids:
        async for mv in db.stock_movements.find({"order_id": {"$in": order_ids}, "type": "sale"}, {"_id": 0, "order_id": 1, "product_id": 1, "total_cost": 1}):
            key = (mv["order_id"], mv["product_id"])
            cost_map[key] = cost_map.get(key, 0) + (mv.get("total_cost") or 0)
    pids = list({i.get("product_id") for o in orders for i in o.get("items", [])})
    fallback = {p["id"]: p.get("purchase_price") or 0 for p in await db.products.find({"id": {"$in": pids}}, {"_id": 0, "id": 1, "purchase_price": 1}).to_list(len(pids) or 1)}

    revenue = cost = 0.0
    by_client, by_product, order_rows = {}, {}, []
    for o in orders:
        items = o.get("items", [])
        raw = sum((i.get("price") or 0) * (i.get("quantity") or 0) for i in items)
        delivery = 0 if o.get("delivery_points_used") else (o.get("delivery_fee") or 0)
        goods = max(0.0, (o.get("total") or 0) - delivery)
        k = goods / raw if raw > 0 else 0
        o_cost, lines = 0.0, []
        for i in items:
            qty = i.get("quantity") or 0
            line_rev = (i.get("price") or 0) * qty * k
            line_cost = cost_map.get((o["id"], i.get("product_id")))
            if line_cost is None:
                line_cost = fallback.get(i.get("product_id"), 0) * qty
            o_cost += line_cost
            bp = by_product.setdefault(i.get("product_id"), {"product_id": i.get("product_id"), "name": i.get("name"), "article": i.get("article"), "quantity": 0, "revenue": 0.0, "profit": 0.0})
            bp["quantity"] += qty
            bp["revenue"] += line_rev
            bp["profit"] += line_rev - line_cost
            lines.append({"name": i.get("name"), "article": i.get("article"), "quantity": qty, "revenue": round(line_rev, 2), "profit": round(line_rev - line_cost, 2)})
        revenue += goods
        cost += o_cost
        bc = by_client.setdefault(o["user_id"], {"user_id": o["user_id"], "name": o.get("full_name") or "", "orders": 0, "revenue": 0.0, "profit": 0.0})
        bc["orders"] += 1
        bc["revenue"] += goods
        bc["profit"] += goods - o_cost
        order_rows.append({"id": o["id"], "created_at": o.get("created_at"), "status": o.get("status"), "user_id": o["user_id"],
                           "revenue": round(goods, 2), "profit": round(goods - o_cost, 2), "items": lines})

    sc = await get_status_conditions()
    pct = manager.get("commission_percent")
    individual = pct is not None
    if not individual:
        pct = sc["manager"]["commission_percent"]
    profit = revenue - cost
    result = {
        "period": period, "orders_count": len(orders), "clients_count": len(by_client),
        "revenue": round(revenue, 2), "cost": round(cost, 2), "profit": round(profit, 2),
        "commission_percent": pct, "commission_individual": individual, "commission": round(max(0.0, profit) * pct / 100, 2),
    }
    if detailed:
        names = {u["id"]: u for u in await db.users.find({"id": {"$in": list(by_client)}}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(len(by_client) or 1)}
        for c in by_client.values():
            u = names.get(c["user_id"], {})
            c["name"], c["email"] = u.get("name") or c["name"], u.get("email", "")
            c["revenue"], c["profit"] = round(c["revenue"], 2), round(c["profit"], 2)
        for p in by_product.values():
            p["revenue"], p["profit"] = round(p["revenue"], 2), round(p["profit"], 2)
        for r in order_rows:
            r["client_name"] = by_client[r["user_id"]]["name"]
        result["by_client"] = sorted(by_client.values(), key=lambda x: -x["revenue"])
        result["by_product"] = sorted(by_product.values(), key=lambda x: -x["revenue"])
        result["orders"] = order_rows[:500]
    return result


# ==================== STAFF CRUD (admin) ====================

class ManagerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=72)
    phone: str = Field(default="", max_length=40)
    position: str = Field(default="", max_length=120)
    note: str = Field(default="", max_length=500)
    commission_percent: Optional[float] = Field(default=None, ge=0, le=100)  # None = standard from site settings


class ManagerUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=120)
    password: Optional[str] = Field(default=None, max_length=72)  # empty = keep current
    phone: str = Field(default="", max_length=40)
    position: str = Field(default="", max_length=120)
    note: str = Field(default="", max_length=500)
    commission_percent: Optional[float] = Field(default=None, ge=0, le=100)
    blocked: bool = False


def _public_manager(m):
    return {k: m.get(k) for k in ("id", "name", "email", "phone", "position", "note", "commission_percent", "blocked", "created_at")}


async def _get_manager(manager_id: str):
    m = await db.users.find_one({"id": manager_id, "role": "manager", "deleted_at": None}, {"_id": 0, "password": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Менеджер не найден")
    return m


def _clean_email(email: str) -> str:
    email = email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Некорректный email")
    return email


@router.get("/admin/staff")
async def list_staff(period: str = "month", user=Depends(get_current_user)):
    _admin(user)
    managers = await db.users.find({"role": "manager", "deleted_at": None}, {"_id": 0, "password": 0}).sort("created_at", 1).to_list(500)
    out = []
    for m in managers:
        row = _public_manager(m)
        row["clients_total"] = await db.users.count_documents({"manager_id": m["id"], "role": "user"})
        row["stats"] = await _manager_stats(m, period, detailed=False)
        out.append(row)
    return out


@router.post("/admin/staff")
async def create_manager(data: ManagerCreate, user=Depends(get_current_user)):
    _admin(user)
    email = _clean_email(data.email)
    if await db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}):
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    doc = {
        "id": str(uuid.uuid4()), "email": email, "password": hash_password(data.password), "name": data.name.strip(),
        "phone": data.phone.strip(), "position": data.position.strip(), "note": data.note.strip(),
        "commission_percent": data.commission_percent, "role": "manager", "blocked": False, "deleted_at": None, "created_at": _now(),
    }
    await db.users.insert_one(dict(doc))
    return _public_manager(doc)


@router.put("/admin/staff/{manager_id}")
async def update_manager(manager_id: str, data: ManagerUpdate, user=Depends(get_current_user)):
    _admin(user)
    await _get_manager(manager_id)
    email = _clean_email(data.email)
    if await db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}, "id": {"$ne": manager_id}}):
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    upd = {"name": data.name.strip(), "email": email, "phone": data.phone.strip(), "position": data.position.strip(),
           "note": data.note.strip(), "commission_percent": data.commission_percent, "blocked": data.blocked}
    if data.password:
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail="Пароль должен быть не короче 6 символов")
        upd["password"] = hash_password(data.password)
    await db.users.update_one({"id": manager_id}, {"$set": upd})
    return _public_manager(await _get_manager(manager_id))


@router.delete("/admin/staff/{manager_id}")
async def delete_manager(manager_id: str, user=Depends(get_current_user)):
    """Soft delete: the account can no longer sign in, clients are unbound, sales history stays."""
    _admin(user)
    m = await _get_manager(manager_id)
    await db.users.update_one({"id": manager_id}, {"$set": {
        "deleted_at": _now(), "blocked": True, "email": f"deleted-{manager_id[:8]}-{m['email']}",
    }})
    await db.users.update_many({"manager_id": manager_id}, {"$set": {"manager_id": None}})
    return {"success": True}


@router.get("/admin/staff/{manager_id}/stats")
async def staff_stats(manager_id: str, period: str = "month", user=Depends(get_current_user)):
    _admin(user)
    return await _manager_stats(await _get_manager(manager_id), period)


# ---- binding clients ----

CLIENT_FIELDS = {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "customer_status": 1, "manager_id": 1,
                 "individual_discount": 1, "delivery_cost": 1, "deferral_days": 1, "credit_limit": 1, "credit_status": 1, "credit_term_days": 1}


class BindIn(BaseModel):
    user_id: str
    include_past_orders: bool = False


@router.get("/admin/staff-clients")
async def all_clients_for_binding(search: str = "", user=Depends(get_current_user)):
    _admin(user)
    q = {"role": "user"}
    if search.strip():
        rx = {"$regex": re.escape(search.strip()), "$options": "i"}
        q["$or"] = [{"name": rx}, {"email": rx}, {"phone": rx}]
    clients = await db.users.find(q, CLIENT_FIELDS).sort("name", 1).to_list(200)
    names = {m["id"]: m["name"] for m in await db.users.find({"role": "manager"}, {"_id": 0, "id": 1, "name": 1}).to_list(500)}
    for c in clients:
        c["manager_name"] = names.get(c.get("manager_id"))
    return clients


@router.get("/admin/staff/{manager_id}/clients")
async def manager_clients_admin(manager_id: str, user=Depends(get_current_user)):
    _admin(user)
    await _get_manager(manager_id)
    return await db.users.find({"manager_id": manager_id, "role": "user"}, CLIENT_FIELDS).sort("name", 1).to_list(2000)


@router.post("/admin/staff/{manager_id}/clients")
async def bind_client(manager_id: str, data: BindIn, user=Depends(get_current_user)):
    _admin(user)
    await _get_manager(manager_id)
    client = await db.users.find_one({"id": data.user_id, "role": "user"}, {"_id": 0, "id": 1})
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    await db.users.update_one({"id": data.user_id}, {"$set": {"manager_id": manager_id}})
    moved = 0
    if data.include_past_orders:
        res = await db.orders.update_many({"user_id": data.user_id, "manager_id": None}, {"$set": {"manager_id": manager_id}})
        moved = res.modified_count
    return {"success": True, "past_orders_added": moved}


@router.delete("/admin/staff/{manager_id}/clients/{user_id}")
async def unbind_client(manager_id: str, user_id: str, user=Depends(get_current_user)):
    _admin(user)
    res = await db.users.update_one({"id": user_id, "manager_id": manager_id}, {"$set": {"manager_id": None}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Клиент не привязан к этому менеджеру")
    return {"success": True}


# ==================== MANAGER CABINET ====================

async def _own_client(manager, user_id: str):
    c = await db.users.find_one({"id": user_id, "manager_id": manager["id"], "role": "user"}, CLIENT_FIELDS)
    if not c:
        raise HTTPException(status_code=404, detail="Клиент не найден среди ваших клиентов")
    return c


@router.get("/manager/overview")
async def manager_overview(period: str = "month", user=Depends(get_current_user)):
    _manager(user)
    return await _manager_stats(user, period)


@router.get("/manager/clients")
async def manager_clients(user=Depends(get_current_user)):
    _manager(user)
    sc = await get_status_conditions()
    clients = await db.users.find({"manager_id": user["id"], "role": "user"}, CLIENT_FIELDS).sort("name", 1).to_list(2000)
    for c in clients:
        c["effective"] = effective_conditions(c, sc)
    return clients


@router.put("/manager/clients/{user_id}/conditions")
async def manager_set_conditions(user_id: str, data: IndividualConditionsIn, user=Depends(get_current_user)):
    _manager(user)
    await _own_client(user, user_id)
    await _apply_individual_conditions(user_id, data, {"conditions_updated_by": user["id"], "conditions_updated_at": _now()})
    return {"success": True}


class ChatText(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@router.get("/manager/chats")
async def manager_chats(user=Depends(get_current_user)):
    _manager(user)
    ids = [c["id"] for c in await db.users.find({"manager_id": user["id"], "role": "user"}, {"_id": 0, "id": 1}).to_list(2000)]
    chats = await db.chats.find({"user_id": {"$in": ids}}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    for ch in chats:
        ch["unread"] = await db.chat_messages.count_documents({"chat_id": ch["id"], "sender_type": "user", "read": False})
        last = await db.chat_messages.find({"chat_id": ch["id"]}, {"_id": 0, "text": 1}).sort("created_at", -1).to_list(1)
        ch["last_text"] = (last[0].get("text") or "")[:120] if last else ""
    return chats


async def _own_chat(manager, chat_id: str):
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    await _own_client(manager, chat["user_id"])
    return chat


@router.get("/manager/chats/{chat_id}/messages")
async def manager_chat_messages(chat_id: str, user=Depends(get_current_user)):
    _manager(user)
    await _own_chat(user, chat_id)
    await db.chat_messages.update_many({"chat_id": chat_id, "sender_type": "user", "read": False}, {"$set": {"read": True}})
    return await db.chat_messages.find({"chat_id": chat_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)


@router.post("/manager/chats/{chat_id}/send")
async def manager_chat_send(chat_id: str, data: ChatText, user=Depends(get_current_user)):
    _manager(user)
    chat = await _own_chat(user, chat_id)
    msg = {
        "id": str(uuid.uuid4()), "chat_id": chat_id, "user_id": user["id"], "user_name": user["name"], "text": data.text.strip(),
        "sender_type": "admin", "sender_role": "manager", "message_type": "text", "created_at": _now(), "read": False, "edited": False,
    }
    await db.chat_messages.insert_one(dict(msg))
    await db.chats.update_one({"id": chat_id}, {"$set": {"updated_at": _now()}})
    await notify_user(chat["user_id"], "chat", "Ответ менеджера", data.text[:80], "/chat")
    return {"id": msg["id"]}
