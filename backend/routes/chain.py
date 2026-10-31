"""Chain earnings admin/user endpoints + app branding."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
from typing import Optional, List

from database import db
from auth_utils import get_current_user, doc
from routes.admin import admin_required
from earnings import (validate_tiers, clean_tiers, tiers_total, get_template, tiers_for_store,
                      store_rates, MAX_CHAIN_LEVELS)

chain_router = APIRouter(tags=["Chain"])


class Tier(BaseModel):
    people: int
    percent: float


class TemplateBody(BaseModel):
    tiers: List[Tier]


class StoreChainBody(BaseModel):
    chain_percent: float
    tiers: Optional[List[Tier]] = None


class BrandingBody(BaseModel):
    app_name: Optional[str] = None
    logo_url: Optional[str] = None


@chain_router.get("/admin/chain/overview")
async def chain_overview(request: Request):
    await admin_required(request)
    template = await get_template()
    by_level = await db.referral_earnings.aggregate([
        {"$match": {"kind": "chain"}},
        {"$group": {"_id": "$level", "amount": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}]).to_list(20)
    top = await db.referral_earnings.aggregate([
        {"$match": {"kind": "chain"}},
        {"$group": {"_id": "$referrer_id", "amount": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"amount": -1}}, {"$limit": 10}]).to_list(10)
    for t in top:
        try:
            u = await db.users.find_one({"_id": ObjectId(t["_id"])}, {"name": 1, "phone": 1})
        except Exception:
            u = None
        t["name"] = (u or {}).get("name") or "User"
        t["phone"] = (u or {}).get("phone")
        t["user_id"] = t.pop("_id")
    unclaimed = await db.transactions.aggregate([
        {"$match": {"txn_type": "chain_unclaimed"}},
        {"$group": {"_id": None, "amount": {"$sum": "$amount"}}}]).to_list(1)
    recent = await db.referral_earnings.find({"kind": "chain"}).sort("created_at", -1).to_list(20)
    stores = await db.stores.find({}, {"business_name": 1, "chain_percent": 1, "chain_tiers": 1,
                                       "status": 1, "locality": 1}).sort("business_name", 1).to_list(500)
    store_rows = []
    for s in stores:
        tiers = await tiers_for_store(s)
        cp = store_rates(s)["chain_pct"]
        store_rows.append({"id": str(s["_id"]), "name": s.get("business_name"), "locality": s.get("locality"),
                           "status": s.get("status"), "chain_percent": cp, "tiers": tiers,
                           "custom": bool(s.get("chain_tiers")),
                           "valid": validate_tiers(tiers, cp) is None if cp > 0 else True})
    total = round(sum(l["amount"] for l in by_level), 2)
    return {
        "template": template, "template_total": tiers_total(template), "max_levels": MAX_CHAIN_LEVELS,
        "total_distributed": total, "total_credits": sum(l["count"] for l in by_level),
        "unclaimed": round(unclaimed[0]["amount"], 2) if unclaimed else 0,
        "by_level": [{"level": l["_id"], "amount": round(l["amount"], 2), "count": l["count"]} for l in by_level],
        "top_earners": top, "recent": [doc(r) for r in recent], "stores": store_rows,
    }


@chain_router.put("/admin/chain/template")
async def save_template(body: TemplateBody, request: Request):
    await admin_required(request)
    tiers = [t.dict() for t in body.tiers]
    err = validate_tiers(tiers)
    if err:
        raise HTTPException(400, err)
    await db.settings.update_one({"key": "chain"}, {"$set": {"tiers": clean_tiers(tiers)}}, upsert=True)
    return {"success": True, "total": tiers_total(tiers)}


@chain_router.put("/admin/stores/{store_id}/chain")
async def save_store_chain(store_id: str, body: StoreChainBody, request: Request):
    await admin_required(request)
    if body.chain_percent < 0 or body.chain_percent > 50:
        raise HTTPException(400, "Chain allocation must be between 0 and 50%")
    update = {"chain_percent": round(body.chain_percent, 4)}
    unset = {}
    if body.tiers is None:
        unset = {"chain_tiers": ""}
    else:
        tiers = [t.dict() for t in body.tiers]
        err = validate_tiers(tiers, body.chain_percent)
        if err:
            raise HTTPException(400, err)
        update["chain_tiers"] = clean_tiers(tiers)
    try:
        ops = {"$set": update}
        if unset:
            ops["$unset"] = unset
        res = await db.stores.update_one({"_id": ObjectId(store_id)}, ops)
    except Exception:
        raise HTTPException(400, "Invalid store ID")
    if res.matched_count == 0:
        raise HTTPException(404, "Store not found")
    return {"success": True}


@chain_router.get("/chain/me")
async def my_chain(request: Request):
    user = await get_current_user(request, db)
    team, frontier = [], [user["id"]]
    for _ in range(MAX_CHAIN_LEVELS):
        if not frontier:
            break
        users = await db.users.find({"referred_by": {"$in": frontier}}, {"_id": 1}).to_list(5000)
        frontier = [str(u["_id"]) for u in users]
        team.append(len(frontier))
    earnings = await db.referral_earnings.find({"referrer_id": user["id"]}).sort("created_at", -1).to_list(500)
    by_level = {}
    for e in earnings:
        lv = e.get("level") or 1
        by_level[lv] = round(by_level.get(lv, 0) + e.get("amount", 0), 2)
    return {
        "team_by_level": [{"level": i + 1, "people": n} for i, n in enumerate(team)],
        "team_total": sum(team),
        "direct_bonus": round(sum(e["amount"] for e in earnings if e.get("kind") != "chain"), 2),
        "chain_bonus": round(sum(e["amount"] for e in earnings if e.get("kind") == "chain"), 2),
        "earned_by_level": [{"level": k, "amount": v} for k, v in sorted(by_level.items())],
        "plan": await get_template(),
        "history": [doc(e) for e in earnings[:50]],
    }


@chain_router.get("/branding")
async def get_branding():
    s = await db.settings.find_one({"key": "branding"}) or {}
    return {"app_name": s.get("app_name") or "NAMCOS", "logo_url": s.get("logo_url")}


@chain_router.put("/admin/branding")
async def save_branding(body: BrandingBody, request: Request):
    await admin_required(request)
    upd = {}
    if body.app_name is not None:
        name = body.app_name.strip()
        if not name or len(name) > 40:
            raise HTTPException(400, "App name must be 1–40 characters")
        upd["app_name"] = name
    if body.logo_url is not None:
        upd["logo_url"] = body.logo_url.strip() or None
    await db.settings.update_one({"key": "branding"}, {"$set": upd}, upsert=True)
    return {"success": True, **upd}
