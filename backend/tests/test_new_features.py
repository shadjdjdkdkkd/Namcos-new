"""Tests for new features: notifications, support tickets, payout, wallet/merchant withdrawals."""
import os
import pytest
import requests
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://nam-up-preview-2.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

CUST_PHONE = "+919999999999"
MERCH_PHONE = "+919876543210"
TEST_OTP = "123456"
ADMIN_EMAIL = "glowcelesta@gmail.com"
ADMIN_PASS = "Admin@namcos2024"


def _login_phone(phone):
    s = requests.Session()
    r = s.post(f"{API}/auth/send-otp", json={"phone": phone})
    assert r.status_code == 200, f"send-otp failed: {r.status_code} {r.text}"
    r = s.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": TEST_OTP, "name": "Tester"})
    assert r.status_code == 200, f"verify-otp failed: {r.status_code} {r.text}"
    return s


def _login_admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/admin-login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return s


@pytest.fixture(scope="module")
def cust():
    return _login_phone(CUST_PHONE)


@pytest.fixture(scope="module")
def merch():
    return _login_phone(MERCH_PHONE)


@pytest.fixture(scope="module")
def admin():
    return _login_admin()


# ---------------- Admin broadcast notifications ----------------

def test_admin_send_notification_and_customer_receives(admin, cust):
    title = f"TEST_Broadcast_{int(time.time())}"
    r = admin.post(f"{API}/admin/notifications/send", json={
        "title": title, "message": "hello all", "target": "all"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True
    assert data.get("sent", 0) > 0

    # customer sees it
    r2 = cust.get(f"{API}/notifications")
    assert r2.status_code == 200
    body = r2.json()
    items = body.get("notifications", body) if isinstance(body, dict) else body
    assert any(title in (n.get("title") or "") for n in items), f"notif not found. items={items[:3]}"


# ---------------- Support tickets ----------------

def test_support_ticket_flow(cust, admin):
    subj = f"TEST_Ticket_{int(time.time())}"
    r = cust.post(f"{API}/support/tickets", json={
        "subject": subj, "description": "need help", "category": "general"
    })
    assert r.status_code in (200, 201), r.text
    ticket = r.json()
    tid = ticket.get("id") or ticket.get("_id") or ticket.get("ticket_id")
    assert tid, f"no ticket id in {ticket}"

    r = cust.get(f"{API}/support/tickets/my")
    assert r.status_code == 200
    mine = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    assert any((t.get("subject") == subj) for t in mine)

    r = admin.get(f"{API}/support/tickets")
    assert r.status_code == 200
    allt = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    assert any((t.get("subject") == subj) for t in allt)

    r = admin.put(f"{API}/support/tickets/{tid}", json={"message": "we are on it"})
    assert r.status_code == 200, r.text
    r = admin.put(f"{API}/support/tickets/{tid}", json={"status": "resolved"})
    assert r.status_code == 200, r.text

    r = cust.get(f"{API}/support/tickets/my")
    assert r.status_code == 200
    mine = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    found = next((t for t in mine if t.get("subject") == subj), None)
    assert found and found.get("status") == "resolved", f"ticket status not updated: {found}"


# ---------------- Payout details ----------------

def test_payout_details_save_and_read(cust):
    payload = {
        "account_holder": "Test User",
        "bank_account": "1234567890",
        "ifsc": "HDFC0000001",
    }
    r = cust.put(f"{API}/my/payout-details", json=payload)
    assert r.status_code == 200, r.text
    r = cust.get(f"{API}/my/payout-details")
    assert r.status_code == 200
    d = r.json()
    assert d.get("bank_account") == "1234567890"
    assert d.get("ifsc") == "HDFC0000001"


# ---------------- Wallet withdrawal (customer) ----------------

def test_wallet_withdrawal_flow(cust, admin):
    # ensure payout saved
    cust.put(f"{API}/my/payout-details", json={
        "account_holder": "Test User", "bank_account": "1234567890", "ifsc": "HDFC0000001"
    })
    rb = cust.get(f"{API}/wallet/balance")
    bal_before = 0
    if rb.status_code == 200:
        bal_before = rb.json().get("balance", rb.json().get("available", 0))

    r = cust.post(f"{API}/wallet/withdrawals", json={"amount": 150})
    assert r.status_code in (200, 201), r.text
    wd = r.json()
    wid = wd.get("id") or wd.get("_id") or wd.get("withdrawal_id")
    assert wid, f"no id in {wd}"
    # new balance returned?
    if "balance" in wd and bal_before:
        assert wd["balance"] == bal_before - 150, f"balance deduction mismatch {bal_before}->{wd['balance']}"

    # admin sees it
    r = admin.get(f"{API}/admin/withdrawals")
    assert r.status_code == 200
    items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    found = next((w for w in items if (str(w.get("id")) == str(wid) or str(w.get("_id")) == str(wid))), None)
    assert found, f"withdrawal not in admin list. first items: {items[:2]}"
    assert found.get("status") in ("requested", "pending")
    # account details should be present
    has_acc = (found.get("bank_account") or found.get("account_number")
               or (found.get("payout") or {}).get("bank_account")
               or found.get("upi_id") or (found.get("payout") or {}).get("upi_id"))
    assert has_acc, f"no account details in withdrawal row: {found}"

    # status update processing then paid
    r = admin.put(f"{API}/admin/withdrawals/{wid}/status", json={"status": "processing"})
    assert r.status_code == 200, r.text
    r = admin.put(f"{API}/admin/withdrawals/{wid}/status", json={"status": "paid"})
    assert r.status_code == 200, r.text


# ---------------- Merchant balance and withdrawal ----------------

def test_merchant_balance_and_withdrawal(merch, admin):
    merch.put(f"{API}/my/payout-details", json={
        "account_holder": "Rajesh Kumar", "bank_account": "9876543210", "ifsc": "ICIC0000002"
    })
    r = merch.get(f"{API}/merchant/balance")
    assert r.status_code == 200, r.text
    bal = r.json()
    available = bal.get("available_balance", bal.get("available", bal.get("balance", 0)))
    assert available >= 100, f"not enough merchant balance: {bal}"

    r = merch.post(f"{API}/merchant/withdrawals", json={"amount": 100})
    assert r.status_code in (200, 201), r.text
    w = r.json()
    wid = w.get("id") or w.get("_id") or w.get("withdrawal_id")
    assert wid, f"no id in {w}"

    r = admin.get(f"{API}/admin/withdrawals")
    assert r.status_code == 200
    items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    assert any((str(it.get("id")) == str(wid) or str(it.get("_id")) == str(wid)) for it in items), "merchant withdrawal missing"
