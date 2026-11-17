"""Paid orders: any cancellation returns the money to the balance once; partial shipment returns unshipped goods to stock and their paid part to the balance."""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
ORDER = {"full_name": "TEST Возврат", "address": "Москва, Тестовая 1", "phone": "+79991112233", "payment_method": "cash"}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def world():
    admin = _auth(requests.post(f"{API}/auth/login", json={"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}, timeout=20).json()["token"])
    sfx = uuid.uuid4().hex[:8]
    reg = requests.post(f"{API}/auth/register", timeout=20,
                        json={"email": f"test_refund_{sfx}@example.com", "password": "password123", "name": "TEST_RefundClient", "phone": "+70000000000"}).json()
    client, cid = _auth(reg["token"]), reg["user"]["id"]
    prod = requests.post(f"{API}/products", headers=admin, timeout=20, json={
        "name": f"TEST_Refund Фильтр {sfx}", "article": f"TEST-RF-{sfx}", "manufacturer": "TEST_BRAND", "price": 1000, "purchase_price": 600, "stock": 10}).json()
    tid = requests.post(f"{API}/user/balance/topup", headers=client, json={"amount": 20000, "method": "card"}, timeout=20).json()["transaction_id"]
    assert requests.post(f"{API}/admin/balance-topups/{tid}/confirm", headers=admin, timeout=20).status_code == 200
    yield {"admin": admin, "client": client, "cid": cid, "pid": prod["id"]}
    requests.delete(f"{API}/products/{prod['id']}", headers=admin, timeout=20)
    requests.delete(f"{API}/admin/users/{cid}", headers=admin, timeout=20)


def _balance(world):
    return requests.get(f"{API}/user/balance", headers=world["client"], timeout=20).json()["balance"]


def _stock(world):
    return requests.get(f"{API}/products/{world['pid']}", timeout=20).json()["stock"]


def _order(world, qty=1, **extra):
    requests.delete(f"{API}/cart/clear", headers=world["client"], timeout=20)
    assert requests.post(f"{API}/cart/add", headers=world["client"], json={"product_id": world["pid"], "quantity": qty}, timeout=20).status_code == 200
    r = requests.post(f"{API}/orders", headers=world["client"], json={**ORDER, **extra}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _saved(world, order_id):
    return next(o for o in requests.get(f"{API}/admin/orders", headers=world["admin"], timeout=30).json() if o["id"] == order_id)


def _fulfil(world, order_id, qty):
    return requests.patch(f"{API}/admin/orders/{order_id}/fulfill", headers=world["admin"], timeout=30,
                          json={"items": [{"product_id": world["pid"], "quantity_fulfilled": qty}]})


def test_unpaid_order_cancel_refunds_nothing(world):
    before = _balance(world)
    card = _order(world, payment_method="card")
    cash = _order(world)
    for o in (card, cash):
        r = requests.post(f"{API}/orders/{o['id']}/cancel", headers=world["client"], timeout=30)
        assert r.status_code == 200 and r.json()["refund_amount"] == 0
    assert _balance(world) == before


def test_confirmed_card_order_is_refunded_once_when_client_cancels(world):
    before, stock = _balance(world), _stock(world)
    order = _order(world, payment_method="card")
    oid = order["id"]
    assert requests.post(f"{API}/orders/{oid}/card/issue-requisites", headers=world["admin"], json={"card_number": "2200 0000 0000 0001"}, timeout=20).status_code == 200
    assert requests.post(f"{API}/orders/{oid}/card/confirm", headers=world["admin"], timeout=20).status_code == 200
    assert _balance(world) == before
    with ThreadPoolExecutor(3) as pool:
        res = list(pool.map(lambda _: requests.post(f"{API}/orders/{oid}/cancel", headers=world["client"], timeout=30), range(3)))
    ok = [r for r in res if r.status_code == 200]
    assert len(ok) == 1 and ok[0].json()["refund_amount"] == order["total"]
    assert _balance(world) == round(before + order["total"], 2) and _stock(world) == stock
    history = requests.get(f"{API}/user/balance/history", headers=world["client"], timeout=20).json()["transactions"]
    assert sum(1 for t in history if t.get("order_id") == oid and t["type"] == "refund" and t["amount"] == order["total"]) == 1


def test_balance_paid_order_is_refunded_once_when_admin_cancels(world):
    before = _balance(world)
    order = _order(world, payment_method="balance", pay_with_balance=True)
    assert _balance(world) == round(before - order["total"], 2)
    for _ in range(2):
        r = requests.put(f"{API}/admin/orders/{order['id']}/status", headers=world["admin"], params={"status": "cancelled"}, timeout=30)
        assert r.status_code == 200, r.text
    assert _balance(world) == before
    assert _saved(world, order["id"])["refunded_amount"] == order["total"]
    assert _fulfil(world, order["id"], 1).status_code == 400


def test_partial_shipment_returns_goods_and_money_and_takes_them_back(world):
    balance, stock = _balance(world), _stock(world)
    order = _order(world, qty=3, payment_method="balance", pay_with_balance=True)
    oid = order["id"]
    unit = round((order["total"] - (_saved(world, oid).get("delivery_fee") or 0)) / 3, 2)
    assert _stock(world) == stock - 3 and _balance(world) == round(balance - order["total"], 2)

    r = _fulfil(world, oid, 1)
    assert r.status_code == 200 and r.json()["status"] == "partially_fulfilled" and r.json()["refunded"] == round(unit * 2, 2)
    assert _stock(world) == stock - 1 and _balance(world) == round(balance - order["total"] + unit * 2, 2)
    assert _fulfil(world, oid, 1).json()["refunded"] == 0  # saving the same shipment again changes nothing
    assert _stock(world) == stock - 1
    extra = _order(world)
    assert requests.post(f"{API}/admin/orders/merge", headers=world["admin"], json={"order_ids": [oid, extra["id"]]}, timeout=20).status_code == 400
    assert requests.post(f"{API}/orders/{extra['id']}/cancel", headers=world["client"], timeout=30).status_code == 200

    r = _fulfil(world, oid, 2)  # one more unit is shipped later
    assert r.status_code == 200 and r.json()["refunded"] == -unit
    assert _stock(world) == stock - 2 and _balance(world) == round(balance - order["total"] + unit, 2)

    r = _fulfil(world, oid, 3)
    assert r.json()["status"] == "completed" and _stock(world) == stock - 3 and _balance(world) == round(balance - order["total"], 2)
    assert _saved(world, oid)["refunded_amount"] == 0


def test_cancel_after_partial_shipment_keeps_shipped_goods_paid(world):
    balance, stock = _balance(world), _stock(world)
    order = _order(world, qty=2, payment_method="balance", pay_with_balance=True)
    oid = order["id"]
    unit = round((order["total"] - (_saved(world, oid).get("delivery_fee") or 0)) / 2, 2)
    assert _fulfil(world, oid, 1).json()["refunded"] == unit
    after = _balance(world)
    r = requests.post(f"{API}/orders/{oid}/cancel", headers=world["client"], timeout=30)
    assert r.status_code == 200 and r.json()["refund_amount"] == 0
    assert _balance(world) == after == round(balance - order["total"] + unit, 2)
    assert _stock(world) == stock - 1


def test_top_up_shipment_fails_cleanly_when_goods_are_gone(world):
    stock = _stock(world)
    order = _order(world, qty=stock, payment_method="balance", pay_with_balance=True)
    oid = order["id"]
    assert _fulfil(world, oid, 1).status_code == 200 and _stock(world) == stock - 1
    other = _order(world, qty=stock - 1)  # somebody buys the released goods
    balance = _balance(world)
    r = _fulfil(world, oid, 2)
    assert r.status_code == 400 and "недостаточно" in r.json()["detail"]
    assert _balance(world) == balance and _stock(world) == 0
    assert _saved(world, oid)["items"][0]["quantity_fulfilled"] == 1
    requests.post(f"{API}/orders/{other['id']}/cancel", headers=world["client"], timeout=30)
