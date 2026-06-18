"""
Iteration 59 - Virtual categories tabs, tiered discounts, auto 'Новинки',
admin category grid customization (display_order + columns_count).
"""
import os
import uuid
import requests
import pytest
from datetime import datetime, timedelta, timezone


def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    try:
        with open("/app/frontend/.env", "r") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_base_url()
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"
CLIENT_EMAIL = "user@demo.com"
CLIENT_PASSWORD = "demo123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def client_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Client login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    return tok


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def client_headers(client_token):
    return {"Authorization": f"Bearer {client_token}"}


# ==================== VIRTUAL CATEGORIES ====================

class TestVirtualCategories:
    def test_assortment_returns_full_catalog(self):
        r_full = requests.get(f"{BASE_URL}/api/products?limit=100", timeout=30)
        r_assort = requests.get(f"{BASE_URL}/api/products?virtual_category=assortment&limit=100", timeout=30)
        assert r_full.status_code == 200
        assert r_assort.status_code == 200
        full = r_full.json()
        assort = r_assort.json()
        assert isinstance(full, list) and isinstance(assort, list)
        # Same set of IDs (order may differ)
        full_ids = {p["id"] for p in full}
        assort_ids = {p["id"] for p in assort}
        assert full_ids == assort_ids, f"assortment should be identical to no filter; diff={full_ids ^ assort_ids}"

    def test_new_virtual_category_filters_correctly(self):
        r = requests.get(f"{BASE_URL}/api/products?virtual_category=new&limit=100", timeout=30)
        assert r.status_code == 200
        products = r.json()
        now = datetime.now(timezone.utc)
        for p in products:
            # After _ensure_new_status mutation, products with passed new_until have is_new=false
            assert p.get("is_new") is True, f"Product {p['id']} returned in 'new' has is_new={p.get('is_new')}"
            nu = p.get("new_until")
            if nu:
                try:
                    until_dt = datetime.fromisoformat(str(nu).replace("Z", "+00:00"))
                    if until_dt.tzinfo is None:
                        until_dt = until_dt.replace(tzinfo=timezone.utc)
                    assert until_dt > now, f"Product {p['id']} new_until={nu} is in the past"
                except ValueError:
                    pass

    def test_discounted_virtual_category_filters_correctly(self):
        r = requests.get(f"{BASE_URL}/api/products?virtual_category=discounted&limit=100", timeout=30)
        assert r.status_code == 200
        products = r.json()
        now = datetime.now(timezone.utc)
        for p in products:
            assert p.get("discount_active") is True, f"Product {p['id']} returned without discount_active"
            du = p.get("discount_until")
            if du:
                try:
                    until_dt = datetime.fromisoformat(str(du).replace("Z", "+00:00"))
                    if until_dt.tzinfo is None:
                        until_dt = until_dt.replace(tzinfo=timezone.utc)
                    assert until_dt > now, f"Product {p['id']} discount_until={du} is in the past"
                except ValueError:
                    pass


# ==================== AUTO is_new ON CREATE / UPDATE ====================

class TestNewBadgeAutoLogic:
    def test_create_product_auto_sets_is_new_and_new_until(self, admin_headers):
        article = f"TEST_AUTO_NEW_{uuid.uuid4().hex[:6]}"
        payload = {"name": "TEST auto new", "article": article, "price": 100.0, "stock": 5}
        r = requests.post(f"{BASE_URL}/api/products", json=payload, headers=admin_headers, timeout=30)
        assert r.status_code in (200, 201), r.text
        prod = r.json()
        pid = prod["id"]
        try:
            assert prod.get("is_new") is True
            new_until = prod.get("new_until")
            assert new_until, "new_until should be auto-set"
            until_dt = datetime.fromisoformat(str(new_until).replace("Z", "+00:00"))
            if until_dt.tzinfo is None:
                until_dt = until_dt.replace(tzinfo=timezone.utc)
            expected = datetime.now(timezone.utc) + timedelta(days=14)
            delta_seconds = abs((until_dt - expected).total_seconds())
            assert delta_seconds < 300, f"new_until {new_until} not ~14d from now"
        finally:
            requests.delete(f"{BASE_URL}/api/products/{pid}", headers=admin_headers, timeout=30)

    def test_put_is_new_toggle_sets_and_clears_new_until(self, admin_headers):
        article = f"TEST_TOGGLE_NEW_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/products",
                          json={"name": "TEST toggle", "article": article, "price": 50.0,
                                "stock": 1, "is_new": False},
                          headers=admin_headers, timeout=30)
        assert r.status_code in (200, 201)
        pid = r.json()["id"]
        try:
            # Toggle to True
            r2 = requests.put(f"{BASE_URL}/api/products/{pid}",
                              json={"is_new": True}, headers=admin_headers, timeout=30)
            assert r2.status_code == 200
            p = r2.json()
            assert p["is_new"] is True
            nu = p.get("new_until")
            assert nu, "new_until should be set when toggling is_new=True"
            until_dt = datetime.fromisoformat(str(nu).replace("Z", "+00:00"))
            if until_dt.tzinfo is None:
                until_dt = until_dt.replace(tzinfo=timezone.utc)
            expected = datetime.now(timezone.utc) + timedelta(days=14)
            assert abs((until_dt - expected).total_seconds()) < 300

            # Toggle to False — clear
            r3 = requests.put(f"{BASE_URL}/api/products/{pid}",
                              json={"is_new": False}, headers=admin_headers, timeout=30)
            assert r3.status_code == 200
            p3 = r3.json()
            assert p3["is_new"] is False
            assert p3.get("new_until") in (None, "")
        finally:
            requests.delete(f"{BASE_URL}/api/products/{pid}", headers=admin_headers, timeout=30)

    def test_expired_new_until_auto_expires_on_read(self, admin_headers):
        article = f"TEST_EXPIRED_NEW_{uuid.uuid4().hex[:6]}"
        past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        r = requests.post(f"{BASE_URL}/api/products",
                          json={"name": "TEST expired", "article": article, "price": 1.0,
                                "stock": 1, "is_new": True, "new_until": past},
                          headers=admin_headers, timeout=30)
        assert r.status_code in (200, 201)
        pid = r.json()["id"]
        try:
            r2 = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=30)
            assert r2.status_code == 200
            assert r2.json().get("is_new") is False, "_ensure_new_status should flip is_new to False"
        finally:
            requests.delete(f"{BASE_URL}/api/products/{pid}", headers=admin_headers, timeout=30)


# ==================== TIERED DISCOUNTS IN CART ====================

class TestTieredDiscounts:
    @pytest.fixture(scope="class")
    def tier_product(self, admin_headers):
        article = f"TEST_TIER_{uuid.uuid4().hex[:6]}"
        future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        payload = {
            "name": "TEST tier product",
            "article": article,
            "price": 1000.0,
            "stock": 100,
            "discount_active": True,
            "discount_type": "percent",
            "discount_value": 5,
            "discount_until": future,
            "discount_tiers": [
                {"min_qty": 5, "type": "percent", "value": 10},
                {"min_qty": 10, "type": "percent", "value": 20},
            ],
        }
        r = requests.post(f"{BASE_URL}/api/products", json=payload, headers=admin_headers, timeout=30)
        assert r.status_code in (200, 201), r.text
        pid = r.json()["id"]
        yield pid
        requests.delete(f"{BASE_URL}/api/products/{pid}", headers=admin_headers, timeout=30)

    def _set_cart_qty(self, client_headers, pid, qty):
        # Clear cart and add
        requests.delete(f"{BASE_URL}/api/cart", headers=client_headers, timeout=30)
        r = requests.post(f"{BASE_URL}/api/cart/add",
                         json={"product_id": pid, "quantity": qty},
                         headers=client_headers, timeout=30)
        assert r.status_code == 200, r.text

    def test_tier_qty_3_no_tier_applied_base_discount(self, client_headers, tier_product):
        self._set_cart_qty(client_headers, tier_product, 3)
        r = requests.get(f"{BASE_URL}/api/cart", headers=client_headers, timeout=30)
        assert r.status_code == 200
        items = r.json().get("items", [])
        item = next(i for i in items if i["product_id"] == tier_product)
        # base discount 5% applies on 1000 → 950
        assert item["promo_active"] is True
        assert item["price"] == 950.0, f"Expected 950 (base 5%), got {item['price']}"

    def test_tier_qty_7_applies_10_percent(self, client_headers, tier_product):
        self._set_cart_qty(client_headers, tier_product, 7)
        r = requests.get(f"{BASE_URL}/api/cart", headers=client_headers, timeout=30)
        items = r.json()["items"]
        item = next(i for i in items if i["product_id"] == tier_product)
        assert item["price"] == 900.0, f"Expected 900 (tier 10%), got {item['price']}"

    def test_tier_qty_12_applies_20_percent(self, client_headers, tier_product):
        self._set_cart_qty(client_headers, tier_product, 12)
        r = requests.get(f"{BASE_URL}/api/cart", headers=client_headers, timeout=30)
        items = r.json()["items"]
        item = next(i for i in items if i["product_id"] == tier_product)
        assert item["price"] == 800.0, f"Expected 800 (tier 20%), got {item['price']}"

    def test_tier_qty_12_order_total_reflects_tier(self, client_headers, tier_product):
        self._set_cart_qty(client_headers, tier_product, 12)
        order_payload = {
            "full_name": "Test",
            "address": "Test addr",
            "phone": "+70000000000",
            "comment": "tier test",
            "payment_method": "balance",  # 0% payment adjustment for clean math
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=order_payload,
                          headers=client_headers, timeout=30)
        assert r.status_code in (200, 201), r.text
        order = r.json()
        # base 1000 * 1.0 (balance 0% adj) = 1000, tier 20% → 800
        item = next(i for i in order["items"] if i["product_id"] == tier_product)
        assert item["price"] == 800.0, f"Expected 800 (tier 20% off 1000), got {item['price']}"
        # 12 * 800 = 9600, > 5000 → free delivery
        assert order["total"] == 9600.0, f"Expected total 9600, got {order['total']}"


# ==================== CATEGORY REORDER & COLUMNS_COUNT ====================

class TestCategoryDisplaySettings:
    def test_get_display_settings_returns_columns_count(self):
        r = requests.get(f"{BASE_URL}/api/categories/display-settings", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "columns_count" in data
        assert isinstance(data["columns_count"], int)
        assert 2 <= data["columns_count"] <= 6

    def test_put_display_settings_admin_persists(self, admin_headers):
        # Read current
        before = requests.get(f"{BASE_URL}/api/categories/display-settings", timeout=30).json()
        original = before["columns_count"]
        try:
            r = requests.put(f"{BASE_URL}/api/categories/display-settings",
                             json={"columns_count": 5}, headers=admin_headers, timeout=30)
            assert r.status_code == 200
            assert r.json()["columns_count"] == 5
            r2 = requests.get(f"{BASE_URL}/api/categories/display-settings", timeout=30)
            assert r2.json()["columns_count"] == 5
        finally:
            requests.put(f"{BASE_URL}/api/categories/display-settings",
                         json={"columns_count": original}, headers=admin_headers, timeout=30)

    def test_columns_count_clamped(self, admin_headers):
        before = requests.get(f"{BASE_URL}/api/categories/display-settings", timeout=30).json()
        original = before["columns_count"]
        try:
            r1 = requests.put(f"{BASE_URL}/api/categories/display-settings",
                              json={"columns_count": 99}, headers=admin_headers, timeout=30)
            assert r1.status_code == 200
            assert r1.json()["columns_count"] == 6, "should clamp upper to 6"

            r2 = requests.put(f"{BASE_URL}/api/categories/display-settings",
                              json={"columns_count": 1}, headers=admin_headers, timeout=30)
            assert r2.status_code == 200
            assert r2.json()["columns_count"] == 2, "should clamp lower to 2"
        finally:
            requests.put(f"{BASE_URL}/api/categories/display-settings",
                         json={"columns_count": original}, headers=admin_headers, timeout=30)

    def test_reorder_categories_persists_display_order(self, admin_headers):
        cats = requests.get(f"{BASE_URL}/api/categories", timeout=30).json()
        if len(cats) < 2:
            pytest.skip("Need at least 2 categories")
        original_ids = [c["id"] for c in cats]
        original_orders = {c["id"]: c.get("display_order", 9999) for c in cats}
        # Reverse the order
        reversed_ids = list(reversed(original_ids))
        try:
            r = requests.post(f"{BASE_URL}/api/categories/reorder",
                              json={"ordered_ids": reversed_ids, "columns_count": 4},
                              headers=admin_headers, timeout=30)
            assert r.status_code == 200, r.text
            # Verify GET returns sorted by display_order
            after = requests.get(f"{BASE_URL}/api/categories", timeout=30).json()
            after_ids = [c["id"] for c in after]
            assert after_ids == reversed_ids, f"Expected reversed order; got {after_ids}"
        finally:
            # Restore - reorder back to original
            requests.post(f"{BASE_URL}/api/categories/reorder",
                          json={"ordered_ids": original_ids}, headers=admin_headers, timeout=30)
            # Also re-set explicit orders for safety
            for cid, ord_val in original_orders.items():
                if ord_val != 9999:
                    requests.put(f"{BASE_URL}/api/categories/{cid}",
                                 json={"display_order": ord_val}, headers=admin_headers, timeout=30)

    def test_reorder_unauthorized_for_client(self, client_headers):
        r = requests.post(f"{BASE_URL}/api/categories/reorder",
                          json={"ordered_ids": []}, headers=client_headers, timeout=30)
        assert r.status_code == 403


# ==================== REGRESSION SMOKE ====================

class TestRegression:
    def test_returns_list_endpoint_loads(self, client_headers):
        r = requests.get(f"{BASE_URL}/api/returns", headers=client_headers, timeout=30)
        assert r.status_code == 200

    def test_telegram_diagnostics_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/telegram/diagnostics", headers=admin_headers, timeout=30)
        assert r.status_code == 200

    def test_user_balance_endpoint(self, client_headers):
        r = requests.get(f"{BASE_URL}/api/user/balance", headers=client_headers, timeout=30)
        assert r.status_code == 200
        assert "balance" in r.json()
