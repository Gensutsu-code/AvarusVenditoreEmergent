"""File upload routes"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
import logging

from database import db, get_current_user
from cloudinary_service import upload_to_cloudinary

router = APIRouter(tags=["uploads"])

BLOCKED_EXTENSIONS = (".html", ".htm", ".xhtml", ".svg", ".js", ".mjs", ".php", ".exe", ".bat", ".cmd", ".sh", ".msi", ".jar", ".apk", ".scr")


def ensure_safe_upload(filename: str):
    if (filename or "").lower().strip().endswith(BLOCKED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Этот тип файла загружать нельзя")

logger = logging.getLogger(__name__)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload file to Cloudinary"""
    ensure_safe_upload(file.filename)
    content = await file.read()
    
    if len(content) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")
    
    try:
        result = await upload_to_cloudinary(content, file.filename, folder="uploads")
        if result and result.get("url"):
            return {
                "url": result["url"],
                "public_id": result.get("public_id"),
                "filename": file.filename
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to upload to Cloudinary")
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки: {str(e)}")


@router.post("/users/avatar")
async def upload_avatar(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload user profile avatar"""
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    
    try:
        result = await upload_to_cloudinary(content, file.filename, folder="avatars")
        if result and result.get("url"):
            avatar_url = result["url"]
        else:
            raise HTTPException(status_code=500, detail="Failed to upload avatar")
    except Exception as e:
        logger.error(f"Avatar upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"avatar_url": avatar_url}}
    )
    
    return {"avatar_url": avatar_url}


@router.delete("/users/avatar")
async def delete_avatar(user=Depends(get_current_user)):
    """Delete user profile avatar"""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"avatar_url": ""}}
    )
    return {"message": "Avatar deleted"}
