"""
Phase 4 — Warehouse & Accounting (Склад и учёт) backend tests.
Covers:
- GET /api/admin/warehouse/stock
- POST /api/admin/warehouse/movement (receipt / writeoff / overflow guard)
- GET /api/admin/warehouse/movements (+ filter by type)
- GET /api/admin/finance (auto income from paid orders, auto expense from receipts)
- POST/DELETE /api/admin/finance/entry
- Order placement decrements stock AND logs a 'sale' movement
- Product purchase_price round-trip via PUT /api/admin/products/{id}
- Admin-only guards
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = os.environ["TEST_ADMIN_PASSWORD"]
CLIENT_EMAIL = "0x0errorr@gmail.com"
CLIENT_PASSWORD = os.environ["TEST_CLIENT2_PASSWORD"]


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN_EMAIL, ADMIN_PASSWORD)}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def client_headers():
    return {"Authorization": f"Bearer {_login(CLIENT_EMAIL, CLIENT_PASSWORD)}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_product(admin_headers):
    """Create a dedicated TEST product and return its id."""
    payload = {
        "name": "TEST_WH_Product",
        "article": f"TEST-WH-{int(time.time())}",
        "price": 1000,
        "purchase_price": 500,
        "stock": 0,
    }
    r = requests.post(f"{BASE_URL}/api/products", json=payload, headers=admin_headers)
    assert r.status_code in (200, 201), f"create product failed: {r.text}"
    pid = r.json()["id"]
    yield pid
    # Cleanup
    requests.delete(f"{BASE_URL}/api/products/{pid}", headers=admin_headers)


# ---------- Stock / Summary ----------

class TestStock:
    def test_stock_admin_only(self, client_headers):
        r = requests.get(f"{BASE_URL}/api/admin/warehouse/stock", headers=client_headers)
        assert r.status_code == 403

    def test_stock_response_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/warehouse/stock", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and "summary" in data
        s = data["summary"]
        for k in ("total_products", "total_units", "total_cost_value", "total_revenue_value",
                  "potential_profit", "low_stock_count", "low_stock_threshold"):
            assert k in s
        if data["items"]:
            it = data["items"][0]
            for k in ("id", "name", "stock", "purchase_price", "stock_cost_value", "margin", "is_low"):
                assert k in it


# ---------- Movements ----------

class TestMovements:
    def test_receipt_updates_stock_and_purchase_price(self, admin_headers, test_product):
        body = {"product_id": test_product, "type": "receipt", "quantity": 5,
                "purchase_price": 250, "supplier": "TEST_supplier"}
        r = requests.post(f"{BASE_URL}/api/admin/warehouse/movement", json=body, headers=admin_headers)
        assert r.status_code == 200, r.text
        mv = r.json()
        assert mv["type"] == "receipt"
        assert mv["quantity"] == 5
        assert mv["stock_before"] == 0
        assert mv["stock_after"] == 5
        assert mv["unit_cost"] == 250
        assert mv["total_cost"] == 1250.0

        # Verify product purchase_price updated
        prod = requests.get(f"{BASE_URL}/api/products/{test_product}").json()
        assert prod["stock"] == 5
        assert prod["purchase_price"] == 250

    def test_writeoff_decrements_stock(self, admin_headers, test_product):
        body = {"product_id": test_product, "type": "writeoff", "quantity": 2, "reason": "TEST_damaged"}
        r = requests.post(f"{BASE_URL}/api/admin/warehouse/movement", json=body, headers=admin_headers)
        assert r.status_code == 200, r.text
        mv = r.json()
        assert mv["type"] == "writeoff"
        assert mv["stock_before"] == 5
        assert mv["stock_after"] == 3

    def test_writeoff_overflow_blocked(self, admin_headers, test_product):
        body = {"product_id": test_product, "type": "writeoff", "quantity": 9999}
        r = requests.post(f"{BASE_URL}/api/admin/warehouse/movement", json=body, headers=admin_headers)
        assert r.status_code == 400
        # stock unchanged
        prod = requests.get(f"{BASE_URL}/api/products/{test_product}").json()
        assert prod["stock"] == 3

    def test_invalid_type_and_qty(self, admin_headers, test_product):
        r = requests.post(f"{BASE_URL}/api/admin/warehouse/movement", json={
            "product_id": test_product, "type": "garbage", "quantity": 1}, headers=admin_headers)
        assert r.status_code == 400
        r = requests.post(f"{BASE_URL}/api/admin/warehouse/movement", json={
            "product_id": test_product, "type": "receipt", "quantity": 0}, headers=admin_headers)
        assert r.status_code == 400

    def test_list_movements_with_filter(self, admin_headers, test_product):
        r = requests.get(f"{BASE_URL}/api/admin/warehouse/movements?product_id={test_product}",
                         headers=admin_headers)
        assert r.status_code == 200
        moves = r.json()
        assert isinstance(moves, list)
        types = {m["type"] for m in moves}
        assert "receipt" in types and "writeoff" in types

        r2 = requests.get(f"{BASE_URL}/api/admin/warehouse/movements?type=receipt&product_id={test_product}",
                          headers=admin_headers)
        assert r2.status_code == 200
        assert all(m["type"] == "receipt" for m in r2.json())


# ---------- Order -> sale movement integration ----------

class TestOrderSaleMovement:
    def test_order_decrements_stock_and_logs_sale(self, admin_headers, client_headers, test_product):
        # Ensure stock available (currently 3)
        # Seed cart for client
        # Clear cart first
        requests.delete(f"{BASE_URL}/api/cart", headers=client_headers)
        r = requests.post(f"{BASE_URL}/api/cart/add",
                          json={"product_id": test_product, "quantity": 1},
                          headers=client_headers)
        assert r.status_code == 200, r.text

        # Stock before
        prod_before = requests.get(f"{BASE_URL}/api/products/{test_product}").json()
        stock_before = prod_before["stock"]

        # Place order (cash so no balance/payment magic)
        order_payload = {
            "full_name": "TEST WH Buyer",
            "address": "TEST Address",
            "phone": "+70000000000",
            "payment_method": "cash",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=order_payload, headers=client_headers)
        assert r.status_code == 200, r.text
        order = r.json()
        order_id = order["id"]

        # Stock after
        prod_after = requests.get(f"{BASE_URL}/api/products/{test_product}").json()
        assert prod_after["stock"] == stock_before - 1, f"{prod_after['stock']} vs {stock_before}-1"

        # Sale movement logged
        r = requests.get(f"{BASE_URL}/api/admin/warehouse/movements?type=sale&product_id={test_product}",
                         headers=admin_headers)
        assert r.status_code == 200
        sales = r.json()
        assert len(sales) >= 1
        last = sales[0]
        assert last["type"] == "sale"
        assert last["quantity"] == 1
        assert last["stock_before"] == stock_before
        assert last["stock_after"] == stock_before - 1
        assert order_id[:8] in (last.get("comment") or "")


# ---------- Finance ----------

class TestFinance:
    def test_finance_summary_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/finance", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("period", "auto_income", "auto_expense", "manual_income", "manual_expense",
                  "total_income", "total_expense", "profit", "paid_orders_count", "receipts_count", "entries"):
            assert k in data
        # Auto expense should reflect prior receipt (1250 ₽) — non-zero
        assert data["auto_expense"] >= 1250

    def test_manual_entry_add_and_delete(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/finance/entry",
                          json={"type": "expense", "amount": 777.5, "category": "TEST_cat", "comment": "TEST"},
                          headers=admin_headers)
        assert r.status_code == 200, r.text
        entry = r.json()
        entry_id = entry["id"]
        assert entry["amount"] == 777.5
        assert entry["type"] == "expense"

        # Reflected in totals
        summary = requests.get(f"{BASE_URL}/api/admin/finance", headers=admin_headers).json()
        assert any(e["id"] == entry_id for e in summary["entries"])
        assert summary["manual_expense"] >= 777.5

        # Delete
        r = requests.delete(f"{BASE_URL}/api/admin/finance/entry/{entry_id}", headers=admin_headers)
        assert r.status_code == 200

        # Confirm removed
        summary2 = requests.get(f"{BASE_URL}/api/admin/finance", headers=admin_headers).json()
        assert all(e["id"] != entry_id for e in summary2["entries"])

    def test_invalid_finance_entry(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/finance/entry",
                          json={"type": "bogus", "amount": 10}, headers=admin_headers)
        assert r.status_code == 400
        r = requests.post(f"{BASE_URL}/api/admin/finance/entry",
                          json={"type": "income", "amount": 0}, headers=admin_headers)
        assert r.status_code == 400


# ---------- Product purchase_price round-trip ----------

class TestProductPurchasePrice:
    def test_update_purchase_price_persists(self, admin_headers, test_product):
        r = requests.put(f"{BASE_URL}/api/products/{test_product}",
                         json={"purchase_price": 333.33}, headers=admin_headers)
        assert r.status_code == 200, r.text
        prod = requests.get(f"{BASE_URL}/api/products/{test_product}").json()
        assert prod["purchase_price"] == 333.33

        # Reflected in warehouse stock listing
        stock = requests.get(f"{BASE_URL}/api/admin/warehouse/stock", headers=admin_headers).json()
        item = next((x for x in stock["items"] if x["id"] == test_product), None)
        assert item is not None
        assert item["purchase_price"] == 333.33


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
