"""Settings routes (payments, promo banner, telegram)"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
from database import db, get_current_user
from models import PaymentMethodSettings, TelegramSettings, PromoBannerUpdate

router = APIRouter(tags=["settings"])


# ==================== DISCOUNT SETTINGS (DEPRECATED - kept for compatibility) ====================

@router.get("/discount-settings")
async def get_discount_settings():
    """Deprecated - returns empty discounts"""
    return {
        "retail_discount": 0,
        "wholesale_discount": 0,
        "partner_discount": 0
    }


@router.get("/admin/discount-settings")
async def get_admin_discount_settings(user=Depends(get_current_user)):
    """Deprecated - returns empty discounts"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return {
        "retail_discount": 0,
        "wholesale_discount": 0,
        "partner_discount": 0
    }


@router.put("/admin/discount-settings")
async def update_discount_settings(user=Depends(get_current_user)):
    """Deprecated - does nothing"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"success": True}


# ==================== PAYMENT SETTINGS ====================

@router.get("/payment-settings")
async def get_payment_settings():
    """Get payment method settings (public)"""
    defaults = {
        "card_adjustment": 0, "crypto_adjustment": 0, "cash_adjustment": 0, "balance_adjustment": 0,
        "card_enabled": True, "crypto_enabled": True, "cash_enabled": True, "balance_enabled": True
    }
    settings = await db.settings.find_one({"key": "payment_settings"})
    if settings:
        val = settings.get("value", {})
        return {**defaults, **val}
    return defaults


@router.get("/admin/payment-settings")
async def get_admin_payment_settings(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    defaults = {
        "card_adjustment": 0, "crypto_adjustment": 0, "cash_adjustment": 0, "balance_adjustment": 0,
        "card_enabled": True, "crypto_enabled": True, "cash_enabled": True, "balance_enabled": True
    }
    settings = await db.settings.find_one({"key": "payment_settings"})
    if settings:
        val = settings.get("value", {})
        return {**defaults, **val}
    return defaults


@router.put("/admin/payment-settings")
async def update_payment_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    settings_data = {
        "card_adjustment": data.get("card_adjustment", 0),
        "crypto_adjustment": data.get("crypto_adjustment", 0),
        "cash_adjustment": data.get("cash_adjustment", 0),
        "balance_adjustment": data.get("balance_adjustment", 0),
        "card_enabled": data.get("card_enabled", True),
        "crypto_enabled": data.get("crypto_enabled", True),
        "cash_enabled": data.get("cash_enabled", True),
        "balance_enabled": data.get("balance_enabled", True)
    }
    await db.settings.update_one(
        {"key": "payment_settings"},
        {"$set": {"value": settings_data}},
        upsert=True
    )
    return {"success": True}



# ==================== DELIVERY SETTINGS ====================

DELIVERY_DEFAULTS = {
    "min_free_delivery": 5000,
    "delivery_price": 500,
    "delivery_enabled": True
}

@router.get("/delivery-settings")
async def get_delivery_settings():
    """Get delivery settings (public)"""
    settings = await db.settings.find_one({"key": "delivery_settings"})
    if settings:
        return {**DELIVERY_DEFAULTS, **settings.get("value", {})}
    return DELIVERY_DEFAULTS


@router.get("/admin/delivery-settings")
async def get_admin_delivery_settings(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    settings = await db.settings.find_one({"key": "delivery_settings"})
    if settings:
        return {**DELIVERY_DEFAULTS, **settings.get("value", {})}
    return DELIVERY_DEFAULTS


@router.put("/admin/delivery-settings")
async def update_delivery_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    settings_data = {
        "min_free_delivery": data.get("min_free_delivery", 5000),
        "delivery_price": data.get("delivery_price", 500),
        "delivery_enabled": data.get("delivery_enabled", True)
    }
    await db.settings.update_one(
        {"key": "delivery_settings"},
        {"$set": {"value": settings_data}},
        upsert=True
    )
    return {"success": True}



# ==================== CRYPTO WALLETS ====================

@router.get("/crypto-wallets")
async def get_crypto_wallets():
    """Get crypto wallet addresses (public)"""
    settings = await db.settings.find_one({"key": "crypto_wallets"})
    if settings:
        return settings.get("value", {})
    return {"eth": "", "bsc": "", "base": "", "trc": ""}


@router.put("/admin/crypto-wallets")
async def update_crypto_wallets(wallets: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"key": "crypto_wallets"},
        {"$set": {"value": wallets}},
        upsert=True
    )
    return {"success": True}


# ==================== PROMO BANNER ====================

@router.get("/promo-banner")
async def get_promo_banner():
    settings = await db.settings.find_one({"key": "promo_banner"})
    if settings:
        return settings.get("value", {"enabled": False, "text": ""})
    return {"enabled": False, "text": ""}


@router.put("/admin/promo-banner")
async def update_promo_banner(data: PromoBannerUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"key": "promo_banner"},
        {"$set": {"value": data.model_dump()}},
        upsert=True
    )
    return {"success": True}


# ==================== TELEGRAM SETTINGS ====================

@router.get("/admin/telegram-settings")
async def get_telegram_settings(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.settings.find_one({"key": "telegram_settings"})
    if settings:
        return settings.get("value", {"enabled": False, "bot_token": "", "chat_id": ""})
    return {"enabled": False, "bot_token": "", "chat_id": ""}


@router.put("/admin/telegram-settings")
async def update_telegram_settings(data: TelegramSettings, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings_data = data.model_dump()
    
    await db.settings.update_one(
        {"key": "telegram_settings"},
        {"$set": {"value": settings_data}},
        upsert=True
    )
    
    # Sync chat_id to chat bot settings and order notification settings
    if settings_data.get("chat_id"):
        await db.telegram_chat_settings.update_one(
            {"setting_type": "chat_bot"},
            {"$set": {"admin_chat_id": settings_data["chat_id"], "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        await db.settings.update_one(
            {"key": "telegram"},
            {"$set": {"key": "telegram", "value": {
                "enabled": settings_data.get("enabled", False),
                "bot_token": settings_data.get("bot_token", ""),
                "chat_id": settings_data["chat_id"]
            }}},
            upsert=True
        )
    
    return {"success": True}
