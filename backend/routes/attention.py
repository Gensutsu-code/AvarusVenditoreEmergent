"""Admin 'needs attention' counters: everything that waits for the admin's decision"""
from fastapi import APIRouter, HTTPException, Depends

from database import db, get_current_user
from routes.features import is_on

router = APIRouter(tags=["attention"])

# key, collection, query, feature that owns it
SOURCES = [
    ("orders", "orders", {"status": "pending"}, None),
    ("returns", "returns", {"status": "pending"}, "returns"),
    ("price_requests", "discount_requests", {"status": "pending"}, "price_requests"),
    ("cart_discounts", "cart_discount_requests", {"status": "pending"}, "cart_discounts"),
    ("product_requests", "product_requests", {"status": "pending"}, "product_requests"),
    ("cashback_withdrawals", "cashback_withdrawals", {"status": "pending"}, "rewards"),
    ("prize_redemptions", "prize_redemptions", {"status": "pending"}, "rewards"),
    ("credit_requests", "credit_requests", {"status": "pending"}, "credit"),
    ("conditions_requests", "conditions_requests", {"status": "pending"}, "managers"),
]


@router.get("/admin/attention")
async def admin_attention(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    counts = {}
    for key, collection, query, feature in SOURCES:
        counts[key] = await db[collection].count_documents(query) if (not feature or is_on(feature)) else 0
    counts["chats"] = len(await db.chat_messages.distinct("chat_id", {"sender_type": "user", "read": False})) if is_on("chat") else 0
    from routes.warehouse import low_stock_query, default_min_stock
    counts["low_stock"] = await db.products.count_documents(low_stock_query(await default_min_stock()))
    return counts
