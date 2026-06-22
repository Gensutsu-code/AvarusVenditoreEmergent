"""Tests for Phase 2 admin product mass-edit endpoints (iteration 71)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-merge-fulfill.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    token = r.json().get("access_token") or r.json().get("token")
    assert token
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------- LIST / SEARCH / SORT ----------
class TestAdminListing:
    def test_admin_products_basic(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/products", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and "total" in data and "page" in data and "page_size" in data
        assert isinstance(data["items"], list)
        assert data["total"] >= 1

    def test_admin_products_requires_admin(self):
        # Without auth
        r = requests.get(f"{BASE_URL}/api/admin/products", timeout=20)
        assert r.status_code in (401, 403)

    def test_admin_products_search(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/products", headers=admin_headers, timeout=20)
        items = r.json()["items"]
        assert items, "No products in DB"
        # pick a manufacturer fragment from the first product
        mfr = (items[0].get("manufacturer") or "").strip()
        if mfr:
            frag = mfr[: max(2, min(4, len(mfr)))]
            r2 = requests.get(f"{BASE_URL}/api/admin/products", headers=admin_headers, params={"search": frag}, timeout=20)
            assert r2.status_code == 200
            d2 = r2.json()
            # All returned should match in some searchable field
            for p in d2["items"]:
                hay = " ".join([
                    str(p.get("name") or ""), str(p.get("article") or ""), str(p.get("manufacturer") or ""),
                    str(p.get("description") or ""), " ".join(p.get("cross_articles") or [])
                ]).lower()
                assert frag.lower() in hay

    def test_admin_products_sort_price(self, admin_headers):
        asc = requests.get(f"{BASE_URL}/api/admin/products", headers=admin_headers,
                           params={"sort_by": "price", "sort_order": "asc", "page_size": 50}, timeout=20).json()["items"]
        desc = requests.get(f"{BASE_URL}/api/admin/products", headers=admin_headers,
                            params={"sort_by": "price", "sort_order": "desc", "page_size": 50}, timeout=20).json()["items"]
        if len(asc) >= 2:
            prices_asc = [float(p["price"]) for p in asc]
            assert prices_asc == sorted(prices_asc)
        if len(desc) >= 2:
            prices_desc = [float(p["price"]) for p in desc]
            assert prices_desc == sorted(prices_desc, reverse=True)

    def test_admin_products_ids(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/products/ids", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "ids" in d and "total" in d
        assert isinstance(d["ids"], list)


# ---------- BULK OPS ----------
@pytest.fixture(scope="module")
def throwaway_product(admin_headers):
    # find a category id
    cats = requests.get(f"{BASE_URL}/api/categories", timeout=15).json()
    cat_id = cats[0]["id"] if cats else None
    payload = {
        "name": "TEST_MASS_EDIT_PRODUCT",
        "article": "TEST-ME-001",
        "manufacturer": "TESTBRAND",
        "description": "Throwaway product for mass edit tests",
        "price": 1000,
        "stock": 10,
        "category_id": cat_id,
        "images": [],
    }
    r = requests.post(f"{BASE_URL}/api/products", headers=admin_headers, json=payload, timeout=20)
    assert r.status_code in (200, 201), r.text
    p = r.json()
    yield p
    # cleanup if still exists
    try:
        requests.delete(f"{BASE_URL}/api/products/{p['id']}", headers=admin_headers, timeout=15)
    except Exception:
        pass


class TestBulkOps:
    def test_bulk_set_fields_toggle_original(self, admin_headers, throwaway_product):
        pid = throwaway_product["id"]
        # turn ON
        r = requests.post(f"{BASE_URL}/api/admin/products/bulk", headers=admin_headers, json={
            "product_ids": [pid], "action": "set_fields", "payload": {"is_original": True}
        }, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("modified_count", 0) >= 0
        time.sleep(0.3)
        got = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()
        assert got.get("is_original") is True
        # turn OFF
        r2 = requests.post(f"{BASE_URL}/api/admin/products/bulk", headers=admin_headers, json={
            "product_ids": [pid], "action": "set_fields", "payload": {"is_original": False}
        }, timeout=20)
        assert r2.status_code == 200
        got2 = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()
        assert got2.get("is_original") is False

    def test_bulk_set_stock(self, admin_headers, throwaway_product):
        pid = throwaway_product["id"]
        r = requests.post(f"{BASE_URL}/api/admin/products/bulk", headers=admin_headers, json={
            "product_ids": [pid], "action": "set_fields", "payload": {"stock": 50}
        }, timeout=20)
        assert r.status_code == 200
        got = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()
        assert int(got.get("stock", 0)) == 50
        # out of stock
        r2 = requests.post(f"{BASE_URL}/api/admin/products/bulk", headers=admin_headers, json={
            "product_ids": [pid], "action": "set_fields", "payload": {"stock": 0}
        }, timeout=20)
        assert r2.status_code == 200
        got2 = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()
        assert int(got2.get("stock", 0)) == 0
        # restore
        requests.post(f"{BASE_URL}/api/admin/products/bulk", headers=admin_headers, json={
            "product_ids": [pid], "action": "set_fields", "payload": {"stock": 10}
        }, timeout=20)

    def test_bulk_apply_and_clear_discount(self, admin_headers, throwaway_product):
        pid = throwaway_product["id"]
        # Apply: set_fields with discount_active + percent 15
        r = requests.post(f"{BASE_URL}/api/admin/products/bulk", headers=admin_headers, json={
            "product_ids": [pid], "action": "set_fields",
            "payload": {"discount_active": True, "discount_type": "percent", "discount_value": 15}
        }, timeout=20)
        assert r.status_code == 200, r.text
        got = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()
        assert got.get("discount_active") is True
        assert float(got.get("discount_value") or 0) == 15
        # Clear
        r2 = requests.post(f"{BASE_URL}/api/admin/products/bulk", headers=admin_headers, json={
            "product_ids": [pid], "action": "clear_discount", "payload": {}
        }, timeout=20)
        assert r2.status_code == 200
        got2 = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()
        assert got2.get("discount_active") is False

    def test_bulk_adjust_price_zero_noop(self, admin_headers, throwaway_product):
        pid = throwaway_product["id"]
        before = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()["price"]
        r = requests.post(f"{BASE_URL}/api/admin/products/bulk", headers=admin_headers, json={
            "product_ids": [pid], "action": "adjust_price",
            "payload": {"mode": "percent", "value": 0, "direction": "inc"}
        }, timeout=20)
        assert r.status_code == 200
        after = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()["price"]
        assert float(after) == float(before)

    def test_bulk_requires_product_ids(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/products/bulk", headers=admin_headers, json={
            "action": "set_fields", "payload": {"is_original": True}
        }, timeout=20)
        assert r.status_code == 400

    def test_bulk_unknown_action(self, admin_headers, throwaway_product):
        r = requests.post(f"{BASE_URL}/api/admin/products/bulk", headers=admin_headers, json={
            "product_ids": [throwaway_product["id"]], "action": "explode", "payload": {}
        }, timeout=20)
        assert r.status_code == 400

    def test_bulk_delete_throwaway(self, admin_headers, throwaway_product):
        pid = throwaway_product["id"]
        r = requests.post(f"{BASE_URL}/api/admin/products/bulk", headers=admin_headers, json={
            "product_ids": [pid], "action": "delete"
        }, timeout=20)
        assert r.status_code == 200
        assert r.json().get("modified_count", 0) >= 1
        # verify gone
        got = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15)
        assert got.status_code == 404
