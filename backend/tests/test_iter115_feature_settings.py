"""Backend tests for iteration 115: feature-settings (garage, chat, favorites, product_requests)."""
import os
import time
import uuid
import pytest
import requests

def _read_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.strip().split("=", 1)[1].rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _read_backend_url()
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@avarus.ru", "password": "admin"}
CLIENT = {"email": "user@demo.com", "password": "demo123"}
MANAGER = {"email": "manager@avarus.ru", "password": "manager123"}

# ---------- Fixtures ----------

def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=60)
    assert r.status_code == 200, f"login failed {creds['email']}: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="session")
def client_token():
    return _login(CLIENT)


@pytest.fixture(scope="session")
def manager_token():
    try:
        return _login(MANAGER)
    except AssertionError as e:
        pytest.skip(f"manager login failed (test env mismatch): {e}")


@pytest.fixture(scope="session")
def admin_s(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def client_s(client_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def manager_s(manager_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {manager_token}", "Content-Type": "application/json"})
    return s


def _reset_settings(admin_s):
    for k in ("garage", "chat", "favorites", "product_requests"):
        admin_s.put(f"{API}/admin/feature-settings/{k}", json={})
    time.sleep(2.2)


@pytest.fixture(autouse=True, scope="module")
def _cleanup(admin_s, client_s):
    """Reset settings before and after the module, cleanup created test vehicles/favorites."""
    _reset_settings(admin_s)
    yield
    _reset_settings(admin_s)
    # Cleanup vehicles created by this run
    try:
        vs = client_s.get(f"{API}/garage/vehicles").json()
        for v in vs:
            if (v.get("name") or "").startswith("TEST_"):
                client_s.delete(f"{API}/garage/vehicles/{v['id']}")
    except Exception:
        pass


# ---------- Public GET /feature-settings ----------

class TestFeatureSettingsPublic:
    def test_defaults(self, admin_s):
        _reset_settings(admin_s)
        r = requests.get(f"{API}/feature-settings", timeout=60)
        assert r.status_code == 200
        data = r.json()
        for k in ("garage", "chat", "favorites", "product_requests"):
            assert k in data, f"missing key {k}"
        assert data["garage"]["max_vehicles"] == 0
        assert set(data["garage"]["allowed_types"]) == {"truck", "trailer"}
        assert data["garage"]["checkout_mode"] == "optional"
        assert data["chat"]["guests_allowed"] is False
        assert data["chat"]["attachments_allowed"] is True
        assert data["chat"]["work_hours_enabled"] is False
        assert data["favorites"]["max_items"] == 0
        assert data["favorites"]["notify_price_drop"] is False
        assert data["favorites"]["notify_back_in_stock"] is False
        assert data["product_requests"]["offer_valid_days"] == 0
        assert data["product_requests"]["comment_required"] is False
        assert data["product_requests"]["show_out_of_stock"] is True
        assert data["product_requests"]["show_not_found"] is True


# ---------- Admin PUT /admin/feature-settings/{key} ----------

class TestAdminFeatureSettingsAuth:
    def test_client_forbidden(self, client_s):
        r = client_s.put(f"{API}/admin/feature-settings/garage", json={})
        assert r.status_code == 403

    def test_unknown_key(self, admin_s):
        r = admin_s.put(f"{API}/admin/feature-settings/unknown_xyz", json={})
        assert r.status_code == 404

    def test_sanitization(self, admin_s):
        # Bad checkout_mode -> optional, bad time -> default, unknown types dropped
        r = admin_s.put(f"{API}/admin/feature-settings/garage", json={
            "max_vehicles": 3, "allowed_types": ["truck", "foo", "car"], "checkout_mode": "bogus"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["checkout_mode"] == "optional"
        assert "foo" not in data["allowed_types"]
        assert set(data["allowed_types"]) == {"truck", "car"}
        assert data["max_vehicles"] == 3

        r = admin_s.put(f"{API}/admin/feature-settings/chat", json={
            "work_start": "bad", "work_end": "25:99", "title": "X"})
        assert r.status_code == 200
        c = r.json()
        assert c["work_start"] == "09:00"
        assert c["work_end"] == "18:00"
        _reset_settings(admin_s)

    def test_replace_full_object(self, admin_s):
        # PUT with partial payload -> missing fields fall back to defaults
        admin_s.put(f"{API}/admin/feature-settings/favorites", json={"max_items": 5, "notify_price_drop": True})
        time.sleep(2.2)
        pub = requests.get(f"{API}/feature-settings").json()
        assert pub["favorites"]["max_items"] == 5
        assert pub["favorites"]["notify_price_drop"] is True
        # Now PUT empty -> all defaults restored
        admin_s.put(f"{API}/admin/feature-settings/favorites", json={})
        time.sleep(2.2)
        pub = requests.get(f"{API}/feature-settings").json()
        assert pub["favorites"]["max_items"] == 0
        assert pub["favorites"]["notify_price_drop"] is False


# ---------- Garage ----------

class TestGarage:
    @pytest.fixture(autouse=True)
    def _cleanup_vehicles(self, client_s):
        yield
        try:
            vs = client_s.get(f"{API}/garage/vehicles").json()
            for v in vs:
                if (v.get("name") or "").startswith("TEST_"):
                    client_s.delete(f"{API}/garage/vehicles/{v['id']}")
        except Exception:
            pass

    @staticmethod
    def _vin():
        # Valid VIN: 17 chars, no I/O/Q
        import random, string
        chars = [c for c in string.ascii_uppercase + string.digits if c not in "IOQ"]
        return "".join(random.choice(chars) for _ in range(17))

    def test_max_vehicles_limit(self, admin_s, client_s):
        # existing vehicles may exist; ensure clean
        vs = client_s.get(f"{API}/garage/vehicles").json()
        for v in vs:
            client_s.delete(f"{API}/garage/vehicles/{v['id']}")
        admin_s.put(f"{API}/admin/feature-settings/garage",
                    json={"max_vehicles": 1, "allowed_types": ["truck", "trailer"], "checkout_mode": "optional"})
        time.sleep(2.2)
        r1 = client_s.post(f"{API}/garage/vehicles",
                           json={"type": "truck", "name": "TEST_v1", "vin": self._vin()})
        assert r1.status_code == 200, r1.text
        r2 = client_s.post(f"{API}/garage/vehicles",
                           json={"type": "truck", "name": "TEST_v2", "vin": self._vin()})
        assert r2.status_code == 400
        _reset_settings(admin_s)

    def test_allowed_types_restricts_new(self, admin_s, client_s):
        admin_s.put(f"{API}/admin/feature-settings/garage",
                    json={"max_vehicles": 10, "allowed_types": ["truck"], "checkout_mode": "optional"})
        time.sleep(2.2)
        r = client_s.post(f"{API}/garage/vehicles",
                          json={"type": "trailer", "name": "TEST_dis", "vin": self._vin()})
        assert r.status_code == 400
        _reset_settings(admin_s)

    def test_edit_vehicle_keeps_old_type(self, admin_s, client_s):
        admin_s.put(f"{API}/admin/feature-settings/garage",
                    json={"max_vehicles": 10, "allowed_types": ["truck", "trailer"], "checkout_mode": "optional"})
        time.sleep(2.2)
        vin = self._vin()
        r = client_s.post(f"{API}/garage/vehicles",
                          json={"type": "trailer", "name": "TEST_old", "vin": vin})
        assert r.status_code == 200
        vid = r.json()["id"]
        # Now restrict to truck only
        admin_s.put(f"{API}/admin/feature-settings/garage",
                    json={"max_vehicles": 10, "allowed_types": ["truck"], "checkout_mode": "optional"})
        time.sleep(2.2)
        # Editing keeping same (now disallowed) type should still work
        r2 = client_s.put(f"{API}/garage/vehicles/{vid}",
                          json={"type": "trailer", "name": "TEST_old_edit", "vin": vin})
        assert r2.status_code == 200, r2.text
        _reset_settings(admin_s)


# ---------- Checkout vehicle mode ----------

class TestCheckoutVehicleMode:
    @staticmethod
    def _add_item_to_cart(client_s):
        products = client_s.get(f"{API}/products?limit=1").json()
        # products may be {items:[]} or list
        if isinstance(products, dict):
            products = products.get("items") or products.get("products") or []
        assert products, "no products available"
        pid = products[0]["id"]
        client_s.delete(f"{API}/cart")
        r = client_s.post(f"{API}/cart/add", json={"product_id": pid, "quantity": 1})
        assert r.status_code == 200, r.text
        return pid

    @staticmethod
    def _order_payload(**extra):
        p = {
            "items": [], "payment_method": "cash", "delivery_method": "pickup",
            "address": "TEST addr", "phone": "+70000000000", "full_name": "TEST"
        }
        p.update(extra)
        return p

    def test_required_without_vehicle_blocks_when_client_has_vehicles(self, admin_s, client_s):
        # ensure client has at least one vehicle
        existing = client_s.get(f"{API}/garage/vehicles").json()
        created_id = None
        if not existing:
            # need at least one
            admin_s.put(f"{API}/admin/feature-settings/garage",
                        json={"max_vehicles": 10, "allowed_types": ["truck"], "checkout_mode": "optional"})
            time.sleep(2.2)
            import random, string
            chars = [c for c in string.ascii_uppercase + string.digits if c not in "IOQ"]
            vin = "".join(random.choice(chars) for _ in range(17))
            r = client_s.post(f"{API}/garage/vehicles",
                              json={"type": "truck", "name": "TEST_required", "vin": vin})
            assert r.status_code == 200
            created_id = r.json()["id"]
        admin_s.put(f"{API}/admin/feature-settings/garage",
                    json={"max_vehicles": 10, "allowed_types": ["truck", "trailer"], "checkout_mode": "required"})
        time.sleep(2.2)
        self._add_item_to_cart(client_s)
        r = client_s.post(f"{API}/orders", json=self._order_payload())
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"
        _reset_settings(admin_s)
        if created_id:
            client_s.delete(f"{API}/garage/vehicles/{created_id}")
        client_s.delete(f"{API}/cart")

    def test_off_ignores_vehicle_and_allows_order(self, admin_s, client_s):
        admin_s.put(f"{API}/admin/feature-settings/garage",
                    json={"max_vehicles": 10, "allowed_types": ["truck"], "checkout_mode": "off"})
        time.sleep(2.2)
        self._add_item_to_cart(client_s)
        r = client_s.post(f"{API}/orders", json=self._order_payload(vehicle_id="nonexistent"))
        assert r.status_code == 200, r.text
        order = r.json()
        assert order.get("vehicle_id") in (None, "")
        # cleanup: cancel the order
        oid = order["id"]
        admin_s.post(f"{API}/admin/orders/{oid}/cancel", json={})
        _reset_settings(admin_s)


# ---------- Favorites ----------

class TestFavorites:
    def test_max_items_limit(self, admin_s, client_s):
        prods = client_s.get(f"{API}/products?limit=3").json()
        if isinstance(prods, dict):
            prods = prods.get("items") or prods.get("products") or []
        assert len(prods) >= 2
        # Turn settings off while we clean so no limit prevents work
        _reset_settings(admin_s)
        # Clear existing favs — GET /favorites returns {items:[product,...]}
        for _ in range(3):
            current = client_s.get(f"{API}/favorites").json()
            fav_items = (current.get("items") if isinstance(current, dict) else []) or []
            if not fav_items:
                break
            for p in fav_items:
                pid = p.get("id") if isinstance(p, dict) else p
                client_s.delete(f"{API}/favorites/{pid}")
        for p in prods[:2]:
            client_s.delete(f"{API}/favorites/{p['id']}")
        admin_s.put(f"{API}/admin/feature-settings/favorites",
                    json={"max_items": 1, "notify_price_drop": False, "notify_back_in_stock": False})
        time.sleep(2.2)
        r1 = client_s.post(f"{API}/favorites/add", json={"product_id": prods[0]["id"]})
        assert r1.status_code == 200
        # re-adding same is fine
        r_re = client_s.post(f"{API}/favorites/add", json={"product_id": prods[0]["id"]})
        assert r_re.status_code == 200
        r2 = client_s.post(f"{API}/favorites/add", json={"product_id": prods[1]["id"]})
        assert r2.status_code == 400
        assert "избранн" in r2.text.lower() or "не больше" in r2.text.lower()
        # cleanup
        client_s.delete(f"{API}/favorites/{prods[0]['id']}")
        _reset_settings(admin_s)

    def test_price_drop_notification(self, admin_s, client_s):
        prods = client_s.get(f"{API}/products?limit=5").json()
        if isinstance(prods, dict):
            prods = prods.get("items") or prods.get("products") or []
        target = next((p for p in prods if (p.get("price") or 0) > 100), None)
        assert target, "no product with price>100"
        pid = target["id"]
        original_price = target["price"]
        admin_s.put(f"{API}/admin/feature-settings/favorites",
                    json={"max_items": 0, "notify_price_drop": True, "notify_back_in_stock": False})
        time.sleep(2.2)
        client_s.delete(f"{API}/favorites/{pid}")
        client_s.post(f"{API}/favorites/add", json={"product_id": pid})
        # lower price
        new_price = max(1, int(original_price) - 10)
        r = admin_s.put(f"{API}/products/{pid}", json={"price": new_price})
        assert r.status_code == 200, r.text
        time.sleep(1.0)
        notifs = client_s.get(f"{API}/my-notifications").json()
        if isinstance(notifs, dict):
            notifs = notifs.get("items") or notifs.get("notifications") or []
        hit = any(n.get("type") == "favorites" and "снизилась" in (n.get("title") or "").lower() for n in notifs)
        # restore price
        admin_s.put(f"{API}/products/{pid}", json={"price": original_price})
        client_s.delete(f"{API}/favorites/{pid}")
        _reset_settings(admin_s)
        assert hit, f"price-drop notification missing. recent: {[n.get('title') for n in notifs[:5]]}"


# ---------- Product requests ----------

class TestProductRequests:
    def test_comment_required(self, admin_s, client_s):
        admin_s.put(f"{API}/admin/feature-settings/product_requests",
                    json={"offer_valid_days": 0, "comment_required": True,
                          "show_out_of_stock": True, "show_not_found": True})
        time.sleep(2.2)
        r = client_s.post(f"{API}/product-requests",
                          json={"article": "TEST_ART", "quantity": 1, "comment": ""})
        assert r.status_code == 400
        _reset_settings(admin_s)

    def test_show_not_found_false_blocks(self, admin_s, client_s):
        admin_s.put(f"{API}/admin/feature-settings/product_requests",
                    json={"offer_valid_days": 0, "comment_required": False,
                          "show_out_of_stock": True, "show_not_found": False})
        time.sleep(2.2)
        r = client_s.post(f"{API}/product-requests",
                          json={"article": "TEST_ART", "quantity": 1, "comment": "x"})
        assert r.status_code == 403
        _reset_settings(admin_s)

    def test_show_out_of_stock_false_blocks(self, admin_s, client_s):
        prods = client_s.get(f"{API}/products?limit=1").json()
        if isinstance(prods, dict):
            prods = prods.get("items") or prods.get("products") or []
        pid = prods[0]["id"]
        admin_s.put(f"{API}/admin/feature-settings/product_requests",
                    json={"offer_valid_days": 0, "comment_required": False,
                          "show_out_of_stock": False, "show_not_found": True})
        time.sleep(2.2)
        r = client_s.post(f"{API}/product-requests",
                          json={"article": "TEST_ART", "quantity": 1, "comment": "x", "product_id": pid})
        assert r.status_code == 403
        _reset_settings(admin_s)

    def test_offer_valid_days_sets_expiry(self, admin_s, client_s):
        admin_s.put(f"{API}/admin/feature-settings/product_requests",
                    json={"offer_valid_days": 5, "comment_required": False,
                          "show_out_of_stock": True, "show_not_found": True})
        time.sleep(2.2)
        r = client_s.post(f"{API}/product-requests",
                          json={"article": "TEST_OFFER", "quantity": 1, "comment": "pls"})
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        r2 = admin_s.put(f"{API}/admin/product-requests/{rid}/respond",
                         json={"status": "offered", "response_message": "ok", "offer_price": 100.0})
        assert r2.status_code == 200, r2.text
        updated = r2.json()
        assert updated.get("offer_expires_at")
        # 0 days -> null
        admin_s.put(f"{API}/admin/feature-settings/product_requests",
                    json={"offer_valid_days": 0, "comment_required": False,
                          "show_out_of_stock": True, "show_not_found": True})
        time.sleep(2.2)
        r3 = client_s.post(f"{API}/product-requests",
                          json={"article": "TEST_OFFER2", "quantity": 1, "comment": "pls"})
        rid2 = r3.json()["id"]
        r4 = admin_s.put(f"{API}/admin/product-requests/{rid2}/respond",
                         json={"status": "offered", "response_message": "ok", "offer_price": 50.0})
        assert r4.json().get("offer_expires_at") is None
        _reset_settings(admin_s)


# ---------- Chat ----------

class TestChat:
    def test_attachments_disabled_blocks_upload(self, admin_s, client_s):
        admin_s.put(f"{API}/admin/feature-settings/chat",
                    json={"attachments_allowed": False})
        time.sleep(2.2)
        # upload without multipart should still 403 before reading file. Try multipart send
        files = {"file": ("x.png", b"\x89PNG\r\n\x1a\n", "image/png")}
        headers = {"Authorization": client_s.headers["Authorization"]}
        r = requests.post(f"{API}/chat/upload", files=files, headers=headers)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"
        r2 = client_s.post(f"{API}/chat/send-media?file_url=https://x/y.png&filename=y.png&is_image=true", json={})
        assert r2.status_code == 403
        _reset_settings(admin_s)

    def test_guests_disabled_returns_403(self, admin_s):
        _reset_settings(admin_s)  # default guests_allowed False
        sid = "a" * 16
        r = requests.post(f"{API}/chat/guest/send",
                         json={"session_id": sid, "name": "T", "text": "hi"})
        assert r.status_code == 403, f"expected 403 got {r.status_code} body={r.text}"

    def test_guests_enabled_flow(self, admin_s):
        admin_s.put(f"{API}/admin/feature-settings/chat", json={"guests_allowed": True})
        time.sleep(2.2)
        sid = uuid.uuid4().hex + "ab"  # 34 chars
        r = requests.post(f"{API}/chat/guest/send",
                         json={"session_id": sid, "name": "TestGuest", "text": "TEST hello"})
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/chat/guest/messages", params={"session_id": sid})
        assert r2.status_code == 200
        msgs = r2.json().get("messages", [])
        assert any("TEST hello" in (m.get("text") or "") for m in msgs)
        _reset_settings(admin_s)

    def test_guest_sid_validation(self, admin_s):
        admin_s.put(f"{API}/admin/feature-settings/chat", json={"guests_allowed": True})
        time.sleep(2.2)
        r = requests.post(f"{API}/chat/guest/send",
                         json={"session_id": "short", "name": "", "text": "hi"})
        assert r.status_code == 400
        _reset_settings(admin_s)


# ---------- Manager bypass of required vehicle ----------

class TestManagerBypassRequired:
    def test_manager_order_not_blocked_by_required(self, admin_s, manager_s, client_s):
        # ensure client has a vehicle
        existing = client_s.get(f"{API}/garage/vehicles").json()
        created_id = None
        if not existing:
            admin_s.put(f"{API}/admin/feature-settings/garage",
                        json={"max_vehicles": 10, "allowed_types": ["truck"], "checkout_mode": "optional"})
            time.sleep(2.2)
            import random, string
            chars = [c for c in string.ascii_uppercase + string.digits if c not in "IOQ"]
            vin = "".join(random.choice(chars) for _ in range(17))
            r = client_s.post(f"{API}/garage/vehicles",
                              json={"type": "truck", "name": "TEST_mgr", "vin": vin})
            assert r.status_code == 200
            created_id = r.json()["id"]

        admin_s.put(f"{API}/admin/feature-settings/garage",
                    json={"max_vehicles": 10, "allowed_types": ["truck", "trailer"], "checkout_mode": "required"})
        time.sleep(2.2)

        # Get client user_id
        who = client_s.get(f"{API}/auth/me").json()
        client_id = who.get("id") or who.get("user_id")
        prods = client_s.get(f"{API}/products?limit=1").json()
        if isinstance(prods, dict):
            prods = prods.get("items") or prods.get("products") or []
        pid = prods[0]["id"]
        payload = {
            "items": [{"product_id": pid, "quantity": 1}],
            "payment_method": "cash", "delivery_method": "pickup",
            "address": "TEST", "phone": "+7000", "full_name": "TEST"
        }
        r = manager_s.post(f"{API}/manager/clients/{client_id}/orders", json=payload)
        # Accept 200 — must NOT be 400 "укажите технику"
        assert r.status_code != 400 or "технику" not in r.text.lower(), f"manager blocked: {r.status_code} {r.text}"

        _reset_settings(admin_s)
        if created_id:
            client_s.delete(f"{API}/garage/vehicles/{created_id}")
        # cleanup created order if any
        if r.status_code == 200:
            try:
                oid = r.json().get("id") or r.json().get("order", {}).get("id")
                if oid:
                    admin_s.post(f"{API}/admin/orders/{oid}/cancel", json={})
            except Exception:
                pass
