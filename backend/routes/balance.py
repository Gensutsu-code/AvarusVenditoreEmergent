"""User balance and prepayment routes"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid
import math

from database import db, get_current_user
from notify import notify_user

router = APIRouter(tags=["balance"])


class TopupRequest(BaseModel):
    amount: float
    method: str  # 'card' or 'crypto'
    crypto_chain: Optional[str] = None  # eth, bsc, base, trc
    tx_hash: Optional[str] = None  # for crypto payments


class BalanceTransaction(BaseModel):
    id: str
    user_id: str
    type: str  # 'topup', 'payment', 'refund'
    amount: float
    method: Optional[str] = None
    order_id: Optional[str] = None
    status: str  # 'pending', 'completed', 'failed'
    created_at: str
    description: Optional[str] = None


class PrepaymentSettings(BaseModel):
    prepayment_enabled: bool = True
    min_topup_amount: float = 500
    max_topup_amount: float = 100000


# Get user balance
@router.get("/user/balance")
async def get_user_balance(user=Depends(get_current_user)):
    """Get current user's balance"""
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "balance": 1})
    balance = user_data.get("balance", 0) if user_data else 0
    return {"balance": balance}


# Get balance history
@router.get("/user/balance/history")
async def get_balance_history(user=Depends(get_current_user), limit: int = 50):
    """Get user's balance transaction history"""
    transactions = await db.balance_transactions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=limit)
    
    return {"transactions": transactions}


MAX_PENDING_TOPUPS = 5


async def _pending_topup(transaction_id: str) -> dict:
    t = await db.balance_transactions.find_one({"id": transaction_id, "type": "topup", "status": "pending"}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена или уже обработана")
    return t


@router.post("/user/balance/topup")
async def topup_balance(data: TopupRequest, user=Depends(get_current_user)):
    """Creates a top-up request. The balance grows only after the admin confirms that the money has arrived."""
    settings = await db.settings.find_one({"type": "prepayment_settings"}, {"_id": 0}) or {}
    min_amount = settings.get("min_topup_amount", 500)
    max_amount = settings.get("max_topup_amount", 100000)
    if not settings.get("prepayment_enabled", True):
        raise HTTPException(status_code=400, detail="Предоплата временно отключена")
    if not math.isfinite(data.amount) or data.amount < min_amount:
        raise HTTPException(status_code=400, detail=f"Минимальная сумма пополнения: {min_amount}₽")
    if data.amount > max_amount:
        raise HTTPException(status_code=400, detail=f"Максимальная сумма пополнения: {max_amount}₽")
    if data.method not in ("card", "crypto"):
        raise HTTPException(status_code=400, detail="Неизвестный способ пополнения")
    if await db.balance_transactions.count_documents({"user_id": user["id"], "type": "topup", "status": "pending"}) >= MAX_PENDING_TOPUPS:
        raise HTTPException(status_code=400, detail="У вас уже есть необработанные заявки на пополнение. Дождитесь их подтверждения.")

    is_crypto = data.method == "crypto"
    chain = (data.crypto_chain or "eth").lower()
    wallet_address = ""
    if is_crypto:
        wallets = ((await db.settings.find_one({"key": "crypto_wallets"}, {"_id": 0})) or {}).get("value", {})
        wallet_address = wallets.get(f"{chain}_address", "")
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "topup",
        "amount": round(data.amount, 2),
        "method": f"crypto_{chain}" if is_crypto else "card",
        "status": "pending",
        "tx_hash": (data.tx_hash or "").strip()[:128] or None if is_crypto else None,
        "requisites": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "description": f"Пополнение криптовалютой ({chain.upper()})" if is_crypto else "Пополнение картой",
    }
    await db.balance_transactions.insert_one(dict(transaction))
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": "ADMIN",
        "type": "balance_topup",
        "title": "Заявка на пополнение баланса",
        "message": f"Клиент {user.get('name') or user.get('email')} хочет пополнить баланс на {transaction['amount']}₽ ({'криптовалюта' if is_crypto else 'карта'})",
        "link": "/admin",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {
        "transaction_id": transaction["id"],
        "status": "pending",
        "amount": transaction["amount"],
        "wallet_address": wallet_address,
        "message": "Заявка создана. Переведите средства на указанный адрес — баланс пополнится после подтверждения администратором."
        if is_crypto else "Заявка создана. Реквизиты для перевода придут в уведомлении и появятся в истории баланса.",
    }


@router.post("/user/balance/confirm-crypto")
async def confirm_crypto_topup(transaction_id: str, tx_hash: str, user=Depends(get_current_user)):
    """The client attaches the transaction hash to his request; the admin still confirms it."""
    t = await _pending_topup(transaction_id)
    if t["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Заявка не найдена или уже обработана")
    await db.balance_transactions.update_one({"id": transaction_id, "status": "pending"}, {"$set": {"tx_hash": tx_hash.strip()[:128]}})
    return {"status": "pending", "amount": t["amount"], "message": "Номер транзакции сохранён. Баланс пополнится после подтверждения администратором."}


class TopupRequisites(BaseModel):
    card_number: str = Field(default="", max_length=64)
    recipient_name: str = Field(default="", max_length=128)
    bank: str = Field(default="", max_length=128)
    comment: str = Field(default="", max_length=512)
    qr_url: str = Field(default="", max_length=1024)


def _admin(user):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/admin/balance-topups")
async def admin_topup_requests(user=Depends(get_current_user)):
    _admin(user)
    items = await db.balance_transactions.find({"type": "topup", "status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(200)
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": [t["user_id"] for t in items]}}, {"_id": 0, "id": 1, "name": 1, "email": 1})}
    for t in items:
        t["user_name"] = users.get(t["user_id"], {}).get("name", "")
        t["user_email"] = users.get(t["user_id"], {}).get("email", "")
    return items


@router.post("/admin/balance-topups/{transaction_id}/requisites")
async def admin_topup_requisites(transaction_id: str, data: TopupRequisites, user=Depends(get_current_user)):
    _admin(user)
    t = await _pending_topup(transaction_id)
    if t["method"] != "card":
        raise HTTPException(status_code=400, detail="Реквизиты выдаются только для пополнения картой")
    if not data.card_number.strip() and not data.qr_url.strip():
        raise HTTPException(status_code=400, detail="Укажите номер карты или QR-код")
    await db.balance_transactions.update_one({"id": transaction_id, "status": "pending"}, {"$set": {"requisites": data.model_dump(), "requisites_at": datetime.now(timezone.utc).isoformat()}})
    await notify_user(t["user_id"], "balance", "Реквизиты для пополнения баланса", f"Выданы реквизиты для перевода {t['amount']}₽. Откройте историю баланса.", "/account")
    return {"success": True}


@router.post("/admin/balance-topups/{transaction_id}/confirm")
async def admin_topup_confirm(transaction_id: str, user=Depends(get_current_user)):
    _admin(user)
    t = await _pending_topup(transaction_id)
    now = datetime.now(timezone.utc).isoformat()
    claimed = await db.balance_transactions.update_one(
        {"id": transaction_id, "status": "pending"},
        {"$set": {"status": "completed", "completed_at": now, "confirmed_by": user["id"]}},
    )
    if claimed.modified_count == 0:
        raise HTTPException(status_code=404, detail="Заявка не найдена или уже обработана")
    await db.users.update_one({"id": t["user_id"]}, {"$inc": {"balance": t["amount"]}})
    await notify_user(t["user_id"], "balance", "Баланс пополнен", f"На ваш баланс зачислено {t['amount']}₽", "/account")
    return {"success": True}


@router.post("/admin/balance-topups/{transaction_id}/reject")
async def admin_topup_reject(transaction_id: str, user=Depends(get_current_user)):
    _admin(user)
    t = await _pending_topup(transaction_id)
    claimed = await db.balance_transactions.update_one(
        {"id": transaction_id, "status": "pending"},
        {"$set": {"status": "failed", "completed_at": datetime.now(timezone.utc).isoformat(), "confirmed_by": user["id"]}},
    )
    if claimed.modified_count == 0:
        raise HTTPException(status_code=404, detail="Заявка не найдена или уже обработана")
    await notify_user(t["user_id"], "balance", "Заявка на пополнение отклонена", f"Заявка на пополнение баланса на {t['amount']}₽ отклонена", "/account")
    return {"success": True}


# Get prepayment settings (public)
@router.get("/prepayment-settings")
async def get_prepayment_settings():
    """Get prepayment settings for frontend"""
    settings = await db.settings.find_one({"type": "prepayment_settings"}, {"_id": 0})
    
    if not settings:
        return {
            "prepayment_enabled": True,
            "min_topup_amount": 500,
            "max_topup_amount": 100000
        }
    
    return {
        "prepayment_enabled": settings.get("prepayment_enabled", True),
        "min_topup_amount": settings.get("min_topup_amount", 500),
        "max_topup_amount": settings.get("max_topup_amount", 100000)
    }


# Admin: Get prepayment settings
@router.get("/admin/prepayment-settings")
async def get_admin_prepayment_settings(user=Depends(get_current_user)):
    """Get prepayment settings for admin"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.settings.find_one({"type": "prepayment_settings"}, {"_id": 0})
    
    if not settings:
        return {
            "prepayment_enabled": True,
            "min_topup_amount": 500,
            "max_topup_amount": 100000
        }
    
    return {
        "prepayment_enabled": settings.get("prepayment_enabled", True),
        "min_topup_amount": settings.get("min_topup_amount", 500),
        "max_topup_amount": settings.get("max_topup_amount", 100000)
    }


# Admin: Update prepayment settings
@router.put("/admin/prepayment-settings")
async def update_prepayment_settings(data: PrepaymentSettings, user=Depends(get_current_user)):
    """Update prepayment settings"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"type": "prepayment_settings"},
        {
            "$set": {
                "type": "prepayment_settings",
                "prepayment_enabled": data.prepayment_enabled,
                "min_topup_amount": data.min_topup_amount,
                "max_topup_amount": data.max_topup_amount,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"message": "Настройки предоплаты сохранены"}


# Admin: Get all balance transactions
@router.get("/admin/balance-transactions")
async def get_all_balance_transactions(user=Depends(get_current_user), limit: int = 100):
    """Get all balance transactions for admin"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    transactions = await db.balance_transactions.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=limit)
    
    # Enrich with user info
    for t in transactions:
        user_data = await db.users.find_one({"id": t["user_id"]}, {"_id": 0, "name": 1, "email": 1})
        if user_data:
            t["user_name"] = user_data.get("name", "")
            t["user_email"] = user_data.get("email", "")
    
    return {"transactions": transactions}


# Admin: Adjust user balance (credit/debit)
class AdminBalanceAdjust(BaseModel):
    amount: float
    reason: str = ""


@router.post("/admin/users/{user_id}/balance/credit")
async def admin_credit_balance(user_id: str, body: AdminBalanceAdjust, user=Depends(get_current_user)):
    """Admin: add funds to a user's balance"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть положительной")

    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "email": 1, "balance": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    old_balance = target.get("balance", 0) or 0
    new_balance = old_balance + body.amount

    await db.users.update_one({"id": user_id}, {"$inc": {"balance": body.amount}})

    now = datetime.now(timezone.utc).isoformat()
    transaction_id = str(uuid.uuid4())
    await db.balance_transactions.insert_one({
        "id": transaction_id,
        "user_id": user_id,
        "type": "admin_credit",
        "amount": body.amount,
        "method": "admin",
        "status": "completed",
        "description": f"Начисление администратором. {body.reason}".strip(),
        "admin_id": user.get("id"),
        "admin_name": user.get("name") or user.get("email"),
        "created_at": now,
    })

    # Notify user
    await notify_user(user_id, "balance", "Пополнение баланса", f"На ваш баланс зачислено {body.amount:.2f} ₽. {body.reason}".strip(), "/account")

    return {
        "success": True,
        "old_balance": old_balance,
        "new_balance": new_balance,
        "transaction_id": transaction_id,
    }


@router.post("/admin/users/{user_id}/balance/debit")
async def admin_debit_balance(user_id: str, body: AdminBalanceAdjust, user=Depends(get_current_user)):
    """Admin: remove funds from a user's balance (can go negative)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть положительной")

    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "email": 1, "balance": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    old_balance = target.get("balance", 0) or 0
    new_balance = old_balance - body.amount  # may be negative

    await db.users.update_one({"id": user_id}, {"$inc": {"balance": -body.amount}})

    now = datetime.now(timezone.utc).isoformat()
    transaction_id = str(uuid.uuid4())
    await db.balance_transactions.insert_one({
        "id": transaction_id,
        "user_id": user_id,
        "type": "admin_debit",
        "amount": -body.amount,
        "method": "admin",
        "status": "completed",
        "description": f"Списание администратором. {body.reason}".strip(),
        "admin_id": user.get("id"),
        "admin_name": user.get("name") or user.get("email"),
        "created_at": now,
    })

    # Notify user
    await notify_user(user_id, "balance", "Списание с баланса", f"С вашего баланса списано {body.amount:.2f} ₽. {body.reason}".strip(), "/account")

    return {
        "success": True,
        "old_balance": old_balance,
        "new_balance": new_balance,
        "transaction_id": transaction_id,
    }
