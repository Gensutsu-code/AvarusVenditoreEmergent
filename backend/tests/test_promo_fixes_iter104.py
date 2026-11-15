# Iteration 104: promo code fixes — validate floor-cap, PUT validation, date-only valid_until,
# per_user_limit excluding cancelled orders, floor-to-0 not recording promo, promo_remaining_stock preserve,
# combined discount floor, catalog-style PUT not wiping discount fields.
import os
import uuid
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@avarus.ru", "password": "admin"}
CLIENT = {"email": "user@demo.com", "password": "demo123"}
ORDER_BASE = {"full_name": "TEST_User Promo104", "address": "TEST addr", "phone": "+70000000000"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds)
    if r.status_code != 200:
        pytest.skip(f"login failed {creds['email']}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def client():
    return _login(CLIENT)


@pytest.fixture(scope="module")
def created(client):
    # snapshot client's cart to restore later
    orig = [(i["product_id"], i["quantity"]) for i in (client.get(f"{API}/cart").json().get("items") or [])]
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


def _mk_product(admin, created, price=1000, min_price=950, **kw):
    art = f"TEST_{uuid.uuid4().hex[:8]}"
    body = {"name": f"TEST_P104 {art}", "article": art, "manufacturer": "TEST", "price": price,
            "purchase_price": 500, "min_price": min_price, "stock": 50, "manual_available": True}
    body.update(kw)
    r = admin.post(f"{API}/products", json=body)
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


def _fill(client, pid, qty):
    client.delete(f"{API}/cart")
    r = client.post(f"{API}/cart/add", json={"product_id": pid, "quantity": qty})
    assert r.status_code == 200, r.text


def _used(admin, cid):
    return next(x for x in admin.get(f"{API}/admin/promo-codes").json() if x["id"] == cid)["used_count"]


class TestPutValidation:
    def test_put_invalid(self, admin, created):
        d = _mk_code(admin, created)
        base = {k: d[k] for k in ("code", "type", "value", "min_order", "max_uses", "per_user_limit", "active")}
        assert admin.put(f"{API}/admin/promo-codes/{d['id']}", json=dict(base, value=500)).status_code == 400
        assert admin.put(f"{API}/admin/promo-codes/{d['id']}", json=dict(base, value=0)).status_code == 400
        assert admin.put(f"{API}/admin/promo-codes/{d['id']}", json=dict(base, value=-5, type="amount")).status_code == 400
        assert admin.put(f"{API}/admin/promo-codes/{d['id']}", json=dict(base, type="bogus")).status_code == 400
        assert admin.put(f"{API}/admin/promo-codes/{d['id']}", json=dict(base, code="  ")).status_code == 400
        # unchanged after rejected updates
        g = next(x for x in admin.get(f"{API}/admin/promo-codes").json() if x["id"] == d["id"])
        assert g["value"] == 15 and g["type"] == "percent"

    def test_put_negative_limits(self, admin, created):
        d = _mk_code(admin, created)
        base = {k: d[k] for k in ("code", "type", "value", "min_order", "max_uses", "per_user_limit", "active")}
        r1 = admin.put(f"{API}/admin/promo-codes/{d['id']}", json=dict(base, max_uses=-1))
        r2 = admin.put(f"{API}/admin/promo-codes/{d['id']}", json=dict(base, per_user_limit=-3))
        r3 = admin.put(f"{API}/admin/promo-codes/{d['id']}", json=dict(base, min_order=-100))
        assert (r1.status_code, r2.status_code, r3.status_code) == (400, 400, 400), \
            f"negative limits accepted: {r1.status_code},{r2.status_code},{r3.status_code}"

    def test_put_duplicate_and_self(self, admin, created):
        a = _mk_code(admin, created)
        b = _mk_code(admin, created)
        base = {k: b[k] for k in ("code", "type", "value", "min_order", "max_uses", "per_user_limit", "active")}
        r = admin.put(f"{API}/admin/promo-codes/{b['id']}", json=dict(base, code=a["code"].lower()))
        assert r.status_code == 400 and "существует" in r.json()["detail"]
        # keeping own code is fine
        r = admin.put(f"{API}/admin/promo-codes/{b['id']}", json=dict(base, value=20))
        assert r.status_code == 200 and r.json()["value"] == 20
        assert admin.put(f"{API}/admin/promo-codes/nonexistent-id", json=base).status_code == 404


class TestValidateFloor:
    def test_today_valid(self, admin, client, created):
        client.delete(f"{API}/cart")
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        d = _mk_code(admin, created, valid_until=today)
        r = client.post(f"{API}/promo-codes/validate", json={"code": d["code"], "goods_total": 1000}).json()
        assert r["valid"] is True and r["discount"] == 150

    def test_validate_matches_order(self, admin, client, created):
        p = _mk_product(admin, created, price=1000, min_price=950)
        _fill(client, p["id"], 2)
        d = _mk_code(admin, created, value=15)
        cart = client.get(f"{API}/cart").json()
        print("cart", cart.get("subtotal"), cart.get("total"))
        # card adds +10% → 1100×2 = 2200; 15% = 330; floor 1900 → cap 300
        v = client.post(f"{API}/promo-codes/validate", json={"code": d["code"], "goods_total": 2200}).json()
        assert v["valid"] is True and v["discount"] == 300.0, v
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="card", promo_code=d["code"]))
        assert r.status_code == 200, r.text
        o = r.json()
        created["orders"].append(o["id"])
        print({k: o.get(k) for k in ("subtotal", "total", "promo_code", "promo_code_amount", "delivery_fee")})
        assert o["promo_code"] == d["code"]
        assert o["promo_code_amount"] == v["discount"]
        assert _used(admin, d["id"]) == 1

    def test_validate_fully_consumed(self, admin, client, created):
        p = _mk_product(admin, created, price=1000, min_price=1000)
        _fill(client, p["id"], 1)
        d = _mk_code(admin, created, value=20)
        v = client.post(f"{API}/promo-codes/validate", json={"code": d["code"], "goods_total": 1000}).json()
        assert v["valid"] is False and v["discount"] == 0 and "не даёт скидку" in v["message"], v

    def test_order_floor_zero_not_recorded(self, admin, client, created):
        # cash −10% → 900 clamped to floor 950 → promo fully consumed by floor
        p = _mk_product(admin, created, price=1000, min_price=950)
        _fill(client, p["id"], 1)
        d = _mk_code(admin, created, value=20, per_user_limit=1)
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="cash", promo_code=d["code"]))
        assert r.status_code == 200, r.text
        o = r.json()
        created["orders"].append(o["id"])
        assert o.get("promo_code") in (None, ""), o.get("promo_code")
        assert o["promo_code_amount"] == 0
        assert _used(admin, d["id"]) == 0
        g = client.get(f"{API}/orders/{o['id']}").json()
        assert g.get("promo_code") in (None, "")


class TestPerUserCancelled:
    def test_cancelled_excluded(self, admin, client, created):
        p = _mk_product(admin, created, price=1000, min_price=100)
        _fill(client, p["id"], 1)
        d = _mk_code(admin, created, value=10, per_user_limit=1)
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="card", promo_code=d["code"]))
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        created["orders"].append(oid)
        assert r.json()["promo_code_amount"] > 0
        _fill(client, p["id"], 1)
        v = client.post(f"{API}/promo-codes/validate", json={"code": d["code"], "goods_total": 1100}).json()
        assert v["valid"] is False and "уже использовали" in v["message"]
        c = client.post(f"{API}/orders/{oid}/cancel")
        assert c.status_code == 200, c.text
        v = client.post(f"{API}/promo-codes/validate", json={"code": d["code"], "goods_total": 1100}).json()
        assert v["valid"] is True, v


class TestCombinedFloor:
    def test_product_discount_tier_promo(self, admin, client, created):
        p = _mk_product(admin, created, price=1000, min_price=850)
        r = admin.put(f"{API}/products/{p['id']}", json={
            "discount_active": True, "discount_type": "percent", "discount_value": 5,
            "discount_until": "2099-12-31", "discount_tiers": [{"min_qty": 2, "type": "percent", "value": 10}]})
        assert r.status_code == 200
        _fill(client, p["id"], 3)
        d = _mk_code(admin, created, value=50)
        r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="crypto", promo_code=d["code"]))
        if r.status_code != 200:
            r = client.post(f"{API}/orders", json=dict(ORDER_BASE, payment_method="cash", promo_code=d["code"]))
        assert r.status_code == 200, r.text
        o = r.json()
        created["orders"].append(o["id"])
        goods = round(sum(i["price"] * i["quantity"] for i in o["items"]) - o["promo_code_amount"], 2)
        print({k: o.get(k) for k in ("subtotal", "total", "promo_code", "promo_code_amount", "delivery_fee")}, goods)
        assert goods >= 850 * 3 - 0.01
        assert o["total"] - (o.get("delivery_fee") or 0) >= 850 * 3 - 0.01

    def test_tiers_only_discount_applies(self, admin, client, created):
        p = _mk_product(admin, created, price=1000, min_price=100)
        r = admin.put(f"{API}/products/{p['id']}", json={
            "discount_active": True, "discount_type": "percent", "discount_value": 0,
            "discount_until": "2099-12-31", "discount_tiers": [{"min_qty": 2, "type": "percent", "value": 10}]})
        assert r.status_code == 200
        _fill(client, p["id"], 2)
        cart = client.get(f"{API}/cart").json()
        it = cart["items"][0]
        print("tiers-only cart item", it.get("price"), it.get("promo_active"))
        assert it["promo_active"] is True and it["price"] == 900


class TestProductFieldsPreserved:
    def test_catalog_style_put_keeps_discount(self, admin, created):
        p = _mk_product(admin, created)
        admin.put(f"{API}/products/{p['id']}", json={
            "discount_active": True, "discount_type": "percent", "discount_value": 3, "discount_until": "2099-12-31",
            "discount_tiers": [{"min_qty": 5, "type": "percent", "value": 4}], "promo_allocated_stock": 10})
        # catalog save (stripped payload)
        g = admin.get(f"{API}/products/{p['id']}").json()
        for k in ("discount_active", "discount_type", "discount_value", "discount_label", "discount_description",
                  "discount_until", "discount_tiers", "promo_allocated_stock", "promo_remaining_stock"):
            g.pop(k, None)
        g["name"] = g["name"] + " EDITED"
        g["stock"] = 33
        r = admin.put(f"{API}/products/{p['id']}", json=g)
        assert r.status_code == 200, r.text
        h = admin.get(f"{API}/products/{p['id']}").json()
        assert h["name"].endswith("EDITED") and h["stock"] == 33
        assert h["discount_active"] is True and h["discount_value"] == 3
        assert h["discount_tiers"][0]["min_qty"] == 5
        assert h["promo_allocated_stock"] == 10 and h["promo_remaining_stock"] == 10

    def test_remaining_stock_not_reset(self, admin, created):
        p = _mk_product(admin, created)
        admin.put(f"{API}/products/{p['id']}", json={"discount_active": True, "discount_value": 3,
                                                       "discount_until": "2099-12-31", "promo_allocated_stock": 10})
        admin.put(f"{API}/products/{p['id']}", json={"promo_remaining_stock": 6})
        # editor payload without promo_allocated_stock
        admin.put(f"{API}/products/{p['id']}", json={"discount_active": True, "discount_type": "percent",
                                                       "discount_value": 7, "discount_label": "", "discount_description": "",
                                                       "discount_until": "2099-12-31", "discount_tiers": []})
        h = admin.get(f"{API}/products/{p['id']}").json()
        assert h["discount_value"] == 7 and h["promo_remaining_stock"] == 6 and h["promo_allocated_stock"] == 10
