"""Tests for return-settings admin CRUD + return creation honoring settings."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://order-merge-fulfill.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}
CLIENT = {"email": "user@demo.com", "password": os.environ["TEST_CLIENT_PASSWORD"]}
SAMPLE_ORDER_ID = "f6617f0a-e70d-4efb-8f83-366cd6137bd9"

DEFAULTS = {
    "fee_percent": 10,
    "min_photos": 1,
    "max_photos": 5,
    "return_window_days": 0,
    "warranty_enabled": True,
}


# ===== fixtures =====
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    r = requests.post(f"{API}/auth/login", json=CLIENT, timeout=20)
    assert r.status_code == 200, f"Client login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def client_headers(client_token):
    return {"Authorization": f"Bearer {client_token}"}


def _put_settings(headers, **overrides):
    payload = {**DEFAULTS, **overrides}
    return requests.put(f"{API}/admin/return-settings", json=payload, headers=headers, timeout=20)


# ===== Public GET /return-settings =====
class TestReturnSettingsPublic:
    def test_public_get_returns_defaults_or_values(self):
        r = requests.get(f"{API}/return-settings", timeout=20)
        assert r.status_code == 200
        data = r.json()
        for k in ("fee_percent", "min_photos", "max_photos", "return_window_days", "warranty_enabled",
                  "desc_return", "desc_warranty", "warning_text", "policy_text"):
            assert k in data, f"Missing key {k}"
        assert isinstance(data["warranty_enabled"], bool)
        assert isinstance(data["fee_percent"], (int, float))


# ===== Admin auth on PUT =====
class TestAdminAuth:
    def test_put_without_token_is_unauthorized(self):
        r = requests.put(f"{API}/admin/return-settings", json={"fee_percent": 15}, timeout=20)
        assert r.status_code in (401, 403)

    def test_put_with_client_token_forbidden(self, client_headers):
        r = requests.put(f"{API}/admin/return-settings", json={"fee_percent": 15},
                         headers=client_headers, timeout=20)
        assert r.status_code in (401, 403)


# ===== Admin PUT updates and reflected in GET =====
class TestReturnSettingsUpdate:
    def test_admin_put_updates_values(self, admin_headers):
        try:
            r = _put_settings(admin_headers, fee_percent=20, min_photos=2)
            assert r.status_code == 200, r.text
            assert r.json().get("success") is True

            g = requests.get(f"{API}/return-settings", timeout=20)
            assert g.status_code == 200
            data = g.json()
            assert data["fee_percent"] == 20
            assert data["min_photos"] == 2
        finally:
            # reset
            _put_settings(admin_headers)


# ===== Return creation honors settings =====
class TestReturnCreation:
    def test_return_fee_math_with_default_10pct(self, admin_headers, client_headers):
        # ensure defaults
        rr = _put_settings(admin_headers)
        assert rr.status_code == 200

        # Get order to compute expected
        o = requests.get(f"{API}/orders/{SAMPLE_ORDER_ID}", headers=client_headers, timeout=20)
        if o.status_code != 200:
            pytest.skip(f"Order not accessible: {o.status_code} {o.text[:120]}")
        order = o.json()
        items_src = order.get("items", [])
        if not items_src:
            pytest.skip("Order has no items")
        # pick first item, qty=1
        first = items_src[0]
        items_payload = [{"product_id": first["product_id"], "quantity": 1}]
        item_total = first["price"] * 1

        payload = {
            "type": "return",
            "order_id": SAMPLE_ORDER_ID,
            "items": items_payload,
            "reason": "TEST_fee_math",
            "photos": ["https://example.com/test.jpg"],
        }
        r = requests.post(f"{API}/returns", json=payload, headers=client_headers, timeout=30)
        if r.status_code == 400 and "уже был возвращён" in r.text:
            pytest.skip("Item already fully returned in previous tests")
        assert r.status_code == 200, r.text
        ret = r.json()
        assert ret["fee_percent"] == 10
        expected_deduction = round(item_total * 0.10, 2)
        expected_refund = round(item_total - expected_deduction, 2)
        assert abs(ret["total_deduction"] - expected_deduction) < 0.5, f"deduction {ret['total_deduction']} vs {expected_deduction}"
        assert abs(ret["total_refund"] - expected_refund) < 0.5, f"refund {ret['total_refund']} vs {expected_refund}"

    def test_min_photos_validation(self, admin_headers, client_headers):
        # set min_photos=2
        rr = _put_settings(admin_headers, min_photos=2)
        assert rr.status_code == 200
        try:
            o = requests.get(f"{API}/orders/{SAMPLE_ORDER_ID}", headers=client_headers, timeout=20)
            if o.status_code != 200:
                pytest.skip("Order not accessible")
            order = o.json()
            items_src = order.get("items", [])
            if not items_src:
                pytest.skip("No items")
            payload = {
                "type": "return",
                "order_id": SAMPLE_ORDER_ID,
                "items": [{"product_id": items_src[0]["product_id"], "quantity": 1}],
                "reason": "TEST_min_photos",
                "photos": ["https://example.com/one.jpg"],  # only 1 photo, need 2
            }
            r = requests.post(f"{API}/returns", json=payload, headers=client_headers, timeout=20)
            assert r.status_code == 400
            assert "минимум 2 фото" in r.text or "минимум" in r.text
        finally:
            _put_settings(admin_headers)

    def test_warranty_disabled_blocks_warranty_return(self, admin_headers, client_headers):
        rr = _put_settings(admin_headers, warranty_enabled=False)
        assert rr.status_code == 200
        try:
            o = requests.get(f"{API}/orders/{SAMPLE_ORDER_ID}", headers=client_headers, timeout=20)
            if o.status_code != 200:
                pytest.skip("Order not accessible")
            order = o.json()
            items_src = order.get("items", [])
            if not items_src:
                pytest.skip("No items")
            payload = {
                "type": "warranty",
                "order_id": SAMPLE_ORDER_ID,
                "items": [{"product_id": items_src[0]["product_id"], "quantity": 1}],
                "reason": "TEST_warranty_disabled",
                "photos": ["https://example.com/a.jpg"],
            }
            r = requests.post(f"{API}/returns", json=payload, headers=client_headers, timeout=20)
            assert r.status_code == 400
            assert "Гарантийный" in r.text or "недоступен" in r.text
        finally:
            _put_settings(admin_headers)  # re-enable


# ===== Final cleanup: ensure defaults restored =====
class TestZZCleanup:
    def test_reset_defaults(self, admin_headers):
        r = _put_settings(admin_headers)
        assert r.status_code == 200
        g = requests.get(f"{API}/return-settings", timeout=20).json()
        assert g["fee_percent"] == 10
        assert g["min_photos"] == 1
        assert g["max_photos"] == 5
        assert g["return_window_days"] == 0
        assert g["warranty_enabled"] is True
