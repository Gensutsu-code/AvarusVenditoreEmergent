"""Tests for stock sync settings (global) + per-product override + order sync behavior."""
import os
import time
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0]).rstrip("/")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@avarus.ru", "password": "admin"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "0x0errorr@gmail.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# --- Helper: pick a test product (try to find one with stock=0 we can mutate) ---
def _find_test_product(admin_token):
    r = requests.get(f"{BASE_URL}/api/admin/products?limit=50", headers=H(admin_token))
    assert r.status_code == 200, r.text
    products = r.json() if isinstance(r.json(), list) else (r.json().get("items") or r.json().get("products") or [])
    # Avoid using one that is bonus/special; just pick the first regular one
    return products[0] if products else None


# ==================== Global Stock Sync Settings ====================

class TestStockSyncSettings:
    def test_get_default_setting(self):
        r = requests.get(f"{BASE_URL}/api/stock-sync-settings")
        assert r.status_code == 200
        data = r.json()
        assert "stock_sync_enabled" in data
        assert isinstance(data["stock_sync_enabled"], bool)

    def test_admin_can_update(self, admin_token):
        # Set to false
        r = requests.put(f"{BASE_URL}/api/admin/stock-sync-settings",
                         json={"stock_sync_enabled": False}, headers=H(admin_token))
        assert r.status_code == 200, r.text
        g = requests.get(f"{BASE_URL}/api/stock-sync-settings").json()
        assert g["stock_sync_enabled"] is False
        # Restore
        r = requests.put(f"{BASE_URL}/api/admin/stock-sync-settings",
                         json={"stock_sync_enabled": True}, headers=H(admin_token))
        assert r.status_code == 200
        assert requests.get(f"{BASE_URL}/api/stock-sync-settings").json()["stock_sync_enabled"] is True

    def test_non_admin_forbidden(self, client_token):
        r = requests.put(f"{BASE_URL}/api/admin/stock-sync-settings",
                         json={"stock_sync_enabled": False}, headers=H(client_token))
        assert r.status_code == 403


# ==================== Product effective in_stock computation ====================

class TestProductInStock:
    def test_in_stock_field_present_on_list_and_detail(self):
        r = requests.get(f"{BASE_URL}/api/products?limit=5")
        assert r.status_code == 200
        products = r.json()
        assert len(products) > 0
        for p in products:
            assert "in_stock" in p, f"in_stock missing on product list item {p.get('id')}"
            assert isinstance(p["in_stock"], bool)
        # detail
        pid = products[0]["id"]
        r2 = requests.get(f"{BASE_URL}/api/products/{pid}")
        assert r2.status_code == 200
        assert "in_stock" in r2.json()

    def test_global_off_makes_zero_stock_available(self, admin_token):
        product = _find_test_product(admin_token)
        assert product
        pid = product["id"]
        original_stock = product.get("stock", 0)
        original_mode = product.get("stock_sync_mode", "inherit")
        original_manual = product.get("manual_available", True)
        try:
            # Ensure: mode=inherit, stock=0, manual_available default true
            r = requests.put(f"{BASE_URL}/api/products/{pid}",
                             json={"stock": 0, "stock_sync_mode": "inherit",
                                   "manual_available": True},
                             headers=H(admin_token))
            assert r.status_code == 200, r.text

            # Ensure global ON => in_stock false (stock=0)
            requests.put(f"{BASE_URL}/api/admin/stock-sync-settings",
                         json={"stock_sync_enabled": True}, headers=H(admin_token))
            d = requests.get(f"{BASE_URL}/api/products/{pid}").json()
            assert d["in_stock"] is False, "Global ON + stock=0 + inherit => in_stock should be False"

            # Switch global OFF => in_stock true (manual default true)
            requests.put(f"{BASE_URL}/api/admin/stock-sync-settings",
                         json={"stock_sync_enabled": False}, headers=H(admin_token))
            d2 = requests.get(f"{BASE_URL}/api/products/{pid}").json()
            assert d2["in_stock"] is True, "Global OFF + inherit + manual_available=True => in_stock True"
        finally:
            # Restore global ON
            requests.put(f"{BASE_URL}/api/admin/stock-sync-settings",
                         json={"stock_sync_enabled": True}, headers=H(admin_token))
            # Restore product
            requests.put(f"{BASE_URL}/api/products/{pid}",
                         json={"stock": original_stock, "stock_sync_mode": original_mode,
                               "manual_available": original_manual},
                         headers=H(admin_token))

    def test_per_product_override_off_with_manual(self, admin_token):
        product = _find_test_product(admin_token)
        pid = product["id"]
        original_stock = product.get("stock", 0)
        original_mode = product.get("stock_sync_mode", "inherit")
        original_manual = product.get("manual_available", True)
        try:
            # mode=off + manual_available=true => in_stock true regardless of stock
            r = requests.put(f"{BASE_URL}/api/products/{pid}",
                             json={"stock": 0, "stock_sync_mode": "off",
                                   "manual_available": True},
                             headers=H(admin_token))
            assert r.status_code == 200, r.text
            # Read back
            d = requests.get(f"{BASE_URL}/api/products/{pid}").json()
            assert d.get("stock_sync_mode") == "off"
            assert d.get("manual_available") is True
            assert d["in_stock"] is True

            # manual_available=false => in_stock false
            r = requests.put(f"{BASE_URL}/api/products/{pid}",
                             json={"manual_available": False}, headers=H(admin_token))
            assert r.status_code == 200
            d2 = requests.get(f"{BASE_URL}/api/products/{pid}").json()
            assert d2["in_stock"] is False
        finally:
            requests.put(f"{BASE_URL}/api/products/{pid}",
                         json={"stock": original_stock, "stock_sync_mode": original_mode,
                               "manual_available": original_manual},
                         headers=H(admin_token))

    def test_per_product_override_on_forces_sync(self, admin_token):
        product = _find_test_product(admin_token)
        pid = product["id"]
        original_stock = product.get("stock", 0)
        original_mode = product.get("stock_sync_mode", "inherit")
        original_manual = product.get("manual_available", True)
        try:
            # Set global OFF, but per-product mode=on with stock=0 => in_stock false
            requests.put(f"{BASE_URL}/api/admin/stock-sync-settings",
                         json={"stock_sync_enabled": False}, headers=H(admin_token))
            r = requests.put(f"{BASE_URL}/api/products/{pid}",
                             json={"stock": 0, "stock_sync_mode": "on",
                                   "manual_available": True},
                             headers=H(admin_token))
            assert r.status_code == 200
            d = requests.get(f"{BASE_URL}/api/products/{pid}").json()
            assert d["in_stock"] is False  # forced sync, stock=0
            # Now stock=5 => in_stock true
            requests.put(f"{BASE_URL}/api/products/{pid}",
                         json={"stock": 5}, headers=H(admin_token))
            d2 = requests.get(f"{BASE_URL}/api/products/{pid}").json()
            assert d2["in_stock"] is True
        finally:
            requests.put(f"{BASE_URL}/api/admin/stock-sync-settings",
                         json={"stock_sync_enabled": True}, headers=H(admin_token))
            requests.put(f"{BASE_URL}/api/products/{pid}",
                         json={"stock": original_stock, "stock_sync_mode": original_mode,
                               "manual_available": original_manual},
                         headers=H(admin_token))

    def test_switch_back_to_inherit(self, admin_token):
        product = _find_test_product(admin_token)
        pid = product["id"]
        original_mode = product.get("stock_sync_mode", "inherit")
        try:
            # Set to "off", then back to "inherit"
            r = requests.put(f"{BASE_URL}/api/products/{pid}",
                             json={"stock_sync_mode": "off"}, headers=H(admin_token))
            assert r.status_code == 200
            d = requests.get(f"{BASE_URL}/api/products/{pid}").json()
            assert d.get("stock_sync_mode") == "off"

            r2 = requests.put(f"{BASE_URL}/api/products/{pid}",
                              json={"stock_sync_mode": "inherit"}, headers=H(admin_token))
            assert r2.status_code == 200
            d2 = requests.get(f"{BASE_URL}/api/products/{pid}").json()
            assert d2.get("stock_sync_mode") == "inherit", f"Expected inherit, got {d2.get('stock_sync_mode')}"
        finally:
            requests.put(f"{BASE_URL}/api/products/{pid}",
                         json={"stock_sync_mode": original_mode}, headers=H(admin_token))


# ==================== Order Placement w.r.t. sync ====================

class TestOrderSyncBehavior:
    def _place_order(self, client_token, product_id, qty=1):
        # Clear cart first to avoid leftover items affecting decrement
        try:
            requests.delete(f"{BASE_URL}/api/cart/clear", headers=H(client_token))
        except Exception:
            pass
        # add to cart
        r = requests.post(f"{BASE_URL}/api/cart/add",
                          json={"product_id": product_id, "quantity": qty},
                          headers=H(client_token))
        assert r.status_code == 200, r.text
        # place order
        order_payload = {
            "delivery_method": "pickup",
            "payment_method": "cash",
            "delivery_address": "TEST_addr",
            "address": "TEST_addr",
            "full_name": "TEST User",
            "phone": "+71234567890",
            "comment": "TEST_stock_sync",
        }
        r2 = requests.post(f"{BASE_URL}/api/orders", json=order_payload, headers=H(client_token))
        assert r2.status_code in (200, 201), r2.text
        return r2.json()

    def test_synced_product_decrements_and_logs_sale(self, admin_token, client_token):
        product = _find_test_product(admin_token)
        pid = product["id"]
        original_stock = product.get("stock", 0)
        original_mode = product.get("stock_sync_mode", "inherit")
        try:
            # Ensure global ON, set product mode=on with stock=10
            requests.put(f"{BASE_URL}/api/admin/stock-sync-settings",
                         json={"stock_sync_enabled": True}, headers=H(admin_token))
            requests.put(f"{BASE_URL}/api/products/{pid}",
                         json={"stock_sync_mode": "on", "stock": 10},
                         headers=H(admin_token))

            before = requests.get(f"{BASE_URL}/api/products/{pid}").json()["stock"]
            order = self._place_order(client_token, pid, qty=1)
            order_id = order.get("id") or order.get("order_id") or order.get("_id")
            time.sleep(0.5)
            after = requests.get(f"{BASE_URL}/api/products/{pid}").json()["stock"]
            assert after == before - 1, f"Expected decrement {before}->{before-1}, got {after}"

            # sale movement logged
            mv = requests.get(f"{BASE_URL}/api/admin/warehouse/movements?type=sale&limit=50",
                              headers=H(admin_token))
            assert mv.status_code == 200
            data = mv.json()
            movs = data if isinstance(data, list) else data.get("movements", [])
            assert any(m.get("product_id") == pid for m in movs), "sale movement missing for synced product"
        finally:
            requests.put(f"{BASE_URL}/api/products/{pid}",
                         json={"stock": original_stock, "stock_sync_mode": original_mode},
                         headers=H(admin_token))

    def test_non_synced_product_does_not_change_stock(self, admin_token, client_token):
        product = _find_test_product(admin_token)
        pid = product["id"]
        original_stock = product.get("stock", 0)
        original_mode = product.get("stock_sync_mode", "inherit")
        original_manual = product.get("manual_available", True)
        try:
            # mode=off, manual_available=true, stock=0 (truly non-synced)
            requests.put(f"{BASE_URL}/api/products/{pid}",
                         json={"stock_sync_mode": "off", "manual_available": True, "stock": 0},
                         headers=H(admin_token))
            before = requests.get(f"{BASE_URL}/api/products/{pid}").json()["stock"]
            assert before == 0

            # Snapshot existing sale movements for this product
            mv_before = requests.get(f"{BASE_URL}/api/admin/warehouse/movements?type=sale&limit=200",
                                     headers=H(admin_token)).json()
            before_list = mv_before if isinstance(mv_before, list) else mv_before.get("movements", [])
            before_count = sum(1 for m in before_list if m.get("product_id") == pid)

            self._place_order(client_token, pid, qty=2)
            time.sleep(0.5)
            after = requests.get(f"{BASE_URL}/api/products/{pid}").json()["stock"]
            assert after == 0, f"Non-synced product stock should not change, got {after}"

            mv_after = requests.get(f"{BASE_URL}/api/admin/warehouse/movements?type=sale&limit=200",
                                    headers=H(admin_token)).json()
            after_list = mv_after if isinstance(mv_after, list) else mv_after.get("movements", [])
            after_count = sum(1 for m in after_list if m.get("product_id") == pid)
            assert after_count == before_count, \
                f"No new sale movement expected for non-synced product (before={before_count}, after={after_count})"
        finally:
            requests.put(f"{BASE_URL}/api/products/{pid}",
                         json={"stock": original_stock, "stock_sync_mode": original_mode,
                               "manual_available": original_manual},
                         headers=H(admin_token))
            requests.put(f"{BASE_URL}/api/admin/stock-sync-settings",
                         json={"stock_sync_enabled": True}, headers=H(admin_token))
