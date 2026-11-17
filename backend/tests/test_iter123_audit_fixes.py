"""Audit fixes: money is credited only after admin confirmation, stock and cancellation are safe to repeat, closed endpoints stay closed."""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
ORDER = {"full_name": "TEST Аудит", "address": "Москва, Тестовая 1", "phone": "+79991112233", "delivery_method": "pickup", "payment_method": "cash"}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _client(sfx):
    reg = requests.post(f"{API}/auth/register", timeout=20,
                        json={"email": f"test_audit_{sfx}@example.com", "password": "password123", "name": "TEST_AuditClient", "phone": "+70000000000"}).json()
    return reg["user"]["id"], _auth(reg["token"])


@pytest.fixture(scope="module")
def world():
    admin = _auth(requests.post(f"{API}/auth/login", json={"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}, timeout=20).json()["token"])
    sfx = uuid.uuid4().hex[:8]
    (cid, client), (cid2, client2) = _client(sfx + "a"), _client(sfx + "b")
    prod = requests.post(f"{API}/products", headers=admin, timeout=20, json={
        "name": f"TEST_Audit Колодка {sfx}", "article": f"TEST-AU-{sfx}", "manufacturer": "TEST_BRAND", "price": 1000, "purchase_price": 600, "stock": 1}).json()
    yield {"admin": admin, "client": client, "client2": client2, "cid": cid, "cid2": cid2, "pid": prod["id"], "sfx": sfx}
    requests.delete(f"{API}/products/{prod['id']}", headers=admin, timeout=20)
    for uid in (cid, cid2):
        requests.delete(f"{API}/admin/users/{uid}", headers=admin, timeout=20)


def _balance(headers):
    return requests.get(f"{API}/user/balance", headers=headers, timeout=20).json()["balance"]


def _stock(world):
    return requests.get(f"{API}/products/{world['pid']}", timeout=20).json()["stock"]


def test_card_topup_is_a_request_until_admin_confirms(world):
    r = requests.post(f"{API}/user/balance/topup", headers=world["client"], json={"amount": 1000, "method": "card"}, timeout=20)
    assert r.status_code == 200, r.text
    tid = r.json()["transaction_id"]
    assert r.json()["status"] == "pending" and _balance(world["client"]) == 0

    base = f"{API}/admin/balance-topups"
    assert requests.get(base, headers=world["client"], timeout=20).status_code == 403
    assert requests.post(f"{base}/{tid}/confirm", headers=world["client"], timeout=20).status_code == 403
    assert any(t["id"] == tid and t["user_email"].startswith("test_audit_") for t in requests.get(base, headers=world["admin"], timeout=20).json())

    assert requests.post(f"{base}/{tid}/requisites", headers=world["admin"], json={}, timeout=20).status_code == 400
    assert requests.post(f"{base}/{tid}/requisites", headers=world["admin"], json={"card_number": "2200 0000 0000 0001", "bank": "TEST"}, timeout=20).status_code == 200
    mine = requests.get(f"{API}/user/balance/history", headers=world["client"], timeout=20).json()["transactions"]
    assert next(t for t in mine if t["id"] == tid)["requisites"]["card_number"] == "2200 0000 0000 0001"
    assert _balance(world["client"]) == 0

    with ThreadPoolExecutor(4) as pool:  # a double click credits once
        codes = list(pool.map(lambda _: requests.post(f"{base}/{tid}/confirm", headers=world["admin"], timeout=20).status_code, range(4)))
    assert codes.count(200) == 1 and _balance(world["client"]) == 1000


def test_rejected_and_crypto_topups_never_credit_by_themselves(world):
    before = _balance(world["client"])
    r = requests.post(f"{API}/user/balance/topup", headers=world["client"], json={"amount": 700, "method": "crypto", "crypto_chain": "bsc", "tx_hash": "0xdeadbeef"}, timeout=20)
    tid = r.json()["transaction_id"]
    assert r.json()["status"] == "pending"
    r = requests.post(f"{API}/user/balance/confirm-crypto", headers=world["client"], params={"transaction_id": tid, "tx_hash": "0xabc"}, timeout=20)
    assert r.status_code == 200 and r.json()["status"] == "pending"
    assert requests.post(f"{API}/user/balance/confirm-crypto", headers=world["client2"], params={"transaction_id": tid, "tx_hash": "0x1"}, timeout=20).status_code == 404
    assert requests.post(f"{API}/admin/balance-topups/{tid}/reject", headers=world["admin"], timeout=20).status_code == 200
    assert requests.post(f"{API}/admin/balance-topups/{tid}/confirm", headers=world["admin"], timeout=20).status_code == 404
    assert _balance(world["client"]) == before
    for bad in ({"amount": float("nan"), "method": "card"}, {"amount": -5, "method": "card"}, {"amount": 1000, "method": "gift"}):
        assert requests.post(f"{API}/user/balance/topup", headers=world["client"], data=__import__("json").dumps(bad), timeout=20).status_code in (400, 422)


def test_last_unit_is_sold_once_and_cancel_restocks_once(world):
    for c in ("client", "client2"):
        assert requests.post(f"{API}/cart/add", headers=world[c], json={"product_id": world["pid"], "quantity": 1}, timeout=20).status_code == 200
    with ThreadPoolExecutor(2) as pool:
        res = list(pool.map(lambda c: requests.post(f"{API}/orders", headers=world[c], json=ORDER, timeout=30), ("client", "client2")))
    assert sorted(r.status_code for r in res) == [200, 400], [r.text[:200] for r in res]
    assert _stock(world) == 0
    winner = "client" if res[0].status_code == 200 else "client2"
    order = next(r for r in res if r.status_code == 200).json()
    orders = requests.get(f"{API}/admin/orders", headers=world["admin"], timeout=30).json()
    saved = next(o for o in orders if o["id"] == order["id"])
    assert saved["stock_allocations"][0]["product_id"] == world["pid"]

    with ThreadPoolExecutor(3) as pool:
        codes = list(pool.map(lambda _: requests.post(f"{API}/orders/{order['id']}/cancel", headers=world[winner], timeout=30).status_code, range(3)))
    assert codes.count(200) == 1 and _stock(world) == 1


def test_card_requisites_only_by_hand(world):
    requests.delete(f"{API}/cart/clear", headers=world["client"], timeout=20)
    requests.post(f"{API}/cart/add", headers=world["client"], json={"product_id": world["pid"], "quantity": 1}, timeout=20)
    order = requests.post(f"{API}/orders", headers=world["client"], json={**ORDER, "payment_method": "card"}, timeout=30).json()
    assert order["card_status"] == "awaiting_requisites" and not order.get("card_requisites")
    # crypto hash can be attached only to one's own unpaid order
    body = {"order_id": order["id"], "chain": "bsc", "tx_hash": "0x1"}
    assert requests.post(f"{API}/payments/crypto/submit", headers=world["client2"], json=body, timeout=20).status_code == 404
    assert requests.post(f"{API}/orders/{order['id']}/cancel", headers=world["client"], timeout=20).status_code == 200


def test_closed_endpoints(world):
    assert requests.get(f"{API}/orders/check-expired", timeout=20).status_code in (401, 403)
    assert requests.get(f"{API}/orders/check-expired", headers=world["client"], timeout=20).status_code == 403
    assert requests.get(f"{API}/orders/check-expired", headers=world["admin"], timeout=20).status_code == 200
    hook = {"update_id": 1, "message": {"chat": {"id": 1}, "text": "/start"}}
    assert requests.post(f"{API}/telegram/chat-webhook", json=hook, timeout=20).status_code == 403
    assert requests.post(f"{API}/telegram/chat-webhook", json=hook, headers={"X-Telegram-Bot-Api-Secret-Token": "guess"}, timeout=20).status_code == 403
    files = {"file": ("x.svg", b"<svg onload='alert(1)'/>", "image/svg+xml")}
    assert requests.post(f"{API}/upload", headers=world["client"], files=files, timeout=20).status_code == 400


def test_search_text_is_not_a_regular_expression(world):
    for q in ("(((", "a++++++++++b", "[", "TEST-AU-.*"):
        for path, key in (("products", "search"), ("products/search", "q")):
            r = requests.get(f"{API}/{path}", params={key: q}, timeout=20)
            assert r.status_code == 200, (path, q, r.text[:100])
    found = requests.get(f"{API}/products", params={"search": f"TEST-AU-{world['sfx']}"}, timeout=20).json()
    assert [p["id"] for p in found] == [world["pid"]]
    assert requests.get(f"{API}/products", params={"limit": 100000}, timeout=20).status_code == 422


def test_passwords_are_not_kept_readable_and_login_is_limited(world):
    users = requests.get(f"{API}/admin/users", headers=world["admin"], timeout=30).json()
    users = users if isinstance(users, list) else users.get("users", [])
    me = next(u for u in users if u["id"] == world["cid"])
    assert not me.get("password_plain")
    email = f"nobody_{world['sfx']}@example.com"
    codes = [requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong"}, timeout=20).status_code for _ in range(12)]
    assert codes[:10] == [401] * 10 and codes[-1] == 429


def test_merge_keeps_money_and_stock_links(world):
    admin, client = world["admin"], world["client"]
    requests.put(f"{API}/products/{world['pid']}", headers=admin, json={"stock": 3}, timeout=20)
    if _stock(world) != 3:  # stock is kept per warehouse: top it up through a receipt-free movement
        pytest.skip("cannot set stock for the temp product through the product API")
    ids, totals = [], []
    for _ in range(2):
        requests.delete(f"{API}/cart/clear", headers=client, timeout=20)
        requests.post(f"{API}/cart/add", headers=client, json={"product_id": world["pid"], "quantity": 1}, timeout=20)
        r = requests.post(f"{API}/orders", headers=client, json=ORDER, timeout=30)
        assert r.status_code == 200, r.text
        ids.append(r.json()["id"])
        totals.append(r.json()["total"])
    before = _stock(world)
    r = requests.post(f"{API}/admin/orders/merge", headers=admin, json={"order_ids": ids}, timeout=30)
    assert r.status_code == 200, r.text
    merged = r.json()["order"]
    assert merged["total"] == round(sum(totals), 2)
    assert sum(a["quantity"] for e in merged["stock_allocations"] for a in e["allocations"]) == 2
    assert merged["items"][0]["quantity"] == 2 and _stock(world) == before
    assert requests.post(f"{API}/orders/{merged['id']}/cancel", headers=client, timeout=30).status_code == 200
    assert _stock(world) == before + 2
