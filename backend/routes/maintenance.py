"""Maintenance mode routes"""
from fastapi import APIRouter, HTTPException, Depends
from database import db, get_current_user

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("/status")
async def get_maintenance_status():
    settings = await db.site_settings.find_one({"key": "maintenance"}, {"_id": 0})
    if not settings:
        return {"enabled": False, "message": ""}
    return {"enabled": settings.get("enabled", False), "message": settings.get("message", "")}


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
        upsert=True
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
        upsert=True
    )
    
    settings = await db.site_settings.find_one({"key": "maintenance"}, {"_id": 0})
    return {"enabled": settings.get("enabled", False), "message": settings.get("message", "")}
