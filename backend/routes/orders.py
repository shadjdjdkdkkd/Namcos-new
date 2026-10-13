from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
import logging, random, time

from database import db
from auth_utils import get_current_user, require_roles, doc

logger = logging.getLogger(__name__)
orders_router = APIRouter(tags=["Orders"])

def gen_order_number():
    return f"ORD{int(time.time())}{random.randint(100, 999)}"

class OrderItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    image: Optional[str] = None

class CreateOrderRequest(BaseModel):
    store_id: str
    items: List[OrderItem]
    delivery_address: Optional[dict] = None
    delivery_fee: float = 0.0
    notes: Optional[str] = None
    discount_rule_id: Optional[str] = None

@orders_router.post("/orders")
async def create_order(req: CreateOrderRequest, request: Request):
    user = await get_current_user(request, db)
    store = await db.stores.find_one({"_id": ObjectId(req.store_id)})
    if not store or store.get("status") != "published":
        raise HTTPException(404, "Store not available")
    
    subtotal = sum(item.quantity * item.unit_price for item in req.items)
    discount_amount = 0.0
    discount_rule = None
    
    if req.discount_rule_id:
        try:
            discount_rule = await db.discounts.find_one({
                "_id": ObjectId(req.discount_rule_id), "is_active": True})
            if discount_rule and subtotal >= discount_rule.get("min_invoice_amount", 0):
                if discount_rule["discount_type"] == "percentage":
                    discount_amount = subtotal * (discount_rule["discount_value"] / 100)
                else:
                    discount_amount = discount_rule["discount_value"]
                max_disc = discount_rule.get("max_discount", 999999)
                discount_amount = min(discount_amount, max_disc)
        except Exception:
            pass
    
    final_amount = subtotal + req.delivery_fee - discount_amount
    
    order_doc = {
        "order_number": gen_order_number(),
        "customer_id": user["id"],
        "customer_name": user.get("name"),
        "store_id": req.store_id,
        "store_name": store.get("business_name"),
        "merchant_id": store.get("owner_id"),
        "items": [i.dict() for i in req.items],
        "subtotal": subtotal,
        "delivery_fee": req.delivery_fee,
        "tax_amount": 0.0,
        "gross_amount": subtotal,
        "discount_rule_id": req.discount_rule_id,
        "discount_rule_snapshot": discount_rule,
        "discount_amount": discount_amount,
        "final_amount": final_amount,
        "payment_status": "pending",
        "fulfillment_status": "created",
        "delivery_address": req.delivery_address,
        "notes": req.notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.orders.insert_one(order_doc)
    oid = str(result.inserted_id)
    
    # Notify merchant
    await db.notifications.insert_one({
        "user_id": store.get("owner_id"), "title": "New Order Received",
        "message": f"New order #{order_doc['order_number']} for ₹{final_amount:.0f}",
        "type": "order", "entity_type": "order", "entity_id": oid,
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "order_id": oid, "order_number": order_doc["order_number"],
            "subtotal": subtotal, "discount_amount": discount_amount, "final_amount": final_amount}

@orders_router.get("/orders/my")
async def get_my_orders(request: Request, status: Optional[str] = None,
                         skip: int = 0, limit: int = 20):
    user = await get_current_user(request, db)
    query = {"customer_id": user["id"]}
    if status:
        query["fulfillment_status"] = status
    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(o) for o in orders]

@orders_router.get("/orders/{order_id}")
async def get_order(order_id: str, request: Request):
    user = await get_current_user(request, db)
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        raise HTTPException(400, "Invalid order ID")
    if not order:
        raise HTTPException(404, "Order not found")
    user_roles = user.get("roles", [])
    if (order["customer_id"] != user["id"] and
            order["merchant_id"] != user["id"] and
            not any(r in user_roles for r in ["admin", "super_admin"])):
        raise HTTPException(403, "Unauthorized")
    return doc(order)

@orders_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, request: Request):
    user = await get_current_user(request, db)
    body = await request.json()
    new_status = body.get("fulfillment_status")
    if not new_status:
        raise HTTPException(400, "fulfillment_status required")
    
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        raise HTTPException(400, "Invalid order ID")
    if not order:
        raise HTTPException(404, "Order not found")
    
    user_roles = user.get("roles", [])
    if (order["merchant_id"] != user["id"] and
            not any(r in user_roles for r in ["admin", "super_admin"])):
        raise HTTPException(403, "Unauthorized")
    
    await db.orders.update_one({"_id": ObjectId(order_id)},
                                {"$set": {"fulfillment_status": new_status,
                                          f"{new_status}_at": datetime.now(timezone.utc).isoformat()}})
    
    await db.notifications.insert_one({
        "user_id": order["customer_id"], "title": "Order Update",
        "message": f"Order #{order['order_number']} status: {new_status.replace('_', ' ').title()}",
        "type": "order", "entity_type": "order", "entity_id": order_id,
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True}

@orders_router.get("/merchant/orders")
async def get_merchant_orders(request: Request, status: Optional[str] = None,
                               store_id: Optional[str] = None, skip: int = 0, limit: int = 50):
    user = await get_current_user(request, db)
    query = {"merchant_id": user["id"]}
    if status:
        query["fulfillment_status"] = status
    if store_id:
        query["store_id"] = store_id
    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(o) for o in orders]
