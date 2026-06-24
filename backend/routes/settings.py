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
        "card_enabled": True, "crypto_enabled": True, "cash_enabled": True, "balance_enabled": True,
        "deferred_payment_enabled": False, "deferred_payment_hours": 24
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
        "card_enabled": True, "crypto_enabled": True, "cash_enabled": True, "balance_enabled": True,
        "deferred_payment_enabled": False, "deferred_payment_hours": 24
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
        "balance_enabled": data.get("balance_enabled", True),
        "deferred_payment_enabled": bool(data.get("deferred_payment_enabled", False)),
        "deferred_payment_hours": int(data.get("deferred_payment_hours", 24) or 24),
    }
    await db.settings.update_one(
        {"key": "payment_settings"},
        {"$set": {"value": settings_data}},
        upsert=True
    )
    return {"success": True}


# ==================== OZON CERTIFICATE SETTINGS ====================

OZON_DEFAULTS = {
    "ozon_enabled": True,
    "ozon_step": 10000,   # ₽ of order goods per tranche
    "ozon_reward": 500,   # ₽ certificate granted per tranche
}

@router.get("/ozon-settings")
async def get_ozon_settings():
    """Get Ozon certificate settings (public, used by cart bar)"""
    settings = await db.settings.find_one({"key": "ozon_certificate_settings"})
    if settings:
        return {**OZON_DEFAULTS, **settings.get("value", {})}
    return OZON_DEFAULTS


@router.put("/admin/ozon-settings")
async def update_ozon_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    value = {
        "ozon_enabled": bool(data.get("ozon_enabled", True)),
        "ozon_step": max(1, int(data.get("ozon_step", 10000) or 10000)),
        "ozon_reward": max(0, int(data.get("ozon_reward", 500) or 500)),
    }
    await db.settings.update_one(
        {"key": "ozon_certificate_settings"},
        {"$set": {"key": "ozon_certificate_settings", "value": value}},
        upsert=True
    )
    return {"success": True, **value}




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


# ==================== CARD PAYMENT SETTINGS ====================

CARD_PAY_DEFAULTS = {
    "mode": "global",  # 'global' | 'per_order'
    "card_number": "",
    "recipient_name": "",
    "bank": "",
    "comment": "",
    "qr_url": "",
}


@router.get("/card-payment-settings")
async def get_card_payment_settings():
    """Client-facing: payment mode + global requisites (if global mode)."""
    s = await db.settings.find_one({"key": "card_payment_settings"})
    val = {**CARD_PAY_DEFAULTS, **((s or {}).get("value", {}))}
    return val


@router.put("/admin/card-payment-settings")
async def update_card_payment_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    mode = data.get("mode", "global")
    if mode not in ("global", "per_order"):
        mode = "global"
    val = {
        "mode": mode,
        "card_number": str(data.get("card_number", ""))[:64],
        "recipient_name": str(data.get("recipient_name", ""))[:128],
        "bank": str(data.get("bank", ""))[:128],
        "comment": str(data.get("comment", ""))[:512],
        "qr_url": str(data.get("qr_url", ""))[:1024],
    }
    await db.settings.update_one(
        {"key": "card_payment_settings"},
        {"$set": {"value": val}},
        upsert=True
    )
    return {"success": True}



@router.get("/stock-sync-settings")
async def get_stock_sync_settings():
    """Get global stock-sync setting (public)."""
    settings = await db.settings.find_one({"key": "stock_sync_settings"})
    enabled = (settings.get("value", {}) if settings else {}).get("stock_sync_enabled", True)
    return {"stock_sync_enabled": enabled}


@router.put("/admin/stock-sync-settings")
async def update_stock_sync_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    await db.settings.update_one(
        {"key": "stock_sync_settings"},
        {"$set": {"value": {"stock_sync_enabled": bool(data.get("stock_sync_enabled", True))}}},
        upsert=True
    )
    return {"success": True}



# ==================== RETURN SETTINGS ====================

RETURN_DEFAULTS = {
    "fee_percent": 10,
    "min_photos": 1,
    "max_photos": 5,
    "return_window_days": 0,  # 0 = без ограничения по сроку
    "warranty_enabled": True,
    "desc_return": "Вернуть деньги на внутренний баланс. Удерживается комиссия и списываются начисленные бонусные баллы.",
    "desc_warranty": "Замена товара на новый 1:1 без удержаний и списания бонусов.",
    "warning_text": "При стандартном возврате удерживается комиссия от стоимости товара. Также будут списаны бонусные баллы, начисленные за возвращаемые позиции. Деньги будут зачислены на ваш внутренний баланс после одобрения администратором.",
    "policy_text": "Возврат возможен только для выполненных заказов. К заявке необходимо приложить фото товара (минимум одно). После одобрения администратором деньги зачисляются на внутренний баланс с удержанием комиссии. Гарантийная замена производится 1:1 без удержаний.",
}


async def _get_return_settings():
    settings = await db.settings.find_one({"key": "return_settings"})
    if settings:
        return {**RETURN_DEFAULTS, **settings.get("value", {})}
    return dict(RETURN_DEFAULTS)


@router.get("/return-settings")
async def get_return_settings():
    """Get return rules & policy (public)"""
    return await _get_return_settings()


@router.get("/admin/return-settings")
async def get_admin_return_settings(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await _get_return_settings()


@router.put("/admin/return-settings")
async def update_return_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    def num(v, default, lo=None, hi=None):
        try:
            n = float(v)
        except (TypeError, ValueError):
            n = float(default)
        if lo is not None:
            n = max(lo, n)
        if hi is not None:
            n = min(hi, n)
        return n

    min_p = int(num(data.get("min_photos", 1), 1, 0, 20))
    max_p = int(num(data.get("max_photos", 5), 5, 1, 20))
    if max_p < max(1, min_p):
        max_p = max(1, min_p)

    settings_data = {
        "fee_percent": round(num(data.get("fee_percent", 10), 10, 0, 100), 2),
        "min_photos": min_p,
        "max_photos": max_p,
        "return_window_days": int(num(data.get("return_window_days", 0), 0, 0, 3650)),
        "warranty_enabled": bool(data.get("warranty_enabled", True)),
        "desc_return": str(data.get("desc_return", RETURN_DEFAULTS["desc_return"]))[:2000],
        "desc_warranty": str(data.get("desc_warranty", RETURN_DEFAULTS["desc_warranty"]))[:2000],
        "warning_text": str(data.get("warning_text", RETURN_DEFAULTS["warning_text"]))[:3000],
        "policy_text": str(data.get("policy_text", RETURN_DEFAULTS["policy_text"]))[:5000],
    }
    await db.settings.update_one(
        {"key": "return_settings"},
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
