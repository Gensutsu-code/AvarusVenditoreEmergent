"""Centralized notification utility"""
import uuid
import os
import httpx
import logging
from datetime import datetime, timezone
from database import db

logger = logging.getLogger(__name__)

TELEGRAM_CHAT_BOT_TOKEN = os.environ.get('TELEGRAM_CHAT_BOT_TOKEN')


async def _client_notifs_enabled():
    settings = await db.settings.find_one({"type": "notification_settings"}, {"_id": 0})
    return settings.get("client_notifications_enabled", True) if settings else True


async def _send_telegram_admin_notification(title: str, message: str):
    """Forward admin notification to Telegram channel"""
    from routes.features import is_on
    if not is_on("telegram"):
        return
    bot_token = None
    chat_id = None
    
    # Try DB settings first
    settings = await db.settings.find_one({"key": "telegram"}, {"_id": 0})
    if settings and settings.get("value", {}):
        tg_settings = settings.get("value", {})
        bot_token = tg_settings.get("bot_token")
        chat_id = tg_settings.get("chat_id")
    
    # Fallback to env token
    if not bot_token:
        bot_token = TELEGRAM_CHAT_BOT_TOKEN
    
    # Fallback to chat bot admin_chat_id
    if not chat_id:
        chat_settings = await db.telegram_chat_settings.find_one({"setting_type": "chat_bot"})
        if chat_settings:
            chat_id = chat_settings.get("admin_chat_id")
    
    if not bot_token or not chat_id:
        return
    
    text = f"🔔 *{title}*\n\n{message}"
    
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "Markdown"
                },
                timeout=10
            )
    except Exception as e:
        logger.error(f"Failed to send admin Telegram notification: {e}")


async def notify_user(user_id: str, notif_type: str, title: str, message: str, link: str = None):
    """Create notification for a specific user"""
    if not await _client_notifs_enabled():
        return
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "link": link,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)


async def notify_admin(notif_type: str, title: str, message: str, link: str = None):
    """Create notification for admin and forward to Telegram"""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": "ADMIN",
        "type": notif_type,
        "title": title,
        "message": message,
        "link": link,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    # Forward to Telegram
    await _send_telegram_admin_notification(title, message)


async def notify_all_users(notif_type: str, title: str, message: str, link: str = None):
    """Create notification for all non-admin users"""
    if not await _client_notifs_enabled():
        return
    users = await db.users.find({"role": {"$ne": "admin"}}, {"_id": 0, "id": 1}).to_list(None)
    if not users:
        return
    notifications = []
    now = datetime.now(timezone.utc).isoformat()
    for u in users:
        notifications.append({
            "id": str(uuid.uuid4()),
            "user_id": u["id"],
            "type": notif_type,
            "title": title,
            "message": message,
            "link": link,
            "read": False,
            "created_at": now
        })
    if notifications:
        await db.notifications.insert_many(notifications)
