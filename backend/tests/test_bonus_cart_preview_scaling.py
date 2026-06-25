"""Verify /api/bonus/cart-preview correctly scales bonus points by `amount` param.

Bug: cart bonus preview was using raw cart total — it must scale by the actual
payment-adjusted goods total. The endpoint now accepts an `amount` query param.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://order-merge-fulfill.preview.emergentagent.com').rstrip('/')

CLIENT_EMAIL = "user@demo.com"
CLIENT_PASSWORD = "demo123"


@pytest.fixture(scope="module")
def client_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def headers(client_token):
    return {"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def ensure_cart(headers):
    """Make sure the cart has at least one bonus-eligible item."""
    # Try existing cart first
    cart = requests.get(f"{BASE_URL}/api/cart", headers=headers, timeout=15)
    items = []
    if cart.status_code == 200:
        items = cart.json().get("items", []) or []
    if not items:
        # Find one bonus-eligible product and add it
        prods = requests.get(f"{BASE_URL}/api/products", headers=headers, timeout=15)
        assert prods.status_code == 200, prods.text
        product_list = prods.json() if isinstance(prods.json(), list) else prods.json().get("products", [])
        chosen = None
        for p in product_list:
            if p.get("bonus_eligible", True) and (p.get("price") or 0) > 0:
                chosen = p
                break
        assert chosen, "No bonus-eligible product available"
        add = requests.post(f"{BASE_URL}/api/cart/add", headers=headers,
                            json={"product_id": chosen["id"], "quantity": 1}, timeout=15)
        assert add.status_code in (200, 201), add.text
        cart = requests.get(f"{BASE_URL}/api/cart", headers=headers, timeout=15)
        items = cart.json().get("items", []) or []
    assert items, "Cart still empty"
    total = sum((i.get("price", 0) or 0) * (i.get("quantity", 0) or 0) for i in items)
    return {"items": items, "total": total}


def test_cart_preview_no_amount(headers, ensure_cart):
    r = requests.get(f"{BASE_URL}/api/bonus/cart-preview", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "total_points" in data
    assert isinstance(data["total_points"], (int, float))
    print("baseline total_points =", data["total_points"], "for cartTotal =", ensure_cart["total"])


def test_cart_preview_scaling_90pct(headers, ensure_cart):
    """amount = 90% of cart total → points should be ~90% of baseline."""
    base = requests.get(f"{BASE_URL}/api/bonus/cart-preview", headers=headers, timeout=15).json()
    baseline_pts = base["total_points"]
    cart_total = ensure_cart["total"]
    if baseline_pts <= 0 or cart_total <= 0:
        pytest.skip("No bonus accrual configured; cannot validate scaling")

    amt = round(cart_total * 0.9, 2)
    r = requests.get(f"{BASE_URL}/api/bonus/cart-preview", headers=headers,
                     params={"amount": amt}, timeout=15)
    assert r.status_code == 200, r.text
    scaled_pts = r.json()["total_points"]
    expected = round(baseline_pts * 0.9, 2)
    # allow 2% tolerance for rounding inside per-program calc
    assert abs(scaled_pts - expected) / max(expected, 0.01) < 0.03, \
        f"expected~{expected}, got {scaled_pts}"


def test_cart_preview_scaling_110pct(headers, ensure_cart):
    base = requests.get(f"{BASE_URL}/api/bonus/cart-preview", headers=headers, timeout=15).json()
    baseline_pts = base["total_points"]
    cart_total = ensure_cart["total"]
    if baseline_pts <= 0 or cart_total <= 0:
        pytest.skip("No bonus accrual configured")
    amt = round(cart_total * 1.10, 2)
    r = requests.get(f"{BASE_URL}/api/bonus/cart-preview", headers=headers,
                     params={"amount": amt}, timeout=15)
    assert r.status_code == 200, r.text
    scaled = r.json()["total_points"]
    expected = round(baseline_pts * 1.10, 2)
    assert abs(scaled - expected) / max(expected, 0.01) < 0.03, \
        f"expected~{expected}, got {scaled}"


def test_cart_preview_zero_amount_falls_back(headers, ensure_cart):
    """amount=0 → backend treats as None (no scaling), points equal baseline."""
    base = requests.get(f"{BASE_URL}/api/bonus/cart-preview", headers=headers, timeout=15).json()
    r = requests.get(f"{BASE_URL}/api/bonus/cart-preview", headers=headers,
                     params={"amount": 0}, timeout=15)
    assert r.status_code == 200
    assert r.json()["total_points"] == base["total_points"]
