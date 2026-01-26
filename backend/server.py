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
    phone: Optional[str] = None
    address: Optional[str] = None

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
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "phone": user.get("phone"), "role": user.get("role", "user")}}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    return user

@api_router.put("/auth/profile")
async def update_profile(data: UserProfileUpdate, user=Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
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
            {"article": {"$regex": search, "$options": "i"}}
        ]
    if category_id:
        query["category_id"] = category_id
    
    products = await db.products.find(query, {"_id": 0}).skip(skip).limit(min(limit, 100)).to_list(100)
    return products

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
    
    return order

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(user=Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

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
    """Send order notification to Telegram"""
    try:
        settings = await db.settings.find_one({"key": "telegram"}, {"_id": 0})
        if not settings or not settings.get("value", {}).get("enabled"):
            return
        
        bot_token = settings["value"].get("bot_token", "")
        chat_id = settings["value"].get("chat_id", "")
        
        if not bot_token or not chat_id:
            return
        
        # Format message
        items_text = "\n".join([f"  • {item['name']} × {item['quantity']} = {item['price'] * item['quantity']:,.0f} ₽" for item in order["items"]])
        
        message = f"""🛒 *Новый заказ!*

📦 *Заказ #{order['id'][:8]}*
👤 Клиент: {order['full_name']}
📞 Телефон: {order['phone']}
📍 Адрес: {order['address']}

*Товары:*
{items_text}

💰 *Итого: {order['total']:,.0f} ₽*
💳 Оплата: наличными при получении"""

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
        raise HTTPException(status_code=500, detail=f"Failed to send: {str(e)}")

# ==================== CHAT ROUTES ====================

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
            "updated_at": datetime.now(timezone.utc).isoformat()
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
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    await db.chat_messages.insert_one(chat_message)
    
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
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
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
    """Get extended sales statistics"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc)
    
    # Determine date range
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)
    
    start_iso = start_date.isoformat()
    
    # Sales by period
    orders = await db.orders.find(
        {"created_at": {"$gte": start_iso}},
        {"_id": 0}
    ).to_list(10000)
    
    # Daily sales
    daily_sales = {}
    product_sales = {}
    category_sales = {}
    customer_orders = {}
    
    for order in orders:
        # Parse date
        order_date = order["created_at"][:10]
        daily_sales[order_date] = daily_sales.get(order_date, 0) + order["total"]
        
        # Count by customer
        user_id = order["user_id"]
        customer_orders[user_id] = customer_orders.get(user_id, 0) + 1
        
        # Count by product
        for item in order.get("items", []):
            pid = item.get("product_id", "")
            product_sales[pid] = product_sales.get(pid, 0) + item.get("quantity", 0)
    
    # Top products
    top_products_data = []
    if product_sales:
        sorted_products = sorted(product_sales.items(), key=lambda x: x[1], reverse=True)[:10]
        product_ids = [p[0] for p in sorted_products]
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(10)
        products_map = {p["id"]: p["name"] for p in products}
        
        for pid, count in sorted_products:
            top_products_data.append({
                "id": pid,
                "name": products_map.get(pid, "Неизвестно"),
                "count": count
            })
    
    # Top customers
    top_customers_data = []
    if customer_orders:
        sorted_customers = sorted(customer_orders.items(), key=lambda x: x[1], reverse=True)[:10]
        user_ids = [c[0] for c in sorted_customers]
        users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(10)
        users_map = {u["id"]: u for u in users}
        
        for uid, count in sorted_customers:
            user_data = users_map.get(uid, {})
            top_customers_data.append({
                "id": uid,
                "name": user_data.get("name", "Неизвестно"),
                "email": user_data.get("email", ""),
                "order_count": count
            })
    
    # Convert daily_sales to sorted list
    daily_sales_list = [{"date": k, "total": v} for k, v in sorted(daily_sales.items())]
    
    # Order status distribution
    status_counts = {}
    for order in orders:
        status = order.get("status", "pending")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Total stats
    total_revenue = sum(o["total"] for o in orders)
    avg_order_value = total_revenue / len(orders) if orders else 0
    
    return {
        "period": period,
        "total_orders": len(orders),
        "total_revenue": total_revenue,
        "avg_order_value": round(avg_order_value, 2),
        "daily_sales": daily_sales_list,
        "top_products": top_products_data,
        "top_customers": top_customers_data,
        "status_distribution": status_counts
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

@api_router.get("/admin/users")
async def get_admin_users(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.get("/admin/orders")
async def get_admin_orders(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders

@api_router.put("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    valid_statuses = ["pending", "processing", "shipped", "delivered", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": "Status updated"}

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
