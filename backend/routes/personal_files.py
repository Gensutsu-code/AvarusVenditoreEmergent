"""Personal Files - private file storage for admin"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import os

from database import db, get_current_user
from cloudinary_service import upload_to_cloudinary, delete_from_cloudinary

router = APIRouter(prefix="/personal-files", tags=["personal-files"])

PERSONAL_FILES_PASSWORD = "GenSutSu.1999"
LOCAL_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "personal")
CLOUDINARY_LIMIT = 90 * 1024 * 1024  # 90MB


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
    # Delete all files in folder
    files = await db.personal_files.find({"folder_id": folder_id}, {"_id": 0}).to_list(10000)
    for f in files:
        if f.get("storage") == "local" and f.get("local_filename"):
            path = os.path.join(LOCAL_UPLOAD_DIR, f["local_filename"])
            try:
                os.unlink(path)
            except OSError:
                pass
        elif f.get("public_id"):
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

    # Stream to temp file
    import tempfile, shutil
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or ".bin")[1])
    try:
        total_size = 0
        max_size = 500 * 1024 * 1024  # 500MB
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > max_size:
                tmp.close()
                os.unlink(tmp.name)
                raise HTTPException(status_code=413, detail="Файл слишком большой (макс. 500MB)")
            tmp.write(chunk)
        tmp.close()

        ft = _file_type(file.filename)

        if total_size <= CLOUDINARY_LIMIT:
            # Small file → Cloudinary
            with open(tmp.name, 'rb') as f:
                content = f.read()
            result = await upload_to_cloudinary(content, file.filename, folder="personal")
            file_url = result["url"]
            public_id = result.get("public_id")
            storage = "cloudinary"
            width = result.get("width")
            height = result.get("height")
            duration = result.get("duration")
        else:
            # Large file → local storage
            os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)
            local_id = str(uuid.uuid4())
            ext = os.path.splitext(file.filename or "")[1]
            local_filename = f"{local_id}{ext}"
            local_path = os.path.join(LOCAL_UPLOAD_DIR, local_filename)
            shutil.move(tmp.name, local_path)
            tmp = None  # Prevent cleanup
            file_url = f"/api/personal-files/serve/{local_filename}"
            public_id = None
            storage = "local"
            width = None
            height = None
            duration = None

        file_doc = {
            "id": str(uuid.uuid4()),
            "folder_id": folder_id or None,
            "name": file.filename,
            "url": file_url,
            "public_id": public_id,
            "storage": storage,
            "local_filename": local_filename if storage == "local" else None,
            "file_type": ft,
            "size": total_size,
            "width": width,
            "height": height,
            "duration": duration,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.personal_files.insert_one(file_doc)
        file_doc.pop("_id", None)
        return file_doc
    finally:
        if tmp is not None:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass


@router.get("/serve/{filename}")
async def serve_local_file(filename: str, token: Optional[str] = None, request: Optional[object] = None):
    """Serve locally stored large files. Accepts token via query param or Authorization header."""
    import jwt
    from database import JWT_SECRET, JWT_ALGORITHM, db as database

    # Try Authorization header first, then query param
    auth_token = token
    from fastapi import Request
    # We handle auth manually here since <img>/<video> can't send headers
    if not auth_token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        payload = jwt.decode(auth_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        u = await database.users.find_one({"id": user_id}, {"_id": 0, "role": 1})
        if not u or u.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    safe_name = os.path.basename(filename)
    filepath = os.path.join(LOCAL_UPLOAD_DIR, safe_name)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath, media_type=None)


@router.delete("/files/{file_id}")
async def delete_personal_file(file_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    f = await db.personal_files.find_one({"id": file_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if f.get("storage") == "local" and f.get("local_filename"):
        path = os.path.join(LOCAL_UPLOAD_DIR, f["local_filename"])
        try:
            os.unlink(path)
        except OSError:
            pass
    elif f.get("public_id"):
        rt = "video" if f.get("file_type") == "video" else "image"
        await delete_from_cloudinary(f["public_id"], resource_type=rt)
    await db.personal_files.delete_one({"id": file_id})
    return {"success": True}
