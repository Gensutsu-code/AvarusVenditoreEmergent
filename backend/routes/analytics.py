"""User analytics tracking endpoints"""
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
from database import db, get_current_user
from pydantic import BaseModel
from typing import Optional, List
import aiohttp
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# GeoIP cache to avoid repeated API calls
_geo_cache = {}


class TrackEvent(BaseModel):
    event_type: str
    page: Optional[str] = None
    duration: Optional[int] = None
    query: Optional[str] = None
    element: Optional[str] = None
    meta: Optional[dict] = None


class TrackBatch(BaseModel):
    events: List[TrackEvent]
    fingerprint: Optional[dict] = None  # browser fingerprint data


async def resolve_geo(ip: str) -> dict:
    """Resolve IP to geo data using ip-api.com (free, no key needed)"""
    if not ip or ip in ("127.0.0.1", "localhost", "unknown"):
        return {}
    if ip in _geo_cache:
        return _geo_cache[ip]
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as", timeout=aiohttp.ClientTimeout(total=3)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("status") == "success":
                        geo = {
                            "country": data.get("country", ""),
                            "country_code": data.get("countryCode", ""),
                            "region": data.get("regionName", ""),
                            "city": data.get("city", ""),
                            "zip": data.get("zip", ""),
                            "lat": data.get("lat"),
                            "lon": data.get("lon"),
                            "timezone": data.get("timezone", ""),
                            "isp": data.get("isp", ""),
                            "org": data.get("org", ""),
                        }
                        _geo_cache[ip] = geo
                        return geo
    except Exception as e:
        logger.warning(f"GeoIP resolve failed for {ip}: {e}")
    return {}


@router.post("/track")
async def track_events(batch: TrackBatch, request: Request, user=Depends(get_current_user)):
    """Track user activity events with browser fingerprint"""
    now = datetime.now(timezone.utc).isoformat()
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "unknown")

    # Save/update browser fingerprint if provided
    if batch.fingerprint:
        geo = await resolve_geo(ip)
        session_data = {
            "user_id": user["id"],
            "ip": ip,
            "geo": geo,
            "user_agent": batch.fingerprint.get("user_agent", ""),
            "browser": batch.fingerprint.get("browser", ""),
            "browser_version": batch.fingerprint.get("browser_version", ""),
            "os": batch.fingerprint.get("os", ""),
            "os_version": batch.fingerprint.get("os_version", ""),
            "device": batch.fingerprint.get("device", ""),
            "screen_resolution": batch.fingerprint.get("screen_resolution", ""),
            "viewport": batch.fingerprint.get("viewport", ""),
            "language": batch.fingerprint.get("language", ""),
            "languages": batch.fingerprint.get("languages", []),
            "timezone": batch.fingerprint.get("timezone", ""),
            "timezone_offset": batch.fingerprint.get("timezone_offset", 0),
            "platform": batch.fingerprint.get("platform", ""),
            "cookie_enabled": batch.fingerprint.get("cookie_enabled", True),
            "do_not_track": batch.fingerprint.get("do_not_track", False),
            "online": batch.fingerprint.get("online", True),
            "connection_type": batch.fingerprint.get("connection_type", ""),
            "memory": batch.fingerprint.get("memory", 0),
            "cores": batch.fingerprint.get("cores", 0),
            "touch_support": batch.fingerprint.get("touch_support", False),
            "referer": batch.fingerprint.get("referer", ""),
            "last_seen": now,
        }
        # Upsert: update existing session or create new
        await db.user_sessions.update_one(
            {"user_id": user["id"], "ip": ip, "user_agent": session_data["user_agent"]},
            {"$set": session_data, "$inc": {"visit_count": 1}, "$setOnInsert": {"first_seen": now}},
            upsert=True
        )
        # Update user's last known data
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "last_ip": ip,
                "last_geo": geo,
                "last_browser": session_data["browser"],
                "last_os": session_data["os"],
                "last_device": session_data["device"],
                "last_seen": now,
            }}
        )

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
            "ip": ip,
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

    # Recent activity
    recent = await db.user_analytics.find(
        {"user_id": user_id}, {"_id": 0}
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

    # User sessions (browser/device data)
    sessions = await db.user_sessions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("last_seen", -1).limit(20).to_list(20)

    # User basic info for context
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})

    return {
        "user": target_user,
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
        "recent_activity": recent,
        "sessions": sessions,
    }
