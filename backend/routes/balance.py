"""User balance and prepayment routes"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from database import db, get_current_user

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


# Topup balance (mock mode)
@router.post("/user/balance/topup")
async def topup_balance(data: TopupRequest, user=Depends(get_current_user)):
    """Top up user balance (mock mode - instant success)"""
    
    # Get prepayment settings
    settings = await db.settings.find_one({"type": "prepayment_settings"}, {"_id": 0})
    min_amount = settings.get("min_topup_amount", 500) if settings else 500
    max_amount = settings.get("max_topup_amount", 100000) if settings else 100000
    prepayment_enabled = settings.get("prepayment_enabled", True) if settings else True
    
    if not prepayment_enabled:
        raise HTTPException(status_code=400, detail="Предоплата временно отключена")
    
    if data.amount < min_amount:
        raise HTTPException(status_code=400, detail=f"Минимальная сумма пополнения: {min_amount}₽")
    
    if data.amount > max_amount:
        raise HTTPException(status_code=400, detail=f"Максимальная сумма пополнения: {max_amount}₽")
    
    # Create transaction record
    transaction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # For crypto, check if tx_hash provided
    if data.method == "crypto":
        if not data.tx_hash:
            # Create pending transaction waiting for tx_hash
            transaction = {
                "id": transaction_id,
                "user_id": user["id"],
                "type": "topup",
                "amount": data.amount,
                "method": f"crypto_{data.crypto_chain or 'eth'}",
                "status": "pending",
                "created_at": now,
                "description": f"Пополнение криптовалютой ({data.crypto_chain or 'ETH'})"
            }
            await db.balance_transactions.insert_one(transaction)
            
            # Get crypto wallet address
            wallets = await db.settings.find_one({"type": "crypto_wallets"}, {"_id": 0})
            wallet_key = f"{data.crypto_chain or 'eth'}_address"
            wallet_address = wallets.get(wallet_key, "") if wallets else ""
            
            return {
                "transaction_id": transaction_id,
                "status": "pending",
                "wallet_address": wallet_address,
                "message": f"Переведите {data.amount}₽ в эквиваленте на кошелёк и укажите hash транзакции"
            }
        else:
            # Crypto with tx_hash - mark as completed (mock mode)
            transaction = {
                "id": transaction_id,
                "user_id": user["id"],
                "type": "topup",
                "amount": data.amount,
                "method": f"crypto_{data.crypto_chain or 'eth'}",
                "tx_hash": data.tx_hash,
                "status": "completed",
                "created_at": now,
                "description": f"Пополнение криптовалютой ({data.crypto_chain or 'ETH'})"
            }
    else:
        # Card payment - instant success in mock mode
        transaction = {
            "id": transaction_id,
            "user_id": user["id"],
            "type": "topup",
            "amount": data.amount,
            "method": "card",
            "status": "completed",
            "created_at": now,
            "description": "Пополнение картой"
        }
    
    # Save transaction
    await db.balance_transactions.insert_one(transaction)
    
    # Update user balance
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"balance": data.amount}}
    )
    
    # Get new balance
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "balance": 1})
    new_balance = user_data.get("balance", 0)
    
    # Notify admin about topup
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": "ADMIN",
        "type": "balance_topup",
        "title": "Пополнение баланса",
        "message": f"Клиент {user.get('name') or user.get('email')} пополнил баланс на {data.amount}₽",
        "link": "/admin",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "transaction_id": transaction_id,
        "status": "completed",
        "amount": data.amount,
        "new_balance": new_balance,
        "message": f"Баланс успешно пополнен на {data.amount}₽"
    }


# Confirm crypto transaction (submit tx_hash)
@router.post("/user/balance/confirm-crypto")
async def confirm_crypto_topup(transaction_id: str, tx_hash: str, user=Depends(get_current_user)):
    """Confirm crypto topup with transaction hash"""
    
    # Find pending transaction
    transaction = await db.balance_transactions.find_one({
        "id": transaction_id,
        "user_id": user["id"],
        "status": "pending"
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Транзакция не найдена или уже обработана")
    
    # Update transaction (mock mode - instant success)
    await db.balance_transactions.update_one(
        {"id": transaction_id},
        {
            "$set": {
                "status": "completed",
                "tx_hash": tx_hash,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Update user balance
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"balance": transaction["amount"]}}
    )
    
    # Get new balance
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "balance": 1})
    new_balance = user_data.get("balance", 0)
    
    return {
        "status": "completed",
        "amount": transaction["amount"],
        "new_balance": new_balance,
        "message": f"Баланс успешно пополнен на {transaction['amount']}₽"
    }


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
