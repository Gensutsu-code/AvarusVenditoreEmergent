# Iteration 111: commission snapshot in order, payout limit cannot exceed balance,
# staff-chart returns `profit`, admin orders manager filter data fields.
import os
import time
import uuid
from datetime import date

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load backend .env so MONGO_URL / DB_NAME are available
load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

ADMIN = {"email": "admin@avarus.ru", "password": "admin"}


# -------- helpers --------

def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s, r.json()


@pytest.fixture(scope="module")
def admin():
    s, _ = _login(ADMIN)
    return s


@pytest.fixture(scope="module")
def saved_sc(admin):
    before = admin.get(f"{API}/admin/status-conditions").json()
    yield before
    admin.put(f"{API}/admin/status-conditions", json={
        "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
        "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
        "manager": {"commission_percent": 0},
    })


@pytest.fixture(scope="module")
def tracked():
    data = {"manager_ids": [], "client_ids": [], "product_ids": [], "order_ids": [], "payout_ids": []}
    yield data
    a, _ = _login(ADMIN)
    for oid in data["order_ids"]:
        try: a.post(f"{API}/orders/{oid}/cancel")
        except Exception: pass
    for mid, pid in data["payout_ids"]:
        try: a.delete(f"{API}/admin/staff/{mid}/payouts/{pid}")
        except Exception: pass
    for pid in data["product_ids"]:
        try: a.delete(f"{API}/products/{pid}")
        except Exception: pass
    for mid in data["manager_ids"]:
        try: a.delete(f"{API}/admin/staff/{mid}")
        except Exception: pass
    for cid in data["client_ids"]:
        try: a.delete(f"{API}/admin/users/{cid}")
        except Exception: pass


def _register_client(suffix):
    email = f"test_{suffix}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "password123", "name": f"TEST_{suffix}", "phone": "+70000000000",
    }, timeout=30)
    assert r.status_code in (200, 201), r.text
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s, r.json()["user"]


def _create_manager(admin_s, name, commission=None):
    email = f"test_mgr_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": name, "email": email, "password": "mgrpass123"}
    if commission is not None:
        payload["commission_percent"] = commission
    r = admin_s.post(f"{API}/admin/staff", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def _create_product(admin_s, price=1000, purchase=600, stock=50):
    art = f"TEST_IT111_{uuid.uuid4().hex[:6]}"
    r = admin_s.post(f"{API}/products", json={
        "name": f"TEST_P {art}", "article": art, "manufacturer": "TEST",
        "price": price, "purchase_price": purchase, "stock": stock, "manual_available": True,
    })
    assert r.status_code in (200, 201), r.text
    return r.json()


def _place_order(cs, product_id, qty=1):
    cs.delete(f"{API}/cart")
    add = cs.post(f"{API}/cart/add", json={"product_id": product_id, "quantity": qty})
    assert add.status_code == 200, add.text
    o = cs.post(f"{API}/orders", json={
        "full_name": "TEST", "address": "TEST addr", "phone": "+70000000000", "payment_method": "cash",
    })
    assert o.status_code == 200, o.text
    return o.json()


async def _order_doc(order_id: str):
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        doc = await client[DB_NAME].orders.find_one({"id": order_id}, {"_id": 0})
        return doc
    finally:
        client.close()


# ==================== 1. COMMISSION SNAPSHOT ====================

class TestCommissionSnapshot:
    @pytest.mark.asyncio
    async def test_individual_percent_snapshot(self, admin, saved_sc, tracked):
        # Reset standard
        admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 0},
        })
        mgr = _create_manager(admin, "TEST_SnapshotMgr", commission=10)
        tracked["manager_ids"].append(mgr["id"])
        cs, cu = _register_client("snap")
        tracked["client_ids"].append(cu["id"])
        admin.post(f"{API}/admin/staff/{mgr['id']}/clients", json={"user_id": cu["id"], "include_past_orders": False})
        prod = _create_product(admin, price=1000, purchase=600, stock=20)
        tracked["product_ids"].append(prod["id"])

        # Order A at 10%
        oA = _place_order(cs, prod["id"], qty=1)
        tracked["order_ids"].append(oA["id"])
        time.sleep(0.5)
        docA = await _order_doc(oA["id"])
        assert docA is not None
        assert docA.get("manager_id") == mgr["id"]
        assert docA.get("manager_commission_percent") == 10.0, f"snapshot missing: {docA.get('manager_commission_percent')}"

        statsA = admin.get(f"{API}/admin/staff/{mgr['id']}/stats?period=all").json()
        profitA = statsA["profit"]
        expected_commA = round(profitA * 0.10, 2)
        assert abs(statsA["commission"] - expected_commA) < 0.02, f"commission {statsA['commission']} != profit*10% {expected_commA}"

        # Change manager percent to 20
        admin.put(f"{API}/admin/staff/{mgr['id']}", json={
            "name": mgr["name"], "email": mgr["email"], "phone": "", "position": "", "note": "",
            "commission_percent": 20, "blocked": False,
        })
        # Place order B at 20%
        oB = _place_order(cs, prod["id"], qty=1)
        tracked["order_ids"].append(oB["id"])
        time.sleep(0.5)
        docB = await _order_doc(oB["id"])
        assert docB.get("manager_commission_percent") == 20.0

        statsAB = admin.get(f"{API}/admin/staff/{mgr['id']}/stats?period=all").json()
        # Each order has same profit (same price/cost); commission = profitA*10% + profitB*20%
        orders = statsAB["orders"]
        assert len(orders) >= 2
        # Per-order profit identical
        pr = orders[0]["profit"]
        expected_total_comm = round(pr * 0.10 + pr * 0.20, 2)
        assert abs(statsAB["commission"] - expected_total_comm) < 0.05, f"{statsAB['commission']} vs {expected_total_comm}"

        # Payouts earned equals same sum
        payouts = admin.get(f"{API}/admin/staff/{mgr['id']}/payouts").json()
        assert abs(payouts["earned"] - statsAB["commission"]) < 0.02

    @pytest.mark.asyncio
    async def test_standard_percent_snapshot(self, admin, saved_sc, tracked):
        # Manager without individual percent, standard 5%
        admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 5},
        })
        mgr = _create_manager(admin, "TEST_StdSnapMgr", commission=None)
        tracked["manager_ids"].append(mgr["id"])
        cs, cu = _register_client("stdsnap")
        tracked["client_ids"].append(cu["id"])
        admin.post(f"{API}/admin/staff/{mgr['id']}/clients", json={"user_id": cu["id"]})
        prod = _create_product(admin, price=1000, purchase=600, stock=20)
        tracked["product_ids"].append(prod["id"])

        oA = _place_order(cs, prod["id"], qty=1)
        tracked["order_ids"].append(oA["id"])
        time.sleep(0.5)
        docA = await _order_doc(oA["id"])
        assert docA.get("manager_commission_percent") == 5.0, f"got {docA.get('manager_commission_percent')}"

        # Change standard to 15 and place B
        admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 15},
        })
        oB = _place_order(cs, prod["id"], qty=1)
        tracked["order_ids"].append(oB["id"])
        time.sleep(0.5)
        docB = await _order_doc(oB["id"])
        assert docB.get("manager_commission_percent") == 15.0

        stats = admin.get(f"{API}/admin/staff/{mgr['id']}/stats?period=all").json()
        orders = stats["orders"]
        pr = orders[0]["profit"]
        expected = round(pr * 0.05 + pr * 0.15, 2)
        assert abs(stats["commission"] - expected) < 0.05, f"{stats['commission']} vs {expected}"

    @pytest.mark.asyncio
    async def test_unbound_order_no_manager_fields(self, admin, saved_sc, tracked):
        cs, cu = _register_client("unbound")
        tracked["client_ids"].append(cu["id"])
        prod = _create_product(admin, price=500, purchase=200, stock=5)
        tracked["product_ids"].append(prod["id"])
        o = _place_order(cs, prod["id"], qty=1)
        tracked["order_ids"].append(o["id"])
        time.sleep(0.3)
        doc = await _order_doc(o["id"])
        assert doc.get("manager_id") is None
        assert doc.get("manager_commission_percent") is None

    @pytest.mark.asyncio
    async def test_cancelled_order_contributes_nothing(self, admin, saved_sc, tracked):
        admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 0},
        })
        mgr = _create_manager(admin, "TEST_CancelMgr", commission=10)
        tracked["manager_ids"].append(mgr["id"])
        cs, cu = _register_client("cancel")
        tracked["client_ids"].append(cu["id"])
        admin.post(f"{API}/admin/staff/{mgr['id']}/clients", json={"user_id": cu["id"]})
        prod = _create_product(admin, price=1000, purchase=600, stock=10)
        tracked["product_ids"].append(prod["id"])
        o = _place_order(cs, prod["id"], qty=1)
        # Client cancels (admin endpoint requires user-owned order)
        r = cs.post(f"{API}/orders/{o['id']}/cancel")
        assert r.status_code == 200, r.text
        time.sleep(0.3)
        stats = admin.get(f"{API}/admin/staff/{mgr['id']}/stats?period=all").json()
        assert stats["commission"] == 0
        assert stats["orders_count"] == 0

    @pytest.mark.asyncio
    async def test_legacy_order_uses_current_percent(self, admin, saved_sc, tracked):
        """Order placed before binding (include_past_orders=true) has no saved percent;
        _manager_stats falls back to the current manager percent."""
        admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 0},
        })
        # Place order first as unbound client
        cs, cu = _register_client("legacy")
        tracked["client_ids"].append(cu["id"])
        prod = _create_product(admin, price=1000, purchase=600, stock=10)
        tracked["product_ids"].append(prod["id"])
        o = _place_order(cs, prod["id"], qty=1)
        tracked["order_ids"].append(o["id"])
        time.sleep(0.5)
        doc_before = await _order_doc(o["id"])
        assert doc_before.get("manager_commission_percent") is None
        assert doc_before.get("manager_id") is None

        # Now bind manager with include_past_orders=true
        mgr = _create_manager(admin, "TEST_LegacyMgr", commission=12)
        tracked["manager_ids"].append(mgr["id"])
        r = admin.post(f"{API}/admin/staff/{mgr['id']}/clients",
                       json={"user_id": cu["id"], "include_past_orders": True})
        assert r.status_code == 200, r.text
        time.sleep(0.3)
        doc_after = await _order_doc(o["id"])
        # manager_id now set
        assert doc_after.get("manager_id") == mgr["id"]
        # commission_percent not back-filled (legacy)
        assert doc_after.get("manager_commission_percent") in (None, 12.0)

        stats = admin.get(f"{API}/admin/staff/{mgr['id']}/stats?period=all").json()
        pr = stats["profit"]
        # commission should use current (12%) if percent was None
        expected = round(pr * 0.12, 2)
        assert abs(stats["commission"] - expected) < 0.05


# ==================== 2. PAYOUT LIMIT ====================

class TestPayoutLimit:
    def test_cannot_exceed_balance(self, admin, saved_sc, tracked):
        admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 0},
        })
        mgr = _create_manager(admin, "TEST_PayoutLim", commission=10)
        tracked["manager_ids"].append(mgr["id"])
        cs, cu = _register_client("pl")
        tracked["client_ids"].append(cu["id"])
        admin.post(f"{API}/admin/staff/{mgr['id']}/clients", json={"user_id": cu["id"]})
        prod = _create_product(admin, price=1000, purchase=600, stock=10)
        tracked["product_ids"].append(prod["id"])
        o = _place_order(cs, prod["id"], qty=1)
        tracked["order_ids"].append(o["id"])
        time.sleep(0.5)

        ps = admin.get(f"{API}/admin/staff/{mgr['id']}/payouts").json()
        balance = ps["balance"]
        assert balance > 0

        # Above balance -> 400 Russian
        over = admin.post(f"{API}/admin/staff/{mgr['id']}/payouts", json={"amount": balance + 10, "comment": "TEST"})
        assert over.status_code == 400
        det = over.json().get("detail", "")
        assert "Выплата больше остатка к выплате" in det
        assert "₽" in det

        # Equal to balance -> OK, balance=0
        eq = admin.post(f"{API}/admin/staff/{mgr['id']}/payouts", json={"amount": balance, "comment": "TEST eq"})
        assert eq.status_code == 200, eq.text
        pid = eq.json()["id"]
        tracked["payout_ids"].append((mgr["id"], pid))

        ps2 = admin.get(f"{API}/admin/staff/{mgr['id']}/payouts").json()
        assert abs(ps2["balance"]) < 0.01

        # Any positive payout now -> 400
        more = admin.post(f"{API}/admin/staff/{mgr['id']}/payouts", json={"amount": 1, "comment": "TEST more"})
        assert more.status_code == 400

        # Cancel payout restores balance
        d = admin.delete(f"{API}/admin/staff/{mgr['id']}/payouts/{pid}")
        assert d.status_code == 200
        ps3 = admin.get(f"{API}/admin/staff/{mgr['id']}/payouts").json()
        assert abs(ps3["balance"] - balance) < 0.01

        # Now payout possible again
        ok = admin.post(f"{API}/admin/staff/{mgr['id']}/payouts", json={"amount": balance / 2, "comment": "TEST again"})
        assert ok.status_code == 200
        tracked["payout_ids"].append((mgr["id"], ok.json()["id"]))

    def test_zero_earned_blocks_any_payout(self, admin, saved_sc, tracked):
        admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 0},
        })
        mgr = _create_manager(admin, "TEST_ZeroEarn", commission=10)
        tracked["manager_ids"].append(mgr["id"])
        ps = admin.get(f"{API}/admin/staff/{mgr['id']}/payouts").json()
        assert ps["earned"] == 0 and ps["balance"] == 0
        r = admin.post(f"{API}/admin/staff/{mgr['id']}/payouts", json={"amount": 1, "comment": "TEST"})
        assert r.status_code == 400


# ==================== 3. CHART PROFIT ====================

class TestChartProfit:
    def test_chart_has_profit_field(self, admin, saved_sc, tracked):
        admin.put(f"{API}/admin/status-conditions", json={
            "retail": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "wholesale": {"discount": 0, "delivery_cost": None, "deferral_days": 0, "credit_limit": 0},
            "manager": {"commission_percent": 0},
        })
        mgr = _create_manager(admin, "TEST_ChartProfit", commission=10)
        tracked["manager_ids"].append(mgr["id"])
        cs, cu = _register_client("chprof")
        tracked["client_ids"].append(cu["id"])
        admin.post(f"{API}/admin/staff/{mgr['id']}/clients", json={"user_id": cu["id"]})
        prod = _create_product(admin, price=1000, purchase=600, stock=10)
        tracked["product_ids"].append(prod["id"])
        o = _place_order(cs, prod["id"], qty=1)
        tracked["order_ids"].append(o["id"])
        time.sleep(0.5)

        r = admin.get(f"{API}/admin/staff-chart?months=6").json()
        assert "managers" in r and "data" in r and "profit" in r
        assert len(r["data"]) == len(r["profit"])
        # Same month keys
        rev_keys = [row["month"] for row in r["data"]]
        prof_keys = [row["month"] for row in r["profit"]]
        assert rev_keys == prof_keys

        today = date.today()
        mk = f"{today.year:04d}-{today.month:02d}"
        rev_row = next(x for x in r["data"] if x["month"] == mk)
        prof_row = next(x for x in r["profit"] if x["month"] == mk)
        # Keys match
        assert set(rev_row.keys()) == set(prof_row.keys())
        # For our manager: revenue > 0, profit > 0, profit < revenue (cost 600*1=600)
        assert rev_row[mgr["id"]] > 0
        assert prof_row[mgr["id"]] > 0
        assert prof_row[mgr["id"]] < rev_row[mgr["id"]]
        # Profit = revenue - 600 (approx; cash -10% adjustment makes revenue=900, profit=300)
        assert abs((rev_row[mgr["id"]] - prof_row[mgr["id"]]) - 600) < 1.0


# ==================== 4. ADMIN ORDERS exposes manager_id & manager_name ====================

class TestAdminOrdersManagerFields:
    def test_admin_orders_have_manager_fields(self, admin, saved_sc, tracked):
        mgr = _create_manager(admin, "TEST_OrdFilt", commission=10)
        tracked["manager_ids"].append(mgr["id"])
        cs, cu = _register_client("ordf")
        tracked["client_ids"].append(cu["id"])
        admin.post(f"{API}/admin/staff/{mgr['id']}/clients", json={"user_id": cu["id"]})
        prod = _create_product(admin, price=1000, purchase=600, stock=10)
        tracked["product_ids"].append(prod["id"])
        o = _place_order(cs, prod["id"], qty=1)
        tracked["order_ids"].append(o["id"])
        time.sleep(0.3)

        orders = admin.get(f"{API}/admin/orders").json()
        mine = next((x for x in orders if x["id"] == o["id"]), None)
        assert mine is not None
        assert mine.get("manager_id") == mgr["id"]
        assert mine.get("manager_name") == mgr["name"]

        # Unbound order
        cs2, cu2 = _register_client("ordunb")
        tracked["client_ids"].append(cu2["id"])
        o2 = _place_order(cs2, prod["id"], qty=1)
        tracked["order_ids"].append(o2["id"])
        time.sleep(0.3)
        orders2 = admin.get(f"{API}/admin/orders").json()
        unb = next((x for x in orders2 if x["id"] == o2["id"]), None)
        assert unb is not None
        assert not unb.get("manager_id")
