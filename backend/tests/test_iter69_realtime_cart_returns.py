"""
Iteration 69 backend smoke tests:
- /cart/update returns tier-discounted recomputed cart (server-recomputed prices)
- /admin/carts shows promo_active + discounted price + original_price + promo_label for promo products
- /admin/return-settings PUT roundtrip; reset to defaults at end
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://order-merge-fulfill.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
TIER_PRODUCT_ID = "8cd5b1c5-7980-4765-9db9-8e309614f8c5"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def user_token():
    return _login("user@demo.com", "demo123")


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@avarus.ru", "admin")


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_cart_update_returns_tier_pricing_qty_5(user_token):
    # Ensure product in cart
    requests.delete(f"{API}/cart/{TIER_PRODUCT_ID}", headers=_h(user_token))
    add = requests.post(f"{API}/cart/add", json={"product_id": TIER_PRODUCT_ID, "quantity": 2}, headers=_h(user_token))
    assert add.status_code == 200, add.text[:200]

    r = requests.post(f"{API}/cart/update", json={"product_id": TIER_PRODUCT_ID, "quantity": 5}, headers=_h(user_token))
    assert r.status_code == 200, r.text[:200]
    data = r.json()
    assert "items" in data
    it = next((i for i in data["items"] if i["product_id"] == TIER_PRODUCT_ID), None)
    assert it is not None
    assert it["quantity"] == 5
    assert abs(it["price"] - 52.5) < 0.01, f"expected unit 52.5 at qty5, got {it['price']}"


def test_cart_update_qty_10_tier_50(user_token):
    r = requests.post(f"{API}/cart/update", json={"product_id": TIER_PRODUCT_ID, "quantity": 10}, headers=_h(user_token))
    assert r.status_code == 200
    data = r.json()
    it = next((i for i in data["items"] if i["product_id"] == TIER_PRODUCT_ID), None)
    assert it and it["quantity"] == 10
    assert abs(it["price"] - 37.5) < 0.01, f"expected 37.5 at qty10, got {it['price']}"


def test_cart_update_qty_2_back_to_60(user_token):
    r = requests.post(f"{API}/cart/update", json={"product_id": TIER_PRODUCT_ID, "quantity": 2}, headers=_h(user_token))
    assert r.status_code == 200
    data = r.json()
    it = next((i for i in data["items"] if i["product_id"] == TIER_PRODUCT_ID), None)
    assert it and it["quantity"] == 2
    assert abs(it["price"] - 60.0) < 0.01, f"expected 60.0 at qty2, got {it['price']}"


def test_admin_carts_show_promo_for_tier_product(admin_token, user_token):
    # Make sure demo user has the tier product in cart at qty 5
    requests.post(f"{API}/cart/update", json={"product_id": TIER_PRODUCT_ID, "quantity": 5}, headers=_h(user_token))

    r = requests.get(f"{API}/admin/carts", headers=_h(admin_token))
    assert r.status_code == 200, r.text[:200]
    payload = r.json()
    carts = payload.get("carts", [])
    target = None
    for c in carts:
        for it in c.get("items", []):
            if it.get("product_id") == TIER_PRODUCT_ID:
                target = it
                break
        if target:
            break
    assert target is not None, "tier product not found in any admin cart"
    assert target.get("promo_active") is True, f"promo_active should be True, item={target}"
    assert target.get("original_price") is not None
    assert target["price"] < target["original_price"], f"price {target['price']} should be < original {target['original_price']}"
    assert abs(target["price"] - 52.5) < 0.01
    assert target.get("promo_label")


def test_return_settings_window_1_then_reset(admin_token):
    # Set window=1
    body = {"return_window_days": 1, "fee_percent": 10, "min_photos": 1, "max_photos": 5, "warranty_enabled": True}
    r = requests.put(f"{API}/admin/return-settings", json=body, headers=_h(admin_token))
    assert r.status_code == 200, r.text[:200]
    g = requests.get(f"{API}/return-settings").json()
    assert g.get("return_window_days") == 1

    # Reset to defaults
    body0 = {"return_window_days": 0, "fee_percent": 10, "min_photos": 1, "max_photos": 5, "warranty_enabled": True}
    r2 = requests.put(f"{API}/admin/return-settings", json=body0, headers=_h(admin_token))
    assert r2.status_code == 200
    g2 = requests.get(f"{API}/return-settings").json()
    assert g2.get("return_window_days") == 0


def test_demo_completed_orders_exist(user_token):
    r = requests.get(f"{API}/orders", headers=_h(user_token))
    assert r.status_code == 200
    orders = r.json()
    completed = [o for o in orders if o.get("status") == "completed"]
    assert len(completed) > 0, "demo user should have completed orders"
    # Each completed order should have completed_at or created_at
    for o in completed:
        assert o.get("completed_at") or o.get("created_at")
