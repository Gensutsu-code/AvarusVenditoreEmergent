"""
Main FastAPI Application - Refactored
All routes are organized in /app/backend/routes/
"""
from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from contextlib import asynccontextmanager
import os
import logging
import asyncio

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
                import uuid
                notification = {
                    "id": str(uuid.uuid4()),
                    "user_id": order["user_id"],
                    "type": "order",
                    "title": f"Заказ #{order['id'][:8]} отменён",
                    "message": "Заказ отменён автоматически: изменения не были подтверждены в течение 24 часов",
                    "link": "/orders",
                    "read": False,
                    "created_at": now
                }
                await db.notifications.insert_one(notification)
                
                cancelled_count += 1
            
            if cancelled_count > 0:
                logger.info(f"Auto-cancelled {cancelled_count} expired orders")
                
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
