"""Iteration 60: Admin merge orders + partial fulfillment tests."""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-merge-fulfill.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@avarus.ru", "password": "admin"}
USER1 = {"email": "user@demo.com", "password": "demo123"}
USER2 = {"email": "0x0errorr@gmail.com", "password": "admin123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login fail {creds['email']}: {r.status_code} {r.text}"
    j = r.json()
    return j.get("access_token") or j.get("token")


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "admin": _login(ADMIN),
        "user1": _login(USER1),
        "user2": _login(USER2),
    }


@pytest.fixture(scope="module")
def two_products(tokens):
    """Pick 2 products with stock > 0 for ordering."""
    r = requests.get(f"{API}/products?limit=50", timeout=20)
    assert r.status_code == 200
    products = r.json()
    if isinstance(products, dict):
        products = products.get("products") or products.get("items") or []
    picked = [p for p in products if (p.get("stock") or 0) >= 5][:2]
    if len(picked) < 2:
        picked = [p for p in products if (p.get("stock") or 0) >= 1][:2]
    assert len(picked) >= 2, "Need at least 2 in-stock products for tests"
    return picked


def _clear_cart(token):
    requests.delete(f"{API}/cart", headers=_headers(token), timeout=20)


def _add_to_cart(token, product_id, qty):
    r = requests.post(f"{API}/cart/add", headers=_headers(token),
                      json={"product_id": product_id, "quantity": qty}, timeout=20)
    assert r.status_code == 200, f"cart/add {r.status_code} {r.text}"


def _create_order(token, items, payment_method="cash"):
    _clear_cart(token)
    for pid, q in items:
        _add_to_cart(token, pid, q)
    payload = {
        "full_name": "Test User",
        "address": "Test addr",
        "phone": "+79990000000",
        "comment": "TEST_iter60",
        "payment_method": payment_method,
    }
    r = requests.post(f"{API}/orders", headers=_headers(token), json=payload, timeout=20)
    assert r.status_code == 200, f"order create {r.status_code} {r.text}"
    return r.json()


# ==================== MERGE ====================

class TestMergeOrders:
    def test_merge_same_user_aggregates_and_deletes_originals(self, tokens, two_products):
        p1, p2 = two_products[0], two_products[1]
        o1 = _create_order(tokens["user1"], [(p1["id"], 1), (p2["id"], 2)])
        o2 = _create_order(tokens["user1"], [(p1["id"], 3)])  # overlap with p1
        ids = [o1["id"], o2["id"]]

        r = requests.post(f"{API}/admin/orders/merge",
                          headers=_headers(tokens["admin"]),
                          json={"order_ids": ids}, timeout=20)
        assert r.status_code == 200, f"merge: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("success") is True
        new_order = body["order"]
        assert set(new_order["merged_from"]) == set(ids)

        # Aggregation: p1 qty = 1+3=4, p2 qty = 2
        items = {it["product_id"]: it["quantity"] for it in new_order["items"]}
        assert items.get(p1["id"]) == 4, f"p1 expected 4 got {items.get(p1['id'])}"
        assert items.get(p2["id"]) == 2, f"p2 expected 2 got {items.get(p2['id'])}"

        # Originals deleted
        for oid in ids:
            check = requests.get(f"{API}/admin/orders/{oid}",
                                 headers=_headers(tokens["admin"]), timeout=20)
            # admin endpoint maybe missing → fallback to user endpoint
            if check.status_code in (404, 200) and check.status_code == 200:
                pytest.fail(f"Original order {oid} still exists after merge")

        # Verify via user list as well
        ru = requests.get(f"{API}/orders", headers=_headers(tokens["user1"]), timeout=20)
        ids_after = {o["id"] for o in ru.json()}
        assert o1["id"] not in ids_after, "o1 still in user list"
        assert o2["id"] not in ids_after, "o2 still in user list"
        assert new_order["id"] in ids_after, "merged order not in user list"

        # Cleanup: cancel the merged order
        requests.post(f"{API}/orders/{new_order['id']}/cancel",
                      headers=_headers(tokens["user1"]), timeout=20)

    def test_merge_rejects_different_users(self, tokens, two_products):
        p1 = two_products[0]
        o1 = _create_order(tokens["user1"], [(p1["id"], 1)])
        o2 = _create_order(tokens["user2"], [(p1["id"], 1)])

        r = requests.post(f"{API}/admin/orders/merge",
                          headers=_headers(tokens["admin"]),
                          json={"order_ids": [o1["id"], o2["id"]]}, timeout=20)
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"
        assert "different" in r.text.lower() or "users" in r.text.lower()

        # cleanup
        requests.post(f"{API}/orders/{o1['id']}/cancel", headers=_headers(tokens["user1"]), timeout=20)
        requests.post(f"{API}/orders/{o2['id']}/cancel", headers=_headers(tokens["user2"]), timeout=20)

    def test_merge_rejects_completed_order(self, tokens, two_products):
        p1 = two_products[0]
        o1 = _create_order(tokens["user1"], [(p1["id"], 1)])
        o2 = _create_order(tokens["user1"], [(p1["id"], 1)])

        # Status endpoint is PUT /api/admin/orders/{id}/status?status=completed (query param)
        marked = False
        r = requests.put(f"{API}/admin/orders/{o2['id']}/status",
                         params={"status": "completed"},
                         headers=_headers(tokens["admin"]), timeout=20)
        if r.status_code in (200, 204):
            marked = True

        if not marked:
            pytest.skip("No admin status-update endpoint found to mark order completed")

        r = requests.post(f"{API}/admin/orders/merge",
                          headers=_headers(tokens["admin"]),
                          json={"order_ids": [o1["id"], o2["id"]]}, timeout=20)
        assert r.status_code == 400, f"expected 400 (completed) got {r.status_code} {r.text}"

        requests.post(f"{API}/orders/{o1['id']}/cancel", headers=_headers(tokens["user1"]), timeout=20)

    def test_merge_rejects_non_admin(self, tokens, two_products):
        p1 = two_products[0]
        o1 = _create_order(tokens["user1"], [(p1["id"], 1)])
        o2 = _create_order(tokens["user1"], [(p1["id"], 1)])

        r = requests.post(f"{API}/admin/orders/merge",
                          headers=_headers(tokens["user1"]),
                          json={"order_ids": [o1["id"], o2["id"]]}, timeout=20)
        assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text}"

        requests.post(f"{API}/orders/{o1['id']}/cancel", headers=_headers(tokens["user1"]), timeout=20)
        requests.post(f"{API}/orders/{o2['id']}/cancel", headers=_headers(tokens["user1"]), timeout=20)

    def test_merge_rejects_less_than_2(self, tokens, two_products):
        p1 = two_products[0]
        o1 = _create_order(tokens["user1"], [(p1["id"], 1)])
        r = requests.post(f"{API}/admin/orders/merge",
                          headers=_headers(tokens["admin"]),
                          json={"order_ids": [o1["id"]]}, timeout=20)
        assert r.status_code == 400
        requests.post(f"{API}/orders/{o1['id']}/cancel", headers=_headers(tokens["user1"]), timeout=20)


# ==================== FULFILL ====================

class TestFulfillPartial:
    def test_partial_then_complete(self, tokens, two_products):
        p1 = two_products[0]
        o = _create_order(tokens["user1"], [(p1["id"], 5)])
        oid = o["id"]

        # Partial: qf=3
        r = requests.patch(f"{API}/admin/orders/{oid}/fulfill",
                           headers=_headers(tokens["admin"]),
                           json={"items": [{"product_id": p1["id"], "quantity_fulfilled": 3}]},
                           timeout=20)
        assert r.status_code == 200, f"partial fulfill {r.status_code} {r.text}"
        body = r.json()
        assert body.get("status") == "partially_fulfilled", f"status was {body.get('status')}"
        # fulfilled_total = price * 3
        price = next((it["price"] for it in body["items"] if it["product_id"] == p1["id"]), 0)
        assert abs(body["fulfilled_total"] - price * 3) < 0.01
        qfs = {it["product_id"]: it["quantity_fulfilled"] for it in body["items"]}
        assert qfs[p1["id"]] == 3

        # Full: qf=5
        r2 = requests.patch(f"{API}/admin/orders/{oid}/fulfill",
                            headers=_headers(tokens["admin"]),
                            json={"items": [{"product_id": p1["id"], "quantity_fulfilled": 5}]},
                            timeout=20)
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2.get("status") == "completed", f"status was {body2.get('status')}"

    def test_fulfill_clamps_above_qty(self, tokens, two_products):
        p1 = two_products[0]
        o = _create_order(tokens["user1"], [(p1["id"], 2)])
        oid = o["id"]

        r = requests.patch(f"{API}/admin/orders/{oid}/fulfill",
                           headers=_headers(tokens["admin"]),
                           json={"items": [{"product_id": p1["id"], "quantity_fulfilled": 99}]},
                           timeout=20)
        assert r.status_code == 200
        body = r.json()
        qf = next(it["quantity_fulfilled"] for it in body["items"] if it["product_id"] == p1["id"])
        assert qf == 2, f"qf should clamp to 2, got {qf}"
        assert body["status"] == "completed"

    def test_fulfill_clamps_below_zero(self, tokens, two_products):
        p1 = two_products[0]
        o = _create_order(tokens["user1"], [(p1["id"], 2)])
        oid = o["id"]

        r = requests.patch(f"{API}/admin/orders/{oid}/fulfill",
                           headers=_headers(tokens["admin"]),
                           json={"items": [{"product_id": p1["id"], "quantity_fulfilled": -10}]},
                           timeout=20)
        assert r.status_code == 200
        body = r.json()
        qf = next(it["quantity_fulfilled"] for it in body["items"] if it["product_id"] == p1["id"])
        assert qf == 0, f"qf should clamp to 0, got {qf}"

        # cleanup
        requests.post(f"{API}/orders/{oid}/cancel", headers=_headers(tokens["user1"]), timeout=20)

    def test_fulfill_non_admin_403(self, tokens, two_products):
        p1 = two_products[0]
        o = _create_order(tokens["user1"], [(p1["id"], 2)])
        oid = o["id"]

        r = requests.patch(f"{API}/admin/orders/{oid}/fulfill",
                           headers=_headers(tokens["user1"]),
                           json={"items": [{"product_id": p1["id"], "quantity_fulfilled": 1}]},
                           timeout=20)
        assert r.status_code == 403
        requests.post(f"{API}/orders/{oid}/cancel", headers=_headers(tokens["user1"]), timeout=20)
