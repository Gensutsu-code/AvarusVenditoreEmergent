"""Admin Cart Management routes"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db, get_current_user

router = APIRouter(prefix="/admin", tags=["admin-carts"])


class AdminCartAddItem(BaseModel):
    product_id: str
    quantity: int = 1


class AdminCartUpdateItem(BaseModel):
    quantity: Optional[int] = None
    price: Optional[float] = None


@router.get("/carts")
async def get_all_carts(user=Depends(get_current_user)):
    """Get all non-empty user carts with user info and product details"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    carts = await db.carts.find(
        {"items": {"$exists": True, "$ne": []}}, {"_id": 0}
    ).to_list(1000)

    if not carts:
        return {"carts": []}

    # Collect all user_ids and product_ids
    user_ids = list({c["user_id"] for c in carts})
    all_product_ids = set()
    for c in carts:
        for item in c.get("items", []):
            all_product_ids.add(item["product_id"])

    # Batch fetch users
    users_list = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1}
    ).to_list(1000)
    users_map = {u["id"]: u for u in users_list}

    # Batch fetch products
    products_list = await db.products.find(
        {"id": {"$in": list(all_product_ids)}},
        {"_id": 0, "id": 1, "name": 1, "article": 1, "price": 1, "image_url": 1, "manufacturer": 1, "stock": 1}
    ).to_list(10000)
    products_map = {p["id"]: p for p in products_list}

    # Batch fetch individual prices
    ind_prices = await db.individual_prices.find(
        {"user_id": {"$in": user_ids}, "active": True},
        {"_id": 0}
    ).to_list(10000)
    ind_prices_map = {}
    for ip in ind_prices:
        ind_prices_map[(ip["user_id"], ip["product_id"])] = ip["price"]

    result = []
    for cart in carts:
        uid = cart["user_id"]
        u = users_map.get(uid)
        if not u:
            continue

        items_detailed = []
        cart_total = 0
        for item in cart.get("items", []):
            product = products_map.get(item["product_id"])
            if not product:
                continue
            ind_price = ind_prices_map.get((uid, item["product_id"]))
            effective_price = ind_price if ind_price is not None else product["price"]
            qty = item.get("quantity", 1)
            items_detailed.append({
                "product_id": item["product_id"],
                "name": product["name"],
                "article": product.get("article", ""),
                "manufacturer": product.get("manufacturer"),
                "price": effective_price,
                "original_price": product["price"],
                "individual_price": ind_price,
                "quantity": qty,
                "image_url": product.get("image_url"),
                "stock": product.get("stock", 0),
            })
            cart_total += effective_price * qty

        if not items_detailed:
            continue

        result.append({
            "user_id": uid,
            "user_name": u.get("name") or u.get("email", ""),
            "user_email": u.get("email", ""),
            "user_phone": u.get("phone", ""),
            "items": items_detailed,
            "items_count": len(items_detailed),
            "total": round(cart_total, 2),
        })

    # Sort by total desc
    result.sort(key=lambda x: -x["total"])
    return {"carts": result}


@router.get("/carts/{user_id}")
async def get_user_cart(user_id: str, user=Depends(get_current_user)):
    """Get a specific user's cart with full details"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
    if not cart or not cart.get("items"):
        return {"items": [], "total": 0}

    product_ids = [item["product_id"] for item in cart.get("items", [])]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(100)
    products_map = {p["id"]: p for p in products}

    ind_prices = await db.individual_prices.find(
        {"user_id": user_id, "active": True, "product_id": {"$in": product_ids}},
        {"_id": 0}
    ).to_list(100)
    ind_prices_map = {ip["product_id"]: ip["price"] for ip in ind_prices}

    items = []
    total = 0
    for item in cart.get("items", []):
        product = products_map.get(item["product_id"])
        if not product:
            continue
        ind_price = ind_prices_map.get(item["product_id"])
        effective_price = ind_price if ind_price is not None else product["price"]
        qty = item.get("quantity", 1)
        items.append({
            "product_id": item["product_id"],
            "name": product["name"],
            "article": product.get("article", ""),
            "manufacturer": product.get("manufacturer"),
            "price": effective_price,
            "original_price": product["price"],
            "individual_price": ind_price,
            "quantity": qty,
            "image_url": product.get("image_url"),
            "stock": product.get("stock", 0),
        })
        total += effective_price * qty

    return {"items": items, "total": round(total, 2)}


@router.post("/carts/{user_id}/add")
async def admin_add_to_cart(user_id: str, body: AdminCartAddItem, user=Depends(get_current_user)):
    """Admin: add a product to a user's cart"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Verify product exists
    product = await db.products.find_one({"id": body.product_id}, {"_id": 0, "id": 1, "name": 1})
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    cart = await db.carts.find_one({"user_id": user_id})
    if not cart:
        await db.carts.insert_one({"user_id": user_id, "items": [{"product_id": body.product_id, "quantity": body.quantity}]})
    else:
        items = cart.get("items", [])
        existing = next((i for i in items if i["product_id"] == body.product_id), None)
        if existing:
            existing["quantity"] += body.quantity
        else:
            items.append({"product_id": body.product_id, "quantity": body.quantity})
        await db.carts.update_one({"user_id": user_id}, {"$set": {"items": items}})

    return {"success": True}


@router.put("/carts/{user_id}/item/{product_id}")
async def admin_update_cart_item(user_id: str, product_id: str, body: AdminCartUpdateItem, user=Depends(get_current_user)):
    """Admin: update quantity or set individual price for a cart item"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
    if not cart:
        raise HTTPException(status_code=404, detail="Корзина не найдена")

    items = cart.get("items", [])
    found = False
    for item in items:
        if item["product_id"] == product_id:
            if body.quantity is not None:
                item["quantity"] = max(1, body.quantity)
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Товар не найден в корзине")

    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": items}})

    # Handle individual price
    if body.price is not None:
        existing_ip = await db.individual_prices.find_one(
            {"user_id": user_id, "product_id": product_id, "active": True}
        )
        if existing_ip:
            await db.individual_prices.update_one(
                {"user_id": user_id, "product_id": product_id, "active": True},
                {"$set": {"price": body.price, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            await db.individual_prices.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "product_id": product_id,
                "price": body.price,
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })

    return {"success": True}


@router.delete("/carts/{user_id}/item/{product_id}")
async def admin_remove_cart_item(user_id: str, product_id: str, user=Depends(get_current_user)):
    """Admin: remove an item from a user's cart"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.carts.update_one(
        {"user_id": user_id},
        {"$pull": {"items": {"product_id": product_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Товар не найден в корзине")

    # Deactivate individual price if exists
    await db.individual_prices.update_many(
        {"user_id": user_id, "product_id": product_id, "active": True},
        {"$set": {"active": False}}
    )

    return {"success": True}


@router.delete("/carts/{user_id}")
async def admin_clear_cart(user_id: str, user=Depends(get_current_user)):
    """Admin: clear a user's entire cart"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    await db.carts.update_one({"user_id": user_id}, {"$set": {"items": []}})
    return {"success": True}
