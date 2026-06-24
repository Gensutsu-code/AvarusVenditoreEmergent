"""Tests for the new GET /api/admin/dashboard endpoint and skeleton-related sanity checks."""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback to backend public URL from frontend env file
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                    break
    except Exception:
        pass

ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"
USER_EMAIL = "user@demo.com"
USER_PASSWORD = "demo123"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def user_token():
    return _login(USER_EMAIL, USER_PASSWORD)


def test_dashboard_returns_data_for_admin(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/dashboard",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()

    # Required top-level keys
    for key in ["today", "revenue_by_day", "totals", "top_products",
                "low_stock", "awaiting_payment_orders", "low_stock_threshold"]:
        assert key in data, f"missing key {key}"

    # today
    assert "revenue" in data["today"]
    assert "orders" in data["today"]

    # revenue_by_day must be a list with 14 elements
    assert isinstance(data["revenue_by_day"], list)
    assert len(data["revenue_by_day"]) == 14, f"expected 14 days, got {len(data['revenue_by_day'])}"
    for d in data["revenue_by_day"]:
        assert "date" in d and ("revenue" in d or "amount" in d)

    # totals
    totals = data["totals"]
    for key in ["orders_total", "revenue_30d", "pending_processing", "awaiting_payment"]:
        assert key in totals, f"totals missing {key}"

    # Lists
    assert isinstance(data["top_products"], list)
    assert isinstance(data["low_stock"], list)
    assert isinstance(data["awaiting_payment_orders"], list)


def test_dashboard_forbidden_for_non_admin(user_token):
    r = requests.get(f"{BASE_URL}/api/admin/dashboard",
                     headers={"Authorization": f"Bearer {user_token}"}, timeout=20)
    assert r.status_code in (401, 403), f"expected 401/403 for non-admin, got {r.status_code}"


def test_dashboard_unauthenticated_blocked():
    r = requests.get(f"{BASE_URL}/api/admin/dashboard", timeout=20)
    assert r.status_code in (401, 403), f"expected 401/403 unauthenticated, got {r.status_code}"


# Sanity: products & orders endpoints must respond (catalog / orders pages load skeleton then data)
def test_products_endpoint_ok():
    r = requests.get(f"{BASE_URL}/api/products", timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_orders_endpoint_ok_for_user(user_token):
    r = requests.get(f"{BASE_URL}/api/orders",
                     headers={"Authorization": f"Bearer {user_token}"}, timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
