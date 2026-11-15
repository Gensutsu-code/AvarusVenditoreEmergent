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


class PromoValidateIn(BaseModel):
    code: str
    goods_total: float = 0


def _now():
    return datetime.now(timezone.utc).isoformat()


def _norm_code(code: str) -> str:
    return (code or "").strip().upper()


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
            # compare date-only to be lenient with timezones
            end = datetime.fromisoformat(str(vu).replace("Z", "+00:00"))
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
        used_by_user = await db.orders.count_documents({"user_id": user_id, "promo_code": norm})
        if used_by_user >= per_user:
            return None, 0.0, "Вы уже использовали этот промокод"
    # compute discount
    if doc.get("type") == "amount":
        disc = min(float(doc.get("value") or 0), goods_total)
    else:
        pct = max(0.0, min(100.0, float(doc.get("value") or 0)))
        disc = goods_total * pct / 100.0
    return doc, round(disc, 2), None


# --- Client ---

@router.post("/promo-codes/validate")
async def validate_code(data: PromoValidateIn, user=Depends(get_current_user)):
    doc, disc, err = await validate_promo_code(data.code, user["id"], float(data.goods_total or 0))
    if err:
        return {"valid": False, "message": err, "discount": 0}
    return {
        "valid": True,
        "code": doc["code"],
        "type": doc.get("type", "percent"),
        "value": doc.get("value", 0),
        "discount": disc,
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
    code = _norm_code(data.code)
    if not code:
        raise HTTPException(status_code=400, detail="Код не может быть пустым")
    if data.type not in ("percent", "amount"):
        raise HTTPException(status_code=400, detail="Неверный тип скидки")
    if data.value <= 0:
        raise HTTPException(status_code=400, detail="Значение скидки должно быть больше 0")
    if data.type == "percent" and data.value > 100:
        raise HTTPException(status_code=400, detail="Процент не может быть больше 100")
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
    code = _norm_code(data.code)
    if not code:
        raise HTTPException(status_code=400, detail="Код не может быть пустым")
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
    }})
    return await db.promo_codes.find_one({"id": code_id}, {"_id": 0})


@router.delete("/admin/promo-codes/{code_id}")
async def delete_promo_code(code_id: str, user=Depends(get_current_user)):
    _require_admin(user)
    res = await db.promo_codes.delete_one({"id": code_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Промокод не найден")
    return {"success": True}
