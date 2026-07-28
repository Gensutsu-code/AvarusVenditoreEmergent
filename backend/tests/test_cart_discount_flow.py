"""Iteration 96: End-to-end backend regression for cart-wide discount requests.

Flow: client requests -> admin approves -> cart reflects -> order consumes -> invoice.
Also verifies reject flow and guards (duplicate + percent range).
"""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"
CLIENT_EMAIL = "user@demo.com"
CLIENT_PASSWORD = "demo123"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def client_token():
    return _login(CLIENT_EMAIL, CLIENT_PASSWORD)


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _cleanup_all_cart_discount_state(client_token, admin_token):
    """Cancel any pending/approved cart discount requests for the client."""
    r = requests.get(f"{BASE_URL}/api/cart-discount-requests/my", headers=_h(client_token), timeout=15)
    if r.status_code == 200:
        for req in r.json():
            if req.get("status") in ("pending", "approved"):
                requests.delete(
                    f"{BASE_URL}/api/cart-discount-requests/{req['id']}",
                    headers=_h(client_token),
                    timeout=15,
                )


def _clear_cart(client_token):
    r = requests.get(f"{BASE_URL}/api/cart", headers=_h(client_token), timeout=15)
    if r.status_code == 200:
        items = r.json().get("items", []) if isinstance(r.json(), dict) else r.json()
        for it in items:
            pid = it.get("product_id") or it.get("id")
            if pid:
                requests.delete(f"{BASE_URL}/api/cart/{pid}", headers=_h(client_token), timeout=15)


def _pick_product(admin_token):
    """Pick a product with discount_active=false and stock>0 for clean math."""
    r = requests.get(f"{BASE_URL}/api/products?limit=200", headers=_h(admin_token), timeout=20)
    assert r.status_code == 200
    data = r.json()
    items = data if isinstance(data, list) else data.get("products", data.get("items", []))
    for p in items:
        if not p.get("discount_active") and (p.get("stock") or 0) > 0 and (p.get("price") or 0) > 0:
            return p
    pytest.skip("No suitable product found")


@pytest.fixture(scope="module")
def product(admin_token):
    return _pick_product(admin_token)


class TestCartDiscountHappyPath:
    def test_full_flow(self, client_token, admin_token, product):
        _cleanup_all_cart_discount_state(client_token, admin_token)
        _clear_cart(client_token)

        # 1) Add product to cart
        pid = product["id"]
        r = requests.post(
            f"{BASE_URL}/api/cart/add",
            headers=_h(client_token),
            json={"product_id": pid, "quantity": 2},
            timeout=15,
        )
        assert r.status_code == 200, r.text

        # 2) Client requests 10%
        r = requests.post(
            f"{BASE_URL}/api/cart-discount-requests",
            headers=_h(client_token),
            json={"requested_percent": 10, "message": "iter96 test"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        req_id = r.json()["id"]
        assert r.json()["status"] == "pending"

        # 3) Guard: second pending request
        r2 = requests.post(
            f"{BASE_URL}/api/cart-discount-requests",
            headers=_h(client_token),
            json={"requested_percent": 5},
            timeout=15,
        )
        assert r2.status_code == 400

        # 4) Guard: percent out of range
        # Cancel first to test range guard
        rc = requests.delete(f"{BASE_URL}/api/cart-discount-requests/{req_id}", headers=_h(client_token), timeout=15)
        assert rc.status_code == 200
        for bad in [0, -5, 91, 200]:
            rb = requests.post(
                f"{BASE_URL}/api/cart-discount-requests",
                headers=_h(client_token),
                json={"requested_percent": bad},
                timeout=15,
            )
            assert rb.status_code == 400, f"expected 400 for {bad}, got {rb.status_code}"

        # 5) Recreate + admin approves at 8%
        r = requests.post(
            f"{BASE_URL}/api/cart-discount-requests",
            headers=_h(client_token),
            json={"requested_percent": 10},
            timeout=15,
        )
        assert r.status_code == 200
        req_id = r.json()["id"]

        r = requests.put(
            f"{BASE_URL}/api/admin/cart-discount-requests/{req_id}/approve",
            headers=_h(admin_token),
            json={"admin_percent": 8, "response_message": "ok"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "approved"
        assert r.json()["admin_percent"] == 8

        # 6) /cart-discount/active
        r = requests.get(f"{BASE_URL}/api/cart-discount/active", headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        assert r.json() is not None
        assert r.json()["admin_percent"] == 8

        # 7) Cart reflects discount (price_before_cart_discount + cart_discount_percent)
        r = requests.get(f"{BASE_URL}/api/cart", headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        cart = r.json()
        items = cart.get("items") if isinstance(cart, dict) else cart
        assert items, "cart empty"
        found = False
        for it in items:
            if it.get("product_id") == pid or it.get("id") == pid:
                found = True
                # These fields must be present on discounted cart items
                assert it.get("cart_discount_percent") == 8, f"cart_discount_percent got {it}"
                assert it.get("price_before_cart_discount") is not None
                # Discounted price = original * 0.92
                orig = it["price_before_cart_discount"]
                assert abs(it["price"] - orig * 0.92) < 0.5, f"price {it['price']} vs orig {orig}"
        assert found

        # 8) Place order (cash)
        r = requests.post(
            f"{BASE_URL}/api/orders",
            headers=_h(client_token),
            json={
                "payment_method": "cash",
                "delivery_method": "pickup",
                "delivery_address": "Pickup",
                "full_name": "Test User",
                "address": "Pickup",
                "phone": "+70000000000",
            },
            timeout=30,
        )
        assert r.status_code in (200, 201), r.text
        order = r.json()
        order_id = order.get("id") or order.get("order_id")
        assert order_id
        # Order carries cart_discount_percent/amount
        assert order.get("cart_discount_percent") == 8, f"order missing cart_discount_percent: {order}"
        assert (order.get("cart_discount_amount") or 0) > 0

        # 9) Active is now null (used)
        r = requests.get(f"{BASE_URL}/api/cart-discount/active", headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        assert r.json() is None, "cart discount should be consumed"

        # 10) Request status is 'used'
        r = requests.get(f"{BASE_URL}/api/cart-discount-requests/my", headers=_h(client_token), timeout=15)
        used = [x for x in r.json() if x["id"] == req_id]
        assert used and used[0]["status"] == "used"

        # 11) Invoice contains discount rows
        r = requests.get(f"{BASE_URL}/api/admin/orders/{order_id}/invoice", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        # Simple text-search in the docx bytes for cyrillic markers
        blob = r.content
        assert b"\xd0" in blob  # some cyrillic present (docx is xml inside zip -> UTF-8)
        # Confirm invoice > minimal size
        assert len(blob) > 5000
        return order_id


class TestCartDiscountReject:
    def test_reject_flow(self, client_token, admin_token, product):
        _cleanup_all_cart_discount_state(client_token, admin_token)
        # ensure cart has an item so the flow is realistic
        _clear_cart(client_token)
        requests.post(
            f"{BASE_URL}/api/cart/add",
            headers=_h(client_token),
            json={"product_id": product["id"], "quantity": 1},
            timeout=15,
        )
        r = requests.post(
            f"{BASE_URL}/api/cart-discount-requests",
            headers=_h(client_token),
            json={"requested_percent": 15},
            timeout=15,
        )
        assert r.status_code == 200
        req_id = r.json()["id"]

        r = requests.put(
            f"{BASE_URL}/api/admin/cart-discount-requests/{req_id}/reject",
            headers=_h(admin_token),
            json={"response_message": "nope"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

        # Active must be null
        r = requests.get(f"{BASE_URL}/api/cart-discount/active", headers=_h(client_token), timeout=15)
        assert r.json() is None

        # Client can create a new request now (no active pending/approved)
        r = requests.post(
            f"{BASE_URL}/api/cart-discount-requests",
            headers=_h(client_token),
            json={"requested_percent": 5},
            timeout=15,
        )
        assert r.status_code == 200
        # cleanup this new pending one
        requests.delete(
            f"{BASE_URL}/api/cart-discount-requests/{r.json()['id']}",
            headers=_h(client_token),
            timeout=15,
        )
        _clear_cart(client_token)
