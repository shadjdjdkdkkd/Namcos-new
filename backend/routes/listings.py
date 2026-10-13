from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
import logging

from database import db
from auth_utils import get_current_user, doc, ensure_visible

logger = logging.getLogger(__name__)
listings_router = APIRouter(tags=["Listings"])

# ─── AGRICULTURE ───────────────────────────────────────────

class AgricultureSubmit(BaseModel):
    product_name: str
    category: str
    subcategory: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []
    unit: str = "kg"
    price: float
    min_quantity: float = 1.0
    available_quantity: float
    availability: str = "available"
    quality_info: Optional[str] = None
    harvest_date: Optional[str] = None
    is_organic: bool = False
    storage_info: Optional[str] = None
    pickup_available: bool = True
    delivery_available: bool = False
    bulk_available: bool = False
    locality: str
    area: Optional[str] = None
    city: str
    state: str
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@listings_router.get("/agriculture")
async def list_agriculture(locality: Optional[str] = None, city: Optional[str] = None,
                            category: Optional[str] = None, search: Optional[str] = None,
                            skip: int = 0, limit: int = 20):
    query = {"status": "published"}
    if locality: query["locality"] = {"$regex": locality, "$options": "i"}
    if city: query["city"] = {"$regex": city, "$options": "i"}
    if category: query["category"] = {"$regex": category, "$options": "i"}
    if search: query["product_name"] = {"$regex": search, "$options": "i"}
    items = await db.agriculture.find(query).skip(skip).limit(limit).to_list(limit)
    return [doc(i) for i in items]

@listings_router.get("/agriculture/{listing_id}")
async def get_agriculture(listing_id: str, request: Request):
    try:
        item = await db.agriculture.find_one({"_id": ObjectId(listing_id)})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    if not item: raise HTTPException(404, "Listing not found")
    await ensure_visible(item, "seller_id", request, db)
    d = doc(item)
    cat = await db.categories.find_one({"slug": "agriculture"})
    if cat and cat.get("support_phone"):
        d["category_support_phone"] = cat["support_phone"]
        d["support_phone"] = cat["support_phone"]
    return d

@listings_router.post("/agriculture/submit")
async def submit_agriculture(req: AgricultureSubmit, request: Request):
    user = await get_current_user(request, db)
    if len(req.images) < 4:
        raise HTTPException(400, "At least 4 images are required")
    if not req.locality or not req.city:
        raise HTTPException(400, "Location is required")
    listing_doc = {
        **req.dict(), "seller_id": user["id"], "seller_name": user.get("name"),
        "seller_phone": user.get("phone"), "status": "submitted",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.agriculture.insert_one(listing_doc)
    lid = str(result.inserted_id)
    await db.notifications.insert_one({
        "user_id": "admin", "title": "New Agriculture Listing",
        "message": f"'{req.product_name}' submitted by {user.get('name')}",
        "type": "agriculture_submission", "entity_id": lid, "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "listing_id": lid, "status": "submitted"}

@listings_router.get("/merchant/agriculture")
async def get_my_agriculture(request: Request):
    user = await get_current_user(request, db)
    items = await db.agriculture.find({"seller_id": user["id"]}).sort("created_at", -1).to_list(100)
    return [doc(i) for i in items]

# ─── SERVICES ────────────────────────────────────────────

class ServiceSubmit(BaseModel):
    service_name: str
    provider_name: str
    business_name: Optional[str] = None
    phone: str
    email: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    description: str
    images: List[str] = []
    experience_years: int = 0
    languages: List[str] = ["Malayalam", "English"]
    starting_price: Optional[float] = None
    hourly_price: Optional[float] = None
    visit_charge: Optional[float] = None
    emergency_charge: Optional[float] = None
    price_negotiable: bool = True
    locality: str
    area: Optional[str] = None
    city: str
    state: str
    pincode: Optional[str] = None
    service_radius: float = 5.0
    working_days: List[str] = ["Mon","Tue","Wed","Thu","Fri","Sat"]
    opening_time: str = "09:00"
    closing_time: str = "18:00"
    emergency_available: bool = False
    booking_required: bool = True

@listings_router.get("/services")
async def list_services(locality: Optional[str] = None, city: Optional[str] = None,
                        category: Optional[str] = None, search: Optional[str] = None,
                        skip: int = 0, limit: int = 20):
    query = {"status": "published"}
    if locality: query["locality"] = {"$regex": locality, "$options": "i"}
    if city: query["city"] = {"$regex": city, "$options": "i"}
    if category: query["category"] = {"$regex": category, "$options": "i"}
    if search:
        query["$or"] = [{"service_name": {"$regex": search, "$options": "i"}},
                        {"description": {"$regex": search, "$options": "i"}}]
    items = await db.services.find(query).skip(skip).limit(limit).to_list(limit)
    return [doc(i) for i in items]

@listings_router.get("/services/{service_id}")
async def get_service(service_id: str, request: Request):
    try:
        item = await db.services.find_one({"_id": ObjectId(service_id)})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    if not item: raise HTTPException(404, "Service not found")
    await ensure_visible(item, "provider_id", request, db)
    d = doc(item)
    cat = await db.categories.find_one({"slug": "services"})
    if cat and cat.get("support_phone"):
        d["category_support_phone"] = cat["support_phone"]
        d["support_phone"] = cat["support_phone"]
    return d

@listings_router.post("/services/submit")
async def submit_service(req: ServiceSubmit, request: Request):
    user = await get_current_user(request, db)
    if len(req.images) < 4:
        raise HTTPException(400, "At least 4 images are required")
    if not req.locality or not req.city:
        raise HTTPException(400, "Location is required")
    svc_doc = {
        **req.dict(), "provider_id": user["id"], "status": "submitted",
        "rating": 0.0, "completed_jobs": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.services.insert_one(svc_doc)
    lid = str(result.inserted_id)
    await db.notifications.insert_one({
        "user_id": "admin", "title": "New Service Provider",
        "message": f"'{req.service_name}' submitted by {user.get('name')}",
        "type": "service_submission", "entity_id": lid, "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "service_id": lid, "status": "submitted"}

# ─── CLASSIFIEDS ──────────────────────────────────────────

class ClassifiedSubmit(BaseModel):
    title: str
    category: str
    subcategory: Optional[str] = None
    images: List[str] = []
    condition: str = "good"
    price: Optional[float] = None
    description: str
    locality: str
    city: str
    state: str
    contact_preference: str = "chat"
    is_negotiable: bool = True

@listings_router.get("/classifieds")
async def list_classifieds(locality: Optional[str] = None, city: Optional[str] = None,
                           category: Optional[str] = None, search: Optional[str] = None,
                           skip: int = 0, limit: int = 20):
    query = {"status": "published"}
    if locality: query["locality"] = {"$regex": locality, "$options": "i"}
    if city: query["city"] = {"$regex": city, "$options": "i"}
    if category: query["category"] = {"$regex": category, "$options": "i"}
    if search: query["title"] = {"$regex": search, "$options": "i"}
    items = await db.classifieds.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(i) for i in items]

@listings_router.get("/classifieds/{classified_id}")
async def get_classified(classified_id: str, request: Request):
    try:
        item = await db.classifieds.find_one({"_id": ObjectId(classified_id)})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    if not item: raise HTTPException(404, "Classified not found")
    await ensure_visible(item, "seller_id", request, db)
    d = doc(item)
    cat = await db.categories.find_one({"slug": "classifieds"})
    if cat and cat.get("support_phone"):
        d["category_support_phone"] = cat["support_phone"]
        d["support_phone"] = cat["support_phone"]
    return d

@listings_router.post("/classifieds/submit")
async def submit_classified(req: ClassifiedSubmit, request: Request):
    user = await get_current_user(request, db)
    if len(req.images) < 4:
        raise HTTPException(400, "At least 4 images are required")
    if not req.locality or not req.city:
        raise HTTPException(400, "Location is required")
    cl_doc = {
        **req.dict(), "seller_id": user["id"], "seller_name": user.get("name"),
        "seller_phone": user.get("phone"),
        "status": "submitted", "view_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.classifieds.insert_one(cl_doc)
    lid = str(result.inserted_id)
    await db.notifications.insert_one({
        "user_id": "admin", "title": "New Classified Listing",
        "message": f"'{req.title}' submitted for moderation",
        "type": "classified_submission", "entity_id": lid, "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "listing_id": lid, "status": "submitted"}

@listings_router.get("/merchant/classifieds")
async def get_my_classifieds(request: Request):
    user = await get_current_user(request, db)
    items = await db.classifieds.find({"seller_id": user["id"]}).sort("created_at", -1).to_list(100)
    return [doc(i) for i in items]
