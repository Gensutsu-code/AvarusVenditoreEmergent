"""AI features (ChatGPT): parts assistant, smart search, product descriptions, reply drafts."""
import os
import re
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

from database import db, get_current_user

router = APIRouter(tags=["ai"])
logger = logging.getLogger(__name__)

AI_MODEL = ("openai", "gpt-5.4")
DAILY_LIMIT = 60  # AI requests per client per day
AI_UNAVAILABLE = "ИИ-помощник временно недоступен. Попробуйте позже."

STOP_WORDS = {
    "для", "как", "что", "это", "или", "при", "под", "над", "без", "есть", "нужен", "нужна", "нужно", "нужны",
    "надо", "хочу", "подскажите", "подобрать", "подберите", "найти", "найдите", "какой", "какая", "какие",
    "мне", "мой", "моя", "моего", "если", "чтобы", "который", "которая", "которые", "где", "когда", "the", "and", "for",
    "здравствуйте", "добрый", "день", "привет", "спасибо", "пожалуйста", "можно", "цена", "сколько", "стоит",
}
PRODUCT_FIELDS = {"_id": 0, "id": 1, "name": 1, "article": 1, "manufacturer": 1, "price": 1, "stock": 1,
                  "cross_articles": 1, "description": 1, "image_url": 1, "stock_regions": 1}

ASSISTANT_SYSTEM = (
    "Ты — консультант интернет-магазина запчастей для грузовиков. Отвечай по-русски, кратко и по делу. "
    "К каждому вопросу тебе дают список товаров из каталога магазина, найденных по запросу. "
    "Рекомендуй ТОЛЬКО товары из этого списка: указывай название, артикул и цену, отмечай наличие. "
    "Никогда не выдумывай товары, артикулы, цены, наличие и применимость, которых нет в списке. "
    "Если данных недостаточно — задай уточняющий вопрос (марка, модель, год, двигатель, VIN, номер детали). "
    "Если подходящих товаров в списке нет — честно скажи об этом и предложи оставить заявку на товар "
    "или написать менеджеру в разделе «Связь». Скидки и сроки доставки не обещай. Пиши простым текстом без markdown-разметки."
)


class AssistantMessage(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    message: str = Field(min_length=1, max_length=1500)


class SearchIn(BaseModel):
    query: str = Field(min_length=2, max_length=500)


class DescriptionIn(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    article: Optional[str] = Field(default="", max_length=100)
    manufacturer: Optional[str] = Field(default="", max_length=100)
    cross_articles: Optional[str] = Field(default="", max_length=1000)
    category: Optional[str] = Field(default="", max_length=200)


class DraftIn(BaseModel):
    chat_id: str


def _key():
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail=AI_UNAVAILABLE)
    return key


def _chat(system: str, session_id: str, history=None):
    return LlmChat(api_key=_key(), session_id=session_id, system_message=system,
                   initial_messages=history or None).with_model(*AI_MODEL)


async def _complete(system: str, prompt: str) -> str:
    parts = []
    try:
        async for ev in _chat(system, f"oneshot-{uuid.uuid4()}").stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                parts.append(ev.content)
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        logger.error(f"AI completion failed: {e}")
        raise HTTPException(status_code=502, detail=AI_UNAVAILABLE)
    return "".join(parts).strip()


async def _use_quota(user, kind: str):
    """Per-client daily cap protects the AI balance; admins are not limited."""
    now = datetime.now(timezone.utc)
    if user.get("role") != "admin":
        since = (now - timedelta(days=1)).isoformat()
        used = await db.ai_usage.count_documents({"user_id": user["id"], "created_at": {"$gte": since}})
        if used >= DAILY_LIMIT:
            raise HTTPException(status_code=429, detail="Дневной лимит запросов к ИИ исчерпан. Попробуйте завтра.")
    await db.ai_usage.insert_one({"user_id": user["id"], "kind": kind, "created_at": now.isoformat()})


def _tokens(text: str):
    out = []
    for raw in re.findall(r"[A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9\-\./]{2,}", (text or "").lower()):
        if raw in STOP_WORDS:
            continue
        # crude stemming for Russian word endings: «фильтры» -> «фильт»
        tok = raw[:-2] if re.fullmatch(r"[а-яё]{6,}", raw) else raw
        if tok not in out:
            out.append(tok)
    return out[:14]


async def _find_products(text: str, limit: int = 12):
    toks = _tokens(text)
    if not toks:
        return []
    ors = []
    for t in toks:
        rx = re.escape(t)
        for f in ("name", "article", "cross_articles", "manufacturer", "description"):
            ors.append({f: {"$regex": rx, "$options": "i"}})
    docs = await db.products.find({"$or": ors}, PRODUCT_FIELDS).to_list(400)
    scored = []
    for d in docs:
        code = f"{d.get('article') or ''} {d.get('cross_articles') or ''}".lower()
        title = f"{d.get('name') or ''} {d.get('manufacturer') or ''}".lower()
        body = (d.get("description") or "").lower()
        score = sum(4 if t in code else 2 if t in title else 1 if t in body else 0 for t in toks)
        if score:
            scored.append((score, (d.get("stock") or 0) > 0, d))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [d for _, _, d in scored[:limit]]


def _slim(p):
    return {
        "артикул": p.get("article"), "название": p.get("name"), "производитель": p.get("manufacturer"),
        "цена_руб": p.get("price"), "в_наличии": (p.get("stock") or 0) > 0,
        "кросс_номера": (p.get("cross_articles") or "")[:200],
        "описание": (p.get("description") or "")[:200],
    }


def _card(p):
    return {"id": p["id"], "name": p.get("name"), "article": p.get("article"), "manufacturer": p.get("manufacturer"),
            "price": p.get("price"), "image_url": p.get("image_url"), "in_stock": (p.get("stock") or 0) > 0}


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ==================== 1. PARTS ASSISTANT (multi-turn, streaming) ====================

@router.get("/ai/assistant/history")
async def assistant_history(session_id: str, user=Depends(get_current_user)):
    msgs = await db.ai_chat_messages.find(
        {"session_id": session_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return {"messages": msgs}


@router.post("/ai/assistant/chat")
async def assistant_chat(data: AssistantMessage, user=Depends(get_current_user)):
    text = data.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Введите сообщение")
    _key()
    await _use_quota(user, "assistant")

    past = await db.ai_chat_messages.find(
        {"session_id": data.session_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    past = past[-12:]
    history = [{"role": m["role"], "content": m["text"]} for m in past]
    prev_user = next((m["text"] for m in reversed(past) if m["role"] == "user"), "")
    products = await _find_products(f"{text} {prev_user}")

    await db.ai_chat_messages.insert_one({
        "id": str(uuid.uuid4()), "session_id": data.session_id, "user_id": user["id"],
        "role": "user", "text": text, "products": [], "created_at": datetime.now(timezone.utc).isoformat(),
    })
    prompt = (
        f"Вопрос клиента: {text}\n\n"
        f"Товары каталога, найденные по запросу ({len(products)}):\n"
        f"{json.dumps([_slim(p) for p in products], ensure_ascii=False)}"
    )
    cards = [_card(p) for p in products]

    async def gen():
        yield _sse({"type": "products", "items": cards})
        parts = []
        try:
            chat = _chat(ASSISTANT_SYSTEM, data.session_id, history)
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    parts.append(ev.content)
                    yield _sse({"type": "delta", "text": ev.content})
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.error(f"AI assistant failed: {e}")
            yield _sse({"type": "error", "message": AI_UNAVAILABLE})
            return
        answer = "".join(parts).strip()
        low = answer.lower()
        mentioned = [c for c in cards if c.get("article") and str(c["article"]).lower() in low]
        await db.ai_chat_messages.insert_one({
            "id": str(uuid.uuid4()), "session_id": data.session_id, "user_id": user["id"],
            "role": "assistant", "text": answer, "products": mentioned,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        yield _sse({"type": "done", "products": mentioned})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ==================== 2. SMART SEARCH BY DESCRIPTION ====================

@router.post("/ai/search")
async def ai_search(data: SearchIn, user=Depends(get_current_user)):
    await _use_quota(user, "search")
    system = (
        "Ты помогаешь искать запчасти для грузовиков в каталоге магазина. Клиент описывает деталь своими словами. "
        "Верни СТРОГО JSON без пояснений: "
        '{"keywords": ["..."], "explanation": "..."}. '
        "keywords — до 8 коротких поисковых слов на русском (и латиницей для марок/артикулов): правильные названия "
        "детали и её синонимы в именительном падеже, марка техники, производитель, артикулы из запроса. "
        "explanation — одна короткая фраза по-русски, как ты понял запрос."
    )
    raw = await _complete(system, data.query.strip())
    keywords, explanation = [], ""
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m:
        try:
            parsed = json.loads(m.group(0))
            keywords = [str(k)[:60] for k in (parsed.get("keywords") or []) if k][:8]
            explanation = str(parsed.get("explanation") or "")[:300]
        except (ValueError, AttributeError):
            pass
    found = await _find_products(" ".join(keywords) or data.query, limit=40)
    ids = [p["id"] for p in found]
    full = await db.products.find({"id": {"$in": ids}}, {"_id": 0, "purchase_price": 0}).to_list(len(ids) or 1)
    by_id = {p["id"]: p for p in full}
    products = []
    for pid in ids:
        p = by_id.get(pid)
        if p:
            p["in_stock"] = (p.get("stock") or 0) > 0
            products.append(p)
    return {"keywords": keywords, "explanation": explanation, "products": products}


# ==================== 3. PRODUCT DESCRIPTION (admin) ====================

@router.post("/admin/ai/product-description")
async def ai_product_description(data: DescriptionIn, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    await _use_quota(user, "description")
    system = (
        "Ты пишешь описания товаров для интернет-магазина запчастей для грузовиков. Напиши описание на русском, "
        "3–5 предложений, без заголовков, списков и markdown. Используй только переданные данные и общеизвестное "
        "назначение детали такого типа. Не выдумывай технические характеристики, размеры, применимость к конкретным "
        "моделям и гарантийные условия, если их нет в данных. Без рекламных штампов и восклицаний."
    )
    facts = {"Название": data.name, "Артикул": data.article, "Производитель": data.manufacturer,
             "Кросс-номера": data.cross_articles, "Категория": data.category}
    prompt = "\n".join(f"{k}: {v}" for k, v in facts.items() if v)
    description = await _complete(system, prompt)
    if not description:
        raise HTTPException(status_code=502, detail=AI_UNAVAILABLE)
    return {"description": description}


# ==================== 4. SUPPORT CHAT REPLY DRAFT (admin) ====================

@router.post("/admin/ai/chat-draft")
async def ai_chat_draft(data: DraftIn, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    msgs = await db.chat_messages.find({"chat_id": data.chat_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    msgs = [m for m in msgs if (m.get("text") or "").strip()][-12:]
    if not msgs or not any(m.get("sender_type") == "user" for m in msgs):
        raise HTTPException(status_code=400, detail="В чате нет сообщений клиента для ответа")
    await _use_quota(user, "draft")
    client_text = " ".join(m["text"] for m in msgs if m.get("sender_type") == "user")[-600:]
    products = await _find_products(client_text, limit=8)
    dialog = "\n".join(f"{'Клиент' if m.get('sender_type') == 'user' else 'Менеджер'}: {m['text'][:600]}" for m in msgs)
    system = (
        "Ты — менеджер поддержки интернет-магазина запчастей для грузовиков. Напиши черновик следующего ответа "
        "менеджера клиенту: по-русски, вежливо, кратко (до 5 предложений), без markdown и без подписи. "
        "Товары упоминай только из переданного списка каталога (название, артикул, цена). Не выдумывай наличие, "
        "цены, сроки и скидки; если данных не хватает — задай клиенту уточняющий вопрос. Верни только текст ответа."
    )
    prompt = (f"Переписка:\n{dialog}\n\nТовары каталога по теме переписки:\n"
              f"{json.dumps([_slim(p) for p in products], ensure_ascii=False)}")
    draft = await _complete(system, prompt)
    if not draft:
        raise HTTPException(status_code=502, detail=AI_UNAVAILABLE)
    return {"draft": draft}
