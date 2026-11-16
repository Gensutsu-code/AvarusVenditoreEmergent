"""Iteration 112: contact-page manager card, garage, manager sales panel, manager chats, AI lookup."""
import json
import os
import time
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@avarus.ru", os.environ["TEST_ADMIN_PASSWORD"])

CLIENT = ("user@demo.com", os.environ["TEST_CLIENT_PASSWORD"])
UNBOUND = ("0x0errorr@gmail.com", os.environ["TEST_CLIENT2_PASSWORD"])

VALID_VIN = "1HGCM82633A004352"  # 17 chars, no I/O/Q


# ---------- helpers ----------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "admin": _login(*ADMIN),
        "manager": os.environ["TEST_DEMO_MANAGER_TOKEN"],
        "client": _login(*CLIENT),
        "unbound": _login(*UNBOUND),
    }


@pytest.fixture(scope="module")
def ids():
    """Track created resources for cleanup."""
    return {"vehicles": [], "orders_to_cancel": [], "products": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup(ids):
    yield
    # Cancel orders
    try:
        tok = _login(*CLIENT)
        for oid in ids["orders_to_cancel"]:
            requests.post(f"{API}/orders/{oid}/cancel", headers=_hdr(tok), timeout=30)
    except Exception:
        pass
    # Delete TEST vehicles
    try:
        tok = _login(*CLIENT)
        for vid in ids["vehicles"]:
            requests.delete(f"{API}/garage/vehicles/{vid}", headers=_hdr(tok), timeout=30)
    except Exception:
        pass
    # Admin cleanup of TEST_ products
    try:
        admin = _login(*ADMIN)
        for pid in ids["products"]:
            requests.delete(f"{API}/products/{pid}", headers=_hdr(admin), timeout=30)
        # Bulk scrub remaining TEST_ products
        r = requests.get(f"{API}/admin/products", headers=_hdr(admin), params={"search": "TEST_", "limit": 500}, timeout=30)
        if r.ok:
            data = r.json()
            items = data if isinstance(data, list) else data.get("items", [])
            for p in items:
                if (p.get("name", "").startswith("TEST_") or p.get("article", "").startswith("TEST_")):
                    requests.delete(f"{API}/products/{p['id']}", headers=_hdr(admin), timeout=30)
    except Exception as e:
        print("cleanup products err:", e)


# ---------- 1. CONTACT PAGE MANAGER ----------
class TestMyManager:
    def test_bound_client_sees_manager(self, tokens):
        r = requests.get(f"{API}/my-conditions", headers=_hdr(tokens["client"]), timeout=30)
        assert r.status_code == 200
        mgr = r.json().get("manager")
        assert mgr, "bound client must have manager"
        assert mgr.get("name")
        # phone is optional in data but we expect one for demo manager
        # shortName logic tested on frontend, we check name has at least one word
        parts = mgr["name"].strip().split()
        assert len(parts) >= 1

    def test_unbound_client(self, tokens):
        r = requests.get(f"{API}/my-conditions", headers=_hdr(tokens["unbound"]), timeout=30)
        assert r.status_code == 200
        assert r.json().get("manager") in (None,)


# ---------- 2. GARAGE ----------
class TestGarage:
    def test_create_and_get(self, tokens, ids):
        unique_vin = "TEST" + uuid.uuid4().hex.upper()[:13]  # 17 chars, no I/O/Q unlikely but filter
        unique_vin = unique_vin.replace("I", "1").replace("O", "0").replace("Q", "9")
        payload = {"type": "truck", "name": "TEST_Garage Truck", "vin": unique_vin, "year": 2010, "plate": "A123BC", "note": "test"}
        r = requests.post(f"{API}/garage/vehicles", json=payload, headers=_hdr(tokens["client"]), timeout=30)
        assert r.status_code == 200, r.text
        vid = r.json()["id"]
        ids["vehicles"].append(vid)
        assert r.json()["vin"] == unique_vin

        r = requests.get(f"{API}/garage", headers=_hdr(tokens["client"]), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "vehicles" in data and "unassigned_orders" in data
        assert any(v["id"] == vid for v in data["vehicles"])

    def test_vin_bad_length(self, tokens):
        payload = {"type": "truck", "name": "bad", "vin": "SHORT123", "year": 2010}
        r = requests.post(f"{API}/garage/vehicles", json=payload, headers=_hdr(tokens["client"]), timeout=30)
        assert r.status_code in (400, 422)

    def test_vin_forbidden_letters(self, tokens):
        # 17 chars with letter I (forbidden)
        payload = {"type": "truck", "name": "bad", "vin": "I" * 17, "year": 2010}
        r = requests.post(f"{API}/garage/vehicles", json=payload, headers=_hdr(tokens["client"]), timeout=30)
        assert r.status_code == 400

    def test_duplicate_vin(self, tokens, ids):
        v = "TEST" + uuid.uuid4().hex.upper()[:13]
        v = v.replace("I", "1").replace("O", "0").replace("Q", "9")
        payload = {"type": "truck", "name": "TEST_dup1", "vin": v, "year": 2010}
        r1 = requests.post(f"{API}/garage/vehicles", json=payload, headers=_hdr(tokens["client"]), timeout=30)
        assert r1.status_code == 200
        ids["vehicles"].append(r1.json()["id"])
        r2 = requests.post(f"{API}/garage/vehicles", json=payload, headers=_hdr(tokens["client"]), timeout=30)
        assert r2.status_code == 400

    def test_bad_type(self, tokens):
        v = "TEST" + uuid.uuid4().hex.upper()[:13]
        v = v.replace("I", "1").replace("O", "0").replace("Q", "9")
        payload = {"type": "car", "name": "bad", "vin": v, "year": 2010}
        r = requests.post(f"{API}/garage/vehicles", json=payload, headers=_hdr(tokens["client"]), timeout=30)
        assert r.status_code == 400

    def test_year_range(self, tokens):
        v = "TEST" + uuid.uuid4().hex.upper()[:13]
        v = v.replace("I", "1").replace("O", "0").replace("Q", "9")
        payload = {"type": "truck", "name": "bad", "vin": v, "year": 1800}
        r = requests.post(f"{API}/garage/vehicles", json=payload, headers=_hdr(tokens["client"]), timeout=30)
        assert r.status_code == 422

    def test_foreign_vehicle_404(self, tokens, ids):
        # client creates, unbound user tries to access
        v = "TEST" + uuid.uuid4().hex.upper()[:13]
        v = v.replace("I", "1").replace("O", "0").replace("Q", "9")
        r = requests.post(f"{API}/garage/vehicles", json={"type": "truck", "name": "TEST_f", "vin": v, "year": 2015}, headers=_hdr(tokens["client"]), timeout=30)
        assert r.status_code == 200
        vid = r.json()["id"]
        ids["vehicles"].append(vid)

        r = requests.put(f"{API}/garage/vehicles/{vid}", json={"type": "truck", "name": "x", "vin": v, "year": 2015}, headers=_hdr(tokens["unbound"]), timeout=30)
        assert r.status_code == 404
        r = requests.delete(f"{API}/garage/vehicles/{vid}", headers=_hdr(tokens["unbound"]), timeout=30)
        assert r.status_code == 404

    def test_soft_delete(self, tokens):
        v = "TEST" + uuid.uuid4().hex.upper()[:13]
        v = v.replace("I", "1").replace("O", "0").replace("Q", "9")
        r = requests.post(f"{API}/garage/vehicles", json={"type": "trailer", "name": "TEST_toDel", "vin": v, "year": 2015}, headers=_hdr(tokens["client"]), timeout=30)
        vid = r.json()["id"]
        r = requests.delete(f"{API}/garage/vehicles/{vid}", headers=_hdr(tokens["client"]), timeout=30)
        assert r.status_code == 200
        # Should no longer appear
        r = requests.get(f"{API}/garage", headers=_hdr(tokens["client"]), timeout=30)
        assert not any(vv["id"] == vid for vv in r.json()["vehicles"])


# ---------- 3. MANAGER PANEL — stats, orders, products, chats, authz ----------
class TestManagerPanel:
    def test_forbidden_for_client(self, tokens):
        for ep in ["/manager/orders", "/manager/products", "/manager/chats", "/manager/overview"]:
            r = requests.get(f"{API}{ep}", headers=_hdr(tokens["client"]), timeout=30)
            assert r.status_code == 403, f"{ep} should be 403 for client, got {r.status_code}"

    def test_forbidden_for_admin(self, tokens):
        for ep in ["/manager/orders", "/manager/products"]:
            r = requests.get(f"{API}{ep}", headers=_hdr(tokens["admin"]), timeout=30)
            assert r.status_code == 403, f"{ep} admin got {r.status_code}"

    def test_products_no_purchase_price(self, tokens):
        r = requests.get(f"{API}/manager/products", headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 200
        items = r.json()
        for p in items[:30]:
            for forbidden in ("purchase_price", "min_price", "cost"):
                assert forbidden not in p, f"manager product leaked {forbidden}: {p}"

    def test_products_in_stock_filter(self, tokens):
        r = requests.get(f"{API}/manager/products", params={"in_stock": "true"}, headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 200
        for p in r.json():
            assert (p.get("stock") or 0) > 0

    def test_manager_orders_bound_only(self, tokens):
        r = requests.get(f"{API}/manager/orders", headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_client_stats(self, tokens):
        # Get client id via /manager/clients
        r = requests.get(f"{API}/manager/clients", headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 200
        clients = r.json()
        demo = next((c for c in clients if c.get("email") == CLIENT[0]), None)
        assert demo, "user@demo.com should be bound to manager"
        r = requests.get(f"{API}/manager/clients/{demo['id']}/stats?period=all", headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_client_stats_foreign_404(self, tokens):
        # Find a user not bound to this manager (unbound one). Need its id via admin.
        r = requests.get(f"{API}/admin/users", headers=_hdr(tokens["admin"]), timeout=30)
        if r.status_code != 200:
            pytest.skip("no admin users api")
        users = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
        other = next((u for u in users if u.get("email") == UNBOUND[0]), None)
        if not other:
            pytest.skip("unbound user id not found")
        r = requests.get(f"{API}/manager/clients/{other['id']}/stats", headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 404

    def test_manager_chats_only_bound(self, tokens):
        r = requests.get(f"{API}/manager/chats", headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 200
        chats = r.json()
        assert isinstance(chats, list)
        # verify none of them belongs to UNBOUND
        unbound_id = None
        au = requests.get(f"{API}/admin/users", headers=_hdr(tokens["admin"]), timeout=30)
        if au.ok:
            users = au.json() if isinstance(au.json(), list) else au.json().get("items", [])
            unbound_id = next((u["id"] for u in users if u.get("email") == UNBOUND[0]), None)
        if unbound_id:
            for c in chats:
                assert c.get("user_id") != unbound_id

    def test_foreign_chat_messages_404(self, tokens):
        # ensure the unbound client has a chat, then manager tries to open it
        r = requests.post(f"{API}/chat/send", json={"text": "TEST unbound msg"}, headers=_hdr(tokens["unbound"]), timeout=30)
        assert r.status_code in (200, 201)
        # admin lists all chats
        r = requests.get(f"{API}/admin/chats", headers=_hdr(tokens["admin"]), timeout=30)
        assert r.status_code == 200
        chats = r.json()
        au = requests.get(f"{API}/admin/users", headers=_hdr(tokens["admin"]), timeout=30).json()
        users = au if isinstance(au, list) else au.get("items", [])
        unbound_id = next((u["id"] for u in users if u.get("email") == UNBOUND[0]), None)
        unbound_chat = next((c for c in chats if c.get("user_id") == unbound_id), None)
        if unbound_chat:
            r = requests.get(f"{API}/manager/chats/{unbound_chat['id']}/messages", headers=_hdr(tokens["manager"]), timeout=30)
            assert r.status_code == 404


# ---------- 4. MANAGER PLACES ORDER ----------
class TestManagerCreateOrder:
    @pytest.fixture(scope="class")
    def test_product(self, tokens, ids):
        # create a TEST product in stock
        payload = {
            "name": f"TEST_Iter112 Product {uuid.uuid4().hex[:6]}",
            "article": f"TEST_IT112_{uuid.uuid4().hex[:6]}",
            "price": 1000.0,
            "stock": 20,
            "purchase_price": 500.0,
        }
        r = requests.post(f"{API}/products", json=payload, headers=_hdr(tokens["admin"]), timeout=30)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        ids["products"].append(pid)
        return pid

    def test_invalid_payment(self, tokens, test_product):
        # Get demo client id
        clients = requests.get(f"{API}/manager/clients", headers=_hdr(tokens["manager"]), timeout=30).json()
        cid = next(c["id"] for c in clients if c["email"] == CLIENT[0])
        body = {"items": [{"product_id": test_product, "quantity": 1}], "payment_method": "bitcoin",
                "address": "test", "phone": "+7999"}
        r = requests.post(f"{API}/manager/clients/{cid}/orders", json=body, headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 400

    def test_empty_items(self, tokens):
        clients = requests.get(f"{API}/manager/clients", headers=_hdr(tokens["manager"]), timeout=30).json()
        cid = next(c["id"] for c in clients if c["email"] == CLIENT[0])
        body = {"items": [], "payment_method": "cash", "address": "test", "phone": "+7"}
        r = requests.post(f"{API}/manager/clients/{cid}/orders", json=body, headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 422

    def test_unknown_product(self, tokens):
        clients = requests.get(f"{API}/manager/clients", headers=_hdr(tokens["manager"]), timeout=30).json()
        cid = next(c["id"] for c in clients if c["email"] == CLIENT[0])
        body = {"items": [{"product_id": "nonexistent-xxx", "quantity": 1}], "payment_method": "cash",
                "address": "t", "phone": "+7999"}
        r = requests.post(f"{API}/manager/clients/{cid}/orders", json=body, headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 404

    def test_over_stock(self, tokens, test_product):
        clients = requests.get(f"{API}/manager/clients", headers=_hdr(tokens["manager"]), timeout=30).json()
        cid = next(c["id"] for c in clients if c["email"] == CLIENT[0])
        body = {"items": [{"product_id": test_product, "quantity": 9999}], "payment_method": "cash",
                "address": "t", "phone": "+7999"}
        r = requests.post(f"{API}/manager/clients/{cid}/orders", json=body, headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 400

    def test_foreign_client_404(self, tokens, test_product):
        au = requests.get(f"{API}/admin/users", headers=_hdr(tokens["admin"]), timeout=30).json()
        users = au if isinstance(au, list) else au.get("items", [])
        other_id = next((u["id"] for u in users if u.get("email") == UNBOUND[0]), None)
        if not other_id:
            pytest.skip("unbound id not found")
        body = {"items": [{"product_id": test_product, "quantity": 1}], "payment_method": "cash",
                "address": "t", "phone": "+7999"}
        r = requests.post(f"{API}/manager/clients/{other_id}/orders", json=body, headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 404

    def test_successful_cash_order_preserves_client_cart(self, tokens, test_product, ids):
        # client puts something DIFFERENT in cart
        clients_list = requests.get(f"{API}/manager/clients", headers=_hdr(tokens["manager"]), timeout=30).json()
        cid = next(c["id"] for c in clients_list if c["email"] == CLIENT[0])

        # Pick any existing non-TEST product for client cart
        prods = requests.get(f"{API}/products?limit=10", timeout=30).json()
        other_prod = next((p for p in prods if p["id"] != test_product and (p.get("stock") or 0) > 0), None)
        assert other_prod, "need a stock product for client cart"

        # Set client cart
        requests.delete(f"{API}/cart", headers=_hdr(tokens["client"]), timeout=30)
        rc = requests.post(f"{API}/cart/add", json={"product_id": other_prod["id"], "quantity": 1}, headers=_hdr(tokens["client"]), timeout=30)
        assert rc.status_code in (200, 201), rc.text

        # Manager places order
        body = {"items": [{"product_id": test_product, "quantity": 2}], "payment_method": "cash",
                "address": "TEST address", "phone": "+79990000000", "comment": "TEST manager order"}
        r = requests.post(f"{API}/manager/clients/{cid}/orders", json=body, headers=_hdr(tokens["manager"]), timeout=30)
        assert r.status_code == 200, r.text
        order = r.json()
        order_id = order["id"]
        ids["orders_to_cancel"].append(order_id)

        # Order visible to client
        orders = requests.get(f"{API}/orders", headers=_hdr(tokens["client"]), timeout=30).json()
        assert any(o["id"] == order_id for o in (orders if isinstance(orders, list) else orders.get("items", []))), \
            "manager order must appear in client's orders"

        # Order visible to manager with created_by_manager flag
        mgr_orders = requests.get(f"{API}/manager/orders", headers=_hdr(tokens["manager"]), timeout=30).json()
        matching = [o for o in mgr_orders if o["id"] == order_id]
        assert matching and matching[0].get("created_by_manager") is True

        # Client cart still has ONLY the original product
        cart = requests.get(f"{API}/cart", headers=_hdr(tokens["client"]), timeout=30).json()
        items = cart.get("items", []) if isinstance(cart, dict) else cart
        pids = [i.get("product_id") for i in items]
        assert other_prod["id"] in pids, f"client cart lost its item: {items}"
        assert test_product not in pids, f"manager's product leaked into client cart: {items}"

        # Clean up client cart
        requests.delete(f"{API}/cart", headers=_hdr(tokens["client"]), timeout=30)

    def test_balance_insufficient(self, tokens, test_product):
        clients_list = requests.get(f"{API}/manager/clients", headers=_hdr(tokens["manager"]), timeout=30).json()
        cid = next(c["id"] for c in clients_list if c["email"] == CLIENT[0])
        # Very high quantity to exceed balance
        body = {"items": [{"product_id": test_product, "quantity": 10}], "payment_method": "balance",
                "address": "t", "phone": "+7999"}
        r = requests.post(f"{API}/manager/clients/{cid}/orders", json=body, headers=_hdr(tokens["manager"]), timeout=30)
        # Either 400 (insufficient) or 200 (if balance sufficient). We assert not 500.
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            # cancel to restore stock
            oid = r.json().get("id")
            if oid:
                requests.post(f"{API}/orders/{oid}/cancel", headers=_hdr(tokens["client"]), timeout=30)


# ---------- 5. AI assistant SSE ----------
def _consume_sse(resp):
    done = None
    text_parts = []
    for raw in resp.iter_lines(decode_unicode=True):
        if not raw:
            continue
        if raw.startswith("data:"):
            try:
                ev = json.loads(raw[5:].strip())
            except Exception:
                continue
            if ev.get("type") == "delta":
                text_parts.append(ev.get("text") or "")
            elif ev.get("type") == "done":
                done = ev
                break
            elif ev.get("type") == "error":
                done = ev
                break
    return done, "".join(text_parts)


class TestAIAssistant:
    def test_vague_query(self, tokens):
        sid = f"TEST_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/ai/assistant/chat", json={"session_id": sid, "message": "нужна запчасть на грузовик"},
                          headers=_hdr(tokens["client"]), stream=True, timeout=120)
        assert r.status_code == 200
        done, text = _consume_sse(r)
        assert done is not None
        if done.get("type") == "error":
            pytest.skip(f"AI unavailable: {done}")
        assert "suggest_handoff" in done
        assert isinstance(done.get("found_articles", []), list)
        # vague → should ask a clarifying question
        # (soft check; just ensure no crash)

    def test_lookup_endpoint_no_500(self, tokens):
        sid = f"TEST_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/ai/assistant/chat",
                          json={"session_id": sid, "message": "Нужен воздушный фильтр на Scania R420 2008 года, двигатель DC12"},
                          headers=_hdr(tokens["client"]), stream=True, timeout=180)
        assert r.status_code == 200, r.text
        done, text = _consume_sse(r)
        assert done is not None
        if done.get("type") == "error":
            pytest.skip(f"AI unavailable: {done}")
        assert "suggest_handoff" in done
        assert isinstance(done.get("found_articles", []), list)
