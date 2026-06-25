"""Parts finder (Подбор запчастей) — AI-assisted matching against our catalog,
with a configurable hook for a future paid catalog/VIN-decoder API."""
import os
import re
import json
import uuid
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
}


async def _get_settings():
    s = await db.settings.find_one({"key": "parts_finder_settings"})
    if s:
        return {**DEFAULTS, **s.get("value", {})}
    return dict(DEFAULTS)


class FinderQuery(BaseModel):
    vin: str = ""
    brand: str = ""
    model: str = ""
    year: str = ""
    engine: str = ""
    axle: str = ""
    cross_number: str = ""
    query: str = ""


@router.get("/parts-finder/config")
async def finder_config():
    s = await _get_settings()
    return {
        "catalog_enabled": bool(s["catalog_enabled"]) and bool(s["api_key"]),
        "ai_enabled": bool(s["ai_enabled"]),
        "provider": s["provider"],
    }


@router.get("/admin/parts-finder/settings")
async def get_finder_settings(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _get_settings()


@router.put("/admin/parts-finder/settings")
async def update_finder_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    value = {
        "catalog_enabled": bool(data.get("catalog_enabled", False)),
        "provider": str(data.get("provider", ""))[:128],
        "base_url": str(data.get("base_url", ""))[:512],
        "api_key": str(data.get("api_key", ""))[:512],
        "ai_enabled": bool(data.get("ai_enabled", True)),
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
        vehicle = {k: v for k, v in q.dict().items() if v}
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


@router.post("/parts-finder/search")
async def finder_search(q: FinderQuery):
    if not any([q.vin, q.brand, q.model, q.engine, q.axle, q.cross_number, q.query]):
        raise HTTPException(status_code=400, detail="Укажите хотя бы один параметр подбора")

    s = await _get_settings()
    catalog_live = bool(s["catalog_enabled"]) and bool(s["api_key"])

    candidates = await _find_candidates(q)
    by_id = {c["id"]: c for c in candidates}

    ranked = await _ai_rank(q, candidates) if s["ai_enabled"] else None

    results = []
    if ranked:
        for r in ranked:
            p = by_id.get(r.get("id"))
            if not p:
                continue
            results.append({
                "id": p["id"], "name": p.get("name"), "article": p.get("article"),
                "manufacturer": p.get("manufacturer"), "price": p.get("price"),
                "image_url": p.get("image_url"), "stock": p.get("stock", 0),
                "confidence": r.get("confidence"), "reason": r.get("reason"),
            })
    else:
        # Fallback: plain catalog matches without AI ranking
        for p in candidates[:8]:
            results.append({
                "id": p["id"], "name": p.get("name"), "article": p.get("article"),
                "manufacturer": p.get("manufacturer"), "price": p.get("price"),
                "image_url": p.get("image_url"), "stock": p.get("stock", 0),
                "confidence": None, "reason": None,
            })

    if catalog_live:
        mode = "catalog"
        note = (f"Платный каталог «{s['provider']}» подключён (заглушка интеграции). "
                "Ниже — предварительный подбор по нашему каталогу.")
    elif ranked is not None:
        mode = "ai"
        note = ("Предварительный ИИ-подбор по нашему каталогу. Для 100% точного артикула "
                "по VIN подключите платный каталог в настройках.")
    else:
        mode = "basic"
        note = ("Базовый поиск по каталогу (ИИ недоступен). Для точного подбора по VIN "
                "подключите платный каталог.")

    return {"mode": mode, "note": note, "count": len(results), "results": results}
