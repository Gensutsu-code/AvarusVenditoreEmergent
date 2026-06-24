"""Iteration 77 - Test merged cart+checkout, mixed payment, pay-later, deferred payment settings, /checkout redirect."""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@avarus.ru", "password": "admin"}
CLIENT = {"email": "0x0errorr@gmail.com", "password": "admin123"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    r = requests.post(f"{API}/auth/login", json=CLIENT, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Deferred payment settings ----------
class TestDeferredPaymentSettings:
    def test_deferred_settings_present_in_payment_settings(self):
        r = requests.get(f"{API}/payment-settings", timeout=10)
        assert r.status_code == 200
        d = r.json()
        # field should exist (even if False)
        assert "deferred_payment_enabled" in d
        assert "deferred_payment_hours" in d

    def test_admin_can_update_deferred_settings(self, admin_token):
        # Get current
        r = requests.get(f"{API}/payment-settings", timeout=10)
        cur = r.json()
        prev_enabled = cur.get("deferred_payment_enabled", False)
        prev_hours = cur.get("deferred_payment_hours", 24)

        payload = dict(cur)
        payload["deferred_payment_enabled"] = True
        payload["deferred_payment_hours"] = 48
        r2 = requests.put(f"{API}/admin/payment-settings", json=payload, headers=H(admin_token), timeout=10)
        assert r2.status_code in (200, 204), r2.text

        r3 = requests.get(f"{API}/payment-settings", timeout=10)
        d = r3.json()
        assert d.get("deferred_payment_enabled") is True
        assert int(d.get("deferred_payment_hours", 0)) == 48

        # restore but KEEP enabled=True so frontend test can use pay-later
        payload["deferred_payment_enabled"] = True
        payload["deferred_payment_hours"] = prev_hours or 24
        requests.put(f"{API}/admin/payment-settings", json=payload, headers=H(admin_token), timeout=10)


# ---------- /checkout redirect (backend has no /checkout route; routing is frontend only) ----------
# This is verified at the frontend; backend has no equivalent.


# ---------- Order creation flows ----------
class TestOrderFlows:
    @pytest.fixture
    def client_cart(self, client_token):
        # Find an in-stock product
        r = requests.get(f"{API}/products?limit=50", timeout=10)
        prods = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        target = None
        for p in prods:
            if p.get("in_stock") is True or p.get("stock", 1) > 0:
                target = p
                break
        if not target:
            pytest.skip("No in-stock product found")
        pid = target["id"]

        # Clear cart first by getting it and removing
        requests.delete(f"{API}/cart/clear", headers=H(client_token), timeout=10)
        # Add one item
        r2 = requests.post(f"{API}/cart/add", json={"product_id": pid, "quantity": 1}, headers=H(client_token), timeout=10)
        assert r2.status_code in (200, 201), r2.text
        cart = requests.get(f"{API}/cart", headers=H(client_token), timeout=10).json()
        assert cart.get("items"), "Cart not seeded"
        return cart

    def test_single_card_order_pay_later(self, client_token, admin_token, client_cart):
        # Ensure deferred enabled
        s = requests.get(f"{API}/payment-settings", timeout=10).json()
        s["deferred_payment_enabled"] = True
        s["deferred_payment_hours"] = 24
        requests.put(f"{API}/admin/payment-settings", json=s, headers=H(admin_token), timeout=10)

        payload = {
            "full_name": "TEST CardPayLater",
            "address": "TEST address 1",
            "phone": "+71234567890",
            "comment": "TEST",
            "payment_method": "card",
            "pay_later": True,
        }
        r = requests.post(f"{API}/orders", json=payload, headers=H(client_token), timeout=15)
        assert r.status_code in (200, 201), r.text
        order = r.json()
        assert order.get("payment_method") == "card"
        assert order.get("payment_status") == "awaiting_confirmation", f"payment_status={order.get('payment_status')}"
        assert order.get("payment_due_date"), "payment_due_date should be set for pay_later"

    def test_mixed_payment_cash_card(self, client_token, client_cart):
        cart_total = sum(i["price"] * i["quantity"] for i in client_cart["items"])
        if cart_total < 100:
            pytest.skip("Cart too small for mixed split")
        # split half/half
        half = round(cart_total / 2)
        rest = round(cart_total - half, 2)
        payload = {
            "full_name": "TEST Mixed",
            "address": "TEST addr 2",
            "phone": "+71234567890",
            "payment_parts": [
                {"method": "cash", "amount": half},
                {"method": "card", "amount": rest},
            ],
        }
        r = requests.post(f"{API}/orders", json=payload, headers=H(client_token), timeout=15)
        assert r.status_code in (200, 201), r.text
        order = r.json()
        assert order.get("payment_method") == "mixed"
        parts = order.get("payment_parts")
        assert parts and len(parts) == 2, f"expected 2 parts, got {parts}"
        s = sum(p["amount"] for p in parts)
        assert abs(s - order["total"]) < 1.5, f"parts {s} != total {order['total']}"

    def test_mixed_same_method_rejected(self, client_token, client_cart):
        cart_total = sum(i["price"] * i["quantity"] for i in client_cart["items"])
        half = round(cart_total / 2)
        rest = round(cart_total - half, 2)
        payload = {
            "full_name": "TEST",
            "address": "TEST",
            "phone": "+71234567890",
            "payment_parts": [
                {"method": "card", "amount": half},
                {"method": "card", "amount": rest},
            ],
        }
        r = requests.post(f"{API}/orders", json=payload, headers=H(client_token), timeout=15)
        assert r.status_code == 400

    def test_single_cash_order_still_works(self, client_token, client_cart):
        payload = {
            "full_name": "TEST Cash",
            "address": "TEST addr",
            "phone": "+71234567890",
            "payment_method": "cash",
        }
        r = requests.post(f"{API}/orders", json=payload, headers=H(client_token), timeout=15)
        assert r.status_code in (200, 201), r.text
        order = r.json()
        assert order.get("payment_method") == "cash"


# ---------- Returns endpoint ----------
class TestReturns:
    def test_returns_list_loads(self, client_token):
        r = requests.get(f"{API}/returns", headers=H(client_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
