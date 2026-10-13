"""NAMCOS Phase 1 - Money core: OTP login, wallet balance, pay-with-wallet, order detail, merchant payments."""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dragon-namc2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
PHONE = "+919000000055"

# Direct Mongo access for seeding
mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "test_database")
_mc = MongoClient(mongo_url)
_db = _mc[db_name]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    # Send OTP
    r = session.post(f"{API}/auth/send-otp", json={"phone": PHONE})
    assert r.status_code == 200, f"send-otp failed: {r.status_code} {r.text}"
    data = r.json()
    otp = data.get("otp") or data.get("dev_otp")
    assert otp, f"OTP not returned in dev mode: {data}"

    r = session.post(f"{API}/auth/verify-otp", json={"phone": PHONE, "otp": otp, "name": "Test User"})
    assert r.status_code == 200, f"verify-otp failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    assert token, f"No access_token in verify-otp response: {body}"
    return token, body.get("user", {})


@pytest.fixture(scope="module")
def auth_client(session, auth_token):
    token, _ = auth_token
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


@pytest.fixture(scope="module")
def user_id(auth_token):
    _, user = auth_token
    return user.get("id")


@pytest.fixture(scope="module")
def test_store():
    """Find or create a test store"""
    store = _db.stores.find_one({})
    assert store is not None, "No stores exist in DB - seed one first"
    return str(store["_id"]), store.get("business_name")


# ───────── Tests ─────────

def test_wallet_balance_endpoint(auth_client):
    r = auth_client.get(f"{API}/wallet/balance")
    assert r.status_code == 200
    data = r.json()
    assert "balance" in data
    assert isinstance(data["balance"], (int, float))
    assert data.get("currency") == "INR"


def test_wallet_insufficient_balance(auth_client, user_id, test_store):
    """Seed wallet with small balance, then try to pay more - should get INSUFFICIENT error"""
    _db.wallet.update_one({"user_id": user_id}, {"$set": {"balance": 50.0}}, upsert=True)
    store_id, _ = test_store
    r = auth_client.post(f"{API}/payments/pay-with-wallet",
                          json={"store_id": store_id, "amount": 120, "notes": "test"})
    assert r.status_code == 400
    detail = r.json().get("detail", "")
    assert detail.startswith("INSUFFICIENT|"), f"Expected INSUFFICIENT error, got: {detail}"
    parts = detail.split("|")
    assert float(parts[1]) == 50.0
    assert float(parts[2]) == 70.0  # shortfall


def test_wallet_pay_success(auth_client, user_id, test_store):
    """Seed wallet 500, pay 120, verify balance=380, order+payment+settlement+txn created."""
    _db.wallet.update_one({"user_id": user_id}, {"$set": {"balance": 500.0}}, upsert=True)
    # Also clear previous payments for cleaner assertions (optional)
    store_id, store_name = test_store

    r = auth_client.post(f"{API}/payments/pay-with-wallet",
                          json={"store_id": store_id, "amount": 120, "notes": "TEST_wallet_pay"})
    assert r.status_code == 200, f"pay-with-wallet failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["success"] is True
    assert data["balance"] == 380.0
    assert data["amount"] == 120
    assert "order_id" in data and "transaction_id" in data

    # Verify wallet balance via API
    r2 = auth_client.get(f"{API}/wallet/balance")
    assert r2.status_code == 200
    assert r2.json()["balance"] == 380.0

    # Store order_id for next test via module-level
    pytest.wallet_pay_order_id = data["order_id"]
    pytest.wallet_pay_txn_id = data["transaction_id"]

    # Verify payment appears in /payments/my
    r3 = auth_client.get(f"{API}/payments/my")
    assert r3.status_code == 200
    pays = r3.json()
    match = [p for p in pays if p.get("transaction_id") == data["transaction_id"]]
    assert len(match) == 1
    p = match[0]
    assert p["payment_method"] == "wallet"
    assert p["status"] == "captured"
    assert p.get("customer_phone") == PHONE
    assert p["net_paid"] == 120

    # Verify settlement
    settlement = _db.settlements.find_one({"transaction_id": data["transaction_id"]})
    assert settlement is not None
    assert settlement["status"] == "available"

    # Verify wallet_transactions debit
    wt = _db.wallet_transactions.find_one({"reference_id": data["transaction_id"]})
    assert wt is not None
    assert wt["type"] == "debit"
    assert wt["amount"] == 120
    assert wt.get("store_name") == store_name


def test_order_detail_endpoint(auth_client):
    oid = getattr(pytest, "wallet_pay_order_id", None)
    assert oid, "Previous test did not run"
    r = auth_client.get(f"{API}/orders/{oid}")
    assert r.status_code == 200
    o = r.json()
    assert o["final_amount"] == 120
    assert o["payment_status"] == "paid"
    assert o.get("paid_via") == "wallet"
    assert o.get("store_name")


def test_wallet_transactions_history(auth_client):
    r = auth_client.get(f"{API}/wallet/transactions")
    assert r.status_code == 200
    txns = r.json()
    assert isinstance(txns, list)
    # should include our debit
    debits = [t for t in txns if t.get("reference_id") == getattr(pytest, "wallet_pay_txn_id", None)]
    assert len(debits) == 1
    assert debits[0]["type"] == "debit"
    assert debits[0].get("store_name")


def test_merchant_payments_has_customer_fields(auth_client, test_store):
    """Login as merchant (store owner) and check /merchant/payments includes customer_name & customer_phone."""
    store_id, _ = test_store
    store = _db.stores.find_one({"_id": __import__("bson").ObjectId(store_id)})
    owner_id = store.get("owner_id")
    if not owner_id:
        pytest.skip("Store has no owner_id")
    owner = _db.users.find_one({"id": owner_id}) or _db.users.find_one({"_id": owner_id})
    if not owner or not owner.get("phone"):
        pytest.skip("Owner has no phone, cannot OTP-login")

    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/send-otp", json={"phone": owner["phone"]})
    assert r.status_code == 200
    otp = r.json().get("otp") or r.json().get("dev_otp")
    r = s.post(f"{API}/auth/verify-otp", json={"phone": owner["phone"], "otp": otp, "name": owner.get("name", "Merchant")})
    assert r.status_code == 200
    token = r.json().get("access_token") or r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}"})

    r = s.get(f"{API}/merchant/payments")
    assert r.status_code == 200
    pays = r.json()
    assert len(pays) > 0, "Merchant should see at least our wallet payment"
    # Find our wallet payment
    wallet_pays = [p for p in pays if p.get("payment_method") == "wallet"]
    assert len(wallet_pays) > 0
    p = wallet_pays[0]
    assert p.get("customer_phone") == PHONE
    assert p.get("customer_name")
