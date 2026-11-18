"""Authentication routes"""
from fastapi import APIRouter, HTTPException, Depends, Response, Request
from datetime import datetime, timezone, timedelta
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
    
    token = create_token(user_id, 0)
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


async def _recent_fails(key: str) -> int:
    since = datetime.now(timezone.utc) - timedelta(seconds=LOGIN_WINDOW)
    return await db.login_attempts.count_documents({"key": key, "at": {"$gt": since}})


@router.post("/login")
async def login(data: UserLogin, response: Response, request: Request):
    email = data.email.strip().lower()
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "")
    if await _recent_fails(f"{email}|{ip}") >= LOGIN_MAX_FAILS or await _recent_fails(email) >= LOGIN_MAX_FAILS_PER_EMAIL:
        raise HTTPException(status_code=429, detail="Слишком много попыток входа. Попробуйте через 15 минут.")
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        now = datetime.now(timezone.utc)
        await db.login_attempts.insert_many([{"key": f"{email}|{ip}", "at": now}, {"key": email, "at": now}])
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await db.login_attempts.delete_many({"key": f"{email}|{ip}"})
    
    if user.get("blocked"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user.get("auth_version", 0))
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
async def update_profile(data: UserProfileUpdate, response: Response, user=Depends(get_current_user)):
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
        # Revoke any other active sessions (SEC-04): bump auth_version, then immediately
        # reissue a fresh cookie for *this* session so the current browser stays signed in.
        change["$unset"] = {"password_plain": "", "plain_password": ""}
        change["$inc"] = {"auth_version": 1}
    await db.users.update_one({"id": user["id"]}, change)

    updated_user = await db.users.find_one(
        {"id": user["id"]}, 
        {"_id": 0, "password": 0, "password_hash": 0, "password_plain": 0, "plain_password": 0}
    )
    if "password" in update_data:
        # Use the freshly-read value (not user[...] + 1) so a concurrent password change
        # cannot make this token carry a now-stale auth_version and log itself out.
        new_token = create_token(user["id"], updated_user.get("auth_version", 0) or 0)
        set_auth_cookie(response, new_token)
    return updated_user


import secrets
import hashlib
import os
from routes.notifications import send_email
from models import ForgotPasswordRequest, ResetPasswordRequest

FRONTEND_URL = os.environ.get("FRONTEND_URL", "")


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    email = data.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email обязателен")

    if await _recent_fails(f"reset|{email}") >= 5:
        raise HTTPException(status_code=429, detail="Слишком много запросов. Попробуйте через 15 минут.")
    await db.login_attempts.insert_one({"key": f"reset|{email}", "at": datetime.now(timezone.utc)})
    user = await db.users.find_one({"email": email})
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "Если email зарегистрирован, вы получите письмо"}

    token = secrets.token_urlsafe(32)
    # Only a hash of the token is stored server-side; the raw token exists only in the
    # one-time email link, so a database read alone cannot be used to reset a password (SEC-01).
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    await db.password_resets.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "user_id": user["id"],
            "token_hash": token_hash,
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
async def reset_password(data: ResetPasswordRequest):
    token_hash = hashlib.sha256(data.token.encode()).hexdigest()

    # Atomically fetch-and-delete: a token can be consumed at most once, even if two
    # requests race with the exact same link (single-use guarantee for SEC-01).
    reset = await db.password_resets.find_one_and_delete({"token_hash": token_hash})
    if not reset:
        raise HTTPException(status_code=400, detail="Недействительная ссылка")

    # Check expiration (1 hour) - the record is already deleted above, so an expired
    # link cannot be retried.
    from datetime import timedelta
    created = datetime.fromisoformat(reset["created_at"])
    if datetime.now(timezone.utc) - created > timedelta(hours=1):
        raise HTTPException(status_code=400, detail="Ссылка истекла")

    hashed = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.users.update_one(
        {"id": reset["user_id"]},
        {
            "$set": {"password": hashed},
            "$unset": {"password_plain": "", "plain_password": ""},
            # Revoke every existing session for this account after a password reset (SEC-04).
            "$inc": {"auth_version": 1},
        }
    )
    return {"message": "Пароль успешно изменён"}
