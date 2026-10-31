"""Admin extension endpoints — Phase 4.
Adds:
  - Date-range analytics
  - Inquiries (nearby vendors by category + location)
  - Password change
  - Manual add flows for stores / agriculture / services / classifieds
  - Support/contact settings
"""
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import math
import csv
import io

from database import db
from auth_utils import get_current_user, require_roles, doc, hash_password, verify_password

admin_ext_router = APIRouter(prefix="/admin", tags=["Admin-Ext"])


async def admin_required(request: Request):
    user = await get_current_user(request, db)
    require_roles(user, ["admin", "super_admin"])
    return user


def _parse_date(s: Optional[str]):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _iso_range(from_str: Optional[str], to_str: Optional[str], preset: Optional[str]):
    now = datetime.now(timezone.utc)
    if preset:
        days = {"3d": 3, "7d": 7, "30d": 30, "6mo": 180, "1y": 365}.get(preset)
        if days:
            return (now - timedelta(days=days)).isoformat(), now.isoformat()
    f = _parse_date(from_str)
    t = _parse_date(to_str)
    return (f.isoformat() if f else None), (t.isoformat() if t else None)


# ─── Dashboard: date-filtered analytics ────────────────────────

@admin_ext_router.get("/analytics")
async def admin_analytics(request: Request,
                          preset: Optional[str] = None,
                          date_from: Optional[str] = None,
                          date_to: Optional[str] = None):
    await admin_required(request)
    f, t = _iso_range(date_from, date_to, preset)
    date_q = {}
    if f: date_q["$gte"] = f
    if t: date_q["$lte"] = t
    payment_q = {"status": "captured"}
    user_q = {}
    withdrawal_q = {"status": "paid"}
    if date_q:
        payment_q["created_at"] = date_q
        user_q["created_at"] = date_q
        withdrawal_q["processed_at"] = date_q

    payments = await db.payments.find(payment_q).sort("created_at", -1).to_list(5000)
    new_users = await db.users.count_documents(user_q)
    withdrawals_paid = await db.withdrawals.find(withdrawal_q).to_list(5000)

    total_gmv = sum(p.get("gross_amount", 0) for p in payments)
    total_fees = sum(p.get("platform_fee", 0) for p in payments)
    total_withdrawn = sum(w.get("amount", 0) for w in withdrawals_paid)

    # Group transactions by day for a small trend line
    by_day = {}
    for p in payments:
        day = (p.get("created_at") or "")[:10]
        if not day: continue
        by_day.setdefault(day, {"count": 0, "amount": 0.0})
        by_day[day]["count"] += 1
        by_day[day]["amount"] += p.get("gross_amount", 0)
    trend = [{"date": d, **v} for d, v in sorted(by_day.items())]

    return {
        "range": {"from": f, "to": t, "preset": preset},
        "totals": {
            "transactions": len(payments),
            "gmv": total_gmv,
            "fees": total_fees,
            "new_users": new_users,
            "withdrawals_paid": len(withdrawals_paid),
            "withdrawal_amount": total_withdrawn,
        },
        "trend": trend,
        "recent_transactions": [doc(p) for p in payments[:20]],
    }


# ─── Inquiries: pick category + location → nearby vendors ──────

@admin_ext_router.get("/inquiries")
async def admin_inquiries(request: Request,
                          category: str,
                          locality: Optional[str] = None,
                          search: Optional[str] = None,
                          skip: int = 0,
                          limit: int = 30):
    """Find vendors near a given category + locality — for support agents to route calls."""
    await admin_required(request)

    # Category slug maps to a collection
    slug_to_col = {
        "agriculture": db.agriculture,
        "services": db.services,
        "classifieds": db.classifieds,
        "shops": db.stores, "food": db.stores, "health": db.stores, "home": db.stores,
    }
    col = slug_to_col.get(category)
    if col is None:
        raise HTTPException(400, "Unknown category")

    query = {"status": "published"}
    if locality:
        query["$or"] = [
            {"locality": {"$regex": locality, "$options": "i"}},
            {"city": {"$regex": locality, "$options": "i"}},
        ]
    if search:
        or_clauses = query.pop("$or", [])
        or_clauses += [
            {"product_name": {"$regex": search, "$options": "i"}},
            {"service_name": {"$regex": search, "$options": "i"}},
            {"business_name": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}},
        ]
        query["$or"] = or_clauses

    items = await col.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    def enrich(x):
        d = doc(x)
        return {
            "id": d.get("id"),
            "name": d.get("business_name") or d.get("product_name") or d.get("service_name") or d.get("title"),
            "seller_name": d.get("owner_name") or d.get("seller_name") or d.get("provider_name"),
            "phone": d.get("phone") or d.get("seller_phone") or d.get("contact_phone"),
            "category": d.get("category") or d.get("business_type"),
            "locality": d.get("locality"),
            "city": d.get("city"),
            "state": d.get("state"),
            "price": d.get("price") or d.get("starting_price"),
            "status": d.get("status"),
            "created_at": d.get("created_at"),
            "images": d.get("images") or ([d.get("logo")] if d.get("logo") else []),
        }
    return [enrich(i) for i in items]


# ─── Password change ─────────────────────────────────────

class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@admin_ext_router.post("/change-password")
async def change_password(body: PasswordChange, request: Request):
    user = await admin_required(request)
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    # get_current_user strips password_hash — refetch to verify current password
    fresh = await db.users.find_one({"_id": ObjectId(user["id"])})
    stored = (fresh or {}).get("password_hash") or ""
    try:
        ok = bool(stored) and verify_password(body.current_password, stored)
    except Exception:
        ok = False
    if not ok:
        raise HTTPException(400, "Current password is incorrect")
    await db.users.update_one({"_id": ObjectId(user["id"])},
                               {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"success": True}


# ─── Contact / support settings ──────────────────────────

@admin_ext_router.get("/contact-settings")
async def get_contact_settings(request: Request):
    await admin_required(request)
    s = await db.settings.find_one({"key": "contact"})
    return doc(s) if s else {"support_email": "", "support_phone": "", "company_address": "",
                             "whatsapp": "", "business_hours": ""}


@admin_ext_router.put("/contact-settings")
async def update_contact_settings(request: Request):
    await admin_required(request)
    body = await request.json()
    allowed = {k: body.get(k) for k in
               ["support_email", "support_phone", "company_address", "whatsapp", "business_hours"] if k in body}
    await db.settings.update_one({"key": "contact"},
                                  {"$set": {"key": "contact", **allowed}}, upsert=True)
    return {"success": True}


@admin_ext_router.get("/contact-settings/public")
async def contact_settings_public():
    s = await db.settings.find_one({"key": "contact"})
    if not s: return {"support_email": "", "support_phone": "", "whatsapp": ""}
    return {"support_email": s.get("support_email", ""),
            "support_phone": s.get("support_phone", ""),
            "whatsapp": s.get("whatsapp", ""),
            "business_hours": s.get("business_hours", "")}


# ─── Manual add flows (Store / Agri / Service / Classified) ────

def _validate_min_images(images: list):
    if not isinstance(images, list) or len(images) < 4:
        raise HTTPException(400, "At least 4 images are required")


def _validate_location(body: dict):
    if not body.get("locality") or not body.get("city"):
        raise HTTPException(400, "Location (locality + city) is required")


@admin_ext_router.post("/add/store")
async def admin_add_store(request: Request):
    actor = await admin_required(request)
    body = await request.json()
    _validate_location(body)
    _validate_min_images(body.get("images", []))
    now = datetime.now(timezone.utc).isoformat()
    doc_ = {
        "business_name": body["business_name"],
        "business_type": body.get("business_type", ""),
        "owner_name": body.get("owner_name", ""),
        "phone": body.get("phone", ""),
        "description": body.get("description", ""),
        "locality": body["locality"], "area": body.get("area", ""),
        "city": body["city"], "state": body.get("state", "Kerala"),
        "pincode": body.get("pincode", ""),
        "latitude": body.get("latitude"), "longitude": body.get("longitude"),
        "address": body.get("address", ""),
        "categories": body.get("categories", []),
        "category": body.get("category", ""),
        "opening_time": body.get("opening_time", "09:00"),
        "closing_time": body.get("closing_time", "21:00"),
        "operating_days": body.get("operating_days", ["Mon","Tue","Wed","Thu","Fri","Sat"]),
        "delivery_available": body.get("delivery_available", False),
        "pickup_available": body.get("pickup_available", True),
        "service_radius": float(body.get("service_radius", 5)),
        "status": body.get("status", "published"),
        "verified": True,
        "rating": 0.0, "review_count": 0,
        "logo": body.get("logo") or (body["images"][0] if body.get("images") else None),
        "cover_image": body.get("cover_image"),
        "images": body["images"],
        "owner_id": body.get("owner_id", "admin-added"),
        "created_at": now,
        "added_by_admin": actor["id"],
    }
    res = await db.stores.insert_one(doc_)
    return {"success": True, "id": str(res.inserted_id)}


@admin_ext_router.post("/add/agriculture")
async def admin_add_agriculture(request: Request):
    actor = await admin_required(request)
    body = await request.json()
    _validate_location(body)
    _validate_min_images(body.get("images", []))
    now = datetime.now(timezone.utc).isoformat()
    doc_ = {
        "product_name": body["product_name"],
        "category": body.get("category", "Fruits & Vegetables"),
        "subcategory": body.get("subcategory"),
        "description": body.get("description", ""),
        "images": body["images"],
        "unit": body.get("unit", "kg"),
        "price": float(body.get("price", 0)),
        "min_quantity": float(body.get("min_quantity", 1)),
        "available_quantity": float(body.get("available_quantity", 10)),
        "availability": body.get("availability", "available"),
        "is_organic": body.get("is_organic", False),
        "pickup_available": body.get("pickup_available", True),
        "delivery_available": body.get("delivery_available", False),
        "bulk_available": body.get("bulk_available", False),
        "locality": body["locality"], "city": body["city"],
        "state": body.get("state", "Kerala"),
        "latitude": body.get("latitude"), "longitude": body.get("longitude"),
        "seller_name": body.get("seller_name", "Admin Listing"),
        "seller_phone": body.get("seller_phone", ""),
        "status": body.get("status", "published"),
        "rating": 0.0,
        "created_at": now,
        "added_by_admin": actor["id"],
    }
    res = await db.agriculture.insert_one(doc_)
    return {"success": True, "id": str(res.inserted_id)}


@admin_ext_router.post("/add/service")
async def admin_add_service(request: Request):
    actor = await admin_required(request)
    body = await request.json()
    _validate_location(body)
    _validate_min_images(body.get("images", []))
    now = datetime.now(timezone.utc).isoformat()
    doc_ = {
        "service_name": body["service_name"],
        "provider_name": body.get("provider_name", "Admin Listing"),
        "business_name": body.get("business_name"),
        "phone": body.get("phone", ""),
        "category": body.get("category", ""),
        "description": body.get("description", ""),
        "images": body["images"],
        "starting_price": float(body.get("starting_price", 0)),
        "hourly_price": body.get("hourly_price"),
        "visit_charge": body.get("visit_charge"),
        "emergency_available": body.get("emergency_available", False),
        "locality": body["locality"], "city": body["city"],
        "state": body.get("state", "Kerala"),
        "latitude": body.get("latitude"), "longitude": body.get("longitude"),
        "service_radius": float(body.get("service_radius", 10)),
        "experience_years": int(body.get("experience_years", 0)),
        "working_days": body.get("working_days", ["Mon","Tue","Wed","Thu","Fri","Sat"]),
        "opening_time": body.get("opening_time", "09:00"),
        "closing_time": body.get("closing_time", "19:00"),
        "price_negotiable": body.get("price_negotiable", True),
        "status": body.get("status", "published"),
        "rating": 0.0, "completed_jobs": 0,
        "created_at": now,
        "added_by_admin": actor["id"],
    }
    res = await db.services.insert_one(doc_)
    return {"success": True, "id": str(res.inserted_id)}


@admin_ext_router.post("/add/classified")
async def admin_add_classified(request: Request):
    actor = await admin_required(request)
    body = await request.json()
    _validate_location(body)
    _validate_min_images(body.get("images", []))
    now = datetime.now(timezone.utc).isoformat()
    doc_ = {
        "title": body["title"],
        "category": body.get("category", "Others"),
        "subcategory": body.get("subcategory"),
        "condition": body.get("condition", "good"),
        "price": float(body.get("price", 0)),
        "is_negotiable": body.get("is_negotiable", True),
        "description": body.get("description", ""),
        "images": body["images"],
        "locality": body["locality"], "city": body["city"],
        "state": body.get("state", "Kerala"),
        "latitude": body.get("latitude"), "longitude": body.get("longitude"),
        "seller_name": body.get("seller_name", "Admin Listing"),
        "seller_phone": body.get("seller_phone", ""),
        "contact_preference": "phone",
        "status": body.get("status", "published"),
        "view_count": 0,
        "created_at": now,
        "added_by_admin": actor["id"],
    }
    res = await db.classifieds.insert_one(doc_)
    return {"success": True, "id": str(res.inserted_id)}


# ─── Universal edit + delete for listings/stores ─────────

def _col_for(kind: str):
    m = {"store": db.stores, "agriculture": db.agriculture,
         "service": db.services, "classified": db.classifieds}
    if kind not in m: raise HTTPException(400, "Invalid kind")
    return m[kind]


@admin_ext_router.put("/edit/{kind}/{item_id}")
async def admin_edit(kind: str, item_id: str, request: Request):
    await admin_required(request)
    col = _col_for(kind)
    body = await request.json()
    for f in ["_id", "id", "created_at"]:
        body.pop(f, None)
    try:
        result = await col.update_one({"_id": ObjectId(item_id)}, {"$set": body})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    if result.matched_count == 0:
        raise HTTPException(404, "Item not found")
    return {"success": True}


@admin_ext_router.delete("/delete/{kind}/{item_id}")
async def admin_delete(kind: str, item_id: str, request: Request):
    await admin_required(request)
    col = _col_for(kind)
    try:
        res = await col.delete_one({"_id": ObjectId(item_id)})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    if res.deleted_count == 0:
        raise HTTPException(404, "Item not found")
    return {"success": True}


# ─── Withdrawal reference ID update ──────────────────────

class WithdrawalReference(BaseModel):
    reference_id: str
    notes: Optional[str] = ""


@admin_ext_router.put("/withdrawals/{withdrawal_id}/reference")
async def withdrawal_set_reference(withdrawal_id: str, body: WithdrawalReference, request: Request):
    actor = await admin_required(request)
    if not body.reference_id:
        raise HTTPException(400, "reference_id is required")
    try:
        wd = await db.withdrawals.find_one({"_id": ObjectId(withdrawal_id)})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    if not wd:
        raise HTTPException(404, "Withdrawal not found")
    await db.withdrawals.update_one({"_id": ObjectId(withdrawal_id)}, {"$set": {
        "reference_id": body.reference_id,
        "admin_notes": body.notes,
        "status": "paid",
        "processed_by": actor["id"],
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }})
    await db.notifications.insert_one({
        "user_id": wd.get("merchant_id"), "title": "Withdrawal Paid",
        "message": f"Your withdrawal of ₹{wd.get('amount', 0):.0f} has been paid. Ref: {body.reference_id}",
        "type": "withdrawal", "entity_id": withdrawal_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True}



# ═══════════════════════════════════════════════════════════
#  PHASE 4 — Admin overhaul: metrics, drill-downs, store rates,
#  transactions ledger, withdrawals export, business types
# ═══════════════════════════════════════════════════════════

async def _sum_field(collection, match, field):
    pipe = [{"$match": match}, {"$group": {"_id": None, "s": {"$sum": f"${field}"}}}]
    r = await collection.aggregate(pipe).to_list(1)
    return round(r[0]["s"], 2) if r else 0.0


@admin_ext_router.get("/dashboard-metrics")
async def dashboard_metrics(request: Request, preset: Optional[str] = None,
                            date_from: Optional[str] = None, date_to: Optional[str] = None):
    """Every money metric for the admin dashboard, date-filtered."""
    await admin_required(request)
    f, t = _iso_range(date_from, date_to, preset)
    rng = {}
    if f: rng["$gte"] = f
    if t: rng["$lte"] = t

    pay_q = {"status": "captured"}
    if rng: pay_q["created_at"] = rng
    payments = await db.payments.find(pay_q).to_list(20000)
    total_revenue = round(sum(p.get("gross_amount", 0) for p in payments), 2)
    merchant_revenue = round(sum(p.get("merchant_amount", 0) for p in payments), 2)
    namcos_revenue = round(sum(p.get("namcos_earning", p.get("platform_fee", 0)) for p in payments), 2)
    customer_discount = round(sum(p.get("discount_amount", 0) for p in payments), 2)
    total_txns = len(payments)

    tq = {}
    if rng: tq["created_at"] = rng
    referral_revenue = await _sum_field(db.transactions, {**tq, "txn_group": "referral"}, "amount")
    chain_revenue = await _sum_field(db.transactions, {**tq, "txn_group": "chain"}, "amount")

    # Withdrawals
    wd_paid_q = {"status": "paid"}
    if rng: wd_paid_q["processed_at"] = rng
    withdrawal_processed = await _sum_field(db.withdrawals, wd_paid_q, "amount")
    withdrawal_pending = await _sum_field(
        db.withdrawals, {"status": {"$in": ["requested", "under_review", "approved", "processing"]}}, "amount")

    # Balances (all-time, not date filtered)
    merchant_valid_balance = await _sum_field(db.settlements, {"status": "available"}, "net_amount")
    user_wallet_balance = await _sum_field(db.wallet, {}, "balance")

    total_percentage_revenue = round(namcos_revenue + referral_revenue + chain_revenue + customer_discount, 2)

    return {
        "range": {"from": f, "to": t, "preset": preset},
        "metrics": {
            "total_revenue": total_revenue,
            "total_transactions": total_txns,
            "merchant_revenue": merchant_revenue,
            "namcos_revenue": namcos_revenue,
            "referral_revenue": referral_revenue,
            "chain_revenue": chain_revenue,
            "customer_discount": customer_discount,
            "total_percentage_revenue": total_percentage_revenue,
            "merchant_valid_balance": merchant_valid_balance,
            "user_wallet_balance": user_wallet_balance,
            "withdrawal_processed": withdrawal_processed,
            "withdrawal_pending": withdrawal_pending,
        },
    }


@admin_ext_router.get("/users-count")
async def users_count(request: Request, search: Optional[str] = None, role: Optional[str] = None):
    await admin_required(request)
    query = {}
    if search:
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}},
                        {"phone": {"$regex": search, "$options": "i"}},
                        {"email": {"$regex": search, "$options": "i"}}]
    if role:
        query["roles"] = {"$in": [role]}
    return {"total": await db.users.count_documents(query)}


@admin_ext_router.get("/users/{user_id}/detail")
async def user_detail(user_id: str, request: Request):
    """Everything about a user — purchases, listings, referrals, chain, wallet, txns, withdrawals."""
    await admin_required(request)
    try:
        u = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    except Exception:
        raise HTTPException(400, "Invalid user ID")
    if not u:
        raise HTTPException(404, "User not found")
    user = doc(u)

    purchases = await db.payments.find({"customer_id": user_id, "status": "captured"}).sort("created_at", -1).to_list(500)
    total_spent = round(sum(p.get("net_paid", p.get("gross_amount", 0)) for p in purchases), 2)

    listings_count = {
        "stores": await db.stores.count_documents({"owner_id": user_id}),
        "agriculture": await db.agriculture.count_documents({"seller_id": user_id}),
        "services": await db.services.count_documents({"provider_id": user_id}),
        "classifieds": await db.classifieds.count_documents({"seller_id": user_id}),
    }

    referred = await db.users.find({"referred_by": user_id}, {"name": 1, "created_at": 1, "phone": 1}).to_list(1000)
    ref_earnings = await db.referral_earnings.find({"referrer_id": user_id}).sort("created_at", -1).to_list(1000)
    direct_bonus = round(sum(e.get("amount", 0) for e in ref_earnings if e.get("kind") != "chain"), 2)
    chain_bonus = round(sum(e.get("amount", 0) for e in ref_earnings if e.get("kind") == "chain"), 2)

    wallet = await db.wallet.find_one({"user_id": user_id}) or {}
    wallet_txns = await db.wallet_transactions.find({"user_id": user_id}).sort("created_at", -1).to_list(200)
    withdrawals = await db.withdrawals.find({"user_id": user_id}).sort("created_at", -1).to_list(200)

    return {
        "user": user,
        "is_merchant": "merchant" in user.get("roles", []),
        "purchases": {"count": len(purchases), "total_spent": total_spent, "items": [doc(p) for p in purchases[:50]]},
        "listings_count": listings_count,
        "referrals": {
            "code": user.get("referral_code"),
            "referred_count": len(referred),
            "referred_users": [{"name": r.get("name"), "phone": r.get("phone"), "joined": r.get("created_at")} for r in referred[:100]],
            "direct_bonus": direct_bonus, "chain_bonus": chain_bonus,
            "total_bonus": round(direct_bonus + chain_bonus, 2),
        },
        "wallet": {"balance": round(wallet.get("balance", 0), 2),
                   "total_topped_up": round(wallet.get("total_topped_up", 0), 2)},
        "wallet_transactions": [doc(w) for w in wallet_txns],
        "withdrawals": [doc(w) for w in withdrawals],
    }


@admin_ext_router.get("/merchants-count")
async def merchants_count(request: Request, status: Optional[str] = None,
                          locality: Optional[str] = None, search: Optional[str] = None):
    await admin_required(request)
    query = {}
    if status: query["status"] = status
    if locality: query["locality"] = {"$regex": locality, "$options": "i"}
    if search:
        query["$or"] = [{"business_name": {"$regex": search, "$options": "i"}},
                        {"owner_name": {"$regex": search, "$options": "i"}}]
    return {"total": await db.stores.count_documents(query)}


class StoreRates(BaseModel):
    discount_percent: Optional[float] = None
    referral_percent: Optional[float] = None
    chain_percent: Optional[float] = None
    namcos_percent: Optional[float] = None


@admin_ext_router.put("/stores/{store_id}/rates")
async def update_store_rates(store_id: str, body: StoreRates, request: Request):
    """Admin sets per-store allocation percentages (customer discount / referral / chain / NAMCOS fee)."""
    actor = await admin_required(request)
    updates = {k: float(v) for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No percentages provided")
    if "chain_percent" in updates:
        from earnings import validate_tiers
        try:
            st = await db.stores.find_one({"_id": ObjectId(store_id)}, {"chain_tiers": 1})
        except Exception:
            st = None
        if st and st.get("chain_tiers") and validate_tiers(st["chain_tiers"], updates["chain_percent"]):
            raise HTTPException(400, "This shop has a custom chain plan — change its chain % from the Chain Earnings page")
    try:
        res = await db.stores.update_one({"_id": ObjectId(store_id)}, {"$set": updates})
    except Exception:
        raise HTTPException(400, "Invalid store ID")
    if res.matched_count == 0:
        raise HTTPException(404, "Store not found")
    return {"success": True, "updated": updates}


@admin_ext_router.get("/stores/{store_id}/transactions")
async def store_transactions(store_id: str, request: Request):
    """Per-store transaction totals — gross, count, after-deduction merchant revenue, NAMCOS."""
    await admin_required(request)
    payments = await db.payments.find({"store_id": store_id, "status": "captured"}).sort("created_at", -1).to_list(5000)
    total_gross = round(sum(p.get("gross_amount", 0) for p in payments), 2)
    total_merchant = round(sum(p.get("merchant_amount", 0) for p in payments), 2)
    total_namcos = round(sum(p.get("namcos_earning", p.get("platform_fee", 0)) for p in payments), 2)
    total_discount = round(sum(p.get("discount_amount", 0) for p in payments), 2)
    return {
        "store_id": store_id,
        "total_transactions": len(payments),
        "total_amount": total_gross,
        "merchant_revenue_after_deduction": total_merchant,
        "namcos_earning": total_namcos,
        "customer_discount": total_discount,
        "transactions": [doc(p) for p in payments[:50]],
    }


@admin_ext_router.get("/transactions")
async def admin_transactions(request: Request, group: Optional[str] = None,
                             month: Optional[str] = None, preset: Optional[str] = None,
                             date_from: Optional[str] = None, date_to: Optional[str] = None,
                             skip: int = 0, limit: int = 50):
    """Unified transaction ledger, grouped by type with totals + paginated items."""
    await admin_required(request)
    rng = {}
    if month:  # month = "YYYY-MM"
        rng = {"$gte": f"{month}-01", "$lte": f"{month}-31T23:59:59"}
    else:
        f, t = _iso_range(date_from, date_to, preset)
        if f: rng["$gte"] = f
        if t: rng["$lte"] = t
    base = {}
    if rng: base["created_at"] = rng

    # Group summary
    pipe = [{"$match": base},
            {"$group": {"_id": "$txn_group", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}]
    groups = await db.transactions.aggregate(pipe).to_list(50)
    summary = {g["_id"]: {"total": round(g["total"], 2), "count": g["count"]} for g in groups}

    q = dict(base)
    if group:
        q["txn_group"] = group
    total = await db.transactions.count_documents(q)
    items = await db.transactions.find(q).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"summary": summary, "total": total, "items": [doc(i) for i in items]}


@admin_ext_router.get("/withdrawals-list")
async def admin_withdrawals_list(request: Request, kind: Optional[str] = None,
                                 status: Optional[str] = None, month: Optional[str] = None,
                                 skip: int = 0, limit: int = 50):
    """Withdrawals split by user vs merchant, with month filter + pagination."""
    await admin_required(request)
    q = {}
    if kind == "user":
        q["type"] = "wallet"
    elif kind == "merchant":
        q["type"] = {"$ne": "wallet"}
    if status:
        q["status"] = status
    if month:
        q["created_at"] = {"$gte": f"{month}-01", "$lte": f"{month}-31T23:59:59"}
    total = await db.withdrawals.count_documents(q)
    items = await db.withdrawals.find(q).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"total": total, "items": [doc(w) for w in items]}


@admin_ext_router.get("/withdrawals-export")
async def admin_withdrawals_export(request: Request, kind: Optional[str] = None,
                                   status: Optional[str] = None, month: Optional[str] = None):
    """Export withdrawals as a CSV (opens in Excel)."""
    await admin_required(request)
    q = {}
    if kind == "user":
        q["type"] = "wallet"
    elif kind == "merchant":
        q["type"] = {"$ne": "wallet"}
    if status:
        q["status"] = status
    if month:
        q["created_at"] = {"$gte": f"{month}-01", "$lte": f"{month}-31T23:59:59"}
    rows = await db.withdrawals.find(q).sort("created_at", -1).to_list(10000)

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Date", "Type", "Name", "Amount", "Status", "UPI/Bank", "IFSC", "Reference", "Notes"])
    for r in rows:
        w.writerow([
            (r.get("created_at") or "")[:19],
            "User" if r.get("type") == "wallet" else "Merchant",
            r.get("merchant_name") or r.get("user_name") or "",
            r.get("amount", 0),
            r.get("status", ""),
            r.get("upi_id") or r.get("bank_account") or "",
            r.get("ifsc", ""),
            r.get("reference_id", ""),
            (r.get("admin_notes") or "").replace("\n", " "),
        ])
    fname = f"withdrawals_{kind or 'all'}_{month or 'all'}.csv"
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={fname}"})


# ─── Business types admin CRUD ───────────────────────────
@admin_ext_router.get("/business-types")
async def admin_list_business_types(request: Request, search: Optional[str] = None):
    await admin_required(request)
    q = {}
    if search:
        q["name"] = {"$regex": search, "$options": "i"}
    items = await db.business_types.find(q).sort("name", 1).to_list(1000)
    return [doc(i) for i in items]


@admin_ext_router.post("/business-types")
async def admin_create_business_type(request: Request):
    await admin_required(request)
    body = await request.json()
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name required")
    existing = await db.business_types.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    if existing:
        raise HTTPException(400, "Business type already exists")
    res = await db.business_types.insert_one(
        {"name": name, "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"success": True, "id": str(res.inserted_id)}


@admin_ext_router.put("/business-types/{bt_id}")
async def admin_update_business_type(bt_id: str, request: Request):
    await admin_required(request)
    body = await request.json()
    allowed = {k: body[k] for k in ["name", "is_active"] if k in body}
    try:
        await db.business_types.update_one({"_id": ObjectId(bt_id)}, {"$set": allowed})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    return {"success": True}


@admin_ext_router.delete("/business-types/{bt_id}")
async def admin_delete_business_type(bt_id: str, request: Request):
    await admin_required(request)
    try:
        await db.business_types.delete_one({"_id": ObjectId(bt_id)})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    return {"success": True}


# ─── Admin profile (update own name) ─────────────────────
@admin_ext_router.put("/profile")
async def admin_update_profile(request: Request):
    user = await admin_required(request)
    body = await request.json()
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name required")
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"name": name}})
    return {"success": True, "name": name}


# ─── Listings count (moderation pagination) ──────────────
@admin_ext_router.get("/listings-count/{listing_type}")
async def listings_count(listing_type: str, request: Request, status: Optional[str] = None,
                         search: Optional[str] = None):
    await admin_required(request)
    col_map = {"agriculture": db.agriculture, "services": db.services,
               "classifieds": db.classifieds, "stores": db.stores}
    col = col_map.get(listing_type)
    if col is None:
        raise HTTPException(400, "Invalid listing type")
    q = {}
    if status: q["status"] = status
    if search:
        q["$or"] = [{"product_name": {"$regex": search, "$options": "i"}},
                    {"service_name": {"$regex": search, "$options": "i"}},
                    {"title": {"$regex": search, "$options": "i"}},
                    {"business_name": {"$regex": search, "$options": "i"}}]
    return {"total": await col.count_documents(q)}
