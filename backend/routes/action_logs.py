"""Action Logs & Developer Mode routes for Absolute Control"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import json

from database import db, get_current_user

router = APIRouter(prefix="/admin", tags=["admin-devmode"])


# ==================== DEVELOPER MODE ====================

@router.get("/developer-mode")
async def get_developer_mode(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    settings = await db.settings.find_one({"type": "developer_mode"}, {"_id": 0})
    return {"enabled": settings.get("enabled", False) if settings else False}


@router.put("/developer-mode")
async def toggle_developer_mode(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    settings = await db.settings.find_one({"type": "developer_mode"})
    current = settings.get("enabled", False) if settings else False
    new_val = not current
    await db.settings.update_one(
        {"type": "developer_mode"},
        {"$set": {"enabled": new_val, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"enabled": new_val}


# ==================== ACTION LOGS ====================

async def log_action(
    action: str,
    user_id: str = None,
    user_name: str = None,
    user_role: str = None,
    method: str = None,
    path: str = None,
    ip: str = None,
    status_code: int = None,
    details: dict = None,
    before_state: dict = None,
    after_state: dict = None,
    collection_name: str = None,
    document_id: str = None,
    document_query: dict = None,
):
    """Utility function to create an action log entry.
    document_query: optional MongoDB query to find the document (for composite keys like bonus_progress).
    """
    log_entry = {
        "id": str(uuid.uuid4()),
        "action": action,
        "user_id": user_id,
        "user_name": user_name or "Система",
        "user_role": user_role or "system",
        "method": method,
        "path": path,
        "ip": ip,
        "status_code": status_code,
        "details": details,
        "before_state": before_state,
        "after_state": after_state,
        "collection_name": collection_name,
        "document_id": document_id,
        "document_query": document_query,
        "reverted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.action_logs.insert_one(log_entry)
    return log_entry["id"]


@router.get("/action-logs")
async def get_action_logs(
    user=Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    method: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = {"$regex": action, "$options": "i"}
    if method:
        query["method"] = method.upper()
    if search:
        query["$or"] = [
            {"action": {"$regex": search, "$options": "i"}},
            {"path": {"$regex": search, "$options": "i"}},
            {"user_name": {"$regex": search, "$options": "i"}},
        ]
    if date_from:
        query.setdefault("created_at", {})["$gte"] = date_from
    if date_to:
        query.setdefault("created_at", {})["$lte"] = date_to

    total = await db.action_logs.count_documents(query)
    skip = (page - 1) * limit
    logs = await db.action_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "logs": logs,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get("/action-logs/stats")
async def get_action_logs_stats(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    total = await db.action_logs.count_documents({})
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_count = await db.action_logs.count_documents({"created_at": {"$gte": today}})
    revertable = await db.action_logs.count_documents({"before_state": {"$ne": None}, "reverted": False})

    # Top actions
    pipeline = [
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_actions = await db.action_logs.aggregate(pipeline).to_list(10)

    # Top users
    pipeline_users = [
        {"$match": {"user_id": {"$ne": None}}},
        {"$group": {"_id": {"user_id": "$user_id", "user_name": "$user_name"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_users = await db.action_logs.aggregate(pipeline_users).to_list(10)

    return {
        "total": total,
        "today": today_count,
        "revertable": revertable,
        "top_actions": [{"action": a["_id"], "count": a["count"]} for a in top_actions],
        "top_users": [{"user_id": u["_id"]["user_id"], "user_name": u["_id"]["user_name"], "count": u["count"]} for u in top_users],
    }


@router.post("/action-logs/{log_id}/revert")
async def revert_action(log_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    log_entry = await db.action_logs.find_one({"id": log_id}, {"_id": 0})
    if not log_entry:
        raise HTTPException(status_code=404, detail="Log not found")
    if not log_entry.get("before_state"):
        raise HTTPException(status_code=400, detail="No before state to revert to")
    if log_entry.get("reverted"):
        raise HTTPException(status_code=400, detail="Already reverted")

    collection_name = log_entry.get("collection_name")
    document_id = log_entry.get("document_id")
    document_query = log_entry.get("document_query")
    if not collection_name:
        raise HTTPException(status_code=400, detail="Missing collection info")
    if not document_id and not document_query:
        raise HTTPException(status_code=400, detail="Missing document identifier")

    collection = db[collection_name]
    # Build query to find the document
    query = document_query if document_query else {"id": document_id}
    current_doc = await collection.find_one(query, {"_id": 0})

    before = log_entry["before_state"]

    if current_doc:
        # Document exists — update it back to before_state
        await collection.update_one(query, {"$set": before})
    else:
        # Document was deleted — re-insert it
        await collection.insert_one({**before})

    # Mark as reverted
    await db.action_logs.update_one({"id": log_id}, {"$set": {"reverted": True, "reverted_at": datetime.now(timezone.utc).isoformat()}})

    # Log the revert action itself
    await log_action(
        action=f"Откат: {log_entry.get('action', 'unknown')}",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="POST",
        path=f"/admin/action-logs/{log_id}/revert",
        details={"reverted_log_id": log_id},
        before_state=current_doc,
        after_state=before,
        collection_name=collection_name,
        document_id=document_id,
        document_query=document_query,
    )

    return {"success": True, "message": "Изменение отменено"}


# ==================== RAW DATA EDITING ====================

ALLOWED_COLLECTIONS = ["users", "orders", "products", "categories", "individual_prices", "discount_requests", "product_requests", "site_settings", "settings"]

@router.get("/data/{collection_name}/{document_id}")
async def get_raw_document(collection_name: str, document_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if collection_name not in ALLOWED_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Collection not allowed. Allowed: {ALLOWED_COLLECTIONS}")

    collection = db[collection_name]
    doc = await collection.find_one({"id": document_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.put("/data/{collection_name}/{document_id}")
async def update_raw_document(collection_name: str, document_id: str, body: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if collection_name not in ALLOWED_COLLECTIONS:
        raise HTTPException(status_code=400, detail="Collection not allowed")

    collection = db[collection_name]
    current = await collection.find_one({"id": document_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove fields that shouldn't be changed
    body.pop("_id", None)
    body.pop("id", None)  # Prevent changing the document ID

    # Update the document
    await collection.update_one({"id": document_id}, {"$set": body})
    updated = await collection.find_one({"id": document_id}, {"_id": 0})

    # Log this change with before/after state
    await log_action(
        action=f"Редактирование данных: {collection_name}",
        user_id=user["id"],
        user_name=user.get("name", user.get("email")),
        user_role=user.get("role"),
        method="PUT",
        path=f"/admin/data/{collection_name}/{document_id}",
        details={"collection": collection_name, "document_id": document_id},
        before_state=current,
        after_state=updated,
        collection_name=collection_name,
        document_id=document_id,
    )

    return updated


@router.delete("/action-logs/clear")
async def clear_action_logs(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.action_logs.delete_many({})
    return {"deleted": result.deleted_count}
