"""NAMCOS backend API tests - Auth, Pay-at-store, Admin APIs"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

@pytest.fixture(scope="module")
def customer_session():
    """Get an authenticated customer session"""
    phone = "+919888888888"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": phone})
    assert r.status_code == 200, f"send-otp failed: {r.text}"
    otp = r.json().get("otp")
    r2 = s.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "otp": otp})
    assert r2.status_code == 200, f"verify-otp failed: {r2.text}"
    token = r2.json().get("access_token")
    for cookie in r2.cookies:
        s.cookies.set(cookie.name, cookie.value)
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s

@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/admin-login",
               json={"email": "glowcelesta@gmail.com", "password": "Admin@namcos2024"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return s

# Auth Tests
class TestAuth:
    def test_send_otp(self, session):
        r = session.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": "+919876543210"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("success") == True
        assert "otp" in data
        print(f"OTP returned: {data['otp']}")

    def test_verify_otp(self, session):
        phone = "+919111111111"
        r = session.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": phone})
        otp = r.json().get("otp")
        r2 = session.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "otp": otp})
        assert r2.status_code == 200
        data = r2.json()
        assert "user" in data
        assert "access_token" in data

    def test_admin_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/admin-login",
                          json={"email": "glowcelesta@gmail.com", "password": "Admin@namcos2024"})
        assert r.status_code == 200
        data = r.json()
        assert "user" in data
        assert any(role in data.get("roles", []) for role in ["admin", "super_admin"])

    def test_admin_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/admin-login",
                          json={"email": "glowcelesta@gmail.com", "password": "wrong"})
        assert r.status_code == 401

    def test_get_me(self, customer_session):
        r = customer_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert "id" in data


# Admin APIs
class TestAdminAPIs:
    def test_admin_get_users(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/users")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_admin_get_stores(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/merchants")
        assert r.status_code == 200

    def test_admin_get_transactions(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/payments")
        assert r.status_code == 200

    def test_admin_dashboard_stats(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 200
        data = r.json()
        print(f"Stats: {data}")


# New Feature APIs - Banners, Categories, Wallet Balance
class TestNewFeatureAPIs:
    def test_get_banners(self, session):
        r = session.get(f"{BASE_URL}/api/banners")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Banners count: {len(data)}")

    def test_get_categories(self, session):
        r = session.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 7, f"Expected 7 categories, got {len(data)}"
        for cat in data:
            assert "is_active" in cat, "Category missing is_active field"
        print(f"Categories: {[c.get('name') for c in data]}")

    def test_wallet_balance_authenticated(self, customer_session):
        r = customer_session.get(f"{BASE_URL}/api/wallet/balance")
        assert r.status_code == 200
        data = r.json()
        assert "balance" in data, f"No balance field: {data}"
        print(f"Wallet balance: {data['balance']}")

    def test_wallet_balance_unauthenticated(self, session):
        r = session.get(f"{BASE_URL}/api/wallet/balance")
        assert r.status_code in [401, 403], f"Expected auth error, got {r.status_code}"

    def test_admin_banners_crud(self, admin_session):
        # Create banner
        payload = {"title": "TEST_Banner", "subtitle": "Test subtitle", "is_active": True}
        r = admin_session.post(f"{BASE_URL}/api/admin/banners", json=payload)
        assert r.status_code in [200, 201], f"Create banner failed: {r.text}"
        banner = r.json()
        assert "id" in banner
        banner_id = banner["id"]
        # Get banners
        r2 = admin_session.get(f"{BASE_URL}/api/admin/banners")
        assert r2.status_code == 200
        # Delete
        r3 = admin_session.delete(f"{BASE_URL}/api/admin/banners/{banner_id}")
        assert r3.status_code in [200, 204]

    def test_admin_categories_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/categories")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Admin categories: {len(data)}")

    def test_admin_users_pagination(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/users?page=1&limit=5")
        assert r.status_code == 200

    def test_admin_transactions_pagination(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/payments?page=1&limit=5")
        assert r.status_code == 200


# Pay-at-store
class TestPayAtStore:
    def test_pay_at_store_no_store(self, customer_session):
        """Should fail with invalid store ID"""
        r = customer_session.post(f"{BASE_URL}/api/payments/pay-at-store",
                                  json={"store_id": "000000000000000000000000",
                                        "amount": 100, "payment_method": "upi"})
        assert r.status_code == 404

    def test_pay_at_store_too_low_amount(self, customer_session):
        """Should fail with amount < 1"""
        r = customer_session.post(f"{BASE_URL}/api/payments/pay-at-store",
                                  json={"store_id": "000000000000000000000001",
                                        "amount": 0, "payment_method": "upi"})
        assert r.status_code in [400, 404]

    def test_stores_list(self, customer_session):
        """Get stores for pay-at-store test"""
        r = customer_session.get(f"{BASE_URL}/api/stores")
        assert r.status_code == 200
        data = r.json()
        print(f"Stores count: {len(data) if isinstance(data, list) else data}")
        return data
