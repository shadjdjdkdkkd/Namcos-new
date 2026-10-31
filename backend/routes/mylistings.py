"""My Listings + Razorpay + earnings endpoints for Phase 5/6."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional
import os
import hmac
import hashlib
import logging

try:
    import razorpay
except Exception:
    razorpay = None

from database import db
from earnings import (get_rates, compute_breakdown, compute_full_breakdown,
                      apply_purchase_earnings, credit_referral_by_customer_id, write_ledger)
from auth_utils import get_current_user, doc, PROTECTED_LISTING_FIELDS

logger = logging.getLogger(__name__)
mylistings_router = APIRouter(tags=["MyListings"])

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")

_rz_client = None
def rz_client():
    global _rz_client
    if _rz_client is None and razorpay and RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
        _rz_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    return _rz_client


# ─── My Listings (across all types) ──────────────────────

@mylistings_router.get("/my/listings")
async def get_my_listings(request: Request):
    """Return the current user's listings from all 4 collections with unified shape."""
    user = await get_current_user(request, db)
    uid = user["id"]

    stores = await db.stores.find({"owner_id": uid}).sort("created_at", -1).to_list(200)
    agri = await db.agriculture.find({"seller_id": uid}).sort("created_at", -1).to_list(200)
    services = await db.services.find({"provider_id": uid}).sort("created_at", -1).to_list(200)
    classifieds = await db.classifieds.find({"seller_id": uid}).sort("created_at", -1).to_list(200)

    def norm(kind, x):
        d = doc(x)
        return {
            "id": d.get("id"),
            "kind": kind,
            "title": d.get("business_name") or d.get("product_name") or d.get("service_name") or d.get("title"),
            "category": d.get("category") or d.get("business_type"),
            "status": d.get("status") or "submitted",
            "is_active": d.get("is_active", True),
            "images": d.get("images") or [x for x in [d.get("cover_image"), d.get("logo")] if x],
            "description": d.get("description"),
            "price": d.get("price") or d.get("starting_price"),
            "locality": d.get("locality"),
            "city": d.get("city"),
            "created_at": d.get("created_at"),
            "view_count": d.get("view_count"),
        }
    items = (
        [norm("store", s) for s in stores]
        + [norm("agriculture", a) for a in agri]
        + [norm("service", s) for s in services]
        + [norm("classified", c) for c in classifieds]
    )
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return items


def _col(kind: str):
    m = {"store": db.stores, "agriculture": db.agriculture, "service": db.services, "classified": db.classifieds}
    if kind not in m:
        raise HTTPException(400, "Invalid kind")
    return m[kind]


def _owner_field(kind: str):
    return {"store": "owner_id", "agriculture": "seller_id", "service": "provider_id", "classified": "seller_id"}[kind]


async def _get_my(kind: str, item_id: str, user: dict):
    col = _col(kind)
    try:
        item = await col.find_one({"_id": ObjectId(item_id)})
    except Exception:
        raise HTTPException(400, "Invalid ID")
    if not item:
        raise HTTPException(404, "Not found")
    if item.get(_owner_field(kind)) != user["id"]:
        raise HTTPException(403, "Not the owner")
    return col, item


class ToggleActive(BaseModel):
    is_active: bool


@mylistings_router.put("/my/listings/{kind}/{item_id}/toggle")
async def toggle_listing(kind: str, item_id: str, body: ToggleActive, request: Request):
    user = await get_current_user(request, db)
    col, item = await _get_my(kind, item_id, user)
    status = item.get("status")
    if status not in ("published", "paused"):
        msg = {"sold": "Sold listings cannot be re-enabled",
               "rejected": "This listing was rejected by admin",
               "suspended": "This listing is suspended by admin"}.get(status, "Waiting for admin approval — you can enable it once approved")
        raise HTTPException(400, msg)
    new_status = "published" if body.is_active else "paused"
    await col.update_one({"_id": item["_id"]}, {"$set": {"is_active": body.is_active, "status": new_status}})
    return {"success": True, "is_active": body.is_active, "status": new_status}


@mylistings_router.put("/my/listings/{kind}/{item_id}/mark-sold")
async def mark_sold(kind: str, item_id: str, request: Request):
    user = await get_current_user(request, db)
    col, item = await _get_my(kind, item_id, user)
    await col.update_one({"_id": item["_id"]}, {"$set": {"status": "sold", "sold_at": datetime.now(timezone.utc).isoformat()}})
    return {"success": True}


@mylistings_router.put("/my/listings/{kind}/{item_id}")
async def edit_my_listing(kind: str, item_id: str, request: Request):
    user = await get_current_user(request, db)
    col, item = await _get_my(kind, item_id, user)
    body = await request.json()
    for f in PROTECTED_LISTING_FIELDS:
        body.pop(f, None)
    await col.update_one({"_id": item["_id"]}, {"$set": body})
    return {"success": True}


@mylistings_router.get("/my/listings/{kind}/{item_id}/dashboard")
async def my_listing_dashboard(kind: str, item_id: str, request: Request):
    """Merchant-style dashboard for a single listing, shown inside the user app."""
    user = await get_current_user(request, db)
    _, item = await _get_my(kind, item_id, user)
    d = doc(item)
    out = {"kind": kind, "item": d, "status": d.get("status"), "view_count": d.get("view_count", 0)}
    if kind != "store":
        return out
    payments = await db.payments.find({"store_id": item_id, "status": "captured"}).sort("created_at", -1).to_list(5000)
    settlements = await db.settlements.find({"store_id": item_id}).to_list(5000)
    today = datetime.now(timezone.utc).date().isoformat()
    out.update({
        "total_orders": await db.orders.count_documents({"store_id": item_id}),
        "today_orders": await db.orders.count_documents({"store_id": item_id, "created_at": {"$gte": today}}),
        "total_payments": len(payments),
        "gross_sales": round(sum(p.get("gross_amount", 0) for p in payments), 2),
        "customer_discount": round(sum(p.get("discount_amount", 0) for p in payments), 2),
        "namcos_fee": round(sum(p.get("namcos_earning", p.get("platform_fee", 0)) for p in payments), 2),
        "net_earnings": round(sum(p.get("merchant_amount", 0) for p in payments), 2),
        "available_balance": round(sum(s.get("net_amount", 0) for s in settlements if s.get("status") == "available"), 2),
        "withdrawn": round(sum(s.get("net_amount", 0) for s in settlements if s.get("status") == "withdrawn"), 2),
        "products_count": await db.products.count_documents({"store_id": item_id, "status": "active"}),
        "rates": {k: item.get(k, 0) for k in ["discount_percent", "referral_percent", "chain_percent", "namcos_percent"]},
        "recent_payments": [{k: p.get(k) for k in ["transaction_id", "customer_name", "customer_phone", "gross_amount",
                                                   "net_paid", "merchant_amount", "payment_method", "created_at"]}
                            for p in payments[:15]],
    })
    return out


@mylistings_router.get("/my/earnings")
async def my_earnings(request: Request):
    """Aggregated earnings for a user across their listings (as merchant)."""
    user = await get_current_user(request, db)
    uid = user["id"]
    payments = await db.payments.find({"merchant_id": uid}).sort("created_at", -1).to_list(2000)
    settlements = await db.settlements.find({"merchant_id": uid}).to_list(2000)
    withdrawals = await db.withdrawals.find({"merchant_id": uid}).sort("created_at", -1).to_list(200)

    available = sum(s.get("net_amount", 0) for s in settlements if s.get("status") == "available")
    withdrawn = sum(s.get("net_amount", 0) for s in settlements if s.get("status") == "withdrawn")
    pending_wd = sum(w.get("amount", 0) for w in withdrawals
                     if w.get("status") in ["requested", "under_review", "approved", "processing"])
    total_gross = sum(p.get("gross_amount", 0) for p in payments if p.get("status") == "captured")
    total_net = sum(p.get("merchant_amount", 0) for p in payments if p.get("status") == "captured")

    return {
        "available_balance": available,
        "total_gross": total_gross,
        "total_net": total_net,
        "total_withdrawn": withdrawn,
        "pending_withdrawal": pending_wd,
        "recent_payments": [doc(p) for p in payments[:20]],
        "recent_withdrawals": [doc(w) for w in withdrawals[:10]],
    }


# ─── Razorpay ─────────────────────────────────────────────

class RzpOrderRequest(BaseModel):
    store_id: str
    amount: float
    notes: Optional[str] = None


@mylistings_router.get("/razorpay/config")
async def razorpay_config():
    return {"key_id": RAZORPAY_KEY_ID or "", "mock_mode": not bool(rz_client())}


@mylistings_router.post("/razorpay/order")
async def razorpay_create_order(body: RzpOrderRequest, request: Request):
    """Create a Razorpay order for pay-at-store. Amount in INR (₹)."""
    user = await get_current_user(request, db)
    try:
        store = await db.stores.find_one({"_id": ObjectId(body.store_id)})
    except Exception:
        raise HTTPException(400, "Invalid store")
    if not store or store.get("status") != "published":
        raise HTTPException(404, "Store not available")
    if body.amount < 1:
        raise HTTPException(400, "Minimum ₹1")

    client = rz_client()
    if not client:
        raise HTTPException(500, "Razorpay not configured")

    bd = compute_full_breakdown(body.amount, store)
    net = bd["net_paid"]

    receipt = f"nam{int(datetime.now(timezone.utc).timestamp())}"[-40:]
    rz_order = client.order.create({
        "amount": int(round(net * 100)),
        "currency": "INR",
        "receipt": receipt,
        "notes": {"store_id": body.store_id, "customer": user["id"], "note": body.notes or ""},
        "payment_capture": 1,
    })

    # Persist local order + payment shell
    import time, random
    order_number = f"ORD{int(time.time())}{random.randint(100,999)}"
    order_doc_ = {
        "order_number": order_number,
        "customer_id": user["id"], "customer_name": user.get("name"),
        "customer_phone": user.get("phone"),
        "store_id": body.store_id, "store_name": store.get("business_name"),
        "merchant_id": store.get("owner_id"),
        "items": [], "subtotal": bd["gross_amount"],
        "gross_amount": bd["gross_amount"], "discount_percent": bd["discount_percent"],
        "discount_amount": bd["discount_amount"], "final_amount": net,
        "payment_status": "pending", "fulfillment_status": "created",
        "notes": body.notes, "order_type": "pay_at_store",
        "razorpay_order_id": rz_order["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    o_res = await db.orders.insert_one(order_doc_)
    oid = str(o_res.inserted_id)

    return {
        "razorpay_order_id": rz_order["id"],
        "amount": rz_order["amount"], "currency": rz_order["currency"],
        "key_id": RAZORPAY_KEY_ID,
        "order_id": oid, "order_number": order_number,
        "store_name": store.get("business_name"),
        "breakdown": bd,
        "customer_name": user.get("name"), "customer_phone": user.get("phone"),
    }


class RzpVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    order_id: str


@mylistings_router.post("/razorpay/verify")
async def razorpay_verify(body: RzpVerifyRequest, request: Request):
    user = await get_current_user(request, db)
    if not RAZORPAY_KEY_SECRET:
        raise HTTPException(500, "Razorpay not configured")

    # HMAC verify
    msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(400, "Signature verification failed")

    try:
        order = await db.orders.find_one({"_id": ObjectId(body.order_id)})
    except Exception:
        raise HTTPException(400, "Invalid order")
    if not order:
        raise HTTPException(404, "Order not found")

    now = datetime.now(timezone.utc).isoformat()
    net = order["final_amount"]
    store = None
    if order.get("store_id"):
        try:
            store = await db.stores.find_one({"_id": ObjectId(order["store_id"])})
        except Exception:
            store = None
    if store:
        bd = compute_full_breakdown(order.get("gross_amount", net), store)
        bd["net_paid"] = net
    else:
        rates = await get_rates()
        bd = compute_breakdown(order.get("gross_amount", net), order.get("discount_percent", 0), rates["namcos_percent"])
        bd["net_paid"] = net
        bd["namcos_earning"] = round(net * rates["namcos_percent"] / 100, 2)
        bd["platform_fee"] = bd["namcos_earning"]
        bd["merchant_amount"] = round(net - bd["namcos_earning"], 2)

    import time, random
    txn_id = f"TXN{int(time.time())}{random.randint(1000,9999)}"
    payment_doc_ = {
        "transaction_id": txn_id,
        "order_id": body.order_id,
        "order_number": order.get("order_number"),
        "customer_id": user["id"],
        "customer_name": user.get("name"),
        "customer_phone": user.get("phone"),
        "merchant_id": order.get("merchant_id"),
        "store_id": order.get("store_id"),
        "store_name": order.get("store_name"),
        **bd,
        "gateway": "razorpay",
        "gateway_order_id": body.razorpay_order_id,
        "gateway_payment_id": body.razorpay_payment_id,
        "signature": body.razorpay_signature,
        "payment_method": "razorpay",
        "status": "captured",
        "order_type": "pay_at_store",
        "captured_at": now,
        "created_at": now,
    }
    await db.payments.insert_one(payment_doc_)
    await db.orders.update_one({"_id": ObjectId(body.order_id)},
        {"$set": {"payment_status": "paid", "fulfillment_status": "confirmed",
                  "payment_id": txn_id, "confirmed_at": now}})
    await db.settlements.insert_one({
        "merchant_id": order.get("merchant_id"),
        "transaction_id": txn_id, "order_id": body.order_id,
        "order_number": order.get("order_number"),
        "store_id": order.get("store_id"), "store_name": order.get("store_name"),
        "gross_amount": bd["gross_amount"], "platform_fee": bd["namcos_earning"],
        "net_amount": bd["merchant_amount"],
        "status": "available", "created_at": now,
    })
    await db.notifications.insert_one({
        "user_id": user["id"], "title": "Payment Successful",
        "message": f"Paid ₹{net:.0f} to {order.get('store_name')}",
        "type": "payment", "is_read": False, "created_at": now,
    })
    if order.get("merchant_id"):
        await db.notifications.insert_one({
            "user_id": order["merchant_id"], "title": "Payment Received",
            "message": f"Received ₹{bd['merchant_amount']:.0f}",
            "type": "payment", "is_read": False, "created_at": now,
        })
    if store:
        await apply_purchase_earnings(store, user["id"], order.get("gross_amount", net), txn_id, now, net_paid=net)
    else:
        rates = await get_rates()
        await credit_referral_by_customer_id(user["id"], net, rates["referral_percent"], txn_id, now)
    return {"success": True, "transaction_id": txn_id, "amount": net, "breakdown": bd}


class RzpTopupRequest(BaseModel):
    amount: float


@mylistings_router.post("/razorpay/wallet-topup/order")
async def razorpay_topup_order(body: RzpTopupRequest, request: Request):
    """Create a Razorpay order to top up the current user's wallet."""
    user = await get_current_user(request, db)
    if body.amount < 10:
        raise HTTPException(400, "Minimum ₹10")
    if body.amount > 100000:
        raise HTTPException(400, "Max ₹1,00,000 per top-up")

    client = rz_client()
    if not client:
        raise HTTPException(500, "Razorpay not configured")

    receipt = f"wal{int(datetime.now(timezone.utc).timestamp())}"[-40:]
    rz_order = client.order.create({
        "amount": int(round(body.amount * 100)),
        "currency": "INR",
        "receipt": receipt,
        "notes": {"type": "wallet_topup", "user_id": user["id"]},
        "payment_capture": 1,
    })
    # Persist topup shell
    topup_doc = {
        "user_id": user["id"],
        "type": "wallet_topup",
        "amount": body.amount,
        "status": "pending",
        "razorpay_order_id": rz_order["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    tres = await db.wallet_topups.insert_one(topup_doc)
    return {
        "razorpay_order_id": rz_order["id"],
        "amount": rz_order["amount"],
        "currency": rz_order["currency"],
        "key_id": RAZORPAY_KEY_ID,
        "topup_id": str(tres.inserted_id),
        "customer_name": user.get("name"),
        "customer_phone": user.get("phone"),
    }


class RzpTopupVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    topup_id: str


@mylistings_router.post("/razorpay/wallet-topup/verify")
async def razorpay_topup_verify(body: RzpTopupVerify, request: Request):
    user = await get_current_user(request, db)
    if not RAZORPAY_KEY_SECRET:
        raise HTTPException(500, "Razorpay not configured")
    msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(400, "Signature verification failed")

    try:
        topup = await db.wallet_topups.find_one({"_id": ObjectId(body.topup_id)})
    except Exception:
        raise HTTPException(400, "Invalid topup")
    if not topup:
        raise HTTPException(404, "Topup not found")
    if topup.get("status") == "success":
        return {"success": True, "balance": (await db.wallet.find_one({"user_id": user["id"]}) or {}).get("balance", 0)}

    now = datetime.now(timezone.utc).isoformat()
    amount = topup["amount"]

    await db.wallet_topups.update_one({"_id": topup["_id"]}, {"$set": {
        "status": "success", "razorpay_payment_id": body.razorpay_payment_id,
        "signature": body.razorpay_signature, "captured_at": now,
    }})
    # Increment wallet balance
    await db.wallet.update_one(
        {"user_id": user["id"]},
        {"$inc": {"balance": amount, "total_topped_up": amount},
         "$setOnInsert": {"user_id": user["id"], "created_at": now}},
        upsert=True,
    )
    await db.wallet_transactions.insert_one({
        "user_id": user["id"], "type": "credit", "source": "topup",
        "amount": amount, "reference_id": body.razorpay_payment_id,
        "note": "Wallet top-up via Razorpay",
        "created_at": now,
    })
    await write_ledger("wallet", "wallet_topup", amount, now,
                       reference_id=body.razorpay_payment_id, user_id=user["id"],
                       user_name=user.get("name"), direction="credit",
                       note="Wallet top-up via Razorpay")
    await db.notifications.insert_one({
        "user_id": user["id"], "title": "Wallet Top-up Successful",
        "message": f"₹{amount:.0f} added to your NAMCOS wallet",
        "type": "wallet", "is_read": False, "created_at": now,
    })
    wallet = await db.wallet.find_one({"user_id": user["id"]})
    return {"success": True, "amount": amount, "balance": (wallet or {}).get("balance", 0)}


# ─── Webhook (production safety net) ─────────────────────

@mylistings_router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request):
    """
    Razorpay webhook receiver.
    Verifies X-Razorpay-Signature using RAZORPAY_WEBHOOK_SECRET if set,
    otherwise falls back to RAZORPAY_KEY_SECRET.
    Handles payment.captured / order.paid events as a safety net.
    """
    raw = await request.body()
    signature = request.headers.get("x-razorpay-signature") or request.headers.get("X-Razorpay-Signature") or ""
    secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET") or RAZORPAY_KEY_SECRET
    if not secret:
        raise HTTPException(500, "Webhook secret not configured")
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        logger.warning("Razorpay webhook signature mismatch")
        raise HTTPException(400, "Invalid signature")

    import json as _json
    try:
        event = _json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(400, "Invalid payload")

    etype = event.get("event")
    payload = event.get("payload", {})

    # Idempotency: persist raw event
    ev_id = event.get("id") or event.get("account_id", "") + str(event.get("created_at", ""))
    seen = await db.razorpay_events.find_one({"event_id": ev_id})
    if seen:
        return {"ok": True, "duplicate": True}
    await db.razorpay_events.insert_one({
        "event_id": ev_id, "event": etype, "raw": event,
        "received_at": datetime.now(timezone.utc).isoformat(),
    })

    if etype in ("payment.captured", "order.paid"):
        pay = (payload.get("payment") or {}).get("entity") or {}
        rz_order_id = pay.get("order_id")
        rz_payment_id = pay.get("id")
        amount_paise = pay.get("amount", 0)
        amount = amount_paise / 100.0
        notes = pay.get("notes", {}) or {}
        note_type = notes.get("type")
        now = datetime.now(timezone.utc).isoformat()

        if note_type == "wallet_topup":
            topup = await db.wallet_topups.find_one({"razorpay_order_id": rz_order_id})
            if topup and topup.get("status") != "success":
                uid = topup["user_id"]
                await db.wallet_topups.update_one({"_id": topup["_id"]}, {"$set": {
                    "status": "success", "razorpay_payment_id": rz_payment_id,
                    "captured_at": now, "via": "webhook"}})
                await db.wallet.update_one({"user_id": uid},
                    {"$inc": {"balance": amount, "total_topped_up": amount},
                     "$setOnInsert": {"user_id": uid, "created_at": now}}, upsert=True)
                await db.wallet_transactions.insert_one({
                    "user_id": uid, "type": "credit", "source": "topup",
                    "amount": amount, "reference_id": rz_payment_id,
                    "note": "Wallet top-up (webhook)", "created_at": now,
                })
        else:
            # pay-at-store safety net
            order = await db.orders.find_one({"razorpay_order_id": rz_order_id})
            if order and order.get("payment_status") != "paid":
                fee = round(amount * 2.0 / 100, 2)
                merchant_amount = round(amount - fee, 2)
                import time, random
                txn_id = f"TXN{int(time.time())}{random.randint(1000,9999)}"
                await db.payments.insert_one({
                    "transaction_id": txn_id, "order_id": str(order["_id"]),
                    "order_number": order.get("order_number"),
                    "customer_id": order.get("customer_id"),
                    "customer_name": order.get("customer_name"),
                    "customer_phone": order.get("customer_phone"),
                    "merchant_id": order.get("merchant_id"),
                    "store_id": order.get("store_id"),
                    "store_name": order.get("store_name"),
                    "gross_amount": amount, "discount_amount": 0, "net_paid": amount,
                    "platform_fee": fee, "merchant_amount": merchant_amount,
                    "gateway": "razorpay",
                    "gateway_order_id": rz_order_id,
                    "gateway_payment_id": rz_payment_id,
                    "payment_method": "razorpay",
                    "status": "captured", "captured_at": now,
                    "created_at": now, "via": "webhook",
                })
                await db.orders.update_one({"_id": order["_id"]},
                    {"$set": {"payment_status": "paid", "payment_id": txn_id,
                              "fulfillment_status": "confirmed", "confirmed_at": now}})
                await db.settlements.insert_one({
                    "merchant_id": order.get("merchant_id"),
                    "transaction_id": txn_id, "order_id": str(order["_id"]),
                    "store_id": order.get("store_id"),
                    "store_name": order.get("store_name"),
                    "gross_amount": amount, "platform_fee": fee,
                    "net_amount": merchant_amount,
                    "status": "available", "created_at": now,
                })

    elif etype == "payment.failed":
        pay = (payload.get("payment") or {}).get("entity") or {}
        rz_order_id = pay.get("order_id")
        await db.orders.update_one(
            {"razorpay_order_id": rz_order_id},
            {"$set": {"payment_status": "failed"}}
        )

    return {"ok": True}
