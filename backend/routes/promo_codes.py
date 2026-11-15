"""Cart-wide promo codes: admin creates reusable codes (percent or fixed amount);
clients enter a code at checkout to get a discount on the whole cart.
Floor rule (product min_price) is enforced in orders.create_order."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db, get_current_user

router = APIRouter(tags=["promo-codes"])


class PromoCodeIn(BaseModel):
    code: str
    type: str = "percent"          # 'percent' | 'amount'
    value: float = 0
    min_order: float = 0           # minimum goods subtotal to use the code
    max_uses: int = 0              # 0 = unlimited total uses
    per_user_limit: int = 0        # 0 = unlimited uses per user
    active: bool = True
    valid_until: Optional[str] = None  # ISO date, optional
    description: str = ""
    show_on_storefront: bool = False  # show the code to everyone in the storefront banner


class PromoValidateIn(BaseModel):
    code: str
    goods_total: float = 0


def _now():
    return datetime.now(timezone.utc).isoformat()


def _norm_code(code: str) -> str:
    return (code or "").strip().upper()


def _validate_code_fields(data):
    """Shared field validation for create/update."""
    code = _norm_code(data.code)
    if not code:
        raise HTTPException(status_code=400, detail="Код не может быть пустым")
    if data.type not in ("percent", "amount"):
        raise HTTPException(status_code=400, detail="Неверный тип скидки")
    if data.value <= 0:
        raise HTTPException(status_code=400, detail="Значение скидки должно быть больше 0")
    if data.type == "percent" and data.value > 100:
        raise HTTPException(status_code=400, detail="Процент не может быть больше 100")
    if (data.min_order or 0) < 0 or (data.max_uses or 0) < 0 or (data.per_user_limit or 0) < 0:
        raise HTTPException(status_code=400, detail="Лимиты не могут быть отрицательными")
    return code


async def cart_floor_sum(user_id: str) -> float:
    """Σ min_price × qty across the user's current cart — the hard floor the goods total cannot go below."""
    cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
    if not cart or not cart.get("items"):
        return 0.0
    ids = [i["product_id"] for i in cart["items"]]
    prods = await db.products.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "min_price": 1}).to_list(1000)
    fm = {p["id"]: p.get("min_price") for p in prods}
    qty = {i["product_id"]: i["quantity"] for i in cart["items"]}
    total = 0.0
    for pid, q in qty.items():
        fl = fm.get(pid)
        if fl is not None and fl >= 0:
            total += float(fl) * q
    return round(total, 2)


async def validate_promo_code(code: str, user_id: str, goods_total: float):
    """Returns (code_doc | None, discount_amount, error_message | None)."""
    norm = _norm_code(code)
    if not norm:
        return None, 0.0, "Введите промокод"
    doc = await db.promo_codes.find_one({"code": norm}, {"_id": 0})
    if not doc:
        return None, 0.0, "Промокод не найден"
    if not doc.get("active", True):
        return None, 0.0, "Промокод неактивен"
    vu = doc.get("valid_until")
    if vu:
        try:
            s = str(vu)
            # Date-only values (YYYY-MM-DD from the admin UI) are valid through the end of that day
            if len(s) == 10:
                s = s + "T23:59:59"
            end = datetime.fromisoformat(s.replace("Z", "+00:00"))
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > end:
                return None, 0.0, "Срок действия промокода истёк"
        except (ValueError, TypeError):
            pass
    min_order = float(doc.get("min_order") or 0)
    if goods_total < min_order:
        return None, 0.0, f"Минимальная сумма заказа для промокода: {min_order:.0f} ₽"
    max_uses = int(doc.get("max_uses") or 0)
    if max_uses > 0 and int(doc.get("used_count") or 0) >= max_uses:
        return None, 0.0, "Лимит использований промокода исчерпан"
    per_user = int(doc.get("per_user_limit") or 0)
    if per_user > 0:
        used_by_user = await db.orders.count_documents(
            {"user_id": user_id, "promo_code": norm, "status": {"$ne": "cancelled"}}
        )
        if used_by_user >= per_user:
            return None, 0.0, "Вы уже использовали этот промокод"
    # compute discount
    if doc.get("type") == "amount":
        disc = min(float(doc.get("value") or 0), goods_total)
    else:
        pct = max(0.0, min(100.0, float(doc.get("value") or 0)))
        disc = goods_total * pct / 100.0
    return doc, round(disc, 2), None


def _is_live(doc) -> bool:
    if not doc.get("active", True):
        return False
    max_uses = int(doc.get("max_uses") or 0)
    if max_uses > 0 and int(doc.get("used_count") or 0) >= max_uses:
        return False
    vu = doc.get("valid_until")
    if vu:
        try:
            s = str(vu)
            end = datetime.fromisoformat((s + "T23:59:59" if len(s) == 10 else s).replace("Z", "+00:00"))
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            return datetime.now(timezone.utc) <= end
        except (ValueError, TypeError):
            return True
    return True


# --- Public storefront banner ---

@router.get("/promotions/active")
async def active_promotions():
    """Public: promo codes the admin chose to show + count of discounted products."""
    docs = await db.promo_codes.find({"show_on_storefront": True, "active": True}, {"_id": 0}).sort("created_at", -1).to_list(50)
    codes = [{
        "code": d["code"], "type": d.get("type", "percent"), "value": d.get("value", 0),
        "min_order": d.get("min_order", 0), "valid_until": d.get("valid_until"),
    } for d in docs if _is_live(d)][:5]
    now_iso = datetime.now(timezone.utc).isoformat()
    discounted = await db.products.count_documents({
        "discount_active": True, "discount_value": {"$gt": 0},
        "$or": [{"discount_until": None}, {"discount_until": {"$exists": False}}, {"discount_until": {"$gte": now_iso[:10]}}],
    })
    return {"promo_codes": codes, "discounted_products": discounted}


# --- Client ---

@router.post("/promo-codes/validate")
async def validate_code(data: PromoValidateIn, user=Depends(get_current_user)):
    goods_total = float(data.goods_total or 0)
    doc, disc, err = await validate_promo_code(data.code, user["id"], goods_total)
    if err:
        return {"valid": False, "message": err, "discount": 0}
    # Floor-cap against the cart's Σ min_price × qty so the preview matches the actual charge
    floor = await cart_floor_sum(user["id"])
    disc = min(disc, max(0.0, round(goods_total - floor, 2)))
    if disc <= 0:
        return {"valid": False, "message": "Промокод не даёт скидку для текущего состава корзины", "discount": 0}
    return {
        "valid": True,
        "code": doc["code"],
        "type": doc.get("type", "percent"),
        "value": doc.get("value", 0),
        "discount": round(disc, 2),
        "message": f"Промокод применён: −{disc:.0f} ₽",
    }


# --- Admin ---

def _require_admin(user):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/admin/promo-codes")
async def list_promo_codes(user=Depends(get_current_user)):
    _require_admin(user)
    return await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/admin/promo-codes")
async def create_promo_code(data: PromoCodeIn, user=Depends(get_current_user)):
    _require_admin(user)
    code = _validate_code_fields(data)
    if await db.promo_codes.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Промокод с таким кодом уже существует")
    doc = {
        "id": str(uuid.uuid4()),
        "code": code,
        "type": data.type,
        "value": round(float(data.value), 2),
        "min_order": round(float(data.min_order or 0), 2),
        "max_uses": int(data.max_uses or 0),
        "per_user_limit": int(data.per_user_limit or 0),
        "active": bool(data.active),
        "valid_until": data.valid_until or None,
        "description": data.description or "",
        "show_on_storefront": bool(data.show_on_storefront),
        "used_count": 0,
        "created_at": _now(),
    }
    await db.promo_codes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/admin/promo-codes/{code_id}")
async def update_promo_code(code_id: str, data: PromoCodeIn, user=Depends(get_current_user)):
    _require_admin(user)
    existing = await db.promo_codes.find_one({"id": code_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Промокод не найден")
    code = _validate_code_fields(data)
    dup = await db.promo_codes.find_one({"code": code, "id": {"$ne": code_id}})
    if dup:
        raise HTTPException(status_code=400, detail="Промокод с таким кодом уже существует")
    await db.promo_codes.update_one({"id": code_id}, {"$set": {
        "code": code,
        "type": data.type,
        "value": round(float(data.value), 2),
        "min_order": round(float(data.min_order or 0), 2),
        "max_uses": int(data.max_uses or 0),
        "per_user_limit": int(data.per_user_limit or 0),
        "active": bool(data.active),
        "valid_until": data.valid_until or None,
        "description": data.description or "",
        "show_on_storefront": bool(data.show_on_storefront),
    }})
    return await db.promo_codes.find_one({"id": code_id}, {"_id": 0})


@router.delete("/admin/promo-codes/{code_id}")
async def delete_promo_code(code_id: str, user=Depends(get_current_user)):
    _require_admin(user)
    res = await db.promo_codes.delete_one({"id": code_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Промокод не найден")
    return {"success": True}
