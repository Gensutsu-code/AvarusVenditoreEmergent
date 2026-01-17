from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt
import shutil

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
    category_id: Optional[str] = None
    price: float
    description: Optional[str] = None
    image_url: Optional[str] = None
    stock: int = 0
    delivery_days: int = 3

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    article: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    stock: Optional[int] = None
    delivery_days: Optional[int] = None

class ProductResponse(BaseModel):
    id: str
    name: str
    article: str
    category_id: Optional[str] = None
    price: float
    description: Optional[str] = None
    image_url: Optional[str] = None
    stock: int
    delivery_days: int = 3

class CartItem(BaseModel):
    product_id: str
    quantity: int

class CartItemResponse(BaseModel):
    product_id: str
    name: str
    article: str
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
        return {"enabled": False, "text": "", "link": None, "bg_color": "#f97316"}
    return banner.get("value", {"enabled": False, "text": "", "link": None, "bg_color": "#f97316"})

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
