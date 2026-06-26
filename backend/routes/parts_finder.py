"""Parts finder (Подбор запчастей) — AI-assisted matching against our catalog.
Paid feature: subscription (period, unlimited) + one-time request. Charged from the
user's balance (₽) or bonus points (×multiplier). Prices set by admin in settings."""
import os
import re
import json
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from database import db, get_current_user

router = APIRouter(tags=["parts-finder"])

DEFAULTS = {
    "catalog_enabled": False,
    "provider": "",
    "base_url": "",
    "api_key": "",
    "ai_enabled": True,
    # Monetization
    "paid_enabled": True,
    "request_price": 100,        # ₽ per single search
    "subscription_price": 990,   # ₽ per subscription period
    "subscription_days": 30,     # subscription length
    "free_requests": 0,          # free searches per user before paying
    "points_multiplier": 2,      # points cost = ₽ price × multiplier
}


async def _get_settings():
    s = await db.settings.find_one({"key": "parts_finder_settings"})
    if s:
        return {**DEFAULTS, **s.get("value", {})}
    return dict(DEFAULTS)


def _now():
    return datetime.now(timezone.utc)


def _now_iso():
    return _now().isoformat()


async def _user_points(user_id):
    rows = await db.bonus_progress.find(
        {"user_id": user_id}, {"_id": 0, "program_id": 1, "current_amount": 1}
    ).to_list(100)
    total = sum(r.get("current_amount", 0) or 0 for r in rows)
    return rows, total


async def _deduct_points(user_id, amount):
    rows, total = await _user_points(user_id)
    if total < amount:
        return False
    remaining = amount
    for r in sorted(rows, key=lambda x: x.get("current_amount", 0) or 0, reverse=True):
        if remaining <= 0:
            break
        take = min(r.get("current_amount", 0) or 0, remaining)
        if take <= 0:
            continue
        await db.bonus_progress.update_one(
            {"user_id": user_id, "program_id": r["program_id"]},
            {"$inc": {"current_amount": -take}},
        )
        remaining -= take
    return True


async def _deduct_balance(user_id, amount, description):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "balance": 1})
    bal = (u.get("balance", 0) or 0) if u else 0
    if bal < amount:
        return False
    await db.users.update_one({"id": user_id}, {"$inc": {"balance": -amount}})
    await db.balance_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "payment",
        "amount": -amount,
        "method": "balance",
        "status": "completed",
        "created_at": _now_iso(),
        "description": description,
    })
    return True


def _has_active_sub(until):
    return bool(until and str(until) > _now_iso())


class FinderQuery(BaseModel):
    vin: str = ""
    brand: str = ""
    model: str = ""
    year: str = ""
    engine: str = ""
    axle: str = ""
    cross_number: str = ""
    query: str = ""
    pay_with: str = ""  # "" | "balance" | "points" (for paid one-time request)


@router.get("/parts-finder/config")
async def finder_config():
    s = await _get_settings()
    return {
        "catalog_enabled": bool(s["catalog_enabled"]) and bool(s["api_key"]),
        "ai_enabled": bool(s["ai_enabled"]),
        "provider": s["provider"],
        "paid_enabled": bool(s["paid_enabled"]),
    }


@router.get("/parts-finder/access")
async def finder_access(user=Depends(get_current_user)):
    s = await _get_settings()
    mult = float(s["points_multiplier"]) or 1
    fresh = await db.users.find_one(
        {"id": user["id"]}, {"_id": 0, "balance": 1, "pf_subscription_until": 1, "pf_free_used": 1}
    ) or {}
    until = fresh.get("pf_subscription_until")
    _, points = await _user_points(user["id"])
    req_price = float(s["request_price"])
    sub_price = float(s["subscription_price"])
    return {
        "paid_enabled": bool(s["paid_enabled"]),
        "has_subscription": _has_active_sub(until),
        "subscription_until": until,
        "free_remaining": max(0, int(s["free_requests"]) - int(fresh.get("pf_free_used", 0) or 0)),
        "request_price": req_price,
        "request_price_points": round(req_price * mult),
        "subscription_price": sub_price,
        "subscription_price_points": round(sub_price * mult),
        "subscription_days": int(s["subscription_days"]),
        "balance": fresh.get("balance", 0) or 0,
        "points": points,
    }


@router.post("/parts-finder/subscribe")
async def finder_subscribe(data: dict, user=Depends(get_current_user)):
    s = await _get_settings()
    if not s["paid_enabled"]:
        raise HTTPException(status_code=400, detail="Подписка недоступна")
    mult = float(s["points_multiplier"]) or 1
    pay_with = data.get("pay_with")
    price = float(s["subscription_price"])
    pts = round(price * mult)
    days = int(s["subscription_days"])

    if pay_with == "balance":
        if not await _deduct_balance(user["id"], price, "Подписка на подбор запчастей"):
            raise HTTPException(status_code=400, detail="Недостаточно средств на балансе")
    elif pay_with == "points":
        if not await _deduct_points(user["id"], pts):
            raise HTTPException(status_code=400, detail="Недостаточно баллов")
    else:
        raise HTTPException(status_code=400, detail="Выберите способ оплаты")

    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "pf_subscription_until": 1}) or {}
    base = _now()
    cur = fresh.get("pf_subscription_until")
    if cur:
        try:
            cdt = datetime.fromisoformat(str(cur))
            if cdt.tzinfo is None:
                cdt = cdt.replace(tzinfo=timezone.utc)
            if cdt > base:
                base = cdt
        except (ValueError, TypeError):
            pass
    new_until = (base + timedelta(days=days)).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$set": {"pf_subscription_until": new_until}})
    return {"success": True, "subscription_until": new_until}


@router.get("/admin/parts-finder/settings")
async def get_finder_settings(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _get_settings()


@router.put("/admin/parts-finder/settings")
async def update_finder_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    def _num(key, default, integer=False):
        try:
            v = float(data.get(key, default))
            return int(v) if integer else v
        except (TypeError, ValueError):
            return default

    value = {
        "catalog_enabled": bool(data.get("catalog_enabled", False)),
        "provider": str(data.get("provider", ""))[:128],
        "base_url": str(data.get("base_url", ""))[:512],
        "api_key": str(data.get("api_key", ""))[:512],
        "ai_enabled": bool(data.get("ai_enabled", True)),
        "paid_enabled": bool(data.get("paid_enabled", True)),
        "request_price": max(0, _num("request_price", 100)),
        "subscription_price": max(0, _num("subscription_price", 990)),
        "subscription_days": max(1, _num("subscription_days", 30, integer=True)),
        "free_requests": max(0, _num("free_requests", 0, integer=True)),
        "points_multiplier": max(1, _num("points_multiplier", 2)),
    }
    await db.settings.update_one(
        {"key": "parts_finder_settings"},
        {"$set": {"key": "parts_finder_settings", "value": value}},
        upsert=True,
    )
    return {"success": True, **value}


def _keywords(q: FinderQuery):
    parts = [q.query, q.brand, q.model, q.engine, q.axle, q.cross_number]
    text = " ".join(p for p in parts if p).strip()
    toks = [t for t in re.split(r"[\s,;/]+", text) if len(t) >= 2]
    return toks[:8], text


async def _find_candidates(q: FinderQuery, limit=30):
    toks, _ = _keywords(q)
    query = {}
    if q.cross_number:
        query = {"$or": [
            {"cross_articles": {"$regex": re.escape(q.cross_number), "$options": "i"}},
            {"article": {"$regex": re.escape(q.cross_number), "$options": "i"}},
        ]}
    elif toks:
        ors = []
        for t in toks:
            rx = {"$regex": re.escape(t), "$options": "i"}
            ors += [{"name": rx}, {"article": rx}, {"manufacturer": rx},
                    {"description": rx}, {"cross_articles": rx}]
        query = {"$or": ors}
    docs = await db.products.find(query, {"_id": 0}).limit(limit).to_list(limit)
    if not docs:
        docs = await db.products.find({}, {"_id": 0}).limit(limit).to_list(limit)
    return docs


def _slim(p):
    return {
        "id": p.get("id"),
        "name": p.get("name"),
        "article": p.get("article"),
        "manufacturer": p.get("manufacturer"),
        "cross_articles": p.get("cross_articles"),
        "description": (p.get("description") or "")[:200],
    }


async def _ai_rank(q: FinderQuery, candidates):
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key or not candidates:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        system = (
            "Ты — эксперт по подбору автозапчастей для грузовиков. Тебе дают параметры "
            "автомобиля и список товаров из каталога магазина. Верни СТРОГО JSON-массив "
            "наиболее подходящих товаров в порядке убывания уверенности, формат: "
            '[{"id": "<id товара>", "confidence": <0-100>, "reason": "<кратко почему подходит>"}]. '
            "Максимум 8 элементов. Только товары из списка. Если ничего не подходит — верни []. "
            "Никакого текста кроме JSON."
        )
        vehicle = {k: v for k, v in q.dict().items() if v and k != "pay_with"}
        prompt = (
            f"Параметры запроса: {json.dumps(vehicle, ensure_ascii=False)}\n\n"
            f"Каталог (кандидаты):\n{json.dumps([_slim(c) for c in candidates], ensure_ascii=False)}\n\n"
            "Верни JSON-массив наиболее подходящих артикулов."
        )
        chat = LlmChat(api_key=key, session_id=f"parts-{uuid.uuid4()}",
                       system_message=system).with_model("openai", "gpt-5.4")
        resp = await chat.send_message(UserMessage(text=prompt))
        txt = str(resp).strip()
        m = re.search(r"\[.*\]", txt, re.DOTALL)
        if not m:
            return None
        return json.loads(m.group(0))
    except Exception:
        return None


def _result_card(p, conf=None, reason=None):
    return {
        "id": p["id"], "name": p.get("name"), "article": p.get("article"),
        "manufacturer": p.get("manufacturer"), "price": p.get("price"),
        "image_url": p.get("image_url"), "stock": p.get("stock", 0),
        "confidence": conf, "reason": reason,
    }


@router.post("/parts-finder/search")
async def finder_search(q: FinderQuery, user=Depends(get_current_user)):
    if not any([q.vin, q.brand, q.model, q.engine, q.axle, q.cross_number, q.query]):
        raise HTTPException(status_code=400, detail="Укажите хотя бы один параметр подбора")

    s = await _get_settings()
    mult = float(s["points_multiplier"]) or 1
    charged = None

    # ---- Paywall ----
    if s["paid_enabled"]:
        fresh = await db.users.find_one(
            {"id": user["id"]}, {"_id": 0, "balance": 1, "pf_subscription_until": 1, "pf_free_used": 1}
        ) or {}
        if not _has_active_sub(fresh.get("pf_subscription_until")):
            free_total = int(s["free_requests"])
            free_used = int(fresh.get("pf_free_used", 0) or 0)
            if free_used < free_total:
                await db.users.update_one({"id": user["id"]}, {"$inc": {"pf_free_used": 1}})
            else:
                price = float(s["request_price"])
                pts = round(price * mult)
                if not q.pay_with:
                    _, points = await _user_points(user["id"])
                    return {
                        "requires_payment": True, "mode": "paywall", "note": "",
                        "request_price": price, "request_price_points": pts,
                        "balance": fresh.get("balance", 0) or 0, "points": points,
                        "count": 0, "results": [],
                    }
                if q.pay_with == "balance":
                    if not await _deduct_balance(user["id"], price, "Подбор запчастей (разовый запрос)"):
                        raise HTTPException(status_code=400, detail="Недостаточно средств на балансе")
                    charged = {"method": "balance", "amount": price}
                elif q.pay_with == "points":
                    if not await _deduct_points(user["id"], pts):
                        raise HTTPException(status_code=400, detail="Недостаточно баллов")
                    charged = {"method": "points", "amount": pts}
                else:
                    raise HTTPException(status_code=400, detail="Неверный способ оплаты")

    # ---- Search ----
    catalog_live = bool(s["catalog_enabled"]) and bool(s["api_key"])
    candidates = await _find_candidates(q)
    by_id = {c["id"]: c for c in candidates}
    ranked = await _ai_rank(q, candidates) if s["ai_enabled"] else None

    results = []
    if ranked:
        for r in ranked:
            p = by_id.get(r.get("id"))
            if p:
                results.append(_result_card(p, r.get("confidence"), r.get("reason")))
    else:
        for p in candidates[:8]:
            results.append(_result_card(p))

    if catalog_live:
        mode, note = "catalog", f"Подбор по каталогу «{s['provider']}»."
    elif ranked is not None:
        mode, note = "ai", "Подобрали подходящие варианты из нашего каталога."
    else:
        mode, note = "basic", "Подобрали варианты из нашего каталога."

    return {"mode": mode, "note": note, "count": len(results), "results": results, "charged": charged}
