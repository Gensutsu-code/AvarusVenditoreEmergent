"""Telegram integration routes"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import uuid
import httpx
import os
import logging

from database import db, get_current_user

router = APIRouter(tags=["telegram"])
logger = logging.getLogger(__name__)

TELEGRAM_CHAT_BOT_TOKEN = os.environ.get('TELEGRAM_CHAT_BOT_TOKEN')


class TelegramUpdate(BaseModel):
    update_id: int
    message: Optional[Dict[str, Any]] = None


class TelegramSettings(BaseModel):
    enabled: bool = False
    bot_token: str = ""
    chat_id: str = ""


async def send_telegram_order_notification(order: dict, user: dict):
    """Send order notification to Telegram"""
    try:
        settings = await db.settings.find_one({"key": "telegram"}, {"_id": 0})
        if not settings or not settings.get("value", {}).get("enabled"):
            return
        
        tg_settings = settings.get("value", {})
        bot_token = tg_settings.get("bot_token")
        chat_id = tg_settings.get("chat_id")
        
        if not bot_token or not chat_id:
            return
        
        order_items = []
        for item in order.get("items", []):
            item_text = f"• {item.get('name', 'Товар')} ({item.get('article', '-')}) — {item.get('quantity', 1)} шт. × {item.get('price', 0):,.0f} ₽"
            order_items.append(item_text)
        
        items_text = "\n".join(order_items) if order_items else "Нет товаров"
        
        discount_info = ""
        if order.get("applied_discount", 0) > 0:
            discount_info = f"\n💰 Скидка: {order.get('applied_discount', 0)}%"
        if order.get("payment_discount", 0) > 0:
            discount_info += f"\n💳 Скидка за оплату: {order.get('payment_discount', 0)}%"
        
        payment_methods = {
            "cash": "💵 Наличные",
            "card": "💳 Карта",
            "crypto": "🪙 Криптовалюта"
        }
        payment_text = payment_methods.get(order.get("payment_method", "cash"), "💵 Наличные")
        
        message = f"""🛒 *Новый заказ #{order.get('id', '')[:8]}*

👤 *Клиент:* {user.get('name', 'Не указано')}
📧 *Email:* {user.get('email', 'Не указано')}
📱 *Телефон:* {order.get('phone', 'Не указано')}

📦 *Товары:*
{items_text}
{discount_info}
💰 *Итого:* {order.get('total', 0):,.0f} ₽

📍 *Адрес:* {order.get('address', 'Не указано')}
{payment_text}

💬 *Комментарий:* {order.get('comment', '-') or '-'}"""

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        async with httpx.AsyncClient() as client:
            await client.post(url, json={
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "Markdown"
            }, timeout=10)
    except Exception as e:
        logger.error(f"Failed to send Telegram order notification: {e}")


@router.get("/admin/telegram-order-settings")
async def get_telegram_order_settings(user=Depends(get_current_user)):
    """Get Telegram settings for order notifications"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.settings.find_one({"key": "telegram"}, {"_id": 0})
    if settings:
        return settings.get("value", {"enabled": False, "bot_token": "", "chat_id": ""})
    return {"enabled": False, "bot_token": "", "chat_id": ""}


@router.put("/admin/telegram-order-settings")
async def update_telegram_order_settings(data: TelegramSettings, user=Depends(get_current_user)):
    """Update Telegram settings for order notifications"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"key": "telegram"},
        {"$set": {"key": "telegram", "value": data.model_dump()}},
        upsert=True
    )
    return {"success": True}


@router.post("/admin/telegram-test")
async def test_telegram_notification(user=Depends(get_current_user)):
    """Test Telegram notification"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.settings.find_one({"key": "telegram"}, {"_id": 0})
    if not settings or not settings.get("value", {}).get("enabled"):
        raise HTTPException(status_code=400, detail="Telegram не настроен или отключен")
    
    tg_settings = settings.get("value", {})
    bot_token = tg_settings.get("bot_token")
    chat_id = tg_settings.get("chat_id")
    
    if not bot_token or not chat_id:
        raise HTTPException(status_code=400, detail="Не указан токен бота или ID чата")
    
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json={
                "chat_id": chat_id,
                "text": "✅ Тестовое сообщение из магазина!\n\nУведомления о заказах настроены правильно.",
                "parse_mode": "Markdown"
            }, timeout=10)
            if res.status_code == 200:
                return {"success": True, "message": "Тестовое сообщение отправлено"}
            else:
                return {"success": False, "message": f"Ошибка Telegram: {res.text}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка отправки: {str(e)}")


# ==================== TELEGRAM CHAT BOT WEBHOOK ====================

@router.post("/telegram/chat-webhook")
async def telegram_chat_webhook(update: TelegramUpdate):
    """Webhook for Telegram chat bot - receives admin replies"""
    if not update.message:
        return {"ok": True}
    
    message = update.message
    chat_id_tg = str(message.get("chat", {}).get("id", ""))
    text = message.get("text", "")
    
    # Check for /reply command
    if text.startswith("/reply "):
        parts = text[7:].split(" ", 1)
        if len(parts) >= 2:
            website_chat_id = parts[0]
            reply_text = parts[1]
            
            chat = await db.chats.find_one({"id": website_chat_id})
            if not chat:
                chat = await db.chats.find_one({"id": {"$regex": f"^{website_chat_id}"}})
            
            if chat:
                msg_id = str(uuid.uuid4())
                chat_message = {
                    "id": msg_id,
                    "chat_id": chat["id"],
                    "user_id": "telegram_admin",
                    "user_name": "Поддержка (Telegram)",
                    "text": reply_text,
                    "sender_type": "admin",
                    "message_type": "text",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "read": False,
                    "edited": False
                }
                await db.chat_messages.insert_one(chat_message)
                await db.chats.update_one({"id": chat["id"]}, {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
                
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                            json={
                                "chat_id": chat_id_tg,
                                "text": f"✅ Сообщение отправлено пользователю {chat['user_name']}",
                                "reply_to_message_id": message.get("message_id")
                            },
                            timeout=10
                        )
                except Exception:
                    pass
            else:
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                            json={
                                "chat_id": chat_id_tg,
                                "text": f"❌ Чат с ID '{website_chat_id}' не найден"
                            },
                            timeout=10
                        )
                except Exception:
                    pass
    
    # Check for /start command - save admin chat ID
    elif text == "/start":
        await db.telegram_chat_settings.update_one(
            {"setting_type": "chat_bot"},
            {"$set": {"admin_chat_id": chat_id_tg, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                    json={
                        "chat_id": chat_id_tg,
                        "text": "✅ Чат-бот подключен!\n\nТеперь вы будете получать сообщения от пользователей сайта.\n\nДля ответа используйте команду:\n`/reply <chat_id> Ваш ответ`",
                        "parse_mode": "Markdown"
                    },
                    timeout=10
                )
        except Exception:
            pass
    
    # Check for /chats command - list active chats
    elif text == "/chats":
        chats = await db.chats.find({}, {"_id": 0}).sort("updated_at", -1).limit(10).to_list(10)
        if chats:
            chat_list = "📋 *Последние чаты:*\n\n"
            for c in chats:
                unread = await db.chat_messages.count_documents({"chat_id": c["id"], "sender_type": "user", "read": False})
                status = "🔴" if unread > 0 else "⚪"
                chat_list += f"{status} `{c['id'][:8]}` - {c['user_name']}"
                if unread > 0:
                    chat_list += f" ({unread} новых)"
                chat_list += "\n"
            
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                        json={
                            "chat_id": chat_id_tg,
                            "text": chat_list,
                            "parse_mode": "Markdown"
                        },
                        timeout=10
                    )
            except Exception:
                pass
        else:
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                        json={"chat_id": chat_id_tg, "text": "📭 Чатов пока нет"},
                        timeout=10
                    )
            except Exception:
                pass
    
    return {"ok": True}


@router.post("/admin/chat/setup-telegram-webhook")
async def setup_telegram_chat_webhook(user=Depends(get_current_user)):
    """Setup Telegram webhook for chat bot"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not TELEGRAM_CHAT_BOT_TOKEN:
        raise HTTPException(status_code=400, detail="TELEGRAM_CHAT_BOT_TOKEN не настроен")
    
    backend_url = os.environ.get('BACKEND_URL', '')
    if not backend_url:
        raise HTTPException(status_code=400, detail="BACKEND_URL не настроен")
    
    webhook_url = f"{backend_url}/api/telegram/chat-webhook"
    
    try:
        async with httpx.AsyncClient() as client:
            await client.post(f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/deleteWebhook")
            
            res = await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/setWebhook",
                json={"url": webhook_url}
            )
            result = res.json()
            
            if result.get("ok"):
                return {"success": True, "message": "Webhook установлен", "url": webhook_url}
            else:
                raise HTTPException(status_code=400, detail=result.get("description", "Ошибка установки webhook"))
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Ошибка подключения к Telegram: {str(e)}")
