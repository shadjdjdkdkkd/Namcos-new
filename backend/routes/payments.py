from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
from pymongo import ReturnDocument
from datetime import datetime, timezone
from typing import Optional
import logging, random, time

from database import db
from earnings import get_rates, compute_full_breakdown, apply_purchase_earnings, write_ledger
from auth_utils import get_current_user, require_roles, doc
from routes.payout import resolve_payout

logger = logging.getLogger(__name__)
payments_router = APIRouter(tags=["Payments"])

PLATFORM_FEE_PERCENT = 2.0  # 2% platform fee

def gen_txn_id():
    return f"TXN{int(time.time())}{random.randint(1000, 9999)}"

class InitiatePaymentRequest(BaseModel):
    order_id: str
    payment_method: str = "upi"

class VerifyPaymentRequest(BaseModel):
    order_id: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None

class WithdrawalRequest(BaseModel):
    amount: float
    bank_account: Optional[str] = None
    ifsc: Optional[str] = None
    account_holder: Optional[str] = None
    upi_id: Optional[str] = None
    bank_name: Optional[str] = None
    notes: Optional[str] = None

@payments_router.post("/payments/initiate")
async def initiate_payment(req: InitiatePaymentRequest, request: Request):
    user = await get_current_user(request, db)
    try:
        order = await db.orders.find_one({"_id": ObjectId(req.order_id)})
    except Exception:
        raise HTTPException(400, "Invalid order ID")
    if not order:
        raise HTTPException(404, "Order not found")
    if order["customer_id"] != user["id"]:
        raise HTTPException(403, "Unauthorized")
    if order["payment_status"] == "paid":
        raise HTTPException(400, "Order already paid")
    
    txn_id = gen_txn_id()
    payment_doc = {
        "transaction_id": txn_id,
        "order_id": req.order_id,
        "order_number": order.get("order_number"),
        "customer_id": user["id"],
        "customer_name": user.get("name"),
        "customer_phone": user.get("phone"),
        "merchant_id": order.get("merchant_id"),
        "store_id": order.get("store_id"),
        "store_name": order.get("store_name"),
        "gross_amount": order["final_amount"],
        "discount_amount": order.get("discount_amount", 0),
        "net_paid": order["final_amount"],
        "platform_fee": round(order["final_amount"] * PLATFORM_FEE_PERCENT / 100, 2),
        "merchant_amount": round(order["final_amount"] * (1 - PLATFORM_FEE_PERCENT / 100), 2),
        "gateway": "razorpay",
        "gateway_order_id": None,
        "gateway_payment_id": None,
        "payment_method": req.payment_method,
        "status": "initiated",
        "idempotency_key": f"{req.order_id}_{user['id']}",
        "webhook_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Check idempotency - don't create duplicate payment
    existing = await db.payments.find_one({"idempotency_key": payment_doc["idempotency_key"],
                                            "status": {"$in": ["initiated", "pending", "captured"]}})
    if existing:
        existing["id"] = str(existing["_id"]); existing["_id"] = str(existing["_id"])
        return {"payment": existing, "transaction_id": existing["transaction_id"],
                "amount": existing["net_paid"], "mock_mode": True}
    
    result = await db.payments.insert_one(payment_doc)
    payment_doc["id"] = str(result.inserted_id)
    payment_doc["_id"] = str(result.inserted_id)
    
    return {"payment": payment_doc, "transaction_id": txn_id,
            "amount": order["final_amount"], "mock_mode": True,
            "message": "Payment gateway keys not configured. Use /payments/mock-success for testing."}

@payments_router.post("/payments/mock-success")
async def mock_payment_success(request: Request):
    """Development-only: simulate a successful payment"""
    user = await get_current_user(request, db)
    body = await request.json()
    txn_id = body.get("transaction_id")
    
    payment = await db.payments.find_one({"transaction_id": txn_id})
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment["customer_id"] != user["id"]:
        raise HTTPException(403, "Unauthorized")
    if payment["status"] == "captured":
        return {"success": True, "message": "Already captured"}
    
    now = datetime.now(timezone.utc).isoformat()
    await db.payments.update_one({"transaction_id": txn_id},
        {"$set": {"status": "captured", "gateway_payment_id": f"pay_mock_{gen_txn_id()}",
                  "captured_at": now, "webhook_count": 1}})
    
    # Update order
    await db.orders.update_one({"_id": ObjectId(payment["order_id"])},
        {"$set": {"payment_status": "paid", "fulfillment_status": "confirmed",
                  "payment_id": txn_id, "confirmed_at": now}})
    
    # Create settlement for merchant
    await db.settlements.insert_one({
        "merchant_id": payment["merchant_id"],
        "payment_id": str(payment["_id"]),
        "transaction_id": txn_id,
        "order_id": payment["order_id"],
        "order_number": payment.get("order_number"),
        "store_id": payment.get("store_id"),
        "store_name": payment.get("store_name"),
        "gross_amount": payment["gross_amount"],
        "discount_amount": payment["discount_amount"],
        "platform_fee": payment["platform_fee"],
        "net_amount": payment["merchant_amount"],
        "status": "available",
        "created_at": now
    })
    
    # Notify customer
    await db.notifications.insert_one({
        "user_id": payment["customer_id"], "title": "Payment Successful",
        "message": f"Payment of ₹{payment['net_paid']:.0f} to {payment.get('store_name')} successful",
        "type": "payment", "entity_type": "payment", "entity_id": txn_id,
        "is_read": False, "created_at": now
    })
    
    # Notify merchant
    await db.notifications.insert_one({
        "user_id": payment["merchant_id"], "title": "Payment Received",
        "message": f"Payment of ₹{payment['merchant_amount']:.0f} received for order",
        "type": "payment", "entity_type": "payment", "entity_id": txn_id,
        "is_read": False, "created_at": now
    })
    
    return {"success": True, "transaction_id": txn_id, "amount": payment["net_paid"],
            "merchant_amount": payment["merchant_amount"]}

@payments_router.get("/payments/my")
async def get_my_payments(request: Request, skip: int = 0, limit: int = 20):
    user = await get_current_user(request, db)
    payments = await db.payments.find({"customer_id": user["id"]}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(p) for p in payments]

@payments_router.get("/merchant/payments")
async def get_merchant_payments(request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request, db)
    payments = await db.payments.find({"merchant_id": user["id"]}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(p) for p in payments]

@payments_router.get("/merchant/settlements")
async def get_merchant_settlements(request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request, db)
    settlements = await db.settlements.find({"merchant_id": user["id"]}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [doc(s) for s in settlements]

@payments_router.get("/merchant/balance")
async def get_merchant_balance(request: Request):
    user = await get_current_user(request, db)
    settlements = await db.settlements.find({"merchant_id": user["id"]}).to_list(1000)
    available = sum(s["net_amount"] for s in settlements if s["status"] == "available")
    pending = sum(s["net_amount"] for s in settlements if s["status"] == "pending")
    withdrawn = sum(s["net_amount"] for s in settlements if s["status"] == "withdrawn")
    total_received = available + withdrawn
    
    withdrawals = await db.withdrawals.find({"merchant_id": user["id"]}).to_list(100)
    pending_withdrawal = sum(w["amount"] for w in withdrawals if w["status"] in ["requested", "under_review", "approved", "processing"])
    
    return {"available_balance": available, "pending_settlement": pending,
            "total_received": total_received, "total_withdrawn": withdrawn,
            "pending_withdrawal": pending_withdrawal}

@payments_router.post("/merchant/withdrawals")
async def request_withdrawal(req: WithdrawalRequest, request: Request):
    user = await get_current_user(request, db)
    
    # Check available balance
    settlements = await db.settlements.find({"merchant_id": user["id"], "status": "available"}).to_list(1000)
    available = sum(s["net_amount"] for s in settlements)
    
    if req.amount > available:
        raise HTTPException(400, f"Insufficient balance. Available: ₹{available:.2f}")
    if req.amount < 100:
        raise HTTPException(400, "Minimum withdrawal amount is ₹100")
    
    # Check for pending withdrawal
    existing = await db.withdrawals.find_one({"merchant_id": user["id"],
                                               "status": {"$in": ["requested", "under_review", "approved"]}})
    if existing:
        raise HTTPException(400, "You already have a pending withdrawal request")
    
    payout = await resolve_payout(user, req.dict())
    wd_doc = {
        **req.dict(), **payout, "merchant_id": user["id"], "merchant_name": user.get("name"),
        "merchant_phone": user.get("phone"),
        "status": "requested", "on_hold": False, "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.withdrawals.insert_one(wd_doc)
    wid = str(result.inserted_id)
    await write_ledger("withdrawal", "merchant_withdrawal", req.amount,
                       wd_doc["created_at"], reference_id=wid, user_id=user["id"],
                       user_name=user.get("name"), direction="debit",
                       note="Merchant withdrawal request")
    
    # Notify admin
    await db.notifications.insert_one({
        "user_id": "admin", "title": "Withdrawal Request",
        "message": f"{user.get('name')} requested withdrawal of ₹{req.amount:.0f}",
        "type": "withdrawal", "entity_type": "withdrawal", "entity_id": wid,
        "is_read": False, "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.audit_logs.insert_one({
        "actor_id": user["id"], "actor_name": user.get("name"),
        "action": "withdrawal_requested", "entity_type": "withdrawal", "entity_id": wid,
        "details": {"amount": req.amount}, "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "withdrawal_id": wid, "status": "requested"}

class PayAtStoreRequest(BaseModel):
    store_id: str
    amount: float
    notes: Optional[str] = None
    payment_method: str = "upi"

@payments_router.post("/payments/pay-at-store")
async def pay_at_store(req: PayAtStoreRequest, request: Request):
    """Simple pay-at-store flow: no product catalog, just bill amount"""
    user = await get_current_user(request, db)
    try:
        store = await db.stores.find_one({"_id": ObjectId(req.store_id)})
    except Exception:
        raise HTTPException(400, "Invalid store ID")
    if not store or store.get("status") != "published":
        raise HTTPException(404, "Store not available")
    if req.amount < 1:
        raise HTTPException(400, "Minimum payment is ₹1")

    order_number = f"ORD{int(time.time())}{random.randint(100, 999)}"
    order_doc = {
        "order_number": order_number,
        "customer_id": user["id"],
        "customer_name": user.get("name"),
        "store_id": req.store_id,
        "store_name": store.get("business_name"),
        "merchant_id": store.get("owner_id"),
        "customer_phone": user.get("phone"),
        "items": [],
        "subtotal": req.amount,
        "delivery_fee": 0.0,
        "tax_amount": 0.0,
        "gross_amount": req.amount,
        "discount_amount": 0.0,
        "final_amount": req.amount,
        "payment_status": "pending",
        "fulfillment_status": "created",
        "notes": req.notes,
        "order_type": "pay_at_store",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    order_result = await db.orders.insert_one(order_doc)
    oid = str(order_result.inserted_id)

    txn_id = gen_txn_id()
    payment_doc = {
        "transaction_id": txn_id,
        "order_id": oid,
        "order_number": order_number,
        "customer_id": user["id"],
        "customer_name": user.get("name"),
        "customer_phone": user.get("phone"),
        "merchant_id": store.get("owner_id"),
        "store_id": req.store_id,
        "store_name": store.get("business_name"),
        "gross_amount": req.amount,
        "discount_amount": 0,
        "net_paid": req.amount,
        "platform_fee": round(req.amount * PLATFORM_FEE_PERCENT / 100, 2),
        "merchant_amount": round(req.amount * (1 - PLATFORM_FEE_PERCENT / 100), 2),
        "gateway": "razorpay",
        "gateway_order_id": None,
        "gateway_payment_id": None,
        "payment_method": req.payment_method,
        "status": "initiated",
        "idempotency_key": f"pas_{oid}_{user['id']}",
        "order_type": "pay_at_store",
        "webhook_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    pay_result = await db.payments.insert_one(payment_doc)
    payment_doc["id"] = str(pay_result.inserted_id)
    payment_doc["_id"] = str(pay_result.inserted_id)

    return {
        "transaction_id": txn_id,
        "order_id": oid,
        "order_number": order_number,
        "amount": req.amount,
        "mock_mode": True
    }

@payments_router.get("/merchant/withdrawals")
async def get_merchant_withdrawals(request: Request):
    user = await get_current_user(request, db)
    withdrawals = await db.withdrawals.find({"merchant_id": user["id"]}).sort("created_at", -1).to_list(100)
    return [doc(w) for w in withdrawals]


class PayWithWalletRequest(BaseModel):
    store_id: str
    amount: float
    notes: Optional[str] = None

@payments_router.post("/payments/pay-with-wallet")
async def pay_with_wallet(req: PayWithWalletRequest, request: Request):
    """Pay a store bill directly from NAMCOS wallet balance."""
    user = await get_current_user(request, db)
    if req.amount < 1:
        raise HTTPException(400, "Minimum payment is ₹1")
    try:
        store = await db.stores.find_one({"_id": ObjectId(req.store_id)})
    except Exception:
        raise HTTPException(400, "Invalid store ID")
    if not store or store.get("status") != "published":
        raise HTTPException(404, "Store not available")

    bd = compute_full_breakdown(req.amount, store)
    net = bd["net_paid"]

    # Atomic conditional deduction (deduct the discounted net amount)
    updated = await db.wallet.find_one_and_update(
        {"user_id": user["id"], "balance": {"$gte": net}},
        {"$inc": {"balance": -net}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        wallet = await db.wallet.find_one({"user_id": user["id"]})
        balance = round((wallet or {}).get("balance", 0.0), 2)
        raise HTTPException(400, {"code": "INSUFFICIENT_FUNDS", "balance": balance,
                                  "shortfall": round(net - balance, 2), "net_payable": net})
    new_balance = round(updated["balance"], 2)

    now = datetime.now(timezone.utc).isoformat()
    order_number = f"ORD{int(time.time())}{random.randint(100, 999)}"
    order_doc = {
        "order_number": order_number,
        "customer_id": user["id"], "customer_name": user.get("name"),
        "customer_phone": user.get("phone"),
        "store_id": req.store_id, "store_name": store.get("business_name"),
        "merchant_id": store.get("owner_id"),
        "items": [], "subtotal": bd["gross_amount"], "delivery_fee": 0.0, "tax_amount": 0.0,
        "gross_amount": bd["gross_amount"], "discount_percent": bd["discount_percent"],
        "discount_amount": bd["discount_amount"], "final_amount": net,
        "payment_status": "paid", "fulfillment_status": "confirmed",
        "notes": req.notes, "order_type": "pay_at_store", "paid_via": "wallet",
        "created_at": now, "confirmed_at": now,
    }
    o_res = await db.orders.insert_one(order_doc)
    oid = str(o_res.inserted_id)

    txn_id = gen_txn_id()
    await db.payments.insert_one({
        "transaction_id": txn_id, "order_id": oid, "order_number": order_number,
        "customer_id": user["id"], "customer_name": user.get("name"),
        "customer_phone": user.get("phone"),
        "merchant_id": store.get("owner_id"), "store_id": req.store_id,
        "store_name": store.get("business_name"),
        **bd,
        "gateway": "wallet", "payment_method": "wallet", "status": "captured",
        "order_type": "pay_at_store", "captured_at": now, "created_at": now,
    })
    await db.settlements.insert_one({
        "merchant_id": store.get("owner_id"), "transaction_id": txn_id, "order_id": oid,
        "order_number": order_number, "store_id": req.store_id,
        "store_name": store.get("business_name"),
        "gross_amount": bd["gross_amount"], "platform_fee": bd["namcos_earning"],
        "net_amount": bd["merchant_amount"], "status": "available", "created_at": now,
    })
    await db.wallet_transactions.insert_one({
        "user_id": user["id"], "type": "debit", "source": "pay",
        "amount": net, "reference_id": txn_id,
        "store_name": store.get("business_name"),
        "note": f"Paid to {store.get('business_name')}", "created_at": now,
    })
    await db.notifications.insert_one({
        "user_id": user["id"], "title": "Payment Successful",
        "message": f"Paid ₹{net:.0f} to {store.get('business_name')} from wallet",
        "type": "payment", "entity_type": "payment", "entity_id": txn_id,
        "is_read": False, "created_at": now,
    })
    if store.get("owner_id"):
        await db.notifications.insert_one({
            "user_id": store["owner_id"], "title": "Payment Received",
            "message": f"Received ₹{bd['merchant_amount']:.0f} from {user.get('name')}",
            "type": "payment", "entity_type": "payment", "entity_id": txn_id,
            "is_read": False, "created_at": now,
        })
    await apply_purchase_earnings(store, user["id"], req.amount, txn_id, now)
    return {"success": True, "transaction_id": txn_id, "order_id": oid,
            "order_number": order_number, "amount": net, "breakdown": bd, "balance": new_balance}
