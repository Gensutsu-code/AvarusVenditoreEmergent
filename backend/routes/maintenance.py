"""Maintenance mode routes — global and per-page"""
from fastapi import APIRouter, HTTPException, Depends
from database import db, get_current_user

router = APIRouter(prefix="/maintenance", tags=["maintenance"])

PAGE_KEYS = ["catalog", "bonus", "account", "news", "orders", "cart", "favorites"]


@router.get("/status")
async def get_maintenance_status():
    """Returns global + per-page maintenance status"""
    settings = await db.site_settings.find_one({"key": "maintenance"}, {"_id": 0})
    page_settings = await db.site_settings.find_one({"key": "page_maintenance"}, {"_id": 0})

    result = {
        "enabled": settings.get("enabled", False) if settings else False,
        "message": settings.get("message", "") if settings else "",
        "pages": {},
    }

    if page_settings and "pages" in page_settings:
        result["pages"] = page_settings["pages"]

    return result


@router.post("/toggle")
async def toggle_maintenance(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    settings = await db.site_settings.find_one({"key": "maintenance"})
    current = settings.get("enabled", False) if settings else False
    new_enabled = not current

    await db.site_settings.update_one(
        {"key": "maintenance"},
        {"$set": {"enabled": new_enabled}},
        upsert=True,
    )
    return {"enabled": new_enabled}


@router.put("/settings")
async def update_maintenance_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    update = {}
    if "enabled" in data:
        update["enabled"] = data["enabled"]
    if "message" in data:
        update["message"] = data["message"]

    await db.site_settings.update_one(
        {"key": "maintenance"},
        {"$set": update},
        upsert=True,
    )

    settings = await db.site_settings.find_one({"key": "maintenance"}, {"_id": 0})
    return {"enabled": settings.get("enabled", False), "message": settings.get("message", "")}


@router.get("/pages")
async def get_page_maintenance():
    """Get per-page maintenance settings"""
    doc = await db.site_settings.find_one({"key": "page_maintenance"}, {"_id": 0})
    if not doc or "pages" not in doc:
        return {"pages": {k: {"enabled": False, "message": ""} for k in PAGE_KEYS}}
    return {"pages": doc["pages"]}


@router.put("/pages")
async def update_page_maintenance(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    pages = data.get("pages", {})
    # Validate keys
    sanitized = {}
    for key in PAGE_KEYS:
        if key in pages:
            sanitized[key] = {
                "enabled": bool(pages[key].get("enabled", False)),
                "message": str(pages[key].get("message", "")),
            }
        else:
            sanitized[key] = {"enabled": False, "message": ""}

    await db.site_settings.update_one(
        {"key": "page_maintenance"},
        {"$set": {"pages": sanitized}},
        upsert=True,
    )
    return {"pages": sanitized}


@router.get("/footer")
async def get_footer_settings():
    """Public: get footer contacts and copyright"""
    doc = await db.site_settings.find_one({"key": "footer"}, {"_id": 0})
    if not doc:
        return {"email": "", "address": "", "telegram": "", "whatsapp": "", "vk": "", "copyright": ""}
    return {k: doc.get(k, "") for k in ["email", "address", "telegram", "whatsapp", "vk", "copyright"]}


@router.put("/footer")
async def update_footer_settings(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    fields = {}
    for k in ["email", "address", "telegram", "whatsapp", "vk", "copyright"]:
        if k in data:
            fields[k] = str(data[k])

    await db.site_settings.update_one(
        {"key": "footer"},
        {"$set": {**fields, "key": "footer"}},
        upsert=True,
    )
    doc = await db.site_settings.find_one({"key": "footer"}, {"_id": 0})
    return {k: doc.get(k, "") for k in ["email", "address", "telegram", "whatsapp", "vk", "copyright"]}
