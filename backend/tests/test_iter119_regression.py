"""Regression tests for iteration 119 - moved reward-cart-preview endpoint + sanity checks."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_PW = os.environ.get("TEST_ADMIN_PASSWORD")
CLIENT_PW = os.environ.get("TEST_CLIENT_PASSWORD")


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text[:200]}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def client_token():
    return _login("user@demo.com", CLIENT_PW)


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@avarus.ru", ADMIN_PW)


def test_auth_me_client(client_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("email") == "user@demo.com"


def test_auth_me_admin(admin_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    assert r.json().get("role") == "admin"


def test_reward_cart_preview_empty(client_token):
    """Moved endpoint: GET /api/rewards/cart-preview must still respond 200."""
    r = requests.get(f"{BASE_URL}/api/rewards/cart-preview",
                     headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
    assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert isinstance(data, dict)


def test_cart_endpoint(client_token):
    r = requests.get(f"{BASE_URL}/api/cart", headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
    assert r.status_code == 200


def test_orders_endpoint(client_token):
    r = requests.get(f"{BASE_URL}/api/orders", headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
    assert r.status_code == 200


def test_bonus_programs(client_token):
    r = requests.get(f"{BASE_URL}/api/bonus/programs",
                     headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
    assert r.status_code in (200, 404)


def test_products_list():
    r = requests.get(f"{BASE_URL}/api/products", timeout=15)
    assert r.status_code == 200


def test_unauthorized_reward_preview():
    r = requests.get(f"{BASE_URL}/api/rewards/cart-preview", timeout=15)
    assert r.status_code in (401, 403)
