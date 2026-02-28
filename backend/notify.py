"""Centralized notification utility"""
import uuid
from datetime import datetime, timezone
from database import db


async def notify_user(user_id: str, notif_type: str, title: str, message: str, link: str = None):
    """Create notification for a specific user"""
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
    """Create notification for admin"""
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


async def notify_all_users(notif_type: str, title: str, message: str, link: str = None):
    """Create notification for all non-admin users"""
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
