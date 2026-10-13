from fastapi import APIRouter, Query
from typing import Optional
import logging

from database import db
from auth_utils import doc

logger = logging.getLogger(__name__)
search_router = APIRouter(tags=["Search"])

@search_router.get("/search")
async def unified_search(
    q: str = Query(..., min_length=1),
    type: Optional[str] = None,
    locality: Optional[str] = None,
    city: Optional[str] = None,
    limit: int = 10
):
    q = q.strip()
    results = {"stores": [], "products": [], "agriculture": [], "services": [], "classifieds": []}
    regex = {"$regex": q, "$options": "i"}
    loc_filter = {}
    if locality: loc_filter["locality"] = {"$regex": locality, "$options": "i"}
    if city: loc_filter["city"] = {"$regex": city, "$options": "i"}
    
    async def search_collection(col, query_fields, extra_filter=None):
        q_filter = {"$or": [{f: regex} for f in query_fields]}
        if extra_filter:
            q_filter.update(extra_filter)
        items = await col.find(q_filter).limit(limit).to_list(limit)
        return [doc(i) for i in items]
    
    if not type or type == "stores":
        results["stores"] = await search_collection(
            db.stores, ["business_name", "description", "categories"],
            {"status": "published", **loc_filter})
    
    if not type or type == "products":
        results["products"] = await search_collection(
            db.products, ["name", "description", "category"],
            {"status": "active", "store_id": {"$in": [str(s["_id"]) for s in await db.stores.find({"status": "published"}, {"_id": 1}).to_list(5000)]}})
    
    if not type or type == "agriculture":
        results["agriculture"] = await search_collection(
            db.agriculture, ["product_name", "description", "category"],
            {"status": "published", **loc_filter})
    
    if not type or type == "services":
        results["services"] = await search_collection(
            db.services, ["service_name", "description", "category"],
            {"status": "published", **loc_filter})
    
    if not type or type == "classifieds":
        results["classifieds"] = await search_collection(
            db.classifieds, ["title", "description", "category"],
            {"status": "published", **loc_filter})
    
    total = sum(len(v) for v in results.values())
    return {"query": q, "total": total, "results": results}
