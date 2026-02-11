"""Settings routes (discounts, payments, promo banner, telegram)"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from database import db, get_current_user
from models import DiscountSettingsUpdate, PaymentMethodSettings, TelegramSettings, PromoBannerUpdate

router = APIRouter(tags=["settings"])


# ==================== DISCOUNT SETTINGS ====================

@router.get("/discount-settings")
async def get_discount_settings():
    """Get discount settings for each status (public)"""
    defaults = {
        "retail_discount": 0,
        "wholesale_discount": 0,
        "partner_discount": 0,
        "wholesale_threshold": 50000,
        "partner_threshold": 200000
    }
    settings = await db.settings.find_one({"key": "discount_settings"})
    if settings:
        val = settings.get("value", {})
        return {**defaults, **val}
    return defaults


@router.get("/admin/discount-settings")
async def get_admin_discount_settings(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    defaults = {
        "retail_discount": 0,
        "wholesale_discount": 0,
        "partner_discount": 0,
        "wholesale_threshold": 50000,
        "partner_threshold": 200000
    }
    settings = await db.settings.find_one({"key": "discount_settings"})
    if settings:
        val = settings.get("value", {})
        return {**defaults, **val}
    return defaults


@router.put("/admin/discount-settings")
async def update_discount_settings(data: DiscountSettingsUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings_data = data.model_dump()
    await db.settings.update_one(
        {"key": "discount_settings"},
        {"$set": {"value": settings_data}},
        upsert=True
    )
    return {"success": True}


# ==================== PAYMENT SETTINGS ====================

@router.get("/payment-settings")
async def get_payment_settings():
    """Get payment method settings (public)"""
    defaults = {
        "card_discount": 0, "crypto_discount": 0, "cash_discount": 0,
        "card_enabled": True, "crypto_enabled": True, "cash_enabled": True
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
        "card_discount": 0, "crypto_discount": 0, "cash_discount": 0,
        "card_enabled": True, "crypto_enabled": True, "cash_enabled": True
    }
    settings = await db.settings.find_one({"key": "payment_settings"})
    if settings:
        val = settings.get("value", {})
        return {**defaults, **val}
    return defaults


@router.put("/admin/payment-settings")
async def update_payment_settings(data: PaymentMethodSettings, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    settings_data = {
        "card_discount": data.card_discount,
        "crypto_discount": data.crypto_discount,
        "cash_discount": data.cash_discount,
        "card_enabled": data.card_enabled,
        "crypto_enabled": data.crypto_enabled,
        "cash_enabled": data.cash_enabled
    }
    await db.settings.update_one(
        {"key": "payment_settings"},
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
    
    await db.settings.update_one(
        {"key": "telegram_settings"},
        {"$set": {"value": data.model_dump()}},
        upsert=True
    )
    return {"success": True}
