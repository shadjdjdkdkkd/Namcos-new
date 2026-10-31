# Chain earnings, store chain config, branding, My Listings edit — regression tests (iteration 6)
import os, asyncio, pytest, requests
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')
load_dotenv('/app/backend/.env')
BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"
STORE_ID = "6ace61433fe289ae57ef1aa9"  # Green Mart: disc 10, ref 1, chain 1
DEFAULT = [{"people": 1, "percent": 4}, {"people": 1, "percent": 2}, {"people": 2, "percent": 1},
           {"people": 2, "percent": 0.5}, {"people": 4, "percent": 0.25}]


def mongo(coro_fn):
    async def run():
        c = AsyncIOMotorClient(os.environ['MONGO_URL'])
        try:
            return await coro_fn(c[os.environ['DB_NAME']])
        finally:
            c.close()
    return asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.run(run())


def login_phone(phone, referral_code=None, name=None):
    s = requests.Session()
    assert s.post(f"{API}/auth/send-otp", json={"phone": phone}).status_code == 200
    body = {"phone": phone, "otp": "123456", "name": name}
    if referral_code:
        body["referral_code"] = referral_code
    r = s.post(f"{API}/auth/verify-otp", json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    s.headers["Authorization"] = f"Bearer {d['access_token']}"
    return s, d["user"]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/admin-login", json={"email": "glowcelesta@gmail.com", "password": "Admin@namcos2024"})
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    return s


# --- Default chain template validation ---
class TestTemplate:
    def test_overview(self, admin):
        r = admin.get(f"{API}/admin/chain/overview")
        assert r.status_code == 200
        d = r.json()
        assert d["max_levels"] == 10 and len(d["template"]) == 5
        assert any(s["id"] == STORE_ID for s in d["stores"])

    def test_increasing_tier_rejected(self, admin):
        bad = [dict(t) for t in DEFAULT]
        bad[1]["percent"] = 5
        r = admin.put(f"{API}/admin/chain/template", json={"tiers": bad})
        assert r.status_code == 400 and "Tier 2" in r.text

    def test_too_many_levels_rejected(self, admin):
        bad = [dict(t) for t in DEFAULT]
        bad[4]["people"] = 6
        r = admin.put(f"{API}/admin/chain/template", json={"tiers": bad})
        assert r.status_code == 400

    def test_four_tiers_rejected(self, admin):
        r = admin.put(f"{API}/admin/chain/template", json={"tiers": DEFAULT[:4]})
        assert r.status_code == 400

    def test_valid_saves_default(self, admin):
        r = admin.put(f"{API}/admin/chain/template", json={"tiers": DEFAULT})
        assert r.status_code == 200 and abs(r.json()["total"] - 10) < 1e-6
        assert admin.get(f"{API}/admin/chain/overview").json()["template_total"] == 10

    def test_non_admin_forbidden(self):
        s, _ = login_phone("+919876543210")
        r = s.put(f"{API}/admin/chain/template", json={"tiers": DEFAULT})
        assert r.status_code in (401, 403)


# --- Per-store chain config + rates guard ---
class TestStoreChain:
    def test_mismatch_rejected(self, admin):
        tiers = [{"people": 1, "percent": 1}, {"people": 1, "percent": 0.5}, {"people": 0, "percent": 0},
                 {"people": 0, "percent": 0}, {"people": 0, "percent": 0}]
        r = admin.put(f"{API}/admin/stores/{STORE_ID}/chain", json={"chain_percent": 2, "tiers": tiers})
        assert r.status_code == 400 and "add up" in r.text

    def test_custom_then_rates_guard_then_auto(self, admin):
        tiers = [{"people": 1, "percent": 1}, {"people": 1, "percent": 0.5}, {"people": 1, "percent": 0.5},
                 {"people": 0, "percent": 0}, {"people": 0, "percent": 0}]
        r = admin.put(f"{API}/admin/stores/{STORE_ID}/chain", json={"chain_percent": 2, "tiers": tiers})
        assert r.status_code == 200, r.text
        row = [s for s in admin.get(f"{API}/admin/chain/overview").json()["stores"] if s["id"] == STORE_ID][0]
        assert row["custom"] is True and row["chain_percent"] == 2
        try:
            r = admin.put(f"{API}/admin/stores/{STORE_ID}/rates", json={"chain_percent": 3})
            assert r.status_code == 400, r.text
        finally:
            r = admin.put(f"{API}/admin/stores/{STORE_ID}/chain", json={"chain_percent": 1})
            assert r.status_code == 200
        row = [s for s in admin.get(f"{API}/admin/chain/overview").json()["stores"] if s["id"] == STORE_ID][0]
        assert row["custom"] is False and row["chain_percent"] == 1

    def test_invalid_store(self, admin):
        r = admin.put(f"{API}/admin/stores/badid/chain", json={"chain_percent": 1})
        assert r.status_code == 400


# --- Chain distribution through wallet payment ---
class TestDistribution:
    def test_chain_payout(self, admin):
        top_s, top = login_phone("+919999999999")
        top_id = top["id"]
        top_code = top["referral_code"]
        before_top = top_s.get(f"{API}/wallet/balance").json()
        mid_s, mid = login_phone("+911234567890", referral_code=top_code, name="TEST_Mid")
        assert mid["referred_by"] == top_id, "mid must be new user referred by top"
        buy_s, buyer = login_phone("+919876543211", referral_code=mid["referral_code"], name="TEST_Buyer")
        assert buyer["referred_by"] == mid["id"]
        lvl_before = {l["level"]: l["count"] for l in admin.get(f"{API}/admin/chain/overview").json()["by_level"]}

        async def seed(db):
            await db.wallet.update_one({"user_id": buyer["id"]}, {"$set": {"balance": 1000.0}}, upsert=True)
        mongo(seed)

        r = buy_s.post(f"{API}/payments/pay-with-wallet", json={"store_id": STORE_ID, "amount": 1000})
        assert r.status_code == 200, r.text
        print("PAY", r.json())

        mid_tx = mid_s.get(f"{API}/wallet/transactions").json()
        mid_tx = mid_tx.get("transactions", mid_tx) if isinstance(mid_tx, dict) else mid_tx
        print("MID TX", mid_tx)
        srcs = {t["source"]: t for t in mid_tx}
        assert srcs["referral"]["amount"] == 10 and srcs["referral"]["store_name"] == "Green Mart"
        assert srcs["chain"]["amount"] == 4 and srcs["chain"]["level"] == 1

        top_tx = top_s.get(f"{API}/wallet/transactions").json()
        top_tx = top_tx.get("transactions", top_tx) if isinstance(top_tx, dict) else top_tx
        chain_top = [t for t in top_tx if t.get("source") == "chain" and t.get("buyer_name") == "TEST_Buyer"]
        assert chain_top and chain_top[0]["amount"] == 2 and chain_top[0]["level"] == 2
        assert not [t for t in top_tx if t.get("source") == "referral" and t.get("buyer_name") == "TEST_Buyer"]
        after_top = top_s.get(f"{API}/wallet/balance").json()
        print("TOP wallet", before_top.get("balance"), after_top.get("balance"))

        me = mid_s.get(f"{API}/chain/me").json()
        assert me["direct_bonus"] == 10 and me["chain_bonus"] == 4
        assert me["team_by_level"][0]["people"] == 1
        tme = top_s.get(f"{API}/chain/me").json()
        assert tme["team_by_level"][0]["people"] >= 1 and tme["team_by_level"][1]["people"] >= 1

        lvl_after = {l["level"]: l["count"] for l in admin.get(f"{API}/admin/chain/overview").json()["by_level"]}
        assert lvl_after.get(1, 0) == lvl_before.get(1, 0) + 1
        assert lvl_after.get(2, 0) == lvl_before.get(2, 0) + 1
        bw = buy_s.get(f"{API}/wallet/balance").json()
        assert abs(bw["balance"] - 100) < 0.01
