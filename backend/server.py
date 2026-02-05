from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import shutil
import httpx
import csv
import io
import json
from cloudinary_service import upload_to_cloudinary, is_image, is_video

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

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

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Health check endpoint for Kubernetes
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@api_router.get("/health")
async def api_health_check():
    return {"status": "healthy"}

# Mount uploads directory for serving static files (via /api/uploads for ingress routing)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    role: str = "user"
    address: Optional[str] = None

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

# Admin user management
class AdminUserCreate(BaseModel):
    email: str
    password: str
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    role: str = "user"

class AdminUserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    role: Optional[str] = None

class AdminUserResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    role: str = "user"
    address: Optional[str] = None
    password_plain: Optional[str] = None  # Plain password for admin view
    created_at: Optional[str] = None
    total_orders: int = 0
    total_spent: float = 0

# Admin order management
class AdminOrderUpdate(BaseModel):
    status: Optional[str] = None
    full_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None

# Category models
class CategoryCreate(BaseModel):
    name: str
    image_url: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    image_url: Optional[str] = None

class CategoryResponse(BaseModel):
    id: str
    name: str
    image_url: Optional[str] = None

# Promo banner model
class PromoBannerUpdate(BaseModel):
    enabled: bool
    text: str
    link: Optional[str] = None
    bg_color: Optional[str] = "#f97316"
    height: Optional[int] = 40
    left_image: Optional[str] = None
    right_image: Optional[str] = None

class ProductCreate(BaseModel):
    name: str
    article: str
    manufacturer: Optional[str] = None
    category_id: Optional[str] = None
    price: float
    description: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None  # Multiple images
    cross_articles: Optional[str] = None  # Cross-reference articles
    stock: int = 0
    delivery_days: int = 3

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    article: Optional[str] = None
    manufacturer: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    cross_articles: Optional[str] = None
    stock: Optional[int] = None
    delivery_days: Optional[int] = None

class ProductResponse(BaseModel):
    id: str
    name: str
    article: str
    manufacturer: Optional[str] = None
    category_id: Optional[str] = None
    price: float
    description: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[str]] = None
    cross_articles: Optional[str] = None
    stock: int
    delivery_days: int = 3

class CartItem(BaseModel):
    product_id: str
    quantity: int

class CartItemResponse(BaseModel):
    product_id: str
    name: str
    article: str
    manufacturer: Optional[str] = None
    price: float
    quantity: int
    image_url: Optional[str] = None

class OrderCreate(BaseModel):
    full_name: str
    address: str
    phone: str

class OrderResponse(BaseModel):
    id: str
    user_id: str
    items: List[CartItemResponse]
    total: float
    status: str
    full_name: str
    address: str
    phone: str
    created_at: str

# Favorites model
class FavoriteItem(BaseModel):
    product_id: str

# Telegram settings model
class TelegramSettings(BaseModel):
    enabled: bool = False
    bot_token: str = ""
    chat_id: str = ""

# Chat models
class ChatMessage(BaseModel):
    text: str
    sender_type: str = "user"  # "user" or "admin"

class ChatMessageResponse(BaseModel):
    id: str
    chat_id: str
    user_id: str
    user_name: str
    text: str
    sender_type: str
    created_at: str
    read: bool = False

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "password_plain": data.password,  # Store plain password for admin view
        "name": data.name,
        "phone": data.phone,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    # Create empty cart
    await db.carts.insert_one({"user_id": user_id, "items": []})
    
    token = create_token(user_id)
    return {"token": token, "user": {"id": user_id, "email": data.email, "name": data.name, "phone": data.phone, "role": "user"}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "phone": user.get("phone"), "role": user.get("role", "user"), "address": user.get("address")}}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    return user

@api_router.put("/auth/profile")
async def update_profile(data: UserProfileUpdate, user=Depends(get_current_user)):
    update_data = {}
    
    # Basic fields
    if data.name is not None:
        update_data["name"] = data.name
    if data.phone is not None:
        update_data["phone"] = data.phone
    if data.address is not None:
        update_data["address"] = data.address
    
    # Email change - check uniqueness
    if data.email is not None and data.email != user.get("email"):
        existing = await db.users.find_one({"email": data.email, "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Email уже используется")
        update_data["email"] = data.email
    
    # Password change - requires current password verification
    if data.new_password:
        if not data.current_password:
            raise HTTPException(status_code=400, detail="Введите текущий пароль")
        
        # Verify current password
        full_user = await db.users.find_one({"id": user["id"]})
        if not full_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Check password (support both hashed and plain - check all possible field names)
        password_valid = False
        # Check hashed password (field name: password or password_hash)
        hashed_pwd = full_user.get("password") or full_user.get("password_hash")
        if hashed_pwd and hashed_pwd.startswith("$2"):
            try:
                password_valid = bcrypt.checkpw(
                    data.current_password.encode('utf-8'),
                    hashed_pwd.encode('utf-8')
                )
            except Exception:
                pass
        
        # Fallback to plain password check (field name: password_plain or plain_password)
        if not password_valid:
            plain_pwd = full_user.get("password_plain") or full_user.get("plain_password")
            if plain_pwd:
                password_valid = plain_pwd == data.current_password
        
        if not password_valid:
            raise HTTPException(status_code=400, detail="Неверный текущий пароль")
        
        # Set new password (update both field names for consistency)
        new_hashed = bcrypt.hashpw(
            data.new_password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
        update_data["password"] = new_hashed
        update_data["password_plain"] = data.new_password
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Нет данных для обновления")
    
    await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0, "password_hash": 0, "password_plain": 0, "plain_password": 0})
    return updated_user

@api_router.get("/user/last-shipping")
async def get_last_shipping(user=Depends(get_current_user)):
    """Get user's last shipping info from orders or profile"""
    # First try to get from last order
    last_order = await db.orders.find_one(
        {"user_id": user["id"]},
        {"_id": 0, "full_name": 1, "address": 1, "phone": 1},
        sort=[("created_at", -1)]
    )
    
    if last_order:
        return {
            "full_name": last_order.get("full_name", ""),
            "address": last_order.get("address", ""),
            "phone": last_order.get("phone", "")
        }
    
    # Fallback to user profile
    return {
        "full_name": user.get("name", ""),
        "address": user.get("address", ""),
        "phone": user.get("phone", "")
    }

# ==================== CATEGORIES ROUTES ====================

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    return categories

@api_router.post("/categories", response_model=CategoryResponse)
async def create_category(data: CategoryCreate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    category_id = str(uuid.uuid4())
    category = {
        "id": category_id,
        **data.model_dump()
    }
    await db.categories.insert_one(category)
    return category

@api_router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, data: CategoryUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.categories.update_one({"id": category_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    return category

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Remove category from products
    await db.products.update_many({"category_id": category_id}, {"$set": {"category_id": None}})
    return {"message": "Category deleted"}

# ==================== PROMO BANNER ROUTES ====================

@api_router.get("/promo-banner")
async def get_promo_banner():
    banner = await db.settings.find_one({"key": "promo_banner"}, {"_id": 0})
    if not banner:
        return {"enabled": False, "text": "", "link": None, "bg_color": "#f97316", "height": 40, "left_image": None, "right_image": None}
    return banner.get("value", {"enabled": False, "text": "", "link": None, "bg_color": "#f97316", "height": 40, "left_image": None, "right_image": None})

@api_router.put("/promo-banner")
async def update_promo_banner(data: PromoBannerUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"key": "promo_banner"},
        {"$set": {"key": "promo_banner", "value": data.model_dump()}},
        upsert=True
    )
    return data.model_dump()

# ==================== FILE UPLOAD ====================

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 5MB")
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = UPLOADS_DIR / unique_filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Return URL
    return {"url": f"/api/uploads/{unique_filename}", "filename": unique_filename}

# ==================== PRODUCTS ROUTES ====================

@api_router.get("/products/popular", response_model=List[ProductResponse])
async def get_popular_products(limit: int = 6):
    """Get popular products based on order count"""
    # Aggregate order items to find most ordered products
    pipeline = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "order_count": {"$sum": "$items.quantity"}}},
        {"$sort": {"order_count": -1}},
        {"$limit": limit}
    ]
    popular_ids = await db.orders.aggregate(pipeline).to_list(limit)
    
    if popular_ids:
        product_ids = [p["_id"] for p in popular_ids]
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(limit)
        # Sort by order count
        id_to_count = {p["_id"]: p["order_count"] for p in popular_ids}
        products.sort(key=lambda x: id_to_count.get(x["id"], 0), reverse=True)
    else:
        # Fallback: return random products if no orders
        products = await db.products.find({}, {"_id": 0}).limit(limit).to_list(limit)
    
    return products

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products(search: Optional[str] = None, category_id: Optional[str] = None, limit: int = 100, skip: int = 0):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"article": {"$regex": search, "$options": "i"}},
            {"cross_articles": {"$regex": search, "$options": "i"}}  # Search in cross-articles too
        ]
    if category_id:
        query["category_id"] = category_id
    
    products = await db.products.find(query, {"_id": 0}).skip(skip).limit(min(limit, 100)).to_list(100)
    return products

@api_router.get("/products/search-with-alternatives")
async def search_products_with_alternatives(search: str, limit: int = 50):
    """Search products with exact matches first, then alternatives from cross_articles"""
    if not search:
        return {"exact": [], "alternatives": []}
    
    search_upper = search.upper().strip()
    
    # Find exact article match first
    exact_match = await db.products.find_one(
        {"article": {"$regex": f"^{search}$", "$options": "i"}},
        {"_id": 0}
    )
    
    # Find alternatives from cross_articles
    alternatives = []
    if search_upper:
        # Find products where cross_articles contains the search term
        alt_query = {
            "$and": [
                {"cross_articles": {"$regex": search, "$options": "i"}},
                {"article": {"$not": {"$regex": f"^{search}$", "$options": "i"}}}  # Exclude exact match
            ]
        }
        alternatives = await db.products.find(alt_query, {"_id": 0}).limit(limit).to_list(limit)
    
    # Also search by name if no exact article match
    name_matches = []
    if not exact_match:
        name_query = {"name": {"$regex": search, "$options": "i"}}
        name_matches = await db.products.find(name_query, {"_id": 0}).limit(limit).to_list(limit)
    
    return {
        "exact": [exact_match] if exact_match else name_matches,
        "alternatives": alternatives
    }

@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.post("/products", response_model=ProductResponse)
async def create_product(data: ProductCreate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    product_id = str(uuid.uuid4())
    product = {
        "id": product_id,
        **data.model_dump()
    }
    await db.products.insert_one(product)
    return product

@api_router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, data: ProductUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.products.update_one({"id": product_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    return product

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@api_router.get("/categories")
async def get_categories():
    return []

# ==================== CART ROUTES ====================

@api_router.get("/cart")
async def get_cart(user=Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        cart = {"user_id": user["id"], "items": []}
        await db.carts.insert_one(cart)
    
    # Batch fetch all products
    product_ids = [item["product_id"] for item in cart.get("items", [])]
    if not product_ids:
        return {"items": []}
    
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(100)
    products_map = {p["id"]: p for p in products}
    
    items_with_details = []
    for item in cart.get("items", []):
        product = products_map.get(item["product_id"])
        if product:
            items_with_details.append({
                "product_id": item["product_id"],
                "name": product["name"],
                "article": product["article"],
                "manufacturer": product.get("manufacturer"),
                "price": product["price"],
                "quantity": item["quantity"],
                "image_url": product.get("image_url")
            })
    
    return {"items": items_with_details}

@api_router.post("/cart/add")
async def add_to_cart(item: CartItem, user=Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        await db.carts.insert_one({"user_id": user["id"], "items": [item.model_dump()]})
    else:
        items = cart.get("items", [])
        existing = next((i for i in items if i["product_id"] == item.product_id), None)
        if existing:
            existing["quantity"] += item.quantity
        else:
            items.append(item.model_dump())
        await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}})
    
    return {"message": "Added to cart"}

@api_router.post("/cart/update")
async def update_cart_item(item: CartItem, user=Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]})
    if cart:
        items = cart.get("items", [])
        for i in items:
            if i["product_id"] == item.product_id:
                i["quantity"] = item.quantity
                break
        await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}})
    return {"message": "Cart updated"}

@api_router.delete("/cart/{product_id}")
async def remove_from_cart(product_id: str, user=Depends(get_current_user)):
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$pull": {"items": {"product_id": product_id}}}
    )
    return {"message": "Removed from cart"}

@api_router.delete("/cart")
async def clear_cart(user=Depends(get_current_user)):
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    return {"message": "Cart cleared"}

# ==================== ORDERS ROUTES ====================

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(data: OrderCreate, user=Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Batch fetch all products
    product_ids = [item["product_id"] for item in cart["items"]]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(100)
    products_map = {p["id"]: p for p in products}
    
    # Build order items
    items = []
    total = 0
    for cart_item in cart["items"]:
        product = products_map.get(cart_item["product_id"])
        if product:
            item_data = {
                "product_id": cart_item["product_id"],
                "name": product["name"],
                "article": product["article"],
                "manufacturer": product.get("manufacturer"),
                "price": product["price"],
                "quantity": cart_item["quantity"],
                "image_url": product.get("image_url")
            }
            items.append(item_data)
            total += product["price"] * cart_item["quantity"]
    
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "user_id": user["id"],
        "items": items,
        "total": total,
        "status": "pending",
        "full_name": data.full_name,
        "address": data.address,
        "phone": data.phone,
        "payment_method": "cash",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order)
    
    # Clear cart
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    
    # Send Telegram notification
    await send_telegram_order_notification(order, user)
    
    # Note: Bonus progress is updated only when order status changes to "delivered"
    # See update_order_status endpoint
    
    return order

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(user=Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

@api_router.get("/orders/stats")
async def get_user_order_stats(user=Depends(get_current_user)):
    """Get extended order statistics for current user"""
    from collections import defaultdict
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    
    if not orders:
        return {
            "total_orders": 0,
            "total_spent": 0,
            "avg_order_value": 0,
            "total_items": 0,
            "by_status": {},
            "by_month": [],
            "delivered_total": 0,
            "pending_total": 0,
            "first_order_date": None,
            "last_order_date": None,
            "favorite_products": [],
            "total_products_types": 0
        }
    
    # Calculate stats
    total_orders = len(orders)
    total_spent = sum(o.get("total", 0) for o in orders)
    total_items = sum(sum(item.get("quantity", 0) for item in o.get("items", [])) for o in orders)
    avg_order_value = total_spent / total_orders if total_orders > 0 else 0
    
    # Delivered vs pending totals
    delivered_total = sum(o.get("total", 0) for o in orders if o.get("status") == "delivered")
    pending_total = sum(o.get("total", 0) for o in orders if o.get("status") in ["pending", "processing", "shipped"])
    
    # By status
    by_status = {}
    for o in orders:
        status = o.get("status", "pending")
        by_status[status] = by_status.get(status, 0) + 1
    
    # By month (last 12 months)
    by_month_dict = defaultdict(lambda: {"orders": 0, "total": 0})
    for o in orders:
        created_at = o.get("created_at", "")
        if created_at:
            month_key = created_at[:7]  # YYYY-MM
            by_month_dict[month_key]["orders"] += 1
            by_month_dict[month_key]["total"] += o.get("total", 0)
    
    # Sort and limit to last 12 months
    by_month = sorted([{"month": k, **v} for k, v in by_month_dict.items()], key=lambda x: x["month"], reverse=True)[:12]
    by_month.reverse()  # Oldest first
    
    # First and last order dates
    order_dates = [o.get("created_at") for o in orders if o.get("created_at")]
    first_order_date = min(order_dates) if order_dates else None
    last_order_date = max(order_dates) if order_dates else None
    
    # Favorite products (most ordered)
    product_count = defaultdict(lambda: {"name": "", "article": "", "count": 0, "total_spent": 0})
    unique_products = set()
    for o in orders:
        for item in o.get("items", []):
            pid = item.get("product_id") or item.get("article", "")
            unique_products.add(pid)
            product_count[pid]["name"] = item.get("name", "")
            product_count[pid]["article"] = item.get("article", "")
            product_count[pid]["count"] += item.get("quantity", 1)
            product_count[pid]["total_spent"] += item.get("price", 0) * item.get("quantity", 1)
    
    favorite_products = sorted(
        [{"product_id": k, **v} for k, v in product_count.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:5]  # Top 5 products
    
    return {
        "total_orders": total_orders,
        "total_spent": round(total_spent, 2),
        "avg_order_value": round(avg_order_value, 2),
        "total_items": total_items,
        "by_status": by_status,
        "by_month": by_month,
        "delivered_total": round(delivered_total, 2),
        "pending_total": round(pending_total, 2),
        "first_order_date": first_order_date,
        "last_order_date": last_order_date,
        "favorite_products": favorite_products,
        "total_products_types": len(unique_products)
    }

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, user=Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

# ==================== FAVORITES ROUTES ====================

@api_router.get("/favorites")
async def get_favorites(user=Depends(get_current_user)):
    favorites = await db.favorites.find_one({"user_id": user["id"]}, {"_id": 0})
    if not favorites:
        return {"items": []}
    
    # Fetch product details
    product_ids = favorites.get("items", [])
    if not product_ids:
        return {"items": []}
    
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(100)
    return {"items": products}

@api_router.post("/favorites/add")
async def add_to_favorites(item: FavoriteItem, user=Depends(get_current_user)):
    favorites = await db.favorites.find_one({"user_id": user["id"]})
    if not favorites:
        await db.favorites.insert_one({"user_id": user["id"], "items": [item.product_id]})
    else:
        if item.product_id not in favorites.get("items", []):
            await db.favorites.update_one(
                {"user_id": user["id"]},
                {"$push": {"items": item.product_id}}
            )
    return {"message": "Added to favorites"}

@api_router.delete("/favorites/{product_id}")
async def remove_from_favorites(product_id: str, user=Depends(get_current_user)):
    await db.favorites.update_one(
        {"user_id": user["id"]},
        {"$pull": {"items": product_id}}
    )
    return {"message": "Removed from favorites"}

@api_router.get("/favorites/check/{product_id}")
async def check_favorite(product_id: str, user=Depends(get_current_user)):
    favorites = await db.favorites.find_one({"user_id": user["id"]}, {"_id": 0})
    is_favorite = product_id in favorites.get("items", []) if favorites else False
    return {"is_favorite": is_favorite}

# ==================== RELATED PRODUCTS ====================

@api_router.get("/products/{product_id}/related", response_model=List[ProductResponse])
async def get_related_products(product_id: str, limit: int = 4):
    """Get related products from same category"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    query = {"id": {"$ne": product_id}}
    
    # If product has category, find from same category
    if product.get("category_id"):
        query["category_id"] = product["category_id"]
    
    related = await db.products.find(query, {"_id": 0}).limit(limit).to_list(limit)
    
    # If not enough products from same category, add random ones
    if len(related) < limit:
        additional_query = {"id": {"$nin": [product_id] + [r["id"] for r in related]}}
        additional = await db.products.find(additional_query, {"_id": 0}).limit(limit - len(related)).to_list(limit)
        related.extend(additional)
    
    return related

# ==================== TELEGRAM NOTIFICATIONS ====================

async def send_telegram_order_notification(order: dict, user: dict):
    """Send order notification to Telegram with full product details"""
    try:
        settings = await db.settings.find_one({"key": "telegram"}, {"_id": 0})
        if not settings or not settings.get("value", {}).get("enabled"):
            return
        
        bot_token = settings["value"].get("bot_token", "")
        chat_id = settings["value"].get("chat_id", "")
        
        if not bot_token or not chat_id:
            return
        
        # Format items with full details
        items_lines = []
        for item in order["items"]:
            article = item.get('article', 'N/A')
            name = item.get('name', 'Товар')
            manufacturer = item.get('manufacturer', '')
            quantity = item.get('quantity', 1)
            price = item.get('price', 0)
            line_total = price * quantity
            
            # Format: Article | Name | Manufacturer | Qty × Price = Total
            manufacturer_text = f" ({manufacturer})" if manufacturer else ""
            items_lines.append(
                f"  📦 *{article}*\n"
                f"      {name}{manufacturer_text}\n"
                f"      {quantity} шт. × {price:,.0f} ₽ = *{line_total:,.0f} ₽*"
            )
        
        items_text = "\n\n".join(items_lines)
        
        message = f"""🛒 *НОВЫЙ ЗАКАЗ!*

📋 *Заказ #{order['id'][:8]}*
📅 {datetime.now().strftime('%d.%m.%Y %H:%M')}

👤 *Клиент:* {order['full_name']}
📞 *Телефон:* {order['phone']}
📍 *Адрес:* {order['address']}

━━━━━━━━━━━━━━━━━━
*ТОВАРЫ ({len(order['items'])} шт.):*
━━━━━━━━━━━━━━━━━━

{items_text}

━━━━━━━━━━━━━━━━━━
💰 *ИТОГО: {order['total']:,.0f} ₽*
💳 *Оплата:* наличными при получении"""

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        async with httpx.AsyncClient() as client:
            await client.post(url, json={
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "Markdown"
            })
    except Exception as e:
        logger.error(f"Failed to send Telegram notification: {e}")

@api_router.get("/admin/telegram-settings")
async def get_telegram_settings(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.settings.find_one({"key": "telegram"}, {"_id": 0})
    if not settings:
        return {"enabled": False, "bot_token": "", "chat_id": ""}
    return settings.get("value", {"enabled": False, "bot_token": "", "chat_id": ""})

@api_router.put("/admin/telegram-settings")
async def update_telegram_settings(data: TelegramSettings, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.settings.update_one(
        {"key": "telegram"},
        {"$set": {"key": "telegram", "value": data.model_dump()}},
        upsert=True
    )
    return {"message": "Telegram settings updated"}

@api_router.post("/admin/telegram-test")
async def test_telegram_notification(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.settings.find_one({"key": "telegram"}, {"_id": 0})
    if not settings or not settings.get("value"):
        raise HTTPException(status_code=400, detail="Telegram settings not configured")
    
    bot_token = settings["value"].get("bot_token", "")
    chat_id = settings["value"].get("chat_id", "")
    
    if not bot_token or not chat_id:
        raise HTTPException(status_code=400, detail="Bot token or chat ID not configured")
    
    try:
        message = "✅ Тестовое уведомление от avopt.store\nНастройка Telegram успешна!"
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json={
                "chat_id": chat_id,
                "text": message
            })
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Telegram API error: {response.text}")
        return {"message": "Test notification sent"}
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to Telegram: {str(e)}")

# ==================== PARTNER BRANDS ====================

class PartnerBrand(BaseModel):
    name: str
    description: str = ""
    image_url: str = ""
    link: str = ""
    order: int = 0

@api_router.get("/partners")
async def get_partners():
    """Get all partner brands for homepage"""
    partners = await db.partners.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return partners

@api_router.post("/admin/partners")
async def create_partner(partner: PartnerBrand, user=Depends(get_current_user)):
    """Create a new partner brand (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    partner_id = str(uuid.uuid4())
    partner_data = {
        "id": partner_id,
        "name": partner.name,
        "description": partner.description,
        "image_url": partner.image_url,
        "link": partner.link,
        "order": partner.order,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.partners.insert_one(partner_data)
    
    return {k: v for k, v in partner_data.items() if k != "_id"}

@api_router.put("/admin/partners/{partner_id}")
async def update_partner(partner_id: str, partner: PartnerBrand, user=Depends(get_current_user)):
    """Update a partner brand (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.partners.update_one(
        {"id": partner_id},
        {"$set": {
            "name": partner.name,
            "description": partner.description,
            "image_url": partner.image_url,
            "link": partner.link,
            "order": partner.order,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    updated = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/partners/{partner_id}")
async def delete_partner(partner_id: str, user=Depends(get_current_user)):
    """Delete a partner brand (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.partners.delete_one({"id": partner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    return {"message": "Partner deleted"}

@api_router.post("/admin/partners/upload-image")
async def upload_partner_image(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload partner logo image to Cloudinary"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Read file content
    content = await file.read()
    
    try:
        # Upload to Cloudinary
        result = await upload_to_cloudinary(content, file.filename, folder="partners")
        
        return {
            "url": result['url'],
            "public_id": result['public_id'],
            "filename": file.filename
        }
    except Exception as e:
        logger.error(f"Failed to upload partner image: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки изображения: {str(e)}")

@api_router.post("/admin/partners/seed")
async def seed_default_partners(user=Depends(get_current_user)):
    """Seed default partner brands if none exist (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    count = await db.partners.count_documents({})
    if count > 0:
        return {"message": "Partners already exist", "count": count}
    
    default_partners = [
        {"name": "FAG", "description": "Подшипники", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/se4069qi_Screenshot%20%281%29.png"},
        {"name": "HENGST", "description": "Фильтры", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/k3fl5886_Screenshot%20%282%29.png"},
        {"name": "MANN+HUMMEL", "description": "Фильтрация", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/8hwi685y_Screenshot%20%283%29.png"},
        {"name": "PACCAR", "description": "Комплектующие", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/lxmklmq6_Screenshot%20%284%29.png"},
        {"name": "SAF", "description": "Оси и подвеска", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/54osguxt_Screenshot%20%285%29.png"},
        {"name": "BPW", "description": "Ходовая часть", "image_url": "https://customer-assets.emergentagent.com/job_heavy-vehicle/artifacts/qjidmkpu_Screenshot%20%285%29.png"},
    ]
    
    for i, p in enumerate(default_partners):
        await db.partners.insert_one({
            "id": str(uuid.uuid4()),
            "name": p["name"],
            "description": p["description"],
            "image_url": p["image_url"],
            "link": "",
            "order": i,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Default partners created", "count": len(default_partners)}

# ==================== USER PROFILE PHOTO ====================

@api_router.post("/users/avatar")
async def upload_avatar(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload user profile avatar"""
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read and validate size
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    
    # Save file
    file_ext = Path(file.filename).suffix or '.jpg'
    file_name = f"avatar_{user['id']}{file_ext}"
    file_path = UPLOADS_DIR / file_name
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    avatar_url = f"/api/uploads/{file_name}"
    
    # Update user
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"avatar_url": avatar_url}}
    )
    
    return {"avatar_url": avatar_url}

@api_router.delete("/users/avatar")
async def delete_avatar(user=Depends(get_current_user)):
    """Delete user profile avatar"""
    current_user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    if current_user and current_user.get("avatar_url"):
        # Delete file
        file_path = UPLOADS_DIR / Path(current_user["avatar_url"]).name
        if file_path.exists():
            file_path.unlink()
        
        # Update user
        await db.users.update_one(
            {"id": user["id"]},
            {"$unset": {"avatar_url": ""}}
        )
    
    return {"message": "Avatar deleted"}

# ==================== CHAT ROUTES ====================

# Telegram Chat Bot token
TELEGRAM_CHAT_BOT_TOKEN = os.environ.get('TELEGRAM_CHAT_BOT_TOKEN')
telegram_chat_id_mapping = {}  # Maps telegram_chat_id -> website_chat_id

async def send_to_telegram_chat(chat_id: str, user_name: str, text: str, message_type: str = "text", file_url: str = None):
    """Send user message to Telegram for admin to see"""
    if not TELEGRAM_CHAT_BOT_TOKEN:
        return
    
    # Get admin chat settings to find Telegram chat ID for receiving messages
    settings = await db.telegram_chat_settings.find_one({"setting_type": "chat_bot"})
    if not settings or not settings.get("admin_chat_id"):
        return
    
    admin_tg_chat_id = settings["admin_chat_id"]
    
    # Format message
    formatted_text = f"💬 *Новое сообщение в чат*\n\n"
    formatted_text += f"👤 *От:* {user_name}\n"
    formatted_text += f"🆔 *Чат:* `{chat_id[:8]}...`\n\n"
    
    if message_type == "text":
        formatted_text += f"📝 {text}"
    elif message_type == "image":
        formatted_text += f"🖼 *Изображение*\n{file_url}"
    elif message_type == "file":
        formatted_text += f"📎 *Файл*\n{file_url}"
    
    # Add reply keyboard with chat_id
    formatted_text += f"\n\n💡 _Чтобы ответить, используйте команду:_\n`/reply {chat_id} Ваш ответ`"
    
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": admin_tg_chat_id,
                    "text": formatted_text,
                    "parse_mode": "Markdown"
                },
                timeout=10
            )
    except Exception as e:
        logging.error(f"Failed to send to Telegram chat: {e}")

@api_router.post("/chat/send")
async def send_chat_message(message: ChatMessage, user=Depends(get_current_user)):
    """Send a chat message"""
    # Get or create chat for user
    chat = await db.chats.find_one({"user_id": user["id"]})
    if not chat:
        chat_id = str(uuid.uuid4())
        await db.chats.insert_one({
            "id": chat_id,
            "user_id": user["id"],
            "user_name": user["name"],
            "user_email": user["email"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "pinned": False,
            "labels": []
        })
    else:
        chat_id = chat["id"]
        await db.chats.update_one({"id": chat_id}, {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    
    msg_id = str(uuid.uuid4())
    chat_message = {
        "id": msg_id,
        "chat_id": chat_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "text": message.text,
        "sender_type": "user",
        "message_type": "text",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
        "edited": False
    }
    await db.chat_messages.insert_one(chat_message)
    
    # Send to Telegram
    await send_to_telegram_chat(chat_id, user["name"], message.text)
    
    return {"id": msg_id, "chat_id": chat_id}

@api_router.get("/chat/messages")
async def get_chat_messages(user=Depends(get_current_user)):
    """Get chat messages for current user"""
    chat = await db.chats.find_one({"user_id": user["id"]})
    if not chat:
        return {"messages": [], "chat_id": None}
    
    messages = await db.chat_messages.find({"chat_id": chat["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"messages": messages, "chat_id": chat["id"]}

@api_router.get("/admin/chats")
async def get_all_chats(user=Depends(get_current_user)):
    """Get all chats for admin"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    chats = await db.chats.find({}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    
    # Get unread count for each chat
    for chat in chats:
        unread_count = await db.chat_messages.count_documents({
            "chat_id": chat["id"],
            "sender_type": "user",
            "read": False
        })
        chat["unread_count"] = unread_count
    
    return chats

@api_router.get("/admin/chats/{chat_id}/messages")
async def get_chat_messages_admin(chat_id: str, user=Depends(get_current_user)):
    """Get messages for specific chat (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    messages = await db.chat_messages.find({"chat_id": chat_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    
    # Mark messages as read
    await db.chat_messages.update_many(
        {"chat_id": chat_id, "sender_type": "user", "read": False},
        {"$set": {"read": True}}
    )
    
    return {"messages": messages}

@api_router.post("/admin/chats/{chat_id}/send")
async def send_admin_message(chat_id: str, message: ChatMessage, user=Depends(get_current_user)):
    """Send message as admin"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    chat = await db.chats.find_one({"id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    msg_id = str(uuid.uuid4())
    chat_message = {
        "id": msg_id,
        "chat_id": chat_id,
        "user_id": user["id"],
        "user_name": "Поддержка",
        "text": message.text,
        "sender_type": "admin",
        "message_type": "text",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    await db.chat_messages.insert_one(chat_message)
    
    await db.chats.update_one({"id": chat_id}, {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    
    return {"id": msg_id}

@api_router.post("/admin/chats/{chat_id}/upload")
async def admin_upload_chat_media(chat_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload media file for chat from admin panel to Cloudinary"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    chat = await db.chats.find_one({"id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Read file content
    content = await file.read()
    
    try:
        # Upload to Cloudinary
        result = await upload_to_cloudinary(content, file.filename, folder="admin_chat")
        
        return {
            "url": result['url'],
            "public_id": result['public_id'],
            "filename": file.filename,
            "is_image": result['is_image'],
            "is_video": result['is_video'],
            "resource_type": result['resource_type']
        }
    except Exception as e:
        logger.error(f"Failed to upload to Cloudinary: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки файла: {str(e)}")

@api_router.post("/admin/chats/{chat_id}/send-media")
async def admin_send_chat_media(
    chat_id: str,
    file_url: str = None,
    filename: str = None,
    is_image: bool = False,
    is_video: bool = False,
    caption: str = "",
    user=Depends(get_current_user)
):
    """Send media message as admin"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    chat = await db.chats.find_one({"id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    msg_id = str(uuid.uuid4())
    
    # Determine message type
    if is_video:
        message_type = "video"
    elif is_image:
        message_type = "image"
    else:
        message_type = "file"
    
    chat_message = {
        "id": msg_id,
        "chat_id": chat_id,
        "user_id": user["id"],
        "user_name": "Поддержка",
        "text": caption,
        "file_url": file_url,
        "filename": filename,
        "sender_type": "admin",
        "message_type": message_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
        "edited": False
    }
    await db.chat_messages.insert_one(chat_message)
    
    await db.chats.update_one({"id": chat_id}, {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    
    return {"id": msg_id}

@api_router.get("/chat/unread-count")
async def get_unread_count(user=Depends(get_current_user)):
    """Get unread message count for user"""
    chat = await db.chats.find_one({"user_id": user["id"]})
    if not chat:
        return {"count": 0}
    
    count = await db.chat_messages.count_documents({
        "chat_id": chat["id"],
        "sender_type": "admin",
        "read": False
    })
    return {"count": count}

@api_router.post("/chat/mark-read")
async def mark_messages_read(user=Depends(get_current_user)):
    """Mark all admin messages as read for user"""
    chat = await db.chats.find_one({"user_id": user["id"]})
    if chat:
        await db.chat_messages.update_many(
            {"chat_id": chat["id"], "sender_type": "admin", "read": False},
            {"$set": {"read": True}}
        )
    return {"message": "Messages marked as read"}

# ==================== CHAT MEDIA UPLOAD ====================

@api_router.post("/chat/upload")
async def upload_chat_media(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload media file for chat to Cloudinary"""
    # Read file content
    content = await file.read()
    
    try:
        # Upload to Cloudinary
        result = await upload_to_cloudinary(content, file.filename, folder="chat")
        
        return {
            "url": result['url'],
            "public_id": result['public_id'],
            "filename": file.filename,
            "is_image": result['is_image'],
            "is_video": result['is_video'],
            "resource_type": result['resource_type']
        }
    except Exception as e:
        logger.error(f"Failed to upload to Cloudinary: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки файла: {str(e)}")

@api_router.post("/chat/send-media")
async def send_chat_media(
    chat_id: Optional[str] = None,
    file_url: str = None,
    filename: str = None,
    is_image: bool = False,
    is_video: bool = False,
    caption: str = "",
    user=Depends(get_current_user)
):
    """Send media message in chat"""
    # Get or create chat for user
    chat = await db.chats.find_one({"user_id": user["id"]})
    if not chat:
        new_chat_id = str(uuid.uuid4())
        await db.chats.insert_one({
            "id": new_chat_id,
            "user_id": user["id"],
            "user_name": user["name"],
            "user_email": user["email"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "pinned": False,
            "labels": []
        })
        chat_id = new_chat_id
    else:
        chat_id = chat["id"]
        await db.chats.update_one({"id": chat_id}, {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    
    msg_id = str(uuid.uuid4())
    
    # Determine message type
    if is_video:
        message_type = "video"
    elif is_image:
        message_type = "image"
    else:
        message_type = "file"
    
    chat_message = {
        "id": msg_id,
        "chat_id": chat_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "text": caption,
        "file_url": file_url,
        "filename": filename,
        "sender_type": "user",
        "message_type": message_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False,
        "edited": False
    }
    await db.chat_messages.insert_one(chat_message)
    
    # Send notification to Telegram
    await send_to_telegram_chat(chat_id, user["name"], caption or filename, message_type, file_url)
    
    return {"id": msg_id, "chat_id": chat_id}

# ==================== TELEGRAM CHAT BOT WEBHOOK ====================

class TelegramUpdate(BaseModel):
    update_id: int
    message: Optional[Dict[str, Any]] = None

@api_router.post("/telegram/chat-webhook")
async def telegram_chat_webhook(update: TelegramUpdate):
    """Webhook for Telegram chat bot - receives admin replies"""
    if not update.message:
        return {"ok": True}
    
    message = update.message
    chat_id_tg = str(message.get("chat", {}).get("id", ""))
    text = message.get("text", "")
    
    # Check for /reply command
    if text.startswith("/reply "):
        parts = text[7:].split(" ", 1)
        if len(parts) >= 2:
            website_chat_id = parts[0]
            reply_text = parts[1]
            
            # Find the chat
            chat = await db.chats.find_one({"id": website_chat_id})
            if not chat:
                # Try partial match
                chat = await db.chats.find_one({"id": {"$regex": f"^{website_chat_id}"}})
            
            if chat:
                # Send admin message to chat
                msg_id = str(uuid.uuid4())
                chat_message = {
                    "id": msg_id,
                    "chat_id": chat["id"],
                    "user_id": "telegram_admin",
                    "user_name": "Поддержка (Telegram)",
                    "text": reply_text,
                    "sender_type": "admin",
                    "message_type": "text",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "read": False,
                    "edited": False
                }
                await db.chat_messages.insert_one(chat_message)
                await db.chats.update_one({"id": chat["id"]}, {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
                
                # Send confirmation to Telegram
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                            json={
                                "chat_id": chat_id_tg,
                                "text": f"✅ Сообщение отправлено пользователю {chat['user_name']}",
                                "reply_to_message_id": message.get("message_id")
                            },
                            timeout=10
                        )
                except:
                    pass
            else:
                # Chat not found
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                            json={
                                "chat_id": chat_id_tg,
                                "text": f"❌ Чат с ID '{website_chat_id}' не найден"
                            },
                            timeout=10
                        )
                except:
                    pass
    
    # Check for /start command - save admin chat ID
    elif text == "/start":
        await db.telegram_chat_settings.update_one(
            {"setting_type": "chat_bot"},
            {"$set": {"admin_chat_id": chat_id_tg, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                    json={
                        "chat_id": chat_id_tg,
                        "text": "✅ Чат-бот подключен!\n\nТеперь вы будете получать сообщения от пользователей сайта.\n\nДля ответа используйте команду:\n`/reply <chat_id> Ваш ответ`",
                        "parse_mode": "Markdown"
                    },
                    timeout=10
                )
        except:
            pass
    
    # Check for /chats command - list active chats
    elif text == "/chats":
        chats = await db.chats.find({}, {"_id": 0}).sort("updated_at", -1).limit(10).to_list(10)
        if chats:
            chat_list = "📋 *Последние чаты:*\n\n"
            for c in chats:
                unread = await db.chat_messages.count_documents({"chat_id": c["id"], "sender_type": "user", "read": False})
                status = "🔴" if unread > 0 else "⚪"
                chat_list += f"{status} `{c['id'][:8]}` - {c['user_name']}"
                if unread > 0:
                    chat_list += f" ({unread} новых)"
                chat_list += "\n"
            
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                        json={
                            "chat_id": chat_id_tg,
                            "text": chat_list,
                            "parse_mode": "Markdown"
                        },
                        timeout=10
                    )
            except:
                pass
        else:
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/sendMessage",
                        json={"chat_id": chat_id_tg, "text": "📭 Чатов пока нет"},
                        timeout=10
                    )
            except:
                pass
    
    return {"ok": True}

@api_router.post("/admin/chat/setup-telegram-webhook")
async def setup_telegram_chat_webhook(user=Depends(get_current_user)):
    """Setup Telegram webhook for chat bot"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not TELEGRAM_CHAT_BOT_TOKEN:
        raise HTTPException(status_code=400, detail="TELEGRAM_CHAT_BOT_TOKEN не настроен")
    
    # Get backend URL from environment or construct it
    backend_url = os.environ.get('BACKEND_URL', '')
    if not backend_url:
        # Try to get from request
        raise HTTPException(status_code=400, detail="BACKEND_URL не настроен")
    
    webhook_url = f"{backend_url}/api/telegram/chat-webhook"
    
    try:
        async with httpx.AsyncClient() as client:
            # Delete existing webhook first
            await client.post(f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/deleteWebhook")
            
            # Set new webhook
            res = await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_CHAT_BOT_TOKEN}/setWebhook",
                json={"url": webhook_url}
            )
            result = res.json()
            
            if result.get("ok"):
                return {"success": True, "message": "Webhook установлен", "url": webhook_url}
            else:
                raise HTTPException(status_code=400, detail=result.get("description", "Ошибка установки webhook"))
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Ошибка подключения к Telegram: {str(e)}")

# ==================== CHAT MANAGEMENT (ADMIN) ====================

@api_router.put("/admin/chats/{chat_id}/pin")
async def toggle_pin_chat(chat_id: str, user=Depends(get_current_user)):
    """Toggle pin status of a chat"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    chat = await db.chats.find_one({"id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    new_pinned = not chat.get("pinned", False)
    await db.chats.update_one({"id": chat_id}, {"$set": {"pinned": new_pinned}})
    
    return {"pinned": new_pinned}

@api_router.put("/admin/chats/{chat_id}/label")
async def update_chat_label(chat_id: str, label: str = "", user=Depends(get_current_user)):
    """Add or remove label from chat"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    chat = await db.chats.find_one({"id": chat_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    labels = chat.get("labels", [])
    if label in labels:
        labels.remove(label)
    else:
        labels.append(label)
    
    await db.chats.update_one({"id": chat_id}, {"$set": {"labels": labels}})
    
    return {"labels": labels}

@api_router.delete("/admin/chats/{chat_id}")
async def delete_chat(chat_id: str, user=Depends(get_current_user)):
    """Delete a chat and all its messages"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.chat_messages.delete_many({"chat_id": chat_id})
    await db.chats.delete_one({"id": chat_id})
    
    return {"message": "Chat deleted"}

@api_router.put("/admin/chats/{chat_id}/messages/{message_id}")
async def edit_chat_message(chat_id: str, message_id: str, message: ChatMessage, user=Depends(get_current_user)):
    """Edit a chat message"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.chat_messages.update_one(
        {"id": message_id, "chat_id": chat_id},
        {"$set": {"text": message.text, "edited": True, "edited_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"message": "Message updated"}

@api_router.delete("/admin/chats/{chat_id}/messages/{message_id}")
async def delete_chat_message(chat_id: str, message_id: str, user=Depends(get_current_user)):
    """Delete a chat message"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.chat_messages.delete_one({"id": message_id, "chat_id": chat_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"message": "Message deleted"}

# ==================== BONUS PROGRAM ====================

class BonusSettings(BaseModel):
    title: str = "Бонусная программа"
    description: str = "Накопите баллы и получите призы!"
    image_url: str = ""
    max_amount: float = 50000  # Maximum scale amount
    min_threshold: float = 5000  # Minimum threshold to request bonus
    enabled: bool = True

class BonusPrize(BaseModel):
    id: str = ""
    name: str
    description: str = ""
    image_url: str = ""
    points_cost: float  # Сколько баллов стоит приз
    quantity: int = -1  # -1 = unlimited
    enabled: bool = True

class BonusLevel(BaseModel):
    id: str = ""
    name: str  # Название уровня (Бронза, Серебро, Золото)
    min_points: float = 0  # Минимум баллов для достижения уровня
    cashback_percent: float = 0  # Процент кешбэка на этом уровне
    color: str = "#f97316"  # Цвет уровня для отображения
    benefits: str = ""  # Описание привилегий уровня

class BonusProgramCreate(BaseModel):
    title: str = "Бонусная программа"
    description: str = ""
    full_description: str = ""  # Расширенное описание с текстом
    image_url: str = ""
    max_amount: float = 50000
    min_threshold: float = 5000
    contribution_type: str = "order_total"  # "order_total" or "percentage"
    contribution_percent: float = 100  # Used when contribution_type is "percentage"
    enabled: bool = True
    prizes: List[dict] = []  # Список призов
    levels: List[dict] = []  # Список уровней программы

# ==================== MULTIPLE BONUS PROGRAMS ====================

async def get_all_bonus_programs():
    """Get all bonus programs"""
    programs = await db.bonus_programs.find({}, {"_id": 0}).to_list(100)
    return programs

async def get_bonus_program(program_id: str):
    """Get single bonus program by ID"""
    program = await db.bonus_programs.find_one({"id": program_id}, {"_id": 0})
    return program

async def get_user_program_progress(user_id: str, program_id: str):
    """Get user's progress for a specific program"""
    progress = await db.bonus_progress.find_one(
        {"user_id": user_id, "program_id": program_id}, 
        {"_id": 0}
    )
    if not progress:
        progress = {
            "user_id": user_id,
            "program_id": program_id,
            "current_amount": 0,
            "bonus_requested": False,
            "request_date": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bonus_progress.insert_one(progress)
        progress = await db.bonus_progress.find_one(
            {"user_id": user_id, "program_id": program_id}, 
            {"_id": 0}
        )
    return progress

async def update_bonus_on_order_delivered(user_id: str, order_total: float):
    """Called when order status changes to 'delivered' - updates all programs"""
    programs = await get_all_bonus_programs()
    
    for program in programs:
        if not program.get("enabled"):
            continue
        
        program_id = program["id"]
        progress = await get_user_program_progress(user_id, program_id)
        
        # Calculate contribution based on program type
        contribution_type = program.get("contribution_type", "order_total")
        if contribution_type == "percentage":
            contribution = order_total * (program.get("contribution_percent", 100) / 100)
        else:
            contribution = order_total
        
        # Cap at max_amount
        new_amount = min(progress["current_amount"] + contribution, program["max_amount"])
        
        await db.bonus_progress.update_one(
            {"user_id": user_id, "program_id": program_id},
            {"$set": {"current_amount": new_amount}}
        )
    
    return {"updated": True}

@api_router.get("/bonus/programs")
async def get_user_bonus_programs(user=Depends(get_current_user)):
    """Get all bonus programs with user's progress"""
    programs = await get_all_bonus_programs()
    
    result = []
    for program in programs:
        if not program.get("enabled"):
            continue
        
        progress = await get_user_program_progress(user["id"], program["id"])
        
        max_amount = program.get("max_amount", 50000)
        current = progress.get("current_amount", 0)
        percentage = min(100, (current / max_amount) * 100) if max_amount > 0 else 0
        
        min_threshold = program.get("min_threshold", 5000)
        can_request = current >= min_threshold and not progress.get("bonus_requested", False)
        
        # Calculate current level and next level
        levels = program.get("levels", [])
        levels_sorted = sorted(levels, key=lambda x: x.get("min_points", 0))
        
        current_level = None
        next_level = None
        
        for i, level in enumerate(levels_sorted):
            if current >= level.get("min_points", 0):
                current_level = level
                # Check if there's a next level
                if i + 1 < len(levels_sorted):
                    next_level = levels_sorted[i + 1]
                else:
                    next_level = None
        
        result.append({
            "id": program["id"],
            "title": program.get("title", "Бонусная программа"),
            "description": program.get("description", ""),
            "full_description": program.get("full_description", ""),
            "image_url": program.get("image_url", ""),
            "contribution_type": program.get("contribution_type", "order_total"),
            "contribution_percent": program.get("contribution_percent", 100),
            "current_amount": round(current, 2),
            "max_amount": max_amount,
            "min_threshold": min_threshold,
            "percentage": round(percentage, 1),
            "can_request": can_request,
            "bonus_requested": progress.get("bonus_requested", False),
            "request_date": progress.get("request_date"),
            "prizes": program.get("prizes", []),
            "levels": levels_sorted,
            "current_level": current_level,
            "next_level": next_level,
            "enabled": True
        })
    
    return {"programs": result}

@api_router.get("/bonus/progress")
async def get_bonus_progress(user=Depends(get_current_user)):
    """Get current user's bonus progress (legacy - returns first program)"""
    programs = await get_all_bonus_programs()
    active_programs = [p for p in programs if p.get("enabled")]
    
    if not active_programs:
        return {"enabled": False}
    
    program = active_programs[0]
    progress = await get_user_program_progress(user["id"], program["id"])
    
    max_amount = program.get("max_amount", 50000)
    current = progress.get("current_amount", 0)
    percentage = min(100, (current / max_amount) * 100) if max_amount > 0 else 0
    
    min_threshold = program.get("min_threshold", 5000)
    can_request = current >= min_threshold and not progress.get("bonus_requested", False)
    
    return {
        "program_id": program["id"],
        "title": program.get("title", "Бонусная программа"),
        "description": program.get("description", ""),
        "image_url": program.get("image_url", ""),
        "current_amount": round(current, 2),
        "max_amount": max_amount,
        "min_threshold": min_threshold,
        "percentage": round(percentage, 1),
        "can_request": can_request,
        "bonus_requested": progress.get("bonus_requested", False),
        "request_date": progress.get("request_date"),
        "enabled": True
    }

@api_router.get("/bonus/history")
async def get_bonus_history(user=Depends(get_current_user)):
    """Get user's bonus reward history"""
    history = await db.bonus_history.find(
        {"user_id": user["id"]}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"history": history}

@api_router.post("/bonus/request/{program_id}")
async def request_bonus_for_program(program_id: str, user=Depends(get_current_user)):
    """Request bonus for a specific program"""
    program = await get_bonus_program(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Программа не найдена")
    
    if not program.get("enabled"):
        raise HTTPException(status_code=400, detail="Бонусная программа отключена")
    
    progress = await get_user_program_progress(user["id"], program_id)
    
    if progress.get("bonus_requested"):
        raise HTTPException(status_code=400, detail="Вы уже отправили запрос на бонус по этой программе")
    
    if progress["current_amount"] <= 0:
        raise HTTPException(status_code=400, detail="У вас нет накопленных баллов")
    
    await db.bonus_progress.update_one(
        {"user_id": user["id"], "program_id": program_id},
        {"$set": {
            "bonus_requested": True,
            "request_date": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": "Запрос на бонус отправлен! Администратор свяжется с вами."
    }

@api_router.post("/bonus/redeem-prize/{program_id}/{prize_id}")
async def redeem_prize(program_id: str, prize_id: str, user=Depends(get_current_user)):
    """Redeem a prize using bonus points"""
    program = await get_bonus_program(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Бонусная программа не найдена")
    
    if not program.get("enabled"):
        raise HTTPException(status_code=400, detail="Бонусная программа отключена")
    
    # Find the prize
    prizes = program.get("prizes", [])
    prize = next((p for p in prizes if p.get("id") == prize_id), None)
    if not prize:
        raise HTTPException(status_code=404, detail="Приз не найден")
    
    if not prize.get("enabled", True):
        raise HTTPException(status_code=400, detail="Приз недоступен")
    
    # Check quantity
    if prize.get("quantity", -1) == 0:
        raise HTTPException(status_code=400, detail="Приз закончился")
    
    # Get user progress
    progress = await get_user_program_progress(user["id"], program_id)
    points_cost = prize.get("points_cost", 0)
    
    if progress["current_amount"] < points_cost:
        raise HTTPException(status_code=400, detail=f"Недостаточно баллов. Нужно {points_cost}, у вас {progress['current_amount']:.0f}")
    
    # Deduct points
    new_amount = progress["current_amount"] - points_cost
    await db.bonus_progress.update_one(
        {"user_id": user["id"], "program_id": program_id},
        {"$set": {"current_amount": new_amount}}
    )
    
    # Update prize quantity if not unlimited
    if prize.get("quantity", -1) > 0:
        await db.bonus_programs.update_one(
            {"id": program_id, "prizes.id": prize_id},
            {"$inc": {"prizes.$.quantity": -1}}
        )
    
    # Record redemption
    redemption = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "program_id": program_id,
        "prize_id": prize_id,
        "prize_name": prize.get("name"),
        "points_spent": points_cost,
        "status": "pending",  # pending, approved, delivered, cancelled
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.prize_redemptions.insert_one(redemption)
    
    return {
        "success": True,
        "message": f"Вы успешно обменяли {points_cost:.0f} баллов на приз «{prize.get('name')}»!",
        "new_balance": new_amount,
        "redemption_id": redemption["id"]
    }

@api_router.get("/bonus/redemptions")
async def get_user_redemptions(user=Depends(get_current_user)):
    """Get user's prize redemption history"""
    redemptions = await db.prize_redemptions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"redemptions": redemptions}

@api_router.get("/admin/prize-redemptions")
async def get_admin_prize_redemptions(user=Depends(get_current_user)):
    """Get all prize redemptions (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    redemptions = await db.prize_redemptions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"redemptions": redemptions}

@api_router.put("/admin/prize-redemptions/{redemption_id}")
async def update_prize_redemption(redemption_id: str, status: str, user=Depends(get_current_user)):
    """Update prize redemption status (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if status not in ["pending", "approved", "delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.prize_redemptions.update_one(
        {"id": redemption_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Redemption not found")
    
    # If cancelled, refund points
    if status == "cancelled":
        redemption = await db.prize_redemptions.find_one({"id": redemption_id}, {"_id": 0})
        if redemption:
            await db.bonus_progress.update_one(
                {"user_id": redemption["user_id"], "program_id": redemption["program_id"]},
                {"$inc": {"current_amount": redemption["points_spent"]}}
            )
    
    return {"success": True}

@api_router.post("/bonus/request")
async def request_bonus_legacy(user=Depends(get_current_user)):
    """Request bonus (legacy - for first program)"""
    programs = await get_all_bonus_programs()
    active_programs = [p for p in programs if p.get("enabled")]
    
    if not active_programs:
        raise HTTPException(status_code=400, detail="Нет активных бонусных программ")
    
    return await request_bonus_for_program(active_programs[0]["id"], user)

# Admin bonus program endpoints
@api_router.get("/admin/bonus/programs")
async def get_admin_bonus_programs(user=Depends(get_current_user)):
    """Get all bonus programs (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    programs = await get_all_bonus_programs()
    
    # Get stats for each program
    result = []
    for program in programs:
        # Count users with progress and pending requests
        progress_data = await db.bonus_progress.find(
            {"program_id": program["id"]},
            {"_id": 0}
        ).to_list(10000)
        
        pending_requests = sum(1 for p in progress_data if p.get("bonus_requested"))
        total_users = len(progress_data)
        
        result.append({
            **program,
            "pending_requests": pending_requests,
            "total_users": total_users
        })
    
    return {"programs": result}

@api_router.post("/admin/bonus/programs")
async def create_bonus_program(data: BonusProgramCreate, user=Depends(get_current_user)):
    """Create new bonus program (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Generate IDs for prizes
    prizes_with_ids = []
    for prize in data.prizes:
        prize_data = {
            "id": prize.get("id") or str(uuid.uuid4()),
            "name": prize.get("name", ""),
            "description": prize.get("description", ""),
            "image_url": prize.get("image_url", ""),
            "points_cost": prize.get("points_cost", 0),
            "quantity": prize.get("quantity", -1),
            "enabled": prize.get("enabled", True)
        }
        prizes_with_ids.append(prize_data)
    
    # Generate IDs for levels
    levels_with_ids = []
    for level in data.levels:
        level_data = {
            "id": level.get("id") or str(uuid.uuid4()),
            "name": level.get("name", ""),
            "min_points": level.get("min_points", 0),
            "cashback_percent": level.get("cashback_percent", 0),
            "color": level.get("color", "#f97316"),
            "benefits": level.get("benefits", "")
        }
        levels_with_ids.append(level_data)
    
    # Sort levels by min_points
    levels_with_ids.sort(key=lambda x: x["min_points"])
    
    program = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "description": data.description,
        "full_description": data.full_description,
        "image_url": data.image_url,
        "max_amount": data.max_amount,
        "min_threshold": data.min_threshold,
        "contribution_type": data.contribution_type,
        "contribution_percent": data.contribution_percent,
        "enabled": data.enabled,
        "prizes": prizes_with_ids,
        "levels": levels_with_ids,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bonus_programs.insert_one(program)
    
    # Remove _id that MongoDB adds
    program.pop('_id', None)
    
    return {**program, "pending_requests": 0, "total_users": 0}

@api_router.put("/admin/bonus/programs/{program_id}")
async def update_bonus_program(program_id: str, data: BonusProgramCreate, user=Depends(get_current_user)):
    """Update bonus program (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    program = await get_bonus_program(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Программа не найдена")
    
    # Generate IDs for new prizes
    prizes_with_ids = []
    for prize in data.prizes:
        prize_data = {
            "id": prize.get("id") or str(uuid.uuid4()),
            "name": prize.get("name", ""),
            "description": prize.get("description", ""),
            "image_url": prize.get("image_url", ""),
            "points_cost": prize.get("points_cost", 0),
            "quantity": prize.get("quantity", -1),
            "enabled": prize.get("enabled", True)
        }
        prizes_with_ids.append(prize_data)
    
    # Generate IDs for levels
    levels_with_ids = []
    for level in data.levels:
        level_data = {
            "id": level.get("id") or str(uuid.uuid4()),
            "name": level.get("name", ""),
            "min_points": level.get("min_points", 0),
            "cashback_percent": level.get("cashback_percent", 0),
            "color": level.get("color", "#f97316"),
            "benefits": level.get("benefits", "")
        }
        levels_with_ids.append(level_data)
    
    # Sort levels by min_points
    levels_with_ids.sort(key=lambda x: x["min_points"])
    
    update_data = {
        "title": data.title,
        "description": data.description,
        "full_description": data.full_description,
        "image_url": data.image_url,
        "max_amount": data.max_amount,
        "min_threshold": data.min_threshold,
        "contribution_type": data.contribution_type,
        "contribution_percent": data.contribution_percent,
        "enabled": data.enabled,
        "prizes": prizes_with_ids,
        "levels": levels_with_ids,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bonus_programs.update_one(
        {"id": program_id},
        {"$set": update_data}
    )
    
    return {"message": "Program updated", "id": program_id, **update_data}

@api_router.delete("/admin/bonus/programs/{program_id}")
async def delete_bonus_program(program_id: str, user=Depends(get_current_user)):
    """Delete bonus program (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.bonus_programs.delete_one({"id": program_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Программа не найдена")
    
    # Also delete related progress data
    await db.bonus_progress.delete_many({"program_id": program_id})
    
    return {"message": "Program deleted"}

@api_router.get("/admin/bonus/programs/{program_id}/users")
async def get_program_users(program_id: str, user=Depends(get_current_user)):
    """Get users for a specific bonus program (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    program = await get_bonus_program(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Программа не найдена")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    result = []
    pending_requests = 0
    
    for u in users:
        progress = await db.bonus_progress.find_one(
            {"user_id": u["id"], "program_id": program_id}, 
            {"_id": 0}
        )
        if not progress:
            progress = {"current_amount": 0, "bonus_requested": False, "request_date": None}
        
        max_amount = program.get("max_amount", 50000)
        percentage = min(100, (progress.get("current_amount", 0) / max_amount) * 100) if max_amount > 0 else 0
        
        is_requested = progress.get("bonus_requested", False)
        if is_requested:
            pending_requests += 1
        
        result.append({
            "id": u["id"],
            "name": u["name"],
            "email": u["email"],
            "current_amount": round(progress.get("current_amount", 0), 2),
            "percentage": round(percentage, 1),
            "bonus_requested": is_requested,
            "request_date": progress.get("request_date")
        })
    
    result.sort(key=lambda x: (not x["bonus_requested"], -x["current_amount"]))
    
    return {"users": result, "program": program, "pending_requests": pending_requests}

@api_router.post("/admin/bonus/programs/{program_id}/issue/{user_id}")
async def issue_program_bonus(program_id: str, user_id: str, bonus_code: str = "", user=Depends(get_current_user)):
    """Issue bonus from specific program to user (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not bonus_code or not bonus_code.strip():
        raise HTTPException(status_code=400, detail="Введите код бонуса")
    
    program = await get_bonus_program(program_id)
    if not program:
        raise HTTPException(status_code=404, detail="Программа не найдена")
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    progress = await get_user_program_progress(user_id, program_id)
    
    history_record = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": target_user["name"],
        "program_id": program_id,
        "program_title": program.get("title", "Бонусная программа"),
        "bonus_code": bonus_code.strip(),
        "amount_at_issue": progress.get("current_amount", 0),
        "issued_by": user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "issued"
    }
    await db.bonus_history.insert_one(history_record)
    
    # Reset progress for this program
    await db.bonus_progress.update_one(
        {"user_id": user_id, "program_id": program_id},
        {"$set": {
            "current_amount": 0,
            "bonus_requested": False,
            "request_date": None
        }}
    )
    
    return {
        "success": True,
        "message": f"Бонус выдан: {bonus_code}",
        "bonus_code": bonus_code
    }

# Legacy endpoints for backward compatibility
@api_router.get("/admin/bonus/settings")
async def get_admin_bonus_settings(user=Depends(get_current_user)):
    """Get bonus program settings (admin) - legacy returns first program"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    programs = await get_all_bonus_programs()
    if programs:
        return programs[0]
    return {"enabled": False}

@api_router.put("/admin/bonus/settings")
async def update_bonus_settings(settings: BonusSettings, user=Depends(get_current_user)):
    """Update bonus program settings (admin) - legacy updates first program"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    programs = await get_all_bonus_programs()
    if programs:
        program_id = programs[0]["id"]
        update_data = {
            "title": settings.title,
            "description": settings.description,
            "image_url": settings.image_url,
            "max_amount": settings.max_amount,
            "min_threshold": settings.min_threshold,
            "enabled": settings.enabled,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bonus_programs.update_one({"id": program_id}, {"$set": update_data})
        return {"message": "Settings updated", **update_data}
    else:
        # Create first program
        data = BonusProgramCreate(
            title=settings.title,
            description=settings.description,
            image_url=settings.image_url,
            max_amount=settings.max_amount,
            min_threshold=settings.min_threshold,
            enabled=settings.enabled
        )
        return await create_bonus_program(data, user)

@api_router.get("/admin/bonus/users")
async def get_bonus_users(user=Depends(get_current_user)):
    """Get all users with bonus progress (admin) - legacy returns first program users"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    programs = await get_all_bonus_programs()
    if not programs:
        return {"users": [], "settings": {}, "pending_requests": 0}
    
    program = programs[0]
    result = await get_program_users(program["id"], user)
    return {"users": result["users"], "settings": program, "pending_requests": result["pending_requests"]}

@api_router.post("/admin/bonus/issue/{user_id}")
async def issue_bonus_to_user(user_id: str, bonus_code: str = "", user=Depends(get_current_user)):
    """Issue bonus to user (admin) - legacy uses first program"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    programs = await get_all_bonus_programs()
    if not programs:
        raise HTTPException(status_code=400, detail="Нет бонусных программ")
    
    return await issue_program_bonus(programs[0]["id"], user_id, bonus_code, user)

@api_router.get("/admin/bonus/history")
async def get_admin_bonus_history(user=Depends(get_current_user)):
    """Get all bonus history (admin)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    history = await db.bonus_history.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"history": history}

# ==================== IMPORT/EXPORT ====================

@api_router.post("/admin/products/import")
async def import_products(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Import products from CSV file"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        content = await file.read()
        decoded = content.decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(decoded), delimiter=';')
        
        imported = 0
        updated = 0
        errors = []
        
        for row_num, row in enumerate(reader, start=2):
            try:
                article = row.get('article', row.get('Артикул', '')).strip()
                name = row.get('name', row.get('Название', '')).strip()
                
                if not article or not name:
                    errors.append(f"Строка {row_num}: отсутствует артикул или название")
                    continue
                
                price_str = row.get('price', row.get('Цена', '0')).replace(' ', '').replace(',', '.')
                price = float(price_str) if price_str else 0
                
                stock_str = row.get('stock', row.get('Остаток', '0')).replace(' ', '')
                stock = int(stock_str) if stock_str else 0
                
                delivery_str = row.get('delivery_days', row.get('Доставка', '3')).replace(' ', '')
                delivery_days = int(delivery_str) if delivery_str else 3
                
                product_data = {
                    "name": name,
                    "article": article,
                    "price": price,
                    "stock": stock,
                    "delivery_days": delivery_days,
                    "description": row.get('description', row.get('Описание', '')).strip(),
                    "category_id": row.get('category_id', row.get('Категория', '')).strip() or None,
                    "image_url": row.get('image_url', row.get('Изображение', '')).strip() or None
                }
                
                # Check if product exists
                existing = await db.products.find_one({"article": article})
                if existing:
                    await db.products.update_one({"article": article}, {"$set": product_data})
                    updated += 1
                else:
                    product_data["id"] = str(uuid.uuid4())
                    await db.products.insert_one(product_data)
                    imported += 1
                    
            except Exception as e:
                errors.append(f"Строка {row_num}: {str(e)}")
        
        return {
            "imported": imported,
            "updated": updated,
            "errors": errors[:10],
            "total_errors": len(errors)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@api_router.get("/admin/products/export")
async def export_products(user=Depends(get_current_user)):
    """Export products to CSV"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    
    output = io.StringIO()
    fieldnames = ['article', 'name', 'price', 'stock', 'delivery_days', 'description', 'category_id', 'image_url']
    writer = csv.DictWriter(output, fieldnames=fieldnames, delimiter=';')
    writer.writeheader()
    
    for product in products:
        writer.writerow({
            'article': product.get('article', ''),
            'name': product.get('name', ''),
            'price': product.get('price', 0),
            'stock': product.get('stock', 0),
            'delivery_days': product.get('delivery_days', 3),
            'description': product.get('description', ''),
            'category_id': product.get('category_id', ''),
            'image_url': product.get('image_url', '')
        })
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products.csv"}
    )

# ==================== EXTENDED STATISTICS ====================

@api_router.get("/admin/stats/extended")
async def get_extended_stats(
    period: str = Query("month", description="day, week, month, year"),
    user=Depends(get_current_user)
):
    """Get extended sales statistics with comprehensive analytics"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from collections import defaultdict
    
    now = datetime.now(timezone.utc)
    
    # Determine date range
    if period == "day":
        start_date = now - timedelta(days=1)
        prev_start = start_date - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(weeks=1)
        prev_start = start_date - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
        prev_start = start_date - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)
        prev_start = start_date - timedelta(days=365)
    
    start_iso = start_date.isoformat()
    prev_iso = prev_start.isoformat()
    
    # Get all orders for current period
    orders = await db.orders.find(
        {"created_at": {"$gte": start_iso}},
        {"_id": 0}
    ).to_list(10000)
    
    # Get previous period orders for comparison
    prev_orders = await db.orders.find(
        {"created_at": {"$gte": prev_iso, "$lt": start_iso}},
        {"_id": 0}
    ).to_list(10000)
    
    # Get all-time stats
    all_orders = await db.orders.find({}, {"_id": 0}).to_list(100000)
    all_users = await db.users.find({}, {"_id": 0}).to_list(10000)
    all_products = await db.products.find({}, {"_id": 0}).to_list(10000)
    
    # Daily sales
    daily_sales = defaultdict(lambda: {"total": 0, "orders": 0, "items": 0})
    product_sales = defaultdict(lambda: {"count": 0, "revenue": 0})
    category_sales = defaultdict(lambda: {"count": 0, "revenue": 0})
    customer_stats = defaultdict(lambda: {"orders": 0, "total_spent": 0, "items": 0})
    manufacturer_sales = defaultdict(lambda: {"count": 0, "revenue": 0})
    hourly_distribution = defaultdict(int)
    
    for order in orders:
        # Parse date and hour
        order_date = order["created_at"][:10]
        order_hour = order["created_at"][11:13] if len(order["created_at"]) > 11 else "00"
        
        daily_sales[order_date]["total"] += order["total"]
        daily_sales[order_date]["orders"] += 1
        hourly_distribution[int(order_hour)] += 1
        
        # Count by customer
        user_id = order["user_id"]
        customer_stats[user_id]["orders"] += 1
        customer_stats[user_id]["total_spent"] += order["total"]
        
        # Count by product/category/manufacturer
        for item in order.get("items", []):
            pid = item.get("product_id", "")
            qty = item.get("quantity", 1)
            price = item.get("price", 0)
            
            product_sales[pid]["count"] += qty
            product_sales[pid]["revenue"] += price * qty
            product_sales[pid]["name"] = item.get("name", "")
            product_sales[pid]["article"] = item.get("article", "")
            
            manufacturer = item.get("manufacturer", "Неизвестно")
            manufacturer_sales[manufacturer]["count"] += qty
            manufacturer_sales[manufacturer]["revenue"] += price * qty
            
            daily_sales[order_date]["items"] += qty
            customer_stats[user_id]["items"] += qty
    
    # Top products (by revenue)
    top_products_data = sorted(
        [{"id": k, **v} for k, v in product_sales.items()],
        key=lambda x: x["revenue"],
        reverse=True
    )[:10]
    
    # Top customers (by total spent)
    top_customers_raw = sorted(
        [(uid, stats) for uid, stats in customer_stats.items()],
        key=lambda x: x[1]["total_spent"],
        reverse=True
    )[:10]
    
    user_ids = [c[0] for c in top_customers_raw]
    users_data = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(10)
    users_map = {u["id"]: u for u in users_data}
    
    top_customers_data = []
    for uid, stats in top_customers_raw:
        user_info = users_map.get(uid, {})
        top_customers_data.append({
            "id": uid,
            "name": user_info.get("name", "Неизвестно"),
            "email": user_info.get("email", ""),
            "orders": stats["orders"],
            "total_spent": round(stats["total_spent"], 2),
            "items": stats["items"]
        })
    
    # Top manufacturers
    top_manufacturers = sorted(
        [{"name": k, **v} for k, v in manufacturer_sales.items()],
        key=lambda x: x["revenue"],
        reverse=True
    )[:8]
    
    # Convert daily_sales to sorted list
    daily_sales_list = sorted([{"date": k, **v} for k, v in daily_sales.items()], key=lambda x: x["date"])
    
    # Order status distribution
    status_counts = defaultdict(int)
    for order in orders:
        status = order.get("status", "pending")
        status_counts[status] += 1
    
    # Calculate totals and comparisons
    total_revenue = sum(o["total"] for o in orders)
    total_items = sum(sum(item.get("quantity", 1) for item in o.get("items", [])) for o in orders)
    avg_order_value = total_revenue / len(orders) if orders else 0
    
    prev_revenue = sum(o["total"] for o in prev_orders)
    prev_orders_count = len(prev_orders)
    
    # Growth percentages
    revenue_growth = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
    orders_growth = ((len(orders) - prev_orders_count) / prev_orders_count * 100) if prev_orders_count > 0 else 0
    
    # New users in period
    new_users = [u for u in all_users if u.get("created_at", "") >= start_iso]
    
    # Hourly distribution formatted
    hourly_list = [{"hour": h, "orders": hourly_distribution.get(h, 0)} for h in range(24)]
    
    # All-time stats
    all_time_revenue = sum(o["total"] for o in all_orders)
    all_time_orders = len(all_orders)
    
    # Conversion metrics (users who placed at least one order)
    users_with_orders = set(o["user_id"] for o in all_orders)
    conversion_rate = (len(users_with_orders) / len(all_users) * 100) if all_users else 0
    
    # Average orders per customer
    avg_orders_per_customer = all_time_orders / len(users_with_orders) if users_with_orders else 0
    
    # Products stats
    active_products = len([p for p in all_products if p.get("in_stock", True)])
    out_of_stock = len(all_products) - active_products
    
    return {
        "period": period,
        "period_label": {"day": "За день", "week": "За неделю", "month": "За месяц", "year": "За год"}.get(period, period),
        
        # Main metrics
        "total_orders": len(orders),
        "total_revenue": round(total_revenue, 2),
        "total_items": total_items,
        "avg_order_value": round(avg_order_value, 2),
        
        # Growth comparison
        "prev_orders": prev_orders_count,
        "prev_revenue": round(prev_revenue, 2),
        "revenue_growth": round(revenue_growth, 1),
        "orders_growth": round(orders_growth, 1),
        
        # Charts data
        "daily_sales": daily_sales_list,
        "hourly_distribution": hourly_list,
        
        # Top lists
        "top_products": top_products_data,
        "top_customers": top_customers_data,
        "top_manufacturers": top_manufacturers,
        
        # Status breakdown
        "status_distribution": dict(status_counts),
        
        # Additional stats
        "new_users": len(new_users),
        "total_users": len(all_users),
        "conversion_rate": round(conversion_rate, 1),
        "avg_orders_per_customer": round(avg_orders_per_customer, 1),
        
        # Products stats
        "total_products": len(all_products),
        "active_products": active_products,
        "out_of_stock": out_of_stock,
        
        # All-time stats
        "all_time_revenue": round(all_time_revenue, 2),
        "all_time_orders": all_time_orders,
        
        # Unique customers this period
        "unique_customers": len(set(o["user_id"] for o in orders))
    }

# ==================== MIGRATION ====================

@api_router.post("/admin/migrate-orders")
async def migrate_orders(user=Depends(get_current_user)):
    """Add manufacturer to existing order items"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all products
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    products_map = {p["id"]: p for p in products}
    
    # Get all orders
    orders = await db.orders.find({}).to_list(10000)
    
    updated_count = 0
    for order in orders:
        items = order.get("items", [])
        updated = False
        
        for item in items:
            product = products_map.get(item.get("product_id"))
            if product:
                if "manufacturer" not in item or item.get("manufacturer") is None:
                    item["manufacturer"] = product.get("manufacturer")
                    updated = True
        
        if updated:
            await db.orders.update_one(
                {"_id": order["_id"]},
                {"$set": {"items": items}}
            )
            updated_count += 1
    
    return {"message": f"Migrated {updated_count} orders"}

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    # Check if already seeded
    count = await db.products.count_documents({})
    if count > 0:
        return {"message": "Data already seeded"}
    
    products = [
        {"id": str(uuid.uuid4()), "name": "Поршневая группа MAN TGA", "article": "MAN-PG-001", "price": 45000, "stock": 10, "delivery_days": 3, "image_url": "https://images.unsplash.com/photo-1695597802538-bcb2bd533d19?w=400", "description": "Комплект поршневой группы для MAN TGA"},
        {"id": str(uuid.uuid4()), "name": "Турбина Volvo FH", "article": "VLV-TB-002", "price": 85000, "stock": 5, "delivery_days": 5, "image_url": "https://images.unsplash.com/photo-1695597802538-bcb2bd533d19?w=400", "description": "Турбокомпрессор для Volvo FH12/FH16"},
        {"id": str(uuid.uuid4()), "name": "Масляный насос Scania", "article": "SCN-ON-003", "price": 28000, "stock": 8, "delivery_days": 2, "image_url": "https://images.unsplash.com/photo-1695597802538-bcb2bd533d19?w=400", "description": "Масляный насос для Scania R-series"},
        {"id": str(uuid.uuid4()), "name": "Прокладка ГБЦ DAF", "article": "DAF-GS-004", "price": 12000, "stock": 15, "delivery_days": 2, "image_url": "https://images.unsplash.com/photo-1695597802538-bcb2bd533d19?w=400", "description": "Прокладка головки блока DAF XF"},
        {"id": str(uuid.uuid4()), "name": "Сцепление комплект Mercedes", "article": "MRC-CL-001", "price": 65000, "stock": 6, "delivery_days": 4, "image_url": "https://images.unsplash.com/photo-1763738173457-2a874a207215?w=400", "description": "Комплект сцепления Mercedes Actros"},
        {"id": str(uuid.uuid4()), "name": "КПП ZF 16S", "article": "ZF-GB-002", "price": 280000, "stock": 2, "delivery_days": 7, "image_url": "https://images.unsplash.com/photo-1763738173457-2a874a207215?w=400", "description": "Коробка передач ZF 16S 2220"},
        {"id": str(uuid.uuid4()), "name": "Кардан IVECO", "article": "IVC-CD-003", "price": 42000, "stock": 4, "delivery_days": 5, "image_url": "https://images.unsplash.com/photo-1763738173457-2a874a207215?w=400", "description": "Карданный вал IVECO Stralis"},
        {"id": str(uuid.uuid4()), "name": "Тормозные колодки SAF", "article": "SAF-BP-001", "price": 8500, "stock": 20, "delivery_days": 1, "image_url": "https://images.unsplash.com/photo-1629220640507-6548fe7ee769?w=400", "description": "Колодки тормозные для полуприцепа SAF"},
        {"id": str(uuid.uuid4()), "name": "Тормозной диск BPW", "article": "BPW-BD-002", "price": 15000, "stock": 12, "delivery_days": 2, "image_url": "https://images.unsplash.com/photo-1629220640507-6548fe7ee769?w=400", "description": "Тормозной диск BPW ECO Plus"},
        {"id": str(uuid.uuid4()), "name": "Главный тормозной цилиндр", "article": "WBK-MC-003", "price": 32000, "stock": 7, "delivery_days": 3, "image_url": "https://images.unsplash.com/photo-1629220640507-6548fe7ee769?w=400", "description": "Главный тормозной цилиндр Wabco"},
        {"id": str(uuid.uuid4()), "name": "Генератор Bosch 28V", "article": "BSH-GN-001", "price": 45000, "stock": 5, "delivery_days": 3, "image_url": "https://images.unsplash.com/photo-1661463678303-dfb9e5f0929c?w=400", "description": "Генератор Bosch 28V 80A"},
        {"id": str(uuid.uuid4()), "name": "Стартер Prestolite", "article": "PRS-ST-002", "price": 38000, "stock": 6, "delivery_days": 4, "image_url": "https://images.unsplash.com/photo-1661463678303-dfb9e5f0929c?w=400", "description": "Стартер Prestolite 24V"},
        {"id": str(uuid.uuid4()), "name": "Фара головного света LED", "article": "LED-HL-003", "price": 22000, "stock": 10, "delivery_days": 2, "image_url": "https://images.unsplash.com/photo-1661463678303-dfb9e5f0929c?w=400", "description": "LED фара для грузовиков"},
        {"id": str(uuid.uuid4()), "name": "Пневмоподушка SAF", "article": "SAF-AB-001", "price": 18000, "stock": 15, "delivery_days": 2, "image_url": "https://images.unsplash.com/photo-1666508330099-0c7c6ab0e332?w=400", "description": "Пневмоподушка для оси SAF"},
        {"id": str(uuid.uuid4()), "name": "Амортизатор кабины", "article": "MNR-SA-002", "price": 12000, "stock": 8, "delivery_days": 3, "image_url": "https://images.unsplash.com/photo-1666508330099-0c7c6ab0e332?w=400", "description": "Амортизатор кабины Monroe"},
        {"id": str(uuid.uuid4()), "name": "Рессора передняя MAN", "article": "MAN-LS-003", "price": 25000, "stock": 6, "delivery_days": 4, "image_url": "https://images.unsplash.com/photo-1666508330099-0c7c6ab0e332?w=400", "description": "Рессора передняя MAN TGX"},
        {"id": str(uuid.uuid4()), "name": "Бампер передний Volvo", "article": "VLV-FB-001", "price": 55000, "stock": 3, "delivery_days": 7, "image_url": "https://images.unsplash.com/photo-1594920687401-e70050947ea5?w=400", "description": "Бампер передний Volvo FH4"},
        {"id": str(uuid.uuid4()), "name": "Зеркало заднего вида", "article": "MRC-MR-002", "price": 28000, "stock": 8, "delivery_days": 3, "image_url": "https://images.unsplash.com/photo-1594920687401-e70050947ea5?w=400", "description": "Зеркало с подогревом Mercedes"},
        {"id": str(uuid.uuid4()), "name": "Капот Scania", "article": "SCN-HD-003", "price": 120000, "stock": 2, "delivery_days": 10, "image_url": "https://images.unsplash.com/photo-1594920687401-e70050947ea5?w=400", "description": "Капот Scania R-series"},
    ]
    
    await db.products.insert_many(products)
    return {"message": f"Seeded {len(products)} products"}

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "Truck Parts API"}

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/stats")
async def get_admin_stats(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    
    # Orders by status
    pending_orders = await db.orders.count_documents({"status": "pending"})
    completed_orders = await db.orders.count_documents({"status": "delivered"})
    
    # Revenue using aggregation
    pipeline = [{"$group": {"_id": None, "total_revenue": {"$sum": "$total"}}}]
    result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = result[0]["total_revenue"] if result else 0
    
    return {
        "total_users": total_users,
        "total_products": total_products,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "completed_orders": completed_orders,
        "total_revenue": total_revenue
    }

# ==================== ADMIN USER MANAGEMENT ====================

@api_router.get("/admin/users")
async def get_admin_users(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    
    # Add order statistics for each user
    for u in users:
        user_orders = await db.orders.find({"user_id": u["id"]}, {"_id": 0}).to_list(1000)
        u["total_orders"] = len(user_orders)
        u["total_spent"] = sum(o.get("total", 0) for o in user_orders)
        # Keep plain_password for admin view
        if "password" in u:
            del u["password"]  # Remove hash, keep plain_password
    
    return users

@api_router.get("/admin/users/{user_id}/details")
async def get_admin_user_details(user_id: str, user=Depends(get_current_user)):
    """Get detailed information about a user including order stats"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove password hash, keep plain_password
    if "password" in target_user:
        del target_user["password"]
    if "password_hash" in target_user:
        del target_user["password_hash"]
    
    # Get all orders for this user
    user_orders = await db.orders.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Calculate order statistics
    total_orders = len(user_orders)
    total_spent = sum(o.get("total", 0) for o in user_orders)
    total_items = sum(sum(item.get("quantity", 0) for item in o.get("items", [])) for o in user_orders)
    avg_order_value = total_spent / total_orders if total_orders > 0 else 0
    
    # Count orders by status
    orders_by_status = {}
    for o in user_orders:
        status = o.get("status", "pending")
        orders_by_status[status] = orders_by_status.get(status, 0) + 1
    
    # Delivered orders total
    delivered_total = sum(o.get("total", 0) for o in user_orders if o.get("status") == "delivered")
    
    # First and last order dates
    order_dates = [o.get("created_at") for o in user_orders if o.get("created_at")]
    first_order_date = min(order_dates) if order_dates else None
    last_order_date = max(order_dates) if order_dates else None
    
    # Favorite products
    from collections import defaultdict
    product_count = defaultdict(lambda: {"name": "", "article": "", "count": 0, "total_spent": 0})
    for o in user_orders:
        for item in o.get("items", []):
            pid = item.get("product_id") or item.get("article", "")
            product_count[pid]["name"] = item.get("name", "")
            product_count[pid]["article"] = item.get("article", "")
            product_count[pid]["count"] += item.get("quantity", 1)
            product_count[pid]["total_spent"] += item.get("price", 0) * item.get("quantity", 1)
    
    favorite_products = sorted(
        [{"product_id": k, **v} for k, v in product_count.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:5]
    
    # Get bonus progress for each program
    bonus_progress = await db.bonus_progress.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    
    # Recent orders (last 5)
    recent_orders = user_orders[:5]
    
    return {
        "user": target_user,
        "statistics": {
            "total_orders": total_orders,
            "total_spent": round(total_spent, 2),
            "total_items": total_items,
            "avg_order_value": round(avg_order_value, 2),
            "delivered_total": round(delivered_total, 2),
            "orders_by_status": orders_by_status,
            "first_order_date": first_order_date,
            "last_order_date": last_order_date,
            "favorite_products": favorite_products
        },
        "bonus_progress": bonus_progress,
        "recent_orders": recent_orders
    }

@api_router.post("/admin/users")
async def create_admin_user_new(data: AdminUserCreate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    new_user = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "password_plain": data.password,
        "name": data.name,
        "phone": data.phone,
        "address": data.address,
        "role": data.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    await db.carts.insert_one({"user_id": user_id, "items": []})
    
    return {"id": user_id, "email": data.email, "name": data.name, "role": data.role}

@api_router.put("/admin/users/{user_id}")
async def update_admin_user(user_id: str, data: AdminUserUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    # If password is being updated, hash it and store plain
    if "password" in update_data:
        update_data["password_plain"] = update_data["password"]
        update_data["password"] = hash_password(update_data["password"])
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return updated_user

@api_router.delete("/admin/users/{user_id}")
async def delete_admin_user(user_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Don't allow deleting yourself
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete user's cart
    await db.carts.delete_one({"user_id": user_id})
    
    return {"message": "User deleted"}

# ==================== ADMIN ORDER MANAGEMENT ====================

@api_router.get("/admin/orders")
async def get_admin_orders(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders

@api_router.put("/admin/orders/{order_id}")
async def update_admin_order(order_id: str, data: AdminOrderUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if "status" in update_data:
        valid_statuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
        if update_data["status"] not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated_order

@api_router.put("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    valid_statuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Get order before update to check previous status
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    previous_status = order.get("status")
    
    result = await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    
    # If status changed to "delivered" and wasn't delivered before, add to bonus progress
    if status == "delivered" and previous_status != "delivered":
        await update_bonus_on_order_delivered(order["user_id"], order["total"])
    
    return {"message": "Status updated"}

@api_router.delete("/admin/orders/{order_id}")
async def delete_admin_order(order_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": "Order deleted"}

@api_router.post("/admin/create-admin")
async def create_admin_user():
    """Create default admin user if not exists"""
    existing = await db.users.find_one({"email": "admin@avarus.ru"})
    if existing:
        return {"message": "Admin already exists", "email": "admin@avarus.ru"}
    
    admin_id = str(uuid.uuid4())
    admin = {
        "id": admin_id,
        "email": "admin@avarus.ru",
        "password": hash_password("admin123"),
        "name": "Администратор",
        "phone": "",
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin)
    await db.carts.insert_one({"user_id": admin_id, "items": []})
    
    return {"message": "Admin created", "email": "admin@avarus.ru", "password": "admin123"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
