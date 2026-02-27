"""Advanced Crypto Payment System with direct wallet integration"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import time
import aiohttp
import asyncio
from web3 import Web3

from database import db, get_current_user

router = APIRouter(tags=["crypto_payments"])

# Rate cache: {key: (value, timestamp)}
_rate_cache = {}

# ERC20 Token Addresses for each network
TOKENS = {
    "bsc": {
        "usdt": "0x55d398326f99059fF775485246999027B3197955",
        "usdc": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        "chain_id": 56,
        "rpc": "https://bsc-dataseed.binance.org/",
        "explorer": "https://bscscan.com/tx/",
        "name": "BNB Smart Chain"
    },
    "base": {
        "usdt": "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",  # Bridged USDT on Base
        "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # Native USDC on Base
        "chain_id": 8453,
        "rpc": "https://mainnet.base.org",
        "explorer": "https://basescan.org/tx/",
        "name": "Base"
    },
    "polygon": {
        "usdt": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        "usdc": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",  # Native USDC on Polygon
        "chain_id": 137,
        "rpc": "https://polygon-rpc.com",
        "explorer": "https://polygonscan.com/tx/",
        "name": "Polygon"
    }
}

# Standard ERC20 ABI for Transfer event
ERC20_TRANSFER_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": False, "name": "value", "type": "uint256"}
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
]


class CryptoPaymentRequest(BaseModel):
    order_id: str
    chain: str  # bsc, base, polygon
    token: str  # usdt, usdc


class CryptoPaymentVerify(BaseModel):
    payment_id: str
    tx_hash: str


class CryptoSettingsUpdate(BaseModel):
    receiving_address: str
    markup_percent: float = 3.0
    crypto_enabled: bool = True


async def get_crypto_price_usd() -> float:
    """Get current USD/RUB rate from CoinGecko with 10-minute cache"""
    cache_key = "usdt_rub_rate"
    now = time.time()
    
    if cache_key in _rate_cache:
        cached_val, cached_at = _rate_cache[cache_key]
        if now - cached_at < 600:  # 10 minutes
            return cached_val
    
    try:
        async with aiohttp.ClientSession() as session:
            url = "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub"
            async with session.get(url, timeout=10) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    rate = data.get("tether", {}).get("rub", 90.0)
                    _rate_cache[cache_key] = (rate, now)
                    return rate
                elif resp.status == 429:
                    print("CoinGecko rate limited, using cache or fallback")
    except Exception as e:
        print(f"CoinGecko API error: {e}")
    
    # Return stale cache if available
    if cache_key in _rate_cache:
        return _rate_cache[cache_key][0]
    
    return 90.0


async def get_crypto_settings():
    """Get crypto payment settings from database"""
    settings = await db.settings.find_one({"type": "crypto_payment_settings"}, {"_id": 0})
    if not settings:
        return {
            "receiving_address": "",
            "markup_percent": 3.0,
            "crypto_enabled": True
        }
    return settings


def get_web3_for_chain(chain: str) -> Web3:
    """Get Web3 instance for specific chain"""
    if chain not in TOKENS:
        raise ValueError(f"Unsupported chain: {chain}")
    
    rpc_url = TOKENS[chain]["rpc"]
    return Web3(Web3.HTTPProvider(rpc_url))


async def verify_token_transfer(chain: str, token: str, tx_hash: str, expected_to: str, min_amount_wei: int) -> dict:
    """Verify that a token transfer occurred with expected parameters"""
    try:
        w3 = get_web3_for_chain(chain)
        
        # Get transaction receipt
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        
        if receipt is None:
            return {"verified": False, "error": "Transaction not found or pending"}
        
        if receipt["status"] != 1:
            return {"verified": False, "error": "Transaction failed"}
        
        # Get token contract address
        token_address = TOKENS[chain][token]
        token_address_checksum = Web3.to_checksum_address(token_address)
        expected_to_checksum = Web3.to_checksum_address(expected_to)
        
        # Parse logs for Transfer event
        transfer_topic = w3.keccak(text="Transfer(address,address,uint256)")
        
        for log in receipt["logs"]:
            # Check if log is from the token contract
            if log["address"].lower() != token_address_checksum.lower():
                continue
            
            # Check if it's a Transfer event
            if len(log["topics"]) < 3 or log["topics"][0] != transfer_topic:
                continue
            
            # Decode the Transfer event
            # topics[1] = from address (padded to 32 bytes)
            # topics[2] = to address (padded to 32 bytes)
            # data = amount
            
            to_address = "0x" + log["topics"][2].hex()[-40:]
            amount = int(log["data"].hex(), 16)
            
            # Check if transfer is to our address and amount is sufficient
            if to_address.lower() == expected_to_checksum.lower() and amount >= min_amount_wei:
                return {
                    "verified": True,
                    "amount": amount,
                    "from": "0x" + log["topics"][1].hex()[-40:],
                    "to": to_address,
                    "block": receipt["blockNumber"]
                }
        
        return {"verified": False, "error": "No matching transfer found in transaction"}
        
    except Exception as e:
        return {"verified": False, "error": str(e)}


# ==================== PUBLIC ENDPOINTS ====================

@router.get("/crypto/chains")
async def get_supported_chains():
    """Get list of supported chains and tokens"""
    settings = await get_crypto_settings()
    
    chains = []
    for chain_id, chain_data in TOKENS.items():
        chains.append({
            "id": chain_id,
            "name": chain_data["name"],
            "chain_id": chain_data["chain_id"],
            "chain_id_hex": hex(chain_data["chain_id"]),
            "tokens": ["usdt", "usdc"],
            "explorer": chain_data["explorer"]
        })
    
    return {
        "chains": chains,
        "enabled": settings.get("crypto_enabled", True),
        "receiving_address": settings.get("receiving_address", "")
    }


@router.get("/crypto/price")
async def get_crypto_price(amount_rub: float):
    """Convert RUB amount to USDT/USDC with configurable markup"""
    settings = await get_crypto_settings()
    markup = settings.get("markup_percent", 3.0)
    
    # Get current rate (with caching)
    usd_rub_rate = await get_crypto_price_usd()
    
    # Convert RUB to USD and add markup
    amount_usd = amount_rub / usd_rub_rate
    amount_with_markup = amount_usd * (1 + markup / 100)
    
    cache_key = "usdt_rub_rate"
    is_cached = cache_key in _rate_cache and (time.time() - _rate_cache[cache_key][1]) < 600
    
    return {
        "amount_rub": amount_rub,
        "amount_usd": round(amount_with_markup, 2),
        "rate": round(usd_rub_rate, 2),
        "markup_percent": markup,
        "token_amount": round(amount_with_markup, 6),
        "decimals": 6,
        "source": "CoinGecko" + (" (cached)" if is_cached else ""),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/crypto/gas-estimate")
async def get_gas_estimate(chain: str):
    """Get estimated gas fee for token transfer"""
    if chain not in TOKENS:
        raise HTTPException(status_code=400, detail=f"Unsupported chain: {chain}")
    
    native_symbols = {
        "bsc": ("binancecoin", "BNB"),
        "base": ("ethereum", "ETH"),
        "polygon": ("matic-network", "MATIC")
    }
    
    coin_id, native_sym = native_symbols.get(chain, ("ethereum", "ETH"))
    
    try:
        w3 = get_web3_for_chain(chain)
        gas_price = w3.eth.gas_price
        estimated_gas = 65000
        gas_cost_wei = gas_price * estimated_gas
        gas_cost_native = w3.from_wei(gas_cost_wei, 'ether')
        
        # Get native token price with cache
        native_price_usd = 0
        cache_key = f"native_price_{coin_id}"
        now = time.time()
        
        if cache_key in _rate_cache:
            cached_val, cached_at = _rate_cache[cache_key]
            if now - cached_at < 600:
                native_price_usd = cached_val
        
        if native_price_usd == 0:
            try:
                async with aiohttp.ClientSession() as session:
                    url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies=usd"
                    async with session.get(url, timeout=10) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            native_price_usd = data.get(coin_id, {}).get("usd", 0)
                            _rate_cache[cache_key] = (native_price_usd, now)
            except:
                pass
            
            # Use stale cache or fallback prices if API failed
            if native_price_usd == 0 and cache_key in _rate_cache:
                native_price_usd = _rate_cache[cache_key][0]
            
            if native_price_usd == 0:
                fallback_prices = {"binancecoin": 650, "ethereum": 3500, "matic-network": 0.5}
                native_price_usd = fallback_prices.get(coin_id, 0)
        
        gas_cost_usd = float(gas_cost_native) * native_price_usd
        
        return {
            "chain": chain,
            "gas_price_gwei": round(w3.from_wei(gas_price, 'gwei'), 2),
            "estimated_gas": estimated_gas,
            "gas_cost_native": round(float(gas_cost_native), 6),
            "gas_cost_usd": round(gas_cost_usd, 4),
            "native_symbol": native_sym,
            "native_price_usd": round(native_price_usd, 2)
        }
    except Exception as e:
        return {
            "chain": chain,
            "gas_price_gwei": 5,
            "estimated_gas": 65000,
            "gas_cost_native": 0.0003,
            "gas_cost_usd": 0.10,
            "native_symbol": native_sym,
            "error": str(e)
        }


@router.post("/crypto/payment/create")
async def create_crypto_payment(data: CryptoPaymentRequest, user=Depends(get_current_user)):
    """Create a new crypto payment request"""
    
    # Validate chain and token
    if data.chain not in TOKENS:
        raise HTTPException(status_code=400, detail=f"Unsupported chain: {data.chain}")
    if data.token not in ["usdt", "usdc"]:
        raise HTTPException(status_code=400, detail=f"Unsupported token: {data.token}")
    
    # Get settings
    settings = await get_crypto_settings()
    if not settings.get("crypto_enabled", True):
        raise HTTPException(status_code=400, detail="Crypto payments are currently disabled")
    
    receiving_address = settings.get("receiving_address", "")
    if not receiving_address:
        raise HTTPException(status_code=400, detail="Crypto payment address not configured")
    
    # Get order
    order = await db.orders.find_one({"id": data.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculate crypto amount
    amount_rub = order.get("total", 0)
    price_data = await get_crypto_price(amount_rub)
    
    # Token decimals (USDT and USDC usually have 6 decimals, but can vary)
    decimals = 6 if data.token == "usdc" else 18 if data.chain == "bsc" else 6
    token_amount_wei = int(price_data["token_amount"] * (10 ** decimals))
    
    # Create payment record
    payment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    payment = {
        "id": payment_id,
        "order_id": data.order_id,
        "user_id": user["id"],
        "chain": data.chain,
        "token": data.token,
        "token_address": TOKENS[data.chain][data.token],
        "receiving_address": receiving_address,
        "amount_rub": amount_rub,
        "amount_usd": price_data["amount_usd"],
        "token_amount": price_data["token_amount"],
        "token_amount_wei": str(token_amount_wei),
        "decimals": decimals,
        "status": "pending",
        "created_at": now,
        "expires_at": None,  # No expiration for now
        "tx_hash": None,
        "verified_at": None
    }
    
    await db.crypto_payments.insert_one(payment)
    
    # Update order
    await db.orders.update_one(
        {"id": data.order_id},
        {"$set": {
            "crypto_payment_id": payment_id,
            "payment_status": "crypto_pending"
        }}
    )
    
    return {
        "payment_id": payment_id,
        "chain": data.chain,
        "chain_id": TOKENS[data.chain]["chain_id"],
        "chain_id_hex": hex(TOKENS[data.chain]["chain_id"]),
        "token": data.token,
        "token_address": TOKENS[data.chain][data.token],
        "receiving_address": receiving_address,
        "amount_usd": price_data["amount_usd"],
        "token_amount": price_data["token_amount"],
        "token_amount_wei": str(token_amount_wei),
        "decimals": decimals,
        "explorer": TOKENS[data.chain]["explorer"]
    }


@router.post("/crypto/payment/verify")
async def verify_crypto_payment(data: CryptoPaymentVerify, user=Depends(get_current_user)):
    """Verify a crypto payment transaction"""
    
    # Get payment record
    payment = await db.crypto_payments.find_one({"id": data.payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if payment.get("status") == "completed":
        return {"status": "already_completed", "verified": True}
    
    # Verify the transaction on blockchain
    chain = payment["chain"]
    token = payment["token"]
    receiving_address = payment["receiving_address"]
    min_amount = int(payment["token_amount_wei"])
    
    # Allow 1% tolerance for rounding
    min_amount_with_tolerance = int(min_amount * 0.99)
    
    result = await verify_token_transfer(
        chain=chain,
        token=token,
        tx_hash=data.tx_hash,
        expected_to=receiving_address,
        min_amount_wei=min_amount_with_tolerance
    )
    
    if result["verified"]:
        now = datetime.now(timezone.utc).isoformat()
        
        # Update payment
        await db.crypto_payments.update_one(
            {"id": data.payment_id},
            {"$set": {
                "status": "completed",
                "tx_hash": data.tx_hash,
                "verified_at": now,
                "verified_amount": result["amount"],
                "from_address": result.get("from", ""),
                "block_number": result.get("block")
            }}
        )
        
        # Update order
        await db.orders.update_one(
            {"id": payment["order_id"]},
            {"$set": {
                "payment_status": "paid",
                "status": "processing",
                "crypto_tx_hash": data.tx_hash,
                "crypto_chain": chain,
                "crypto_token": token
            }}
        )
        
        # Create notification
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "order",
            "title": "Оплата получена",
            "message": f"Заказ #{payment['order_id'][:8]} оплачен криптовалютой ({token.upper()})",
            "link": "/orders",
            "read": False,
            "created_at": now
        }
        await db.notifications.insert_one(notification)
        
        return {
            "status": "completed",
            "verified": True,
            "tx_hash": data.tx_hash,
            "explorer_url": TOKENS[chain]["explorer"] + data.tx_hash
        }
    else:
        return {
            "status": "verification_failed",
            "verified": False,
            "error": result.get("error", "Unknown error")
        }


@router.get("/crypto/payment/{payment_id}")
async def get_crypto_payment_status(payment_id: str, user=Depends(get_current_user)):
    """Get crypto payment status"""
    payment = await db.crypto_payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment.get("user_id") != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "id": payment["id"],
        "status": payment["status"],
        "chain": payment["chain"],
        "token": payment["token"],
        "amount_usd": payment["amount_usd"],
        "token_amount": payment["token_amount"],
        "tx_hash": payment.get("tx_hash"),
        "verified_at": payment.get("verified_at"),
        "explorer": TOKENS[payment["chain"]]["explorer"] + payment["tx_hash"] if payment.get("tx_hash") else None
    }


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/crypto/settings")
async def get_admin_crypto_settings(user=Depends(get_current_user)):
    """Get crypto payment settings for admin"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return await get_crypto_settings()


@router.put("/admin/crypto/settings")
async def update_admin_crypto_settings(data: CryptoSettingsUpdate, user=Depends(get_current_user)):
    """Update crypto payment settings"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate address format
    if data.receiving_address and not Web3.is_address(data.receiving_address):
        raise HTTPException(status_code=400, detail="Invalid wallet address format")
    
    await db.settings.update_one(
        {"type": "crypto_payment_settings"},
        {"$set": {
            "type": "crypto_payment_settings",
            "receiving_address": Web3.to_checksum_address(data.receiving_address) if data.receiving_address else "",
            "markup_percent": data.markup_percent,
            "crypto_enabled": data.crypto_enabled,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Crypto settings updated"}


@router.get("/admin/crypto/payments")
async def get_admin_crypto_payments(user=Depends(get_current_user), limit: int = 50):
    """Get all crypto payments for admin"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    payments = await db.crypto_payments.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=limit)
    
    # Enrich with user info
    for p in payments:
        user_data = await db.users.find_one({"id": p["user_id"]}, {"_id": 0, "name": 1, "email": 1})
        if user_data:
            p["user_name"] = user_data.get("name", "")
            p["user_email"] = user_data.get("email", "")
    
    return {"payments": payments}
