"""Reward systems: bonus points, Ozon certificates, cashback — settings, accrual, client choice"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from database import db, get_current_user
from notify import notify_user

router = APIRouter(tags=["rewards"])

SYSTEMS = ("points", "ozon", "cashback")
SYSTEM_TITLES = {"points": "Бонусные баллы", "ozon": "Сертификаты Ozon", "cashback": "Кэшбэк"}
SETTINGS_KEY = "reward_settings"

_COMMON = {"enabled": True, "min_order": 0, "tiers": [], "exclude_discounted": False, "rules": []}
DEFAULTS = {
    "points": {**_COMMON, "retail_percent": 100, "wholesale_percent": 100},
    "ozon": {**_COMMON, "retail_percent": 5, "wholesale_percent": 5, "round_to": 500},
    "cashback": {**_COMMON, "retail_percent": 3, "wholesale_percent": 3, "allow_pay": True,
                 "max_pay_percent": 100, "allow_withdraw": True, "min_withdraw": 500},
}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _num(v, default=0.0, lo=0.0, hi=None):
    try:
        v = float(v)
    except (TypeError, ValueError):
        v = default
    v = max(lo, v)
    return min(hi, v) if hi is not None else v


def _clean_system(key: str, raw: dict) -> dict:
    d = DEFAULTS[key]
    raw = raw or {}
    out = {
        "enabled": bool(raw.get("enabled", d["enabled"])),
        "retail_percent": _num(raw.get("retail_percent"), d["retail_percent"], 0, 1000),
        "wholesale_percent": _num(raw.get("wholesale_percent"), d["wholesale_percent"], 0, 1000),
        "min_order": _num(raw.get("min_order"), 0),
        "exclude_discounted": bool(raw.get("exclude_discounted", False)),
        "tiers": [],
        "rules": [],
    }
    for t in raw.get("tiers") or []:
        frm = _num(t.get("from"), 0)
        if frm <= 0:
            continue
        out["tiers"].append({
            "from": frm,
            "retail_percent": _num(t.get("retail_percent"), 0, 0, 1000),
            "wholesale_percent": _num(t.get("wholesale_percent"), 0, 0, 1000),
        })
    out["tiers"].sort(key=lambda t: t["from"])
    for r in raw.get("rules") or []:
        if r.get("type") not in ("product", "category", "warehouse", "manufacturer") or not r.get("target_id"):
            continue
        out["rules"].append({
            "id": r.get("id") or str(uuid.uuid4()),
            "type": r["type"],
            "target_id": str(r["target_id"]),
            "target_name": str(r.get("target_name") or ""),
            "percent": _num(r.get("percent"), 0, 0, 1000),
        })
    if key == "ozon":
        out["round_to"] = max(1, int(_num(raw.get("round_to"), d["round_to"], 1)))
    if key == "cashback":
        out["allow_pay"] = bool(raw.get("allow_pay", True))
        out["max_pay_percent"] = _num(raw.get("max_pay_percent"), 100, 0, 100)
        out["allow_withdraw"] = bool(raw.get("allow_withdraw", True))
        out["min_withdraw"] = _num(raw.get("min_withdraw"), 500)
    return out


async def get_reward_settings() -> dict:
    doc = await db.settings.find_one({"key": SETTINGS_KEY}, {"_id": 0})
    if doc:
        value = doc.get("value") or {}
        return {k: _clean_system(k, value.get(k)) for k in SYSTEMS}
    # First run: derive Ozon rate from the legacy "N ₽ per step" settings
    legacy = ((await db.settings.find_one({"key": "ozon_certificate_settings"}, {"_id": 0})) or {}).get("value") or {}
    step = max(1, int(legacy.get("ozon_step", 10000) or 10000))
    reward = max(0, int(legacy.get("ozon_reward", 500) or 500))
    pct = round(reward / step * 100, 2)
    ozon = {"enabled": bool(legacy.get("ozon_enabled", True)), "retail_percent": pct,
            "wholesale_percent": pct, "round_to": max(1, reward)}
    return {"points": _clean_system("points", {}), "ozon": _clean_system("ozon", ozon), "cashback": _clean_system("cashback", {})}


def active_system(user: dict, settings: dict):
    system = user.get("reward_system")
    if system in SYSTEMS and settings[system]["enabled"]:
        return system
    return None


def _base_rate(cfg: dict, status: str, goods_total: float) -> float:
    key = "wholesale_percent" if status == "wholesale" else "retail_percent"
    base = cfg[key]
    for t in cfg["tiers"]:
        if goods_total >= t["from"]:
            base = t[key]
    return base


def _item_rate(cfg: dict, base: float, item: dict, product: dict, has_promo_code: bool) -> float:
    product = product or {}
    if product.get("bonus_eligible", True) is False:
        return 0.0
    if cfg["exclude_discounted"] and (
        has_promo_code or item.get("promo_active") or item.get("has_individual_price")
        or (item.get("cart_discount_percent") or 0) > 0
    ):
        return 0.0
    brand = (product.get("manufacturer") or "").strip().lower()
    for r in cfg["rules"]:
        # a brand rate (lower or higher) overrides the base rate and every other rule
        if r["type"] == "manufacturer" and brand and r["target_id"].strip().lower() == brand:
            return r["percent"]
    warehouses = {k for k, v in (product.get("warehouse_stock") or {}).items() if (v or 0) > 0}
    rate = base
    for r in cfg["rules"]:
        t, target = r["type"], r["target_id"]
        if (t == "product" and target == item.get("product_id")) \
                or (t == "category" and target == product.get("category_id")) \
                or (t == "warehouse" and target in warehouses):
            rate = min(rate, r["percent"])
    return rate


async def _finalize(system: str, user_id: str, weighted: float, round_to: int = 1):
    if weighted <= 0:
        return 0
    if system == "points":
        from routes.bonus import calc_points_for_eligible
        return await calc_points_for_eligible(user_id, weighted)
    if system == "ozon":
        return int(weighted // round_to) * round_to
    return round(weighted, 2)


async def compute_order_reward(user: dict, items: list, goods_total: float, promo_code=None) -> dict:
    """Expected reward for an order in the client's chosen system (no side effects)."""
    settings = await get_reward_settings()
    system = active_system(user, settings)
    result = {"system": system, "amount": 0, "rates": {}, "scale": 1, "round_to": 1}
    if not system or not items:
        return result
    cfg = settings[system]
    lines_sum = sum((i.get("price", 0) or 0) * (i.get("quantity", 0) or 0) for i in items)
    scale = (goods_total / lines_sum) if lines_sum > 0 else 1
    pids = [i.get("product_id") for i in items]
    products = await db.products.find(
        {"id": {"$in": pids}}, {"_id": 0, "id": 1, "category_id": 1, "warehouse_stock": 1, "bonus_eligible": 1, "manufacturer": 1}
    ).to_list(1000)
    pmap = {p["id"]: p for p in products}
    base = _base_rate(cfg, user.get("customer_status", "retail"), goods_total)
    below_min = goods_total < cfg["min_order"]
    weighted = 0.0
    for it in items:
        rate = 0.0 if below_min else _item_rate(cfg, base, it, pmap.get(it.get("product_id")), bool(promo_code))
        result["rates"][it.get("product_id")] = rate
        weighted += (it.get("price", 0) or 0) * (it.get("quantity", 0) or 0) * scale * rate / 100
    result["scale"] = round(scale, 6)
    result["round_to"] = cfg.get("round_to", 1)
    result["base_percent"] = base
    result["amount"] = await _finalize(system, user["id"], weighted, result["round_to"])
    return result


async def adjust_cashback(user_id: str, amount: float, tx_type: str, description: str, order_id: str = None):
    amount = round(amount, 2)
    if amount == 0:
        return
    await db.users.update_one({"id": user_id}, {"$inc": {"cashback_balance": amount}})
    await db.cashback_transactions.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "amount": amount, "type": tx_type,
        "description": description, "order_id": order_id, "created_at": _now(),
    })


async def accrue_order_reward(order: dict):
    """Idempotently accrue the reward for the delivered part of an order."""
    system = order.get("reward_system")
    if system not in SYSTEMS:
        return 0
    rates = order.get("reward_rates") or {}
    scale = order.get("reward_scale", 1) or 1
    weighted = 0.0
    for it in order.get("items", []):
        dq = int(it.get("quantity_fulfilled", it.get("quantity", 0)) or 0)
        weighted += (it.get("price", 0) or 0) * dq * scale * (rates.get(it.get("product_id"), 0) or 0) / 100
    weighted = round(weighted, 2)
    already = order.get("reward_accrued_base", 0) or 0
    delta = round(weighted - already, 2)
    if delta <= 0:
        return 0
    user_id, oid = order.get("user_id"), order["id"]
    update = {"reward_accrued_base": weighted}
    if system == "points":
        from routes.bonus import _accrue_points
        accrued = await _accrue_points(user_id, delta)
    elif system == "cashback":
        accrued = delta
        await adjust_cashback(user_id, delta, "accrual", f"Кэшбэк за заказ #{oid[:8]}", oid)
        update["reward_accrued"] = round((order.get("reward_accrued", 0) or 0) + delta, 2)
        await notify_user(user_id, "bonus", "Начислен кэшбэк", f"Вам начислен кэшбэк {delta:.2f} ₽ за заказ #{oid[:8]}", "/bonus")
    else:
        round_to = max(1, int(order.get("reward_round_to", 1) or 1))
        cert = int(weighted // round_to) * round_to
        accrued = cert - (order.get("ozon_certificate", 0) or 0)
        if accrued > 0:
            update["ozon_certificate"] = cert
            update["reward_accrued"] = cert
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()), "user_id": "ADMIN", "type": "ozon_certificate",
                "title": "Выдать сертификат Ozon",
                "message": f"По заказу #{oid[:8]} нужно выдать сертификат Ozon на {cert} ₽",
                "link": "/admin/orders", "read": False, "created_at": _now(),
            })
            await notify_user(user_id, "bonus", "Сертификат Ozon", f"За заказ #{oid[:8]} вам положен сертификат Ozon на {cert} ₽. Менеджер свяжется с вами.", "/bonus")
    await db.orders.update_one({"id": oid}, {"$set": update})
    return accrued


async def cashback_spend_limit(user: dict, goods_total: float, requested: float) -> float:
    """How much cashback may be applied to this order (0 when unavailable)."""
    settings = await get_reward_settings()
    cfg = settings["cashback"]
    if requested <= 0 or active_system(user, settings) != "cashback" or not cfg["allow_pay"]:
        return 0.0
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "cashback_balance": 1}) or {}
    balance = fresh.get("cashback_balance", 0) or 0
    return round(max(0.0, min(requested, balance, goods_total * cfg["max_pay_percent"] / 100)), 2)


async def refund_order_cashback(order: dict):
    """Return cashback spent on a cancelled order (once)."""
    used = order.get("cashback_used", 0) or 0
    if used <= 0:
        return
    res = await db.orders.update_one(
        {"id": order["id"], "cashback_refunded": {"$ne": True}}, {"$set": {"cashback_refunded": True}}
    )
    if res.modified_count:
        await adjust_cashback(order["user_id"], used, "refund", f"Возврат кэшбэка за отменённый заказ #{order['id'][:8]}", order["id"])


async def deduct_return_cashback(ret: dict):
    """On an approved return, take back the cashback accrued for the returned items."""
    order = await db.orders.find_one({"id": ret.get("order_id")}, {"_id": 0})
    if not order or order.get("reward_system") != "cashback":
        return 0
    rates = order.get("reward_rates") or {}
    scale = order.get("reward_scale", 1) or 1
    amount = sum(
        (i.get("price", 0) or 0) * (i.get("quantity", 0) or 0) * scale * (rates.get(i.get("product_id"), 0) or 0) / 100
        for i in ret.get("items", [])
    )
    amount = round(min(amount, order.get("reward_accrued", 0) or 0), 2)
    if amount > 0:
        await adjust_cashback(ret["user_id"], -amount, "return", f"Списание кэшбэка за возврат по заказу #{order['id'][:8]}", order["id"])
    return amount


# ==================== CLIENT ROUTES ====================

def _public_option(key: str, cfg: dict, status: str) -> dict:
    pkey = "wholesale_percent" if status == "wholesale" else "retail_percent"
    opt = {
        "key": key, "title": SYSTEM_TITLES[key], "percent": cfg[pkey], "min_order": cfg["min_order"],
        "tiers": [{"from": t["from"], "percent": t[pkey]} for t in cfg["tiers"]],
        "exclude_discounted": cfg["exclude_discounted"],
    }
    if key == "cashback":
        opt.update({k: cfg[k] for k in ("allow_pay", "max_pay_percent", "allow_withdraw", "min_withdraw")})
    return opt


@router.get("/rewards/me")
async def my_rewards(user=Depends(get_current_user)):
    settings = await get_reward_settings()
    status = user.get("customer_status", "retail")
    chosen = user.get("reward_system") if user.get("reward_system") in SYSTEMS else None
    system = active_system(user, settings)
    out = {
        "chosen": chosen,
        "system": system,
        "options": [_public_option(k, settings[k], status) for k in SYSTEMS if settings[k]["enabled"]],
        "config": _public_option(system, settings[system], status) if system else None,
    }
    if system == "cashback":
        out["cashback_balance"] = round(user.get("cashback_balance", 0) or 0, 2)
        out["transactions"] = await db.cashback_transactions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
        out["withdrawals"] = await db.cashback_withdrawals.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    if system == "ozon":
        orders = await db.orders.find(
            {"user_id": user["id"], "ozon_certificate": {"$gt": 0}},
            {"_id": 0, "id": 1, "created_at": 1, "total": 1, "ozon_certificate": 1, "ozon_certificate_issued": 1},
        ).sort("created_at", -1).to_list(200)
        out["certificates"] = orders
        out["certificates_issued"] = sum(o["ozon_certificate"] for o in orders if o.get("ozon_certificate_issued"))
        out["certificates_pending"] = sum(o["ozon_certificate"] for o in orders if not o.get("ozon_certificate_issued"))
    return out


@router.post("/rewards/choose")
async def choose_reward_system(data: dict, user=Depends(get_current_user)):
    system = data.get("system")
    settings = await get_reward_settings()
    if system not in SYSTEMS or not settings[system]["enabled"]:
        raise HTTPException(status_code=400, detail="Эта бонусная система недоступна")
    if user.get("reward_system") in SYSTEMS:
        raise HTTPException(status_code=400, detail="Бонусная система уже выбрана. Для смены обратитесь к менеджеру.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"reward_system": system, "reward_system_chosen_at": _now()}})
    return {"success": True, "system": system}


@router.get("/rewards/cart-preview")
async def reward_cart_preview(amount: float = None, promo_code: str = None, user=Depends(get_current_user)):
    """Expected reward for the current cart in the client's system. `amount` = goods total actually charged."""
    from routes.orders import _build_cart
    settings = await get_reward_settings()
    system = active_system(user, settings)
    base = {"system": system, "amount": 0, "total_points": 0, "programs": [],
            "needs_choice": user.get("reward_system") not in SYSTEMS and any(settings[k]["enabled"] for k in SYSTEMS)}
    if not system:
        return base
    cart = await _build_cart(user)
    items = cart.get("items", [])
    if not items:
        return base
    lines_sum = sum((i.get("price", 0) or 0) * (i.get("quantity", 0) or 0) for i in items)
    goods_total = amount if (amount is not None and amount > 0) else lines_sum
    r = await compute_order_reward(user, items, goods_total, promo_code)
    base.update({"amount": r["amount"], "base_percent": r.get("base_percent"),
                 "min_order": settings[system]["min_order"],
                 "total_points": int(r["amount"]) if system == "points" else 0})
    return base


@router.post("/rewards/cashback/withdraw")
async def request_cashback_withdrawal(data: dict, user=Depends(get_current_user)):
    settings = await get_reward_settings()
    cfg = settings["cashback"]
    if active_system(user, settings) != "cashback" or not cfg["allow_withdraw"]:
        raise HTTPException(status_code=403, detail="Вывод кэшбэка недоступен")
    amount = round(_num(data.get("amount"), 0), 2)
    details = str(data.get("details") or "").strip()
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Укажите сумму")
    if amount < cfg["min_withdraw"]:
        raise HTTPException(status_code=400, detail=f"Минимальная сумма вывода: {cfg['min_withdraw']:.0f} ₽")
    if not details:
        raise HTTPException(status_code=400, detail="Укажите реквизиты для выплаты")
    res = await db.users.update_one(
        {"id": user["id"], "cashback_balance": {"$gte": amount}}, {"$inc": {"cashback_balance": -amount}}
    )
    if not res.modified_count:
        raise HTTPException(status_code=400, detail="Недостаточно кэшбэка на счёте")
    wid = str(uuid.uuid4())
    await db.cashback_transactions.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "amount": -amount, "type": "withdraw",
        "description": "Заявка на вывод кэшбэка", "withdrawal_id": wid, "created_at": _now(),
    })
    await db.cashback_withdrawals.insert_one({
        "id": wid, "user_id": user["id"], "user_name": user.get("name", ""), "user_email": user.get("email", ""),
        "amount": amount, "details": details, "status": "pending", "created_at": _now(),
    })
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": "ADMIN", "type": "cashback_withdrawal", "title": "Заявка на вывод кэшбэка",
        "message": f"Клиент {user.get('name') or user.get('email')} запросил вывод {amount:.2f} ₽",
        "link": "/admin", "read": False, "created_at": _now(),
    })
    return {"success": True, "id": wid}


# ==================== ADMIN ROUTES ====================

def _admin(user):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/admin/rewards/settings")
async def admin_get_reward_settings(user=Depends(get_current_user)):
    _admin(user)
    return await get_reward_settings()


@router.put("/admin/rewards/settings")
async def admin_update_reward_settings(data: dict, user=Depends(get_current_user)):
    _admin(user)
    value = {k: _clean_system(k, data.get(k)) for k in SYSTEMS}
    await db.settings.update_one({"key": SETTINGS_KEY}, {"$set": {"key": SETTINGS_KEY, "value": value}}, upsert=True)
    return value


@router.get("/admin/rewards/users")
async def admin_reward_users(search: str = "", user=Depends(get_current_user)):
    _admin(user)
    query = {"role": {"$nin": ["admin", "manager"]}}
    if search:
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}]
    users = await db.users.find(
        query, {"_id": 0, "id": 1, "name": 1, "email": 1, "customer_status": 1, "reward_system": 1, "cashback_balance": 1}
    ).sort("name", 1).to_list(300)
    counts = {k: await db.users.count_documents({"reward_system": k}) for k in SYSTEMS}
    return {"users": users, "counts": counts}


@router.put("/admin/rewards/users/{user_id}")
async def admin_set_user_system(user_id: str, data: dict, user=Depends(get_current_user)):
    _admin(user)
    system = data.get("reward_system") or None
    if system is not None and system not in SYSTEMS:
        raise HTTPException(status_code=400, detail="Неизвестная система")
    res = await db.users.update_one({"id": user_id}, {"$set": {"reward_system": system}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    return {"success": True, "reward_system": system}


@router.post("/admin/rewards/users/{user_id}/cashback")
async def admin_adjust_cashback(user_id: str, data: dict, user=Depends(get_current_user)):
    _admin(user)
    try:
        amount = round(float(data.get("amount")), 2)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Укажите сумму")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "cashback_balance": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    if amount == 0 or (target.get("cashback_balance", 0) or 0) + amount < 0:
        raise HTTPException(status_code=400, detail="Некорректная сумма")
    reason = str(data.get("reason") or "").strip()
    await adjust_cashback(user_id, amount, "manual", reason or "Корректировка администратором")
    return {"success": True, "cashback_balance": round((target.get("cashback_balance", 0) or 0) + amount, 2)}


@router.get("/admin/rewards/withdrawals")
async def admin_withdrawals(user=Depends(get_current_user)):
    _admin(user)
    return {"withdrawals": await db.cashback_withdrawals.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)}


@router.put("/admin/rewards/withdrawals/{withdrawal_id}")
async def admin_update_withdrawal(withdrawal_id: str, data: dict, user=Depends(get_current_user)):
    _admin(user)
    status = data.get("status")
    if status not in ("paid", "rejected"):
        raise HTTPException(status_code=400, detail="Некорректный статус")
    res = await db.cashback_withdrawals.find_one_and_update(
        {"id": withdrawal_id, "status": "pending"},
        {"$set": {"status": status, "admin_comment": str(data.get("comment") or ""), "updated_at": _now()}},
    )
    if not res:
        raise HTTPException(status_code=400, detail="Заявка не найдена или уже обработана")
    if status == "rejected":
        await adjust_cashback(res["user_id"], res["amount"], "withdraw_rejected", "Заявка на вывод отклонена — кэшбэк возвращён")
        await notify_user(res["user_id"], "bonus", "Вывод кэшбэка отклонён", f"Заявка на {res['amount']:.2f} ₽ отклонена, сумма возвращена на счёт кэшбэка.", "/bonus")
    else:
        await notify_user(res["user_id"], "bonus", "Кэшбэк выплачен", f"Выплата {res['amount']:.2f} ₽ по вашей заявке выполнена.", "/bonus")
    return {"success": True}
