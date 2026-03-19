"""Personal Files - private file storage for admin"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import os
import shutil
import tempfile

from database import db, get_current_user
from cloudinary_service import upload_to_cloudinary, delete_from_cloudinary

router = APIRouter(prefix="/personal-files", tags=["personal-files"])

PERSONAL_FILES_PASSWORD = "GenSutSu.1999"
LOCAL_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "personal")
CLOUDINARY_LIMIT = 90 * 1024 * 1024  # 90MB
CHUNK_DIR = os.path.join(LOCAL_UPLOAD_DIR, "chunks")


class PasswordCheck(BaseModel):
    password: str


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None


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
async def list_folders(parent_id: Optional[str] = None, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    query = {"parent_id": parent_id}
    folders = await db.personal_folders.find(query, {"_id": 0}).sort("created_at", 1).to_list(1000)
    for f in folders:
        f["file_count"] = await db.personal_files.count_documents({"folder_id": f["id"]})
        f["subfolder_count"] = await db.personal_folders.count_documents({"parent_id": f["id"]})
    return {"folders": folders}


@router.get("/folders/{folder_id}/breadcrumb")
async def get_breadcrumb(folder_id: str, user=Depends(get_current_user)):
    """Get breadcrumb path from root to this folder"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    crumbs = []
    current = folder_id
    for _ in range(20):  # safety limit
        folder = await db.personal_folders.find_one({"id": current}, {"_id": 0})
        if not folder:
            break
        crumbs.insert(0, {"id": folder["id"], "name": folder["name"]})
        current = folder.get("parent_id")
        if not current:
            break
    return {"breadcrumbs": crumbs}


@router.post("/folders")
async def create_folder(body: FolderCreate, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if body.parent_id:
        parent = await db.personal_folders.find_one({"id": body.parent_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")
    folder = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "parent_id": body.parent_id,
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

    # Recursively collect all subfolder ids
    async def collect_ids(fid):
        ids = [fid]
        subs = await db.personal_folders.find({"parent_id": fid}, {"_id": 0, "id": 1}).to_list(1000)
        for s in subs:
            ids.extend(await collect_ids(s["id"]))
        return ids

    all_folder_ids = await collect_ids(folder_id)

    # Delete all files in all folders
    files = await db.personal_files.find({"folder_id": {"$in": all_folder_ids}}, {"_id": 0}).to_list(10000)
    for f in files:
        if f.get("storage") == "local" and f.get("local_filename"):
            try:
                os.unlink(os.path.join(LOCAL_UPLOAD_DIR, f["local_filename"]))
            except OSError:
                pass
        elif f.get("public_id"):
            rt = "video" if f.get("file_type") == "video" else "image"
            await delete_from_cloudinary(f["public_id"], resource_type=rt)
    await db.personal_files.delete_many({"folder_id": {"$in": all_folder_ids}})
    await db.personal_folders.delete_many({"id": {"$in": all_folder_ids}})
    return {"success": True}


# ==================== FILES ====================

@router.get("/files")
async def list_files(
    folder_id: Optional[str] = None,
    search: Optional[str] = None,
    file_type: Optional[str] = None,
    user=Depends(get_current_user)
):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    query = {}
    if folder_id:
        query["folder_id"] = folder_id
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    if file_type and file_type != "all":
        if file_type == "photo":
            query["file_type"] = "image"
        elif file_type == "gif":
            query["file_type"] = "gif"
        elif file_type == "video":
            query["file_type"] = "video"
    files = await db.personal_files.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    return {"files": files}


# ==================== CHUNKED UPLOAD ====================

@router.post("/upload/init")
async def init_chunked_upload(
    filename: str = Form(...),
    total_size: int = Form(...),
    folder_id: str = Form(default=""),
    user=Depends(get_current_user)
):
    """Initialize a chunked upload session"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if total_size > 500 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Файл слишком большой (макс. 500MB)")
    upload_id = str(uuid.uuid4())
    os.makedirs(os.path.join(CHUNK_DIR, upload_id), exist_ok=True)
    await db.upload_sessions.insert_one({
        "id": upload_id,
        "filename": filename,
        "folder_id": folder_id or None,
        "total_size": total_size,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"upload_id": upload_id}


@router.post("/upload/chunk")
async def upload_chunk(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    """Upload a single chunk"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    session = await db.upload_sessions.find_one({"id": upload_id})
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    chunk_path = os.path.join(CHUNK_DIR, upload_id, f"{chunk_index:05d}")
    content = await file.read()
    with open(chunk_path, 'wb') as f:
        f.write(content)
    return {"success": True, "chunk_index": chunk_index}


@router.post("/upload/complete")
async def complete_chunked_upload(
    upload_id: str = Form(...),
    user=Depends(get_current_user)
):
    """Assemble chunks into final file"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    session = await db.upload_sessions.find_one({"id": upload_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")

    chunk_dir = os.path.join(CHUNK_DIR, upload_id)
    filename = session["filename"]
    ft = _file_type(filename)
    ext = os.path.splitext(filename or "")[1]
    final_id = str(uuid.uuid4())
    final_filename = f"{final_id}{ext}"
    os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)
    final_path = os.path.join(LOCAL_UPLOAD_DIR, final_filename)

    # Assemble chunks in order
    chunks = sorted(os.listdir(chunk_dir))
    total_size = 0
    with open(final_path, 'wb') as out:
        for c in chunks:
            cp = os.path.join(chunk_dir, c)
            with open(cp, 'rb') as inp:
                data = inp.read()
                out.write(data)
                total_size += len(data)

    # Cleanup chunks
    shutil.rmtree(chunk_dir, ignore_errors=True)
    await db.upload_sessions.delete_one({"id": upload_id})

    # Small files go to Cloudinary, large stay local
    if total_size <= CLOUDINARY_LIMIT:
        with open(final_path, 'rb') as f:
            content = f.read()
        result = await upload_to_cloudinary(content, filename, folder="personal")
        os.unlink(final_path)
        file_doc = {
            "id": str(uuid.uuid4()),
            "folder_id": session.get("folder_id"),
            "name": filename,
            "url": result["url"],
            "public_id": result.get("public_id"),
            "storage": "cloudinary",
            "local_filename": None,
            "file_type": ft,
            "size": total_size,
            "width": result.get("width"),
            "height": result.get("height"),
            "duration": result.get("duration"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    else:
        file_doc = {
            "id": str(uuid.uuid4()),
            "folder_id": session.get("folder_id"),
            "name": filename,
            "url": f"/api/personal-files/serve/{final_filename}",
            "public_id": None,
            "storage": "local",
            "local_filename": final_filename,
            "file_type": ft,
            "size": total_size,
            "width": None,
            "height": None,
            "duration": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    await db.personal_files.insert_one(file_doc)
    file_doc.pop("_id", None)
    return file_doc


# ==================== SIMPLE UPLOAD (small files) ====================

@router.post("/upload")
async def upload_personal_file(
    file: UploadFile = File(...),
    folder_id: str = Form(default=""),
    user=Depends(get_current_user)
):
    """Simple single-request upload for files under proxy limit"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    content = await file.read()
    total_size = len(content)
    if total_size > CLOUDINARY_LIMIT:
        raise HTTPException(status_code=413, detail="Используйте чанковую загрузку для больших файлов")

    ft = _file_type(file.filename)
    result = await upload_to_cloudinary(content, file.filename, folder="personal")

    file_doc = {
        "id": str(uuid.uuid4()),
        "folder_id": folder_id or None,
        "name": file.filename,
        "url": result["url"],
        "public_id": result.get("public_id"),
        "storage": "cloudinary",
        "local_filename": None,
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


# ==================== SERVE LOCAL FILES ====================

@router.get("/serve/{filename}")
async def serve_local_file(filename: str, token: Optional[str] = None):
    """Serve locally stored large files. Token via query param."""
    import jwt
    from database import JWT_SECRET, JWT_ALGORITHM, db as database

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
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


# ==================== DELETE ====================

@router.delete("/files/{file_id}")
async def delete_personal_file(file_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    f = await db.personal_files.find_one({"id": file_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if f.get("storage") == "local" and f.get("local_filename"):
        try:
            os.unlink(os.path.join(LOCAL_UPLOAD_DIR, f["local_filename"]))
        except OSError:
            pass
    elif f.get("public_id"):
        rt = "video" if f.get("file_type") == "video" else "image"
        await delete_from_cloudinary(f["public_id"], resource_type=rt)
    await db.personal_files.delete_one({"id": file_id})
    return {"success": True}
