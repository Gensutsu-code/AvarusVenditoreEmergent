# Promo codes (admin CRUD, client validate, order application, min_price floor, mixed-mode rejection)
# + product discount editor persistence via PUT /api/products/{id}
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}
CLIENT = {"email": "user@demo.com", "password": os.environ["TEST_CLIENT_PASSWORD"]}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds)
    if r.status_code != 200:
        pytest.skip(f"login failed {creds['email']}: {r.status_code}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def client():
    return _login(CLIENT)


@pytest.fixture(scope="module")
def created():
    c0 = _login(CLIENT)
    orig = [(i["product_id"], i["quantity"]) for i in (c0.get(f"{API}/cart").json().get("items") or [])]
    c0.delete(f"{API}/cart")  # validate floor-cap depends on cart contents
    data = {"codes": [], "products": [], "orders": []}
    yield data
    a = _login(ADMIN)
    c = _login(CLIENT)
    for oid in data["orders"]:
        c.post(f"{API}/orders/{oid}/cancel")
    c.delete(f"{API}/cart")
    for pid, q in orig:
        c.post(f"{API}/cart/add", json={"product_id": pid, "quantity": q})
    for cid in data["codes"]:
        a.delete(f"{API}/admin/promo-codes/{cid}")
    for pid in data["products"]:
        a.delete(f"{API}/products/{pid}")


@pytest.fixture(scope="module")
def test_product(admin, created):
    """TEST_ product: price 1000, min_price 950 → floor leaves only 50 ₽/unit of headroom."""
    art = f"TEST_{uuid.uuid4().hex[:8]}"
    r = admin.post(f"{API}/products", json={
        "name": f"TEST_PromoFloor {art}", "article": art, "manufacturer": "TEST",
        "price": 1000, "purchase_price": 500, "min_price": 950, "stock": 50,
        "manual_available": True,
    })
    assert r.status_code in (200, 201), r.text
    p = r.json()
    created["products"].append(p["id"])
    return p


def _mk_code(admin, created, **kw):
    payload = {"code": f"TEST{uuid.uuid4().hex[:6].upper()}", "type": "percent", "value": 15,
               "min_order": 0, "max_uses": 0, "per_user_limit": 0, "active": True}
    payload.update(kw)
    r = admin.post(f"{API}/admin/promo-codes", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    created["codes"].append(d["id"])
    return d


class TestPromoAdminCRUD:
    def test_create_list_update_delete(self, admin, created):
        d = _mk_code(admin, created, code="test_lower" + uuid.uuid4().hex[:4])
        assert d["code"] == d["code"].upper()
        assert d["used_count"] == 0 and d["value"] == 15
        lst = admin.get(f"{API}/admin/promo-codes").json()
        assert any(x["id"] == d["id"] for x in lst)
        assert all("_id" not in x for x in lst)
        # update / toggle
        upd = dict(d, active=False, value=20)
        r = admin.put(f"{API}/admin/promo-codes/{d['id']}", json=upd)
        assert r.status_code == 200 and r.json()["active"] is False and r.json()["value"] == 20
        # delete
        r = admin.delete(f"{API}/admin/promo-codes/{d['id']}")
        assert r.status_code == 200
        assert not any(x["id"] == d["id"] for x in admin.get(f"{API}/admin/promo-codes").json())
        assert admin.delete(f"{API}/admin/promo-codes/{d['id']}").status_code == 404

    def test_validation_errors(self, admin, created):
        d = _mk_code(admin, created)
        assert admin.post(f"{API}/admin/promo-codes", json={"code": d["code"], "value": 5}).status_code == 400
        assert admin.post(f"{API}/admin/promo-codes", json={"code": "TESTX1", "value": 0}).status_code == 400
        assert admin.post(f"{API}/admin/promo-codes", json={"code": "TESTX2", "value": 150}).status_code == 400
        assert admin.post(f"{API}/admin/promo-codes", json={"code": "  ", "value": 5}).status_code == 400

    def test_update_rejects_invalid_values(self, admin, created):
        """PUT should apply same validation as POST (type/value bounds)."""
        d = _mk_code(admin, created)
        r = admin.put(f"{API}/admin/promo-codes/{d['id']}", json=dict(d, value=500, type="percent"))
        assert r.status_code == 400, f"PUT accepted 500% promo: {r.status_code} {r.text[:200]}"

    def test_client_forbidden(self, client):
        assert client.get(f"{API}/admin/promo-codes").status_code == 403
        assert client.post(f"{API}/admin/promo-codes", json={"code": "TESTNO", "value": 5}).status_code == 403


class TestPromoValidate:
    def test_valid_percent(self, admin, client, created):
        d = _mk_code(admin, created, value=15)
        r = client.post(f"{API}/promo-codes/validate", json={"code": d["code"].lower(), "goods_total": 2000}).json()
        assert r["valid"] is True and r["discount"] == 300.0 and r["code"] == d["code"]

    def test_amount_capped(self, admin, client, created):
        d = _mk_code(admin, created, type="amount", value=5000)
        r = client.post(f"{API}/promo-codes/validate", json={"code": d["code"], "goods_total": 1200}).json()
        assert r["valid"] is True and r["discount"] == 1200.0

    def test_min_order_not_met(self, admin, client, created):
        d = _mk_code(admin, created, min_order=5000)
        r = client.post(f"{API}/promo-codes/validate", json={"code": d["code"], "goods_total": 1000}).json()
        assert r["valid"] is False and "Минимальная" in r["message"]

    def test_unknown_and_inactive(self, admin, client, created):
        r = client.post(f"{API}/promo-codes/validate", json={"code": "NOPE_XYZ_123", "goods_total": 1000}).json()
        assert r["valid"] is False and "не найден" in r["message"]
        d = _mk_code(admin, created, active=False)
        r = client.post(f"{API}/promo-codes/validate", json={"code": d["code"], "goods_total": 1000}).json()
        assert r["valid"] is False and "неактив" in r["message"]

    def test_expired_and_max_uses(self, admin, client, created):
        d = _mk_code(admin, created, valid_until="2020-01-01")
        r = client.post(f"{API}/promo-codes/validate", json={"code": d["code"], "goods_total": 1000}).json()
        assert r["valid"] is False and "истёк" in r["message"]

    def test_valid_until_today_still_valid(self, admin, client, created):
        """A code with valid_until=today (date-only from UI) should still work during that day."""
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        d = _mk_code(admin, created, valid_until=today)
        r = client.post(f"{API}/promo-codes/validate", json={"code": d["code"], "goods_total": 1000}).json()
        assert r["valid"] is True, f"Code valid until today rejected: {r}"

    def test_unauth(self):
        assert requests.post(f"{API}/promo-codes/validate", json={"code": "X", "goods_total": 1}).status_code in (401, 403)


class TestProductDiscountPersist:
    def test_put_discount_and_tiers(self, admin, test_product):
        pid = test_product["id"]
        payload = {"discount_active": True, "discount_type": "percent", "discount_value": 1,
                   "discount_label": "TEST_label", "discount_until": "2099-12-31",
                   "discount_tiers": [{"min_qty": 5, "type": "percent", "value": 2}]}
        r = admin.put(f"{API}/products/{pid}", json=payload)
        assert r.status_code == 200, r.text
        g = admin.get(f"{API}/products/{pid}").json()
        assert g["discount_active"] is True and g["discount_value"] == 1
        assert g["discount_tiers"][0]["min_qty"] == 5
        assert str(g["discount_until"]).startswith("2099-12-31")
        # Price stays above min_price -> name unchanged
        assert g["name"] == test_product["name"]

    def test_disable_discount(self, admin, test_product):
        pid = test_product["id"]
        r = admin.put(f"{API}/products/{pid}", json={"discount_active": False, "discount_tiers": [], "discount_until": None})
        assert r.status_code == 200
        g = admin.get(f"{API}/products/{pid}").json()
        assert g["discount_active"] is False and (g.get("discount_tiers") or []) == []


class TestOrderWithPromo:
    def _fill_cart(self, client, pid, qty):
        client.delete(f"{API}/cart")
        r = client.post(f"{API}/cart/add", json={"product_id": pid, "quantity": qty})
        assert r.status_code == 200, r.text

    def test_mixed_rejected(self, admin, client, created, test_product):
        d = _mk_code(admin, created, value=1)
        self._fill_cart(client, test_product["id"], 1)
        r = client.post(f"{API}/orders", json={"full_name": "TEST_User", "address": "TEST addr", "phone": "+70000000000",
                                               "payment_parts": [{"method": "card", "amount": 500}, {"method": "cash", "amount": 500}],
                                               "promo_code": d["code"]})
        assert r.status_code == 400 and "смешанной" in r.json()["detail"]

    def test_floor_and_used_count(self, admin, client, created, test_product):
        # min_price 800 → some headroom remains; 50% promo would go far below floor
        assert admin.put(f"{API}/products/{test_product['id']}", json={"min_price": 800}).status_code == 200
        d = _mk_code(admin, created, value=50, per_user_limit=1)
        self._fill_cart(client, test_product["id"], 2)
        cart = client.get(f"{API}/cart").json()
        print("cart:", {k: cart.get(k) for k in ("subtotal", "total")})
        r = client.post(f"{API}/orders", json={"full_name": "TEST_User", "address": "TEST addr", "phone": "+70000000000",
                                               "payment_method": "cash", "promo_code": d["code"]})
        assert r.status_code == 200, r.text
        o = r.json()
        created["orders"].append(o["id"])
        print("order:", {k: o.get(k) for k in ("subtotal", "total", "promo_code", "promo_code_amount", "delivery_fee")})
        assert o["promo_code"] == d["code"]
        goods = sum(i["price"] * i["quantity"] for i in o["items"])
        floor = 800 * 2
        assert o["promo_code_amount"] <= round(goods - floor, 2) + 0.01
        assert o["promo_code_amount"] > 0
        goods_after = goods - o["promo_code_amount"]
        assert goods_after >= floor - 0.01, f"goods after promo {goods_after} below floor {floor}"
        # used_count incremented
        lst = admin.get(f"{API}/admin/promo-codes").json()
        assert next(x for x in lst if x["id"] == d["id"])["used_count"] == 1
        # GET order persisted
        g = client.get(f"{API}/orders/{o['id']}").json()
        assert g["promo_code"] == d["code"] and g["promo_code_amount"] == o["promo_code_amount"]
        # per-user limit now hit
        v = client.post(f"{API}/promo-codes/validate", json={"code": d["code"], "goods_total": 5000}).json()
        assert v["valid"] is False and "уже использовали" in v["message"]

    def test_invalid_code_rejected_on_order(self, client, test_product):
        self._fill_cart(client, test_product["id"], 1)
        r = client.post(f"{API}/orders", json={"full_name": "TEST_User", "address": "TEST addr", "phone": "+70000000000",
                                               "payment_method": "cash", "promo_code": "NOPE_XYZ_123"})
        assert r.status_code == 400 and "не найден" in r.json()["detail"]
        client.delete(f"{API}/cart")
