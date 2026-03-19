"""Personal Files - private file storage for admin"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db, get_current_user
from cloudinary_service import upload_to_cloudinary, delete_from_cloudinary

router = APIRouter(prefix="/personal-files", tags=["personal-files"])

PERSONAL_FILES_PASSWORD = "GenSutSu.1999"


class PasswordCheck(BaseModel):
    password: str


class FolderCreate(BaseModel):
    name: str


class FolderRename(BaseModel):
    name: str


def _file_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("jpg", "jpeg", "png", "webp", "bmp", "svg", "heic", "heif"):
        return "image"
    if ext in ("gif",):
        return "gif"
    if ext in ("mp4", "mov", "avi", "webm", "mkv", "wmv", "m4v", "mpeg", "mpg"):
        return "video"
    return "other"


@router.post("/auth")
async def verify_password(body: PasswordCheck, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if body.password != PERSONAL_FILES_PASSWORD:
        raise HTTPException(status_code=401, detail="Неверный пароль")
    return {"success": True}


# ==================== FOLDERS ====================

@router.get("/folders")
async def list_folders(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    folders = await db.personal_folders.find({}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    # Count files per folder
    for f in folders:
        f["file_count"] = await db.personal_files.count_documents({"folder_id": f["id"]})
    return {"folders": folders}


@router.post("/folders")
async def create_folder(body: FolderCreate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    folder = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.personal_folders.insert_one(folder)
    return {"id": folder["id"], "name": folder["name"]}


@router.put("/folders/{folder_id}")
async def rename_folder(folder_id: str, body: FolderRename, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    result = await db.personal_folders.update_one(
        {"id": folder_id}, {"$set": {"name": body.name.strip()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Folder not found")
    return {"success": True}


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    # Delete all files in folder from Cloudinary
    files = await db.personal_files.find({"folder_id": folder_id}, {"_id": 0}).to_list(10000)
    for f in files:
        if f.get("public_id"):
            rt = "video" if f.get("file_type") == "video" else "image"
            await delete_from_cloudinary(f["public_id"], resource_type=rt)
    await db.personal_files.delete_many({"folder_id": folder_id})
    await db.personal_folders.delete_one({"id": folder_id})
    return {"success": True}


# ==================== FILES ====================

@router.get("/files")
async def list_files(
    folder_id: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(get_current_user)
):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    query = {}
    if folder_id:
        query["folder_id"] = folder_id
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    files = await db.personal_files.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    return {"files": files}


@router.post("/upload")
async def upload_personal_file(
    file: UploadFile = File(...),
    folder_id: str = Form(default=""),
    user=Depends(get_current_user)
):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    # Stream to temp file to avoid holding entire file in memory
    import tempfile, os, shutil
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1])
    try:
        total_size = 0
        max_size = 500 * 1024 * 1024  # 500MB
        while True:
            chunk = await file.read(1024 * 1024)  # 1MB chunks
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > max_size:
                tmp.close()
                os.unlink(tmp.name)
                raise HTTPException(status_code=413, detail="Файл слишком большой (макс. 500MB)")
            tmp.write(chunk)
        tmp.close()

        # Read back for Cloudinary upload
        with open(tmp.name, 'rb') as f:
            content = f.read()

        ft = _file_type(file.filename)
        result = await upload_to_cloudinary(content, file.filename, folder="personal")

        file_doc = {
            "id": str(uuid.uuid4()),
            "folder_id": folder_id or None,
            "name": file.filename,
            "url": result["url"],
            "public_id": result.get("public_id"),
            "file_type": ft,
            "size": total_size,
            "width": result.get("width"),
            "height": result.get("height"),
            "duration": result.get("duration"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.personal_files.insert_one(file_doc)
        file_doc.pop("_id", None)
        return file_doc
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


@router.delete("/files/{file_id}")
async def delete_personal_file(file_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    f = await db.personal_files.find_one({"id": file_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if f.get("public_id"):
        rt = "video" if f.get("file_type") == "video" else "image"
        await delete_from_cloudinary(f["public_id"], resource_type=rt)
    await db.personal_files.delete_one({"id": file_id})
    return {"success": True}
