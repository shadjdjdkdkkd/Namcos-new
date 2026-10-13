"""Phase 5: visibility gating, toggle rules, payout details, dashboards, admin edit."""
import os
import re
import pytest
import requests

def _read_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"')
    except Exception:
        return ""
    return ""

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()).rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL missing"
API = f"{BASE}/api"

ADMIN_EMAIL = "glowcelesta@gmail.com"
ADMIN_PASS = "Admin@namcos2024"
U1_PHONE = "+919999900001"
U2_PHONE = "+919999900002"
U3_PHONE = "+919999900003"
OTP = "123456"
IMGS = [f"https://example.com/img{i}.jpg" for i in range(4)]


def login_phone(phone):
    s = requests.Session()
    s.post(f"{API}/auth/send-otp", json={"phone": phone}).raise_for_status()
    r = s.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": OTP, "name": "QA " + phone[-4:]})
    r.raise_for_status()
    return s, r.json()["user"]["id"]


def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/admin-login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    r.raise_for_status()
    return s


# -------- fixtures ---------
@pytest.fixture(scope="module")
def u1():
    return login_phone(U1_PHONE)


@pytest.fixture(scope="module")
def u2():
    return login_phone(U2_PHONE)


@pytest.fixture(scope="module")
def admin():
    return admin_session()


# ---------- send-otp no otp leak ----------
def test_send_otp_does_not_leak_otp():
    r = requests.post(f"{API}/auth/send-otp", json={"phone": U1_PHONE})
    assert r.status_code == 200
    body = r.json()
    assert "otp" not in body
    # also the test code shouldn't appear in message
    assert OTP not in str(body)


# ---------- payout details CRUD + validation ----------
class TestPayout:
    def test_put_valid_bank(self, u1):
        s, _ = u1
        r = s.put(f"{API}/my/payout-details", json={
            "account_holder": "QA Tester", "bank_account": "123456789012",
            "ifsc": "SBIN0001234", "bank_name": "SBI"
        })
        assert r.status_code == 200, r.text
        assert r.json()["payout"]["bank_account"] == "123456789012"

    def test_get_returns_saved(self, u1):
        s, _ = u1
        r = s.get(f"{API}/my/payout-details")
        assert r.status_code == 200
        assert r.json().get("bank_account") == "123456789012"

    def test_bad_account(self, u1):
        s, _ = u1
        r = s.put(f"{API}/my/payout-details",
                  json={"account_holder": "x", "bank_account": "123", "ifsc": "SBIN0001234"})
        assert r.status_code == 400

    def test_bad_ifsc(self, u1):
        s, _ = u1
        r = s.put(f"{API}/my/payout-details",
                  json={"account_holder": "x", "bank_account": "123456789012", "ifsc": "BAD"})
        assert r.status_code == 400

    def test_upi_valid(self, u1):
        s, _ = u1
        r = s.put(f"{API}/my/payout-details", json={"upi_id": "qa@upi"})
        assert r.status_code == 200

    def test_upi_invalid(self, u1):
        s, _ = u1
        r = s.put(f"{API}/my/payout-details", json={"upi_id": "noatsymbol"})
        assert r.status_code == 400

    def test_empty_rejected(self, u1):
        s, _ = u1
        r = s.put(f"{API}/my/payout-details", json={})
        assert r.status_code == 400

    def test_restore_bank(self, u1):
        # restore bank for later withdrawal test
        s, _ = u1
        s.put(f"{API}/my/payout-details", json={
            "account_holder": "QA Tester", "bank_account": "123456789012",
            "ifsc": "SBIN0001234", "bank_name": "SBI"
        }).raise_for_status()


# ---------- listing submit + visibility gate ----------
@pytest.fixture(scope="module")
def submitted_store(u1):
    s, uid = u1
    payload = {
        "business_name": "QA Visibility Shop", "business_type": "Shop",
        "owner_name": "QA Tester", "phone": "+919999900001",
        "description": "qa", "address": "1", "locality": "QA Loc",
        "city": "QATown", "state": "KL", "pincode": "686001",
        "images": IMGS,
    }
    r = s.post(f"{API}/stores/submit", json=payload)
    assert r.status_code == 200, r.text
    return r.json()["store_id"], uid


@pytest.fixture(scope="module")
def submitted_classified(u1):
    s, uid = u1
    r = s.post(f"{API}/classifieds/submit", json={
        "title": "QA Classified", "category": "misc", "description": "d",
        "images": IMGS, "locality": "QA Loc", "city": "QATown", "state": "KL",
    })
    assert r.status_code == 200, r.text
    return r.json()["listing_id"], uid


class TestVisibility:
    def test_submitted_store_not_in_public_list(self, submitted_store):
        sid, _ = submitted_store
        r = requests.get(f"{API}/stores", params={"search": "QA Visibility"})
        assert r.status_code == 200
        assert sid not in [x["id"] for x in r.json()]

    def test_submitted_store_detail_404_anon(self, submitted_store):
        sid, _ = submitted_store
        r = requests.get(f"{API}/stores/{sid}")
        assert r.status_code == 404

    def test_submitted_store_detail_other_user_404(self, submitted_store, u2):
        sid, _ = submitted_store
        s2, _ = u2
        r = s2.get(f"{API}/stores/{sid}")
        assert r.status_code == 404

    def test_submitted_store_detail_owner_ok(self, submitted_store, u1):
        sid, _ = submitted_store
        s, _ = u1
        r = s.get(f"{API}/stores/{sid}")
        assert r.status_code == 200
        assert r.json()["status"] == "submitted"

    def test_submitted_store_admin_ok(self, submitted_store, admin):
        sid, _ = submitted_store
        r = admin.get(f"{API}/stores/{sid}")
        assert r.status_code == 200

    def test_submitted_not_in_search(self, submitted_store):
        r = requests.get(f"{API}/search", params={"q": "QA Visibility"})
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()["results"].get("stores", [])]
        assert submitted_store[0] not in ids

    def test_classified_submitted_not_public(self, submitted_classified):
        cid, _ = submitted_classified
        r = requests.get(f"{API}/classifieds")
        assert cid not in [x["id"] for x in r.json()]
        r = requests.get(f"{API}/classifieds/{cid}")
        assert r.status_code == 404


# ---------- toggle rules ----------
class TestToggle:
    def test_toggle_submitted_blocked(self, submitted_store, u1):
        sid, _ = submitted_store
        s, _ = u1
        r = s.put(f"{API}/my/listings/store/{sid}/toggle", json={"is_active": True})
        assert r.status_code == 400
        # must mention awaiting admin approval
        assert "approval" in r.text.lower() or "admin" in r.text.lower()

    def test_toggle_submitted_classified_blocked(self, submitted_classified, u1):
        cid, _ = submitted_classified
        s, _ = u1
        r = s.put(f"{API}/my/listings/classified/{cid}/toggle", json={"is_active": False})
        assert r.status_code == 400


# ---------- protected fields on owner edit ----------
class TestProtectedFields:
    def test_owner_edit_cannot_change_status(self, submitted_store, u1):
        sid, _ = submitted_store
        s, _ = u1
        s.put(f"{API}/my/listings/store/{sid}",
              json={"status": "published", "is_active": True,
                    "discount_percent": 99, "namcos_percent": 0,
                    "description": "edited by owner"}).raise_for_status()
        r = s.get(f"{API}/stores/{sid}")
        d = r.json()
        assert d["status"] == "submitted"
        assert d["description"] == "edited by owner"
        assert d.get("discount_percent", 0) != 99

    def test_merchant_update_protected(self, submitted_store, u1):
        sid, _ = submitted_store
        s, _ = u1
        s.put(f"{API}/merchant/stores/{sid}",
              json={"status": "published", "namcos_percent": 0, "address": "new addr"}).raise_for_status()
        r = s.get(f"{API}/stores/{sid}")
        d = r.json()
        assert d["status"] == "submitted"
        assert d["address"] == "new addr"


# ---------- payment to non-published store blocked ----------
class TestPaymentBlocked:
    def test_pay_with_wallet_404(self, submitted_store, u2):
        sid, _ = submitted_store
        s, _ = u2
        r = s.post(f"{API}/payments/pay-with-wallet", json={"store_id": sid, "amount": 10})
        assert r.status_code == 404
        assert "not available" in r.text.lower()

    def test_pay_at_store_404(self, submitted_store, u2):
        sid, _ = submitted_store
        s, _ = u2
        r = s.post(f"{API}/payments/pay-at-store", json={"store_id": sid, "amount": 10})
        assert r.status_code == 404


# ---------- dashboard ----------
class TestDashboard:
    def test_owner_dashboard_ok(self, submitted_store, u1):
        sid, _ = submitted_store
        s, _ = u1
        r = s.get(f"{API}/my/listings/store/{sid}/dashboard")
        assert r.status_code == 200
        j = r.json()
        for k in ["kind", "item", "status", "total_orders", "gross_sales",
                  "net_earnings", "available_balance", "recent_payments"]:
            assert k in j, f"missing {k}"

    def test_other_user_dashboard_403(self, submitted_store, u2):
        sid, _ = submitted_store
        s2, _ = u2
        r = s2.get(f"{API}/my/listings/store/{sid}/dashboard")
        assert r.status_code == 403

    def test_classified_dashboard_minimal(self, submitted_classified, u1):
        cid, _ = submitted_classified
        s, _ = u1
        r = s.get(f"{API}/my/listings/classified/{cid}/dashboard")
        assert r.status_code == 200
        assert r.json()["kind"] == "classified"


# ---------- admin approval → public visible → pause/resume ----------
class TestApprovalAndToggle:
    def test_approve_then_toggle(self, submitted_store, admin, u1):
        sid, _ = submitted_store
        r = admin.put(f"{API}/admin/merchants/{sid}/status", json={"status": "published"})
        assert r.status_code == 200, r.text

        # visible publicly
        r = requests.get(f"{API}/stores/{sid}")
        assert r.status_code == 200
        assert r.json()["status"] == "published"

        # owner can pause
        s, _ = u1
        r = s.put(f"{API}/my/listings/store/{sid}/toggle", json={"is_active": False})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "paused"

        # hidden from public list detail
        r = requests.get(f"{API}/stores/{sid}")
        assert r.status_code == 404

        # re-enable
        r = s.put(f"{API}/my/listings/store/{sid}/toggle", json={"is_active": True})
        assert r.status_code == 200
        assert r.json()["status"] == "published"

        r = requests.get(f"{API}/stores/{sid}")
        assert r.status_code == 200


# ---------- admin edit endpoint ----------
class TestAdminEdit:
    def test_admin_edit_store(self, submitted_store, admin):
        sid, _ = submitted_store
        r = admin.put(f"{API}/admin/edit/store/{sid}", json={
            "description": "admin-edited desc",
            "bank_account": "999988887777", "ifsc": "HDFC0000111",
            "account_holder": "QA Tester", "upi_id": "qa@upi",
            "pincode": "686002",
        })
        assert r.status_code == 200, r.text
        r = admin.get(f"{API}/stores/{sid}")
        d = r.json()
        assert d["description"] == "admin-edited desc"
        assert d["pincode"] == "686002"
        assert d["bank_account"] == "999988887777"

    def test_admin_store_payout(self, submitted_store, admin):
        sid, _ = submitted_store
        r = admin.get(f"{API}/admin/stores/{sid}/payout")
        assert r.status_code == 200
        j = r.json()
        assert j["store_id"] == sid
        assert "payout" in j and "store_bank" in j

    def test_admin_user_payout(self, submitted_store, admin, u1):
        _, uid = submitted_store
        r = admin.get(f"{API}/admin/users/{uid}/payout")
        assert r.status_code == 200
        assert r.json()["user_id"] == uid


# ---------- wallet withdrawal uses payout + fallback ----------
class TestWithdrawal:
    def test_withdrawal_insufficient_still_validates_payout(self, u1):
        s, _ = u1
        # Without saved payout, must 400 on validation OR insufficient balance.
        r = s.post(f"{API}/wallet/withdrawals",
                   json={"amount": 100000, "upi_id": "notvalid"})
        assert r.status_code == 400

    def test_withdrawal_min(self, u1):
        s, _ = u1
        r = s.post(f"{API}/wallet/withdrawals", json={"amount": 50})
        assert r.status_code == 400
        assert "100" in r.text or "minimum" in r.text.lower()


# ---------- deactivated user ----------
class TestDeactivated:
    def test_deactivate_blocks(self, admin):
        # create a fresh test phone, deactivate, then expect 403
        phone = "+919999900003"
        s, uid = login_phone(phone)
        # deactivate via admin
        r = admin.put(f"{API}/admin/users/{uid}", json={"is_active": False})
        assert r.status_code in (200, 204), r.text
        # old session should now 403
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 403
        # verify-otp login should also be blocked
        requests.post(f"{API}/auth/send-otp", json={"phone": phone})
        r = requests.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": OTP})
        assert r.status_code == 403
        # reactivate so later runs pass
        admin.put(f"{API}/admin/users/{uid}", json={"is_active": True})


# ---------- cleanup ----------
@pytest.fixture(scope="module", autouse=True)
def _cleanup(submitted_store, submitted_classified, admin):
    yield
    sid, _ = submitted_store
    cid, _ = submitted_classified
    try:
        admin.delete(f"{API}/admin/delete/store/{sid}")
        admin.delete(f"{API}/admin/delete/classified/{cid}")
    except Exception:
        pass
