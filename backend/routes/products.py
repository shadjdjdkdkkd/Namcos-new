from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
import logging

from database import db
from auth_utils import get_current_user, doc, ensure_visible

logger = logging.getLogger(__name__)
products_router = APIRouter(tags=["Products"])

class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []
    price: float
    sale_price: Optional[float] = None
    tax_percent: float = 0.0
    unit: str = "piece"
    stock: int = 0
    low_stock_threshold: int = 5
    availability: str = "in_stock"
    delivery_available: bool = True
    pickup_available: bool = True
    return_policy: Optional[str] = None
    store_id: str

@products_router.get("/products")
async def list_products(store_id: Optional[str] = None, category: Optional[str] = None,
                        search: Optional[str] = None, skip: int = 0, limit: int = 40):
    published = [str(s["_id"]) for s in await db.stores.find({"status": "published"}, {"_id": 1}).to_list(5000)]
    query = {"status": "active", "store_id": {"$in": published}}
    if store_id:
        query["store_id"] = store_id
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    products = await db.products.find(query).skip(skip).limit(limit).to_list(limit)
    return [doc(p) for p in products]

@products_router.get("/stores/{store_id}/products")
async def get_store_products(store_id: str, request: Request, skip: int = 0, limit: int = 40):
    try:
        store = await db.stores.find_one({"_id": ObjectId(store_id)})
    except Exception:
        raise HTTPException(400, "Invalid store ID")
    if not store:
        return []
    await ensure_visible(store, "owner_id", request, db)
    products = await db.products.find({"store_id": store_id, "status": "active"}).skip(skip).limit(limit).to_list(limit)
    return [doc(p) for p in products]

@products_router.get("/products/{product_id}")
async def get_product(product_id: str):
    try:
        product = await db.products.find_one({"_id": ObjectId(product_id)})
    except Exception:
        raise HTTPException(400, "Invalid product ID")
    if not product:
        raise HTTPException(404, "Product not found")
    return doc(product)

@products_router.get("/merchant/products")
async def get_merchant_products(request: Request, store_id: Optional[str] = None,
                                 search: Optional[str] = None):
    user = await get_current_user(request, db)
    query = {"merchant_id": user["id"]}
    if store_id:
        query["store_id"] = store_id
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    products = await db.products.find(query).to_list(500)
    return [doc(p) for p in products]

@products_router.post("/merchant/products")
async def create_product(req: ProductCreate, request: Request):
    user = await get_current_user(request, db)
    store = await db.stores.find_one({"_id": ObjectId(req.store_id), "owner_id": user["id"]})
    if not store:
        raise HTTPException(403, "Store not found or unauthorized")
    product_doc = {**req.dict(), "merchant_id": user["id"],
                   "status": "active", "created_at": datetime.now(timezone.utc).isoformat()}
    result = await db.products.insert_one(product_doc)
    return {"success": True, "product_id": str(result.inserted_id)}

@products_router.put("/merchant/products/{product_id}")
async def update_product(product_id: str, request: Request):
    user = await get_current_user(request, db)
    updates = await request.json()
    try:
        product = await db.products.find_one({"_id": ObjectId(product_id), "merchant_id": user["id"]})
    except Exception:
        raise HTTPException(400, "Invalid product ID")
    if not product:
        raise HTTPException(404, "Product not found or unauthorized")
    for f in ["_id", "id", "merchant_id", "store_id"]:
        updates.pop(f, None)
    await db.products.update_one({"_id": ObjectId(product_id)}, {"$set": updates})
    return {"success": True}

@products_router.delete("/merchant/products/{product_id}")
async def delete_product(product_id: str, request: Request):
    user = await get_current_user(request, db)
    try:
        product = await db.products.find_one({"_id": ObjectId(product_id), "merchant_id": user["id"]})
    except Exception:
        raise HTTPException(400, "Invalid product ID")
    if not product:
        raise HTTPException(404, "Product not found or unauthorized")
    await db.products.update_one({"_id": ObjectId(product_id)}, {"$set": {"status": "deleted"}})
    return {"success": True}
