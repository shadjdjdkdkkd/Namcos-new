from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
import logging

from database import db
from auth_utils import get_current_user, doc

logger = logging.getLogger(__name__)
common_router = APIRouter(tags=["Common"])

@common_router.get("/banners")
async def get_public_banners():
    banners = await db.banners.find({"is_active": True}).sort("display_order", 1).to_list(10)
    return [doc(b) for b in banners]

@common_router.get("/wallet/balance")
async def get_wallet_balance(request: Request):
    user = await get_current_user(request, db)
    wallet = await db.wallet.find_one({"user_id": user["id"]})
    bal = (wallet or {}).get("balance", 0.0)
    return {"balance": round(bal, 2), "pending_balance": 0.0, "currency": "INR",
            "total_topped_up": round((wallet or {}).get("total_topped_up", 0.0), 2)}

@common_router.get("/wallet/transactions")
async def get_wallet_transactions(request: Request, limit: int = 50):
    user = await get_current_user(request, db)
    txns = await db.wallet_transactions.find(
        {"user_id": user["id"]}).sort("created_at", -1).limit(limit).to_list(limit)
    return [doc(t) for t in txns]

# ─── CATEGORIES ───────────────────────────────────────────

@common_router.get("/categories")
async def get_categories(type: Optional[str] = None):
    query = {}
    if type: query["type"] = type
    cats = await db.categories.find(query).to_list(100)
    return [doc(c) for c in cats]

# ─── NOTIFICATIONS ────────────────────────────────────────

@common_router.get("/notifications")
async def get_notifications(request: Request, skip: int = 0, limit: int = 30):
    user = await get_current_user(request, db)
    notifs = await db.notifications.find(
        {"user_id": user["id"]}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    unread = await db.notifications.count_documents({"user_id": user["id"], "is_read": False})
    return {"notifications": [doc(n) for n in notifs], "unread_count": unread}

@common_router.put("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, request: Request):
    user = await get_current_user(request, db)
    try:
        await db.notifications.update_one(
            {"_id": ObjectId(notif_id), "user_id": user["id"]},
            {"$set": {"is_read": True}})
    except Exception:
        raise HTTPException(400, "Invalid notification ID")
    return {"success": True}

@common_router.put("/notifications/read-all")
async def mark_all_read(request: Request):
    user = await get_current_user(request, db)
    await db.notifications.update_many({"user_id": user["id"], "is_read": False},
                                        {"$set": {"is_read": True}})
    return {"success": True}

# ─── SUPPORT TICKETS ────────────────────────────────────

class SupportTicketCreate(BaseModel):
    subject: str
    description: str
    category: str = "other"
    related_order_id: Optional[str] = None
    related_payment_id: Optional[str] = None

@common_router.post("/support/tickets")
async def create_ticket(req: SupportTicketCreate, request: Request):
    user = await get_current_user(request, db)
    import time, random
    ticket_id = f"TKT{int(time.time())}{random.randint(100, 999)}"
    doc_data = {
        **req.dict(), "ticket_id": ticket_id,
        "user_id": user["id"], "user_name": user.get("name"),
        "status": "open", "messages": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.support_tickets.insert_one(doc_data)
    await db.notifications.insert_one({
        "user_id": "admin", "title": "New Support Ticket",
        "message": f"Ticket #{ticket_id}: {req.subject}",
        "type": "support", "entity_id": str(result.inserted_id),
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "ticket_id": ticket_id, "id": str(result.inserted_id)}

@common_router.get("/support/tickets/my")
async def get_my_tickets(request: Request):
    user = await get_current_user(request, db)
    tickets = await db.support_tickets.find(
        {"user_id": user["id"]}).sort("created_at", -1).to_list(50)
    return [doc(t) for t in tickets]

@common_router.get("/support/tickets")
async def get_all_tickets(request: Request, status: Optional[str] = None, skip: int = 0, limit: int = 50):
    user = await get_current_user(request, db)
    if not any(r in user.get("roles", []) for r in ["admin", "super_admin"]):
        raise HTTPException(403, "Admin access required")
    query = {}
    if status: query["status"] = status
    tickets = await db.support_tickets.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(t) for t in tickets]

# ─── REVIEWS ──────────────────────────────────────────────

class ReviewCreate(BaseModel):
    entity_type: str  # store, product, service
    entity_id: str
    rating: int  # 1-5
    review_text: Optional[str] = None
    images: List[str] = []

@common_router.post("/reviews")
async def create_review(req: ReviewCreate, request: Request):
    user = await get_current_user(request, db)
    if not 1 <= req.rating <= 5:
        raise HTTPException(400, "Rating must be between 1 and 5")
    
    existing = await db.reviews.find_one({
        "user_id": user["id"], "entity_type": req.entity_type, "entity_id": req.entity_id})
    if existing:
        raise HTTPException(400, "You have already reviewed this")
    
    review_doc = {
        **req.dict(), "user_id": user["id"], "user_name": user.get("name"),
        "status": "approved", "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reviews.insert_one(review_doc)
    
    # Update entity rating
    all_reviews = await db.reviews.find(
        {"entity_type": req.entity_type, "entity_id": req.entity_id, "status": "approved"}).to_list(1000)
    avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    
    col_map = {"store": db.stores, "product": db.products, "service": db.services}
    if req.entity_type in col_map:
        try:
            await col_map[req.entity_type].update_one(
                {"_id": ObjectId(req.entity_id)},
                {"$set": {"rating": round(avg_rating, 1), "review_count": len(all_reviews)}})
        except Exception:
            pass
    
    return {"success": True}

@common_router.get("/reviews/{entity_type}/{entity_id}")
async def get_reviews(entity_type: str, entity_id: str, skip: int = 0, limit: int = 20):
    reviews = await db.reviews.find(
        {"entity_type": entity_type, "entity_id": entity_id, "status": "approved"}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(r) for r in reviews]

# ─── DISCOUNTS CHECK ──────────────────────────────────────

@common_router.get("/discounts/applicable")
async def get_applicable_discounts(store_id: Optional[str] = None, amount: Optional[float] = None):
    query = {"is_active": True}
    if store_id:
        query["$or"] = [{"store_id": store_id}, {"store_id": None}, {"store_id": {"$exists": False}}]
    discounts = await db.discounts.find(query).to_list(50)
    
    if amount is not None:
        applicable = []
        for d in discounts:
            d = doc(d)
            min_amt = d.get("min_invoice_amount", 0)
            if amount >= min_amt:
                if d["discount_type"] == "percentage":
                    disc_val = amount * d["discount_value"] / 100
                else:
                    disc_val = d["discount_value"]
                max_disc = d.get("max_discount", 999999)
                d["calculated_discount"] = min(disc_val, max_disc)
                d["final_amount"] = amount - d["calculated_discount"]
                applicable.append(d)
        return applicable
    
    return [doc(d) for d in discounts]
