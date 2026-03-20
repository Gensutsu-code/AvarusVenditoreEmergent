"""Personal Files - private file storage for admin"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
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
SPRITES_DIR = os.path.join(LOCAL_UPLOAD_DIR, "sprites")
SPRITE_INTERVAL = 5  # seconds between thumbnail frames
SPRITE_THUMB_W = 160
SPRITE_THUMB_H = 90
SPRITE_COLS = 10


class PasswordCheck(BaseModel):
    password: str


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None


class FolderRename(BaseModel):
    name: str


class TagsUpdate(BaseModel):
    tags: List[str]


class BulkMove(BaseModel):
    file_ids: List[str]
    folder_id: Optional[str] = None


class BulkTags(BaseModel):
    file_ids: List[str]
    tags: List[str]


class BulkDelete(BaseModel):
    file_ids: List[str]


def _file_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("jpg", "jpeg", "png", "webp", "bmp", "svg", "heic", "heif"):
        return "image"
    if ext in ("gif",):
        return "gif"
    if ext in ("mp4", "mov", "avi", "webm", "mkv", "wmv", "m4v", "mpeg", "mpg"):
        return "video"
    return "other"


def _video_quality_label(height):
    if not height:
        return None
    if height >= 2160:
        return "4K"
    if height >= 1440:
        return "2K"
    if height >= 1080:
        return "1080p"
    if height >= 720:
        return "720p"
    if height >= 480:
        return "480p"
    if height >= 360:
        return "360p"
    return f"{height}p"


def _probe_video(filepath):
    """Extract video resolution and duration using pymediainfo"""
    try:
        from pymediainfo import MediaInfo
        info = MediaInfo.parse(filepath)
        for track in info.tracks:
            if track.track_type == "Video":
                w = track.width
                h = track.height
                dur = track.duration / 1000 if track.duration else None
                return {
                    "width": w,
                    "height": h,
                    "duration": dur,
                    "quality": _video_quality_label(h),
                }
        # Fallback: get duration from General track
        for track in info.tracks:
            if track.track_type == "General" and track.duration:
                return {"width": None, "height": None, "duration": track.duration / 1000, "quality": None}
    except Exception:
        pass
    return {"width": None, "height": None, "duration": None, "quality": None}


async def _generate_sprite(file_id: str, video_path: str, duration: float, cleanup_path: str = None):
    """Background task: generate sprite sheet + VTT for a video.
    If cleanup_path is set, delete that file after sprite generation (used for Cloudinary temp files)."""
    import asyncio
    import math

    try:
        os.makedirs(SPRITES_DIR, exist_ok=True)
        tmp_dir = os.path.join(SPRITES_DIR, f"tmp_{file_id}")
        os.makedirs(tmp_dir, exist_ok=True)

        # 1. Extract thumbnails every N seconds
        cmd = [
            "ffmpeg", "-i", video_path,
            "-vf", f"fps=1/{SPRITE_INTERVAL},scale={SPRITE_THUMB_W}:{SPRITE_THUMB_H}",
            "-q:v", "5",
            os.path.join(tmp_dir, "thumb_%04d.jpg"),
            "-y"
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
        )
        await proc.wait()

        # 2. Collect generated thumbnails
        thumbs = sorted([f for f in os.listdir(tmp_dir) if f.startswith("thumb_")])
        if not thumbs:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            if cleanup_path:
                try: os.unlink(cleanup_path)
                except OSError: pass
            return

        num_frames = len(thumbs)
        cols = min(SPRITE_COLS, num_frames)
        rows = math.ceil(num_frames / cols)

        # 3. Assemble sprite sheet with ffmpeg
        sprite_path = os.path.join(SPRITES_DIR, f"{file_id}.jpg")
        tile_cmd = [
            "ffmpeg",
            "-pattern_type", "glob",
            "-i", os.path.join(tmp_dir, "thumb_*.jpg"),
            "-vf", f"tile={cols}x{rows}",
            "-q:v", "5",
            sprite_path,
            "-y"
        ]
        proc = await asyncio.create_subprocess_exec(
            *tile_cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
        )
        await proc.wait()

        # 4. Generate VTT file
        vtt_path = os.path.join(SPRITES_DIR, f"{file_id}.vtt")
        vtt_lines = ["WEBVTT\n"]
        for i in range(num_frames):
            start_sec = i * SPRITE_INTERVAL
            end_sec = min((i + 1) * SPRITE_INTERVAL, duration)
            col = i % cols
            row = i // cols
            x = col * SPRITE_THUMB_W
            y = row * SPRITE_THUMB_H

            def fmt(s):
                h = int(s // 3600)
                m = int((s % 3600) // 60)
                sec = int(s % 60)
                ms = int((s % 1) * 1000)
                return f"{h:02d}:{m:02d}:{sec:02d}.{ms:03d}"

            vtt_lines.append(f"{fmt(start_sec)} --> {fmt(end_sec)}")
            vtt_lines.append(f"sprite.jpg#xywh={x},{y},{SPRITE_THUMB_W},{SPRITE_THUMB_H}\n")

        with open(vtt_path, 'w') as f:
            f.write("\n".join(vtt_lines))

        # 5. Update DB
        await db.personal_files.update_one(
            {"id": file_id},
            {"$set": {"sprite_ready": True, "sprite_cols": cols, "sprite_rows": rows}}
        )

        # Cleanup temp thumbnails
        shutil.rmtree(tmp_dir, ignore_errors=True)
    except Exception as e:
        shutil.rmtree(os.path.join(SPRITES_DIR, f"tmp_{file_id}"), ignore_errors=True)
        import logging
        logging.getLogger("server").error(f"Sprite generation failed for {file_id}: {e}")
    finally:
        # Delete the temp video file if requested (Cloudinary uploads)
        if cleanup_path:
            try: os.unlink(cleanup_path)
            except OSError: pass


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
    tag: Optional[str] = None,
    user=Depends(get_current_user)
):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    query = {}
    if folder_id:
        query["folder_id"] = folder_id
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}}
        ]
    if file_type and file_type != "all":
        if file_type == "photo":
            query["file_type"] = "image"
        elif file_type == "gif":
            query["file_type"] = "gif"
        elif file_type == "video":
            query["file_type"] = "video"
    if tag:
        query["tags"] = tag
    files = await db.personal_files.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    return {"files": files}


@router.get("/tags")
async def list_all_tags(user=Depends(get_current_user)):
    """Get all unique tags across all files"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    pipeline = [
        {"$match": {"tags": {"$exists": True, "$ne": []}}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 200}
    ]
    results = await db.personal_files.aggregate(pipeline).to_list(200)
    return {"tags": [{"name": r["_id"], "count": r["count"]} for r in results]}


# ==================== BULK OPERATIONS ====================
# (must be before /files/{file_id} routes to avoid path conflicts)

@router.put("/files/bulk/move")
async def bulk_move_files(body: BulkMove, user=Depends(get_current_user)):
    """Move multiple files to a different folder"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if body.folder_id:
        folder = await db.personal_folders.find_one({"id": body.folder_id})
        if not folder:
            raise HTTPException(status_code=404, detail="Target folder not found")
    result = await db.personal_files.update_many(
        {"id": {"$in": body.file_ids}},
        {"$set": {"folder_id": body.folder_id}}
    )
    return {"moved": result.modified_count}


@router.put("/files/bulk/tags")
async def bulk_add_tags(body: BulkTags, user=Depends(get_current_user)):
    """Add tags to multiple files (merges with existing)"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    new_tags = [t.strip().lower() for t in body.tags if t.strip()]
    if not new_tags:
        return {"updated": 0}
    files = await db.personal_files.find(
        {"id": {"$in": body.file_ids}}, {"_id": 0, "id": 1, "tags": 1}
    ).to_list(10000)
    count = 0
    for f in files:
        existing = f.get("tags") or []
        merged = list(dict.fromkeys(existing + new_tags))
        await db.personal_files.update_one({"id": f["id"]}, {"$set": {"tags": merged}})
        count += 1
    return {"updated": count}


@router.delete("/files/bulk")
async def bulk_delete_files(body: BulkDelete, user=Depends(get_current_user)):
    """Delete multiple files"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    files = await db.personal_files.find(
        {"id": {"$in": body.file_ids}}, {"_id": 0}
    ).to_list(10000)
    for f in files:
        if f.get("storage") == "local" and f.get("local_filename"):
            try:
                os.unlink(os.path.join(LOCAL_UPLOAD_DIR, f["local_filename"]))
            except OSError:
                pass
        elif f.get("public_id"):
            rt = "video" if f.get("file_type") == "video" else "image"
            await delete_from_cloudinary(f["public_id"], resource_type=rt)
        for ext in (".jpg", ".vtt"):
            try:
                os.unlink(os.path.join(SPRITES_DIR, f"{f['id']}{ext}"))
            except OSError:
                pass
    result = await db.personal_files.delete_many({"id": {"$in": body.file_ids}})
    return {"deleted": result.deleted_count}


# ==================== SINGLE FILE OPERATIONS ====================

@router.put("/files/{file_id}/tags")
async def update_file_tags(file_id: str, body: TagsUpdate, user=Depends(get_current_user)):
    """Set tags for a file"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    clean_tags = list(dict.fromkeys(t.strip().lower() for t in body.tags if t.strip()))
    result = await db.personal_files.update_one(
        {"id": file_id},
        {"$set": {"tags": clean_tags}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    return {"tags": clean_tags}


@router.get("/files/{file_id}/similar")
async def get_similar_files(file_id: str, limit: int = 10, user=Depends(get_current_user)):
    """Get files with similar tags"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    file = await db.personal_files.find_one({"id": file_id}, {"_id": 0})
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    tags = file.get("tags") or []
    if not tags:
        return {"files": []}
    similar = await db.personal_files.find(
        {"tags": {"$in": tags}, "id": {"$ne": file_id}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    # Sort by number of matching tags
    for s in similar:
        s["_match_count"] = len(set(s.get("tags", [])) & set(tags))
    similar.sort(key=lambda x: x["_match_count"], reverse=True)
    for s in similar:
        s.pop("_match_count", None)
    return {"files": similar}


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


@router.delete("/upload/{upload_id}")
async def cancel_chunked_upload(upload_id: str, user=Depends(get_current_user)):
    """Cancel and cleanup a chunked upload session"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    chunk_dir = os.path.join(CHUNK_DIR, upload_id)
    shutil.rmtree(chunk_dir, ignore_errors=True)
    await db.upload_sessions.delete_one({"id": upload_id})
    return {"success": True}


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

    # Probe video metadata BEFORE any upload/move (file is at final_path)
    vinfo = _probe_video(final_path) if ft == "video" else {}

    # Small files go to Cloudinary, large stay local
    if total_size <= CLOUDINARY_LIMIT:
        with open(final_path, 'rb') as f:
            content = f.read()
        result = await upload_to_cloudinary(content, filename, folder="personal")
        # DON'T delete final_path yet if it's a video — sprite task needs it
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
            "width": result.get("width") or vinfo.get("width"),
            "height": result.get("height") or vinfo.get("height"),
            "duration": result.get("duration") or vinfo.get("duration"),
            "quality": _video_quality_label(result.get("height") or vinfo.get("height")) if ft == "video" else None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        # For non-video files, delete temp immediately
        if ft != "video":
            try: os.unlink(final_path)
            except OSError: pass
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
            "width": vinfo.get("width"),
            "height": vinfo.get("height"),
            "duration": vinfo.get("duration"),
            "quality": vinfo.get("quality"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    await db.personal_files.insert_one(file_doc)
    file_doc.pop("_id", None)

    # Start sprite generation for ALL video files
    duration = file_doc.get("duration") or vinfo.get("duration")
    if ft == "video" and duration and os.path.isfile(final_path):
        import asyncio
        # For Cloudinary: pass cleanup_path so temp file is deleted after sprites are done
        # For local: no cleanup needed, file is permanent
        cleanup = final_path if file_doc.get("storage") == "cloudinary" else None
        asyncio.create_task(_generate_sprite(file_doc["id"], final_path, duration, cleanup_path=cleanup))

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

    # For videos, write to temp file for probing + sprite generation
    temp_path = None
    vinfo = {}
    if ft == "video":
        os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)
        ext = os.path.splitext(file.filename or "")[1]
        temp_filename = f"tmp_{uuid.uuid4()}{ext}"
        temp_path = os.path.join(LOCAL_UPLOAD_DIR, temp_filename)
        with open(temp_path, 'wb') as f:
            f.write(content)
        vinfo = _probe_video(temp_path)

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
        "width": result.get("width") or vinfo.get("width"),
        "height": result.get("height") or vinfo.get("height"),
        "duration": result.get("duration") or vinfo.get("duration"),
        "quality": _video_quality_label(result.get("height") or vinfo.get("height")) if ft == "video" else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.personal_files.insert_one(file_doc)
    file_doc.pop("_id", None)

    # Start sprite generation for videos
    duration = file_doc.get("duration") or vinfo.get("duration")
    if ft == "video" and duration and temp_path and os.path.isfile(temp_path):
        import asyncio
        asyncio.create_task(_generate_sprite(file_doc["id"], temp_path, duration, cleanup_path=temp_path))
    elif temp_path:
        # No duration detected, clean up temp
        try: os.unlink(temp_path)
        except OSError: pass

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


# ==================== SPRITE SERVING ====================

@router.get("/sprites/{file_id}/sprite.jpg")
async def serve_sprite_image(file_id: str, token: Optional[str] = None):
    """Serve the sprite sheet image"""
    import jwt
    from database import JWT_SECRET, JWT_ALGORITHM, db as database
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload.get("user_id")
        u = await database.users.find_one({"id": uid}, {"_id": 0, "role": 1})
        if not u or u.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    path = os.path.join(SPRITES_DIR, f"{file_id}.jpg")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Sprite not ready")
    return FileResponse(path, media_type="image/jpeg")


@router.get("/sprites/{file_id}/thumbs.vtt")
async def serve_sprite_vtt(file_id: str, token: Optional[str] = None):
    """Serve the VTT file with sprite coordinates"""
    import jwt
    from database import JWT_SECRET, JWT_ALGORITHM, db as database
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload.get("user_id")
        u = await database.users.find_one({"id": uid}, {"_id": 0, "role": 1})
        if not u or u.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    path = os.path.join(SPRITES_DIR, f"{file_id}.vtt")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="VTT not ready")
    return FileResponse(path, media_type="text/vtt")


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
    # Clean sprite files
    for ext in (".jpg", ".vtt"):
        try:
            os.unlink(os.path.join(SPRITES_DIR, f"{file_id}{ext}"))
        except OSError:
            pass
    return {"success": True}
