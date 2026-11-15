# Iteration 110: Admin orders show manager, manager cannot change conditions directly
# (only POST a request to the admin), monthly sales chart, and manager payout accounting.
import os
import time
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@avarus.ru", "password": "admin"}
DEMO_CLIENT = {"email": "user@demo.com", "password": "demo123"}
DEMO_MANAGER = {"email": "manager@avarus.ru", "password": "manager123"}


# -------- helpers --------

def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed for {creds['email']}: {r.status_code} {r.text[:200]}")
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['token']}"})
    return s, data


@pytest.fixture(scope="module")
def admin():
    s, _ = _login(ADMIN)
    return s


@pytest.fixture(scope="module")
def demo_client():
    s, _ = _login(DEMO_CLIENT)
    return s


@pytest.fixture(scope="module")
def demo_manager():
    s, _ = _login(DEMO_MANAGER)
    return s


@pytest.fixture(scope="module")
def saved_status_conditions(admin):
    before = admin.get(f"{API}/admin/status-conditions").json()
    yield before
    admin.put(f"{API}/admin/status-conditions", json={
        "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
        "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
        "manager": {"commission_percent": 0},
    })


@pytest.fixture(scope="module")
def tracked():
    data = {
        "manager_ids": [],
        "client_ids": [],
        "product_ids": [],
        "order_ids": [],
        "payout_ids": [],   # (manager_id, payout_id)
        "pending_requests_for_user": [],  # user_ids whose pending conditions requests we must reject
    }
    yield data
    a, _ = _login(ADMIN)
    # cancel orders first (so stock is restored)
    for oid in data["order_ids"]:
        try:
            a.post(f"{API}/orders/{oid}/cancel")
        except Exception:
            pass
    # reject any pending conditions-requests we created against demo client
    try:
        lst = a.get(f"{API}/admin/conditions-requests").json()
        for r in lst:
            if r.get("user_id") in data["pending_requests_for_user"] and r.get("status") == "pending":
                a.put(f"{API}/admin/conditions-requests/{r['id']}", json={
                    "action": "reject", "individual_discount": 0, "delivery_cost": None,
                    "deferral_days": 0, "credit_limit": 0, "response": "TEST cleanup",
                })
    except Exception:
        pass
    # restore demo client baseline (bound to demo manager, wholesale, 10% discount, 0 delivery)
    try:
        demo_mgr = next((m for m in a.get(f"{API}/admin/staff").json() if m["email"] == DEMO_MANAGER["email"]), None)
        demo_user = next((u for u in a.get(f"{API}/admin/users").json() if u["email"] == DEMO_CLIENT["email"]), None)
        if demo_mgr and demo_user:
            a.post(f"{API}/admin/staff/{demo_mgr['id']}/clients",
                   json={"user_id": demo_user["id"], "include_past_orders": False})
            a.put(f"{API}/admin/users/{demo_user['id']}", json={
                "individual_discount": 10, "delivery_cost": 0, "deferral_days": 14,
                "credit_limit": 50000, "customer_status": "wholesale",
            })
    except Exception:
        pass
    # payouts (soft cancel)
    for mid, pid in data["payout_ids"]:
        try:
            a.delete(f"{API}/admin/staff/{mid}/payouts/{pid}")
        except Exception:
            pass
    # products
    for pid in data["product_ids"]:
        try:
            a.delete(f"{API}/products/{pid}")
        except Exception:
            pass
    # managers (soft delete)
    for mid in data["manager_ids"]:
        try:
            a.delete(f"{API}/admin/staff/{mid}")
        except Exception:
            pass
    # clients
    for cid in data["client_ids"]:
        try:
            a.delete(f"{API}/admin/users/{cid}")
        except Exception:
            pass


def _register_client(suffix: str):
    email = f"test_{suffix}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "password123",
        "name": f"TEST_Client {suffix}", "phone": "+70000000000",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s, r.json()["user"], email, "password123"


def _create_manager(admin, name, commission=None):
    email = f"test_mgr_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": name, "email": email, "password": "mgrpass123"}
    if commission is not None:
        payload["commission_percent"] = commission
    r = admin.post(f"{API}/admin/staff", json=payload)
    assert r.status_code == 200, r.text
    return r.json(), email


def _create_product(admin, price=1000, purchase=600, stock=50):
    art = f"TEST_IT110_{uuid.uuid4().hex[:6]}"
    r = admin.post(f"{API}/products", json={
        "name": f"TEST_Prod {art}", "article": art, "manufacturer": "TEST",
        "price": price, "purchase_price": purchase, "stock": stock, "manual_available": True,
    })
    assert r.status_code in (200, 201), r.text
    return r.json()


def _place_order(client_session, product_id, qty=1):
    client_session.delete(f"{API}/cart")
    add = client_session.post(f"{API}/cart/add", json={"product_id": product_id, "quantity": qty})
    assert add.status_code == 200, add.text
    o = client_session.post(f"{API}/orders", json={
        "full_name": "TEST", "address": "TEST addr", "phone": "+70000000000", "payment_method": "cash",
    })
    assert o.status_code == 200, o.text
    return o.json()


# ==================== 1. MANAGER CANNOT DIRECTLY CHANGE CONDITIONS ====================

class TestManagerConditionsRequest:

    def test_old_direct_endpoint_gone(self, demo_manager):
        """PUT /manager/clients/{id}/conditions must be 404/405."""
        clients = demo_manager.get(f"{API}/manager/clients").json()
        own = next((c for c in clients if c.get("email") == DEMO_CLIENT["email"]), None)
        if not own:
            pytest.skip("demo manager has no demo client bound")
        r = demo_manager.put(f"{API}/manager/clients/{own['id']}/conditions", json={
            "individual_discount": 5, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0,
        })
        assert r.status_code in (404, 405)

    def test_request_foreign_client_404(self, demo_manager, tracked):
        _, cu, _, _ = _register_client("foreign")
        tracked["client_ids"].append(cu["id"])
        r = demo_manager.post(f"{API}/manager/clients/{cu['id']}/conditions-request", json={
            "individual_discount": 5, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0, "comment": "x",
        })
        assert r.status_code == 404

    def test_request_validation(self, demo_manager):
        clients = demo_manager.get(f"{API}/manager/clients").json()
        own = next((c for c in clients if c.get("email") == DEMO_CLIENT["email"]), None)
        if not own:
            pytest.skip("demo manager has no demo client bound")
        bad_discount = demo_manager.post(f"{API}/manager/clients/{own['id']}/conditions-request", json={
            "individual_discount": 150, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0,
        })
        assert bad_discount.status_code == 422
        bad_delivery = demo_manager.post(f"{API}/manager/clients/{own['id']}/conditions-request", json={
            "individual_discount": 5, "delivery_cost": -10, "deferral_days": 0, "credit_limit": 0,
        })
        assert bad_delivery.status_code == 422
        bad_credit = demo_manager.post(f"{API}/manager/clients/{own['id']}/conditions-request", json={
            "individual_discount": 5, "delivery_cost": None, "deferral_days": 0, "credit_limit": -100,
        })
        assert bad_credit.status_code == 422

    def test_full_flow_admin_approve_changes_conditions_not_status(self, admin, demo_manager, tracked):
        """Manager request → admin approves with his own values → client gets the ADMIN values
        but customer_status stays retail."""
        # 1) Create fresh client bound to demo manager
        cs, cu, cemail, cpass = _register_client("mgrreq")
        tracked["client_ids"].append(cu["id"])
        # bind to demo manager
        demo_mgr = next((m for m in admin.get(f"{API}/admin/staff").json() if m["email"] == DEMO_MANAGER["email"]), None)
        assert demo_mgr, "demo manager missing"
        b = admin.post(f"{API}/admin/staff/{demo_mgr['id']}/clients", json={"user_id": cu["id"], "include_past_orders": False})
        assert b.status_code == 200, b.text
        tracked["pending_requests_for_user"].append(cu["id"])

        # 2) Snapshot client's conditions BEFORE
        before = cs.get(f"{API}/my-conditions").json()
        assert before["customer_status"] == "retail"

        # 3) Manager sends request
        req = demo_manager.post(f"{API}/manager/clients/{cu['id']}/conditions-request", json={
            "individual_discount": 7, "delivery_cost": 0, "deferral_days": 5, "credit_limit": 5000,
            "comment": "TEST mgr req",
        })
        assert req.status_code == 200, req.text
        req_id = req.json()["id"]
        assert req.json()["manager_id"] == demo_mgr["id"]

        # 4) Second pending request for same client → 400
        req2 = demo_manager.post(f"{API}/manager/clients/{cu['id']}/conditions-request", json={
            "individual_discount": 8, "delivery_cost": 0, "deferral_days": 0, "credit_limit": 0, "comment": "dup",
        })
        assert req2.status_code == 400

        # 5) Conditions UNCHANGED until approval
        mid_check = cs.get(f"{API}/my-conditions").json()
        assert mid_check["customer_status"] == "retail"
        assert mid_check["discount"] == before["discount"]
        # pending_request shown to client is None (client's own only)
        assert mid_check.get("pending_request") is None

        # cart/preview uses unchanged conditions (no individual discount)
        prev = cs.post(f"{API}/cart/preview", json={"items": []})
        assert prev.status_code in (200, 400)  # empty cart may return 400; unchanged conditions
        if prev.status_code == 200:
            assert prev.json().get("discount_percent", 0) == before.get("discount", 0)

        # 6) Manager clients list shows pending_request
        mc = demo_manager.get(f"{API}/manager/clients").json()
        own = next(c for c in mc if c["id"] == cu["id"])
        assert own.get("pending_request") and own["pending_request"]["id"] == req_id

        # 7) Admin list includes manager_id / manager_name
        reqs = admin.get(f"{API}/admin/conditions-requests").json()
        row = next((r for r in reqs if r["id"] == req_id), None)
        assert row is not None
        assert row.get("manager_id") == demo_mgr["id"]
        assert row.get("manager_name") == demo_mgr["name"]

        # 8) Admin approves with HIS OWN (different) values
        dec = admin.put(f"{API}/admin/conditions-requests/{req_id}", json={
            "action": "approve",
            "individual_discount": 11,   # admin's own
            "delivery_cost": 0,
            "deferral_days": 3,
            "credit_limit": 2000,
        })
        assert dec.status_code == 200, dec.text

        # 9) Client gets admin's values, status still retail (manager-originated)
        cs2, _ = _login({"email": cemail, "password": cpass})
        after = cs2.get(f"{API}/my-conditions").json()
        assert after["customer_status"] == "retail", f"manager-originated request must NOT make wholesale. Got {after['customer_status']}"
        assert after["discount"] == 11
        assert after["credit_limit"] == 2000
        assert after["discount_individual"] is True

    def test_admin_rejects_manager_request_no_change(self, admin, demo_manager, tracked):
        cs, cu, cemail, cpass = _register_client("mgrrej")
        tracked["client_ids"].append(cu["id"])
        demo_mgr = next(m for m in admin.get(f"{API}/admin/staff").json() if m["email"] == DEMO_MANAGER["email"])
        admin.post(f"{API}/admin/staff/{demo_mgr['id']}/clients", json={"user_id": cu["id"]})
        tracked["pending_requests_for_user"].append(cu["id"])

        before = cs.get(f"{API}/my-conditions").json()
        req = demo_manager.post(f"{API}/manager/clients/{cu['id']}/conditions-request", json={
            "individual_discount": 20, "delivery_cost": None, "deferral_days": 10, "credit_limit": 9000,
        })
        assert req.status_code == 200, req.text
        rid = req.json()["id"]
        dec = admin.put(f"{API}/admin/conditions-requests/{rid}", json={
            "action": "reject", "individual_discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0,
        })
        assert dec.status_code == 200

        cs2, _ = _login({"email": cemail, "password": cpass})
        after = cs2.get(f"{API}/my-conditions").json()
        assert after["customer_status"] == before["customer_status"]
        assert after["discount"] == before["discount"]
        assert after["credit_limit"] == (before.get("credit_limit") or 0)

    def test_client_own_request_still_makes_wholesale(self, admin, tracked):
        cs, cu, cemail, cpass = _register_client("clientown")
        tracked["client_ids"].append(cu["id"])
        tracked["pending_requests_for_user"].append(cu["id"])
        r = cs.post(f"{API}/conditions-requests", json={"discount": 15, "deferral_days": 10, "credit_limit": 10000, "comment": "TEST"})
        assert r.status_code == 200
        rid = r.json()["id"]
        dec = admin.put(f"{API}/admin/conditions-requests/{rid}", json={
            "action": "approve", "individual_discount": 12, "delivery_cost": None, "deferral_days": 10, "credit_limit": 8000,
        })
        assert dec.status_code == 200
        cs2, _ = _login({"email": cemail, "password": cpass})
        mc = cs2.get(f"{API}/my-conditions").json()
        assert mc["customer_status"] == "wholesale"
        assert mc["discount"] == 12


# ==================== 2. MANAGER_NAME IN ADMIN ORDERS ====================

class TestAdminOrdersManagerName:
    def test_manager_name_on_bound_client_order(self, admin, tracked):
        # New manager + bound TEST_ client; product; order
        mgr, _ = _create_manager(admin, "TEST_OrdMgr")
        tracked["manager_ids"].append(mgr["id"])
        cs, cu, _, _ = _register_client("ordbound")
        tracked["client_ids"].append(cu["id"])
        admin.post(f"{API}/admin/staff/{mgr['id']}/clients", json={"user_id": cu["id"]})

        prod = _create_product(admin)
        tracked["product_ids"].append(prod["id"])

        order = _place_order(cs, prod["id"])
        tracked["order_ids"].append(order["id"])

        orders = admin.get(f"{API}/admin/orders").json()
        if isinstance(orders, dict):
            orders = orders.get("orders", orders.get("items", []))
        row = next((o for o in orders if o["id"] == order["id"]), None)
        assert row is not None, "order missing from admin list"
        assert row.get("manager_name") == mgr["name"]

    def test_no_manager_name_on_unbound_client_order(self, admin, tracked):
        cs, cu, _, _ = _register_client("ordunbound")
        tracked["client_ids"].append(cu["id"])
        prod = _create_product(admin)
        tracked["product_ids"].append(prod["id"])
        order = _place_order(cs, prod["id"])
        tracked["order_ids"].append(order["id"])
        orders = admin.get(f"{API}/admin/orders").json()
        if isinstance(orders, dict):
            orders = orders.get("orders", orders.get("items", []))
        row = next((o for o in orders if o["id"] == order["id"]), None)
        assert row is not None
        # manager_name must be falsy (None or empty)
        assert not row.get("manager_name")


# ==================== 3. PAYOUTS ====================

class TestPayouts:
    def test_payouts_full_flow(self, admin, saved_status_conditions, tracked):
        # standard manager commission 0 -> we rely on individual 10%
        admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 0},
        })
        mgr, _ = _create_manager(admin, "TEST_PayoutMgr", commission=10)
        tracked["manager_ids"].append(mgr["id"])
        # bind TEST_ client
        cs, cu, _, _ = _register_client("payout")
        tracked["client_ids"].append(cu["id"])
        admin.post(f"{API}/admin/staff/{mgr['id']}/clients", json={"user_id": cu["id"]})
        # product
        prod = _create_product(admin, price=1000, purchase=600, stock=20)
        tracked["product_ids"].append(prod["id"])
        order = _place_order(cs, prod["id"], qty=1)
        tracked["order_ids"].append(order["id"])
        time.sleep(0.5)

        # payouts summary
        ps = admin.get(f"{API}/admin/staff/{mgr['id']}/payouts").json()
        assert "earned" in ps and "paid" in ps and "balance" in ps and "payouts" in ps
        earned = ps["earned"]
        assert earned > 0, f"earned should be >0 after order with commission 10%: {ps}"
        assert ps["paid"] == 0
        assert abs(ps["balance"] - earned) < 0.01

        # Validation: amount <= 0
        bad = admin.post(f"{API}/admin/staff/{mgr['id']}/payouts", json={"amount": 0, "comment": "x"})
        assert bad.status_code == 422
        bad2 = admin.post(f"{API}/admin/staff/{mgr['id']}/payouts", json={"amount": -10, "comment": "x"})
        assert bad2.status_code == 422

        # bad date
        bad_date = admin.post(f"{API}/admin/staff/{mgr['id']}/payouts", json={
            "amount": 10, "paid_at": "not-a-date", "comment": "TEST",
        })
        assert bad_date.status_code == 400

        # unknown manager
        unk = admin.post(f"{API}/admin/staff/{uuid.uuid4().hex}/payouts", json={"amount": 10})
        assert unk.status_code == 404

        # Iter111: payout cannot exceed balance (earned=30 here)
        too_big = admin.post(f"{API}/admin/staff/{mgr['id']}/payouts", json={"amount": earned + 10, "comment": "TEST over"})
        assert too_big.status_code == 400
        assert "больше остатка" in too_big.json().get("detail", "")

        # successful create (within balance)
        today = date.today().isoformat()
        amt1 = 20.0
        add = admin.post(f"{API}/admin/staff/{mgr['id']}/payouts", json={
            "amount": amt1, "paid_at": today, "comment": "TEST payout 1",
        })
        assert add.status_code == 200, add.text
        pid = add.json()["id"]
        tracked["payout_ids"].append((mgr["id"], pid))

        # another without paid_at (defaults today) - small, still within balance
        amt2 = 5.0
        add2 = admin.post(f"{API}/admin/staff/{mgr['id']}/payouts", json={"amount": amt2, "comment": "TEST payout 2"})
        assert add2.status_code == 200
        pid2 = add2.json()["id"]
        tracked["payout_ids"].append((mgr["id"], pid2))

        paid_total = amt1 + amt2
        ps2 = admin.get(f"{API}/admin/staff/{mgr['id']}/payouts").json()
        assert abs(ps2["paid"] - paid_total) < 0.01
        assert abs(ps2["balance"] - (earned - paid_total)) < 0.01
        assert any(p["id"] == pid for p in ps2["payouts"])

        # /admin/staff row payouts
        staff = admin.get(f"{API}/admin/staff").json()
        row = next(r for r in staff if r["id"] == mgr["id"])
        assert "payouts" in row and abs(row["payouts"]["paid"] - paid_total) < 0.01

        # cancel payout
        d = admin.delete(f"{API}/admin/staff/{mgr['id']}/payouts/{pid}")
        assert d.status_code == 200
        ps3 = admin.get(f"{API}/admin/staff/{mgr['id']}/payouts").json()
        assert all(p["id"] != pid for p in ps3["payouts"])
        assert abs(ps3["paid"] - amt2) < 0.01
        # second cancel -> 404
        d2 = admin.delete(f"{API}/admin/staff/{mgr['id']}/payouts/{pid}")
        assert d2.status_code == 404

    def test_role_guards(self, admin, demo_client, demo_manager):
        # non-admin 403
        mgr_list = admin.get(f"{API}/admin/staff").json()
        any_mgr = mgr_list[0] if mgr_list else None
        if any_mgr:
            r = demo_client.get(f"{API}/admin/staff/{any_mgr['id']}/payouts")
            assert r.status_code == 403
            r2 = demo_manager.post(f"{API}/admin/staff/{any_mgr['id']}/payouts", json={"amount": 10})
            assert r2.status_code == 403
            r3 = demo_manager.delete(f"{API}/admin/staff/{any_mgr['id']}/payouts/{uuid.uuid4().hex}")
            assert r3.status_code == 403
        # manager summary endpoint
        rm = demo_manager.get(f"{API}/manager/payouts")
        assert rm.status_code == 200
        for k in ("earned", "paid", "balance"):
            assert k in rm.json()
        # admin/client cannot access manager payouts summary
        assert admin.get(f"{API}/manager/payouts").status_code == 403
        assert demo_client.get(f"{API}/manager/payouts").status_code == 403


# ==================== 4. SALES CHART ====================

class TestSalesChart:
    def test_default_12_months(self, admin):
        r = admin.get(f"{API}/admin/staff-chart")
        assert r.status_code == 200, r.text
        j = r.json()
        assert "managers" in j and "data" in j
        assert len(j["data"]) == 12
        # month format YYYY-MM
        for row in j["data"]:
            assert "month" in row and len(row["month"]) == 7 and row["month"][4] == "-"
        # ends with current month
        today = date.today()
        assert j["data"][-1]["month"] == f"{today.year:04d}-{today.month:02d}"

    def test_months_clamp(self, admin):
        r1 = admin.get(f"{API}/admin/staff-chart?months=0").json()
        assert len(r1["data"]) == 1
        r2 = admin.get(f"{API}/admin/staff-chart?months=100").json()
        assert len(r2["data"]) == 36
        r3 = admin.get(f"{API}/admin/staff-chart?months=6").json()
        assert len(r3["data"]) == 6

    def test_non_admin_403(self, demo_client, demo_manager):
        assert demo_client.get(f"{API}/admin/staff-chart").status_code == 403
        assert demo_manager.get(f"{API}/admin/staff-chart").status_code == 403

    def test_revenue_appears_for_manager(self, admin, tracked):
        mgr, _ = _create_manager(admin, "TEST_ChartMgr", commission=5)
        tracked["manager_ids"].append(mgr["id"])
        cs, cu, _, _ = _register_client("chart")
        tracked["client_ids"].append(cu["id"])
        admin.post(f"{API}/admin/staff/{mgr['id']}/clients", json={"user_id": cu["id"]})
        prod = _create_product(admin, price=500, purchase=200, stock=10)
        tracked["product_ids"].append(prod["id"])
        order = _place_order(cs, prod["id"], qty=1)
        tracked["order_ids"].append(order["id"])
        time.sleep(0.3)
        r = admin.get(f"{API}/admin/staff-chart?months=3").json()
        # Current month row should have value > 0 for this manager
        today = date.today()
        current_key = f"{today.year:04d}-{today.month:02d}"
        row = next(x for x in r["data"] if x["month"] == current_key)
        assert mgr["id"] in row, f"manager id not in month row keys: {list(row.keys())}"
        assert row[mgr["id"]] > 0, f"expected goods revenue >0 for new manager this month, got {row[mgr['id']]}"
        # manager is in managers list
        assert any(m["id"] == mgr["id"] for m in r["managers"])
