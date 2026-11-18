"""Iter126: retest of the 4 iteration_124 failures (B22 partial-ship cancel debt, rollback-from-cancelled
blocked, return qty 0 rejected, admin edit keeps delivery_fee) + light regression on rollback/returns."""
import os
import uuid

import pytest
import requests
from pymongo import MongoClient

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
ORDER = {"full_name": "TEST Ретест", "address": "Москва, Тестовая 2", "phone": "+79991112244", "payment_method": "cash"}
DB = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
PHOTOS = ["https://example.com/a.jpg", "https://example.com/b.jpg"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def w():
    admin = _auth(requests.post(f"{API}/auth/login", json={"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}, timeout=20).json()["token"])
    sfx = uuid.uuid4().hex[:8]
    email = f"test_retest_{sfx}@example.com"
    r = requests.post(f"{API}/auth/register", timeout=20, json={"email": email, "password": "password123", "name": "TEST_Retest", "phone": "+70000000001"})
    assert r.status_code == 200, r.text
    client, cid = _auth(r.json()["token"]), r.json()["user"]["id"]
    p = requests.post(f"{API}/products", headers=admin, timeout=20, json={
        "name": f"TEST_Retest Фильтр {sfx}", "article": f"TEST-RT-{sfx}", "manufacturer": "TEST_BRAND",
        "price": 1000, "purchase_price": 600, "min_price": 500, "stock": 50}).json()
    tid = requests.post(f"{API}/user/balance/topup", headers=client, json={"amount": 50000, "method": "card"}, timeout=20).json()["transaction_id"]
    assert requests.post(f"{API}/admin/balance-topups/{tid}/confirm", headers=admin, timeout=20).status_code == 200
    assert requests.put(f"{API}/admin/credit/{cid}/set-limit", headers=admin, json={"limit": 100000, "term_days": 30}, timeout=20).status_code == 200
    st = {"admin": admin, "client": client, "cid": cid, "pid": p["id"], "orders": [], "returns": []}
    yield st
    for oid in st["orders"]:
        DB.deferrals.delete_many({"order_id": oid})
        requests.delete(f"{API}/admin/orders/{oid}", headers=admin, timeout=20)
    for rid in st["returns"]:
        DB.returns.delete_one({"id": rid})
    requests.delete(f"{API}/products/{p['id']}", headers=admin, timeout=20)
    requests.delete(f"{API}/admin/users/{cid}", headers=admin, timeout=20)


def _stock(w):
    return requests.get(f"{API}/products/{w['pid']}", timeout=20).json()["stock"]


def _debt(w):
    return requests.get(f"{API}/credit/my", headers=w["client"], timeout=20).json()["debt"]


def _order(w, qty=1, **extra):
    requests.delete(f"{API}/cart", headers=w["client"], timeout=20)
    assert requests.post(f"{API}/cart/add", headers=w["client"], json={"product_id": w["pid"], "quantity": qty}, timeout=20).status_code == 200
    r = requests.post(f"{API}/orders", headers=w["client"], json={**ORDER, **extra}, timeout=30)
    assert r.status_code == 200, r.text
    w["orders"].append(r.json()["id"])
    return DB.orders.find_one({"id": r.json()["id"]}, {"_id": 0})


def _fulfil(w, oid, q):
    return requests.patch(f"{API}/admin/orders/{oid}/fulfill", headers=w["admin"], timeout=30,
                          json={"items": [{"product_id": w["pid"], "quantity_fulfilled": q}]})


def _status(w, oid, s):
    return requests.put(f"{API}/admin/orders/{oid}/status", headers=w["admin"], params={"status": s}, timeout=30)


def _rollback(w, oid):
    return requests.put(f"{API}/admin/orders/{oid}/rollback-status", headers=w["admin"], timeout=20)


# ---------- RETEST #1: B22 deferral debt ----------
class TestDeferralDebt:
    @pytest.mark.parametrize("canceller", ["client", "admin"])
    def test_partial_ship_then_cancel_keeps_1500(self, w, canceller):
        d0 = _debt(w)
        o = _order(w, 2, payment_method="deferral")
        assert o["total"] == 2500 and float(o.get("delivery_fee") or 0) == 500, o["total"]
        assert round(_debt(w) - d0, 2) == 2500
        assert _fulfil(w, o["id"], 1).status_code == 200
        assert round(_debt(w) - d0, 2) == 1500
        if canceller == "client":
            r = requests.post(f"{API}/orders/{o['id']}/cancel", headers=w["client"], timeout=30)
        else:
            r = _status(w, o["id"], "cancelled")
        assert r.status_code == 200, r.text
        assert round(_debt(w) - d0, 2) == 1500, "cancel after partial ship wiped the shipped debt"
        d = DB.deferrals.find_one({"order_id": o["id"]}, {"_id": 0})
        assert d["status"] == "unpaid" and float(d["amount"]) == 1500

    def test_zero_shipped_full_cancel_releases_all(self, w):
        d0 = _debt(w)
        o = _order(w, 2, payment_method="deferral")
        assert round(_debt(w) - d0, 2) == 2500
        assert requests.post(f"{API}/orders/{o['id']}/cancel", headers=w["client"], timeout=30).status_code == 200
        assert _debt(w) == d0
        assert DB.deferrals.find_one({"order_id": o["id"]}, {"_id": 0})["status"] == "cancelled"


# ---------- RETEST #2: rollback from cancelled is blocked ----------
class TestRollback:
    def test_cancelled_rollback_blocked(self, w):
        s0 = _stock(w)
        o = _order(w, 2)
        assert _status(w, o["id"], "cancelled").status_code == 200 and _stock(w) == s0
        r = _rollback(w, o["id"])
        assert r.status_code == 400 and r.json()["detail"] == "Невозможно откатить этот статус"
        assert DB.orders.find_one({"id": o["id"]})["status"] == "cancelled"
        assert _stock(w) == s0

    def test_processing_to_pending_and_completed_to_processing(self, w):
        o = _order(w, 1)
        assert _status(w, o["id"], "processing").status_code == 200
        r = _rollback(w, o["id"])
        assert r.status_code == 200 and r.json()["status"] == "pending"
        assert DB.orders.find_one({"id": o["id"]})["status"] == "pending"
        assert _status(w, o["id"], "completed").status_code == 200
        r = _rollback(w, o["id"])
        assert r.status_code == 200 and r.json()["status"] == "processing"
        assert DB.orders.find_one({"id": o["id"]})["status"] == "processing"

    def test_pending_rollback_blocked(self, w):
        o = _order(w, 1)
        assert _rollback(w, o["id"]).status_code == 400


# ---------- RETEST #3: returns qty validation ----------
class TestReturnQty:
    def test_qty_zero_negative_rejected_positive_works(self, w):
        o = _order(w, 2)
        assert _fulfil(w, o["id"], 2).json()["status"] == "completed"
        body = lambda q: {"type": "return", "order_id": o["id"], "items": [{"product_id": w["pid"], "quantity": q}], "reason": "TEST", "photos": PHOTOS}
        post = lambda q: requests.post(f"{API}/returns", headers=w["client"], json=body(q), timeout=20)
        for bad in (0, -1):
            r = post(bad)
            if r.status_code == 200:
                w["returns"].append(r.json().get("id"))
            assert r.status_code == 400, f"qty {bad}: {r.status_code}"
        r = post(1)
        assert r.status_code == 200, r.text
        rid = r.json().get("id") or r.json().get("return", {}).get("id")
        w["returns"].append(rid)
        bal = lambda: requests.get(f"{API}/user/balance", headers=w["client"], timeout=20).json()["balance"]
        b0, s0 = bal(), _stock(w)
        assert requests.put(f"{API}/admin/returns/{rid}/approve", headers=w["admin"], json={}, timeout=30).status_code == 200
        b1 = bal()
        assert b1 > b0 and _stock(w) == s0 + 1
        assert requests.put(f"{API}/admin/returns/{rid}/approve", headers=w["admin"], json={}, timeout=30).status_code == 400
        assert bal() == b1

    def test_qty_non_numeric_not_500(self, w):
        o = _order(w, 1)
        _fulfil(w, o["id"], 1)
        r = requests.post(f"{API}/returns", headers=w["client"], timeout=20, json={
            "type": "return", "order_id": o["id"], "items": [{"product_id": w["pid"], "quantity": "abc"}], "reason": "TEST", "photos": PHOTOS})
        if r.status_code == 200:
            w["returns"].append(r.json().get("id"))
        assert r.status_code in (400, 422), f"non-numeric qty -> {r.status_code}"


# ---------- RETEST #4: admin edit keeps delivery fee ----------
class TestAdminEditTotal:
    def test_price_edit_keeps_delivery_and_surcharge(self, w):
        o = _order(w, 2, payment_method="card")  # card adds a % surcharge baked into item price
        unit, fee = float(o["items"][0]["price"]), float(o["delivery_fee"])
        assert fee == 500 and o["total"] == round(unit * 2 + fee, 2)
        items = [{**i, "price": unit + 50} for i in o["items"]]
        r = requests.put(f"{API}/admin/orders/{o['id']}", headers=w["admin"], json={"items": items}, timeout=30)
        assert r.status_code == 200, r.text
        exp = round((unit + 50) * 2 + fee, 2)
        assert r.json()["total"] == exp
        saved = DB.orders.find_one({"id": o["id"]}, {"_id": 0})
        assert saved["total"] == exp and saved.get("awaiting_confirmation") is True and saved.get("previous_total") == o["total"]
        a = requests.post(f"{API}/orders/{o['id']}/accept-changes", headers=w["client"], timeout=20)
        assert a.status_code == 200 and a.json()["action"] == "payment_required" and a.json()["amount"] == 100, a.text

    def test_qty_edit_keeps_delivery(self, w):
        o = _order(w, 2)
        unit = float(o["items"][0]["price"])
        items = [{**i, "quantity": 3} for i in o["items"]]
        r = requests.put(f"{API}/admin/orders/{o['id']}", headers=w["admin"], json={"items": items}, timeout=30)
        exp = round(unit * 3 + 500, 2)
        assert r.status_code == 200 and r.json()["total"] == exp, r.text
        assert DB.orders.find_one({"id": o["id"]})["total"] == exp
