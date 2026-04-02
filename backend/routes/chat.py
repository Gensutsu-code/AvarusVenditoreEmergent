"""Chat routes"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime, timezone
import uuid
import httpx
import os
import logging

from database import db, get_current_user
from models import ChatMessage
from notify import notify_user, notify_admin

router = APIRouter(tags=["chat"])

TELEGRAM_CHAT_BOT_TOKEN = os.environ.get('TELEGRAM_CHAT_BOT_TOKEN')


async def send_to_telegram_chat(chat_id: str, user_name: str, text: str, message_type: str = "text", file_url: str = None):
    """Send user message to Telegram for admin to see"""
    if not TELEGRAM_CHAT_BOT_TOKEN:
        return
    
    settings = await db.telegram_chat_settings.find_one({"setting_type": "chat_bot"})
    if not settings or not settings.get("admin_chat_id"):
        return
    
    admin_tg_chat_id = settings["admin_chat_id"]
    
    formatted_text = "💬 *Новое сообщение в чат*\n\n"
    formatted_text += f"👤 *От:* {user_name}\n"
    formatted_text += f"🆔 *Чат:* `{chat_id[:8]}...`\n\n"
    
    if message_type == "text":
        formatted_text += f"📝 {text}"
    elif message_type == "image":
        formatted_text += f"🖼 *Изображение*\n{file_url}"
    elif message_type == "file":
        formatted_text += f"📎 *Файл*\n{file_url}"
    
    formatted_text += f"\n\n💡 _Чтобы ответить, используйте команду:_\n`/reply {chat_id} Ваш ответ`"
    
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": admin_tg_chat_id,
                    "text": formatted_text,
                    "parse_mode": "Markdown"
                },
                timeout=10
            )
    except Exception as e:
        logging.error(f"Failed to send to Telegram chat: {e}")


async def send_admin_reply_to_telegram(chat_id: str, text: str):
    """Send admin reply to Telegram so admin sees full conversation"""
    if not TELEGRAM_CHAT_BOT_TOKEN:
        return

    settings = await db.telegram_chat_settings.find_one({"setting_type": "chat_bot"})
    if not settings or not settings.get("admin_chat_id"):
        return

    admin_tg_chat_id = settings["admin_chat_id"]

    formatted_text = f"✅ *Ответ отправлен*\n\n"
    formatted_text += f"🆔 *Чат:* `{chat_id[:8]}...`\n\n"
    formatted_text += f"📝 {text}"

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": admin_tg_chat_id,
                    "text": formatted_text,
                    "parse_mode": "Markdown"
                },
                timeout=10
            )
    except Exception as e:
        logging.error(f"Failed to send admin reply to Telegram: {e}")


# ==================== USER CHAT ====================

@router.post("/chat/send")
async def send_chat_message(message: ChatMessage, user=Depends(get_current_user)):
    """Send a chat message"""
    chat = await db.chats.find_one({"user_id": user["id"]})
    if not chat:
        chat_id = str(uuid.uuid4())
        await db.chats.insert_one({
            "id": chat_id,
            "user_id": user["id"],
            "user_name": user["name"],
            "user_email": user["email"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "pinned": False,
            "labels": []
        })
    else:
        chat_id = chat["id"]
        await db.chats.update_one({"id": chat_id}, {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    
    msg_id = str(uuid.uuid4())
    chat_message = {
        "id": msg_id,
        "chat_id": chat_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "text": message.text,
        "sender_type": "user",
        "message_type": "text",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
        "edited": False
    }
    await db.chat_messages.insert_one(chat_message)
    
    await send_to_telegram_chat(chat_id, user["name"], message.text)
    
    # Notify admin about new message
    await notify_admin("chat", "Новое сообщение", f"{user['name']}: {message.text[:80]}", "/admin/chats")
    
    return {"id": msg_id, "chat_id": chat_id}


@router.get("/chat/messages")
async def get_chat_messages(user=Depends(get_current_user)):
    """Get chat messages for current user"""
    chat = await db.chats.find_one({"user_id": user["id"]})
    if not chat:
        return {"messages": [], "chat_id": None}
    
    messages = await db.chat_messages.find({"chat_id": chat["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"messages": messages, "chat_id": chat["id"]}


@router.get("/chat/unread-count")
async def get_unread_count(user=Depends(get_current_user)):
    """Get unread message count for current user"""
    chat = await db.chats.find_one({"user_id": user["id"]})
    if not chat:
        return {"count": 0}
    
    count = await db.chat_messages.count_documents({
        "chat_id": chat["id"],
        "sender_type": "admin",
        "read": False
    })
    return {"count": count}


@router.post("/chat/mark-read")
async def mark_messages_read(user=Depends(get_current_user)):
    """Mark admin messages as read"""
    chat = await db.chats.find_one({"user_id": user["id"]})
    if chat:
        await db.chat_messages.update_many(
            {"chat_id": chat["id"], "sender_type": "admin", "read": False},
            {"$set": {"read": True}}
        )
    return {"success": True}


# ==================== ADMIN CHAT ====================

@router.get("/admin/chats")
async def get_all_chats(user=Depends(get_current_user)):
    """Get all chats for admin"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    chats = await db.chats.find({}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    
    for chat in chats:
        unread_count = await db.chat_messages.count_documents({
            "chat_id": chat["id"],
            "sender_type": "user",
            "read": False
        })
        chat["unread_count"] = unread_count
        # Get last message text
        last_msg = await db.chat_messages.find_one(
            {"chat_id": chat["id"]}, {"_id": 0, "text": 1},
            sort=[("created_at", -1)]
        )
        chat["last_message"] = last_msg.get("text", "") if last_msg else ""
    
    return chats


@router.get("/admin/chats/{chat_id}/messages")
async def get_chat_messages_admin(chat_id: str, user=Depends(get_current_user)):
    """Get messages for specific chat (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    messages = await db.chat_messages.find({"chat_id": chat_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    
    await db.chat_messages.update_many(
        {"chat_id": chat_id, "sender_type": "user", "read": False},
        {"$set": {"read": True}}
    )
    
    return {"messages": messages}


@router.post("/admin/chats/{chat_id}/send")
async def send_admin_message(chat_id: str, message: ChatMessage, user=Depends(get_current_user)):
    """Send message as admin"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    chat = await db.chats.find_one({"id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    msg_id = str(uuid.uuid4())
    chat_message = {
        "id": msg_id,
        "chat_id": chat_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "text": message.text,
        "sender_type": "admin",
        "message_type": "text",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
        "edited": False
    }
    await db.chat_messages.insert_one(chat_message)
    
    await db.chats.update_one({"id": chat_id}, {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    
    # Send reply to Telegram
    await send_admin_reply_to_telegram(chat_id, message.text)
    
    # Notify client about admin reply
    await notify_user(chat["user_id"], "chat", "Ответ поддержки", f"{message.text[:80]}", "/chat")
    
    return {"id": msg_id}


@router.delete("/admin/chats/{chat_id}")
async def delete_chat(chat_id: str, user=Depends(get_current_user)):
    """Delete a chat and all its messages"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.chats.delete_one({"id": chat_id})
    await db.chat_messages.delete_many({"chat_id": chat_id})
    
    return {"message": "Chat deleted"}


@router.put("/admin/chats/{chat_id}/pin")
async def toggle_pin_chat(chat_id: str, user=Depends(get_current_user)):
    """Toggle pin status of a chat"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    chat = await db.chats.find_one({"id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    new_pinned = not chat.get("pinned", False)
    await db.chats.update_one({"id": chat_id}, {"$set": {"pinned": new_pinned}})
    
    return {"pinned": new_pinned}


@router.put("/admin/chats/{chat_id}/label")
async def update_chat_label(chat_id: str, label: str = "", user=Depends(get_current_user)):
    """Add or remove label from chat"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    chat = await db.chats.find_one({"id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    labels = chat.get("labels", [])
    if label in labels:
        labels.remove(label)
    else:
        labels.append(label)
    
    await db.chats.update_one({"id": chat_id}, {"$set": {"labels": labels}})
    return {"labels": labels}


@router.put("/admin/chats/{chat_id}/messages/{message_id}")
async def edit_chat_message(chat_id: str, message_id: str, message: ChatMessage, user=Depends(get_current_user)):
    """Edit a chat message"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.chat_messages.update_one(
        {"id": message_id, "chat_id": chat_id},
        {"$set": {"text": message.text, "edited": True, "edited_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"message": "Message updated"}


@router.delete("/admin/chats/{chat_id}/messages/{message_id}")
async def delete_chat_message(chat_id: str, message_id: str, user=Depends(get_current_user)):
    """Delete a chat message"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.chat_messages.delete_one({"id": message_id, "chat_id": chat_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"message": "Message deleted"}
