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
import os
import logging

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

# Create FastAPI app
app = FastAPI(title="Heavy Vehicle Parts Store API")

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
