"""Authentication routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid
import bcrypt

from database import db, get_current_user, hash_password, verify_password, create_token
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
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "password_plain": data.password,
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


@router.post("/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get("blocked"):
        raise HTTPException(status_code=403, detail="account_blocked")
    
    token = create_token(user["id"])
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
        update_data["password_plain"] = data.new_password
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one(
        {"id": user["id"]}, 
        {"_id": 0, "password": 0, "password_hash": 0, "password_plain": 0, "plain_password": 0}
    )
    return updated_user
