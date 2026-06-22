"""Iteration 70: cart improvements (bonus preview, ozon cert, clear cart, stats current-month, sort)."""
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

CLIENT = {"email": "user@demo.com", "password": "demo123"}
ADMIN = {"email": "admin@avarus.ru", "password": "admin"}
PRODUCT_ID = "8cd5b1c5-7980-4765-9db9-8e309614f8c5"
TARGET_ORDER = "ea0331f7-835f-441c-8893-2f181c957292"


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def client_headers():
    return {"Authorization": f"Bearer {_login(CLIENT)}"}


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN)}"}


# ---------- CART setup helpers ----------

def _clear_and_add(headers, qty=3):
    # Clear by fetching cart and removing all items
    r = requests.get(f"{API}/cart", headers=headers, timeout=15)
    if r.status_code == 200:
        for it in r.json().get("items", []):
            requests.delete(f"{API}/cart/{it['product_id']}", headers=headers, timeout=15)
    r = requests.post(f"{API}/cart/add", json={"product_id": PRODUCT_ID, "quantity": qty}, headers=headers, timeout=15)
    assert r.status_code in (200, 201), r.text


# ---------- bonus preview ----------

class TestBonusPreview:
    def test_cart_preview_returns_points(self, client_headers):
        _clear_and_add(client_headers, qty=3)
        r = requests.get(f"{API}/bonus/cart-preview", headers=client_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total_points" in data
        assert isinstance(data["total_points"], (int, float))
        assert "programs" in data
        # With items in cart, total_points should be non-negative
        assert data["total_points"] >= 0


# ---------- ozon certificate computation on order ----------

class TestOzonOrder:
    def test_target_order_has_ozon_cert_500(self, admin_headers):
        r = requests.get(f"{API}/admin/orders", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        orders = r.json() if isinstance(r.json(), list) else r.json().get("orders", [])
        order = next((o for o in orders if o.get("id") == TARGET_ORDER), None)
        assert order is not None, f"Target order {TARGET_ORDER} not found"
        assert order.get("ozon_certificate") == 500, f"Expected 500, got {order.get('ozon_certificate')}"

    def test_toggle_ozon_certificate(self, admin_headers):
        # Toggle issued=True
        r = requests.patch(
            f"{API}/admin/orders/{TARGET_ORDER}/ozon-certificate",
            json={"issued": True},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ozon_certificate_issued") is True

        # Confirm via GET
        r2 = requests.get(f"{API}/admin/orders", headers=admin_headers, timeout=20)
        orders = r2.json() if isinstance(r2.json(), list) else r2.json().get("orders", [])
        order = next((o for o in orders if o.get("id") == TARGET_ORDER), None)
        assert order.get("ozon_certificate_issued") is True

        # Toggle back to False
        r = requests.patch(
            f"{API}/admin/orders/{TARGET_ORDER}/ozon-certificate",
            json={"issued": False},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("ozon_certificate_issued") is False


# ---------- /orders/stats current-month only for client ----------

class TestClientStatsCurrentMonth:
    def test_stats_current_month(self, client_headers):
        r = requests.get(f"{API}/orders/stats", headers=client_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Must not error
        by_month = data.get("by_month", [])
        # If non-empty, all entries should be for the current calendar month
        now = datetime.now(timezone.utc)
        current_key = f"{now.year}-{now.month:02d}"
        for entry in by_month:
            m = entry.get("month") or entry.get("key") or ""
            assert current_key in str(m), f"by_month entry {entry} is outside current month {current_key}"


# ---------- /orders sorted newest first ----------

class TestOrdersSorted:
    def test_orders_sorted_desc(self, client_headers):
        r = requests.get(f"{API}/orders", headers=client_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        orders = data if isinstance(data, list) else data.get("orders", [])
        if len(orders) < 2:
            pytest.skip("Need >=2 orders")
        # Created_at descending
        for a, b in zip(orders, orders[1:]):
            assert (a.get("created_at") or "") >= (b.get("created_at") or ""), \
                f"Order {a.get('id')} created_at {a.get('created_at')} < next {b.get('created_at')}"
