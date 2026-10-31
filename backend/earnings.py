"""Central earnings / chain-referral engine + unified transaction ledger for NAMCOS."""
from datetime import datetime, timezone
from bson import ObjectId
from database import db

MAX_CHAIN_LEVELS = 10
TIER_COUNT = 5
# Default template (totals 10%): closer levels earn more per person
DEFAULT_TIERS = [{"people": 1, "percent": 4.0}, {"people": 1, "percent": 2.0},
                 {"people": 2, "percent": 1.0}, {"people": 2, "percent": 0.5},
                 {"people": 4, "percent": 0.25}]


def tiers_total(tiers):
    return round(sum(int(t["people"]) * float(t["percent"]) for t in tiers), 4)


def validate_tiers(tiers, chain_pct=None):
    """Strict rules. Returns an error string or None."""
    if not isinstance(tiers, list) or len(tiers) != TIER_COUNT:
        return f"Exactly {TIER_COUNT} tiers are required"
    levels = 0
    prev = None
    for i, t in enumerate(tiers, start=1):
        try:
            people, pct = int(t["people"]), float(t["percent"])
        except Exception:
            return f"Tier {i}: people and percent are required"
        if people < 0 or pct < 0:
            return f"Tier {i}: values cannot be negative"
        if people == 0 and pct > 0:
            return f"Tier {i}: percent must be 0 when people is 0"
        if people > 0 and pct <= 0:
            return f"Tier {i}: percent must be above 0"
        if people > 0:
            if prev is not None and pct > prev + 1e-9:
                return f"Tier {i}: percent per person cannot be higher than the tier above it"
            prev = pct
        levels += people
    if levels < 1 or levels > MAX_CHAIN_LEVELS:
        return f"Total people across tiers must be between 1 and {MAX_CHAIN_LEVELS} (got {levels})"
    if chain_pct is not None and abs(tiers_total(tiers) - float(chain_pct)) > 0.001:
        return f"Tiers add up to {tiers_total(tiers)}% but the shop's chain allocation is {float(chain_pct)}%"
    return None


def clean_tiers(tiers):
    return [{"people": int(t["people"]), "percent": round(float(t["percent"]), 4)} for t in tiers]


async def get_template():
    s = await db.settings.find_one({"key": "chain"}) or {}
    return s.get("tiers") or DEFAULT_TIERS


def scale_tiers(template, chain_pct):
    total = tiers_total(template)
    f = (float(chain_pct) / total) if total else 0
    return [{"people": t["people"], "percent": round(t["percent"] * f, 6)} for t in template]


async def tiers_for_store(store):
    if store.get("chain_tiers"):
        return store["chain_tiers"]
    return scale_tiers(await get_template(), store_rates(store)["chain_pct"])


def level_map(tiers):
    out = []
    for ti, t in enumerate(tiers, start=1):
        out += [(ti, float(t["percent"]))] * int(t["people"])
    return out[:MAX_CHAIN_LEVELS]


async def _distribute_chain(buyer, bd, ref_id, now, store_name, sid, tiers):
    levels = level_map(tiers)
    gross = bd["gross_amount"]
    buyer_name = buyer.get("name")
    paid = 0.0
    current = buyer
    for lvl, (tier, pct) in enumerate(levels, start=1):
        up = await _find_user(current.get("referred_by"))
        if not up:
            break
        current = up
        amt = round(gross * pct / 100, 2)
        if amt <= 0:
            continue
        paid += amt
        note = f"Chain bonus L{lvl} (Tier {tier}) · {buyer_name} paid at {store_name}"
        await _credit_wallet(up["id"], amt, "chain", ref_id, note, now, total_field="total_chain_earnings",
                             extra={"store_name": store_name, "store_id": sid, "buyer_name": buyer_name,
                                    "level": lvl, "tier": tier, "percent": pct})
        await db.referral_earnings.insert_one({
            "referrer_id": up["id"], "buyer_id": buyer.get("id"), "buyer_name": buyer_name,
            "amount": amt, "percent": pct, "net_paid": bd["net_paid"], "gross_amount": gross,
            "kind": "chain", "level": lvl, "tier": tier, "store_id": sid, "store_name": store_name,
            "reference_id": ref_id, "created_at": now})
        await write_ledger("chain", "chain_earning", amt, now, reference_id=ref_id,
                           user_id=up["id"], user_name=up.get("name"), store_id=sid,
                           store_name=store_name, buyer_id=buyer.get("id"), buyer_name=buyer_name,
                           percent=pct, note=f"Chain L{lvl} / Tier {tier} from {buyer_name}")
        await db.notifications.insert_one({
            "user_id": up["id"], "title": "Chain Bonus",
            "message": f"You earned ₹{amt:.2f} (level {lvl}) when {buyer_name} paid at {store_name}",
            "type": "referral", "is_read": False, "created_at": now})
    unclaimed = round(bd["chain_amount"] - paid, 2)
    if unclaimed > 0:
        await write_ledger("namcos", "chain_unclaimed", unclaimed, now, reference_id=ref_id,
                           store_id=sid, store_name=store_name, buyer_id=buyer.get("id"),
                           buyer_name=buyer_name, note="Unclaimed chain share (chain shorter than plan)")


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


async def _credit_wallet(user_id, amt, source, ref_id, note, now, total_field=None, extra=None):
    inc = {"balance": amt}
    if total_field:
        inc[total_field] = amt
    await db.wallet.update_one(
        {"user_id": user_id}, {"$inc": inc, "$setOnInsert": {"user_id": user_id, "created_at": now}},
        upsert=True)
    await db.wallet_transactions.insert_one({
        "user_id": user_id, "type": "credit", "source": source,
        "amount": round(amt, 2), "reference_id": ref_id, "note": note, "created_at": now, **(extra or {})})


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
    if await db.transactions.find_one({"reference_id": txn_id, "txn_type": "merchant_earning"}):
        return bd
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

    tiers = await tiers_for_store(store)
    await _credit_referral_chain(buyer, bd, txn_id, now, store_name, sid, tiers)
    return bd


async def _credit_referral_chain(buyer, bd, ref_id, now, store_name, sid, store_tiers_cache=None):
    if not buyer:
        return
    direct_id = buyer.get("referred_by")
    buyer_name = buyer.get("name")

    # Direct referral reward
    if bd["referral_amount"] > 0 and direct_id:
        amt = bd["referral_amount"]
        await _credit_wallet(direct_id, amt, "referral", ref_id,
                             f"Direct invite bonus · {buyer_name} paid at {store_name}", now,
                             total_field="total_referral_earnings",
                             extra={"store_name": store_name, "store_id": sid, "buyer_name": buyer_name, "level": 1})
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

    # Chain reward — 5-tier plan walked up the invite chain (level 1 = buyer's inviter)
    if bd["chain_amount"] > 0:
        await _distribute_chain(buyer, bd, ref_id, now, store_name, sid, store_tiers_cache)


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
