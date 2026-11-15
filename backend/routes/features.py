"""Site features: switch whole functions of the shop on/off (kept in settings, cached for sync checks)"""
import re
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

FEATURE_SETTINGS_KEY = "feature_settings"
GARAGE_TYPES = ("truck", "trailer", "car", "special")
SETTINGS_DEFAULTS = {
    "garage": {"max_vehicles": 0, "allowed_types": ["truck", "trailer"], "checkout_mode": "optional"},
    "chat": {
        "title": "Онлайн-чат", "subtitle": "Поддержка avopt.store",
        "greeting_title": "Напишите нам!", "greeting_text": "Мы ответим как можно скорее",
        "guests_allowed": False, "attachments_allowed": True,
        "work_hours_enabled": False, "work_start": "09:00", "work_end": "18:00", "work_days": [0, 1, 2, 3, 4],
        "utc_offset": 3, "auto_reply": "Сейчас мы не на связи. Ответим в рабочее время — оставьте сообщение.",
    },
    "favorites": {"max_items": 0, "notify_price_drop": False, "notify_back_in_stock": False},
    "product_requests": {"offer_valid_days": 0, "comment_required": False, "show_out_of_stock": True, "show_not_found": True},
}
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

_cache = {"flags": {}, "settings": {k: dict(v) for k, v in SETTINGS_DEFAULTS.items()}, "ts": 0.0}


def _clean_settings(key: str, raw: dict) -> dict:
    """Coerce every value to the type of its default; unknown keys are dropped."""
    out = {}
    for name, default in SETTINGS_DEFAULTS[key].items():
        v = (raw or {}).get(name, default)
        if isinstance(default, bool):
            v = bool(v)
        elif isinstance(default, int):
            try:
                v = int(v)
            except (TypeError, ValueError):
                v = default
            v = max(-12, min(14, v)) if name == "utc_offset" else max(0, min(100000, v))
        elif isinstance(default, str):
            v = str(v or "").strip()[:500]
        out[name] = v
    if key == "garage":
        types = out["allowed_types"] if isinstance(out["allowed_types"], list) else []
        out["allowed_types"] = [t for t in GARAGE_TYPES if t in types] or list(SETTINGS_DEFAULTS[key]["allowed_types"])
        if out["checkout_mode"] not in ("off", "optional", "required"):
            out["checkout_mode"] = "optional"
    if key == "chat":
        days = out["work_days"] if isinstance(out["work_days"], list) else []
        out["work_days"] = [d for d in range(7) if d in days]
        for name in ("work_start", "work_end"):
            if not _TIME_RE.match(out[name]):
                out[name] = SETTINGS_DEFAULTS[key][name]
        for name in ("title", "greeting_title"):
            out[name] = out[name] or SETTINGS_DEFAULTS[key][name]
    return out


def fsettings(key: str) -> dict:
    """Sync read of a function's settings from the cache."""
    return _cache["settings"][key]



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
        sdoc = await db.settings.find_one({"key": FEATURE_SETTINGS_KEY}, {"_id": 0})
        stored = (sdoc or {}).get("value") or {}
        _cache["settings"] = {k: _clean_settings(k, stored.get(k)) for k in SETTINGS_DEFAULTS}
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


@router.get("/feature-settings")
async def public_feature_settings():
    await refresh_features()
    return _cache["settings"]


@router.put("/admin/feature-settings/{key}")
async def update_feature_settings(key: str, data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if key not in SETTINGS_DEFAULTS:
        raise HTTPException(status_code=404, detail="У этой функции нет параметров")
    value = _clean_settings(key, data)
    await db.settings.update_one(
        {"key": FEATURE_SETTINGS_KEY}, {"$set": {"key": FEATURE_SETTINGS_KEY, f"value.{key}": value}}, upsert=True
    )
    await refresh_features(force=True)
    return value
