# Iteration 106: min_price hard floor, /cart/quote, individual discount on all payment methods,
# payment adjustments editable in admin «Скидки и акции» tab.
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}
CLIENT = {"email": "user@demo.com", "password": os.environ["TEST_CLIENT_PASSWORD"]}
ORDER_BASE = {"full_name": "TEST_User Iter106", "address": "TEST addr", "phone": "+70000000000"}


def _login(c):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=c)
    if r.status_code != 200:
        pytest.skip(f"login failed {c['email']}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def client():
    return _login(CLIENT)


@pytest.fixture(scope="module")
def saved_state(admin, client):
    """Snapshot & restore: client cart, user individual_discount / credit, payment settings."""
    orig_cart = [(i["product_id"], i["quantity"]) for i in (client.get(f"{API}/cart").json().get("items") or [])]
    # user info
    users = admin.get(f"{API}/admin/users").json()
    u = next(x for x in (users if isinstance(users, list) else users.get("users", [])) if x["email"] == CLIENT["email"])
    uid = u["id"]
    u_snap = {
        "individual_discount": u.get("individual_discount", 0) or 0,
        "credit_limit": u.get("credit_limit", 0) or 0,
        "deferral_days": u.get("deferral_days", 0) or 0,
        "delivery_cost": u.get("delivery_cost", 0) or 0,
    }
    # payment settings
    ps = client.get(f"{API}/payment-settings").json()
    ps_snap = {k: ps.get(k) for k in ("card_adjustment", "cash_adjustment", "crypto_adjustment",
                                      "balance_adjustment", "card_enabled", "cash_enabled",
                                      "crypto_enabled", "balance_enabled",
                                      "deferred_payment_enabled", "deferred_payment_hours")}
    # cart discount request on this user (may be pending)
    cdrs = admin.get(f"{API}/admin/cart-discount-requests").json()
    user_cdr = next((r for r in cdrs if r.get("user_id") == uid and r.get("status") in ("pending", "approved")), None)
    state = {"uid": uid, "u_snap": u_snap, "ps_snap": ps_snap, "cdr": user_cdr,
             "products": [], "orders": [], "codes": []}
    # ensure individual_discount = 10 and credit enabled for tests
    admin.put(f"{API}/admin/users/{uid}", json={"individual_discount": 10,
                                                 "credit_limit": 50000,
                                                 "deferral_days": 14})
    yield state
    # Restore
    a = _login(ADMIN)
    c = _login(CLIENT)
    for oid in state["orders"]:
        c.post(f"{API}/orders/{oid}/cancel")
    c.delete(f"{API}/cart")
    for pid, q in orig_cart:
        c.post(f"{API}/cart/add", json={"product_id": pid, "quantity": q})
    for cid in state["codes"]:
        a.delete(f"{API}/admin/promo-codes/{cid}")
    for pid in state["products"]:
        a.delete(f"{API}/products/{pid}")
    a.put(f"{API}/admin/users/{uid}", json=u_snap)
    # Restore payment settings
    a.put(f"{API}/admin/payment-settings", json=ps_snap)


def _mk_product(admin, saved_state, price=1000, min_price=950, **kw):
    art = f"TEST_{uuid.uuid4().hex[:8]}"
    body = {"name": f"TEST_Iter106 {art}", "article": art, "manufacturer": "TEST",
            "price": price, "purchase_price": 500, "min_price": min_price,
            "stock": 50, "manual_available": True}
    body.update(kw)
    r = admin.post(f"{API}/products", json=body)
    assert r.status_code in (200, 201), r.text
    p = r.json()
    saved_state["products"].append(p["id"])
    return p


def _fill(client, pid, qty):
    client.delete(f"{API}/cart")
    r = client.post(f"{API}/cart/add", json={"product_id": pid, "quantity": qty})
    assert r.status_code == 200, r.text


class TestCartQuote:
    def test_quote_floor_with_cash_adjustment(self, admin, client, saved_state):
        # price 1000, min_price 950, cash -10% -> 900 clamped to 950
        p = _mk_product(admin, saved_state, price=1000, min_price=950)
        _fill(client, p["id"], 2)
        r = client.get(f"{API}/cart/quote?payment_method=cash")
        assert r.status_code == 200, r.text
        q = r.json()
        assert q["payment_method"] == "cash"
        assert q["goods_total"] == 1900, q
        assert q["sum_floors"] == 1900, q
        assert q["items"][0]["price"] == 950
        assert q["items"][0]["quantity"] == 2

    def test_quote_card_above_floor(self, admin, client, saved_state):
        p = _mk_product(admin, saved_state, price=1000, min_price=950)
        _fill(client, p["id"], 2)
        q = client.get(f"{API}/cart/quote?payment_method=card").json()
        # card +10% -> 1100 each, floor is 950 (lower) -> goods 2200
        assert q["goods_total"] == 2200
        assert q["sum_floors"] == 1900

    def test_quote_none_method(self, admin, client, saved_state):
        p = _mk_product(admin, saved_state, price=1000, min_price=950)
        _fill(client, p["id"], 1)
        q = client.get(f"{API}/cart/quote?payment_method=none").json()
        assert q["goods_total"] == 1000  # no adjustment
        assert q["sum_floors"] == 950


class TestFloorOrderAlwaysPlaced:
    def test_cash_at_floor(self, admin, client, saved_state):
        p = _mk_product(admin, saved_state, price=1000, min_price=950)
        _fill(client, p["id"], 2)
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="cash"))
        assert r.status_code == 200, r.text
        o = r.json()
        saved_state["orders"].append(o["id"])
        # Each item at floor, individual discount can't eat into floor
        assert all(it["price"] >= 950 for it in o["items"])
        assert o["items"][0]["price"] == 950
        goods = sum(it["price"] * it["quantity"] for it in o["items"])
        # Cash -10% drives below floor, clamped to 1900. individual_discount: no room -> 0
        assert goods == 1900, goods
        assert o.get("individual_discount_amount", 0) == 0

    def test_card_individual_discount_applied(self, admin, client, saved_state):
        # card +10% -> 1100, individual 10% -> 110 -> 990, above floor 950
        p = _mk_product(admin, saved_state, price=1000, min_price=950)
        _fill(client, p["id"], 1)
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="card"))
        assert r.status_code == 200, r.text
        o = r.json()
        saved_state["orders"].append(o["id"])
        assert o["individual_discount_amount"] == 110
        assert o["individual_discount_percent"] == 10
        goods = o["total"] - (o.get("delivery_fee") or 0)
        assert abs(goods - 990) < 0.1, (goods, o)

    def test_crypto_order(self, admin, client, saved_state):
        p = _mk_product(admin, saved_state, price=1000, min_price=950)
        _fill(client, p["id"], 1)
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="crypto"))
        assert r.status_code == 200, r.text
        o = r.json()
        saved_state["orders"].append(o["id"])
        # crypto -15% -> 850 clamped to 950; individual: 0 room
        assert o["items"][0]["price"] == 950
        assert o.get("individual_discount_amount", 0) == 0


class TestIndividualDiscountAllMethods:
    """individual_discount applies on card/cash/balance/deferral/mixed when room above floor."""

    def test_card_has_individual(self, admin, client, saved_state):
        p = _mk_product(admin, saved_state, price=1000, min_price=100)
        _fill(client, p["id"], 1)
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="card"))
        assert r.status_code == 200, r.text
        o = r.json()
        saved_state["orders"].append(o["id"])
        assert o["individual_discount_amount"] > 0
        assert o["individual_discount_percent"] == 10

    def test_cash_has_individual(self, admin, client, saved_state):
        p = _mk_product(admin, saved_state, price=1000, min_price=100)
        _fill(client, p["id"], 1)
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="cash"))
        assert r.status_code == 200, r.text
        o = r.json()
        saved_state["orders"].append(o["id"])
        assert o["individual_discount_amount"] > 0, o
        assert o["individual_discount_percent"] == 10

    def test_balance_has_individual(self, admin, client, saved_state):
        # ensure some balance - may not be enough; use a deliberately low cost
        p = _mk_product(admin, saved_state, price=100, min_price=10)
        _fill(client, p["id"], 1)
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="card",
                                                     pay_with_balance=True))
        # If balance is insufficient, skip
        if r.status_code != 200:
            pytest.skip(f"balance insufficient: {r.text}")
        o = r.json()
        saved_state["orders"].append(o["id"])
        assert o["individual_discount_amount"] > 0
        assert o["individual_discount_percent"] == 10

    def test_deferral_has_individual(self, admin, client, saved_state):
        p = _mk_product(admin, saved_state, price=1000, min_price=100)
        _fill(client, p["id"], 1)
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="deferral"))
        if r.status_code != 200:
            pytest.skip(f"deferral unavailable: {r.text}")
        o = r.json()
        saved_state["orders"].append(o["id"])
        assert o["individual_discount_amount"] > 0, o
        assert o["individual_discount_percent"] == 10

    def test_mixed_has_individual(self, admin, client, saved_state):
        p = _mk_product(admin, saved_state, price=1000, min_price=100)
        _fill(client, p["id"], 2)  # base 2000
        # pay half card half cash
        parts = [{"method": "card", "amount": 1000}, {"method": "cash", "amount": 1000}]
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="card",
                                                     payment_parts=parts))
        assert r.status_code == 200, r.text
        o = r.json()
        saved_state["orders"].append(o["id"])
        assert o["individual_discount_amount"] > 0, o
        # Sum of payment_parts amounts = goods after discount + delivery
        pp = o.get("payment_parts") or []
        pp_sum = round(sum(p["amount"] for p in pp), 2)
        expected = round((o["total"]), 2)
        assert abs(pp_sum - expected) < 1.0, (pp_sum, expected, o)


class TestPaymentAdjustmentsAdmin:
    def test_edit_payment_adjustment_persists_and_preserves_others(self, admin, saved_state):
        before = admin.get(f"{API}/payment-settings").json()
        # change only cash_adjustment
        new_payload = dict(before)
        new_payload["cash_adjustment"] = -7
        r = admin.put(f"{API}/admin/payment-settings", json=new_payload)
        assert r.status_code == 200, r.text
        after = admin.get(f"{API}/payment-settings").json()
        assert after["cash_adjustment"] == -7
        # Other fields preserved
        for k in ("card_enabled", "deferred_payment_enabled", "deferred_payment_hours",
                  "card_adjustment", "crypto_adjustment", "balance_adjustment"):
            assert after.get(k) == before.get(k), f"{k} changed: {before.get(k)} -> {after.get(k)}"
        # restore (saved_state finalizer also restores)
        admin.put(f"{API}/admin/payment-settings", json=before)


class TestFloorPromoCodeAndCartDiscount:
    def test_promo_code_order_always_placed(self, admin, client, saved_state):
        p = _mk_product(admin, saved_state, price=1000, min_price=950)
        _fill(client, p["id"], 1)
        # 50% promo
        code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        rc = admin.post(f"{API}/admin/promo-codes", json={"code": code, "type": "percent",
                                                            "value": 50, "min_order": 0,
                                                            "max_uses": 0, "per_user_limit": 0,
                                                            "active": True})
        assert rc.status_code == 200, rc.text
        saved_state["codes"].append(rc.json()["id"])
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="card",
                                                     promo_code=code))
        assert r.status_code == 200, r.text
        o = r.json()
        saved_state["orders"].append(o["id"])
        # floor sum = 950; card +10% = 1100; promo capped so goods >= 950
        goods = o["total"] - (o.get("delivery_fee") or 0)
        assert goods >= 950 - 0.01, (goods, o)
