"""Iter 84 backend tests:
- TASK1 product-request status flow: pending->processing->completed; ContactPage status text indirectly via /me/product-requests
- TASK5 /api/admin/dashboard returns total_revenue / avg_order_value / total_customers
"""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://order-merge-fulfill.preview.emergentagent.com").rstrip("/")


def _login(email, password):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@avarus.ru", "admin")


@pytest.fixture(scope="module")
def client_token():
    return _login("user@demo.com", "demo123")


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------------- TASK5: dashboard totals ----------------
def test_admin_dashboard_totals(admin_token):
    r = requests.get(f"{BASE}/api/admin/dashboard", headers=_h(admin_token), timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    totals = data.get("totals") or {}
    print("totals:", totals)
    # required keys
    for k in ("orders_total", "total_revenue", "avg_order_value", "total_customers"):
        assert k in totals, f"missing key {k} in totals: {totals}"
    # numeric types
    assert isinstance(totals["orders_total"], (int, float))
    assert isinstance(totals["total_revenue"], (int, float))
    assert isinstance(totals["avg_order_value"], (int, float))
    assert isinstance(totals["total_customers"], (int, float))


# ---------------- TASK1: product request flow ----------------
def test_product_request_status_flow(client_token, admin_token):
    # 1. Client creates a product request
    payload = {"article": "TEST_PR_ARTICLE_84", "quantity": 2, "comment": "test request iter84"}
    r = requests.post(f"{BASE}/api/product-requests", headers=_h(client_token), json=payload, timeout=20)
    assert r.status_code in (200, 201), f"create request: {r.status_code} {r.text}"
    pr = r.json()
    pr_id = pr.get("id") or pr.get("_id")
    assert pr_id, f"no id in created PR: {pr}"
    assert pr.get("status") == "pending", f"expected pending, got {pr.get('status')}"

    # 2. Admin moves to processing
    r = requests.put(
        f"{BASE}/api/admin/product-requests/{pr_id}/respond",
        headers=_h(admin_token),
        json={"status": "processing", "response_message": "в работе"},
        timeout=20,
    )
    assert r.status_code == 200, f"to processing: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("status") == "processing", body

    # 3. Admin completes
    r = requests.put(
        f"{BASE}/api/admin/product-requests/{pr_id}/respond",
        headers=_h(admin_token),
        json={"status": "completed", "response_message": "готово"},
        timeout=20,
    )
    assert r.status_code == 200, f"to completed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("status") == "completed", body

    # 4. Client sees the request in their list with completed status
    r = requests.get(f"{BASE}/api/product-requests/my", headers=_h(client_token), timeout=20)
    assert r.status_code == 200, f"client list: {r.status_code} {r.text}"
    lst = r.json()
    items = lst if isinstance(lst, list) else lst.get("items") or lst.get("data") or []
    found = next((x for x in items if (x.get("id") or x.get("_id")) == pr_id), None)
    assert found is not None, f"created PR {pr_id} not in client list"
    assert found.get("status") == "completed", f"client sees status {found.get('status')}"


# ---------------- TASK1: reject flow ----------------
def test_product_request_reject_flow(client_token, admin_token):
    r = requests.post(
        f"{BASE}/api/product-requests",
        headers=_h(client_token),
        json={"article": "TEST_PR_REJECT_84", "quantity": 1, "comment": "to reject"},
        timeout=20,
    )
    assert r.status_code in (200, 201), r.text
    pr_id = r.json().get("id") or r.json().get("_id")
    r = requests.put(
        f"{BASE}/api/admin/product-requests/{pr_id}/respond",
        headers=_h(admin_token),
        json={"status": "rejected", "response_message": "отклонено"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "rejected"
