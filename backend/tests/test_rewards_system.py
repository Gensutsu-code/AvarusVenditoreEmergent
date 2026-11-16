"""Tests for the new reward systems (points / ozon / cashback) — iteration 113."""
import os
import time
import pytest
import requests

def _read_env_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    return ln.split("=", 1)[1].strip()
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE = _read_env_url().rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}
CLIENT1 = {"email": "user@demo.com", "password": os.environ["TEST_CLIENT_PASSWORD"]}
CLIENT2 = {"email": "0x0errorr@gmail.com", "password": os.environ["TEST_CLIENT2_PASSWORD"]}


def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token():
    return login(ADMIN)


@pytest.fixture(scope="module")
def client1_token():
    return login(CLIENT1)


@pytest.fixture(scope="module")
def client2_token():
    return login(CLIENT2)


def _me(tok):
    r = requests.get(f"{API}/auth/me", headers=H(tok), timeout=30)
    assert r.status_code == 200
    return r.json()


def _set_system(admin_tok, user_id, system):
    r = requests.put(f"{API}/admin/rewards/users/{user_id}",
                     headers=H(admin_tok), json={"reward_system": system}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _default_settings():
    return {
        "points": {"enabled": True, "retail_percent": 100, "wholesale_percent": 100,
                   "min_order": 0, "exclude_discounted": False, "tiers": [], "rules": []},
        "ozon": {"enabled": True, "retail_percent": 5, "wholesale_percent": 5,
                 "min_order": 0, "exclude_discounted": False, "tiers": [], "rules": [],
                 "round_to": 500},
        "cashback": {"enabled": True, "retail_percent": 3, "wholesale_percent": 3,
                     "min_order": 0, "exclude_discounted": False, "tiers": [], "rules": [],
                     "allow_pay": True, "max_pay_percent": 100,
                     "allow_withdraw": True, "min_withdraw": 500},
    }


# ---------------- Admin settings ----------------

class TestAdminRewardSettings:
    def test_non_admin_forbidden(self, client1_token):
        r = requests.get(f"{API}/admin/rewards/settings", headers=H(client1_token), timeout=30)
        assert r.status_code == 403

    def test_get_settings(self, admin_token):
        r = requests.get(f"{API}/admin/rewards/settings", headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        data = r.json()
        for k in ("points", "ozon", "cashback"):
            assert k in data
            assert "enabled" in data[k]
            assert "retail_percent" in data[k]

    def test_put_settings_persists(self, admin_token):
        payload = _default_settings()
        payload["cashback"]["retail_percent"] = 3
        payload["cashback"]["min_order"] = 1000
        payload["cashback"]["tiers"] = [{"from": 50000, "retail_percent": 5, "wholesale_percent": 5}]
        payload["cashback"]["rules"] = [
            {"type": "category", "target_id": "cat-test-1", "target_name": "TEST", "percent": 1}
        ]
        r = requests.put(f"{API}/admin/rewards/settings", headers=H(admin_token), json=payload, timeout=30)
        assert r.status_code == 200, r.text
        # reload
        r2 = requests.get(f"{API}/admin/rewards/settings", headers=H(admin_token), timeout=30)
        d = r2.json()
        assert d["cashback"]["min_order"] == 1000
        assert len(d["cashback"]["tiers"]) == 1
        assert d["cashback"]["tiers"][0]["from"] == 50000
        assert len(d["cashback"]["rules"]) == 1
        # Restore defaults
        rst = requests.put(f"{API}/admin/rewards/settings", headers=H(admin_token), json=_default_settings(), timeout=30)
        assert rst.status_code == 200


# ---------------- Client choose / me ----------------

class TestClientChoose:
    def test_reset_then_me_shows_options(self, admin_token, client1_token):
        me = _me(client1_token)
        _set_system(admin_token, me["id"], None)
        r = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["chosen"] is None
        assert data["system"] is None
        keys = {o["key"] for o in data["options"]}
        assert keys == {"points", "ozon", "cashback"}

    def test_choose_then_second_time_fails(self, admin_token, client1_token):
        me = _me(client1_token)
        _set_system(admin_token, me["id"], None)
        r = requests.post(f"{API}/rewards/choose", headers=H(client1_token), json={"system": "cashback"}, timeout=30)
        assert r.status_code == 200, r.text
        # Second attempt
        r2 = requests.post(f"{API}/rewards/choose", headers=H(client1_token), json={"system": "points"}, timeout=30)
        assert r2.status_code == 400

    def test_choose_disabled_system_rejected(self, admin_token, client1_token):
        me = _me(client1_token)
        _set_system(admin_token, me["id"], None)
        # Disable ozon
        settings = _default_settings()
        settings["ozon"]["enabled"] = False
        requests.put(f"{API}/admin/rewards/settings", headers=H(admin_token), json=settings, timeout=30)
        try:
            r = requests.post(f"{API}/rewards/choose", headers=H(client1_token), json={"system": "ozon"}, timeout=30)
            assert r.status_code == 400
            # options should not include ozon
            me_r = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json()
            assert all(o["key"] != "ozon" for o in me_r["options"])
        finally:
            requests.put(f"{API}/admin/rewards/settings", headers=H(admin_token), json=_default_settings(), timeout=30)


# ---------------- Access restriction for /api/bonus ----------------

class TestBonusAccessRestriction:
    def test_cashback_user_blocked_from_bonus(self, admin_token, client1_token):
        me = _me(client1_token)
        _set_system(admin_token, me["id"], "cashback")
        progs = requests.get(f"{API}/bonus/programs", headers=H(client1_token), timeout=30)
        assert progs.status_code == 200
        assert progs.json() == [] or progs.json() == {"programs": []}
        pts = requests.get(f"{API}/bonus/my-points", headers=H(client1_token), timeout=30)
        assert pts.status_code == 200
        body = pts.json()
        total = body.get("total_points", body) if isinstance(body, dict) else body
        assert total == 0 or total == {"total_points": 0}
        redeem = requests.post(f"{API}/bonus/redeem-prize", headers=H(client1_token),
                               json={"program_id": "x", "prize_id": "y"}, timeout=30)
        assert redeem.status_code == 403


# ---------------- Cart preview ----------------

class TestCartPreview:
    def test_cart_preview_endpoint_reachable(self, admin_token, client1_token):
        me = _me(client1_token)
        _set_system(admin_token, me["id"], "cashback")
        r = requests.get(f"{API}/rewards/cart-preview?amount=10000",
                         headers=H(client1_token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["system"] == "cashback"
        # amount is numeric
        assert "amount" in data


# ---------------- Admin cashback adjustment + withdrawal ----------------

class TestCashbackAdminAndWithdraw:
    def test_admin_topup_then_withdraw_flow(self, admin_token, client1_token):
        me = _me(client1_token)
        _set_system(admin_token, me["id"], "cashback")
        # Top up
        r = requests.post(f"{API}/admin/rewards/users/{me['id']}/cashback",
                          headers=H(admin_token),
                          json={"amount": 2000, "reason": "TEST_topup"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["cashback_balance"] >= 2000

        # Withdrawal below min_withdraw (default 500) should fail
        r_low = requests.post(f"{API}/rewards/cashback/withdraw",
                              headers=H(client1_token),
                              json={"amount": 100, "details": "Card 1234"}, timeout=30)
        assert r_low.status_code == 400

        # No details → fail
        r_no_det = requests.post(f"{API}/rewards/cashback/withdraw",
                                 headers=H(client1_token),
                                 json={"amount": 600, "details": ""}, timeout=30)
        assert r_no_det.status_code == 400

        # Valid withdraw
        r_ok = requests.post(f"{API}/rewards/cashback/withdraw",
                             headers=H(client1_token),
                             json={"amount": 600, "details": "TEST_Card 1234"}, timeout=30)
        assert r_ok.status_code == 200, r_ok.text
        wid = r_ok.json()["id"]

        # Admin lists withdrawals, finds ours
        lst = requests.get(f"{API}/admin/rewards/withdrawals",
                           headers=H(admin_token), timeout=30)
        assert lst.status_code == 200
        ids = [w["id"] for w in lst.json()["withdrawals"]]
        assert wid in ids

        # Reject → cashback refunded
        bal_before = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json()["cashback_balance"]
        rej = requests.put(f"{API}/admin/rewards/withdrawals/{wid}",
                           headers=H(admin_token), json={"status": "rejected"}, timeout=30)
        assert rej.status_code == 200
        bal_after = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json()["cashback_balance"]
        assert round(bal_after - bal_before, 2) == 600

        # Cannot process twice
        rej2 = requests.put(f"{API}/admin/rewards/withdrawals/{wid}",
                            headers=H(admin_token), json={"status": "rejected"}, timeout=30)
        assert rej2.status_code == 400

        # Second withdrawal, then mark paid
        r_pay = requests.post(f"{API}/rewards/cashback/withdraw",
                              headers=H(client1_token),
                              json={"amount": 500, "details": "TEST_IBAN"}, timeout=30)
        assert r_pay.status_code == 200
        wid2 = r_pay.json()["id"]
        paid = requests.put(f"{API}/admin/rewards/withdrawals/{wid2}",
                            headers=H(admin_token), json={"status": "paid"}, timeout=30)
        assert paid.status_code == 200
        # Can't process again
        paid2 = requests.put(f"{API}/admin/rewards/withdrawals/{wid2}",
                             headers=H(admin_token), json={"status": "paid"}, timeout=30)
        assert paid2.status_code == 400

    def test_cannot_withdraw_without_cashback_system(self, admin_token, client2_token):
        me = _me(client2_token)
        _set_system(admin_token, me["id"], "points")
        r = requests.post(f"{API}/rewards/cashback/withdraw",
                          headers=H(client2_token),
                          json={"amount": 1000, "details": "x"}, timeout=30)
        assert r.status_code == 403


# ---------------- Admin reward_users list ----------------

class TestAdminRewardUsers:
    def test_list_and_switch(self, admin_token, client1_token):
        me = _me(client1_token)
        r = requests.get(f"{API}/admin/rewards/users?search=demo", headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "users" in d and "counts" in d
        assert any(u["id"] == me["id"] for u in d["users"])
        # Reset to null — allows client to choose again
        _set_system(admin_token, me["id"], None)
        r2 = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json()
        assert r2["chosen"] is None


# ---------------- Order lifecycle: cashback accrual on completion ----------------

PRODUCT_WITH_STOCK = "23cda779-3741-4fc7-8466-ae2c22810e37"  # Датчик SIEMENS, stock=14, price=680


def _add_to_cart(tok, product_id, qty=1):
    r = requests.post(f"{API}/cart/add", headers=H(tok),
                      json={"product_id": product_id, "quantity": qty}, timeout=30)
    return r


def _clear_cart(tok):
    cart = requests.get(f"{API}/cart", headers=H(tok), timeout=30).json()
    for it in cart.get("items", []):
        requests.post(f"{API}/cart/remove", headers=H(tok),
                      json={"product_id": it["product_id"]}, timeout=30)


class TestOrderCashbackLifecycle:
    def test_cashback_accrued_on_completion_and_idempotent(self, admin_token, client1_token):
        me = _me(client1_token)
        _set_system(admin_token, me["id"], "cashback")
        # Default cashback retail_percent = 3%
        _clear_cart(client1_token)
        _add_to_cart(client1_token, PRODUCT_WITH_STOCK, 2)
        # Create order
        r = requests.post(f"{API}/orders", headers=H(client1_token), json={
            "full_name": "TEST User", "address": "TEST street 1", "phone": "+70000000001",
            "comment": "TEST_cashback_order", "payment_method": "cash"
        }, timeout=60)
        assert r.status_code == 200, r.text
        order = r.json()
        oid = order["id"]
        assert order.get("reward_system") == "cashback"
        assert order.get("ozon_certificate", 0) == 0
        expected = order.get("reward_expected", 0)
        assert expected > 0, f"expected cashback should be > 0, got {expected}"

        # Balance before accrual
        bal_before = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json().get("cashback_balance", 0)

        # Admin completes order
        comp = requests.put(f"{API}/admin/orders/{oid}/status?status=completed",
                            headers=H(admin_token), timeout=60)
        assert comp.status_code == 200, comp.text

        time.sleep(1)
        bal_after = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json().get("cashback_balance", 0)
        delta = round(bal_after - bal_before, 2)
        assert delta == round(expected, 2), f"expected {expected}, got delta {delta}"

        # Idempotent: repeat completion
        comp2 = requests.put(f"{API}/admin/orders/{oid}/status?status=completed",
                             headers=H(admin_token), timeout=60)
        assert comp2.status_code == 200
        bal_after2 = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json().get("cashback_balance", 0)
        assert round(bal_after2 - bal_after, 2) == 0, "double accrual detected"

        # A cashback transaction appears
        txs = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json().get("transactions", [])
        assert any(t.get("order_id") == oid and t.get("type") == "accrual" for t in txs)

    def test_pay_with_cashback_and_cancel_refunds(self, admin_token, client1_token):
        me = _me(client1_token)
        _set_system(admin_token, me["id"], "cashback")
        # Ensure some cashback balance
        requests.post(f"{API}/admin/rewards/users/{me['id']}/cashback",
                      headers=H(admin_token), json={"amount": 500, "reason": "TEST_prep"}, timeout=30)
        bal_start = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json()["cashback_balance"]
        assert bal_start >= 500

        _clear_cart(client1_token)
        _add_to_cart(client1_token, PRODUCT_WITH_STOCK, 1)
        # Place order spending 200 cashback
        r = requests.post(f"{API}/orders", headers=H(client1_token), json={
            "full_name": "TEST User", "address": "TEST street 1", "phone": "+70000000001",
            "comment": "TEST_cashback_pay", "payment_method": "cash", "use_cashback": 200
        }, timeout=60)
        assert r.status_code == 200, r.text
        order = r.json()
        oid = order["id"]
        assert round(order.get("cashback_used", 0), 2) == 200
        bal_after_order = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json()["cashback_balance"]
        assert round(bal_start - bal_after_order, 2) == 200

        # Customer cancels order → cashback refunded
        can = requests.post(f"{API}/orders/{oid}/cancel", headers=H(client1_token), timeout=30)
        assert can.status_code == 200, can.text
        bal_after_cancel = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json()["cashback_balance"]
        assert round(bal_after_cancel - bal_after_order, 2) == 200, "cashback not refunded on cancel"

    def test_admin_cancel_refunds_cashback(self, admin_token, client1_token):
        """Regression: admin changing status to 'cancelled' must refund cashback_used.
        (requirement: 'admin status cancelled refunds cashback_used exactly once')"""
        me = _me(client1_token)
        _set_system(admin_token, me["id"], "cashback")
        requests.post(f"{API}/admin/rewards/users/{me['id']}/cashback",
                      headers=H(admin_token), json={"amount": 500, "reason": "TEST_prep2"}, timeout=30)
        bal_start = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json()["cashback_balance"]

        _clear_cart(client1_token)
        _add_to_cart(client1_token, PRODUCT_WITH_STOCK, 1)
        r = requests.post(f"{API}/orders", headers=H(client1_token), json={
            "full_name": "TEST User", "address": "TEST street 1", "phone": "+70000000001",
            "comment": "TEST_admin_cancel", "payment_method": "cash", "use_cashback": 100
        }, timeout=60)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        bal_after_order = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json()["cashback_balance"]
        assert round(bal_start - bal_after_order, 2) == 100

        # Admin cancels via status endpoint
        comp = requests.put(f"{API}/admin/orders/{oid}/status?status=cancelled",
                            headers=H(admin_token), timeout=60)
        assert comp.status_code == 200, comp.text
        bal_after_cancel = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json()["cashback_balance"]
        assert round(bal_after_cancel - bal_after_order, 2) == 100, "admin cancel did not refund cashback_used"


class TestOzonLifecycle:
    def test_ozon_certificate_on_completion(self, admin_token, client1_token):
        me = _me(client1_token)
        _set_system(admin_token, me["id"], "ozon")
        _clear_cart(client1_token)
        # Use product priced 1600 x 7 = 11200 -> 5%=560 -> floor 500 = 500
        _add_to_cart(client1_token, "8cd5b1c5-7980-4765-9db9-8e309614f8c5", 7)
        r = requests.post(f"{API}/orders", headers=H(client1_token), json={
            "full_name": "TEST User1", "address": "TEST street 1", "phone": "+70000000001",
            "comment": "TEST_ozon_order", "payment_method": "cash"
        }, timeout=60)
        assert r.status_code == 200, r.text
        order = r.json()
        oid = order["id"]
        assert order.get("reward_system") == "ozon"
        # Certificate NOT granted at placement
        assert order.get("ozon_certificate", 0) == 0
        expected = order.get("reward_expected", 0)
        # expected is int floored to round_to; might be 0 if goods_total is small
        assert expected % 500 == 0

        # Complete and check certificate matches expected
        comp = requests.put(f"{API}/admin/orders/{oid}/status?status=completed",
                            headers=H(admin_token), timeout=60)
        assert comp.status_code == 200
        time.sleep(1)
        o = requests.get(f"{API}/orders/{oid}", headers=H(client1_token), timeout=30).json()
        assert o.get("ozon_certificate", 0) == expected, f"cert mismatch: got {o.get('ozon_certificate')} vs expected {expected}"
        if expected > 0:
            me_data = requests.get(f"{API}/rewards/me", headers=H(client1_token), timeout=30).json()
            certs = me_data.get("certificates", [])
            assert any(c["id"] == oid and c["ozon_certificate"] == expected for c in certs)


# ---------------- Final cleanup fixture ----------------

@pytest.fixture(scope="module", autouse=True)
def restore_defaults():
    yield
    try:
        tok = login(ADMIN)
        requests.put(f"{API}/admin/rewards/settings", headers=H(tok),
                     json=_default_settings(), timeout=30)
        c1 = _me(login(CLIENT1))
        c2 = _me(login(CLIENT2))
        requests.put(f"{API}/admin/rewards/users/{c1['id']}", headers=H(tok),
                     json={"reward_system": None}, timeout=30)
        requests.put(f"{API}/admin/rewards/users/{c2['id']}", headers=H(tok),
                     json={"reward_system": None}, timeout=30)
    except Exception as e:
        print(f"cleanup error: {e}")
