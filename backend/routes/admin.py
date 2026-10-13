from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional
import logging

from database import db
from auth_utils import get_current_user, require_roles, doc

logger = logging.getLogger(__name__)
admin_router = APIRouter(prefix="/admin", tags=["Admin"])

async def admin_required(request: Request):
    user = await get_current_user(request, db)
    require_roles(user, ["admin", "super_admin"])
    return user

async def audit(actor: dict, action: str, entity_type: str, entity_id: str, details: dict = None):
    await db.audit_logs.insert_one({
        "actor_id": actor["id"], "actor_name": actor.get("name"),
        "actor_roles": actor.get("roles", []),
        "action": action, "entity_type": entity_type, "entity_id": entity_id,
        "details": details or {}, "timestamp": datetime.now(timezone.utc).isoformat()
    })

@admin_router.get("/stats")
async def get_admin_stats(request: Request):
    await admin_required(request)
    total_users = await db.users.count_documents({})
    active_stores = await db.stores.count_documents({"status": "published"})
    pending_stores = await db.stores.count_documents({"status": "submitted"})
    total_orders = await db.orders.count_documents({})
    pending_withdrawals = await db.withdrawals.count_documents({"status": {"$in": ["requested", "under_review"]}})
    open_tickets = await db.support_tickets.count_documents({"status": {"$in": ["open", "in_progress"]}})
    
    payments = await db.payments.find({"status": "captured"}).to_list(10000)
    gmv = sum(p.get("gross_amount", 0) for p in payments)
    net_revenue = sum(p.get("platform_fee", 0) for p in payments)
    
    pending_moderation = (await db.agriculture.count_documents({"status": "submitted"}) +
                          await db.services.count_documents({"status": "submitted"}) +
                          await db.classifieds.count_documents({"status": "submitted"}))
    
    return {
        "total_users": total_users,
        "active_stores": active_stores,
        "pending_stores": pending_stores,
        "total_orders": total_orders,
        "gmv": gmv,
        "net_revenue": net_revenue,
        "pending_withdrawals": pending_withdrawals,
        "open_support_tickets": open_tickets,
        "pending_moderation": pending_moderation,
        "total_payments": len(payments)
    }

@admin_router.get("/users")
async def get_users(request: Request, search: Optional[str] = None,
                    role: Optional[str] = None, skip: int = 0, limit: int = 50):
    await admin_required(request)
    query = {}
    if search:
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}},
                        {"phone": {"$regex": search, "$options": "i"}},
                        {"email": {"$regex": search, "$options": "i"}}]
    if role:
        query["roles"] = {"$in": [role]}
    users = await db.users.find(query, {"password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    for u in users:
        u["id"] = str(u["_id"]); u["_id"] = str(u["_id"])
    return users

@admin_router.put("/users/{user_id}")
async def update_user(user_id: str, request: Request):
    actor = await admin_required(request)
    body = await request.json()
    # Only allow updating roles and is_active status
    allowed = {}
    if "roles" in body:
        allowed["roles"] = body["roles"]
    if "is_active" in body:
        allowed["is_active"] = body["is_active"]
    if not allowed:
        raise HTTPException(400, "No valid fields to update")
    try:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": allowed})
    except Exception:
        raise HTTPException(400, "Invalid user ID")
    await audit(actor, "user_updated", "user", user_id, allowed)
    return {"success": True}

@admin_router.get("/merchants")
async def get_merchants(request: Request, status: Optional[str] = None,
                        locality: Optional[str] = None, search: Optional[str] = None,
                        skip: int = 0, limit: int = 50):
    await admin_required(request)
    query = {}
    if status: query["status"] = status
    if locality: query["locality"] = {"$regex": locality, "$options": "i"}
    if search:
        query["$or"] = [{"business_name": {"$regex": search, "$options": "i"}},
                        {"owner_name": {"$regex": search, "$options": "i"}}]
    stores = await db.stores.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(s) for s in stores]

@admin_router.put("/merchants/{store_id}/status")
async def update_merchant_status(store_id: str, request: Request):
    actor = await admin_required(request)
    body = await request.json()
    new_status = body.get("status")
    reason = body.get("reason", "")
    
    valid_statuses = ["approved", "rejected", "suspended", "published", "under_review"]
    if new_status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid_statuses}")
    
    try:
        store = await db.stores.find_one({"_id": ObjectId(store_id)})
    except Exception:
        raise HTTPException(400, "Invalid store ID")
    if not store:
        raise HTTPException(404, "Store not found")
    
    update_data = {"status": new_status, "rejection_reason": reason if new_status == "rejected" else None}
    if new_status == "published":
        update_data["approved_at"] = datetime.now(timezone.utc).isoformat()
        update_data["approved_by"] = actor["id"]
        update_data["verified"] = True
    
    await db.stores.update_one({"_id": ObjectId(store_id)}, {"$set": update_data})
    
    # When approving a store, grant merchant role to owner
    if new_status == "published":
        owner_id = store.get("owner_id")
        if owner_id and owner_id != "demo":
            try:
                await db.users.update_one(
                    {"_id": ObjectId(owner_id)},
                    {"$addToSet": {"roles": "merchant"}}
                )
            except Exception:
                pass
    
    # Add merchant role to owner if approved
    if new_status == "published":
        await db.users.update_one({"_id": ObjectId(store["owner_id"])},
                                   {"$addToSet": {"roles": "merchant"}})
    
    # Notify store owner
    msg = (f"Your store '{store['business_name']}' has been {new_status}." +
           (f" Reason: {reason}" if reason and new_status == "rejected" else ""))
    await db.notifications.insert_one({
        "user_id": store["owner_id"], "title": f"Store {new_status.title()}",
        "message": msg, "type": "store_update", "entity_id": store_id,
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await audit(actor, f"store_{new_status}", "store", store_id,
                {"business_name": store["business_name"], "reason": reason})
    return {"success": True}

@admin_router.get("/orders")
async def get_all_orders(request: Request, status: Optional[str] = None,
                         skip: int = 0, limit: int = 50):
    await admin_required(request)
    query = {}
    if status: query["fulfillment_status"] = status
    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(o) for o in orders]

@admin_router.get("/payments")
async def get_all_payments(request: Request, status: Optional[str] = None,
                            skip: int = 0, limit: int = 50):
    await admin_required(request)
    query = {}
    if status: query["status"] = status
    payments = await db.payments.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(p) for p in payments]

@admin_router.get("/withdrawals")
async def get_all_withdrawals(request: Request, status: Optional[str] = None,
                               skip: int = 0, limit: int = 50):
    await admin_required(request)
    query = {}
    if status: query["status"] = status
    withdrawals = await db.withdrawals.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(w) for w in withdrawals]

@admin_router.put("/withdrawals/{withdrawal_id}/status")
async def update_withdrawal_status(withdrawal_id: str, request: Request):
    actor = await admin_required(request)
    body = await request.json()
    new_status = body.get("status")
    notes = body.get("notes", "")
    
    valid_statuses = ["under_review", "approved", "processing", "paid", "rejected", "on_hold", "reversed"]
    if new_status not in valid_statuses:
        raise HTTPException(400, f"Invalid status")
    
    try:
        wd = await db.withdrawals.find_one({"_id": ObjectId(withdrawal_id)})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    if not wd: raise HTTPException(404, "Withdrawal not found")
    
    update_data = {"status": new_status, "admin_notes": notes,
                   "processed_by": actor["id"],
                   "processed_at": datetime.now(timezone.utc).isoformat()}
    await db.withdrawals.update_one({"_id": ObjectId(withdrawal_id)}, {"$set": update_data})
    
    # Wallet-type withdrawal (from user wallet balance): refund on rejection
    if wd.get("type") == "wallet":
        if new_status in ("rejected", "reversed"):
            refund_now = datetime.now(timezone.utc).isoformat()
            await db.wallet.update_one({"user_id": wd["user_id"]}, {"$inc": {"balance": wd["amount"]}})
            await db.wallet_transactions.insert_one({
                "user_id": wd["user_id"], "type": "credit", "source": "refund",
                "amount": wd["amount"], "reference_id": withdrawal_id,
                "note": "Withdrawal rejected — refunded to wallet", "created_at": refund_now})
        await db.notifications.insert_one({
            "user_id": wd["user_id"], "title": f"Withdrawal {new_status.title()}",
            "message": f"Your withdrawal of ₹{wd['amount']:.0f} is {new_status}." + (f" {notes}" if notes else ""),
            "type": "withdrawal", "entity_id": withdrawal_id,
            "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()})
        await audit(actor, f"withdrawal_{new_status}", "withdrawal", withdrawal_id,
                    {"amount": wd["amount"], "user_id": wd["user_id"], "notes": notes})
        return {"success": True}

    # If paid, mark settlements as withdrawn
    if new_status == "paid":
        settlements = await db.settlements.find(
            {"merchant_id": wd["merchant_id"], "status": "available"}).to_list(1000)
        amt_to_mark = wd["amount"]
        for s in settlements:
            if amt_to_mark <= 0: break
            amt_to_mark -= s["net_amount"]
            await db.settlements.update_one({"_id": s["_id"]}, {"$set": {"status": "withdrawn"}})
    
    # Notify merchant
    await db.notifications.insert_one({
        "user_id": wd["merchant_id"], "title": f"Withdrawal {new_status.title()}",
        "message": f"Your withdrawal of ₹{wd['amount']:.0f} is {new_status}." + (f" {notes}" if notes else ""),
        "type": "withdrawal", "entity_id": withdrawal_id,
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await audit(actor, f"withdrawal_{new_status}", "withdrawal", withdrawal_id,
                {"amount": wd["amount"], "merchant_id": wd["merchant_id"], "notes": notes})
    return {"success": True}

@admin_router.get("/listings/{listing_type}")
async def get_listings(listing_type: str, request: Request, status: Optional[str] = None,
                       search: Optional[str] = None, skip: int = 0, limit: int = 50):
    await admin_required(request)
    collection_map = {"agriculture": db.agriculture, "services": db.services, "classifieds": db.classifieds}
    if listing_type not in collection_map:
        raise HTTPException(400, "Invalid listing type")
    col = collection_map[listing_type]
    query = {}
    if status: query["status"] = status
    if search:
        query["$or"] = [{"product_name": {"$regex": search, "$options": "i"}},
                        {"service_name": {"$regex": search, "$options": "i"}},
                        {"title": {"$regex": search, "$options": "i"}},
                        {"description": {"$regex": search, "$options": "i"}}]
    items = await col.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(i) for i in items]

@admin_router.put("/listings/{listing_type}/{listing_id}/status")
async def update_listing_status(listing_type: str, listing_id: str, request: Request):
    actor = await admin_required(request)
    body = await request.json()
    new_status = body.get("status")
    reason = body.get("reason", "")
    
    collection_map = {"agriculture": db.agriculture, "services": db.services, "classifieds": db.classifieds}
    if listing_type not in collection_map:
        raise HTTPException(400, "Invalid listing type")
    col = collection_map[listing_type]
    
    try:
        item = await col.find_one({"_id": ObjectId(listing_id)})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    if not item: raise HTTPException(404, "Listing not found")
    
    await col.update_one({"_id": ObjectId(listing_id)},
                          {"$set": {"status": new_status, "rejection_reason": reason,
                                    "reviewed_by": actor["id"],
                                    "reviewed_at": datetime.now(timezone.utc).isoformat()}})
    
    seller_id = item.get("seller_id") or item.get("provider_id")
    if seller_id:
        await db.notifications.insert_one({
            "user_id": seller_id, "title": f"Listing {new_status.title()}",
            "message": f"Your listing '{item.get('product_name') or item.get('service_name') or item.get('title')}' has been {new_status}.",
            "type": "listing_update", "entity_id": listing_id,
            "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
        })
    await audit(actor, f"listing_{new_status}", listing_type, listing_id, {"reason": reason})
    return {"success": True}

@admin_router.get("/discounts")
async def get_discounts(request: Request):
    await admin_required(request)
    discounts = await db.discounts.find({}).sort("created_at", -1).to_list(200)
    return [doc(d) for d in discounts]

@admin_router.post("/discounts")
async def create_discount(request: Request):
    actor = await admin_required(request)
    body = await request.json()
    required = ["name", "discount_type", "discount_value"]
    for f in required:
        if f not in body:
            raise HTTPException(400, f"'{f}' is required")
    body["created_by"] = actor["id"]
    body["usage_count"] = 0
    body["is_active"] = True
    body["created_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.discounts.insert_one(body)
    did = str(result.inserted_id)
    await audit(actor, "discount_created", "discount", did, {"name": body["name"]})
    return {"success": True, "discount_id": did}

@admin_router.put("/discounts/{discount_id}")
async def update_discount(discount_id: str, request: Request):
    actor = await admin_required(request)
    body = await request.json()
    for f in ["_id", "id", "created_by", "usage_count"]:
        body.pop(f, None)
    try:
        await db.discounts.update_one({"_id": ObjectId(discount_id)}, {"$set": body})
    except Exception:
        raise HTTPException(400, "Invalid discount ID")
    await audit(actor, "discount_updated", "discount", discount_id, body)
    return {"success": True}

@admin_router.get("/audit-logs")
async def get_audit_logs(request: Request, skip: int = 0, limit: int = 100):
    await admin_required(request)
    logs = await db.audit_logs.find({}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(l) for l in logs]

@admin_router.get("/notifications")
async def get_admin_notifications(request: Request, skip: int = 0, limit: int = 50):
    await admin_required(request)
    notifs = await db.notifications.find({"user_id": "admin"}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(n) for n in notifs]

@admin_router.get("/discounts/{discount_id}/check")
async def check_discount(discount_id: str, amount: float):
    """Check if a discount applies to a given order amount"""
    try:
        discount = await db.discounts.find_one({"_id": ObjectId(discount_id), "is_active": True})
    except Exception:
        raise HTTPException(400, "Invalid discount ID")
    if not discount:
        raise HTTPException(404, "Discount not found or inactive")
    
    min_amount = discount.get("min_invoice_amount", 0)
    if amount < min_amount:
        return {"applicable": False, "reason": f"Minimum order amount is ₹{min_amount}"}
    
    if discount["discount_type"] == "percentage":
        disc_val = amount * discount["discount_value"] / 100
    else:
        disc_val = discount["discount_value"]
    
    max_disc = discount.get("max_discount", 999999)
    disc_val = min(disc_val, max_disc)
    
    return {"applicable": True, "discount_amount": disc_val,
            "final_amount": amount - disc_val, "discount": doc(discount)}


# ─── BANNERS ──────────────────────────────────────────────

@admin_router.get("/banners")
async def admin_list_banners(request: Request):
    await admin_required(request)
    banners = await db.banners.find({}).sort("display_order", 1).to_list(20)
    return [doc(b) for b in banners]

@admin_router.post("/banners")
async def admin_create_banner(request: Request):
    actor = await admin_required(request)
    body = await request.json()
    banner = {
        "title": body.get("title", ""),
        "subtitle": body.get("subtitle", ""),
        "image_url": body.get("image_url", ""),
        "cta_text": body.get("cta_text", ""),
        "cta_link": body.get("cta_link", ""),
        "is_active": body.get("is_active", True),
        "display_order": body.get("display_order", 99),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.banners.insert_one(banner)
    inserted = await db.banners.find_one({"_id": result.inserted_id})
    return doc(inserted)

@admin_router.put("/banners/{banner_id}")
async def admin_update_banner(banner_id: str, request: Request):
    actor = await admin_required(request)
    body = await request.json()
    allowed = {k: body[k] for k in ["title","subtitle","image_url","cta_text","cta_link","is_active","display_order"] if k in body}
    try:
        await db.banners.update_one({"_id": ObjectId(banner_id)}, {"$set": allowed})
    except Exception:
        raise HTTPException(400, "Invalid banner ID")
    return {"success": True}

@admin_router.delete("/banners/{banner_id}")
async def admin_delete_banner(banner_id: str, request: Request):
    actor = await admin_required(request)
    try:
        await db.banners.delete_one({"_id": ObjectId(banner_id)})
    except Exception:
        raise HTTPException(400, "Invalid banner ID")
    return {"success": True}

# ─── CATEGORIES MANAGEMENT ────────────────────────────────

@admin_router.get("/categories")
async def admin_get_categories(request: Request):
    await admin_required(request)
    cats = await db.categories.find({}).sort("display_order", 1).to_list(50)
    return [doc(c) for c in cats]

@admin_router.put("/categories/{cat_id}")
async def admin_update_category(cat_id: str, request: Request):
    actor = await admin_required(request)
    body = await request.json()
    allowed = {k: body[k] for k in ["name","is_active","icon","color","support_phone","display_order","description","max_distance_km","image_url"] if k in body}
    try:
        await db.categories.update_one({"_id": ObjectId(cat_id)}, {"$set": allowed})
    except Exception:
        raise HTTPException(400, "Invalid category ID")
    await audit(actor, "category_updated", "category", cat_id, allowed)
    return {"success": True}

# ─── PLATFORM SETTINGS ────────────────────────────────────

@admin_router.get("/settings")
async def get_platform_settings(request: Request):
    await admin_required(request)
    settings = await db.settings.find_one({"key": "platform"})
    if not settings:
        return {"max_distance_km": 20, "platform_fee_percent": 2.0, "min_withdrawal_amount": 100}
    return doc(settings)

@admin_router.put("/settings")
async def update_platform_settings(request: Request):
    actor = await admin_required(request)
    body = await request.json()
    allowed = {k: body[k] for k in ["max_distance_km","platform_fee_percent","namcos_earning_percent","referral_percent","min_withdrawal_amount","maintenance_mode"] if k in body}
    await db.settings.update_one({"key": "platform"}, {"$set": allowed}, upsert=True)
    return {"success": True}
