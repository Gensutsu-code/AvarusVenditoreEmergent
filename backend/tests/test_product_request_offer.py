"""End-to-end backend tests for product-request OFFER accept/reject flow.

Covers:
- Client creates a product request
- Admin sends an offer (price/qty/delivery/comment) -> status becomes 'offered'
- Client sees offer in /product-requests/my
- Client accepts -> status 'accepted' + admin notification
- Client rejects (with reason) -> status 'rejected_by_client' + admin notification
- Guard: accept/reject on non-'offered' status -> HTTP 400
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-merge-fulfill.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = os.environ["TEST_ADMIN_PASSWORD"]
CLIENT_EMAIL = "user@demo.com"
CLIENT_PASSWORD = os.environ["TEST_CLIENT_PASSWORD"]


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token in login response: {data}"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def client_token():
    return _login(CLIENT_EMAIL, CLIENT_PASSWORD)


@pytest.fixture(scope="module")
def admin_hdrs(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def client_hdrs(client_token):
    return {"Authorization": f"Bearer {client_token}"}


def _create_request(hdrs, article):
    r = requests.post(
        f"{API}/product-requests",
        json={"article": article, "product_name": f"TEST_{article}", "quantity": 3, "comment": "TEST offer flow"},
        headers=hdrs,
        timeout=15,
    )
    assert r.status_code in (200, 201), f"create req: {r.status_code} {r.text}"
    return r.json()


def _send_offer(hdrs, req_id, price=1500, qty=3, days=5, msg="Готово предложение"):
    r = requests.put(
        f"{API}/admin/product-requests/{req_id}/respond",
        json={
            "response_message": msg,
            "status": "offered",
            "offer_price": price,
            "offer_quantity": qty,
            "offer_delivery_days": days,
        },
        headers=hdrs,
        timeout=15,
    )
    assert r.status_code == 200, f"send offer: {r.status_code} {r.text}"
    return r.json()


class TestOfferAccept:
    def test_full_accept_flow(self, admin_hdrs, client_hdrs):
        # 1. client creates a request
        art = f"TEST-OFFER-{uuid.uuid4().hex[:6]}"
        req = _create_request(client_hdrs, art)
        assert req["status"] == "pending"
        rid = req["id"]

        # 2. admin sends offer
        updated = _send_offer(admin_hdrs, rid, price=1500, qty=3, days=5)
        assert updated["status"] == "offered"
        assert updated["offer_price"] == 1500
        assert updated["offer_quantity"] == 3
        assert updated["offer_delivery_days"] == 5

        # 3. client sees offer in /my
        my = requests.get(f"{API}/product-requests/my", headers=client_hdrs, timeout=15)
        assert my.status_code == 200
        found = next((x for x in my.json() if x["id"] == rid), None)
        assert found is not None
        assert found["status"] == "offered"
        assert found["offer_price"] == 1500

        # 4. client ACCEPTS
        r = requests.post(f"{API}/product-requests/{rid}/accept", headers=client_hdrs, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "accepted"
        assert "client_decision_at" in data

        # 5. admin notification about acceptance created
        notifs = requests.get(f"{API}/admin/notifications", headers=admin_hdrs, timeout=15)
        assert notifs.status_code == 200
        titles = [n.get("title", "") for n in notifs.json().get("notifications", [])]
        assert any("принял" in t for t in titles), f"no accept notif found in {titles[:10]}"

        # 6. Double-accept guard -> 400
        r2 = requests.post(f"{API}/product-requests/{rid}/accept", headers=client_hdrs, timeout=15)
        assert r2.status_code == 400, f"expected 400, got {r2.status_code} {r2.text}"

        # 7. reject on non-offered -> 400
        r3 = requests.post(f"{API}/product-requests/{rid}/reject", json={"reason": "test"}, headers=client_hdrs, timeout=15)
        assert r3.status_code == 400


class TestOfferReject:
    def test_full_reject_flow(self, admin_hdrs, client_hdrs):
        # 1. new request
        art = f"TEST-REJ-{uuid.uuid4().hex[:6]}"
        req = _create_request(client_hdrs, art)
        rid = req["id"]

        # 2. admin offer
        _send_offer(admin_hdrs, rid, price=2200, qty=2, days=7)

        # 3. client REJECTS with reason
        reason = "TEST_REASON слишком дорого"
        r = requests.post(f"{API}/product-requests/{rid}/reject", json={"reason": reason}, headers=client_hdrs, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "rejected_by_client"
        assert data.get("client_reject_reason") == reason

        # 4. admin notification about rejection
        notifs = requests.get(f"{API}/admin/notifications", headers=admin_hdrs, timeout=15)
        assert notifs.status_code == 200
        titles = [n.get("title", "") for n in notifs.json().get("notifications", [])]
        assert any("отклонил" in t.lower() for t in titles), f"no reject notif in {titles[:10]}"

        # 5. double-reject guard
        r2 = requests.post(f"{API}/product-requests/{rid}/reject", json={"reason": "again"}, headers=client_hdrs, timeout=15)
        assert r2.status_code == 400

        # 6. accept on rejected -> 400
        r3 = requests.post(f"{API}/product-requests/{rid}/accept", headers=client_hdrs, timeout=15)
        assert r3.status_code == 400


class TestGuardOnPending:
    def test_accept_reject_pending_returns_400(self, client_hdrs):
        """A request in 'pending' (no offer yet) can't be accepted/rejected."""
        art = f"TEST-PEND-{uuid.uuid4().hex[:6]}"
        req = _create_request(client_hdrs, art)
        rid = req["id"]

        r = requests.post(f"{API}/product-requests/{rid}/accept", headers=client_hdrs, timeout=15)
        assert r.status_code == 400

        r2 = requests.post(f"{API}/product-requests/{rid}/reject", json={"reason": "x"}, headers=client_hdrs, timeout=15)
        assert r2.status_code == 400


class TestOfferUpdate:
    def test_admin_can_update_offer(self, admin_hdrs, client_hdrs):
        """Reopening an offered request should let admin update offer (still 'offered')."""
        art = f"TEST-UPD-{uuid.uuid4().hex[:6]}"
        req = _create_request(client_hdrs, art)
        rid = req["id"]

        _send_offer(admin_hdrs, rid, price=1000, qty=1, days=3)
        updated = _send_offer(admin_hdrs, rid, price=1200, qty=2, days=4, msg="Обновлено")
        assert updated["status"] == "offered"
        assert updated["offer_price"] == 1200
        assert updated["offer_quantity"] == 2
        assert updated["offer_delivery_days"] == 4
        assert updated["admin_response"] == "Обновлено"
