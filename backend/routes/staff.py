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
    pending = await db.conditions_requests.find_one({"user_id": user["id"], "status": "pending", "manager_id": None}, {"_id": 0})
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
        raise HTTPException(status_code=400, detail="Запрос на индивидуальные условия уже на рассмотрении")
    doc = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user.get("name", ""), "user_email": user.get("email", ""),
        "current_status": user.get("customer_status", "retail"),
        "discount": data.discount, "deferral_days": data.deferral_days, "credit_limit": data.credit_limit,
        "comment": data.comment.strip(), "status": "pending", "manager_id": None, "created_at": _now(),
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
    by_manager = bool(req.get("manager_id"))
    if data.action == "approve":
        # a client's own approved request makes him a wholesale client; a manager's request only changes conditions
        await _apply_individual_conditions(req["user_id"], data, {} if by_manager else {"customer_status": "wholesale"})
        upd["approved"] = {"individual_discount": data.individual_discount, "delivery_cost": data.delivery_cost,
                           "deferral_days": data.deferral_days, "credit_limit": data.credit_limit}
    await db.conditions_requests.update_one({"id": request_id}, {"$set": upd})
    if by_manager:
        verdict = "одобрен" if data.action == "approve" else "отклонён"
        await notify_user(req["manager_id"], "conditions", "Запрос условий для клиента", f"{req.get('user_name', '')}: запрос {verdict}", "/manager")
        if data.action == "approve":
            await notify_user(req["user_id"], "conditions", "Индивидуальные условия", "Вам установлены новые индивидуальные условия", "/account")
    else:
        text = "Запрос одобрен: вам присвоен статус оптового клиента" if data.action == "approve" else "Запрос на индивидуальные условия отклонён"
        await notify_user(req["user_id"], "conditions", "Индивидуальные условия", text, "/account")
    return {"success": True}


# ==================== STATISTICS ====================

async def _cost_maps(orders):
    """Real purchase cost per (order, product) from stock movements + purchase-price fallback per product."""
    order_ids = [o["id"] for o in orders]
    cost_map = {}
    if order_ids:
        async for mv in db.stock_movements.find({"order_id": {"$in": order_ids}, "type": "sale"}, {"_id": 0, "order_id": 1, "product_id": 1, "total_cost": 1}):
            key = (mv["order_id"], mv["product_id"])
            cost_map[key] = cost_map.get(key, 0) + (mv.get("total_cost") or 0)
    pids = list({i.get("product_id") for o in orders for i in o.get("items", [])})
    fallback = {p["id"]: p.get("purchase_price") or 0 for p in await db.products.find({"id": {"$in": pids}}, {"_id": 0, "id": 1, "purchase_price": 1}).to_list(len(pids) or 1)}
    return cost_map, fallback


async def _manager_stats(manager: dict, period: str, detailed: bool = True, client_id: Optional[str] = None):
    if period not in PERIOD_DAYS and period != "all":
        raise HTTPException(status_code=400, detail="Неизвестный период")
    query = {"manager_id": manager["id"], "status": {"$ne": "cancelled"}}
    if client_id:
        query["user_id"] = client_id
    if period != "all":
        query["created_at"] = {"$gte": (datetime.now(timezone.utc) - timedelta(days=PERIOD_DAYS[period])).isoformat()}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    cost_map, fallback = await _cost_maps(orders)
    sc = await get_status_conditions()
    pct = manager.get("commission_percent")
    individual = pct is not None
    if not individual:
        pct = sc["manager"]["commission_percent"]

    revenue = cost = commission = 0.0
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
        # the percent saved in the order at purchase time; older orders without it use the current one
        o_pct = o.get("manager_commission_percent")
        commission += (goods - o_cost) * (pct if o_pct is None else o_pct) / 100
        bc = by_client.setdefault(o["user_id"], {"user_id": o["user_id"], "name": o.get("full_name") or "", "orders": 0, "revenue": 0.0, "profit": 0.0})
        bc["orders"] += 1
        bc["revenue"] += goods
        bc["profit"] += goods - o_cost
        order_rows.append({"id": o["id"], "created_at": o.get("created_at"), "status": o.get("status"), "user_id": o["user_id"],
                           "revenue": round(goods, 2), "profit": round(goods - o_cost, 2), "items": lines})

    profit = revenue - cost
    result = {
        "period": period, "orders_count": len(orders), "clients_count": len(by_client),
        "revenue": round(revenue, 2), "cost": round(cost, 2), "profit": round(profit, 2),
        "commission_percent": pct, "commission_individual": individual, "commission": round(max(0.0, commission), 2),
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
        row["payouts"] = await _payout_summary(m, with_list=False)
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


# ---- payouts ----

class PayoutIn(BaseModel):
    amount: float = Field(gt=0, le=100_000_000)
    paid_at: Optional[str] = None  # YYYY-MM-DD, default today
    comment: str = Field(default="", max_length=300)


async def _payout_summary(manager: dict, with_list: bool = True):
    earned = (await _manager_stats(manager, "all", detailed=False))["commission"]
    payouts = await db.manager_payouts.find({"manager_id": manager["id"], "cancelled_at": None}, {"_id": 0}).sort("paid_at", -1).to_list(2000)
    paid = round(sum(p["amount"] for p in payouts), 2)
    out = {"earned": earned, "paid": paid, "balance": round(earned - paid, 2)}
    if with_list:
        out["payouts"] = payouts
    return out


@router.get("/admin/staff/{manager_id}/payouts")
async def staff_payouts(manager_id: str, user=Depends(get_current_user)):
    _admin(user)
    return await _payout_summary(await _get_manager(manager_id))


@router.post("/admin/staff/{manager_id}/payouts")
async def add_payout(manager_id: str, data: PayoutIn, user=Depends(get_current_user)):
    _admin(user)
    balance = (await _payout_summary(await _get_manager(manager_id), with_list=False))["balance"]
    if data.amount > balance + 0.005:
        raise HTTPException(status_code=400, detail=f"Выплата больше остатка к выплате ({max(0.0, balance):.2f} ₽)")
    paid_at = (data.paid_at or _now())[:10]
    try:
        datetime.fromisoformat(paid_at)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверная дата выплаты")
    doc = {"id": str(uuid.uuid4()), "manager_id": manager_id, "amount": round(data.amount, 2), "paid_at": paid_at,
           "comment": data.comment.strip(), "cancelled_at": None, "created_at": _now(), "created_by": user.get("name", "")}
    await db.manager_payouts.insert_one(dict(doc))
    return doc


@router.delete("/admin/staff/{manager_id}/payouts/{payout_id}")
async def cancel_payout(manager_id: str, payout_id: str, user=Depends(get_current_user)):
    _admin(user)
    res = await db.manager_payouts.update_one({"id": payout_id, "manager_id": manager_id, "cancelled_at": None}, {"$set": {"cancelled_at": _now()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Выплата не найдена")
    return {"success": True}


@router.get("/manager/payouts")
async def my_payouts(user=Depends(get_current_user)):
    _manager(user)
    return await _payout_summary(user)


# ---- monthly sales chart ----

@router.get("/admin/staff-chart")
async def staff_chart(months: int = 12, user=Depends(get_current_user)):
    """Goods revenue per manager per month (cancelled orders excluded)."""
    _admin(user)
    months = max(1, min(months, 36))
    now = datetime.now(timezone.utc)
    keys, y, m = [], now.year, now.month
    for _ in range(months):
        keys.append(f"{y:04d}-{m:02d}")
        y, m = (y - 1, 12) if m == 1 else (y, m - 1)
    keys.reverse()
    managers = await db.users.find({"role": "manager", "deleted_at": None}, {"_id": 0, "id": 1, "name": 1}).sort("created_at", 1).to_list(500)
    ids = [mg["id"] for mg in managers]
    rows = {k: {"month": k, **{i: 0.0 for i in ids}} for k in keys}
    profit_rows = {k: {"month": k, **{i: 0.0 for i in ids}} for k in keys}
    orders = await db.orders.find(
        {"manager_id": {"$in": ids}, "status": {"$ne": "cancelled"}, "created_at": {"$gte": f"{keys[0]}-01"}},
        {"_id": 0, "id": 1, "manager_id": 1, "created_at": 1, "total": 1, "delivery_fee": 1, "delivery_points_used": 1,
         "items.product_id": 1, "items.quantity": 1},
    ).to_list(20000)
    cost_map, fallback = await _cost_maps(orders)
    for o in orders:
        key = str(o.get("created_at"))[:7]
        if key not in rows:
            continue
        delivery = 0 if o.get("delivery_points_used") else (o.get("delivery_fee") or 0)
        goods = max(0.0, (o.get("total") or 0) - delivery)
        o_cost = 0.0
        for i in o.get("items", []):
            line = cost_map.get((o["id"], i.get("product_id")))
            o_cost += line if line is not None else fallback.get(i.get("product_id"), 0) * (i.get("quantity") or 0)
        rows[key][o["manager_id"]] += goods
        profit_rows[key][o["manager_id"]] += goods - o_cost

    def _rounded(src):
        return [{k: (round(v, 2) if k != "month" else v) for k, v in r.items()} for r in src.values()]
    return {"managers": managers, "data": _rounded(rows), "profit": _rounded(profit_rows)}


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
    pending = {r["user_id"]: r for r in await db.conditions_requests.find(
        {"user_id": {"$in": [c["id"] for c in clients]}, "status": "pending"}, {"_id": 0}).to_list(2000)}
    for c in clients:
        c["effective"] = effective_conditions(c, sc)
        c["pending_request"] = pending.get(c["id"])
    return clients


class ManagerConditionsRequestIn(IndividualConditionsIn):
    comment: str = Field(default="", max_length=1000)


@router.post("/manager/clients/{user_id}/conditions-request")
async def manager_request_conditions(user_id: str, data: ManagerConditionsRequestIn, user=Depends(get_current_user)):
    """A manager cannot change client conditions himself — he asks the admin, who approves or rejects."""
    _manager(user)
    client = await _own_client(user, user_id)
    if await db.conditions_requests.find_one({"user_id": user_id, "status": "pending"}):
        raise HTTPException(status_code=400, detail="По этому клиенту уже есть запрос на рассмотрении")
    doc = {
        "id": str(uuid.uuid4()), "user_id": user_id, "user_name": client.get("name", ""), "user_email": client.get("email", ""),
        "current_status": client.get("customer_status", "retail"),
        "discount": data.individual_discount, "delivery_cost": data.delivery_cost,
        "deferral_days": data.deferral_days, "credit_limit": data.credit_limit,
        "comment": data.comment.strip(), "status": "pending",
        "manager_id": user["id"], "manager_name": user.get("name", ""), "created_at": _now(),
    }
    await db.conditions_requests.insert_one(dict(doc))
    await notify_admin("conditions_request", "Запрос условий от менеджера", f"{doc['manager_name']} → {doc['user_name']}", "/admin/staff")
    return doc


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


# ==================== MANAGER SALES PANEL: client stats, orders, catalog, ordering for a client ====================

PRODUCT_PUBLIC = {"_id": 0, "id": 1, "name": 1, "article": 1, "manufacturer": 1, "price": 1, "stock": 1, "stock_regions": 1,
                  "image_url": 1, "cross_articles": 1, "discount_active": 1, "discount_type": 1, "discount_value": 1,
                  "discount_until": 1, "discount_tiers": 1, "is_markdown": 1, "markdown_comment": 1}


@router.get("/manager/clients/{user_id}/stats")
async def manager_client_stats(user_id: str, period: str = "all", user=Depends(get_current_user)):
    _manager(user)
    await _own_client(user, user_id)
    return await _manager_stats(user, period, client_id=user_id)


@router.get("/manager/orders")
async def manager_orders(user=Depends(get_current_user)):
    """Orders of the manager's current clients plus orders already counted for him."""
    _manager(user)
    clients = {c["id"]: c for c in await db.users.find({"manager_id": user["id"], "role": "user"}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(2000)}
    orders = await db.orders.find({"$or": [{"manager_id": user["id"]}, {"user_id": {"$in": list(clients)}}]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    from database import manager_commission_percent
    cost_map, fallback = await _cost_maps(orders)
    cur_pct = await manager_commission_percent(user["id"]) or 0
    for o in orders:
        items = o.get("items", [])
        counted = o.get("manager_id") == user["id"] and o.get("status") != "cancelled"
        raw = sum((i.get("price") or 0) * (i.get("quantity") or 0) for i in items)
        delivery = 0 if o.get("delivery_points_used") else (o.get("delivery_fee") or 0)
        k = max(0.0, (o.get("total") or 0) - delivery) / raw if raw > 0 else 0
        pct = o.get("manager_commission_percent")
        pct = cur_pct if pct is None else pct
        total = 0.0
        for i in items:
            qty = i.get("quantity") or 0
            cost = cost_map.get((o["id"], i.get("product_id")))
            if cost is None:
                cost = fallback.get(i.get("product_id"), 0) * qty
            i["_commission"] = round(((i.get("price") or 0) * qty * k - cost) * pct / 100, 2) if counted else None
            total += i["_commission"] or 0
        o["_commission"] = round(max(0.0, total), 2) if counted else None
    return [{
        "commission": o["_commission"],
        "id": o["id"], "created_at": o.get("created_at"), "status": o.get("status"), "total": o.get("total"), "paid": o.get("paid"),
        "payment_method": o.get("payment_method"), "client_name": (clients.get(o["user_id"]) or {}).get("name") or o.get("full_name"),
        "user_id": o["user_id"], "address": o.get("address"), "phone": o.get("phone"), "comment": o.get("comment"),
        "created_by_manager": bool(o.get("created_by_manager_id")),
        "items": [{"name": i.get("name"), "article": i.get("article"), "quantity": i.get("quantity"), "price": i.get("price"), "commission": i["_commission"]} for i in o.get("items", [])],
    } for o in orders]


@router.get("/manager/products")
async def manager_products(search: str = "", in_stock: bool = False, user=Depends(get_current_user)):
    """Catalog for managers: stock and selling prices, never purchase prices."""
    _manager(user)
    q = {}
    if search.strip():
        rx = {"$regex": re.escape(search.strip()), "$options": "i"}
        q["$or"] = [{"name": rx}, {"article": rx}, {"cross_articles": rx}, {"manufacturer": rx}]
    if in_stock:
        q["stock"] = {"$gt": 0}
    from database import manager_commission_percent
    pct = await manager_commission_percent(user["id"]) or 0
    products = await db.products.find(q, {**PRODUCT_PUBLIC, "purchase_price": 1}).sort("name", 1).to_list(300)
    for p in products:
        # manager's earning per unit at list price: his percent of (price - purchase cost)
        p["commission"] = round(max(0.0, (p.get("price") or 0) - (p.pop("purchase_price", 0) or 0)) * pct / 100, 2)
    return products


class ManagerOrderItem(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=100000)


class ManagerOrderIn(BaseModel):
    items: list[ManagerOrderItem] = Field(min_length=1, max_length=200)
    payment_method: str = "cash"  # cash | card | balance | deferral
    full_name: str = Field(default="", max_length=200)
    address: str = Field(min_length=1, max_length=500)
    phone: str = Field(min_length=3, max_length=40)
    comment: str = Field(default="", max_length=1000)


@router.post("/manager/clients/{user_id}/orders")
async def manager_create_order(user_id: str, data: ManagerOrderIn, user=Depends(get_current_user)):
    """Places an order on behalf of the manager's client, on the client's own conditions and limits."""
    _manager(user)
    await _own_client(user, user_id)
    if data.payment_method not in ("cash", "card", "balance", "deferral"):
        raise HTTPException(status_code=400, detail="Недоступный способ оплаты")
    from models import OrderCreate
    from routes.orders import create_order
    client = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    eff = effective_conditions(client, await get_status_conditions())
    client.update({"customer_status": eff["customer_status"], "individual_discount": eff["discount"], "delivery_cost": eff["delivery_cost"]})
    for it in data.items:
        p = await db.products.find_one({"id": it.product_id}, {"_id": 0, "name": 1, "stock": 1})
        if not p:
            raise HTTPException(status_code=404, detail="Товар не найден")
        if (p.get("stock") or 0) < it.quantity:
            raise HTTPException(status_code=400, detail=f"Недостаточно на складе: {p.get('name')}")
    payload = OrderCreate(
        full_name=data.full_name.strip() or client.get("name", ""), address=data.address.strip(), phone=data.phone.strip(),
        comment=data.comment.strip() or None, payment_method=data.payment_method,
        pay_with_balance=data.payment_method == "balance", pay_later=data.payment_method == "card",
    )
    # the client's own cart is kept aside while the manager's order is being placed
    saved = await db.carts.find_one({"user_id": user_id}, {"_id": 0, "items": 1})
    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": [i.model_dump() for i in data.items]}}, upsert=True)
    try:
        order = await create_order(payload, user=client)
    finally:
        await db.carts.update_one({"user_id": user_id}, {"$set": {"items": (saved or {}).get("items", [])}}, upsert=True)
    order_id = order["id"] if isinstance(order, dict) else order.id
    await db.orders.update_one({"id": order_id}, {"$set": {"created_by_manager_id": user["id"], "created_by_manager_name": user.get("name", "")}})
    await notify_user(user_id, "order", "Заказ оформлен менеджером", f"Менеджер {user.get('name', '')} оформил для вас заказ #{order_id[:8]}", "/orders")
    saved_order = await db.orders.find_one({"id": order_id}, {"_id": 0, "id": 1, "total": 1, "status": 1, "payment_method": 1})
    return saved_order
