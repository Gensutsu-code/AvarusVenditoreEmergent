"""Routes package"""
from fastapi import APIRouter

# Import all routers
from .auth import router as auth_router
from .products import router as products_router
from .orders import router as orders_router
from .admin import router as admin_router
from .settings import router as settings_router
from .news import router as news_router
from .chat import router as chat_router
from .bonus import router as bonus_router
from .uploads import router as uploads_router
from .partners import router as partners_router
from .telegram import router as telegram_router
from .payments import router as payments_router
from .documents import router as documents_router
from .terms import router as terms_router
from .notifications import router as notifications_router
from .balance import router as balance_router
from .crypto_payments import router as crypto_payments_router
from .analytics import router as analytics_router
from .requests import router as requests_router
from .maintenance import router as maintenance_router
from .discount_requests import router as discount_requests_router
from .product_requests import router as product_requests_router
from .action_logs import router as action_logs_router

# Create main API router
api_router = APIRouter(prefix="/api")

# Include all sub-routers
api_router.include_router(auth_router)
api_router.include_router(products_router)
api_router.include_router(orders_router)
api_router.include_router(admin_router)
api_router.include_router(settings_router)
api_router.include_router(news_router)
api_router.include_router(chat_router)
api_router.include_router(bonus_router)
api_router.include_router(uploads_router)
api_router.include_router(partners_router)
api_router.include_router(telegram_router)
api_router.include_router(payments_router)
api_router.include_router(documents_router)
api_router.include_router(terms_router)
api_router.include_router(notifications_router)
api_router.include_router(balance_router)
api_router.include_router(crypto_payments_router)
api_router.include_router(analytics_router)
api_router.include_router(requests_router)
api_router.include_router(maintenance_router)
api_router.include_router(discount_requests_router)
api_router.include_router(product_requests_router)
api_router.include_router(action_logs_router)

__all__ = ["api_router"]
