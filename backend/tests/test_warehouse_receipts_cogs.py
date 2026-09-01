"""Tests for warehouse receipts, reserve field in stock, and COGS report."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": "admin@avarus.ru", "password": "admin"})
    assert r.status_code == 200, r.text
    token = r.json().get("access_token") or r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def test_stock_has_reserved_and_available(admin_client):
    r = admin_client.get(f"{API}/admin/warehouse/stock")
    assert r.status_code == 200
    data = r.json()
    assert "summary" in data and "items" in data
    assert "total_reserved" in data["summary"]
    if data["items"]:
        it = data["items"][0]
        assert "reserved" in it and "available" in it
        assert it["available"] == it["stock"] - it["reserved"]


def test_cogs_report_shape(admin_client):
    r = admin_client.get(f"{API}/admin/warehouse/cogs-report",
                          params={"start": "2020-01-01T00:00:00+00:00",
                                  "end":   "2030-01-01T00:00:00+00:00"})
    assert r.status_code == 200
    d = r.json()
    for k in ("total_revenue", "total_cogs", "profit", "margin_percent", "products", "sales_count"):
        assert k in d


def test_receipts_list(admin_client):
    r = admin_client.get(f"{API}/admin/warehouse/receipts")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_receipt_increments_stock(admin_client):
    # find a product
    r = admin_client.get(f"{API}/admin/warehouse/stock")
    items = r.json()["items"]
    assert items, "no products"
    p = items[0]
    stock_before = p["stock"]
    pid = p["id"]

    payload = {
        "supplier": "TEST_supplier",
        "comment": "TEST auto pytest",
        "date": "2026-01-15T12:00:00+00:00",
        "items": [{"product_id": pid, "quantity": 3, "purchase_price": 111.5}],
    }
    r = admin_client.post(f"{API}/admin/warehouse/receipts", json=payload)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["number"].startswith("П-")
    assert doc["total_units"] == 3
    assert doc["positions"] == 1

    # verify stock increased
    r2 = admin_client.get(f"{API}/admin/warehouse/stock", params={"search": p.get("article") or p.get("name")})
    matches = [i for i in r2.json()["items"] if i["id"] == pid]
    assert matches
    assert matches[0]["stock"] == stock_before + 3
    assert matches[0]["purchase_price"] == 111.5

    # detail endpoint returns items
    r3 = admin_client.get(f"{API}/admin/warehouse/receipts/{doc['id']}")
    assert r3.status_code == 200
    detail = r3.json()
    assert detail["items"] and detail["items"][0]["product_id"] == pid


def test_bonus_program_hero_preset_persists(admin_client):
    r = admin_client.get(f"{API}/admin/bonus/programs")
    assert r.status_code == 200
    programs = r.json()
    if not programs:
        pytest.skip("no bonus programs")
    prog = programs[0]
    original = prog.get("hero_preset", "midnight")
    # set to ocean
    body = {**prog, "hero_preset": "ocean"}
    body.pop("_id", None)
    r2 = admin_client.put(f"{API}/admin/bonus/programs/{prog['id']}", json=body)
    assert r2.status_code == 200, r2.text
    # verify
    r3 = admin_client.get(f"{API}/admin/bonus/programs")
    updated = [p for p in r3.json() if p["id"] == prog["id"]][0]
    assert updated["hero_preset"] == "ocean"
    # restore
    body["hero_preset"] = original
    admin_client.put(f"{API}/admin/bonus/programs/{prog['id']}", json=body)
