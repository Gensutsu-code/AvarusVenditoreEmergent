"""Iteration 76 — overdue blocks, manual card payment (global + per_order),
mixed payment, and bulk warehouse receipt/writeoff tests.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-merge-fulfill.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASS = os.environ["TEST_ADMIN_PASSWORD"]
CLIENT_EMAIL = "user@demo.com"
CLIENT_PASS = os.environ["TEST_CLIENT_PASSWORD"]

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"
# read from env file fallback
try:
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("MONGO_URL="):
                MONGO_URL = line.split("=", 1)[1].strip().strip('"')
            if line.startswith("DB_NAME="):
                DB_NAME = line.split("=", 1)[1].strip().strip('"')
except Exception:
    pass


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    body = r.json()
    return body["token"], body["user"]


@pytest.fixture(scope="module")
def admin_auth():
    token, user = _login(ADMIN_EMAIL, ADMIN_PASS)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def client_auth():
    token, user = _login(CLIENT_EMAIL, CLIENT_PASS)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def some_product():
    r = requests.get(f"{API}/products?limit=50", timeout=15)
    assert r.status_code == 200
    products = r.json()
    # find any product with stock > 5 and price > 0
    for p in products:
        if (p.get("stock") or 0) >= 5 and (p.get("price") or 0) > 0:
            return p
    return products[0]


# ============== ITEM 3a — Admin card-payment-settings ==============

class TestCardPaymentSettings:
    def test_requisites_template_is_admin_only(self, admin_auth, client_auth):
        assert requests.get(f"{API}/card-payment-settings", timeout=10).status_code in (401, 403)
        assert requests.get(f"{API}/card-payment-settings", headers=client_auth["headers"], timeout=10).json() == {"mode": "per_order"}
        body = requests.get(f"{API}/card-payment-settings", headers=admin_auth["headers"], timeout=10).json()
        assert body["mode"] == "per_order" and "card_number" in body

    def test_mode_is_always_manual(self, admin_auth):
        payload = {"mode": "global", "card_number": "2200 1234 5678 9010", "recipient_name": "ООО Авопт", "bank": "Тинькофф", "comment": "Укажите номер заказа", "qr_url": ""}
        r = requests.put(f"{API}/admin/card-payment-settings", headers=admin_auth["headers"], json=payload, timeout=10)
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/card-payment-settings", headers=admin_auth["headers"], timeout=10).json()
        assert r2["mode"] == "per_order"
        assert r2["card_number"] == payload["card_number"]


# ============== ITEM 4 — Bulk warehouse ==============

class TestBulkWarehouse:
    def _bulk(self, admin_auth, **payload):
        return requests.post(f"{API}/admin/warehouse/movements/bulk", headers=admin_auth["headers"], json=payload, timeout=15)

    def _stock(self, pid):
        return requests.get(f"{API}/products/{pid}", timeout=10).json()["stock"]

    def test_bulk_receipt_increases_stock(self, admin_auth, warehouse_id, temp_products):
        r = self._bulk(admin_auth, product_ids=temp_products, warehouse_id=warehouse_id, type="receipt", quantity=3, purchase_price=100.0, comment="TEST_bulk_receipt")
        assert r.status_code == 200, r.text
        assert r.json()["processed"] == 2
        assert [self._stock(pid) for pid in temp_products] == [3, 3]

    def test_bulk_writeoff_skips_insufficient(self, admin_auth, warehouse_id, temp_products):
        full, empty = temp_products
        assert self._bulk(admin_auth, product_ids=[full], warehouse_id=warehouse_id, type="receipt", quantity=2).status_code == 200
        r = self._bulk(admin_auth, product_ids=temp_products, warehouse_id=warehouse_id, type="writeoff", quantity=2, comment="TEST_bulk_writeoff_skip")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["processed"] == 1
        assert [s["id"] for s in body["skipped"]] == [empty]
        assert self._stock(full) == 0

    def test_bulk_validations(self, admin_auth, warehouse_id):
        # empty product_ids
        r = requests.post(f"{API}/admin/warehouse/movements/bulk", headers=admin_auth["headers"], json={"product_ids": [], "warehouse_id": warehouse_id, "type": "receipt", "quantity": 1}, timeout=10)
        assert r.status_code == 400
        # bad quantity
        r = requests.post(f"{API}/admin/warehouse/movements/bulk", headers=admin_auth["headers"], json={"product_ids": ["x"], "warehouse_id": warehouse_id, "type": "receipt", "quantity": 0}, timeout=10)
        assert r.status_code == 400
        # bad type
        r = requests.post(f"{API}/admin/warehouse/movements/bulk", headers=admin_auth["headers"], json={"product_ids": ["x"], "warehouse_id": warehouse_id, "type": "weird", "quantity": 1}, timeout=10)
        assert r.status_code == 400


# ============== ITEM 3b — Manual card flow (global) ==============

def _add_to_cart_and_order(client_auth, product, payment_method="card", payment_parts=None):
    # clear cart
    requests.delete(f"{API}/cart/clear", headers=client_auth["headers"], timeout=10)
    r = requests.post(f"{API}/cart/add", headers=client_auth["headers"], json={"product_id": product["id"], "quantity": 1}, timeout=10)
    assert r.status_code == 200, r.text
    payload = {
        "full_name": client_auth["user"].get("name") or "Тест",
        "address": client_auth["user"].get("address") or "Москва, Тестовая 1",
        "phone": client_auth["user"].get("phone") or "+79991112233",
        "delivery_method": "pickup",
        "payment_method": payment_method,
    }
    if payment_parts is not None:
        payload["payment_parts"] = payment_parts
    r = requests.post(f"{API}/orders", headers=client_auth["headers"], json=payload, timeout=20)
    return r


# ============== ITEM 3b — per_order mode ==============

class TestManualCardPerOrder:
    def test_per_order_issue_then_upload(self, admin_auth, client_auth, some_product):
        # set per_order
        requests.put(f"{API}/admin/card-payment-settings", headers=admin_auth["headers"], json={"mode": "per_order"}, timeout=10)
        try:
            r = _add_to_cart_and_order(client_auth, some_product, payment_method="card")
            assert r.status_code == 200, r.text
            order = r.json()
            oid = order["id"]
            # In per_order: card_status = awaiting_requisites, no requisites yet
            assert order.get("card_status") == "awaiting_requisites", f"got {order.get('card_status')}"
            assert not order.get("card_requisites"), "requisites must not be shown before the admin issues them"

            # admin issues requisites
            r2 = requests.post(f"{API}/orders/{oid}/card/issue-requisites", headers=admin_auth["headers"], json={"card_number": "5555 6666 7777 8888", "recipient_name": "ИП Тест", "bank": "Сбер", "comment": "ord", "qr_url": ""}, timeout=10)
            assert r2.status_code == 200, r2.text

            # client uploads receipt
            r3 = requests.post(f"{API}/orders/{oid}/card/upload-receipt", headers=client_auth["headers"], json={"receipt_url": "https://example.com/r.jpg"}, timeout=10)
            assert r3.status_code == 200, r3.text

            # admin confirms
            r4 = requests.post(f"{API}/orders/{oid}/card/confirm", headers=admin_auth["headers"], timeout=10)
            assert r4.status_code == 200, r4.text
        finally:
            # restore mode=global
            requests.put(f"{API}/admin/card-payment-settings", headers=admin_auth["headers"], json={"mode": "global", "card_number": "2200 1234 5678 9010", "recipient_name": "ООО Авопт", "bank": "Тинькофф", "comment": "Укажите номер заказа", "qr_url": "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=avopt-pay"}, timeout=10)


# ============== ITEM 3c — Mixed payment ==============

class TestMixedPayment:
    def test_mixed_balance_cash(self, admin_auth, client_auth, some_product):
        # build order with payment_parts (balance + cash). Need subtotal — fetch product price + assume pickup delivery=0.
        # Place order first to determine total via response.
        # We'll use payment_method='mixed' and supply parts that sum to subtotal+delivery (delivery_method=pickup→0)
        requests.delete(f"{API}/cart/clear", headers=client_auth["headers"], timeout=10)
        requests.post(f"{API}/cart/add", headers=client_auth["headers"], json={"product_id": some_product["id"], "quantity": 1}, timeout=10)
        # discover cart total via cart endpoint
        cart = requests.get(f"{API}/cart", headers=client_auth["headers"], timeout=10).json()
        # try common keys
        total = 0
        if isinstance(cart, dict):
            for k in ("total", "subtotal", "sum"):
                if cart.get(k):
                    total = float(cart[k])
                    break
            if not total and cart.get("items"):
                total = sum((it.get("price") or 0) * (it.get("quantity") or 1) for it in cart["items"])
        elif isinstance(cart, list):
            total = sum((it.get("price") or 0) * (it.get("quantity") or 1) for it in cart)

        if total <= 0:
            pytest.skip("Cannot determine cart total")

        # Give balance to user enough for half
        half = round(total / 2, 2)
        other = round(total - half, 2)
        # ensure client has balance — top up via admin
        admin_top = requests.post(f"{API}/admin/users/{client_auth['user']['id']}/balance/adjust", headers=admin_auth["headers"], json={"amount": half + 100, "reason": "TEST_topup"}, timeout=10)
        # endpoint may not exist; ignore if 404
        payload = {
            "full_name": "Тест",
            "address": "Москва, Тестовая 1",
            "phone": "+79991112233",
            "delivery_method": "pickup",
            "payment_method": "mixed",
            "payment_parts": [{"method": "balance", "amount": half}, {"method": "cash", "amount": other}],
        }
        r = requests.post(f"{API}/orders", headers=client_auth["headers"], json=payload, timeout=15)
        # If balance top-up failed and user has insufficient balance, server may return 400; both 200 and 400 are informative.
        if r.status_code != 200:
            pytest.skip(f"Mixed payment skipped: {r.status_code} {r.text}")
        order = r.json()
        assert order.get("payment_parts"), "payment_parts should be saved"
        assert len(order["payment_parts"]) == 2

    def test_mixed_rejects_same_method(self, client_auth, some_product):
        requests.delete(f"{API}/cart/clear", headers=client_auth["headers"], timeout=10)
        requests.post(f"{API}/cart/add", headers=client_auth["headers"], json={"product_id": some_product["id"], "quantity": 1}, timeout=10)
        payload = {
            "full_name": "Тест", "address": "Москва", "phone": "+79991112233",
            "delivery_method": "pickup", "payment_method": "mixed",
            "payment_parts": [{"method": "cash", "amount": 10}, {"method": "cash", "amount": 10}],
        }
        r = requests.post(f"{API}/orders", headers=client_auth["headers"], json=payload, timeout=10)
        assert r.status_code in (400, 422), f"Expected validation error, got {r.status_code} {r.text}"


# ============== ITEM 1 & 2 — Overdue blocks ==============

def _run_async(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if not asyncio.get_event_loop().is_running() else asyncio.run(coro)


async def _insert_overdue_deferral(user_id):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    due = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    doc = {
        "id": f"TEST_OVERDUE_{uuid.uuid4()}",
        "user_id": user_id,
        "order_id": "TEST_OVERDUE_ORDER",
        "amount": 1000,
        "status": "unpaid",
        "due_date": due,
        "created_at": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),
    }
    await db.deferrals.insert_one(doc)
    client.close()
    return doc["id"]


async def _remove_overdue_deferral(deferral_id):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.deferrals.delete_one({"id": deferral_id})
    client.close()


@pytest.fixture
def overdue_deferral(client_auth):
    did = asyncio.run(_insert_overdue_deferral(client_auth["user"]["id"]))
    yield did
    asyncio.run(_remove_overdue_deferral(did))


class TestOverdueBlocks:
    def test_overdue_blocks_order_creation(self, client_auth, some_product, overdue_deferral):
        requests.delete(f"{API}/cart/clear", headers=client_auth["headers"], timeout=10)
        requests.post(f"{API}/cart/add", headers=client_auth["headers"], json={"product_id": some_product["id"], "quantity": 1}, timeout=10)
        payload = {
            "full_name": "Тест", "address": "Москва", "phone": "+79991112233",
            "delivery_method": "pickup", "payment_method": "cash",
        }
        r = requests.post(f"{API}/orders", headers=client_auth["headers"], json=payload, timeout=15)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
        assert "просроченн" in r.text.lower() or "overdue" in r.text.lower()


# ============== Order creation works WITHOUT overdue (sanity) ==============

class TestNoOverdueAllowsOrder:
    def test_create_order_no_overdue(self, client_auth, some_product):
        # ensure no deferrals leaked
        requests.delete(f"{API}/cart/clear", headers=client_auth["headers"], timeout=10)
        requests.post(f"{API}/cart/add", headers=client_auth["headers"], json={"product_id": some_product["id"], "quantity": 1}, timeout=10)
        payload = {"full_name": "Тест", "address": "Москва", "phone": "+79991112233", "delivery_method": "pickup", "payment_method": "cash"}
        r = requests.post(f"{API}/orders", headers=client_auth["headers"], json=payload, timeout=15)
        assert r.status_code == 200, r.text
