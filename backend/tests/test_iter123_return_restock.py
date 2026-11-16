"""Approved return puts the goods back on the chosen warehouse (or nowhere when the admin says so)."""
import os
import uuid

import pytest
import requests

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture
def sold(_admin_headers):
    """Temp client with a completed order for 2 units of a temp product (stock 5 -> 3)."""
    a = _admin_headers
    sfx = uuid.uuid4().hex[:8]
    pid = requests.post(f"{API}/products", headers=a, timeout=20, json={"name": f"TEST_Return {sfx}", "article": f"TEST-RT-{sfx}", "price": 500, "purchase_price": 100, "stock": 5}).json()["id"]
    reg = requests.post(f"{API}/auth/register", timeout=20, json={"email": f"test_rt_{sfx}@example.com", "password": "password123", "name": "TEST_ReturnClient", "phone": "+70000000000"}).json()
    c = {"Authorization": f"Bearer {reg['token']}"}
    assert requests.post(f"{API}/cart/add", headers=c, json={"product_id": pid, "quantity": 2}, timeout=20).status_code == 200
    order = requests.post(f"{API}/orders", headers=c, timeout=30, json={"full_name": "TEST", "address": "TEST addr", "phone": "+70000000000", "payment_method": "cash"})
    assert order.status_code == 200, order.text
    oid = order.json()["id"]
    assert requests.put(f"{API}/admin/orders/{oid}", headers=a, json={"status": "completed"}, timeout=20).status_code == 200
    yield {"admin": a, "client": c, "pid": pid, "oid": oid}
    requests.delete(f"{API}/products/{pid}", headers=a, timeout=20)
    requests.delete(f"{API}/admin/users/{reg['user']['id']}", headers=a, timeout=20)


def _request_return(sold):
    r = requests.post(f"{API}/returns", headers=sold["client"], timeout=20,
                      json={"order_id": sold["oid"], "type": "return", "items": [{"product_id": sold["pid"], "quantity": 1}], "reason": "TEST", "photos": ["https://example.com/p.jpg"] * 3})
    if r.status_code != 200:
        pytest.skip(f"return cannot be created with current return settings: {r.text[:120]}")
    return r.json().get("id") or r.json().get("return", {}).get("id")


def _row(sold):
    items = requests.get(f"{API}/admin/warehouse/stock", headers=sold["admin"], timeout=20).json()["items"]
    return next(i for i in items if i["id"] == sold["pid"])


def test_return_goes_to_chosen_warehouse(sold, warehouse_id):
    others = [w for w in requests.get(f"{API}/admin/warehouses", headers=sold["admin"], timeout=20).json() if w["id"] != warehouse_id]
    target = others[0]["id"] if others else warehouse_id
    rid = _request_return(sold)
    r = requests.put(f"{API}/admin/returns/{rid}/approve", headers=sold["admin"], json={"comment": "", "restock": True, "warehouse_id": target}, timeout=20)
    assert r.status_code == 200, r.text
    row = _row(sold)
    assert row["stock"] == 4
    assert next(w["quantity"] for w in row["warehouses"] if w["warehouse_id"] == target) >= 1
    types = [m["type"] for m in requests.get(f"{API}/admin/warehouse/movements", headers=sold["admin"], params={"product_id": sold["pid"]}, timeout=20).json()]
    assert "return" in types
    ret = next(x for x in requests.get(f"{API}/admin/returns", headers=sold["admin"], timeout=20).json() if x["id"] == rid)
    assert ret["restocked"][0]["warehouse_id"] == target and ret["restocked"][0]["quantity"] == 1


def test_return_without_restock_keeps_stock(sold):
    rid = _request_return(sold)
    r = requests.put(f"{API}/admin/returns/{rid}/approve", headers=sold["admin"], json={"comment": "брак", "restock": False}, timeout=20)
    assert r.status_code == 200, r.text
    assert _row(sold)["stock"] == 3


def test_unknown_warehouse_rejected_before_anything_changes(sold):
    rid = _request_return(sold)
    r = requests.put(f"{API}/admin/returns/{rid}/approve", headers=sold["admin"], json={"restock": True, "warehouse_id": "nope"}, timeout=20)
    assert r.status_code == 404
    ret = next(x for x in requests.get(f"{API}/admin/returns", headers=sold["admin"], timeout=20).json() if x["id"] == rid)
    assert ret["status"] == "pending"
