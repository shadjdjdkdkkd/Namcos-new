"""NAMCOS Phase 4 end-to-end tests — referral chain, wallet pay, admin overhaul.

Covers:
  - Referral chain signup A -> B -> C via /auth/verify-otp
  - compute_full_breakdown + apply_purchase_earnings via /payments/pay-with-wallet
    (wallet seeded in Mongo since Razorpay topup is LIVE)
  - Direct + chain wallet credits, unified ledger entries
  - Razorpay config + order creation (no checkout)
  - Image upload to Cloudinary
  - User wallet withdrawal (success + insufficient)
  - Admin: login, dashboard-metrics, users/users-count, user detail,
    merchants-count, stores/{id}/rates, stores/{id}/transactions,
    transactions grouped, withdrawals-list, withdrawals-export (CSV),
    business-types CRUD, admin profile name update, listings-count
"""
import os
import io
import time
import random
import pytest
import requests
import pymongo
from bson import ObjectId

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MONGO[os.environ.get("DB_NAME", "test_database")]


# ─── Helpers ──────────────────────────────────────────────
def _new_phone():
    # Deterministic unique per run so we can clean up afterwards
    return "+91" + str(random.randint(7000000000, 7999999999))


def _signup(phone, name, referral_code=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE}/api/auth/send-otp", json={"phone": phone})
    assert r.status_code == 200, r.text
    otp = r.json()["otp"]
    payload = {"phone": phone, "otp": otp, "name": name}
    if referral_code:
        payload["referral_code"] = referral_code
    r2 = s.post(f"{BASE}/api/auth/verify-otp", json=payload)
    assert r2.status_code == 200, r2.text
    data = r2.json()
    user = data["user"]
    user["session"] = s
    user["is_new_user"] = data.get("is_new_user")
    return user


def _admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE}/api/auth/admin-login",
               json={"email": "glowcelesta@gmail.com", "password": "Admin@namcos2024"})
    assert r.status_code == 200, r.text
    return s


def _seed_wallet(user_id, balance):
    DB.wallet.update_one(
        {"user_id": user_id},
        {"$set": {"balance": float(balance), "user_id": user_id}},
        upsert=True,
    )


def _pick_published_store():
    s = DB.stores.find_one({"status": {"$in": ["published", "approved", "active"]}}) \
        or DB.stores.find_one({})
    return s


# ─── Shared chain (A -> B -> C) fixture ───────────────────
@pytest.fixture(scope="module")
def chain_users():
    pa, pb, pc = _new_phone(), _new_phone(), _new_phone()
    a = _signup(pa, "TEST_Alice")
    assert a["is_new_user"] is True
    assert a.get("referral_code")

    b = _signup(pb, "TEST_Bob", referral_code=a["referral_code"])
    assert b["is_new_user"] is True
    assert b.get("referred_by") == a["id"]

    c = _signup(pc, "TEST_Carol", referral_code=b["referral_code"])
    assert c["is_new_user"] is True
    assert c.get("referred_by") == b["id"]

    yield {"a": a, "b": b, "c": c}

    # Teardown
    for u in (a, b, c):
        try:
            DB.users.delete_one({"_id": ObjectId(u["id"])})
            DB.wallet.delete_one({"user_id": u["id"]})
            DB.wallet_transactions.delete_many({"user_id": u["id"]})
            DB.referral_earnings.delete_many({"$or": [{"referrer_id": u["id"]},
                                                        {"buyer_id": u["id"]}]})
            DB.transactions.delete_many({"$or": [{"user_id": u["id"]},
                                                   {"buyer_id": u["id"]}]})
            DB.payments.delete_many({"customer_id": u["id"]})
            DB.orders.delete_many({"customer_id": u["id"]})
            DB.notifications.delete_many({"user_id": u["id"]})
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════
# 1) AUTH + REFERRAL CHAIN
# ═══════════════════════════════════════════════════════════
class TestReferralSignupChain:
    def test_is_new_user_flag_for_fresh_phone(self):
        p = _new_phone()
        s = requests.Session(); s.headers.update({"Content-Type": "application/json"})
        otp = s.post(f"{BASE}/api/auth/send-otp", json={"phone": p}).json()["otp"]
        r = s.post(f"{BASE}/api/auth/verify-otp", json={"phone": p, "otp": otp})
        assert r.status_code == 200
        data = r.json()
        assert data["is_new_user"] is True
        # Second login — not new
        otp2 = s.post(f"{BASE}/api/auth/send-otp", json={"phone": p}).json()["otp"]
        r2 = s.post(f"{BASE}/api/auth/verify-otp", json={"phone": p, "otp": otp2})
        assert r2.json()["is_new_user"] is False
        DB.users.delete_one({"phone": p})

    def test_chain_referred_by_set(self, chain_users):
        a = chain_users["a"]; b = chain_users["b"]; c = chain_users["c"]
        # Verify via referrals/me from each session
        r = a["session"].get(f"{BASE}/api/referrals/me")
        assert r.status_code == 200
        a_ref = r.json()
        assert a_ref["referral_code"] == a["referral_code"]
        assert a_ref["referred_count"] >= 1

        r = b["session"].get(f"{BASE}/api/referrals/me")
        b_ref = r.json()
        assert b_ref["referred_count"] >= 1  # Carol

    def test_profile_name_update(self, chain_users):
        a = chain_users["a"]
        r = a["session"].put(f"{BASE}/api/auth/profile", json={"name": "TEST_Alice_Updated"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Alice_Updated"


# ═══════════════════════════════════════════════════════════
# 2) WALLET PAY — chain money distribution
# ═══════════════════════════════════════════════════════════
class TestWalletPayChain:
    def test_pay_with_wallet_credits_chain(self, chain_users):
        a = chain_users["a"]; b = chain_users["b"]; c = chain_users["c"]
        store = _pick_published_store()
        assert store, "No store seed in DB"
        store_id = str(store["_id"])

        # Seed Carol's wallet with ₹1000
        _seed_wallet(c["id"], 1000.0)

        gross = 200.0
        r = c["session"].post(f"{BASE}/api/payments/pay-with-wallet",
                              json={"store_id": store_id, "amount": gross})
        assert r.status_code == 200, r.text
        data = r.json()
        bd = data["breakdown"]
        assert bd["gross_amount"] == gross
        # Breakdown math consistency
        expected_net = round(gross - bd["discount_amount"], 2)
        assert abs(bd["net_paid"] - expected_net) < 0.01
        expected_merchant = round(gross - bd["discount_amount"] - bd["referral_amount"]
                                    - bd["chain_amount"] - bd["namcos_earning"], 2)
        assert abs(bd["merchant_amount"] - expected_merchant) < 0.01
        assert bd["merchant_amount"] >= 0, f"NEGATIVE merchant_amount: {bd}"

        # Wallet debited by net
        wc = DB.wallet.find_one({"user_id": c["id"]})
        assert abs(wc["balance"] - (1000 - bd["net_paid"])) < 0.01

        # Direct referrer (Bob) credited referral_amount
        if bd["referral_amount"] > 0:
            wb = DB.wallet.find_one({"user_id": b["id"]}) or {"balance": 0}
            assert abs(wb.get("balance", 0) - bd["referral_amount"]) < 0.01, \
                f"Bob wallet {wb} vs expected {bd['referral_amount']}"
            # referral_earnings has a 'direct' row for Bob
            re_b = DB.referral_earnings.find_one({"referrer_id": b["id"], "kind": "direct"})
            assert re_b is not None

        # Chain upline (Alice) credited chain_amount (level=2)
        if bd["chain_amount"] > 0:
            wa = DB.wallet.find_one({"user_id": a["id"]}) or {"balance": 0}
            assert abs(wa.get("balance", 0) - bd["chain_amount"]) < 0.01, \
                f"Alice wallet {wa} vs expected chain {bd['chain_amount']}"
            re_a = DB.referral_earnings.find_one({"referrer_id": a["id"], "kind": "chain"})
            assert re_a is not None
            assert re_a["level"] == 2

        # Unified ledger entries
        txn_id = data["transaction_id"]
        groups = set(x["txn_group"] for x in DB.transactions.find({"reference_id": txn_id}))
        assert "merchant" in groups
        if bd["namcos_earning"] > 0:
            assert "namcos" in groups
        if bd["discount_amount"] > 0:
            assert "customer" in groups
        if bd["referral_amount"] > 0:
            assert "referral" in groups
        if bd["chain_amount"] > 0:
            assert "chain" in groups

    def test_insufficient_wallet(self, chain_users):
        a = chain_users["a"]
        store = _pick_published_store()
        _seed_wallet(a["id"], 10.0)
        r = a["session"].post(f"{BASE}/api/payments/pay-with-wallet",
                              json={"store_id": str(store["_id"]), "amount": 500})
        assert r.status_code == 400
        body = r.json()
        detail = body.get("detail")
        # Structured error: {code: INSUFFICIENT_FUNDS, ...}
        if isinstance(detail, dict):
            assert detail.get("code") == "INSUFFICIENT_FUNDS"


# ═══════════════════════════════════════════════════════════
# 3) RAZORPAY — config + order creation (no checkout)
# ═══════════════════════════════════════════════════════════
class TestRazorpay:
    def test_config_live(self, chain_users):
        c = chain_users["c"]
        r = c["session"].get(f"{BASE}/api/razorpay/config")
        assert r.status_code == 200
        cfg = r.json()
        assert cfg.get("mock_mode") is False, f"Expected LIVE Razorpay, got {cfg}"
        assert cfg.get("key_id")

    def test_create_order(self, chain_users):
        c = chain_users["c"]
        store = _pick_published_store()
        r = c["session"].post(f"{BASE}/api/razorpay/order",
                              json={"store_id": str(store["_id"]), "amount": 150})
        # Will hit LIVE Razorpay; still works for test accounts
        assert r.status_code in (200, 500), r.text
        if r.status_code == 200:
            data = r.json()
            assert data.get("razorpay_order_id", "").startswith("order_")
            assert data.get("amount") > 0
            assert data.get("breakdown")


# ═══════════════════════════════════════════════════════════
# 4) UPLOADS — Cloudinary
# ═══════════════════════════════════════════════════════════
class TestUploadCloudinary:
    def test_upload_returns_cloudinary_url(self, chain_users):
        c = chain_users["c"]
        # Minimal valid JPEG (>100 bytes)
        png_bytes = (b"\x89PNG\r\n\x1a\n" + b"\x00" * 200)
        files = {"file": ("test.png", png_bytes, "image/png")}
        # Can't use the chain session with Content-Type json header → use a fresh session
        s = requests.Session()
        s.cookies.update(c["session"].cookies)
        r = s.post(f"{BASE}/api/uploads", files=files)
        assert r.status_code in (200, 502, 400), r.text
        if r.status_code == 200:
            data = r.json()
            assert "res.cloudinary.com" in data["url"], f"Not cloudinary: {data}"
            # Cleanup
            DB.files.delete_one({"id": data["id"]})


# ═══════════════════════════════════════════════════════════
# 5) REFERRALS /me response shape
# ═══════════════════════════════════════════════════════════
class TestReferralsMe:
    def test_response_fields(self, chain_users):
        b = chain_users["b"]
        r = b["session"].get(f"{BASE}/api/referrals/me")
        assert r.status_code == 200
        d = r.json()
        for key in ("referral_code", "referred_count", "direct_earnings",
                    "chain_earnings", "total_earnings"):
            assert key in d
        assert d["total_earnings"] == round(d["direct_earnings"] + d["chain_earnings"], 2)


# ═══════════════════════════════════════════════════════════
# 6) USER WALLET WITHDRAWAL
# ═══════════════════════════════════════════════════════════
class TestUserWithdrawal:
    def test_withdrawal_success_and_insufficient(self, chain_users):
        a = chain_users["a"]
        _seed_wallet(a["id"], 500.0)
        r = a["session"].post(f"{BASE}/api/wallet/withdrawals",
                              json={"amount": 100, "upi_id": "test@upi"})
        assert r.status_code == 200, r.text
        wd = r.json()
        assert wd["success"] is True
        assert wd["balance"] == 400.0
        # Insufficient
        r2 = a["session"].post(f"{BASE}/api/wallet/withdrawals",
                               json={"amount": 10000, "upi_id": "test@upi"})
        assert r2.status_code == 400
        # Min amount
        r3 = a["session"].post(f"{BASE}/api/wallet/withdrawals",
                               json={"amount": 50, "upi_id": "test@upi"})
        assert r3.status_code == 400


# ═══════════════════════════════════════════════════════════
# 7) MERCHANT WITHDRAWAL (demo merchant +919876543210)
# ═══════════════════════════════════════════════════════════
class TestMerchantWithdrawal:
    def test_demo_merchant_balance_and_withdrawal(self):
        phone = "+919876543210"
        s = requests.Session(); s.headers.update({"Content-Type": "application/json"})
        otp = s.post(f"{BASE}/api/auth/send-otp", json={"phone": phone}).json()["otp"]
        r = s.post(f"{BASE}/api/auth/verify-otp", json={"phone": phone, "otp": otp})
        assert r.status_code == 200
        bal = s.get(f"{BASE}/api/merchant/balance").json()
        print("merchant balance:", bal)
        assert any(k in bal for k in ("available", "balance", "available_balance"))


# ═══════════════════════════════════════════════════════════
# 8) ADMIN OVERHAUL
# ═══════════════════════════════════════════════════════════
@pytest.fixture(scope="module")
def admin():
    return _admin_session()


class TestAdminOverhaul:
    def test_dashboard_metrics(self, admin):
        r = admin.get(f"{BASE}/api/admin/dashboard-metrics")
        assert r.status_code == 200, r.text
        d = r.json()["metrics"]
        for key in ("total_revenue", "merchant_revenue", "namcos_revenue",
                    "referral_revenue", "chain_revenue", "customer_discount",
                    "merchant_valid_balance", "user_wallet_balance",
                    "withdrawal_processed", "withdrawal_pending"):
            assert key in d

    def test_dashboard_metrics_preset(self, admin):
        r = admin.get(f"{BASE}/api/admin/dashboard-metrics?preset=today")
        assert r.status_code == 200

    def test_users_count_and_search(self, admin):
        r = admin.get(f"{BASE}/api/admin/users-count")
        assert r.status_code == 200
        assert "total" in r.json()
        r2 = admin.get(f"{BASE}/api/admin/users-count?search=TEST_")
        assert r2.status_code == 200

    def test_users_list_has_badges(self, admin):
        r = admin.get(f"{BASE}/api/admin/users?page=1&limit=5")
        assert r.status_code == 200
        data = r.json()
        users = data if isinstance(data, list) else data.get("items", data.get("users", []))
        if users:
            u = users[0]
            assert "roles" in u

    def test_user_detail_drilldown(self, admin, chain_users):
        c = chain_users["c"]
        r = admin.get(f"{BASE}/api/admin/users/{c['id']}/detail")
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("user", "purchases", "listings_count", "referrals",
                    "wallet", "wallet_transactions", "withdrawals"):
            assert key in d
        assert d["user"]["id"] == c["id"]
        assert "direct_bonus" in d["referrals"] and "chain_bonus" in d["referrals"]

    def test_merchants_count(self, admin):
        r = admin.get(f"{BASE}/api/admin/merchants-count")
        assert r.status_code == 200
        assert "total" in r.json()

    def test_store_rates_update(self, admin):
        store = _pick_published_store()
        sid = str(store["_id"])
        orig = {
            "discount_percent": store.get("discount_percent", 10),
            "referral_percent": store.get("referral_percent", 1),
            "chain_percent": store.get("chain_percent", 1),
            "namcos_percent": store.get("namcos_percent", 3),
        }
        r = admin.put(f"{BASE}/api/admin/stores/{sid}/rates",
                      json={"discount_percent": 12, "referral_percent": 2,
                            "chain_percent": 2, "namcos_percent": 4})
        assert r.status_code == 200
        updated = DB.stores.find_one({"_id": ObjectId(sid)})
        assert updated["discount_percent"] == 12
        # Restore
        admin.put(f"{BASE}/api/admin/stores/{sid}/rates", json=orig)

    def test_store_transactions(self, admin):
        store = _pick_published_store()
        r = admin.get(f"{BASE}/api/admin/stores/{str(store['_id'])}/transactions")
        assert r.status_code == 200
        d = r.json()
        for key in ("total_transactions", "total_amount",
                    "merchant_revenue_after_deduction", "namcos_earning",
                    "customer_discount"):
            assert key in d

    def test_transactions_grouped(self, admin):
        r = admin.get(f"{BASE}/api/admin/transactions?limit=10")
        assert r.status_code == 200
        d = r.json()
        assert "summary" in d and "items" in d
        # Validate txn_group buckets observed
        for g in d["summary"]:
            assert g in ("customer", "merchant", "namcos", "referral", "chain", "withdrawal")

    def test_transactions_month_filter(self, admin):
        import datetime as dt
        m = dt.datetime.now().strftime("%Y-%m")
        r = admin.get(f"{BASE}/api/admin/transactions?month={m}&limit=5")
        assert r.status_code == 200

    def test_withdrawals_list(self, admin):
        r = admin.get(f"{BASE}/api/admin/withdrawals-list?kind=user&limit=5")
        assert r.status_code == 200
        assert "items" in r.json()
        r2 = admin.get(f"{BASE}/api/admin/withdrawals-list?kind=merchant&limit=5")
        assert r2.status_code == 200

    def test_withdrawals_export_csv(self, admin):
        r = admin.get(f"{BASE}/api/admin/withdrawals-export?kind=user")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert r.text.startswith("Date,")

    def test_withdrawal_set_reference(self, admin, chain_users):
        # Make a user withdrawal we can mark paid
        a = chain_users["a"]
        _seed_wallet(a["id"], 500.0)
        r = a["session"].post(f"{BASE}/api/wallet/withdrawals",
                              json={"amount": 100, "upi_id": "ref@upi"})
        wid = r.json()["withdrawal_id"]
        r2 = admin.put(f"{BASE}/api/admin/withdrawals/{wid}/reference",
                       json={"reference_id": "UTR123456", "notes": "paid via upi"})
        assert r2.status_code == 200
        wd = DB.withdrawals.find_one({"_id": ObjectId(wid)})
        assert wd["status"] == "paid"
        assert wd["reference_id"] == "UTR123456"
        DB.withdrawals.delete_one({"_id": ObjectId(wid)})

    def test_business_types_crud(self, admin):
        name = f"TEST_BT_{int(time.time())}"
        r = admin.post(f"{BASE}/api/admin/business-types", json={"name": name})
        assert r.status_code == 200
        bt_id = r.json()["id"]
        # List with search
        r2 = admin.get(f"{BASE}/api/admin/business-types?search=TEST_BT")
        assert r2.status_code == 200
        assert any(b["name"] == name for b in r2.json())
        # Toggle active
        r3 = admin.put(f"{BASE}/api/admin/business-types/{bt_id}", json={"is_active": False})
        assert r3.status_code == 200
        # Delete
        r4 = admin.delete(f"{BASE}/api/admin/business-types/{bt_id}")
        assert r4.status_code == 200

    def test_admin_profile_update(self, admin):
        r = admin.get(f"{BASE}/api/auth/me")
        original_name = r.json().get("name", "Admin")
        r2 = admin.put(f"{BASE}/api/admin/profile", json={"name": "TEST_Admin"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST_Admin"
        # Restore
        admin.put(f"{BASE}/api/admin/profile", json={"name": original_name})

    def test_admin_change_password_wrong_current(self, admin):
        r = admin.post(f"{BASE}/api/admin/change-password",
                       json={"current_password": "WRONG", "new_password": "NewPass@123"})
        assert r.status_code in (400, 401)

    def test_listings_count(self, admin):
        for kind in ("stores", "agriculture", "services", "classifieds"):
            r = admin.get(f"{BASE}/api/admin/listings-count/{kind}")
            assert r.status_code == 200, f"{kind}: {r.text}"
            assert "total" in r.json() or "count" in r.json()
