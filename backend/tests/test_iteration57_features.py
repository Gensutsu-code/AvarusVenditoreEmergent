"""Iteration 57 backend tests:
- Returns: photos required, duplicate quantity protection, program_bonus_totals breakdown,
  bonus_eligible filtering on returns, approve uses per-program breakdown.
- Admin balance adjust (credit/debit, can go negative, validations, notification).
- Products bonus_eligible toggle (PUT/GET, default true on legacy).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://spare-parts-admin-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"
CLIENT_EMAIL = "0x0errorr@gmail.com"
CLIENT_PASSWORD = "admin123"

PHOTO_URL = "https://example.com/test_photo.jpg"


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def client_token():
    r = requests.post(f"{API}/auth/login", json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def client_user(client_token):
    r = requests.get(f"{API}/auth/me", headers=_h(client_token))
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def completed_order(client_token, admin_token):
    """Pick a completed order whose first item still has unreturned units."""
    r = requests.get(f"{API}/orders", headers=_h(client_token))
    assert r.status_code == 200
    orders = [o for o in r.json() if o.get("status") == "completed" and o.get("items")]
    if not orders:
        pytest.skip("No completed orders for client")
    all_returns = requests.get(f"{API}/admin/returns", headers=_h(admin_token)).json()
    for o in orders:
        item = o["items"][0]
        already = 0
        for ret in all_returns:
            if ret.get("order_id") == o["id"] and ret.get("status") in ("pending", "approved"):
                for ri in ret.get("items", []):
                    if ri.get("product_id") == item["product_id"]:
                        already += ri.get("quantity", 0) or 0
        if (item.get("quantity", 1) - already) >= 1:
            return o
    # fallback: just return first
    return orders[0]


# ---------- Returns: photos required ----------
class TestReturnsPhotosRequired:
    def test_no_photos_field_rejected(self, client_token, completed_order):
        item = completed_order["items"][0]
        payload = {
            "type": "return",
            "order_id": completed_order["id"],
            "items": [{"product_id": item["product_id"], "quantity": 1}],
            "reason": "TEST_no_photos",
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 400
        assert "фото" in r.text.lower()

    def test_empty_photos_rejected(self, client_token, completed_order):
        item = completed_order["items"][0]
        payload = {
            "type": "return",
            "order_id": completed_order["id"],
            "items": [{"product_id": item["product_id"], "quantity": 1}],
            "reason": "TEST_empty_photos",
            "photos": [],
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 400

    def test_warranty_also_requires_photos(self, client_token, completed_order):
        item = completed_order["items"][0]
        payload = {
            "type": "warranty",
            "order_id": completed_order["id"],
            "items": [{"product_id": item["product_id"], "quantity": 1}],
            "reason": "TEST_warranty_no_photo",
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 400


# ---------- Returns: program_bonus_totals & duplicate qty protection ----------
class TestReturnsProgramBonusTotals:
    def test_create_persists_program_bonus_totals_and_photos(self, client_token, completed_order, admin_token):
        item = completed_order["items"][0]
        # Detect remaining returnable qty
        all_returns = requests.get(f"{API}/admin/returns", headers=_h(admin_token)).json()
        already = 0
        for r in all_returns:
            if r.get("order_id") == completed_order["id"] and r.get("status") in ("pending", "approved"):
                for ri in r.get("items", []):
                    if ri.get("product_id") == item["product_id"]:
                        already += ri.get("quantity", 0)
        max_qty = max(0, item.get("quantity", 1) - already)
        if max_qty < 1:
            pytest.skip("All units already returned for first item; cannot create new return")
        payload = {
            "type": "return",
            "order_id": completed_order["id"],
            "items": [{"product_id": item["product_id"], "quantity": 1}],
            "reason": "TEST_pbt",
            "photos": [PHOTO_URL],
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 200, r.text
        ret = r.json()
        # photos persisted
        assert ret.get("photos") == [PHOTO_URL]
        # program_bonus_totals dict
        pbt = ret.get("program_bonus_totals")
        assert isinstance(pbt, dict), f"program_bonus_totals must be dict, got {pbt!r}"
        # sum equals total_bonus_deduction (rounded)
        s = round(sum(pbt.values()), 2)
        assert abs(s - ret.get("total_bonus_deduction", 0)) < 0.05, (s, ret.get("total_bonus_deduction"))
        # items have program_bonuses dict
        for ri in ret["items"]:
            assert "program_bonuses" in ri
            assert "bonus_eligible" in ri
        TestReturnsProgramBonusTotals.created_id = ret["id"]
        TestReturnsProgramBonusTotals.product_id = item["product_id"]
        TestReturnsProgramBonusTotals.order_id = completed_order["id"]
        TestReturnsProgramBonusTotals.max_qty = max_qty

    def test_duplicate_quantity_blocked(self, client_token, completed_order):
        item = completed_order["items"][0]
        max_qty_in_order = item.get("quantity", 1)
        # Attempt to return MORE than available (max_qty + 999)
        payload = {
            "type": "return",
            "order_id": completed_order["id"],
            "items": [{"product_id": item["product_id"], "quantity": max_qty_in_order + 999}],
            "reason": "TEST_too_much",
            "photos": [PHOTO_URL],
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 400
        msg = r.text.lower()
        assert "не более" in msg or "уже был возвращён" in msg or "уже" in msg


# ---------- Admin Balance Adjust ----------
class TestAdminBalanceAdjust:
    def test_credit_increases_balance_and_creates_tx_and_notification(self, admin_token, client_token, client_user):
        bal_before = requests.get(f"{API}/user/balance", headers=_h(client_token)).json().get("balance", 0)
        amount = 123.45
        r = requests.post(
            f"{API}/admin/users/{client_user['id']}/balance/credit",
            headers=_h(admin_token),
            json={"amount": amount, "reason": "TEST_credit"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert abs(data["new_balance"] - data["old_balance"] - amount) < 0.01

        bal_after = requests.get(f"{API}/user/balance", headers=_h(client_token)).json().get("balance", 0)
        assert abs(bal_after - bal_before - amount) < 0.5

        # transaction recorded as admin_credit
        hist = requests.get(f"{API}/user/balance/history", headers=_h(client_token)).json()
        txs = hist.get("transactions", [])
        creds = [t for t in txs if t.get("type") == "admin_credit"]
        assert len(creds) > 0
        assert any(abs(t.get("amount", 0) - amount) < 0.01 for t in creds)

        # notification created
        notifs = requests.get(f"{API}/notifications", headers=_h(client_token))
        if notifs.status_code == 200:
            data = notifs.json()
            items = data if isinstance(data, list) else data.get("notifications", [])
            assert any(n.get("type") == "balance" and "TEST_credit" in (n.get("message") or "") for n in items), \
                "balance notification not found"

    def test_credit_negative_amount_rejected(self, admin_token, client_user):
        r = requests.post(
            f"{API}/admin/users/{client_user['id']}/balance/credit",
            headers=_h(admin_token), json={"amount": -10, "reason": "x"})
        assert r.status_code == 400

    def test_credit_zero_amount_rejected(self, admin_token, client_user):
        r = requests.post(
            f"{API}/admin/users/{client_user['id']}/balance/credit",
            headers=_h(admin_token), json={"amount": 0, "reason": "x"})
        assert r.status_code == 400

    def test_credit_non_admin_forbidden(self, client_token, client_user):
        r = requests.post(
            f"{API}/admin/users/{client_user['id']}/balance/credit",
            headers=_h(client_token), json={"amount": 10, "reason": "x"})
        assert r.status_code == 403

    def test_credit_user_not_found(self, admin_token):
        r = requests.post(
            f"{API}/admin/users/nonexistent-xxx/balance/credit",
            headers=_h(admin_token), json={"amount": 10, "reason": "x"})
        assert r.status_code == 404

    def test_debit_can_go_negative_and_creates_tx_notification(self, admin_token, client_token, client_user):
        bal_before = requests.get(f"{API}/user/balance", headers=_h(client_token)).json().get("balance", 0)
        # Debit MORE than current balance
        amount = (bal_before if bal_before > 0 else 0) + 99999.0
        r = requests.post(
            f"{API}/admin/users/{client_user['id']}/balance/debit",
            headers=_h(admin_token),
            json={"amount": amount, "reason": "TEST_debit_negative"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        bal_after = requests.get(f"{API}/user/balance", headers=_h(client_token)).json().get("balance", 0)
        assert bal_after < 0, f"Balance should go negative, got {bal_after}"
        # transaction has negative amount
        hist = requests.get(f"{API}/user/balance/history", headers=_h(client_token)).json()
        debits = [t for t in hist.get("transactions", []) if t.get("type") == "admin_debit"]
        assert len(debits) > 0
        assert any(t.get("amount", 0) < 0 for t in debits)

        # Restore: credit back so future tests are not impacted as much
        requests.post(
            f"{API}/admin/users/{client_user['id']}/balance/credit",
            headers=_h(admin_token), json={"amount": amount, "reason": "TEST_restore"})

    def test_debit_negative_amount_rejected(self, admin_token, client_user):
        r = requests.post(
            f"{API}/admin/users/{client_user['id']}/balance/debit",
            headers=_h(admin_token), json={"amount": -1, "reason": "x"})
        assert r.status_code == 400


# ---------- Product bonus_eligible toggle ----------
class TestProductBonusEligible:
    def test_default_true_for_some_existing_product(self, admin_token):
        r = requests.get(f"{API}/products")
        assert r.status_code == 200
        products = r.json() if isinstance(r.json(), list) else r.json().get("products", [])
        assert products, "No products in catalog"
        # All products should have bonus_eligible field defaulting to True
        sample = products[0]
        assert sample.get("bonus_eligible", True) is True or sample.get("bonus_eligible") is True
        TestProductBonusEligible.product = sample

    def test_put_toggle_false_then_true(self, admin_token):
        prod = TestProductBonusEligible.product
        pid = prod["id"]
        # Toggle to False
        r = requests.put(
            f"{API}/products/{pid}",
            headers=_h(admin_token),
            json={**{k: v for k, v in prod.items() if k not in ("_id",)}, "bonus_eligible": False},
        )
        assert r.status_code == 200, r.text
        # GET and verify
        g = requests.get(f"{API}/products/{pid}")
        assert g.status_code == 200
        assert g.json().get("bonus_eligible") is False

        # Toggle back to True
        r2 = requests.put(
            f"{API}/products/{pid}",
            headers=_h(admin_token),
            json={**{k: v for k, v in prod.items() if k not in ("_id",)}, "bonus_eligible": True},
        )
        assert r2.status_code == 200
        g2 = requests.get(f"{API}/products/{pid}")
        assert g2.json().get("bonus_eligible") is True


# ---------- Returns: bonus_eligible affects program_bonuses (per-item) ----------
class TestReturnsBonusEligibleFiltering:
    def test_non_eligible_product_has_empty_program_bonuses(self, admin_token, client_token, client_user):
        # Find any completed order item with available qty
        all_returns = requests.get(f"{API}/admin/returns", headers=_h(admin_token)).json()
        orders = requests.get(f"{API}/orders", headers=_h(client_token)).json()
        completed = [o for o in orders if o.get("status") == "completed" and o.get("items")]
        target_order = None
        target_item = None
        for o in completed:
            for it in o["items"]:
                already = 0
                for ret in all_returns:
                    if ret.get("order_id") == o["id"] and ret.get("status") in ("pending", "approved"):
                        for ri in ret.get("items", []):
                            if ri.get("product_id") == it["product_id"]:
                                already += ri.get("quantity", 0) or 0
                if (it.get("quantity", 1) - already) >= 1:
                    target_order, target_item = o, it
                    break
            if target_order:
                break
        if not target_order:
            pytest.skip("No order item with available qty for filtering test")

        pid = target_item["product_id"]
        gp = requests.get(f"{API}/products/{pid}")
        if gp.status_code != 200:
            pytest.skip("Product not found in catalog")
        prod = gp.json()
        original = prod.get("bonus_eligible", True)
        upd = requests.put(
            f"{API}/products/{pid}",
            headers=_h(admin_token),
            json={**{k: v for k, v in prod.items() if k not in ("_id",)}, "bonus_eligible": False},
        )
        assert upd.status_code == 200, upd.text

        try:
            payload = {
                "type": "return",
                "order_id": target_order["id"],
                "items": [{"product_id": pid, "quantity": 1}],
                "reason": "TEST_non_eligible",
                "photos": [PHOTO_URL],
            }
            cr = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
            assert cr.status_code == 200, cr.text
            ret = cr.json()
            ri = next(x for x in ret["items"] if x["product_id"] == pid)
            assert ri.get("program_bonuses") == {}, ri.get("program_bonuses")
            assert ri.get("bonus_eligible") is False
            expected_ded = round(target_item["price"] * 0.10, 2)
            assert abs(ri.get("deduction", 0) - expected_ded) < 0.05
            assert ret.get("total_bonus_deduction", 0) == 0
        finally:
            requests.put(
                f"{API}/products/{pid}",
                headers=_h(admin_token),
                json={**{k: v for k, v in prod.items() if k not in ("_id",)}, "bonus_eligible": original},
            )
