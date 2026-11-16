"""Warehouse logic: stock lives on warehouses, selling only from stock, min stock, inventory, reconcile, cancel."""
import os
import uuid

import pytest
import requests

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin():
    return _login("admin@avarus.ru", os.environ["TEST_ADMIN_PASSWORD"])


@pytest.fixture(scope="module")
def client():
    return _login("user@demo.com", os.environ["TEST_CLIENT_PASSWORD"])


@pytest.fixture
def product(admin):
    r = requests.post(f"{API}/products", headers=admin, timeout=20,
                      json={"name": "TEST_WH_LOGIC", "article": f"TEST-WH-{uuid.uuid4().hex[:8]}", "price": 500, "stock": 7, "purchase_price": 100})
    pid = r.json()["id"]
    yield pid
    requests.delete(f"{API}/products/{pid}", headers=admin, timeout=20)


def _row(admin, pid):
    items = requests.get(f"{API}/admin/warehouse/stock", headers=admin, timeout=20).json()["items"]
    return next(i for i in items if i["id"] == pid)


def _on_warehouses(row):
    return sum(w["quantity"] for w in row["warehouses"])


def _movement_types(admin, pid):
    return [m["type"] for m in requests.get(f"{API}/admin/warehouse/movements", headers=admin, params={"product_id": pid}, timeout=20).json()]


def test_stock_from_product_card_is_booked_on_a_warehouse(admin, product):
    row = _row(admin, product)
    assert row["stock"] == 7 and _on_warehouses(row) == 7
    assert requests.put(f"{API}/products/{product}", headers=admin, json={"stock": 4}, timeout=20).status_code == 200
    row = _row(admin, product)
    assert row["stock"] == 4 and _on_warehouses(row) == 4
    assert _movement_types(admin, product).count("adjustment") == 2
    mismatches = requests.get(f"{API}/admin/warehouse/reconcile", headers=admin, timeout=20).json()
    assert product not in [m["product_id"] for m in mismatches["items"]]


def test_min_stock_per_product(admin, product):
    assert _row(admin, product)["is_low"] is False  # 7 > default
    r = requests.put(f"{API}/admin/warehouse/min-stock", headers=admin, json={"product_ids": [product], "min_stock": 10}, timeout=20)
    assert r.status_code == 200
    row = _row(admin, product)
    assert row["is_low"] is True and row["threshold"] == 10
    low_before = requests.get(f"{API}/admin/attention", headers=admin, timeout=20).json()["low_stock"]
    requests.put(f"{API}/admin/warehouse/min-stock", headers=admin, json={"product_ids": [product], "min_stock": 0}, timeout=20)
    assert _row(admin, product)["is_low"] is False  # 0 = not tracked
    assert requests.get(f"{API}/admin/attention", headers=admin, timeout=20).json()["low_stock"] == low_before - 1
    assert requests.put(f"{API}/admin/warehouse/min-stock", headers=admin, json={"product_ids": [product], "min_stock": -1}, timeout=20).status_code == 400


def test_inventory_books_surplus_and_shortage(admin, product, warehouse_id):
    r = requests.post(f"{API}/admin/warehouse/inventory", headers=admin, timeout=20,
                      json={"warehouse_id": warehouse_id, "comment": "TEST_inventory", "items": [{"product_id": product, "actual": 9}]})
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["number"].startswith("И-") and doc["surplus"] == 2 and doc["shortage"] == 0
    assert doc["items"][0] == {**doc["items"][0], "expected": 7, "actual": 9, "diff": 2}
    assert _row(admin, product)["stock"] == 9
    r = requests.post(f"{API}/admin/warehouse/inventory", headers=admin, timeout=20,
                      json={"warehouse_id": warehouse_id, "comment": "TEST_inventory", "items": [{"product_id": product, "actual": 5}]})
    assert r.json()["shortage"] == 4
    assert _row(admin, product)["stock"] == 5
    assert "inventory" in _movement_types(admin, product)
    assert any(d["id"] == doc["id"] for d in requests.get(f"{API}/admin/warehouse/inventory", headers=admin, timeout=20).json())
    bad = requests.post(f"{API}/admin/warehouse/inventory", headers=admin, timeout=20, json={"warehouse_id": warehouse_id, "items": []})
    assert bad.status_code == 400


def test_cannot_sell_more_than_in_stock_and_cancel_returns_goods(admin, client, product):
    requests.delete(f"{API}/cart/{product}", headers=client, timeout=20)
    r = requests.post(f"{API}/cart/add", headers=client, json={"product_id": product, "quantity": 8}, timeout=20)
    assert r.status_code == 400 and "в наличии только 7" in r.json()["detail"]
    assert requests.post(f"{API}/cart/add", headers=client, json={"product_id": product, "quantity": 2}, timeout=20).status_code == 200
    assert requests.post(f"{API}/cart/update", headers=client, json={"product_id": product, "quantity": 8}, timeout=20).status_code == 400

    order = requests.post(f"{API}/orders", headers=client, timeout=30,
                          json={"full_name": "TEST", "address": "TEST addr", "phone": "+79990000000", "payment_method": "cash"})
    assert order.status_code == 200, order.text
    row = _row(admin, product)
    assert row["stock"] == 5 and _on_warehouses(row) == 5

    r = requests.put(f"{API}/admin/orders/{order.json()['id']}", headers=admin, json={"status": "cancelled"}, timeout=20)
    assert r.status_code == 200
    row = _row(admin, product)
    assert row["stock"] == 7 and _on_warehouses(row) == 7
    types = _movement_types(admin, product)
    assert "sale" in types and "cancel" in types


def test_transfer_is_logged(admin, product, warehouse_id):
    others = [w["id"] for w in requests.get(f"{API}/admin/warehouses", headers=admin, timeout=20).json() if w["id"] != warehouse_id]
    if not others:
        pytest.skip("only one warehouse")
    r = requests.post(f"{API}/admin/warehouse/transfer", headers=admin, timeout=20,
                      json={"product_id": product, "from_warehouse_id": warehouse_id, "to_warehouse_id": others[0], "quantity": 3})
    assert r.status_code == 200
    row = _row(admin, product)
    assert row["stock"] == 7 and len(row["warehouses"]) == 2
    assert "transfer" in _movement_types(admin, product)
