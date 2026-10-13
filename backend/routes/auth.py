from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging, jwt

from database import db
from auth_utils import (hash_password, verify_password, create_access_token,
    create_refresh_token, generate_otp, get_current_user, JWT_ALGORITHM, get_jwt_secret)

import os, asyncio
from twilio.rest import Client as TwilioClient

logger = logging.getLogger(__name__)
auth_router = APIRouter(tags=["Auth"])

_tw = None
def _twilio():
    global _tw
    if _tw is None:
        _tw = TwilioClient(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
    return _tw

def _is_test_phone(phone: str) -> bool:
    return phone in [p.strip() for p in os.environ.get("OTP_TEST_PHONES", "").split(",") if p.strip()]

class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None
    referral_code: Optional[str] = None

class AdminLoginRequest(BaseModel):
    email: str
    password: str

def set_tokens(response: Response, access_token: str, refresh_token: str):
    response.set_cookie("access_token", access_token, httponly=True, secure=True,
                        samesite="none", max_age=86400, path="/")
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=True,
                        samesite="none", max_age=2592000, path="/")

@auth_router.post("/auth/send-otp")
async def send_otp(req: SendOTPRequest):
    phone = req.phone.strip()
    if not phone.startswith("+"):
        phone = "+91" + phone.lstrip("0")
    if not _is_test_phone(phone):
        try:
            await asyncio.to_thread(lambda: _twilio().verify.v2.services(os.environ["TWILIO_VERIFY_SERVICE"])
                                    .verifications.create(to=phone, channel="sms"))
        except Exception as e:
            logger.error(f"Twilio send failed for {phone}: {e}")
            raise HTTPException(400, "Could not send OTP SMS. Please check the number and try again.")
        return {"success": True, "message": f"OTP sent to {phone}", "expires_in": 600}
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    await db.otps.delete_many({"phone": phone})
    await db.otps.insert_one({"phone": phone, "otp": os.environ["OTP_TEST_CODE"], "expires_at": expires_at,
                               "created_at": datetime.now(timezone.utc).isoformat()})
    return {"success": True, "message": f"OTP sent to {phone}", "expires_in": 600}

@auth_router.post("/auth/verify-otp")
async def verify_otp(req: VerifyOTPRequest, response: Response):
    phone = req.phone.strip()
    if not phone.startswith("+"):
        phone = "+91" + phone.lstrip("0")
    if _is_test_phone(phone):
        otp_doc = await db.otps.find_one({"phone": phone})
        if not otp_doc:
            raise HTTPException(400, "No OTP found. Please request a new OTP.")
        if otp_doc["otp"] != req.otp:
            raise HTTPException(400, "Invalid OTP.")
        if otp_doc["expires_at"] < datetime.utcnow():
            raise HTTPException(400, "OTP expired. Please request a new OTP.")
        await db.otps.delete_one({"phone": phone})
    else:
        try:
            check = await asyncio.to_thread(lambda: _twilio().verify.v2.services(os.environ["TWILIO_VERIFY_SERVICE"])
                                            .verification_checks.create(to=phone, code=req.otp))
            approved = check.status == "approved"
        except Exception as e:
            logger.error(f"Twilio verify failed for {phone}: {e}")
            approved = False
        if not approved:
            raise HTTPException(400, "Invalid or expired OTP.")

    user = await db.users.find_one({"phone": phone})
    is_new = user is None
    if is_new:
        import secrets
        referral_code = "NAM" + secrets.token_hex(3).upper()
        referred_by = None
        if req.referral_code:
            ref_user = await db.users.find_one({"referral_code": req.referral_code.strip().upper()})
            if ref_user:
                referred_by = str(ref_user["_id"])
        doc = {"phone": phone, "name": req.name or f"User {phone[-4:]}",
               "profile_photo": None, "roles": ["customer"], "is_active": True,
               "locality": None, "city": None, "state": None,
               "referral_code": referral_code, "referred_by": referred_by,
               "created_at": datetime.now(timezone.utc).isoformat(),
               "last_login": datetime.now(timezone.utc).isoformat()}
        result = await db.users.insert_one(doc)
        user = await db.users.find_one({"_id": result.inserted_id})
        if referred_by:
            await db.notifications.insert_one({
                "user_id": referred_by, "title": "New Referral",
                "message": f"{doc['name']} joined using your referral code",
                "type": "referral", "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()})
    else:
        if user.get("is_active") is False:
            raise HTTPException(403, "Your account has been deactivated. Contact support.")
        await db.users.update_one({"_id": user["_id"]},
                                  {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}})
    
    user_id = str(user["_id"])
    roles = user.get("roles", ["customer"])
    at = create_access_token(user_id, roles)
    rt = create_refresh_token(user_id)
    set_tokens(response, at, rt)
    user["id"] = user_id; user["_id"] = user_id
    user.pop("password_hash", None)
    return {"user": user, "access_token": at, "is_new_user": is_new, "roles": roles}

@auth_router.post("/auth/admin-login")
async def admin_login(req: AdminLoginRequest, response: Response):
    user = await db.users.find_one({"email": req.email.lower().strip()})
    if not user or not any(r in user.get("roles", []) for r in ["admin", "super_admin"]):
        raise HTTPException(401, "Invalid credentials or insufficient access")
    if not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    user_id = str(user["_id"])
    roles = user.get("roles", [])
    at = create_access_token(user_id, roles)
    rt = create_refresh_token(user_id)
    set_tokens(response, at, rt)
    await db.users.update_one({"_id": user["_id"]},
                               {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}})
    user["id"] = user_id; user["_id"] = user_id
    user.pop("password_hash", None)
    return {"user": user, "access_token": at, "roles": roles}

@auth_router.get("/auth/me")
async def get_me(request: Request):
    return await get_current_user(request, db)

@auth_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"success": True}

@auth_router.post("/auth/refresh")
async def refresh_token_endpoint(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        user_id = str(user["_id"])
        roles = user.get("roles", ["customer"])
        at = create_access_token(user_id, roles)
        response.set_cookie("access_token", at, httponly=True, secure=True,
                            samesite="none", max_age=86400, path="/")
        return {"access_token": at}
    except Exception:
        raise HTTPException(401, "Invalid refresh token")

@auth_router.put("/auth/profile")
async def update_profile(request: Request):
    user = await get_current_user(request, db)
    body = await request.json()
    for f in ["_id", "id", "roles", "password_hash", "email", "phone"]:
        body.pop(f, None)
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": body})
    updated = await db.users.find_one({"_id": ObjectId(user["id"])})
    updated["id"] = str(updated["_id"]); updated["_id"] = str(updated["_id"])
    updated.pop("password_hash", None)
    return updated
