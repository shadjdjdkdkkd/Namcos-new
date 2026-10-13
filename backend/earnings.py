"""Central earnings / chain-referral engine + unified transaction ledger for NAMCOS."""
from datetime import datetime, timezone
from bson import ObjectId
from database import db

MAX_CHAIN_LEVELS = 5


async def get_rates():
    s = await db.settings.find_one({"key": "platform"}) or {}
    namcos = s.get("namcos_earning_percent", s.get("platform_fee_percent", 2.0))
    referral = s.get("referral_percent", 5.0)
    return {"namcos_percent": float(namcos or 0), "referral_percent": float(referral or 0)}


def store_rates(store: dict):
    """Per-store percentage allocation. Falls back to 0 if a field is missing."""
    s = store or {}
    namcos = s.get("namcos_percent")
    if namcos is None:
        namcos = s.get("fee_percent", 0)
    return {
        "customer_pct": float(s.get("discount_percent", 0) or 0),
        "referral_pct": float(s.get("referral_percent", 0) or 0),
        "chain_pct": float(s.get("chain_percent", 0) or 0),
        "namcos_pct": float(namcos or 0),
    }


def compute_full_breakdown(gross: float, store: dict, rates: dict = None):
    """Full money split. All percentages are relative to gross bill amount."""
    rates = rates or store_rates(store)
    gross = round(float(gross or 0), 2)
    cust = round(gross * rates["customer_pct"] / 100, 2)
    ref = round(gross * rates["referral_pct"] / 100, 2)
    chain = round(gross * rates["chain_pct"] / 100, 2)
    namcos = round(gross * rates["namcos_pct"] / 100, 2)
    net_paid = round(gross - cust, 2)
    merchant = round(gross - cust - ref - chain - namcos, 2)
    return {
        "gross_amount": gross,
        "discount_percent": rates["customer_pct"],
        "discount_amount": cust,
        "net_paid": net_paid,
        "referral_percent": rates["referral_pct"], "referral_amount": ref,
        "chain_percent": rates["chain_pct"], "chain_amount": chain,
        "namcos_percent": rates["namcos_pct"], "namcos_earning": namcos,
        "platform_fee": namcos,
        "merchant_amount": merchant,
    }


# ─── Backward-compatible simple breakdown (legacy callers) ──
def compute_breakdown(gross: float, disc_pct, namcos_pct: float):
    disc_pct = float(disc_pct or 0)
    namcos_pct = float(namcos_pct or 0)
    gross = round(float(gross or 0), 2)
    discount_amount = round(gross * disc_pct / 100, 2)
    net_paid = round(gross - discount_amount, 2)
    namcos_earning = round(net_paid * namcos_pct / 100, 2)
    merchant_amount = round(net_paid - namcos_earning, 2)
    return {
        "gross_amount": gross, "discount_percent": disc_pct,
        "discount_amount": discount_amount, "net_paid": net_paid,
        "namcos_percent": namcos_pct, "namcos_earning": namcos_earning,
        "platform_fee": namcos_earning, "merchant_amount": merchant_amount,
    }


# ─── Unified transaction ledger ────────────────────────────
async def write_ledger(txn_group: str, txn_type: str, amount: float, now: str,
                        reference_id: str = None, user_id: str = None, user_name: str = None,
                        store_id: str = None, store_name: str = None,
                        buyer_id: str = None, buyer_name: str = None,
                        percent: float = None, direction: str = "credit", note: str = None):
    await db.transactions.insert_one({
        "txn_group": txn_group, "txn_type": txn_type,
        "amount": round(float(amount or 0), 2), "direction": direction,
        "reference_id": reference_id,
        "user_id": user_id, "user_name": user_name,
        "store_id": store_id, "store_name": store_name,
        "buyer_id": buyer_id, "buyer_name": buyer_name,
        "percent": percent, "note": note, "created_at": now,
    })


async def _credit_wallet(user_id, amt, source, ref_id, note, now, total_field=None):
    inc = {"balance": amt}
    if total_field:
        inc[total_field] = amt
    await db.wallet.update_one(
        {"user_id": user_id}, {"$inc": inc, "$setOnInsert": {"user_id": user_id, "created_at": now}},
        upsert=True)
    await db.wallet_transactions.insert_one({
        "user_id": user_id, "type": "credit", "source": source,
        "amount": round(amt, 2), "reference_id": ref_id, "note": note, "created_at": now})


async def _find_user(uid):
    if not uid:
        return None
    try:
        u = await db.users.find_one({"_id": ObjectId(uid)})
    except Exception:
        u = None
    if u:
        u["id"] = str(u["_id"])
    return u


async def apply_purchase_earnings(store: dict, buyer_id: str, gross: float, txn_id: str,
                                  now: str, net_paid: float = None):
    """Compute split, credit direct referrer + chain uplines, and write the ledger.
    Returns the full breakdown dict."""
    rates = store_rates(store)
    bd = compute_full_breakdown(gross, store, rates)
    if net_paid is not None:
        bd["net_paid"] = round(net_paid, 2)

    sid = str(store.get("_id")) if store.get("_id") else store.get("store_id")
    store_name = store.get("business_name") or store.get("store_name")
    buyer = await _find_user(buyer_id)
    buyer_name = (buyer or {}).get("name")

    # Ledger: customer discount claimed
    if bd["discount_amount"] > 0:
        await write_ledger("customer", "discount_claim", bd["discount_amount"], now,
                           reference_id=txn_id, user_id=buyer_id, user_name=buyer_name,
                           store_id=sid, store_name=store_name, percent=bd["discount_percent"],
                           note="Customer discount on purchase")
    # Ledger: merchant earning
    await write_ledger("merchant", "merchant_earning", bd["merchant_amount"], now,
                       reference_id=txn_id, user_id=store.get("owner_id"), store_id=sid,
                       store_name=store_name, buyer_id=buyer_id, buyer_name=buyer_name,
                       note="Merchant net after deductions")
    # Ledger: NAMCOS earning
    if bd["namcos_earning"] > 0:
        await write_ledger("namcos", "namcos_earning", bd["namcos_earning"], now,
                           reference_id=txn_id, store_id=sid, store_name=store_name,
                           buyer_id=buyer_id, buyer_name=buyer_name, percent=bd["namcos_percent"],
                           note="NAMCOS platform earning")

    await _credit_referral_chain(buyer, bd, txn_id, now, store_name, sid)
    return bd


async def _credit_referral_chain(buyer, bd, ref_id, now, store_name, sid):
    if not buyer:
        return
    direct_id = buyer.get("referred_by")
    buyer_name = buyer.get("name")

    # Direct referral reward
    if bd["referral_amount"] > 0 and direct_id:
        amt = bd["referral_amount"]
        await _credit_wallet(direct_id, amt, "referral", ref_id,
                             f"Referral reward from {buyer_name}", now,
                             total_field="total_referral_earnings")
        direct = await _find_user(direct_id)
        await db.referral_earnings.insert_one({
            "referrer_id": direct_id, "buyer_id": buyer.get("id"), "buyer_name": buyer_name,
            "amount": amt, "percent": bd["referral_percent"], "net_paid": bd["net_paid"],
            "kind": "direct", "level": 1, "reference_id": ref_id, "created_at": now})
        await write_ledger("referral", "referral_earning", amt, now, reference_id=ref_id,
                           user_id=direct_id, user_name=(direct or {}).get("name"),
                           store_id=sid, store_name=store_name, buyer_id=buyer.get("id"),
                           buyer_name=buyer_name, percent=bd["referral_percent"],
                           note=f"Direct referral from {buyer_name}")
        await db.notifications.insert_one({
            "user_id": direct_id, "title": "Referral Reward",
            "message": f"You earned ₹{amt:.2f} from {buyer_name}'s purchase",
            "type": "referral", "is_read": False, "created_at": now})

    # Chain reward — distributed to uplines ABOVE the direct referrer, decreasing split
    if bd["chain_amount"] > 0 and direct_id:
        uplines = []
        current = await _find_user(direct_id)
        while current and current.get("referred_by") and len(uplines) < MAX_CHAIN_LEVELS:
            up = await _find_user(current.get("referred_by"))
            if not up:
                break
            uplines.append(up)
            current = up
        if uplines:
            weights = [0.5 ** (i + 1) for i in range(len(uplines))]
            wsum = sum(weights)
            for lvl, (up, w) in enumerate(zip(uplines, weights), start=2):
                amt = round(bd["chain_amount"] * w / wsum, 2)
                if amt <= 0:
                    continue
                await _credit_wallet(up["id"], amt, "chain", ref_id,
                                     f"Chain bonus (L{lvl}) from {buyer_name}", now,
                                     total_field="total_chain_earnings")
                await db.referral_earnings.insert_one({
                    "referrer_id": up["id"], "buyer_id": buyer.get("id"), "buyer_name": buyer_name,
                    "amount": amt, "percent": bd["chain_percent"], "net_paid": bd["net_paid"],
                    "kind": "chain", "level": lvl, "reference_id": ref_id, "created_at": now})
                await write_ledger("chain", "chain_earning", amt, now, reference_id=ref_id,
                                   user_id=up["id"], user_name=up.get("name"), store_id=sid,
                                   store_name=store_name, buyer_id=buyer.get("id"),
                                   buyer_name=buyer_name, percent=bd["chain_percent"],
                                   note=f"Chain bonus level {lvl} from {buyer_name}")
                await db.notifications.insert_one({
                    "user_id": up["id"], "title": "Chain Bonus",
                    "message": f"You earned ₹{amt:.2f} chain bonus (level {lvl})",
                    "type": "referral", "is_read": False, "created_at": now})


# ─── Legacy single-level referral (kept for any old callers) ──
async def credit_referral(buyer: dict, net_paid: float, referral_pct: float, ref_id: str, now: str):
    if not buyer or referral_pct <= 0:
        return
    referrer_id = buyer.get("referred_by")
    if not referrer_id:
        return
    amt = round(net_paid * referral_pct / 100, 2)
    if amt <= 0:
        return
    await _credit_wallet(referrer_id, amt, "referral", ref_id,
                         f"Referral reward from {buyer.get('name', 'a user')}", now,
                         total_field="total_referral_earnings")
    await db.referral_earnings.insert_one({
        "referrer_id": referrer_id, "buyer_id": buyer.get("id"), "buyer_name": buyer.get("name"),
        "amount": amt, "percent": referral_pct, "net_paid": net_paid, "kind": "direct",
        "level": 1, "reference_id": ref_id, "created_at": now})


async def credit_referral_by_customer_id(customer_id: str, net_paid: float, referral_pct: float, ref_id: str, now: str):
    u = await _find_user(customer_id)
    if u:
        await credit_referral(u, net_paid, referral_pct, ref_id, now)
