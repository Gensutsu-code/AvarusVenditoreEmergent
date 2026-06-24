"""Iteration 79 backend tests - Ozon settings + ozon_certificate calc + bulk warehouse movements + orders period (created_at present)."""
import os
import requests
import pytest

def _load_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
ADMIN = {"email": "admin@avarus.ru", "password": "admin"}
CLIENT = {"email": "user@demo.com", "password": "demo123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def client_token():
    return _login(CLIENT)


# ============ Ozon settings ============

class TestOzonSettings:
    def test_get_ozon_settings_public(self):
        r = requests.get(f"{BASE_URL}/api/ozon-settings", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "ozon_enabled" in d and "ozon_step" in d and "ozon_reward" in d
        assert isinstance(d["ozon_step"], int)
        assert isinstance(d["ozon_reward"], int)

    def test_update_ozon_settings_admin_persists(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        # Set custom values
        new_vals = {"ozon_enabled": True, "ozon_step": 7500, "ozon_reward": 333}
        r = requests.put(f"{BASE_URL}/api/admin/ozon-settings", json=new_vals, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body["ozon_step"] == 7500
        assert body["ozon_reward"] == 333
        # GET reflects
        r = requests.get(f"{BASE_URL}/api/ozon-settings", timeout=10)
        d = r.json()
        assert d["ozon_step"] == 7500
        assert d["ozon_reward"] == 333
        assert d["ozon_enabled"] is True

    def test_update_ozon_settings_requires_admin(self, client_token):
        h = {"Authorization": f"Bearer {client_token}"}
        r = requests.put(f"{BASE_URL}/api/admin/ozon-settings", json={"ozon_step": 1000}, headers=h, timeout=15)
        assert r.status_code == 403

    def test_update_ozon_settings_clamps(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        # step must be >=1 even if 0 passed
        r = requests.put(f"{BASE_URL}/api/admin/ozon-settings", json={"ozon_enabled": True, "ozon_step": 0, "ozon_reward": -5}, headers=h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["ozon_step"] >= 1
        assert d["ozon_reward"] >= 0


# ============ Ozon certificate computation on order ============

class TestOzonCertificateOnOrder:
    def _set_ozon(self, admin_token, enabled, step, reward):
        h = {"Authorization": f"Bearer {admin_token}"}
        requests.put(f"{BASE_URL}/api/admin/ozon-settings",
                     json={"ozon_enabled": enabled, "ozon_step": step, "ozon_reward": reward},
                     headers=h, timeout=15)

    def _get_a_product(self):
        r = requests.get(f"{BASE_URL}/api/products?page_size=20", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items", []) if isinstance(data, dict) else data
        # find a product with stock > 5 and price > 0
        for p in items:
            if (p.get("stock") or 0) >= 5 and (p.get("price") or 0) > 0 and not p.get("discount_active"):
                return p
        return items[0] if items else None

    def test_certificate_computed_with_configured_step_reward(self, admin_token, client_token):
        product = self._get_a_product()
        assert product is not None, "no products available"
        # Configure custom
        self._set_ozon(admin_token, True, 5000, 250)
        h = {"Authorization": f"Bearer {client_token}"}
        # clear cart
        requests.delete(f"{BASE_URL}/api/cart", headers=h, timeout=10)
        # add quantity to surpass two tranches: price * qty >= 10000
        price = float(product["price"])
        qty = max(2, int((10000 // price) + 2)) if price < 10000 else 2
        r = requests.post(f"{BASE_URL}/api/cart/add", json={"product_id": product["id"], "quantity": qty}, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        # create order
        order_payload = {
            "full_name": "TEST_iter79", "address": "TEST addr", "phone": "+79991234567",
            "comment": "iter79 ozon test", "payment_method": "cash"
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=order_payload, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        order = r.json()
        goods_total = order.get("subtotal", 0)
        expected = int(goods_total // 5000) * 250
        assert order.get("ozon_certificate") == expected, f"got {order.get('ozon_certificate')}, expected {expected} for goods {goods_total}"

    def test_certificate_zero_when_disabled(self, admin_token, client_token):
        product = self._get_a_product()
        assert product is not None
        self._set_ozon(admin_token, False, 10000, 500)
        h = {"Authorization": f"Bearer {client_token}"}
        requests.delete(f"{BASE_URL}/api/cart", headers=h, timeout=10)
        # qty that would otherwise yield a cert
        price = float(product["price"])
        qty = max(2, int((10000 // price) + 2)) if price < 10000 else 2
        requests.post(f"{BASE_URL}/api/cart/add", json={"product_id": product["id"], "quantity": qty}, headers=h, timeout=15)
        r = requests.post(f"{BASE_URL}/api/orders", json={
            "full_name": "TEST_iter79_off", "address": "x", "phone": "+79990000000", "comment": "", "payment_method": "cash"
        }, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("ozon_certificate") == 0


# ============ Bulk warehouse movements ============

class TestBulkWarehouse:
    def test_bulk_receipt_increments_stocks(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/products?page_size=5", timeout=15)
        items = r.json().get("items", []) if isinstance(r.json(), dict) else r.json()
        assert len(items) >= 2, "need at least 2 products"
        sample = items[:2]
        ids = [p["id"] for p in sample]
        # snapshot stocks
        before = {}
        for p in sample:
            rr = requests.get(f"{BASE_URL}/api/products/{p['id']}", timeout=10)
            before[p["id"]] = (rr.json() or {}).get("stock", 0) or 0
        # bulk receipt +3 each
        r = requests.post(f"{BASE_URL}/api/admin/warehouse/movements/bulk",
                          json={"product_ids": ids, "type": "receipt", "quantity": 3, "purchase_price": 100, "comment": "TEST_iter79_bulk"},
                          headers=h, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("processed") == 2
        # verify
        for pid in ids:
            rr = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=10)
            after = (rr.json() or {}).get("stock", 0) or 0
            assert after == before[pid] + 3, f"stock for {pid}: {after} vs expected {before[pid] + 3}"

    def test_bulk_writeoff_decrements_stocks(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/products?page_size=5", timeout=15)
        items = r.json().get("items", []) if isinstance(r.json(), dict) else r.json()
        sample = items[:2]
        ids = [p["id"] for p in sample]
        before = {}
        for p in sample:
            rr = requests.get(f"{BASE_URL}/api/products/{p['id']}", timeout=10)
            before[p["id"]] = (rr.json() or {}).get("stock", 0) or 0
        # writeoff -1
        r = requests.post(f"{BASE_URL}/api/admin/warehouse/movements/bulk",
                          json={"product_ids": ids, "type": "writeoff", "quantity": 1, "comment": "TEST_iter79_bulk_wo"},
                          headers=h, timeout=20)
        assert r.status_code == 200, r.text
        for pid in ids:
            rr = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=10)
            after = (rr.json() or {}).get("stock", 0) or 0
            assert after <= before[pid], f"writeoff didn't decrement {pid}"

    def test_bulk_requires_admin(self, client_token):
        h = {"Authorization": f"Bearer {client_token}"}
        r = requests.post(f"{BASE_URL}/api/admin/warehouse/movements/bulk",
                          json={"product_ids": ["x"], "type": "receipt", "quantity": 1}, headers=h, timeout=15)
        assert r.status_code == 403

    def test_bulk_validates_inputs(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        # empty ids
        r = requests.post(f"{BASE_URL}/api/admin/warehouse/movements/bulk",
                          json={"product_ids": [], "type": "receipt", "quantity": 1}, headers=h, timeout=15)
        assert r.status_code == 400
        # bad type
        r = requests.post(f"{BASE_URL}/api/admin/warehouse/movements/bulk",
                          json={"product_ids": ["x"], "type": "foo", "quantity": 1}, headers=h, timeout=15)
        assert r.status_code == 400
        # qty 0
        r = requests.post(f"{BASE_URL}/api/admin/warehouse/movements/bulk",
                          json={"product_ids": ["x"], "type": "receipt", "quantity": 0}, headers=h, timeout=15)
        assert r.status_code == 400


# ============ Orders endpoint returns created_at for period filtering ============

class TestOrdersHaveCreatedAt:
    def test_orders_list_has_created_at(self, client_token):
        h = {"Authorization": f"Bearer {client_token}"}
        r = requests.get(f"{BASE_URL}/api/orders", headers=h, timeout=15)
        assert r.status_code == 200
        orders = r.json()
        if orders:
            for o in orders[:3]:
                assert o.get("created_at"), "order missing created_at, period filter won't work"


# ============ Restore defaults at end ============

class TestZRestoreDefaults:
    def test_restore_ozon_defaults(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.put(f"{BASE_URL}/api/admin/ozon-settings",
                         json={"ozon_enabled": True, "ozon_step": 10000, "ozon_reward": 500}, headers=h, timeout=15)
        assert r.status_code == 200
