"""Full audit regression: check removed endpoints are gone, main GETs are healthy, no 5xx.

Covers iter-117 audit request:
- /api/ozon-settings must be gone (404)
- /api/bonus/cart-preview must be gone (404)
- Admin GET list endpoints referenced by UI must not 5xx.
"""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": "admin@avarus.ru", "password": "admin"},
                      timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def client_token():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": "user@demo.com", "password": "demo123"},
                      timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ------------------------ REMOVED ENDPOINTS ------------------------
class TestRemovedEndpoints:
    def test_ozon_settings_gone(self, admin_h):
        r = requests.get(f"{BASE}/api/ozon-settings", headers=admin_h, timeout=10)
        assert r.status_code in (404, 405), f"Expected gone, got {r.status_code}"

    def test_ozon_settings_put_gone(self, admin_h):
        r = requests.put(f"{BASE}/api/ozon-settings", headers=admin_h, json={}, timeout=10)
        assert r.status_code in (404, 405), f"Expected gone, got {r.status_code}"

    def test_bonus_cart_preview_gone(self, client_token):
        h = {"Authorization": f"Bearer {client_token}"}
        r = requests.post(f"{BASE}/api/bonus/cart-preview", headers=h, json={"items": []}, timeout=10)
        assert r.status_code in (404, 405), f"Expected gone, got {r.status_code}"
        r2 = requests.get(f"{BASE}/api/bonus/cart-preview", headers=h, timeout=10)
        assert r2.status_code in (404, 405)


# ------------------------ ADMIN HEALTH GETS ------------------------
ADMIN_ENDPOINTS = [
    "/api/products",
    "/api/categories",
    "/api/admin/orders",
    "/api/admin/users",
    "/api/admin/stats",
    "/api/admin/chats",
    "/api/admin/returns",
    "/api/staff/managers",
    "/api/admin/rewards/settings",
    "/api/features",
    "/api/feature-settings",
    "/api/admin/attention",
    "/api/admin/warehouses",
    "/api/news",
    "/api/promo-banner",
    "/api/admin/product-requests",
    "/api/admin/discount-requests",
    "/api/admin/cart-discount-requests",
]


@pytest.mark.parametrize("path", ADMIN_ENDPOINTS)
def test_admin_endpoint_health(path, admin_h):
    r = requests.get(f"{BASE}{path}", headers=admin_h, timeout=20)
    assert r.status_code < 500, f"{path} returned {r.status_code}: {r.text[:200]}"
    # should be 2xx or legitimate 4xx (not 5xx)
    assert r.status_code in (200, 201, 204, 400, 401, 403, 404), \
        f"{path} unexpected {r.status_code}: {r.text[:200]}"


# ------------------------ SETTINGS SUB-ENDPOINTS ------------------------
SETTINGS_ENDPOINTS = [
    "/api/settings/delivery",
    "/api/settings/telegram",
    "/api/settings/notifications",
    "/api/settings/footer",
    "/api/settings/terms",
    "/api/settings/invoice",
    "/api/settings/parts-finder",
    "/api/settings/partners",
    "/api/settings/conditions",
    "/api/settings/maintenance",
]


@pytest.mark.parametrize("path", SETTINGS_ENDPOINTS)
def test_settings_health(path, admin_h):
    r = requests.get(f"{BASE}{path}", headers=admin_h, timeout=15)
    assert r.status_code < 500, f"{path} -> {r.status_code}: {r.text[:200]}"


# ------------------------ REWARD / BONUS SUB ------------------------
def test_rewards_settings_shape(admin_h):
    r = requests.get(f"{BASE}/api/admin/rewards/settings", headers=admin_h, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)


def test_bonus_programs(admin_h):
    r = requests.get(f"{BASE}/api/admin/rewards/programs", headers=admin_h, timeout=15)
    # may or may not exist depending on route name
    assert r.status_code < 500
