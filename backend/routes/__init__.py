"""Routes package"""
from fastapi import APIRouter

# Import all routers
from .auth import router as auth_router
from .products import router as products_router
from .orders import router as orders_router

# Create main API router
api_router = APIRouter(prefix="/api")

# Include all sub-routers
api_router.include_router(auth_router)
api_router.include_router(products_router)
api_router.include_router(orders_router)

__all__ = ["api_router"]
