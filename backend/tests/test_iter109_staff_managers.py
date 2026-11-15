# Iteration 109: Staff (managers) CRUD, status conditions, individual conditions,
# conditions requests, client binding, manager statistics and manager cabinet.
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@avarus.ru", "password": "admin"}
DEMO_CLIENT = {"email": "user@demo.com", "password": "demo123"}
DEMO_MANAGER = {"email": "manager@avarus.ru", "password": "manager123"}


# ---------- helpers ----------

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
    # restore
    admin.put(f"{API}/admin/status-conditions", json={
        "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
        "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
        "manager": {"commission_percent": 0},
    })


@pytest.fixture(scope="module")
def tracked():
    """Cleanup tracker."""
    data = {
        "manager_ids": [],   # TEST_ managers to hard-delete at the end
        "client_ids": [],    # TEST_ registered clients to hard-delete
        "product_ids": [],
        "order_ids": [],
        "request_ids": [],
        "chat_ids": [],
    }
    yield data
    a, _ = _login(ADMIN)
    # orders -> cancel (also restores stock)
    for oid in data["order_ids"]:
        try:
            a.post(f"{API}/orders/{oid}/cancel")
        except Exception:
            pass
    # products
    for pid in data["product_ids"]:
        try:
            a.delete(f"{API}/products/{pid}")
        except Exception:
            pass
    # delete TEST_ managers soft + hard-remove via mongo? Use admin delete endpoint (soft)
    for mid in data["manager_ids"]:
        try:
            a.delete(f"{API}/admin/staff/{mid}")
        except Exception:
            pass
    # delete TEST_ clients
    for cid in data["client_ids"]:
        try:
            a.delete(f"{API}/admin/users/{cid}")
        except Exception:
            pass
    # delete conditions requests (no admin delete endpoint; best effort left in DB)


def _register_test_client(name_suffix: str):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "password123"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": password,
        "name": f"TEST_Client {name_suffix}",
        "phone": "+70000000000",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s, r.json()["user"], email, password


# ==================== STATUS CONDITIONS ====================

class TestStatusConditions:
    def test_admin_get_put_roundtrip(self, admin, saved_status_conditions):
        payload = {
            "retail": {"discount": 5, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 12, "delivery_cost": 250, "deferral_days": 30, "credit_limit": 100000},
            "manager": {"commission_percent": 7},
        }
        r = admin.put(f"{API}/admin/status-conditions", json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["retail"]["discount"] == 5
        assert j["wholesale"]["deferral_days"] == 30
        assert j["manager"]["commission_percent"] == 7

        g = admin.get(f"{API}/admin/status-conditions").json()
        assert g["wholesale"]["credit_limit"] == 100000

    def test_put_validation_negative_discount(self, admin):
        r = admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": -1, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 0},
        })
        assert r.status_code == 422

    def test_put_validation_over_100(self, admin):
        r = admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 101, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 0},
        })
        assert r.status_code == 422

    def test_my_conditions_retail_picks_up_standard(self, admin, saved_status_conditions):
        # set retail standard discount 5
        admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 5, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 0},
        })
        s, user, email, _ = _register_test_client("retail-std")
        try:
            r = s.get(f"{API}/my-conditions")
            assert r.status_code == 200, r.text
            j = r.json()
            assert j["customer_status"] == "retail"
            assert j["discount"] == 5
            assert j["discount_individual"] is False
            # /auth/me reflects effective individual_discount
            me = s.get(f"{API}/auth/me").json()
            assert me["individual_discount"] == 5
        finally:
            a, _ = _login(ADMIN)
            a.delete(f"{API}/admin/users/{user['id']}")


# ==================== STAFF CRUD ====================

class TestStaffCRUD:
    def test_non_admin_cannot_list(self, demo_client):
        r = demo_client.get(f"{API}/admin/staff")
        assert r.status_code == 403

    def test_create_and_login(self, admin, tracked):
        email = f"test_mgr_{uuid.uuid4().hex[:6]}@example.com"
        r = admin.post(f"{API}/admin/staff", json={
            "name": "TEST_Manager Alpha",
            "email": email, "password": "mgrpass123", "phone": "+70001112233",
            "position": "Менеджер", "commission_percent": 8.5, "note": "TEST",
        })
        assert r.status_code == 200, r.text
        mgr = r.json()
        tracked["manager_ids"].append(mgr["id"])
        assert "password" not in mgr and "password_plain" not in mgr
        assert mgr["commission_percent"] == 8.5
        assert mgr["email"] == email

        # Login works and role=manager
        s = requests.Session()
        lr = s.post(f"{API}/auth/login", json={"email": email, "password": "mgrpass123"})
        assert lr.status_code == 200, lr.text
        user = lr.json()["user"]
        assert user["role"] == "manager"
        # Manager cannot access admin endpoints (role guard)
        s.headers.update({"Authorization": f"Bearer {lr.json()['token']}"})
        assert s.get(f"{API}/admin/staff").status_code == 403
        assert s.get(f"{API}/admin/orders").status_code == 403
        assert s.get(f"{API}/admin/conditions-requests").status_code == 403

    def test_duplicate_email_rejected(self, admin, tracked):
        # Existing client email
        r = admin.post(f"{API}/admin/staff", json={
            "name": "TEST_Dup", "email": DEMO_CLIENT["email"].upper(),
            "password": "abcdef", "commission_percent": 0,
        })
        assert r.status_code == 400

    def test_short_password_rejected(self, admin):
        r = admin.post(f"{API}/admin/staff", json={
            "name": "TEST_Short", "email": f"test_s_{uuid.uuid4().hex[:6]}@example.com",
            "password": "abc", "commission_percent": 0,
        })
        assert r.status_code == 422

    def test_bad_email_rejected(self, admin):
        r = admin.post(f"{API}/admin/staff", json={
            "name": "TEST_BadMail", "email": "notanemail", "password": "abcdef",
        })
        assert r.status_code == 400

    def test_update_change_password_and_block(self, admin, tracked):
        email = f"test_mgr2_{uuid.uuid4().hex[:6]}@example.com"
        r = admin.post(f"{API}/admin/staff", json={
            "name": "TEST_UPD", "email": email, "password": "oldpass1",
        })
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        tracked["manager_ids"].append(mid)

        # Edit: change name/commission, empty password keeps it
        u = admin.put(f"{API}/admin/staff/{mid}", json={
            "name": "TEST_UPD Renamed", "email": email, "password": "",
            "phone": "+71112223344", "position": "Старший", "commission_percent": 11, "blocked": False, "note": "",
        })
        assert u.status_code == 200, u.text
        assert u.json()["commission_percent"] == 11
        # Old pass still works
        assert requests.post(f"{API}/auth/login", json={"email": email, "password": "oldpass1"}).status_code == 200

        # New password
        admin.put(f"{API}/admin/staff/{mid}", json={
            "name": "TEST_UPD Renamed", "email": email, "password": "newpass2",
            "phone": "+71112223344", "position": "Старший", "commission_percent": 11, "blocked": False, "note": "",
        })
        assert requests.post(f"{API}/auth/login", json={"email": email, "password": "newpass2"}).status_code == 200
        assert requests.post(f"{API}/auth/login", json={"email": email, "password": "oldpass1"}).status_code == 401

        # Block → login blocked
        admin.put(f"{API}/admin/staff/{mid}", json={
            "name": "TEST_UPD Renamed", "email": email, "password": "",
            "phone": "", "position": "", "commission_percent": 11, "blocked": True, "note": "",
        })
        assert requests.post(f"{API}/auth/login", json={"email": email, "password": "newpass2"}).status_code == 401

    def test_soft_delete_hides_from_list(self, admin, tracked):
        email = f"test_mgr3_{uuid.uuid4().hex[:6]}@example.com"
        r = admin.post(f"{API}/admin/staff", json={
            "name": "TEST_DEL", "email": email, "password": "deleteme",
        })
        mid = r.json()["id"]
        d = admin.delete(f"{API}/admin/staff/{mid}")
        assert d.status_code == 200, d.text
        lst = admin.get(f"{API}/admin/staff").json()
        assert all(m["id"] != mid for m in lst)
        # Login blocked
        assert requests.post(f"{API}/auth/login", json={"email": email, "password": "deleteme"}).status_code == 401
        # Email reusable
        r2 = admin.post(f"{API}/admin/staff", json={"name": "TEST_DEL2", "email": email, "password": "reusepass"})
        assert r2.status_code == 200, r2.text
        tracked["manager_ids"].append(r2.json()["id"])

    def test_managers_excluded_from_admin_users(self, admin, tracked):
        email = f"test_mgr4_{uuid.uuid4().hex[:6]}@example.com"
        r = admin.post(f"{API}/admin/staff", json={"name": "TEST_ExcludeMe", "email": email, "password": "pass123"})
        mid = r.json()["id"]
        tracked["manager_ids"].append(mid)
        users_resp = admin.get(f"{API}/admin/users").json()
        users = users_resp if isinstance(users_resp, list) else users_resp.get("users", [])
        assert all(u["id"] != mid for u in users)


# ==================== ROLE GUARDS (manager side) ====================

class TestRoleGuards:
    def test_admin_cannot_access_manager_endpoints(self, admin):
        assert admin.get(f"{API}/manager/overview").status_code == 403
        assert admin.get(f"{API}/manager/clients").status_code == 403
        assert admin.get(f"{API}/manager/chats").status_code == 403

    def test_client_cannot_access_manager_endpoints(self, demo_client):
        assert demo_client.get(f"{API}/manager/overview").status_code == 403

    def test_invalid_period(self, demo_manager):
        r = demo_manager.get(f"{API}/manager/overview?period=foobar")
        assert r.status_code == 400


# ==================== CLIENT BINDING ====================

class TestBinding:
    def test_bind_unbind_search(self, admin, tracked):
        # create manager + client
        email = f"test_bind_mgr_{uuid.uuid4().hex[:6]}@example.com"
        mgr_resp = admin.post(f"{API}/admin/staff", json={"name": "TEST_BindMgr", "email": email, "password": "mgrpass1"})
        mid = mgr_resp.json()["id"]
        tracked["manager_ids"].append(mid)

        cs, cu, cemail, _ = _register_test_client("bind")
        tracked["client_ids"].append(cu["id"])

        # Search finds the client
        s = admin.get(f"{API}/admin/staff-clients?search={cemail}").json()
        assert any(c["id"] == cu["id"] for c in s)

        # bind
        r = admin.post(f"{API}/admin/staff/{mid}/clients", json={"user_id": cu["id"], "include_past_orders": False})
        assert r.status_code == 200, r.text

        # listed under manager
        own = admin.get(f"{API}/admin/staff/{mid}/clients").json()
        assert any(c["id"] == cu["id"] for c in own)

        # my-conditions sees the manager (login again to refresh)
        s2, _ = _login({"email": cemail, "password": "password123"})
        mc = s2.get(f"{API}/my-conditions").json()
        assert mc.get("manager") and mc["manager"]["email"] == email

        # unbind
        d = admin.delete(f"{API}/admin/staff/{mid}/clients/{cu['id']}")
        assert d.status_code == 200
        own2 = admin.get(f"{API}/admin/staff/{mid}/clients").json()
        assert all(c["id"] != cu["id"] for c in own2)

        # unbind again -> 404
        d2 = admin.delete(f"{API}/admin/staff/{mid}/clients/{cu['id']}")
        assert d2.status_code == 404


# ==================== CONDITIONS REQUESTS ====================

class TestConditionsRequests:
    def test_client_request_and_admin_approve(self, admin, tracked):
        cs, cu, cemail, cpass = _register_test_client("req")
        tracked["client_ids"].append(cu["id"])

        # empty request rejected
        bad = cs.post(f"{API}/conditions-requests", json={"discount": 0, "deferral_days": 0, "credit_limit": 0, "comment": ""})
        assert bad.status_code == 400

        r = cs.post(f"{API}/conditions-requests", json={"discount": 15, "deferral_days": 14, "credit_limit": 50000, "comment": "TEST"})
        assert r.status_code == 200, r.text
        req_id = r.json()["id"]

        # duplicate pending -> 400
        r2 = cs.post(f"{API}/conditions-requests", json={"discount": 10, "comment": "dup"})
        assert r2.status_code == 400

        # admin lists it
        lst = admin.get(f"{API}/admin/conditions-requests").json()
        assert any(x["id"] == req_id for x in lst)

        # approve with individual conditions
        dec = admin.put(f"{API}/admin/conditions-requests/{req_id}", json={
            "action": "approve", "individual_discount": 12, "delivery_cost": 0, "deferral_days": 10, "credit_limit": 30000,
        })
        assert dec.status_code == 200, dec.text

        # client becomes wholesale with individual conditions
        s2, _ = _login({"email": cemail, "password": cpass})
        mc = s2.get(f"{API}/my-conditions").json()
        assert mc["customer_status"] == "wholesale"
        assert mc["discount"] == 12
        assert mc["discount_individual"] is True
        assert mc["credit_limit"] == 30000

        # re-handling rejected
        dec2 = admin.put(f"{API}/admin/conditions-requests/{req_id}", json={
            "action": "approve", "individual_discount": 5, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0,
        })
        assert dec2.status_code == 400

    def test_reject_keeps_retail(self, admin, tracked):
        cs, cu, cemail, cpass = _register_test_client("reject")
        tracked["client_ids"].append(cu["id"])
        r = cs.post(f"{API}/conditions-requests", json={"discount": 20, "comment": "please"})
        rid = r.json()["id"]
        dec = admin.put(f"{API}/admin/conditions-requests/{rid}", json={
            "action": "reject", "individual_discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0,
        })
        assert dec.status_code == 200
        s2, _ = _login({"email": cemail, "password": cpass})
        mc = s2.get(f"{API}/my-conditions").json()
        assert mc["customer_status"] == "retail"


# ==================== STATISTICS END-TO-END ====================

class TestStatistics:
    def test_stats_with_real_order(self, admin, saved_status_conditions, tracked):
        # Standard manager commission 10%
        admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 10},
        })

        # Create manager with no individual commission (uses standard)
        email = f"test_stat_mgr_{uuid.uuid4().hex[:6]}@example.com"
        mgr_resp = admin.post(f"{API}/admin/staff", json={"name": "TEST_StatMgr", "email": email, "password": "statpass"})
        mid = mgr_resp.json()["id"]
        tracked["manager_ids"].append(mid)

        # Create client, bind to this manager
        cs, cu, cemail, cpass = _register_test_client("stat")
        tracked["client_ids"].append(cu["id"])
        bind_resp = admin.post(f"{API}/admin/staff/{mid}/clients", json={"user_id": cu["id"], "include_past_orders": False})
        assert bind_resp.status_code == 200, bind_resp.text

        # Create product with stock via admin POST /products (purchase_price fallback)
        art = f"TEST_STAT_{uuid.uuid4().hex[:6]}"
        pr = admin.post(f"{API}/products", json={
            "name": f"TEST_StatProd {art}", "article": art, "manufacturer": "TEST",
            "price": 1000, "purchase_price": 600, "stock": 50, "manual_available": True,
        })
        assert pr.status_code in (200, 201), pr.text
        pid = pr.json()["id"]
        tracked["product_ids"].append(pid)

        # Re-login client so that /auth/me / effective conditions refresh
        cs2, _ = _login({"email": cemail, "password": cpass})
        cs2.delete(f"{API}/cart")
        add = cs2.post(f"{API}/cart/add", json={"product_id": pid, "quantity": 2})
        assert add.status_code == 200, add.text

        order = cs2.post(f"{API}/orders", json={
            "full_name": "TEST_Stat", "address": "TEST addr", "phone": "+70000000000",
            "payment_method": "cash",
        })
        assert order.status_code == 200, order.text
        oid = order.json()["id"]
        tracked["order_ids"].append(oid)

        # manager_id snapshot — not in OrderResponse schema; verify via stats below
        order_doc = order.json()

        # stats period=day
        time.sleep(0.5)
        stats = admin.get(f"{API}/admin/staff/{mid}/stats?period=day").json()
        assert stats["orders_count"] >= 1
        assert stats["clients_count"] >= 1
        # cash -10% adj on 2*1000 = 1800 (if adjustments: cash -10). We don't know exact adj;
        # Just assert revenue == goods_total of that order (order total - delivery) and profit = revenue - 2*600
        o_goods = order_doc.get("total", 0) - (order_doc.get("delivery_fee", 0) or 0)
        # our order is the only one if revenue == o_goods (at minimum orders list contains it)
        found = next((o for o in stats["orders"] if o["id"] == oid), None)
        assert found is not None, f"order not attributed to manager (manager_id snapshot missing). stats orders: {[o['id'] for o in stats['orders']]}"
        assert abs(found["revenue"] - round(o_goods, 2)) < 0.5
        assert abs(found["profit"] - round(o_goods - 2 * 600, 2)) < 0.5
        assert stats["commission_percent"] == 10
        assert stats["commission_individual"] is False
        # commission >= 0
        assert stats["commission"] >= 0

        # invalid period
        assert admin.get(f"{API}/admin/staff/{mid}/stats?period=xyz").status_code == 400

        # Period=all works
        assert admin.get(f"{API}/admin/staff/{mid}/stats?period=all").status_code == 200

        # Cancel order -> excluded
        cs2.post(f"{API}/orders/{oid}/cancel")
        stats2 = admin.get(f"{API}/admin/staff/{mid}/stats?period=day").json()
        assert all(o["id"] != oid for o in stats2["orders"])

    def test_individual_commission_overrides_standard(self, admin, tracked):
        email = f"test_ic_mgr_{uuid.uuid4().hex[:6]}@example.com"
        r = admin.post(f"{API}/admin/staff", json={"name": "TEST_IndComm", "email": email, "password": "pass123", "commission_percent": 25})
        mid = r.json()["id"]
        tracked["manager_ids"].append(mid)
        stats = admin.get(f"{API}/admin/staff/{mid}/stats?period=all").json()
        assert stats["commission_percent"] == 25
        assert stats["commission_individual"] is True


# ==================== MANAGER CABINET ====================

class TestManagerCabinet:
    def test_overview_and_clients(self, demo_manager):
        ov = demo_manager.get(f"{API}/manager/overview?period=month")
        assert ov.status_code == 200, ov.text
        j = ov.json()
        for k in ("orders_count", "revenue", "profit", "commission", "by_client", "by_product", "orders"):
            assert k in j

        cl = demo_manager.get(f"{API}/manager/clients")
        assert cl.status_code == 200
        clients = cl.json()
        assert isinstance(clients, list)
        # demo manager is bound to user@demo.com
        emails = [c.get("email") for c in clients]
        assert DEMO_CLIENT["email"] in emails
        own = next(c for c in clients if c["email"] == DEMO_CLIENT["email"])
        assert "effective" in own

    def test_direct_set_conditions_removed(self, demo_manager):
        """The old direct-set endpoint must no longer exist."""
        clients = demo_manager.get(f"{API}/manager/clients").json()
        own = next((c for c in clients if c.get("email") == DEMO_CLIENT["email"]), None)
        if not own:
            pytest.skip("demo manager has no bound demo client")
        r = demo_manager.put(f"{API}/manager/clients/{own['id']}/conditions", json={
            "individual_discount": 5, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0,
        })
        assert r.status_code in (404, 405)

    def test_request_conditions_foreign_404(self, demo_manager, tracked):
        _, cu, _, _ = _register_test_client("foreign")
        tracked["client_ids"].append(cu["id"])
        r = demo_manager.post(f"{API}/manager/clients/{cu['id']}/conditions-request", json={
            "individual_discount": 5, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0, "comment": "x",
        })
        assert r.status_code == 404

    def test_request_conditions_validation(self, demo_manager):
        clients = demo_manager.get(f"{API}/manager/clients").json()
        own = next((c for c in clients if c.get("email") == DEMO_CLIENT["email"]), None)
        if not own:
            pytest.skip("demo manager has no bound demo client")
        r = demo_manager.post(f"{API}/manager/clients/{own['id']}/conditions-request", json={
            "individual_discount": 150, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0,
        })
        assert r.status_code == 422
        r2 = demo_manager.post(f"{API}/manager/clients/{own['id']}/conditions-request", json={
            "individual_discount": 5, "delivery_cost": -1, "deferral_days": 0, "credit_limit": 0,
        })
        assert r2.status_code == 422

    def test_chats_foreign_404(self, demo_manager):
        r = demo_manager.get(f"{API}/manager/chats/{uuid.uuid4().hex}/messages")
        assert r.status_code == 404
