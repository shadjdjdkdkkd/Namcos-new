"""Phase 3+4: referrals, subcategories, wallet withdrawals."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
from pymongo import ReturnDocument
from datetime import datetime, timezone
from typing import Optional

from database import db
from auth_utils import get_current_user, require_roles, doc
from earnings import write_ledger
from routes.payout import resolve_payout

extra_router = APIRouter(tags=["Extra"])


async def _admin(request: Request):
    user = await get_current_user(request, db)
    require_roles(user, ["admin", "super_admin"])
    return user


# ─── Business types (register-business autocomplete) ──────
@extra_router.get("/business-types")
async def list_business_types(search: Optional[str] = None, limit: int = 300):
    q = {"is_active": True}
    if search:
        q["name"] = {"$regex": search, "$options": "i"}
    items = await db.business_types.find(q).sort("name", 1).to_list(limit)
    return [{"id": str(i["_id"]), "name": i["name"]} for i in items]


# ─── Subcategories ────────────────────────────────────────
@extra_router.get("/subcategories")
async def list_subcategories(category: Optional[str] = None):
    q = {"status": "approved", "is_active": True}
    if category:
        q["category"] = category
    subs = await db.subcategories.find(q).sort("name", 1).to_list(300)
    return [doc(s) for s in subs]


class SubcatSuggest(BaseModel):
    name: str
    category: str = "shops"


@extra_router.post("/subcategories/suggest")
async def suggest_subcategory(body: SubcatSuggest, request: Request):
    user = await get_current_user(request, db)
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    slug = name.lower().replace(" ", "-")
    existing = await db.subcategories.find_one({"category": body.category, "slug": slug})
    if existing:
        return {"success": True, "id": str(existing["_id"]), "status": existing.get("status")}
    now = datetime.now(timezone.utc).isoformat()
    res = await db.subcategories.insert_one({
        "name": name, "slug": slug, "category": body.category,
        "status": "pending", "is_active": True, "created_by": user["id"], "created_at": now})
    await db.notifications.insert_one({
        "user_id": "admin", "title": "New Subcategory Suggestion",
        "message": f"'{name}' suggested under {body.category}", "type": "subcategory",
        "entity_id": str(res.inserted_id), "is_read": False, "created_at": now})
    return {"success": True, "id": str(res.inserted_id), "status": "pending"}


@extra_router.get("/admin/subcategories")
async def admin_list_subcats(request: Request, status: Optional[str] = None, category: Optional[str] = None):
    await _admin(request)
    q = {}
    if status:
        q["status"] = status
    if category:
        q["category"] = category
    subs = await db.subcategories.find(q).sort("created_at", -1).to_list(500)
    return [doc(s) for s in subs]


@extra_router.post("/admin/subcategories")
async def admin_create_subcat(request: Request):
    await _admin(request)
    body = await request.json()
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name required")
    cat = body.get("category", "shops")
    slug = name.lower().replace(" ", "-")
    await db.subcategories.update_one(
        {"category": cat, "slug": slug},
        {"$set": {"name": name, "slug": slug, "category": cat, "status": "approved", "is_active": True},
         "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True)
    return {"success": True}


@extra_router.put("/admin/subcategories/{sid}")
async def admin_update_subcat(sid: str, request: Request):
    await _admin(request)
    body = await request.json()
    allowed = {k: body[k] for k in ["name", "status", "is_active", "category"] if k in body}
    try:
        await db.subcategories.update_one({"_id": ObjectId(sid)}, {"$set": allowed})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    return {"success": True}


@extra_router.delete("/admin/subcategories/{sid}")
async def admin_del_subcat(sid: str, request: Request):
    await _admin(request)
    try:
        await db.subcategories.delete_one({"_id": ObjectId(sid)})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    return {"success": True}


# ─── Referrals ────────────────────────────────────────────
@extra_router.get("/referrals/me")
async def my_referrals(request: Request):
    user = await get_current_user(request, db)
    referred = await db.users.find({"referred_by": user["id"]}).to_list(1000)
    earnings = await db.referral_earnings.find({"referrer_id": user["id"]}).sort("created_at", -1).to_list(500)
    direct_earnings = round(sum(e.get("amount", 0) for e in earnings if e.get("kind") != "chain"), 2)
    chain_earnings = round(sum(e.get("amount", 0) for e in earnings if e.get("kind") == "chain"), 2)
    total_earnings = round(direct_earnings + chain_earnings, 2)
    volume = sum(e.get("net_paid", 0) for e in earnings)
    return {
        "referral_code": user.get("referral_code"),
        "referred_count": len(referred),
        "referred_users": [{"name": u.get("name"), "joined": u.get("created_at")} for u in referred[:50]],
        "total_earnings": total_earnings,
        "direct_earnings": direct_earnings,
        "chain_earnings": chain_earnings,
        "volume": round(volume, 2),
        "earnings": [doc(e) for e in earnings[:50]],
    }


# ─── Wallet withdrawals (any user, from wallet balance) ───
class WalletWithdraw(BaseModel):
    amount: float
    upi_id: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    account_holder: Optional[str] = None
    bank_name: Optional[str] = None


@extra_router.post("/wallet/withdrawals")
async def create_wallet_withdrawal(body: WalletWithdraw, request: Request):
    user = await get_current_user(request, db)
    if body.amount < 100:
        raise HTTPException(400, "Minimum withdrawal is ₹100")
    payout = await resolve_payout(user, body.dict())
    updated = await db.wallet.find_one_and_update(
        {"user_id": user["id"], "balance": {"$gte": body.amount}},
        {"$inc": {"balance": -body.amount}}, return_document=ReturnDocument.AFTER)
    if not updated:
        w = await db.wallet.find_one({"user_id": user["id"]})
        raise HTTPException(400, f"Insufficient wallet balance (₹{(w or {}).get('balance', 0):.0f})")
    now = datetime.now(timezone.utc).isoformat()
    wd = {**body.dict(), **payout, "user_id": user["id"], "user_name": user.get("name"),
          "user_phone": user.get("phone"),
          "merchant_id": user["id"], "merchant_name": user.get("name"),
          "type": "wallet", "status": "requested", "on_hold": False, "admin_notes": None,
          "created_at": now}
    r = await db.withdrawals.insert_one(wd)
    await write_ledger("withdrawal", "user_withdrawal", body.amount, now,
                       reference_id=str(r.inserted_id), user_id=user["id"],
                       user_name=user.get("name"), direction="debit",
                       note="User wallet withdrawal request")
    await db.wallet_transactions.insert_one({
        "user_id": user["id"], "type": "debit", "source": "withdrawal", "amount": body.amount,
        "reference_id": str(r.inserted_id), "note": "Withdrawal request", "created_at": now})
    await db.notifications.insert_one({
        "user_id": "admin", "title": "Wallet Withdrawal Request",
        "message": f"{user.get('name')} requested ₹{body.amount:.0f} wallet withdrawal",
        "type": "withdrawal", "entity_id": str(r.inserted_id), "is_read": False, "created_at": now})
    return {"success": True, "withdrawal_id": str(r.inserted_id), "balance": round(updated["balance"], 2)}


@extra_router.get("/wallet/withdrawals")
async def my_wallet_withdrawals(request: Request):
    user = await get_current_user(request, db)
    wds = await db.withdrawals.find({"user_id": user["id"], "type": "wallet"}).sort("created_at", -1).to_list(100)
    return [doc(w) for w in wds]
