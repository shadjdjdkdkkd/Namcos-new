"""File upload routes — backed by Cloudinary (new uploads) with legacy object-storage read."""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Response, Query
from datetime import datetime, timezone
import uuid
import os
import logging

import cloudinary
import cloudinary.uploader

from database import db
from auth_utils import get_current_user, doc
from storage import get_bytes, ALLOWED_EXT

logger = logging.getLogger(__name__)
uploads_router = APIRouter(tags=["Uploads"])

MAX_SIZE = 8 * 1024 * 1024  # 8 MB per image

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True,
)


@uploads_router.post("/uploads")
async def upload_file(request: Request, file: UploadFile = File(...)):
    """Upload a single image to Cloudinary and return {id, url, path}."""
    user = await get_current_user(request, db)

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(413, f"File too large. Max {MAX_SIZE // 1024 // 1024}MB.")
    if len(data) < 100:
        raise HTTPException(400, "File is empty or corrupted.")

    ext = (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg").lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported file extension: {ext}")

    try:
        result = cloudinary.uploader.upload(
            data,
            folder=f"namcos/{user['id']}",
            resource_type="image",
            transformation=[{"quality": "auto", "fetch_format": "auto"}],
        )
    except Exception as e:
        logger.exception("cloudinary upload failed")
        raise HTTPException(502, f"Image upload failed: {e}")

    url = result["secure_url"]
    file_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.files.insert_one({
        "id": file_id,
        "owner_id": user["id"],
        "cloudinary_public_id": result.get("public_id"),
        "url": url,
        "original_filename": file.filename,
        "content_type": f"image/{ext}",
        "size": result.get("bytes", len(data)),
        "is_deleted": False,
        "created_at": now,
    })
    return {"id": file_id, "url": url, "path": result.get("public_id"), "size": result.get("bytes", len(data))}


@uploads_router.get("/files/{path:path}")
async def get_file(path: str):
    """Serve an uploaded file — public read (used from <img src>)."""
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(404, "File not found")
    try:
        data, content_type = get_bytes(path)
    except Exception as e:
        logger.exception("file fetch failed")
        raise HTTPException(502, "Failed to load file")
    return Response(
        content=data,
        media_type=record.get("content_type") or content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@uploads_router.get("/uploads/my")
async def list_my_uploads(request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request, db)
    items = await db.files.find(
        {"owner_id": user["id"], "is_deleted": False}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [{"id": str(f["_id"]),
             "url": f.get("url") or (f"/api/files/{f['storage_path']}" if f.get("storage_path") else None),
             "size": f.get("size"), "created_at": f.get("created_at")} for f in items]
