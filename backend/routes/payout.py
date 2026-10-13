"""Saved payout (bank / UPI) details for users & merchants + admin lookup."""
import re
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional

from database import db
from auth_utils import get_current_user, require_roles

payout_router = APIRouter(tags=["Payout"])

IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
ACC_RE = re.compile(r"^\d{9,18}$")
FIELDS = ["account_holder", "bank_account", "ifsc", "bank_name", "upi_id"]


class PayoutDetails(BaseModel):
    account_holder: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    bank_name: Optional[str] = None
    upi_id: Optional[str] = None


def clean_payout(data: dict) -> dict:
    """Normalise + validate payout fields. Requires UPI or full bank details."""
    p = {k: (str(data.get(k) or "").strip() or None) for k in FIELDS}
    if p["ifsc"]:
        p["ifsc"] = p["ifsc"].upper()
    if p["bank_account"]:
        p["bank_account"] = p["bank_account"].replace(" ", "")
    has_bank = any([p["bank_account"], p["ifsc"]])
    if has_bank:
        if not p["bank_account"] or not ACC_RE.match(p["bank_account"]):
            raise HTTPException(400, "Enter a valid bank account number (9-18 digits)")
        if not p["ifsc"] or not IFSC_RE.match(p["ifsc"]):
            raise HTTPException(400, "Enter a valid IFSC code (e.g. SBIN0001234)")
        if not p["account_holder"]:
            raise HTTPException(400, "Account holder name is required")
    if not has_bank and not p["upi_id"]:
        raise HTTPException(400, "Add bank account + IFSC or a UPI ID")
    if p["upi_id"] and "@" not in p["upi_id"]:
        raise HTTPException(400, "Enter a valid UPI ID (e.g. name@upi)")
    return p


async def resolve_payout(user: dict, body: dict) -> dict:
    """Use details from the request, falling back to saved ones; persist them for reuse."""
    provided = {k: body.get(k) for k in FIELDS if body.get(k)}
    p = clean_payout(provided or user.get("payout") or {})
    await db.users.update_one({"_id": ObjectId(user["id"])},
                              {"$set": {"payout": {**p, "updated_at": datetime.now(timezone.utc).isoformat()}}})
    return p


@payout_router.get("/my/payout-details")
async def get_my_payout(request: Request):
    user = await get_current_user(request, db)
    return user.get("payout") or {}


@payout_router.put("/my/payout-details")
async def save_my_payout(body: PayoutDetails, request: Request):
    user = await get_current_user(request, db)
    p = clean_payout(body.dict())
    p["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"payout": p}})
    return {"success": True, "payout": p}


async def _admin(request: Request):
    user = await get_current_user(request, db)
    require_roles(user, ["admin", "super_admin"])


@payout_router.get("/admin/users/{user_id}/payout")
async def admin_user_payout(user_id: str, request: Request):
    await _admin(request)
    try:
        u = await db.users.find_one({"_id": ObjectId(user_id)}, {"name": 1, "phone": 1, "payout": 1})
    except Exception:
        raise HTTPException(400, "Invalid user ID")
    if not u:
        raise HTTPException(404, "User not found")
    last = await db.withdrawals.find_one({"$or": [{"user_id": user_id}, {"merchant_id": user_id}]}, sort=[("created_at", -1)])
    return {"user_id": user_id, "name": u.get("name"), "phone": u.get("phone"),
            "payout": u.get("payout") or {},
            "last_withdrawal": {k: last.get(k) for k in FIELDS + ["amount", "status", "created_at"]} if last else None}


@payout_router.get("/admin/stores/{store_id}/payout")
async def admin_store_payout(store_id: str, request: Request):
    await _admin(request)
    try:
        s = await db.stores.find_one({"_id": ObjectId(store_id)})
    except Exception:
        raise HTTPException(400, "Invalid store ID")
    if not s:
        raise HTTPException(404, "Store not found")
    owner = None
    if s.get("owner_id") and ObjectId.is_valid(s["owner_id"]):
        owner = await db.users.find_one({"_id": ObjectId(s["owner_id"])}, {"name": 1, "phone": 1, "payout": 1})
    store_bank = {k: s.get(k) for k in FIELDS if s.get(k)}
    return {"store_id": store_id, "business_name": s.get("business_name"),
            "owner_id": s.get("owner_id"), "owner_name": (owner or {}).get("name") or s.get("owner_name"),
            "owner_phone": (owner or {}).get("phone") or s.get("phone"),
            "payout": (owner or {}).get("payout") or {}, "store_bank": store_bank}
