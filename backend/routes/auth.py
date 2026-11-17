"""Authentication routes"""
from fastapi import APIRouter, HTTPException, Depends, Response, Request
import time
from datetime import datetime, timezone
import uuid
import bcrypt

from database import db, get_current_user, hash_password, verify_password, create_token, set_auth_cookie, clear_auth_cookie
from models import UserRegister, UserLogin, UserResponse, UserProfileUpdate
from notify import notify_admin

router = APIRouter(prefix="/auth", tags=["auth"])


async def create_admin_activity(user_id: str, user_name: str, activity_type: str, message: str):
    """Helper to create admin activity notification"""
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


@router.post("/register")
async def register(data: UserRegister, response: Response):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "phone": data.phone,
        "address": data.address,
        "address_comment": data.address_comment,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    # Create empty cart
    await db.carts.insert_one({"user_id": user_id, "items": []})
    
    token = create_token(user_id)
    set_auth_cookie(response, token)
    
    # Log admin activity
    await create_admin_activity(user_id, data.name, "registration", f"Новый пользователь: {data.email}")
    await notify_admin("registration", "Новая регистрация", f"{data.name} ({data.email})", "/admin/users")
    
    return {
        "token": token, 
        "user": {
            "id": user_id, 
            "email": data.email, 
            "name": data.name, 
            "phone": data.phone, 
            "address": data.address, 
            "address_comment": data.address_comment, 
            "role": "user", 
            "avatar_url": None
        }
    }


LOGIN_MAX_FAILS, LOGIN_MAX_FAILS_PER_EMAIL, LOGIN_WINDOW = 10, 50, 900
_login_fails: dict = {}


def _recent_fails(key: str) -> list:
    fresh = [t for t in _login_fails.get(key, []) if time.time() - t < LOGIN_WINDOW]
    _login_fails[key] = fresh
    return fresh


@router.post("/login")
async def login(data: UserLogin, response: Response, request: Request):
    email = data.email.strip().lower()
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "")
    by_ip, by_email = _recent_fails(f"{email}|{ip}"), _recent_fails(email)
    if len(by_ip) >= LOGIN_MAX_FAILS or len(by_email) >= LOGIN_MAX_FAILS_PER_EMAIL:
        raise HTTPException(status_code=429, detail="Слишком много попыток входа. Попробуйте через 15 минут.")
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        by_ip.append(time.time())
        by_email.append(time.time())
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _login_fails.pop(f"{email}|{ip}", None)
    
    if user.get("blocked"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    set_auth_cookie(response, token)
    return {
        "token": token, 
        "user": {
            "id": user["id"], 
            "email": user["email"], 
            "name": user["name"], 
            "phone": user.get("phone"), 
            "role": user.get("role", "user"), 
            "address": user.get("address"), 
            "address_comment": user.get("address_comment"), 
            "avatar_url": user.get("avatar_url")
        }
    }


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"success": True}


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    return user


@router.put("/profile")
async def update_profile(data: UserProfileUpdate, user=Depends(get_current_user)):
    update_data = {}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.phone is not None:
        update_data["phone"] = data.phone
    if data.address_comment is not None:
        update_data["address_comment"] = data.address_comment
    if data.address is not None:
        update_data["address"] = data.address
    
    if data.email is not None and data.email != user.get("email"):
        existing = await db.users.find_one({"email": data.email, "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Email уже используется")
        update_data["email"] = data.email
    
    if data.new_password:
        if not data.current_password:
            raise HTTPException(status_code=400, detail="Введите текущий пароль")
        
        full_user = await db.users.find_one({"id": user["id"]})
        if not full_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        password_valid = False
        hashed_pwd = full_user.get("password") or full_user.get("password_hash")
        if hashed_pwd and hashed_pwd.startswith("$2"):
            try:
                password_valid = bcrypt.checkpw(
                    data.current_password.encode('utf-8'),
                    hashed_pwd.encode('utf-8')
                )
            except Exception:
                pass
        
        if not password_valid:
            plain_pwd = full_user.get("password_plain") or full_user.get("plain_password")
            if plain_pwd:
                password_valid = plain_pwd == data.current_password
        
        if not password_valid:
            raise HTTPException(status_code=400, detail="Неверный текущий пароль")
        
        new_hashed = bcrypt.hashpw(
            data.new_password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        update_data["password"] = new_hashed
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    change = {"$set": update_data}
    if "password" in update_data:
        change["$unset"] = {"password_plain": "", "plain_password": ""}
    await db.users.update_one({"id": user["id"]}, change)
    
    updated_user = await db.users.find_one(
        {"id": user["id"]}, 
        {"_id": 0, "password": 0, "password_hash": 0, "password_plain": 0, "plain_password": 0}
    )
    return updated_user


import secrets
import os
from routes.notifications import send_email

FRONTEND_URL = os.environ.get("FRONTEND_URL", "")


@router.post("/forgot-password")
async def forgot_password(data: dict):
    email = data.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email обязателен")

    user = await db.users.find_one({"email": email})
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "Если email зарегистрирован, вы получите письмо"}

    token = secrets.token_urlsafe(32)
    await db.password_resets.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "user_id": user["id"],
            "token": token,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )

    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    html = f"""
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 30px;">
      <h2 style="color: #0d9488;">Восстановление пароля</h2>
      <p>Вы запросили сброс пароля для вашей учётной записи.</p>
      <a href="{reset_link}" style="display:inline-block; padding: 12px 28px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Сбросить пароль</a>
      <p style="color: #888; font-size: 13px; margin-top: 20px;">Если вы не запрашивали сброс, проигнорируйте это письмо. Ссылка действительна 1 час.</p>
    </div>
    """
    await send_email(email, "Восстановление пароля — avopt.store", html)
    return {"message": "Если email зарегистрирован, вы получите письмо"}


@router.post("/reset-password")
async def reset_password(data: dict):
    token = data.get("token", "")
    new_password = data.get("password", "")
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Токен и пароль обязательны")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Пароль минимум 6 символов")

    reset = await db.password_resets.find_one({"token": token})
    if not reset:
        raise HTTPException(status_code=400, detail="Недействительная ссылка")

    # Check expiration (1 hour)
    from datetime import timedelta
    created = datetime.fromisoformat(reset["created_at"])
    if datetime.now(timezone.utc) - created > timedelta(hours=1):
        await db.password_resets.delete_one({"token": token})
        raise HTTPException(status_code=400, detail="Ссылка истекла")

    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.users.update_one(
        {"id": reset["user_id"]},
        {"$set": {"password": hashed}, "$unset": {"password_plain": "", "plain_password": ""}}
    )
    await db.password_resets.delete_one({"token": token})
    return {"message": "Пароль успешно изменён"}
