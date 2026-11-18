"""Iter125: P0/P1 audit fixes (SEC-01/02/04, B01/B02, B06, B09, B13/B15, B16, B19, B22, B04/B05) + regression."""
import hashlib
import os
import secrets
import uuid
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
ORDER = {"full_name": "TEST Аудит", "address": "Москва, Тестовая 1", "phone": "+79991112233", "payment_method": "cash"}
DB = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _register(prefix="audit"):
    email = f"test_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", timeout=20,
                      json={"email": email, "password": "password123", "name": "TEST_Audit", "phone": "+70000000000"})
    assert r.status_code == 200, r.text
    return email, r.json()["token"], r.json()["user"]["id"]


@pytest.fixture(scope="module")
def world():
    admin = _auth(requests.post(f"{API}/auth/login", json={"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}, timeout=20).json()["token"])
    sfx = uuid.uuid4().hex[:8]
    email, tok, cid = _register("client")
    client = _auth(tok)
    pids = []
    for i in range(2):
        p = requests.post(f"{API}/products", headers=admin, timeout=20, json={
            "name": f"TEST_Audit Фильтр {i} {sfx}", "article": f"TEST-AU{i}-{sfx}", "manufacturer": "TEST_BRAND",
            "price": 1000, "purchase_price": 600, "min_price": 900, "stock": 20}).json()
        pids.append(p["id"])
    tid = requests.post(f"{API}/user/balance/topup", headers=client, json={"amount": 50000, "method": "card"}, timeout=20).json()["transaction_id"]
    assert requests.post(f"{API}/admin/balance-topups/{tid}/confirm", headers=admin, timeout=20).status_code == 200
    w = {"admin": admin, "client": client, "cid": cid, "email": email, "pid": pids[0], "pid2": pids[1], "orders": [], "users": [cid], "returns": []}
    yield w
    for oid in w["orders"]:
        DB.deferrals.delete_many({"order_id": oid})
        requests.delete(f"{API}/admin/orders/{oid}", headers=admin, timeout=20)
    for rid in w["returns"]:
        DB.returns.delete_one({"id": rid})
    for pid in pids:
        requests.delete(f"{API}/products/{pid}", headers=admin, timeout=20)
    for uid in w["users"]:
        requests.delete(f"{API}/admin/users/{uid}", headers=admin, timeout=20)


def _stock(pid):
    return requests.get(f"{API}/products/{pid}", timeout=20).json()["stock"]


def _balance(w):
    return requests.get(f"{API}/user/balance", headers=w["client"], timeout=20).json()["balance"]


def _order(w, items=None, headers=None, **extra):
    h = headers or w["client"]
    requests.delete(f"{API}/cart", headers=h, timeout=20)
    for pid, qty in (items or [(w["pid"], 1)]):
        r = requests.post(f"{API}/cart/add", headers=h, json={"product_id": pid, "quantity": qty}, timeout=20)
        assert r.status_code == 200, r.text
    r = requests.post(f"{API}/orders", headers=h, json={**ORDER, **extra}, timeout=30)
    assert r.status_code == 200, r.text
    w["orders"].append(r.json()["id"])
    return r.json()


def _admin_order(w, oid):
    return DB.orders.find_one({"id": oid}, {"_id": 0})


def _fulfil(w, oid, pairs):
    return requests.patch(f"{API}/admin/orders/{oid}/fulfill", headers=w["admin"], timeout=30,
                          json={"items": [{"product_id": p, "quantity_fulfilled": q} for p, q in pairs]})


# ---------- SEC-01 / SEC-04 auth ----------
class TestAuth:
    def test_injection_payloads_rejected(self):
        assert requests.post(f"{API}/auth/forgot-password", json={"email": {"$ne": None}}, timeout=20).status_code == 422
        assert requests.post(f"{API}/auth/reset-password", json={"token": {"$ne": None}, "password": "xxxxxxx"}, timeout=20).status_code == 422

    def test_forgot_unknown_email_generic(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": f"nobody_{uuid.uuid4().hex[:6]}@example.com"}, timeout=20)
        assert r.status_code == 200 and "Если email" in r.json()["message"]

    def test_bad_reset_token_400(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "x" * 40, "password": "newpass123"}, timeout=20)
        assert r.status_code == 400

    def test_profile_password_change_revokes_other_sessions(self, world):
        email, _, uid = _register("pw")
        world["users"].append(uid)
        a, b = requests.Session(), requests.Session()
        for s in (a, b):
            assert s.post(f"{API}/auth/login", json={"email": email, "password": "password123"}, timeout=20).status_code == 200
            assert "access_token" in s.cookies.get_dict()
        old_cookie = a.cookies.get("access_token")
        r = a.put(f"{API}/auth/profile", json={"current_password": "password123", "new_password": "newpass456"}, timeout=20)
        assert r.status_code == 200, r.text
        assert a.cookies.get("access_token") != old_cookie
        assert a.get(f"{API}/auth/me", timeout=20).status_code == 200  # current session stays
        assert b.get(f"{API}/auth/me", timeout=20).status_code == 401  # other session revoked
        stale = requests.get(f"{API}/auth/me", cookies={"access_token": old_cookie}, timeout=20)
        assert stale.status_code == 401
        assert requests.post(f"{API}/auth/login", json={"email": email, "password": "newpass456"}, timeout=20).status_code == 200

    def test_reset_password_flow_revokes_sessions(self, world):
        email, tok, uid = _register("reset")
        world["users"].append(uid)
        assert requests.get(f"{API}/auth/me", headers=_auth(tok), timeout=20).status_code == 200
        raw = secrets.token_urlsafe(32)
        DB.password_resets.update_one({"user_id": uid}, {"$set": {"user_id": uid, "token_hash": hashlib.sha256(raw.encode()).hexdigest(),
                                                                  "created_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
        r = requests.post(f"{API}/auth/reset-password", json={"token": raw, "password": "resetpass789"}, timeout=20)
        assert r.status_code == 200, r.text
        assert requests.get(f"{API}/auth/me", headers=_auth(tok), timeout=20).status_code == 401
        assert requests.post(f"{API}/auth/login", json={"email": email, "password": "resetpass789"}, timeout=20).status_code == 200
        assert requests.post(f"{API}/auth/reset-password", json={"token": raw, "password": "again12345"}, timeout=20).status_code == 400

    def test_normal_logins(self):
        for e, p in (("admin@avarus.ru", os.environ["TEST_ADMIN_PASSWORD"]), ("0x0errorr@gmail.com", "admin123"), ("user@demo.com", "demo123")):
            r = requests.post(f"{API}/auth/login", json={"email": e, "password": p}, timeout=20)
            assert r.status_code == 200, f"{e}: {r.status_code}"
            assert requests.get(f"{API}/auth/me", headers=_auth(r.json()["token"]), timeout=20).json()["email"] == e

    def test_manager_cabinet(self):
        r = requests.post(f"{API}/auth/login", json={"email": "test.manager@avarus.ru", "password": os.environ.get("TEST_MANAGER_PASSWORD", "Tm-O56Zj6qYd0X3")}, timeout=20)
        assert r.status_code == 200
        assert requests.get(f"{API}/manager/overview", headers=_auth(r.json()["token"]), timeout=20).status_code == 200
        assert requests.get(f"{API}/manager/clients", headers=_auth(r.json()["token"]), timeout=20).status_code == 200


# ---------- SEC-02 purchase_price hidden ----------
class TestPurchasePrice:
    def test_public_endpoints_hide_cost(self, world):
        pid = world["pid"]
        art = DB.products.find_one({"id": pid}, {"article": 1})["article"]
        one = requests.get(f"{API}/products/{pid}", timeout=20).json()
        assert not one.get("purchase_price") and one.get("min_price") == 900
        lst = requests.get(f"{API}/products", timeout=30).json()
        mine = [p for p in lst if p["id"] == pid]
        assert mine and not mine[0].get("purchase_price")
        assert all(not p.get("purchase_price") for p in lst)
        assert all(not p.get("purchase_price") for p in requests.get(f"{API}/products/popular", timeout=20).json())
        assert all(not p.get("purchase_price") for p in requests.get(f"{API}/products/{pid}/related", timeout=20).json())
        s = requests.get(f"{API}/products/search", params={"q": art}, timeout=20).json()
        assert any(p["id"] == pid for p in s["products"]) and all(not p.get("purchase_price") for p in s["products"])
        sa = requests.get(f"{API}/products/search-with-alternatives", params={"search": art}, timeout=20).json()
        assert all(not p.get("purchase_price") for p in sa["exact"] + sa["alternatives"])
        # client session too
        assert not requests.get(f"{API}/products/{pid}", headers=world["client"], timeout=20).json().get("purchase_price")

    def test_admin_sees_cost(self, world):
        art = DB.products.find_one({"id": world["pid"]}, {"article": 1})["article"]
        r = requests.get(f"{API}/admin/products", headers=world["admin"], params={"search": art}, timeout=20).json()
        items = r.get("items") or r.get("products") or r
        assert any(p["id"] == world["pid"] and p.get("purchase_price") == 600 for p in items)
        assert requests.get(f"{API}/admin/products", headers=world["client"], timeout=20).status_code == 403


# ---------- B01 cart qty ----------
class TestCart:
    @pytest.mark.parametrize("qty", [0, -3])
    def test_bad_quantity_rejected(self, world, qty):
        assert requests.post(f"{API}/cart/add", headers=world["client"], json={"product_id": world["pid"], "quantity": qty}, timeout=20).status_code == 422
        assert requests.post(f"{API}/cart/update", headers=world["client"], json={"product_id": world["pid"], "quantity": qty}, timeout=20).status_code == 422


# ---------- B06 stock double credit ----------
class TestStockRestore:
    def test_cancel_rollback_cancel_delete(self, world):
        pid, s0 = world["pid"], _stock(world["pid"])
        o = _order(world, [(pid, 2)])
        assert _stock(pid) == s0 - 2
        st = lambda: requests.put(f"{API}/admin/orders/{o['id']}/status", headers=world["admin"], params={"status": "cancelled"}, timeout=30)
        assert st().status_code == 200 and _stock(pid) == s0
        # iter126: rollback from cancelled is now blocked (400); a repeated cancel must not re-credit stock
        assert requests.put(f"{API}/admin/orders/{o['id']}/rollback-status", headers=world["admin"], timeout=20).status_code == 400
        st()
        assert _stock(pid) == s0
        assert requests.delete(f"{API}/admin/orders/{o['id']}", headers=world["admin"], timeout=20).status_code == 200
        world["orders"].remove(o["id"])
        assert _stock(pid) == s0

    def test_client_cancel_then_delete(self, world):
        pid, s0 = world["pid"], _stock(world["pid"])
        o = _order(world, [(pid, 3)])
        assert requests.post(f"{API}/orders/{o['id']}/cancel", headers=world["client"], timeout=30).status_code == 200
        assert _stock(pid) == s0
        requests.delete(f"{API}/admin/orders/{o['id']}", headers=world["admin"], timeout=20)
        world["orders"].remove(o["id"])
        assert _stock(pid) == s0


# ---------- B09 stock reconciliation on admin edit ----------
class TestAdminEditStock:
    def test_up_down_remove(self, world):
        p1, p2 = world["pid"], world["pid2"]
        s1, s2 = _stock(p1), _stock(p2)
        o = _order(world, [(p1, 2), (p2, 2)])
        assert _stock(p1) == s1 - 2 and _stock(p2) == s2 - 2
        items = _admin_order(world, o["id"])["items"]
        edit = lambda its: requests.put(f"{API}/admin/orders/{o['id']}", headers=world["admin"], json={"items": its}, timeout=30)
        up = [{**i, "quantity": 4} if i["product_id"] == p1 else i for i in items]
        r = edit(up); assert r.status_code == 200, r.text
        assert _stock(p1) == s1 - 4
        down = [{**i, "quantity": 1} if i["product_id"] == p1 else i for i in items]
        assert edit(down).status_code == 200 and _stock(p1) == s1 - 1
        removed = [i for i in down if i["product_id"] == p1]
        assert edit(removed).status_code == 200 and _stock(p2) == s2 and _stock(p1) == s1 - 1
        assert requests.post(f"{API}/orders/{o['id']}/cancel", headers=world["client"], timeout=30).status_code == 200
        assert _stock(p1) == s1 and _stock(p2) == s2


# ---------- B13/B15 returns ----------
class TestReturns:
    def test_return_capped_by_shipped_and_single_approve(self, world):
        pid = world["pid"]
        o = _order(world, [(pid, 3)])
        assert _fulfil(world, o["id"], [(pid, 1)]).json()["status"] == "partially_fulfilled"
        assert requests.put(f"{API}/admin/orders/{o['id']}/status", headers=world["admin"], params={"status": "completed"}, timeout=30).status_code == 200
        body = lambda q: {"type": "return", "order_id": o["id"], "items": [{"product_id": pid, "quantity": q}], "reason": "TEST", "photos": ["https://example.com/a.jpg", "https://example.com/b.jpg"]}
        post = lambda q: requests.post(f"{API}/returns", headers=world["client"], json=body(q), timeout=20)
        assert post(2).status_code == 400  # only 1 shipped
        assert post(-1).status_code == 400
        r0 = post(0)
        if r0.status_code == 200:
            world["returns"].append(r0.json().get("id"))
        assert r0.status_code == 400, "quantity 0 must be rejected (currently coerced to 1 via `or 1`)"

    def test_double_approve(self, world):
        pid = world["pid"]
        o = _order(world, [(pid, 1)])
        assert _fulfil(world, o["id"], [(pid, 1)]).json()["status"] == "completed"
        r = requests.post(f"{API}/returns", headers=world["client"], timeout=20, json={
            "type": "return", "order_id": o["id"], "items": [{"product_id": pid, "quantity": 1}], "reason": "TEST", "photos": ["https://example.com/a.jpg", "https://example.com/b.jpg"]})
        assert r.status_code == 200, r.text
        rid = r.json().get("id") or r.json().get("return", {}).get("id")
        world["returns"].append(rid)
        b0, s0 = _balance(world), _stock(pid)
        a1 = requests.put(f"{API}/admin/returns/{rid}/approve", headers=world["admin"], json={}, timeout=30)
        assert a1.status_code == 200, a1.text
        b1, s1 = _balance(world), _stock(pid)
        assert b1 > b0 and s1 == s0 + 1
        assert requests.put(f"{API}/admin/returns/{rid}/approve", headers=world["admin"], json={}, timeout=30).status_code == 400
        assert requests.put(f"{API}/admin/returns/{rid}/reject", headers=world["admin"], json={}, timeout=30).status_code == 400
        assert _balance(world) == b1 and _stock(pid) == s1


# ---------- B16 reward idempotency ----------
class TestReward:
    def test_double_fulfil_no_double_reward(self, world):
        pid = world["pid"]
        o = _order(world, [(pid, 2)])
        fields = {"_id": 0, "cashback_balance": 1, "bonus_points": 1, "bonus_balance": 1, "points": 1}
        assert _fulfil(world, o["id"], [(pid, 2)]).status_code == 200
        u1 = DB.users.find_one({"id": world["cid"]}, fields)
        base1 = _admin_order(world, o["id"]).get("reward_accrued_base")
        assert _fulfil(world, o["id"], [(pid, 2)]).status_code == 200
        assert DB.users.find_one({"id": world["cid"]}, fields) == u1
        assert _admin_order(world, o["id"]).get("reward_accrued_base") == base1


# ---------- B19 pay-additional ----------
class TestPayAdditional:
    def test_double_pay(self, world):
        pid = world["pid"]
        o = _order(world, [(pid, 1)], payment_method="card")
        items = _admin_order(world, o["id"])["items"]
        new_items = [{**i, "price": float(i["price"]) + 2000} for i in items]
        assert requests.put(f"{API}/admin/orders/{o['id']}", headers=world["admin"], json={"items": new_items}, timeout=30).status_code == 200
        r = requests.post(f"{API}/orders/{o['id']}/accept-changes", headers=world["client"], timeout=20)
        assert r.status_code == 200 and r.json()["action"] == "payment_required", r.text
        amount = r.json()["amount"]
        b0 = _balance(world)
        p1 = requests.post(f"{API}/orders/{o['id']}/pay-additional", headers=world["client"], json={"payment_method": "balance"}, timeout=20)
        assert p1.status_code == 200 and _balance(world) == round(b0 - amount, 2)
        p2 = requests.post(f"{API}/orders/{o['id']}/pay-additional", headers=world["client"], json={"payment_method": "balance"}, timeout=20)
        assert p2.status_code == 400 and "No additional payment" in p2.json()["detail"]
        assert _balance(world) == round(b0 - amount, 2)


# ---------- B22 deferral debt ----------
class TestDeferral:
    def _debt(self, w):
        return requests.get(f"{API}/credit/my", headers=w["client"], timeout=20).json()["debt"]

    def _setup(self, w):
        r = requests.put(f"{API}/admin/credit/{w['cid']}/set-limit", headers=w["admin"], json={"limit": 100000, "term_days": 30}, timeout=20)
        assert r.status_code == 200

    def test_cancel_releases_debt(self, world):
        self._setup(world)
        d0 = self._debt(world)
        o = _order(world, [(world["pid"], 1)], payment_method="deferral")
        assert round(self._debt(world) - d0, 2) == o["total"]
        assert requests.post(f"{API}/orders/{o['id']}/cancel", headers=world["client"], timeout=30).status_code == 200
        assert self._debt(world) == d0

    def test_admin_cancel_releases_debt(self, world):
        self._setup(world)
        d0 = self._debt(world)
        o = _order(world, [(world["pid"], 1)], payment_method="deferral")
        assert requests.put(f"{API}/admin/orders/{o['id']}/status", headers=world["admin"], params={"status": "cancelled"}, timeout=30).status_code == 200
        assert self._debt(world) == d0

    def test_partial_ship_then_cancel_keeps_shipped_debt(self, world):
        self._setup(world)
        d0 = self._debt(world)
        pid = world["pid"]
        o = _order(world, [(pid, 2)], payment_method="deferral")
        saved = _admin_order(world, o["id"])
        unit = float(saved["items"][0]["price"])
        delivery = float(saved.get("delivery_fee") or 0)
        assert _fulfil(world, o["id"], [(pid, 1)]).status_code == 200
        after_partial = round(self._debt(world) - d0, 2)
        assert abs(after_partial - (unit + delivery)) < 1, after_partial
        assert requests.post(f"{API}/orders/{o['id']}/cancel", headers=world["client"], timeout=30).status_code == 200
        assert abs(round(self._debt(world) - d0, 2) - after_partial) < 0.01, "cancel after partial shipment wiped the shipped debt"


# ---------- B04/B05 merge ----------
class TestMerge:
    def test_merge_active(self, world):
        p1, p2 = world["pid"], world["pid2"]
        a = _order(world, [(p1, 1)])
        b = _order(world, [(p1, 2), (p2, 1)])
        r = requests.post(f"{API}/admin/orders/merge", headers=world["admin"], json={"order_ids": [a["id"], b["id"]]}, timeout=30)
        assert r.status_code == 200, r.text
        m = r.json()["order"]
        world["orders"].append(m["id"])
        q = {i["product_id"]: i["quantity"] for i in m["items"]}
        assert q == {p1: 3, p2: 1} and m["total"] == round(a["total"] + b["total"], 2)
        assert set(m["merged_from"]) == {a["id"], b["id"]}
        mine = {o["id"] for o in requests.get(f"{API}/orders", headers=world["client"], timeout=20).json()}
        assert m["id"] in mine and a["id"] not in mine and b["id"] not in mine
        for x in (a, b):
            world["orders"].remove(x["id"])
        s1 = _stock(p1)
        assert requests.post(f"{API}/orders/{m['id']}/cancel", headers=world["client"], timeout=30).status_code == 200
        assert _stock(p1) == s1 + 3

    def test_merge_cancelled_blocked(self, world):
        a = _order(world)
        b = _order(world)
        requests.post(f"{API}/orders/{a['id']}/cancel", headers=world["client"], timeout=30)
        assert requests.post(f"{API}/admin/orders/merge", headers=world["admin"], json={"order_ids": [a["id"], b["id"]]}, timeout=30).status_code == 400

    def test_merge_inflight_card_blocked(self, world):
        a = _order(world, payment_method="card")
        b = _order(world)
        assert requests.post(f"{API}/orders/{a['id']}/card/issue-requisites", headers=world["admin"], json={"card_number": "2200 0000 0000 0001"}, timeout=20).status_code == 200
        assert requests.post(f"{API}/admin/orders/merge", headers=world["admin"], json={"order_ids": [a["id"], b["id"]]}, timeout=30).status_code == 400


# ---------- Regression: balance checkout + cancel refund ----------
class TestRegression:
    def test_balance_checkout_cancel_refund(self, world):
        b0 = _balance(world)
        o = _order(world, [(world["pid"], 1)], payment_method="balance", pay_with_balance=True)
        assert _balance(world) == round(b0 - o["total"], 2)
        r = requests.post(f"{API}/orders/{o['id']}/cancel", headers=world["client"], timeout=30)
        assert r.status_code == 200 and r.json()["refund_amount"] == o["total"]
        assert _balance(world) == b0

    def test_partial_fulfil_refund(self, world):
        b0 = _balance(world)
        o = _order(world, [(world["pid"], 2)], payment_method="balance", pay_with_balance=True)
        r = _fulfil(world, o["id"], [(world["pid"], 1)])
        assert r.status_code == 200 and r.json()["refunded"] > 0
        assert _balance(world) == round(b0 - o["total"] + r.json()["refunded"], 2)


# ---------- Pre-existing: admin item edit drops delivery fee from total ----------
class TestAdminEditTotal:
    def test_edit_keeps_delivery_fee(self, world):
        o = _order(world, [(world["pid"], 1)])
        saved = _admin_order(world, o["id"])
        fee = float(saved.get("delivery_fee") or 0)
        if fee <= 0:
            pytest.skip("no delivery fee on this order")
        items = saved["items"]
        r = requests.put(f"{API}/admin/orders/{o['id']}", headers=world["admin"], json={"items": [{**i, "price": float(i["price"]) + 100} for i in items]}, timeout=30)
        assert r.status_code == 200
        expected = round(sum((float(i["price"]) + 100) * i["quantity"] for i in items) + fee, 2)
        assert r.json()["total"] == expected, f"total {r.json()['total']} lost delivery fee {fee} (expected {expected})"


# ---------- Rollback of a cancelled order must re-reserve stock before it can be shipped ----------
class TestRollbackThenShip:
    def test_rollback_then_fulfil_takes_stock(self, world):
        pid, s0 = world["pid"], _stock(world["pid"])
        o = _order(world, [(pid, 2)])
        requests.put(f"{API}/admin/orders/{o['id']}/status", headers=world["admin"], params={"status": "cancelled"}, timeout=30)
        assert _stock(pid) == s0
        # iter126: fixed by blocking rollback from cancelled entirely
        r = requests.put(f"{API}/admin/orders/{o['id']}/rollback-status", headers=world["admin"], timeout=20)
        assert r.status_code == 400 and r.json()["detail"] == "Невозможно откатить этот статус"
        assert _admin_order(world, o["id"])["status"] == "cancelled" and _stock(pid) == s0
