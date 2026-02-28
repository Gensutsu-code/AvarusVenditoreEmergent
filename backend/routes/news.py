"""News routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from database import db, get_current_user
from models import NewsArticle
from notify import notify_all_users

router = APIRouter(tags=["news"])


@router.get("/news")
async def get_news():
    """Get published news"""
    news = await db.news.find({"published": True}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return news


@router.get("/news/{news_id}")
async def get_news_article(news_id: str):
    article = await db.news.find_one({"id": news_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return article


@router.get("/admin/news")
async def get_admin_news(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await db.news.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.post("/admin/news")
async def create_news(data: NewsArticle, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    article = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "content": data.content,
        "image_url": data.image_url,
        "published": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.news.insert_one(article)
    
    # Notify all users about new article
    await notify_all_users("news", "Новая публикация", f"{data.title}", f"/news/{article['id']}")
    
    return {k: v for k, v in article.items() if k != "_id"}


@router.put("/admin/news/{news_id}")
async def update_news(news_id: str, data: NewsArticle, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    await db.news.update_one({"id": news_id}, {"$set": {
        "title": data.title, "content": data.content, "image_url": data.image_url
    }})
    return {"success": True}


@router.delete("/admin/news/{news_id}")
async def delete_news(news_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    await db.news.delete_one({"id": news_id})
    return {"success": True}
