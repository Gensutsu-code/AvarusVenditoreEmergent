"""Payment routes - crypto"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
import logging

from database import db, get_current_user

router = APIRouter(tags=["payments"])
logger = logging.getLogger(__name__)


class CryptoPaymentCreate(BaseModel):
    order_id: str
    chain: str
    tx_hash: str


class CryptoWalletSettings(BaseModel):
    eth_address: str = ""
    bsc_address: str = ""
    base_address: str = ""
    trc_address: str = ""


async def create_notification(user_id: str, notif_type: str, title: str, message: str, link: str = None):
    if user_id != "ADMIN":
        settings = await db.settings.find_one({"type": "notification_settings"}, {"_id": 0})
        if settings and not settings.get("client_notifications_enabled", True):
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


async def create_admin_activity(user_id: str, user_name: str, activity_type: str, message: str):
    activity = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "type": activity_type,
        "message": message,
        "is_admin_notification": True,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.activities.insert_one(activity)


# ==================== CRYPTO ====================

@router.post("/payments/crypto/submit")
async def submit_crypto_payment(data: CryptoPaymentCreate, user=Depends(get_current_user)):
    """Submit a crypto payment transaction hash for verification"""
    order = await db.orders.find_one({"id": data.order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if order.get("payment_status") == "paid" or order.get("status") in ("cancelled", "completed"):
        raise HTTPException(status_code=400, detail="По этому заказу оплата не ожидается")
    
    await db.orders.update_one(
        {"id": data.order_id},
        {"$set": {
            "crypto_chain": data.chain,
            "crypto_tx_hash": data.tx_hash,
            "payment_status": "crypto_pending",
            "payment_method": "crypto"
        }}
    )
    
    await create_admin_activity(user["id"], user.get("name", ""), "crypto_payment", f"Крипто-оплата заказа #{data.order_id[:8]} в сети {data.chain}: {data.tx_hash[:16]}...")
    
    return {"success": True, "message": "Транзакция отправлена на проверку"}


@router.put("/admin/orders/{order_id}/confirm-crypto")
async def confirm_crypto_payment(order_id: str, user=Depends(get_current_user)):
    """Admin confirms a crypto payment"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"payment_status": "paid", "status": "processing"}}
    )
    
    await create_notification(order["user_id"], "order", "Крипто-оплата подтверждена", f"Заказ #{order_id[:8]}: криптовалютный платёж подтверждён", "/orders")
    return {"success": True}


# ==================== ADMIN CRYPTO WALLETS ====================

@router.get("/admin/crypto-wallets")
async def get_admin_crypto_wallets(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    settings = await db.settings.find_one({"key": "crypto_wallets"})
    defaults = {"eth_address": "", "bsc_address": "", "base_address": "", "trc_address": ""}
    if settings:
        return {**defaults, **settings.get("value", {})}
    return defaults


@router.put("/admin/crypto-wallets")
async def update_crypto_wallets(data: CryptoWalletSettings, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    await db.settings.update_one(
        {"key": "crypto_wallets"},
        {"$set": {"value": data.model_dump()}},
        upsert=True
    )
    return {"success": True}
