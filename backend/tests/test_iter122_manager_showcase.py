"""Manager showcase: prices a manager may see, client price, product page, selection to chat, tasks, repeat-order data."""
import os
import uuid

import pytest
import requests

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def world():
    """Temp manager (10%), temp client with 5% personal discount bound to him, temp product."""
    admin = _auth(requests.post(f"{API}/auth/login", json={"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}, timeout=20).json()["token"])
    sfx = uuid.uuid4().hex[:8]
    mgr = requests.post(f"{API}/admin/staff", headers=admin, timeout=20,
                        json={"name": "TEST_ShowcaseMgr", "email": f"test_mgr_{sfx}@example.com", "password": "mgrpass123", "commission_percent": 10}).json()
    reg = requests.post(f"{API}/auth/register", timeout=20,
                        json={"email": f"test_cl_{sfx}@example.com", "password": "password123", "name": "TEST_ShowcaseClient", "phone": "+70000000000"}).json()
    cid = reg["user"]["id"]
    assert requests.post(f"{API}/admin/staff/{mgr['id']}/clients", headers=admin, json={"user_id": cid}, timeout=20).status_code == 200
    requests.put(f"{API}/admin/users/{cid}", headers=admin, json={"individual_discount": 5}, timeout=20)
    prod = requests.post(f"{API}/products", headers=admin, timeout=20, json={
        "name": f"TEST_Showcase Фильтр масляный {sfx}", "article": f"TEST-SC-{sfx}", "manufacturer": "TEST_BRAND", "price": 1000, "purchase_price": 600,
        "min_price": 980, "stock": 5, "description": "TEST описание", "cross_articles": "X1, X2"}).json()
    manager = _auth(requests.post(f"{API}/auth/login", json={"email": f"test_mgr_{sfx}@example.com", "password": "mgrpass123"}, timeout=20).json()["token"])
    yield {"admin": admin, "manager": manager, "client": _auth(reg["token"]), "cid": cid, "pid": prod["id"], "sfx": sfx}
    requests.delete(f"{API}/products/{prod['id']}", headers=admin, timeout=20)
    requests.delete(f"{API}/admin/users/{cid}", headers=admin, timeout=20)
    requests.delete(f"{API}/admin/staff/{mgr['id']}", headers=admin, timeout=20)


def _find(world, **params):
    r = requests.get(f"{API}/manager/products", headers=world["manager"], params=params, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def test_showcase_shows_commission_and_min_price_but_never_purchase_price(world):
    p = next(x for x in _find(world, search=f"фильтр {world['sfx']}") if x["id"] == world["pid"])  # two words, any order
    assert p["commission"] == 40.0 and p["min_price"] == 980
    assert "purchase_price" not in p and "client_price" not in p
    assert requests.get(f"{API}/manager/products", headers=world["client"], timeout=20).status_code == 403


def test_client_price_uses_personal_discount_and_floor(world):
    p = next(x for x in _find(world, search=world["sfx"], client_id=world["cid"]) if x["id"] == world["pid"])
    assert p["client_price"] == 980  # 1000 - 5% = 950, but not below the minimum price 980
    assert requests.get(f"{API}/manager/products", headers=world["manager"], params={"client_id": "someone-else"}, timeout=20).status_code == 404


def test_sorting_and_filters(world):
    prices = [x["price"] for x in _find(world, sort="price_desc")]
    assert prices == sorted(prices, reverse=True)
    commissions = [x["commission"] for x in _find(world, sort="commission")]
    assert commissions == sorted(commissions, reverse=True)
    assert all(x["manufacturer"] == "TEST_BRAND" for x in _find(world, manufacturer="TEST_BRAND"))
    assert all(x["stock"] > 0 for x in _find(world, in_stock=True))
    f = requests.get(f"{API}/manager/products/filters", headers=world["manager"], timeout=20).json()
    assert "TEST_BRAND" in f["manufacturers"] and isinstance(f["categories"], list)
    assert [x["id"] for x in _find(world, ids=world["pid"])] == [world["pid"]]


def test_product_page(world):
    r = requests.get(f"{API}/manager/products/{world['pid']}", headers=world["manager"], timeout=20)
    assert r.status_code == 200
    p = r.json()
    assert p["description"] == "TEST описание" and "purchase_price" not in p
    assert sum(w["quantity"] for w in p["warehouses"]) == 5
    assert requests.get(f"{API}/manager/products/nope", headers=world["manager"], timeout=20).status_code == 404


def test_selection_goes_to_client_chat(world):
    r = requests.post(f"{API}/manager/clients/{world['cid']}/selection", headers=world["manager"], timeout=20,
                      json={"items": [{"product_id": world["pid"], "quantity": 2}], "note": "TEST note"})
    assert r.status_code == 200, r.text
    assert r.json() == {"sent": 1, "total": 1960.0}
    chats = requests.get(f"{API}/manager/chats", headers=world["manager"], timeout=20).json()
    chat = next(c for c in chats if c["user_id"] == world["cid"])
    assert "Подборка для вас" in chat["last_text"]


def test_tasks_crud_and_overdue(world):
    m = world["manager"]
    t = requests.post(f"{API}/manager/tasks", headers=m, json={"text": "TEST перезвонить", "due_date": "2020-01-01", "client_id": world["cid"]}, timeout=20).json()
    listed = next(x for x in requests.get(f"{API}/manager/tasks", headers=m, timeout=20).json() if x["id"] == t["id"])
    assert listed["overdue"] is True and listed["client_name"] == "TEST_ShowcaseClient"
    assert requests.put(f"{API}/manager/tasks/{t['id']}", headers=m, json={"text": "TEST перезвонить", "due_date": "2020-01-01", "done": True}, timeout=20).status_code == 200
    listed = next(x for x in requests.get(f"{API}/manager/tasks", headers=m, timeout=20).json() if x["id"] == t["id"])
    assert listed["done"] is True and listed["overdue"] is False
    assert requests.delete(f"{API}/manager/tasks/{t['id']}", headers=m, timeout=20).status_code == 200
    assert requests.delete(f"{API}/manager/tasks/{t['id']}", headers=m, timeout=20).status_code == 404
    assert requests.get(f"{API}/manager/tasks", headers=world["client"], timeout=20).status_code == 403


def test_orders_carry_product_ids_for_repeat(world):
    r = requests.post(f"{API}/manager/clients/{world['cid']}/orders", headers=world["manager"], timeout=30,
                      json={"items": [{"product_id": world["pid"], "quantity": 1}], "payment_method": "cash", "address": "TEST addr", "phone": "+70000000000"})
    assert r.status_code == 200, r.text
    order = next(o for o in requests.get(f"{API}/manager/orders", headers=world["manager"], timeout=20).json() if o["id"] == r.json()["id"])
    assert order["items"][0]["product_id"] == world["pid"] and order["user_id"] == world["cid"]
