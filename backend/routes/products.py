"""Products and Categories routes"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import uuid

from database import db, get_current_user
from routes.action_logs import log_action
from models import (
    ProductCreate, ProductUpdate, ProductResponse,
    CategoryCreate, CategoryUpdate, CategoryResponse, CategoryReorder
)

router = APIRouter(tags=["products"])


NEW_BADGE_DAYS = 14


def _ensure_new_status(product: dict) -> dict:
    """Auto-expire 'is_new' if new_until passed. Mutates and returns dict."""
    if not product:
        return product
    if product.get("is_new"):
        new_until = product.get("new_until")
        if new_until:
            try:
                until_dt = datetime.fromisoformat(str(new_until).replace("Z", "+00:00"))
                if until_dt.tzinfo is None:
                    until_dt = until_dt.replace(tzinfo=timezone.utc)
                if until_dt <= datetime.now(timezone.utc):
                    product["is_new"] = False
            except Exception:
                pass
    return product


async def _global_stock_sync() -> bool:
    s = await db.settings.find_one({"key": "stock_sync_settings"})
    return (s.get("value", {}) if s else {}).get("stock_sync_enabled", True)


def _apply_availability(product: dict, global_sync: bool) -> dict:
    """Effective in_stock: global sync ON -> by warehouse stock (bypasses manual flag);
    OFF -> by manual_available flag set on the product card."""
    if not product:
        return product
    if global_sync:
        product["in_stock"] = (product.get("stock", 0) or 0) > 0
    else:
        product["in_stock"] = bool(product.get("manual_available", True))
    return product


# ==================== CATEGORIES ====================

@router.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(200)
    # Sort by display_order, fallback to name for those without
    categories.sort(key=lambda c: (c.get("display_order", 9999), c.get("name", "")))
    return categories


@router.get("/categories/display-settings")
async def get_categories_display_settings():
    """Public endpoint: returns columns_count for the catalog page categories grid."""
    s = await db.settings.find_one({"key": "categories_display"}, {"_id": 0})
    return {"columns_count": (s or {}).get("value", {}).get("columns_count", 4)}


@router.put("/categories/display-settings")
async def update_categories_display_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    columns = int(data.get("columns_count", 4))
    columns = max(2, min(6, columns))
    await db.settings.update_one(
        {"key": "categories_display"},
        {"$set": {"value": {"columns_count": columns}}},
        upsert=True,
    )
    return {"columns_count": columns}


@router.post("/categories/reorder")
async def reorder_categories(data: CategoryReorder, user=Depends(get_current_user)):
    """Bulk reorder: ordered_ids = full list of category IDs in the desired order."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    for idx, cat_id in enumerate(data.ordered_ids):
        await db.categories.update_one({"id": cat_id}, {"$set": {"display_order": idx}})
    if data.columns_count is not None:
        columns = max(2, min(6, int(data.columns_count)))
        await db.settings.update_one(
            {"key": "categories_display"},
            {"$set": {"value": {"columns_count": columns}}},
            upsert=True,
        )
    return {"success": True, "count": len(data.ordered_ids)}


@router.post("/categories", response_model=CategoryResponse)
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


@router.put("/categories/{category_id}", response_model=CategoryResponse)
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


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    await db.categories.delete_one({"id": category_id})
    await db.products.update_many({"category_id": category_id}, {"$set": {"category_id": None}})

    # Log for revert (re-insert on revert)
    await log_action(
        action=f"Удаление категории: {category.get('name', '')}",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="DELETE",
        path=f"/categories/{category_id}",
        status_code=200,
        details={"category_name": category.get("name")},
        before_state={**category},
        collection_name="categories",
        document_id=category_id,
    )

    return {"message": "Category deleted"}


# ==================== PRODUCTS ====================

@router.get("/products/popular", response_model=List[ProductResponse])
async def get_popular_products(limit: int = 6):
    """Get popular products based on order count.

    Pulls top product IDs by total ordered quantity, then filters by those
    that still exist in the catalog. Oversamples (×5) so that deleted
    products don't reduce the result set below `limit`.
    """
    oversample = max(limit * 5, 30)
    pipeline = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "order_count": {"$sum": "$items.quantity"}}},
        {"$sort": {"order_count": -1}},
        {"$limit": oversample},
    ]
    popular_ids = await db.orders.aggregate(pipeline).to_list(oversample)

    products: List[dict] = []
    if popular_ids:
        product_ids = [p["_id"] for p in popular_ids]
        existing = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(len(product_ids))
        id_to_count = {p["_id"]: p["order_count"] for p in popular_ids}
        existing.sort(key=lambda x: id_to_count.get(x["id"], 0), reverse=True)
        products = existing[:limit]

    # Top up with newest products if we still don't have enough (e.g. brand-new store, few orders)
    if len(products) < limit:
        already = {p["id"] for p in products}
        extra_needed = limit - len(products)
        # Prefer newer products as a fallback
        extras = await db.products.find(
            {"id": {"$nin": list(already)}}, {"_id": 0}
        ).sort("created_at", -1).limit(extra_needed).to_list(extra_needed)
        products.extend(extras)

    gsync = await _global_stock_sync()
    return [_apply_availability(p, gsync) for p in products]



@router.get("/products/filters")
async def get_product_filters():
    """Get unique manufacturers and warehouses for filter dropdowns"""
    manufacturers = await db.products.distinct("manufacturer")
    warehouses = await db.products.distinct("warehouse")
    manufacturers = sorted([m for m in manufacturers if m])
    warehouses = sorted([w for w in warehouses if w])
    return {"manufacturers": manufacturers, "warehouses": warehouses}



@router.get("/products/new-summary")
async def get_new_summary():
    """Public endpoint: returns aggregate info about active 'Новинки' products for the catalog banner.

    Returns:
      - total_count: number of products with is_new=true and (new_until None OR > now)
      - earliest_until: closest new_until ISO datetime
      - featured: up to 10 newest products (sorted by created_at descending) with id/name/image/price/manufacturer/article/stock
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    query = {
        "is_new": True,
        "$or": [
            {"new_until": None},
            {"new_until": {"$gt": now_iso}},
        ],
    }
    products = await db.products.find(query, {"_id": 0}).to_list(500)
    total_count = len(products)
    earliest_until: Optional[str] = None
    for p in products:
        nu = p.get("new_until")
        if nu and (earliest_until is None or str(nu) < str(earliest_until)):
            earliest_until = nu

    # Sort by created_at descending so newest first; fall back to no-key
    def _created_at(p):
        ca = p.get("created_at")
        return str(ca) if ca else ""
    products_sorted = sorted(products, key=_created_at, reverse=True)

    featured = []
    for p in products_sorted[:10]:
        featured.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "image_url": p.get("image_url"),
            "price": p.get("price"),
            "manufacturer": p.get("manufacturer"),
            "article": p.get("article"),
            "stock": p.get("stock", 0),
            "new_until": p.get("new_until"),
        })
    return {
        "total_count": total_count,
        "earliest_until": earliest_until,
        "featured": featured,
    }


@router.get("/products/discount-summary")
async def get_discount_summary():
    """Public endpoint: returns aggregate info about active discounts for the catalog promo banner.

    Returns:
      - total_count: number of products on sale (active promo OR tier discount)
      - max_percent: highest percent across active promos and tiers
      - earliest_until: closest discount_until ISO datetime (only for time-bound promos)
      - featured: up to 3 sample products (id, name, image_url, price, percent)
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    query = {
        "$or": [
            {
                "$and": [
                    {"discount_active": True},
                    {"$or": [
                        {"discount_until": None},
                        {"discount_until": ""},
                        {"discount_until": {"$gt": now_iso}}
                    ]}
                ]
            },
            {"discount_tiers": {"$exists": True, "$type": "array", "$ne": []}}
        ]
    }
    products = await db.products.find(query, {"_id": 0}).to_list(500)
    total_count = len(products)
    max_percent = 0.0
    earliest_until: Optional[str] = None
    featured = []
    for p in products:
        # Highest percent from active promo
        if p.get("discount_active") and p.get("discount_type") == "percent":
            val = float(p.get("discount_value") or 0)
            if val > max_percent:
                max_percent = val
        # Highest percent from tiers
        for t in (p.get("discount_tiers") or []):
            if isinstance(t, dict) and t.get("type") == "percent":
                val = float(t.get("value") or 0)
                if val > max_percent:
                    max_percent = val
        # Earliest expiration
        du = p.get("discount_until")
        if du:
            if earliest_until is None or str(du) < str(earliest_until):
                earliest_until = du
    # Featured: top 3 by discount percent
    def _percent_of(p):
        candidates = [0.0]
        if p.get("discount_active") and p.get("discount_type") == "percent":
            candidates.append(float(p.get("discount_value") or 0))
        for t in (p.get("discount_tiers") or []):
            if isinstance(t, dict) and t.get("type") == "percent":
                candidates.append(float(t.get("value") or 0))
        return max(candidates)
    products_sorted = sorted(products, key=_percent_of, reverse=True)
    for p in products_sorted[:10]:
        featured.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "image_url": p.get("image_url"),
            "price": p.get("price"),
            "percent": _percent_of(p),
            "manufacturer": p.get("manufacturer"),
            "article": p.get("article"),
            "stock": p.get("stock", 0),
        })
    return {
        "total_count": total_count,
        "max_percent": max_percent,
        "earliest_until": earliest_until,
        "featured": featured,
    }


@router.get("/products", response_model=List[ProductResponse])
async def get_products(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    manufacturer: Optional[str] = None,
    warehouse: Optional[str] = None,
    in_stock: Optional[bool] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    virtual_category: Optional[str] = None,  # "assortment" | "new" | "discounted"
    limit: int = 100,
    skip: int = 0
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"article": {"$regex": search, "$options": "i"}},
            {"cross_articles": {"$regex": search, "$options": "i"}},
            {"manufacturer": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    if category_id:
        query["category_id"] = category_id
    if manufacturer:
        query["manufacturer"] = manufacturer
    if warehouse:
        query["warehouse"] = warehouse
    if in_stock:
        query["stock"] = {"$gt": 0}
    if price_min is not None or price_max is not None:
        price_q = {}
        if price_min is not None:
            price_q["$gte"] = price_min
        if price_max is not None:
            price_q["$lte"] = price_max
        query["price"] = price_q

    # Virtual category filters
    if virtual_category == "new":
        now_iso = datetime.now(timezone.utc).isoformat()
        query["is_new"] = True
        query["$and"] = query.get("$and", []) + [{
            "$or": [
                {"new_until": None},
                {"new_until": {"$gt": now_iso}}
            ]
        }]
    elif virtual_category == "discounted":
        now_iso = datetime.now(timezone.utc).isoformat()
        # Include products with either an active promo discount OR non-empty tiered discounts
        query["$and"] = query.get("$and", []) + [{
            "$or": [
                {
                    "$and": [
                        {"discount_active": True},
                        {"$or": [
                            {"discount_until": None},
                            {"discount_until": ""},
                            {"discount_until": {"$gt": now_iso}}
                        ]}
                    ]
                },
                {"discount_tiers": {"$exists": True, "$type": "array", "$ne": []}}
            ]
        }]
    # "assortment" or no virtual category — no filter

    products = await db.products.find(query, {"_id": 0}).skip(skip).limit(min(limit, 100)).to_list(100)
    gsync = await _global_stock_sync()
    return [_apply_availability(_ensure_new_status(p), gsync) for p in products]


@router.get("/products/search")
async def search_products_autocomplete(q: str, limit: int = 8):
    """Quick search for autocomplete dropdown - searches by name and article"""
    if not q or len(q) < 2:
        return {"products": []}
    
    query = {
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"article": {"$regex": q, "$options": "i"}},
            {"cross_articles": {"$regex": q, "$options": "i"}}
        ]
    }
    
    products = await db.products.find(query, {"_id": 0}).limit(min(limit, 20)).to_list(20)
    gsync = await _global_stock_sync()
    return {"products": [_apply_availability(p, gsync) for p in products]}


@router.get("/products/search-with-alternatives")
async def search_products_with_alternatives(search: str, limit: int = 50):
    """Search products with exact matches first, then alternatives from cross_articles"""
    if not search:
        return {"exact": [], "alternatives": []}
    
    search_upper = search.upper().strip()
    
    exact_match = await db.products.find_one(
        {"article": {"$regex": f"^{search}$", "$options": "i"}},
        {"_id": 0}
    )
    
    alternatives = []
    if search_upper:
        alt_query = {
            "$and": [
                {"cross_articles": {"$regex": search, "$options": "i"}},
                {"article": {"$not": {"$regex": f"^{search}$", "$options": "i"}}}
            ]
        }
        alternatives = await db.products.find(alt_query, {"_id": 0}).limit(limit).to_list(limit)
    
    name_matches = []
    if not exact_match:
        name_query = {"name": {"$regex": search, "$options": "i"}}
        name_matches = await db.products.find(name_query, {"_id": 0}).limit(limit).to_list(limit)

    gsync = await _global_stock_sync()
    exact_out = [exact_match] if exact_match else name_matches
    return {
        "exact": [_apply_availability(p, gsync) for p in exact_out],
        "alternatives": [_apply_availability(p, gsync) for p in alternatives]
    }


@router.get("/products/my-individual-prices")
async def get_my_individual_prices(user=Depends(get_current_user)):
    """Return the authenticated user's approved individual (negotiated) prices."""
    rows = await db.individual_prices.find(
        {"user_id": user["id"], "active": True}, {"_id": 0, "product_id": 1, "price": 1}
    ).to_list(1000)
    return {"prices": {r["product_id"]: r["price"] for r in rows}}



@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    gsync = await _global_stock_sync()
    return _apply_availability(_ensure_new_status(product), gsync)


@router.post("/products", response_model=ProductResponse)
async def create_product(data: ProductCreate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    product_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    payload = data.model_dump()
    # Auto-set is_new / new_until on creation if not explicitly provided
    if payload.get("is_new") is None:
        payload["is_new"] = True
    if payload.get("new_until") is None:
        payload["new_until"] = (now + timedelta(days=NEW_BADGE_DAYS)).isoformat()

    # If discount is being activated without a type, default to 'percent'
    if payload.get("discount_active") is True and payload.get("discount_type") in (None, ""):
        payload["discount_type"] = "percent"

    product = {
        "id": product_id,
        "created_at": now.isoformat(),
        **payload
    }
    await db.products.insert_one(product)
    gsync = await _global_stock_sync()
    return _apply_availability(_ensure_new_status(product), gsync)


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, data: ProductUpdate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    # If is_new is explicitly toggled to True and no new_until was provided,
    # extend it for another 14 days from now (manual "renew newness")
    if update_data.get("is_new") is True and "new_until" not in update_data:
        update_data["new_until"] = (datetime.now(timezone.utc) + timedelta(days=NEW_BADGE_DAYS)).isoformat()
    # If is_new=False, clear new_until
    if update_data.get("is_new") is False:
        update_data["new_until"] = None

    # If discount is being activated without a type, default to 'percent' (server-side safety net)
    if update_data.get("discount_active") is True and update_data.get("discount_type") in (None, ""):
        update_data["discount_type"] = "percent"

    result = await db.products.update_one({"id": product_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    gsync = await _global_stock_sync()
    return _apply_availability(_ensure_new_status(product), gsync)


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}


# ==================== ADMIN: catalog listing (search/sort/paginate) ====================

SORT_FIELDS = {"name", "price", "stock", "created_at", "manufacturer", "article"}


def _build_admin_query(search, category_id, manufacturer, in_stock, discounted):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"article": {"$regex": search, "$options": "i"}},
            {"cross_articles": {"$regex": search, "$options": "i"}},
            {"manufacturer": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if category_id:
        query["category_id"] = category_id
    if manufacturer:
        query["manufacturer"] = manufacturer
    if in_stock is True:
        query["stock"] = {"$gt": 0}
    elif in_stock is False:
        query["stock"] = {"$lte": 0}
    if discounted is True:
        query["discount_active"] = True
    return query


@router.get("/admin/products")
async def admin_list_products(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    manufacturer: Optional[str] = None,
    in_stock: Optional[bool] = None,
    discounted: Optional[bool] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 50,
    user=Depends(get_current_user),
):
    """Admin product listing: search by article/manufacturer/description/name, sort & paginate."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = _build_admin_query(search, category_id, manufacturer, in_stock, discounted)
    sort_field = sort_by if sort_by in SORT_FIELDS else "created_at"
    direction = -1 if sort_order == "desc" else 1
    page = max(1, page)
    page_size = min(max(1, page_size), 200)

    total = await db.products.count_documents(query)
    cursor = db.products.find(query, {"_id": 0}).sort(sort_field, direction).skip((page - 1) * page_size).limit(page_size)
    items = await cursor.to_list(page_size)
    gsync = await _global_stock_sync()
    return {
        "items": [_apply_availability(_ensure_new_status(p), gsync) for p in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/admin/products/ids")
async def admin_product_ids(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    manufacturer: Optional[str] = None,
    in_stock: Optional[bool] = None,
    discounted: Optional[bool] = None,
    user=Depends(get_current_user),
):
    """Return all product IDs matching the current filter (for 'select all matching')."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    query = _build_admin_query(search, category_id, manufacturer, in_stock, discounted)
    docs = await db.products.find(query, {"_id": 0, "id": 1}).to_list(100000)
    return {"ids": [d["id"] for d in docs], "total": len(docs)}


ALLOWED_BULK_FIELDS = {
    "is_original", "has_guarantee", "is_new", "bonus_eligible",
    "discount_active", "discount_type", "discount_value", "discount_label", "discount_until",
    "stock", "delivery_days", "category_id", "manufacturer", "warehouse",
}


@router.post("/admin/products/bulk")
async def admin_bulk_products(payload: dict, user=Depends(get_current_user)):
    """Bulk operations on products.

    Body: {
      product_ids?: [...],            # explicit selection
      apply_all?: bool,               # apply to ALL products matching the filter below
      search?, category_id?, manufacturer?, in_stock?, discounted?,   # filter (when apply_all)
      action: "set_fields"|"clear_discount"|"extend_discount"|"adjust_price"|"delete",
      payload: {...}
    }
    """
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    action = payload.get("action")
    data = payload.get("payload") or {}

    if payload.get("apply_all"):
        match = _build_admin_query(
            payload.get("search"), payload.get("category_id"), payload.get("manufacturer"),
            payload.get("in_stock"), payload.get("discounted"),
        )
    else:
        ids = payload.get("product_ids") or []
        if not isinstance(ids, list) or not ids:
            raise HTTPException(status_code=400, detail="product_ids required")
        match = {"id": {"$in": ids}}

    if action == "delete":
        if payload.get("apply_all") and not data.get("confirm_all"):
            raise HTTPException(status_code=400, detail="confirm_all required for delete-all")
        res = await db.products.delete_many(match)
        return {"success": True, "modified_count": res.deleted_count}

    if action == "set_fields":
        set_data = {k: v for k, v in data.items() if k in ALLOWED_BULK_FIELDS}
        if not set_data:
            raise HTTPException(status_code=400, detail="No valid fields")
        # New-badge handling
        if set_data.get("is_new") is True and "new_until" not in set_data:
            set_data["new_until"] = (datetime.now(timezone.utc) + timedelta(days=NEW_BADGE_DAYS)).isoformat()
        if set_data.get("is_new") is False:
            set_data["new_until"] = None
        if set_data.get("discount_active") is True and set_data.get("discount_type") in (None, ""):
            set_data["discount_type"] = "percent"
        res = await db.products.update_many(match, {"$set": set_data})
        return {"success": True, "modified_count": res.modified_count}

    if action == "clear_discount":
        res = await db.products.update_many(match, {"$set": {
            "discount_active": False, "discount_value": 0, "discount_until": None,
            "discount_label": "", "discount_type": None, "discount_tiers": [],
        }})
        return {"success": True, "modified_count": res.modified_count}

    if action == "extend_discount":
        until = data.get("discount_until")
        if not until:
            raise HTTPException(status_code=400, detail="discount_until required")
        res = await db.products.update_many(match, {"$set": {"discount_until": until, "discount_active": True}})
        return {"success": True, "modified_count": res.modified_count}

    if action == "adjust_price":
        mode = data.get("mode", "percent")
        value = float(data.get("value", 0) or 0)
        direction = data.get("direction", "inc")
        sign = 1 if direction == "inc" else -1
        if mode == "percent":
            factor = 1 + sign * (value / 100)
            expr = {"$round": [{"$max": [0, {"$multiply": ["$price", factor]}]}, 2]}
        else:
            expr = {"$round": [{"$max": [0, {"$add": ["$price", sign * value]}]}, 2]}
        res = await db.products.update_many(match, [{"$set": {"price": expr}}])
        return {"success": True, "modified_count": res.modified_count}

    raise HTTPException(status_code=400, detail="Unknown action")


@router.get("/products/{product_id}/related", response_model=List[ProductResponse])
async def get_related_products(product_id: str, limit: int = 4):
    """Get related products from same category"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    query = {"id": {"$ne": product_id}}
    
    if product.get("category_id"):
        query["category_id"] = product["category_id"]
    
    related = await db.products.find(query, {"_id": 0}).limit(limit).to_list(limit)
    
    if len(related) < limit:
        additional_query = {"id": {"$nin": [product_id] + [r["id"] for r in related]}}
        additional = await db.products.find(additional_query, {"_id": 0}).limit(limit - len(related)).to_list(limit)
        related.extend(additional)
    
    return related



# ==================== PRODUCT IMPORT/EXPORT ====================

@router.post("/admin/products/import")
async def import_products(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Import products from CSV file"""
    import csv
    import io
    
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV")
    
    content = await file.read()
    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = content.decode('cp1251')
    
    reader = csv.DictReader(io.StringIO(text), delimiter=';')
    
    imported = 0
    errors = []
    
    for row in reader:
        try:
            article = row.get('Артикул', '').strip()
            if not article:
                continue
            
            existing = await db.products.find_one({"article": article})
            
            product_data = {
                "name": row.get('Наименование', '').strip(),
                "article": article,
                "manufacturer": row.get('Производитель', '').strip(),
                "price": float(row.get('Цена', '0').replace(',', '.').replace(' ', '') or '0'),
                "stock": int(float(row.get('Остаток', '0').replace(',', '.').replace(' ', '') or '0')),
                "description": row.get('Описание', '').strip(),
                "cross_articles": row.get('Кросс-артикулы', '').strip(),
                "delivery_days": int(row.get('Срок доставки', '3') or '3'),
            }
            
            if existing:
                await db.products.update_one({"article": article}, {"$set": product_data})
            else:
                product_data["id"] = str(uuid.uuid4())
                product_data["image_url"] = ""
                product_data["images"] = []
                product_data["category_id"] = None
                await db.products.insert_one(product_data)
            
            imported += 1
        except Exception as e:
            errors.append(f"Row error: {str(e)}")
    
    return {
        "success": True,
        "imported": imported,
        "errors": errors[:10]
    }


@router.get("/admin/products/export")
async def export_products(user=Depends(get_current_user)):
    """Export products to CSV"""
    import csv
    import io
    
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    products = await db.products.find({}, {"_id": 0}).to_list(10000)
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    
    writer.writerow(['Артикул', 'Наименование', 'Производитель', 'Цена', 'Остаток', 'Описание', 'Кросс-артикулы', 'Срок доставки', 'Категория'])
    
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    cat_map = {c["id"]: c["name"] for c in categories}
    
    for p in products:
        writer.writerow([
            p.get('article', ''),
            p.get('name', ''),
            p.get('manufacturer', ''),
            p.get('price', 0),
            p.get('stock', 0),
            p.get('description', ''),
            p.get('cross_articles', ''),
            p.get('delivery_days', 3),
            cat_map.get(p.get('category_id'), '')
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products.csv"}
    )
