"""
Emergent Object Storage helper for NAMCOS uploads.
Backed by the platform's integration proxy — uses EMERGENT_LLM_KEY.
"""
import os
import uuid
import logging
import requests

logger = logging.getLogger(__name__)

APP_NAME = "namcos"
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml",
}
ALLOWED_EXT = set(MIME_TYPES.keys())

_storage_key = None


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY not configured")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    logger.info("Object storage initialised")
    return _storage_key


def put_bytes(path: str, data: bytes, content_type: str) -> dict:
    """Upload raw bytes to a given path."""
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 404:
        # Try re-initialising once — stale key
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_bytes(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def build_path(user_id: str, filename: str) -> tuple[str, str]:
    """Return (storage_path, content_type)."""
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "bin").lower()
    if ext not in ALLOWED_EXT:
        raise ValueError(f"Unsupported file extension: {ext}")
    return f"{APP_NAME}/uploads/{user_id or 'anon'}/{uuid.uuid4()}.{ext}", MIME_TYPES[ext]
