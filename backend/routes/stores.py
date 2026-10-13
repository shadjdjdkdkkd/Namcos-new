from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
import logging

from database import db
from auth_utils import get_current_user, doc, ensure_visible, PROTECTED_LISTING_FIELDS

logger = logging.getLogger(__name__)
stores_router = APIRouter(tags=["Stores"])

class StoreSubmitRequest(BaseModel):
    business_name: str
    business_type: str
    owner_name: str
    phone: str
    email: Optional[str] = None
    gst_number: Optional[str] = None
    description: str = ""
    address: str = ""
    locality: str
    area: Optional[str] = None
    city: str
    state: str
    pincode: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    landmark: Optional[str] = None
    opening_time: str = "09:00"
    closing_time: str = "21:00"
    operating_days: List[str] = ["Mon","Tue","Wed","Thu","Fri","Sat"]
    delivery_available: bool = False
    pickup_available: bool = True
    service_radius: float = 5.0
    categories: List[str] = []
    subcategory: Optional[str] = None
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    account_holder: Optional[str] = None
    upi_id: Optional[str] = None
    images: List[str] = []

@stores_router.get("/stores")
async def list_stores(locality: Optional[str] = None, city: Optional[str] = None,
                      category: Optional[str] = None, subcategory: Optional[str] = None,
                      search: Optional[str] = None,
                      skip: int = 0, limit: int = 20):
    query = {"status": "published"}
    if locality:
        query["locality"] = {"$regex": locality, "$options": "i"}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if category:
        query["categories"] = {"$in": [category]}
    if subcategory:
        query["subcategory"] = subcategory
    if search:
        query["$or"] = [{"business_name": {"$regex": search, "$options": "i"}},
                        {"description": {"$regex": search, "$options": "i"}}]
    stores = await db.stores.find(query).skip(skip).limit(limit).to_list(limit)
    return [doc(s) for s in stores]

@stores_router.get("/stores/{store_id}")
async def get_store(store_id: str, request: Request):
    try:
        store = await db.stores.find_one({"_id": ObjectId(store_id)})
    except Exception:
        raise HTTPException(400, "Invalid store ID")
    if not store:
        raise HTTPException(404, "Store not found")
    await ensure_visible(store, "owner_id", request, db)
    d = doc(store)
    cat_slug = (store.get("categories") or ["shops"])[0]
    cat = await db.categories.find_one({"slug": cat_slug}) or await db.categories.find_one({"slug": "shops"})
    if cat and cat.get("support_phone"):
        d["category_support_phone"] = cat["support_phone"]
        d["support_phone"] = cat["support_phone"]
    return d

@stores_router.post("/stores/submit")
async def submit_store(req: StoreSubmitRequest, request: Request):
    user = await get_current_user(request, db)
    if len(req.images) < 4:
        raise HTTPException(400, "At least 4 images are required")
    if not req.locality or not req.city:
        raise HTTPException(400, "Location (locality + city) is required")
    body = req.dict()
    images = body.pop("images", [])
    store_doc = {**body, "owner_id": user["id"], "status": "submitted",
                 "rating": 0.0, "review_count": 0,
                 "logo": images[0] if images else None,
                 "cover_image": None, "images": images, "verified": False,
                 "rejection_reason": None, "created_at": datetime.now(timezone.utc).isoformat()}
    result = await db.stores.insert_one(store_doc)
    sid = str(result.inserted_id)
    await db.audit_logs.insert_one({
        "actor_id": user["id"], "actor_name": user.get("name"),
        "action": "store_submitted", "entity_type": "store", "entity_id": sid,
        "details": {"business_name": req.business_name},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    await db.notifications.insert_one({
        "user_id": "admin", "title": "New Store Submission",
        "message": f"'{req.business_name}' submitted for review by {user.get('name')}",
        "type": "store_submission", "entity_type": "store", "entity_id": sid,
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "store_id": sid, "status": "submitted"}

@stores_router.get("/merchant/stores")
async def get_merchant_stores(request: Request):
    user = await get_current_user(request, db)
    stores = await db.stores.find({"owner_id": user["id"]}).to_list(100)
    return [doc(s) for s in stores]

@stores_router.put("/merchant/stores/{store_id}")
async def update_store(store_id: str, request: Request):
    user = await get_current_user(request, db)
    updates = await request.json()
    try:
        store = await db.stores.find_one({"_id": ObjectId(store_id), "owner_id": user["id"]})
    except Exception:
        raise HTTPException(400, "Invalid store ID")
    if not store:
        raise HTTPException(404, "Store not found or unauthorized")
    for f in PROTECTED_LISTING_FIELDS:
        updates.pop(f, None)
    await db.stores.update_one({"_id": ObjectId(store_id)}, {"$set": updates})
    return {"success": True}

@stores_router.get("/merchant/dashboard/stats")
async def merchant_dashboard_stats(request: Request, store_id: Optional[str] = None):
    user = await get_current_user(request, db)
    sq = {"owner_id": user["id"]}
    if store_id:
        try: sq["_id"] = ObjectId(store_id)
        except Exception: pass
    stores = await db.stores.find(sq).to_list(100)
    sids = [str(s["_id"]) for s in stores]
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    total_orders = await db.orders.count_documents({"store_id": {"$in": sids}})
    today_orders = await db.orders.count_documents({"store_id": {"$in": sids}, "created_at": {"$gte": today}})
    pending_orders = await db.orders.count_documents({"store_id": {"$in": sids},
                                                       "fulfillment_status": {"$in": ["confirmed","preparing","ready"]}})
    
    payments = await db.payments.find({"merchant_id": user["id"], "status": "captured"}).to_list(1000)
    total_received = sum(p.get("merchant_amount", 0) for p in payments)
    
    settlements = await db.settlements.find({"merchant_id": user["id"]}).to_list(1000)
    pending_settlement = sum(s.get("net_amount", 0) for s in settlements if s.get("status") == "pending")
    available_balance = sum(s.get("net_amount", 0) for s in settlements if s.get("status") == "available")
    
    withdrawals = await db.withdrawals.find({"merchant_id": user["id"], "status": "paid"}).to_list(1000)
    total_withdrawn = sum(w.get("amount", 0) for w in withdrawals)
    
    recent_orders = await db.orders.find({"store_id": {"$in": sids}}).sort("created_at", -1).limit(5).to_list(5)
    for o in recent_orders:
        o["id"] = str(o["_id"]); o["_id"] = str(o["_id"])
    
    recent_payments = await db.payments.find({"merchant_id": user["id"]}).sort("created_at", -1).limit(5).to_list(5)
    for p in recent_payments:
        p["id"] = str(p["_id"]); p["_id"] = str(p["_id"])
    
    return {
        "stores": [doc(s) for s in stores], "total_orders": total_orders,
        "today_orders": today_orders, "pending_orders": pending_orders,
        "total_received": total_received, "pending_settlement": pending_settlement,
        "available_balance": available_balance, "total_withdrawn": total_withdrawn,
        "total_products": await db.products.count_documents({"merchant_id": user["id"]}),
        "recent_orders": recent_orders, "recent_payments": recent_payments
    }
