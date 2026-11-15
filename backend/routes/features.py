"""Site features: switch whole functions of the shop on/off (kept in settings, cached for sync checks)"""
import time
from fastapi import APIRouter, HTTPException, Depends

from database import db, get_current_user
from routes.action_logs import log_action

router = APIRouter(tags=["features"])

SETTINGS_KEY = "site_features"
AUDIENCES = ("all", "retail", "wholesale")

# key -> client API prefixes whose write requests are rejected while the feature is off
FEATURES = {
    "discounts": [],
    "promo_codes": ["/api/promo-codes"],
    "cart_discounts": ["/api/cart-discount-requests"],
    "price_requests": ["/api/discount-requests"],
    "product_requests": ["/api/product-requests"],
    "rewards": ["/api/rewards", "/api/bonus"],
    "credit": ["/api/credit"],
    "returns": ["/api/returns"],
    "garage": ["/api/garage"],
    "ai_assistant": ["/api/ai"],
    "parts_finder": ["/api/parts-finder"],
    "chat": ["/api/chat"],
    "favorites": ["/api/favorites"],
    "managers": ["/api/manager", "/api/conditions-requests"],
    "news": [],
    "warehouses_map": [],
    "partners": [],
    "promo_banner": [],
    "admin_carts": [],
    "telegram": [],
}

_cache = {"flags": {}, "ts": 0.0}


def _normalize(value: dict) -> dict:
    value = value or {}
    out = {}
    for key in FEATURES:
        raw = value.get(key) or {}
        audience = raw.get("audience") if raw.get("audience") in AUDIENCES else "all"
        out[key] = {"enabled": bool(raw.get("enabled", True)), "audience": audience}
    return out


async def refresh_features(force: bool = False) -> dict:
    if force or time.monotonic() - _cache["ts"] > 2:
        doc = await db.settings.find_one({"key": SETTINGS_KEY}, {"_id": 0})
        _cache["flags"] = _normalize((doc or {}).get("value"))
        _cache["ts"] = time.monotonic()
    return _cache["flags"]


def is_on(key: str, user: dict = None) -> bool:
    """Sync check against the cache (refreshed by the middleware on every request)."""
    f = _cache["flags"].get(key)
    if not f:
        return True
    if not f["enabled"]:
        return False
    if user is not None and f["audience"] != "all" and user.get("role", "user") == "user":
        return user.get("customer_status", "retail") == f["audience"]
    return True


def blocked_feature(path: str, method: str):
    """Feature key that blocks this client write request, if any."""
    if method in ("GET", "HEAD", "OPTIONS") or path.startswith("/api/admin"):
        return None
    for key, prefixes in FEATURES.items():
        if not is_on(key) and any(path == p or path.startswith(p + "/") for p in prefixes):
            return key
    return None


@router.get("/features")
async def public_features():
    return await refresh_features()


@router.put("/admin/features/{key}")
async def update_feature(key: str, data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if key not in FEATURES:
        raise HTTPException(status_code=404, detail="Неизвестная функция")
    flags = await refresh_features(force=True)
    before = dict(flags[key])
    after = dict(before)
    if "enabled" in data:
        after["enabled"] = bool(data["enabled"])
    if "audience" in data:
        if data["audience"] not in AUDIENCES:
            raise HTTPException(status_code=400, detail="Некорректная аудитория")
        after["audience"] = data["audience"]
    await db.settings.update_one(
        {"key": SETTINGS_KEY}, {"$set": {"key": SETTINGS_KEY, f"value.{key}": after}}, upsert=True
    )
    await refresh_features(force=True)
    if before["enabled"] != after["enabled"]:
        await log_action(
            action=f"Функционал сайта: «{key}» {'включена' if after['enabled'] else 'отключена'}",
            user_id=user["id"], user_name=user.get("name", user.get("email")), user_role=user.get("role"),
            method="PUT", path=f"/admin/features/{key}", status_code=200, details={"before": before, "after": after},
        )
    return {"key": key, **after}
