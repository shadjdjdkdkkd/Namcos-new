import os, jwt, bcrypt, random, logging
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request
from bson import ObjectId

logger = logging.getLogger(__name__)
JWT_ALGORITHM = "HS256"

def get_jwt_secret():
    return os.environ.get("JWT_SECRET", "namcos_fallback_secret_change_me_in_prod")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_access_token(user_id: str, roles: list) -> str:
    payload = {"sub": user_id, "roles": roles,
               "exp": datetime.now(timezone.utc) + timedelta(hours=24), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def generate_otp() -> str:
    return str(random.randint(100000, 999999))

async def get_current_user(request: Request, db) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Contact support.")
    return user

def require_roles(user: dict, roles: list):
    if not any(r in user.get("roles", []) for r in roles):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

async def get_optional_user(request: Request, db):
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None

async def ensure_visible(item: dict, owner_field: str, request: Request, db):
    """Non-published items are only visible to their owner or an admin."""
    if item.get("status") == "published":
        return
    user = await get_optional_user(request, db)
    if user and (user["id"] == item.get(owner_field) or
                 any(r in user.get("roles", []) for r in ["admin", "super_admin"])):
        return
    raise HTTPException(status_code=404, detail="Listing not available")

PROTECTED_LISTING_FIELDS = ["_id", "id", "created_at", "seller_id", "owner_id", "provider_id", "status",
                            "is_active", "verified", "approved_at", "approved_by", "rating", "review_count",
                            "discount_percent", "referral_percent", "chain_percent", "namcos_percent"]

def doc(d):
    if d:
        d["id"] = str(d["_id"])
        d["_id"] = str(d["_id"])
    return d
