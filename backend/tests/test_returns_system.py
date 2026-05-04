"""Tests for Returns System (iteration 56)
Covers: POST /api/returns (return + warranty + validations),
GET /api/returns, GET /api/admin/returns (auth checks),
PUT /api/admin/returns/{id}/approve, /reject, double-process protection.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://spare-parts-admin-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"
CLIENT_EMAIL = "0x0errorr@gmail.com"
CLIENT_PASSWORD = "admin123"


# ---------- Fixtures ----------
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
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {client_token}"})
    assert r.status_code == 200
    return r.json()


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def completed_orders(client_token):
    """Get client's completed orders."""
    r = requests.get(f"{API}/orders", headers=_h(client_token))
    assert r.status_code == 200
    orders = [o for o in r.json() if o.get("status") == "completed" and o.get("items")]
    if not orders:
        pytest.skip("No completed orders for client - cannot test returns")
    return orders


@pytest.fixture(scope="session")
def pending_or_other_order(client_token):
    """Get a non-completed order for validation test."""
    r = requests.get(f"{API}/orders", headers=_h(client_token))
    assert r.status_code == 200
    others = [o for o in r.json() if o.get("status") != "completed" and o.get("items")]
    return others[0] if others else None


# ---------- Tests: Auth and listing ----------
class TestReturnsAuth:
    def test_admin_endpoint_forbidden_for_client(self, client_token):
        r = requests.get(f"{API}/admin/returns", headers=_h(client_token))
        assert r.status_code == 403

    def test_admin_endpoint_ok_for_admin(self, admin_token):
        r = requests.get(f"{API}/admin/returns", headers=_h(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_my_returns_requires_auth(self):
        r = requests.get(f"{API}/returns")
        assert r.status_code in (401, 403)

    def test_get_my_returns_ok(self, client_token):
        r = requests.get(f"{API}/returns", headers=_h(client_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Tests: Validations ----------
class TestReturnsValidation:
    def test_invalid_type(self, client_token, completed_orders):
        order = completed_orders[0]
        item = order["items"][0]
        payload = {
            "type": "garbage",
            "order_id": order["id"],
            "items": [{"product_id": item["product_id"], "quantity": 1}],
            "reason": "test",
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 400
        assert "Invalid return type" in r.text

    def test_order_not_found(self, client_token):
        payload = {
            "type": "return",
            "order_id": "nonexistent-id-xyz",
            "items": [{"product_id": "px", "quantity": 1}],
            "reason": "test",
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 404

    def test_only_completed_orders(self, client_token, pending_or_other_order):
        if not pending_or_other_order:
            pytest.skip("No non-completed order to test")
        order = pending_or_other_order
        item = order["items"][0]
        payload = {
            "type": "return",
            "order_id": order["id"],
            "items": [{"product_id": item["product_id"], "quantity": 1}],
            "reason": "test",
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 400
        assert "completed" in r.text.lower()

    def test_item_not_in_order(self, client_token, completed_orders):
        order = completed_orders[0]
        payload = {
            "type": "return",
            "order_id": order["id"],
            "items": [{"product_id": "fake-product-xyz", "quantity": 1}],
            "reason": "test",
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 400
        assert "not in order" in r.text.lower()


# ---------- Tests: Standard return flow ----------
class TestStandardReturnFlow:
    def test_create_standard_return_calculations(self, client_token, completed_orders, admin_token):
        order = completed_orders[0]
        item = order["items"][0]
        qty = 1
        item_total = item["price"] * qty
        expected_deduction = round(item_total * 0.10, 2)
        expected_refund = round(item_total - expected_deduction, 2)

        payload = {
            "type": "return",
            "order_id": order["id"],
            "items": [{"product_id": item["product_id"], "quantity": qty}],
            "reason": "TEST_standard_return",
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 200, r.text
        ret = r.json()
        assert ret["type"] == "return"
        assert ret["status"] == "pending"
        assert ret["total_deduction"] == pytest.approx(expected_deduction, abs=0.01)
        assert ret["total_refund"] == pytest.approx(expected_refund, abs=0.01)
        assert ret["total_bonus_deduction"] >= 0
        assert ret["order_id"] == order["id"]
        assert "id" in ret
        assert ret["items"][0]["product_id"] == item["product_id"]

        # Verify it appears in /api/returns
        my = requests.get(f"{API}/returns", headers=_h(client_token)).json()
        assert any(x["id"] == ret["id"] for x in my)

        # Verify admin sees it
        admin_list = requests.get(f"{API}/admin/returns", headers=_h(admin_token)).json()
        assert any(x["id"] == ret["id"] for x in admin_list)

        # Save id for next tests via class attr
        TestStandardReturnFlow.standard_return_id = ret["id"]
        TestStandardReturnFlow.standard_refund = ret["total_refund"]
        TestStandardReturnFlow.standard_bonus_deduction = ret["total_bonus_deduction"]
        TestStandardReturnFlow.user_id = ret["user_id"]

    def test_approve_standard_return_increases_balance(self, admin_token, client_token):
        return_id = getattr(TestStandardReturnFlow, "standard_return_id", None)
        if not return_id:
            pytest.skip("No return created")

        # Get balance before
        bal_before = requests.get(f"{API}/user/balance", headers=_h(client_token)).json().get("balance", 0)

        r = requests.put(
            f"{API}/admin/returns/{return_id}/approve",
            headers=_h(admin_token),
            json={"comment": "TEST_approved"},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "approved"

        # Verify return record is approved
        admin_list = requests.get(f"{API}/admin/returns", headers=_h(admin_token)).json()
        ret = next(x for x in admin_list if x["id"] == return_id)
        assert ret["status"] == "approved"
        assert ret["admin_comment"] == "TEST_approved"

        # Verify balance increased by total_refund
        bal_after = requests.get(f"{API}/user/balance", headers=_h(client_token)).json().get("balance", 0)
        expected = bal_before + TestStandardReturnFlow.standard_refund
        assert abs(bal_after - expected) < 0.5, (
            f"Balance not credited. before={bal_before}, after={bal_after}, refund={TestStandardReturnFlow.standard_refund}"
        )

        # Verify balance history has refund transaction
        hist = requests.get(f"{API}/user/balance/history", headers=_h(client_token)).json()
        txs = hist.get("transactions", [])
        refunds = [t for t in txs if t.get("type") == "refund"]
        assert len(refunds) > 0, "No refund transaction recorded"

    def test_double_approve_rejected(self, admin_token):
        return_id = getattr(TestStandardReturnFlow, "standard_return_id", None)
        if not return_id:
            pytest.skip("No return created")
        r = requests.put(
            f"{API}/admin/returns/{return_id}/approve",
            headers=_h(admin_token),
            json={"comment": "again"},
        )
        assert r.status_code == 400
        assert "already processed" in r.text.lower()

    def test_double_reject_already_processed(self, admin_token):
        return_id = getattr(TestStandardReturnFlow, "standard_return_id", None)
        if not return_id:
            pytest.skip("No return created")
        r = requests.put(
            f"{API}/admin/returns/{return_id}/reject",
            headers=_h(admin_token),
            json={"comment": "x"},
        )
        assert r.status_code == 400


# ---------- Tests: Warranty flow ----------
class TestWarrantyReturnFlow:
    def test_create_warranty_return(self, client_token, completed_orders):
        order = completed_orders[0]
        item = order["items"][0]
        payload = {
            "type": "warranty",
            "order_id": order["id"],
            "items": [{"product_id": item["product_id"], "quantity": 1}],
            "reason": "TEST_warranty",
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 200, r.text
        ret = r.json()
        assert ret["type"] == "warranty"
        assert ret["total_refund"] == 0
        assert ret["total_deduction"] == 0
        assert ret["total_bonus_deduction"] == 0
        assert ret["status"] == "pending"
        TestWarrantyReturnFlow.warranty_id = ret["id"]

    def test_approve_warranty_no_balance_change(self, admin_token, client_token):
        return_id = getattr(TestWarrantyReturnFlow, "warranty_id", None)
        if not return_id:
            pytest.skip("No warranty created")
        bal_before = requests.get(f"{API}/user/balance", headers=_h(client_token)).json().get("balance", 0)

        r = requests.put(
            f"{API}/admin/returns/{return_id}/approve",
            headers=_h(admin_token),
            json={"comment": "TEST_warranty_approve"},
        )
        assert r.status_code == 200

        bal_after = requests.get(f"{API}/user/balance", headers=_h(client_token)).json().get("balance", 0)
        assert bal_after == bal_before, "Warranty approval should not change balance"


# ---------- Tests: Reject flow ----------
class TestRejectFlow:
    def test_create_and_reject(self, client_token, admin_token, completed_orders):
        order = completed_orders[0]
        item = order["items"][0]
        payload = {
            "type": "return",
            "order_id": order["id"],
            "items": [{"product_id": item["product_id"], "quantity": 1}],
            "reason": "TEST_to_be_rejected",
        }
        r = requests.post(f"{API}/returns", headers=_h(client_token), json=payload)
        assert r.status_code == 200
        rid = r.json()["id"]

        rej = requests.put(
            f"{API}/admin/returns/{rid}/reject",
            headers=_h(admin_token),
            json={"comment": "TEST_rejection_reason"},
        )
        assert rej.status_code == 200
        assert rej.json().get("status") == "rejected"

        # Verify status, comment
        admin_list = requests.get(f"{API}/admin/returns", headers=_h(admin_token)).json()
        ret = next(x for x in admin_list if x["id"] == rid)
        assert ret["status"] == "rejected"
        assert ret["admin_comment"] == "TEST_rejection_reason"


# ---------- Tests: Privacy ----------
class TestReturnsPrivacy:
    def test_client_only_sees_own_returns(self, client_token, client_user):
        r = requests.get(f"{API}/returns", headers=_h(client_token))
        assert r.status_code == 200
        for ret in r.json():
            assert ret["user_id"] == client_user["id"]
