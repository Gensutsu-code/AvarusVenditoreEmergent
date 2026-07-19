"""Payment routes - YooKassa and Crypto"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
import os
import logging

from database import db, get_current_user

router = APIRouter(tags=["payments"])
logger = logging.getLogger(__name__)


class YuKassaPaymentCreate(BaseModel):
    order_id: str
    amount: float
    return_url: str


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


# ==================== YOOKASSA ====================

@router.post("/payments/yookassa/create")
async def create_yookassa_payment(data: YuKassaPaymentCreate, user=Depends(get_current_user)):
    """Create a YuKassa payment for card payment"""
    shop_id = os.environ.get("YOOKASSA_SHOP_ID")
    secret_key = os.environ.get("YOOKASSA_SECRET_KEY")
    
    if not shop_id or not secret_key:
        raise HTTPException(status_code=503, detail="ЮKassa не настроена. Обратитесь к администратору.")
    
    from yookassa import Configuration, Payment as YKPayment
    Configuration.configure(account_id=shop_id, secret_key=secret_key)
    
    order = await db.orders.find_one({"id": data.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    try:
        payment = YKPayment.create({
            "amount": {"value": str(data.amount), "currency": "RUB"},
            "confirmation": {"type": "redirect", "return_url": data.return_url},
            "capture": True,
            "description": f"Оплата заказа #{data.order_id[:8]}",
            "metadata": {"order_id": data.order_id}
        }, idempotence_key=str(uuid.uuid4()))
        
        await db.orders.update_one(
            {"id": data.order_id},
            {"$set": {
                "yookassa_payment_id": payment.id,
                "payment_status": "pending"
            }}
        )
        
        confirmation_url = payment.confirmation.confirmation_url if hasattr(payment.confirmation, 'confirmation_url') else None
        return {"payment_id": payment.id, "confirmation_url": confirmation_url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payments/yookassa/webhook")
async def yookassa_webhook(request: Request):
    """Handle YuKassa webhook notifications"""
    import json
    body = await request.body()
    payload = json.loads(body)
    
    event = payload.get("event")
    payment_data = payload.get("object", {})
    order_id = payment_data.get("metadata", {}).get("order_id")
    
    if event == "payment.succeeded" and order_id:
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"payment_status": "paid", "status": "processing"}}
        )
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if order:
            await create_notification(order["user_id"], "order", "Оплата получена", f"Заказ #{order_id[:8]} оплачен картой", "/orders")
    elif event == "payment.canceled" and order_id:
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"payment_status": "cancelled"}}
        )
    
    return {"status": "ok"}


@router.get("/payments/yookassa/check/{order_id}")
async def check_yookassa_payment(order_id: str, user=Depends(get_current_user)):
    """Check YuKassa payment status"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    payment_id = order.get("yookassa_payment_id")
    if not payment_id:
        return {"status": "no_payment"}
    
    shop_id = os.environ.get("YOOKASSA_SHOP_ID")
    secret_key = os.environ.get("YOOKASSA_SECRET_KEY")
    
    if shop_id and secret_key:
        from yookassa import Configuration, Payment as YKPayment
        Configuration.configure(account_id=shop_id, secret_key=secret_key)
        try:
            payment = YKPayment.find_one(payment_id)
            if payment.status == "succeeded" and order.get("payment_status") != "paid":
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {"payment_status": "paid", "status": "processing"}}
                )
            return {"status": payment.status, "paid": payment.paid}
        except Exception:
            pass
    
    return {"status": order.get("payment_status", "pending")}


# ==================== CRYPTO ====================

@router.post("/payments/crypto/submit")
async def submit_crypto_payment(data: CryptoPaymentCreate, user=Depends(get_current_user)):
    """Submit a crypto payment transaction hash for verification"""
    order = await db.orders.find_one({"id": data.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
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
