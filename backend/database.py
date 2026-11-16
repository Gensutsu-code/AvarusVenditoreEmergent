from typing import Optional
"""Database connection and shared dependencies"""
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import HTTPException, Depends, Request, Response
from dotenv import load_dotenv
from pathlib import Path
import os
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)
AUTH_COOKIE = "access_token"
TOKEN_TTL = 86400 * 7  # 7 days


def request_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = None) -> Optional[str]:
    """Explicit Bearer header (API clients) wins, browsers use the httpOnly cookie."""
    if credentials:
        return credentials.credentials
    header = request.headers.get("authorization", "")
    if header.startswith("Bearer "):
        return header[7:]
    return request.cookies.get(AUTH_COOKIE)


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key=AUTH_COOKIE, value=token, httponly=True, secure=True, samesite="none", max_age=TOKEN_TTL, path="/")


def clear_auth_cookie(response: Response):
    response.delete_cookie(key=AUTH_COOKIE, httponly=True, secure=True, samesite="none", path="/")

# Auth helpers
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    from datetime import datetime, timezone
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc).timestamp() + TOKEN_TTL
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

DEFAULT_STATUS_CONDITIONS = {
    "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
    "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
    "manager": {"commission_percent": 0},
}


async def get_status_conditions() -> dict:
    """Standard conditions per client status (and managers) from site settings."""
    doc = await db.settings.find_one({"key": "status_conditions"}, {"_id": 0})
    saved = (doc or {}).get("value") or {}
    return {k: {**v, **(saved.get(k) or {})} for k, v in DEFAULT_STATUS_CONDITIONS.items()}


def effective_conditions(user: dict, sc: dict) -> dict:
    """Individual conditions of the client win over the standard ones of the status."""
    status = "wholesale" if (user or {}).get("customer_status") == "wholesale" else "retail"
    std = sc[status]
    ind_discount = float(user.get("individual_discount") or 0)
    ind_delivery = user.get("delivery_cost")
    ind_credit = user.get("credit_status") == "approved" and (user.get("credit_limit") or 0) > 0
    if ind_credit:
        limit, term = float(user.get("credit_limit") or 0), int(user.get("credit_term_days") or 30)
    elif (std.get("credit_limit") or 0) > 0:
        limit, term = float(std["credit_limit"]), int(std.get("deferral_days") or 30)
    else:
        limit, term = 0.0, 0
    return {
        "customer_status": status,
        "discount": ind_discount if ind_discount > 0 else float(std.get("discount") or 0),
        "discount_individual": ind_discount > 0,
        "delivery_cost": ind_delivery if ind_delivery not in (None, "") else std.get("delivery_cost"),
        "delivery_individual": ind_delivery not in (None, ""),
        "credit_limit": limit,
        "deferral_days": term,
        "credit_individual": bool(ind_credit),
    }


async def manager_commission_percent(manager_id) -> Optional[float]:
    """Current commission percent of a manager: individual, else the standard one from site settings."""
    if not manager_id:
        return None
    m = await db.users.find_one({"id": manager_id, "role": "manager"}, {"_id": 0, "commission_percent": 1})
    if not m:
        return None
    if m.get("commission_percent") is not None:
        return float(m["commission_percent"])
    return float((await get_status_conditions())["manager"]["commission_percent"] or 0)


async def effective_credit(user_id: str) -> dict:
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "customer_status": 1, "credit_status": 1, "credit_limit": 1, "credit_term_days": 1}) or {}
    eff = effective_conditions(u, await get_status_conditions())
    status = "approved" if eff["credit_limit"] > 0 else u.get("credit_status", "none")
    return {"credit_status": status, "credit_limit": eff["credit_limit"], "credit_term_days": eff["deferral_days"]}


async def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    token = request_token(request, credentials)
    if not token:
        raise HTTPException(status_code=403, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("blocked"):
            raise HTTPException(status_code=401, detail="Invalid token")
        # Set defaults for new fields
        if user.get("role", "user") == "user":
            eff = effective_conditions(user, await get_status_conditions())
            user["customer_status"] = eff["customer_status"]
            user["individual_discount"] = eff["discount"]
            user["delivery_cost"] = eff["delivery_cost"]
        else:
            user["customer_status"] = user.get("customer_status", "retail")
            user["individual_discount"] = user.get("individual_discount", 0)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
