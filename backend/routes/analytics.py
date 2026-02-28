"""User analytics tracking endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
from database import db, get_current_user
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()


class TrackEvent(BaseModel):
    event_type: str  # page_view, search, button_click, page_leave
    page: Optional[str] = None
    duration: Optional[int] = None  # seconds on page
    query: Optional[str] = None  # search query
    element: Optional[str] = None  # button/element clicked
    meta: Optional[dict] = None


class TrackBatch(BaseModel):
    events: List[TrackEvent]


@router.post("/track")
async def track_events(batch: TrackBatch, request: Request, user=Depends(get_current_user)):
    """Track user activity events"""
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for event in batch.events:
        docs.append({
            "user_id": user["id"],
            "event_type": event.event_type,
            "page": event.page,
            "duration": event.duration,
            "query": event.query,
            "element": event.element,
            "meta": event.meta or {},
            "created_at": now
        })
    if docs:
        await db.user_analytics.insert_many(docs)
    return {"tracked": len(docs)}


@router.get("/admin/users/{user_id}/analytics")
async def get_user_analytics(user_id: str, user=Depends(get_current_user)):
    """Get analytics for a specific user (admin only)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Page views - grouped by page
    pipeline_pages = [
        {"$match": {"user_id": user_id, "event_type": "page_view"}},
        {"$group": {
            "_id": "$page",
            "visits": {"$sum": 1},
            "total_duration": {"$sum": {"$ifNull": ["$duration", 0]}},
            "last_visit": {"$max": "$created_at"}
        }},
        {"$sort": {"visits": -1}},
        {"$limit": 30}
    ]
    pages = await db.user_analytics.aggregate(pipeline_pages).to_list(30)
    page_stats = [
        {
            "page": p["_id"],
            "visits": p["visits"],
            "total_duration": p["total_duration"],
            "avg_duration": round(p["total_duration"] / p["visits"]) if p["visits"] else 0,
            "last_visit": p["last_visit"]
        }
        for p in pages
    ]

    # Search queries
    pipeline_search = [
        {"$match": {"user_id": user_id, "event_type": "search"}},
        {"$group": {
            "_id": "$query",
            "count": {"$sum": 1},
            "last_searched": {"$max": "$created_at"}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 50}
    ]
    searches = await db.user_analytics.aggregate(pipeline_search).to_list(50)
    search_stats = [
        {"query": s["_id"], "count": s["count"], "last_searched": s["last_searched"]}
        for s in searches
    ]

    # Button clicks
    pipeline_clicks = [
        {"$match": {"user_id": user_id, "event_type": "button_click"}},
        {"$group": {
            "_id": {"element": "$element", "page": "$page"},
            "count": {"$sum": 1},
            "last_click": {"$max": "$created_at"}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 50}
    ]
    clicks = await db.user_analytics.aggregate(pipeline_clicks).to_list(50)
    click_stats = [
        {"element": c["_id"]["element"], "page": c["_id"]["page"], "count": c["count"], "last_click": c["last_click"]}
        for c in clicks
    ]

    # Recent activity (last 50 events)
    recent = await db.user_analytics.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)

    # Summary stats
    total_events = await db.user_analytics.count_documents({"user_id": user_id})
    total_pages = await db.user_analytics.count_documents({"user_id": user_id, "event_type": "page_view"})
    total_searches = await db.user_analytics.count_documents({"user_id": user_id, "event_type": "search"})
    total_clicks = await db.user_analytics.count_documents({"user_id": user_id, "event_type": "button_click"})

    total_time_result = await db.user_analytics.aggregate([
        {"$match": {"user_id": user_id, "event_type": "page_view", "duration": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$duration"}}}
    ]).to_list(1)
    total_time = total_time_result[0]["total"] if total_time_result else 0

    return {
        "summary": {
            "total_events": total_events,
            "total_page_views": total_pages,
            "total_searches": total_searches,
            "total_clicks": total_clicks,
            "total_time_seconds": total_time
        },
        "pages": page_stats,
        "searches": search_stats,
        "clicks": click_stats,
        "recent_activity": recent
    }
