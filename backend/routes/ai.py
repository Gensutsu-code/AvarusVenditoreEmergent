"""AI features (ChatGPT): parts assistant, smart search, product descriptions, reply drafts."""
import os
import re
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import asyncio
import jwt
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

from database import db, get_current_user, JWT_SECRET, JWT_ALGORITHM
from notify import notify_admin

router = APIRouter(tags=["ai"])
logger = logging.getLogger(__name__)

AI_MODEL = ("openai", "gpt-5.4")
DAILY_LIMIT = 60  # AI requests per client per day
GUEST_DAILY_LIMIT = 5  # assistant questions per guest (by IP) per day
GUEST_TOTAL_DAILY_LIMIT = 300  # all guests together per day — protects the AI balance
optional_security = HTTPBearer(auto_error=False)


async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    user = await db.users.find_one({"id": payload.get("user_id")}, {"_id": 0, "password": 0})
    return None if (not user or user.get("blocked")) else user


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for") or ""
    return (fwd.split(",")[0].strip() or (request.client.host if request.client else "") or "unknown")[:64]


async def _use_guest_quota(request: Request) -> int:
    """Returns how many questions the guest has left today."""
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=1)).isoformat()
    uid = f"guest-ip:{_client_ip(request)}"
    used = await db.ai_usage.count_documents({"user_id": uid, "created_at": {"$gte": since}})
    if used >= GUEST_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail="Лимит вопросов без входа исчерпан. Войдите в аккаунт, чтобы продолжить.")
    if await db.ai_usage.count_documents({"guest": True, "created_at": {"$gte": since}}) >= GUEST_TOTAL_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail="Помощник сейчас доступен только после входа в аккаунт.")
    await db.ai_usage.insert_one({"user_id": uid, "guest": True, "kind": "assistant", "created_at": now.isoformat()})
    return GUEST_DAILY_LIMIT - used - 1
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
async def assistant_history(session_id: str, user=Depends(get_optional_user)):
    owner = user["id"] if user else "guest"
    msgs = await db.ai_chat_messages.find(
        {"session_id": session_id, "user_id": owner}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return {"messages": msgs}


@router.post("/ai/assistant/chat")
async def assistant_chat(data: AssistantMessage, request: Request, user=Depends(get_optional_user)):
    text = data.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Введите сообщение")
    _key()
    guest_left = None
    if user:
        await _use_quota(user, "assistant")
    else:
        guest_left = await _use_guest_quota(request)
        user = {"id": "guest"}

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
        yield _sse({"type": "done", "products": mentioned, "guest_left": guest_left})

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


# ==================== 5. HAND THE AI DIALOG OVER TO A MANAGER ====================

class HandoffIn(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)


@router.post("/ai/assistant/handoff")
async def assistant_handoff(data: HandoffIn, user=Depends(get_current_user)):
    msgs = await db.ai_chat_messages.find(
        {"session_id": data.session_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    if not msgs:
        raise HTTPException(status_code=400, detail="В диалоге пока нет сообщений")
    if msgs[-1].get("handed_off"):
        raise HTTPException(status_code=400, detail="Этот диалог уже передан менеджеру")
    lines = [f"{'Клиент' if m['role'] == 'user' else 'ИИ-помощник'}: {m['text'][:700]}" for m in msgs[-12:]]
    text = "Передаю диалог с ИИ-помощником, нужна помощь менеджера.\n\n" + "\n\n".join(lines)
    now = datetime.now(timezone.utc).isoformat()
    chat = await db.chats.find_one({"user_id": user["id"]})
    if chat:
        chat_id = chat["id"]
        await db.chats.update_one({"id": chat_id}, {"$set": {"updated_at": now}})
    else:
        chat_id = str(uuid.uuid4())
        await db.chats.insert_one({"id": chat_id, "user_id": user["id"], "user_name": user["name"], "user_email": user["email"],
                                   "created_at": now, "updated_at": now, "pinned": False, "labels": []})
    msg_id = str(uuid.uuid4())
    await db.chat_messages.insert_one({
        "id": msg_id, "chat_id": chat_id, "user_id": user["id"], "user_name": user["name"], "text": text[:6000],
        "sender_type": "user", "message_type": "text", "created_at": now, "read": False, "edited": False,
    })
    await db.ai_chat_messages.update_one({"id": msgs[-1]["id"]}, {"$set": {"handed_off": True}})
    try:
        await notify_admin("chat", "Диалог с ИИ передан менеджеру", f"{user['name']}: {msgs[-1]['text'][:80]}", "/admin/chats")
    except Exception as e:
        logger.error(f"Handoff notify failed: {e}")
    return {"success": True, "chat_id": chat_id, "message_id": msg_id}


# ==================== 6. BULK PRODUCT DESCRIPTIONS (admin, background job) ====================

BULK_KEY = "ai_bulk_descriptions"
NO_DESCRIPTION = {"$or": [{"description": {"$exists": False}}, {"description": None}, {"description": {"$regex": r"^\s*$"}}]}
DESCRIPTION_SYSTEM = (
    "Ты пишешь описания товаров для интернет-магазина запчастей для грузовиков. Напиши описание на русском, "
    "3–5 предложений, без заголовков, списков и markdown. Используй только переданные данные и общеизвестное "
    "назначение детали такого типа. Не выдумывай технические характеристики, размеры, применимость к конкретным "
    "моделям и гарантийные условия, если их нет в данных. Без рекламных штампов и восклицаний."
)
_bulk_task = None


async def _bulk_state():
    doc = await db.settings.find_one({"key": BULK_KEY}, {"_id": 0})
    state = (doc or {}).get("value") or {"status": "idle", "total": 0, "done": 0, "failed": 0}
    # a job that stopped reporting (server restart) is no longer running
    if state.get("status") == "running":
        try:
            stale = datetime.now(timezone.utc) - datetime.fromisoformat(state.get("heartbeat")) > timedelta(minutes=3)
        except (TypeError, ValueError):
            stale = True
        if stale:
            state["status"] = "interrupted"
    return state


async def _bulk_save(state, replace=False):
    state["heartbeat"] = datetime.now(timezone.utc).isoformat()
    # field-wise update keeps a stop request made while a description is being written
    update = {"value": state} if replace else {f"value.{k}": v for k, v in state.items()}
    await db.settings.update_one({"key": BULK_KEY}, {"$set": update}, upsert=True)


async def _bulk_run(state):
    skip_ids = []
    try:
        while True:
            current = (await db.settings.find_one({"key": BULK_KEY}, {"_id": 0}) or {}).get("value", {})
            if current.get("stop_requested"):
                state["status"] = "stopped"
                break
            p = await db.products.find_one({"$and": [NO_DESCRIPTION, {"id": {"$nin": skip_ids}}]},
                                           {"_id": 0, "id": 1, "name": 1, "article": 1, "manufacturer": 1, "cross_articles": 1})
            if not p:
                state["status"] = "finished"
                break
            facts = {"Название": p.get("name"), "Артикул": p.get("article"), "Производитель": p.get("manufacturer"),
                     "Кросс-номера": (p.get("cross_articles") or "")[:500]}
            try:
                text = await _complete(DESCRIPTION_SYSTEM, "\n".join(f"{k}: {v}" for k, v in facts.items() if v))
            except HTTPException:
                text = ""
            if text and p.get("name"):
                # only fill products that are still empty — never overwrite a text the admin typed meanwhile
                await db.products.update_one({"$and": [{"id": p["id"]}, NO_DESCRIPTION]},
                                             {"$set": {"description": text, "description_ai": True}})
                state["done"] += 1
                state["fail_streak"] = 0
            else:
                skip_ids.append(p["id"])
                state["failed"] += 1
                state["fail_streak"] = state.get("fail_streak", 0) + 1
                if state["fail_streak"] >= 5:
                    state["status"] = "error"
                    state["error"] = AI_UNAVAILABLE
                    break
            await _bulk_save(state)
    except Exception as e:
        logger.error(f"Bulk descriptions failed: {e}")
        state["status"] = "error"
        state["error"] = "Задача прервана из-за ошибки"
    state["finished_at"] = datetime.now(timezone.utc).isoformat()
    await _bulk_save(state, replace=True)


def _require_admin(user):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/admin/ai/bulk-descriptions")
async def bulk_descriptions_status(user=Depends(get_current_user)):
    _require_admin(user)
    state = await _bulk_state()
    state["without_description"] = await db.products.count_documents(NO_DESCRIPTION)
    return state


@router.post("/admin/ai/bulk-descriptions/start")
async def bulk_descriptions_start(user=Depends(get_current_user)):
    global _bulk_task
    _require_admin(user)
    _key()
    if (await _bulk_state()).get("status") == "running":
        raise HTTPException(status_code=400, detail="Задача уже выполняется")
    total = await db.products.count_documents(NO_DESCRIPTION)
    if total == 0:
        raise HTTPException(status_code=400, detail="Товаров без описания нет")
    state = {"status": "running", "total": total, "done": 0, "failed": 0, "started_at": datetime.now(timezone.utc).isoformat()}
    await _bulk_save(state, replace=True)
    _bulk_task = asyncio.create_task(_bulk_run(state))
    return state


@router.post("/admin/ai/bulk-descriptions/stop")
async def bulk_descriptions_stop(user=Depends(get_current_user)):
    _require_admin(user)
    await db.settings.update_one({"key": BULK_KEY, "value.status": "running"}, {"$set": {"value.stop_requested": True}})
    return {"success": True}
