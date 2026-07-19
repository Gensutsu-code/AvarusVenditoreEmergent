"""
Main FastAPI Application - Refactored
All routes are organized in /app/backend/routes/
"""
from fastapi import FastAPI, APIRouter, Request
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from contextlib import asynccontextmanager
import os
import logging
import asyncio
import time
import jwt

# Load environment
ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Background task for checking expired orders
async def check_expired_orders_task():
    """Background task that checks for expired order confirmations every hour"""
    from datetime import datetime, timezone
    
    while True:
        try:
            await asyncio.sleep(3600)  # Wait 1 hour
            
            now = datetime.now(timezone.utc).isoformat()
            
            # Find orders awaiting confirmation with expired time
            expired_orders = await db.orders.find({
                "awaiting_confirmation": True,
                "changes_expire_at": {"$lt": now}
            }).to_list(100)
            
            cancelled_count = 0
            for order in expired_orders:
                # Restore stock for each item
                for item in order.get("items", []):
                    await db.products.update_one(
                        {"id": item.get("product_id")},
                        {"$inc": {"stock": item.get("quantity", 0)}}
                    )
                
                # Cancel the order
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {
                        "status": "cancelled",
                        "cancelled_by": "system",
                        "cancelled_reason": "Изменения не подтверждены в течение 24 часов",
                        "cancelled_at": now,
                        "awaiting_confirmation": False
                    }}
                )
                
                # Create notification for user
                from notify import notify_user
                await notify_user(order["user_id"], "order", f"Заказ #{order['id'][:8]} отменён", "Заказ отменён автоматически: изменения не были подтверждены в течение 24 часов", "/orders")
                
                cancelled_count += 1
            
            if cancelled_count > 0:
                logger.info(f"Auto-cancelled {cancelled_count} expired orders")

            # Cancel unpaid card/crypto orders past their payment due date (deferred card/crypto)
            due_expired = await db.orders.find({
                "payment_due_date": {"$ne": None, "$lt": now},
                "status": {"$nin": ["cancelled", "completed", "delivered"]},
                "card_receipt_url": {"$in": [None, ""]},
                "payment_status": {"$in": ["awaiting_payment", "awaiting_confirmation", "unpaid"]}
            }).to_list(200)

            import uuid as _uuid
            pay_cancelled = 0
            for order in due_expired:
                for item in order.get("items", []):
                    await db.products.update_one(
                        {"id": item.get("product_id")},
                        {"$inc": {"stock": item.get("quantity", 0)}}
                    )
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {
                        "status": "cancelled",
                        "cancelled_by": "system",
                        "cancelled_reason": "Оплата не поступила в установленный срок",
                        "cancelled_at": now,
                        "payment_due_date": None,
                    }}
                )
                from notify import notify_user
                await notify_user(order["user_id"], "order", f"Заказ #{order['id'][:8]} отменён", "Заказ отменён автоматически: оплата не поступила в установленный срок", "/orders")
                pay_cancelled += 1
            if pay_cancelled > 0:
                logger.info(f"Auto-cancelled {pay_cancelled} unpaid card/crypto orders past due")

        except Exception as e:
            logger.error(f"Error in check_expired_orders_task: {e}")
            await asyncio.sleep(60)  # Wait 1 minute on error before retrying


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - starts background tasks"""
    # Start background task for checking expired orders
    task = asyncio.create_task(check_expired_orders_task())
    logger.info("Started background task: check_expired_orders_task")
    
    yield
    
    # Cleanup on shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    client.close()
    logger.info("Shutdown complete")


# Create FastAPI app with lifespan
app = FastAPI(title="Heavy Vehicle Parts Store API", lifespan=lifespan)


# ==================== ACTION LOGGING MIDDLEWARE ====================
JWT_SECRET = os.environ.get('JWT_SECRET', '')

# Routes to skip logging (noisy, read-only, health)
SKIP_LOG_PATHS = {"/health", "/api/health", "/api/", "/api/uploads", "/favicon.ico"}
SKIP_LOG_PREFIXES = ("/api/uploads/", "/api/admin/action-logs", "/api/admin/chats/", "/api/public/", "/api/admin/data/",
    # Routes with explicit action logging (revertible)
    "/api/admin/bonus/", "/api/admin/prize-redemptions/", "/api/admin/orders/",
)

# Classify actions by path pattern
def classify_action(method: str, path: str) -> str:
    path_lower = path.lower()
    if "/auth/login" in path_lower:
        return "Авторизация"
    if "/auth/register" in path_lower:
        return "Регистрация"
    if "/admin/orders" in path_lower and method == "PUT":
        return "Изменение заказа (админ)"
    if "/admin/users" in path_lower and method == "POST":
        return "Создание пользователя"
    if "/admin/users" in path_lower and method == "PUT":
        return "Редактирование пользователя"
    if "/admin/users" in path_lower and "block" in path_lower:
        return "Блокировка пользователя"
    if "/orders" in path_lower and method == "POST":
        return "Создание заказа"
    if "/products" in path_lower and method == "POST":
        return "Создание товара"
    if "/products" in path_lower and method == "PUT":
        return "Редактирование товара"
    if "/products" in path_lower and method == "DELETE":
        return "Удаление товара"
    if "/cart" in path_lower:
        return "Корзина"
    if "/maintenance" in path_lower:
        return "Техработы"
    if "/discount-requests" in path_lower:
        return "Запрос скидки"
    if "/product-requests" in path_lower:
        return "Запрос товара"
    if "/settings" in path_lower or "/promo-banner" in path_lower:
        return "Настройки"
    if "/data/" in path_lower:
        return "Прямое редактирование данных"
    if method == "GET":
        return "Просмотр"
    return f"{method} {path.split('/api/')[-1][:50]}"


class ActionLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        # Skip noisy routes
        if path in SKIP_LOG_PATHS or any(path.startswith(p) for p in SKIP_LOG_PREFIXES):
            return await call_next(request)
        if method == "OPTIONS":
            return await call_next(request)
        # Skip most GET requests (too noisy for logs)
        if method == "GET":
            return await call_next(request)

        # Extract user from JWT
        user_id = None
        user_name = None
        user_role = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                uid = payload.get("user_id")
                if uid:
                    u = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1})
                    if u:
                        user_id = u["id"]
                        user_name = u.get("name") or u.get("email")
                        user_role = u.get("role")
            except Exception:
                pass

        # For login, we'll just note the action, user_name will be extracted later
        if "/auth/login" in path and method == "POST":
            user_name = user_name or "login_attempt"

        ip = request.client.host if request.client else "unknown"
        start_time = time.time()

        response = await call_next(request)

        duration_ms = int((time.time() - start_time) * 1000)
        action = classify_action(method, path)

        # Log asynchronously (fire and forget)
        try:
            from routes.action_logs import log_action
            asyncio.create_task(log_action(
                action=action,
                user_id=user_id,
                user_name=user_name,
                user_role=user_role,
                method=method,
                path=path,
                ip=ip,
                status_code=response.status_code,
                details={"duration_ms": duration_ms},
            ))
        except Exception as e:
            logger.error(f"Action logging error: {e}")

        return response


app.add_middleware(ActionLoggingMiddleware)


# Health check endpoints
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Mount uploads directory for serving static files
app.mount("/api/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Import and include all routers from routes package
from routes import api_router
app.include_router(api_router)

# Additional health check on API router
api_health_router = APIRouter(prefix="/api")

@api_health_router.get("/health")
async def api_health():
    return {"status": "healthy"}

@api_health_router.get("/")
async def root():
    return {"message": "Heavy Vehicle Parts Store API", "version": "2.0"}

app.include_router(api_health_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
