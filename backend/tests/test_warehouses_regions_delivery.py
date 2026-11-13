# Warehouses CRUD, per-warehouse stock (receipt/writeoff/transfer), regions, delivery-display
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    if r.status_code != 200:
        pytest.skip(f"login failed {email}")
    tok = r.json().get("token") or r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin@avarus.ru", "admin")


@pytest.fixture(scope="module")
def client():
    return _login("user@demo.com", "demo123")


@pytest.fixture(scope="module")
def product_id(admin):
    r = admin.get(f"{API}/admin/warehouse/stock")
    assert r.status_code == 200
    return r.json()["items"][0]["id"]


@pytest.fixture(scope="module")
def whs(admin):
    tag = uuid.uuid4().hex[:6]
    created = []
    for reg in (f"TEST_RegA_{tag}", f"TEST_RegB_{tag}"):
        r = admin.post(f"{API}/admin/warehouses", json={"name": f"TEST_WH_{reg}", "region": reg, "address": "x"})
        assert r.status_code == 200, r.text
        created.append(r.json())
    yield created
    for w in created:
        admin.delete(f"{API}/admin/warehouses/{w['id']}")


def _levels(admin, pid):
    items = admin.get(f"{API}/admin/warehouse/stock").json()["items"]
    it = next(i for i in items if i["id"] == pid)
    return it, {w["warehouse_id"]: w["quantity"] for w in it["warehouses"]}


# Warehouses CRUD
class TestWarehouseCRUD:
    def test_validation(self, admin):
        r = admin.post(f"{API}/admin/warehouses", json={"name": " ", "region": "x"})
        assert r.status_code == 400

    def test_client_forbidden(self, client):
        assert client.get(f"{API}/admin/warehouses").status_code == 403

    def test_create_update_delete(self, admin):
        r = admin.post(f"{API}/admin/warehouses", json={"name": "TEST_tmp", "region": "TEST_tmpreg"})
        wid = r.json()["id"]
        r = admin.put(f"{API}/admin/warehouses/{wid}", json={"name": "TEST_tmp2", "region": "TEST_tmpreg2", "address": "a"})
        assert r.status_code == 200
        lst = admin.get(f"{API}/admin/warehouses").json()
        w = next(x for x in lst if x["id"] == wid)
        assert w["name"] == "TEST_tmp2" and w["region"] == "TEST_tmpreg2"
        assert "TEST_tmpreg2" in requests.get(f"{API}/regions").json()["regions"]
        assert admin.delete(f"{API}/admin/warehouses/{wid}").status_code == 200
        assert not any(x["id"] == wid for x in admin.get(f"{API}/admin/warehouses").json())

    def test_update_404(self, admin):
        assert admin.put(f"{API}/admin/warehouses/nope", json={"name": "a", "region": "b"}).status_code == 404


# Per-warehouse stock flows
class TestStockFlows:
    def test_receipt_requires_warehouse(self, admin, product_id):
        r = admin.post(f"{API}/admin/warehouse/receipts", json={"warehouse_id": "nope", "items": [{"product_id": product_id, "quantity": 1}]})
        assert r.status_code == 400

    def test_receipt_writeoff_transfer_delete_guard(self, admin, product_id, whs):
        a, b = whs
        before, lv0 = _levels(admin, product_id)
        r = admin.post(f"{API}/admin/warehouse/receipts", json={"warehouse_id": a["id"], "supplier": "TEST_sup", "items": [{"product_id": product_id, "quantity": 5}]})
        assert r.status_code == 200, r.text
        assert r.json()["warehouse_region"] == a["region"]
        it, lv = _levels(admin, product_id)
        assert lv[a["id"]] == 5
        assert it["stock"] == before["stock"] + 5
        assert a["region"] in it["regions"]
        # product public stock_regions
        p = requests.get(f"{API}/products/{product_id}").json()
        assert a["region"] in (p.get("stock_regions") or [])
        # writeoff more than on warehouse -> 400
        r = admin.post(f"{API}/admin/warehouse/movement", json={"product_id": product_id, "type": "writeoff", "quantity": 6, "warehouse_id": a["id"]})
        assert r.status_code == 400
        # delete warehouse with stock -> 400
        assert admin.delete(f"{API}/admin/warehouses/{a['id']}").status_code == 400
        # transfer 3 a->b
        r = admin.post(f"{API}/admin/warehouse/transfer", json={"product_id": product_id, "from_warehouse_id": a["id"], "to_warehouse_id": b["id"], "quantity": 3})
        assert r.status_code == 200, r.text
        it, lv = _levels(admin, product_id)
        assert lv[a["id"]] == 2 and lv[b["id"]] == 3
        assert it["stock"] == before["stock"] + 5
        # transfer too much
        r = admin.post(f"{API}/admin/warehouse/transfer", json={"product_id": product_id, "from_warehouse_id": a["id"], "to_warehouse_id": b["id"], "quantity": 99})
        assert r.status_code == 400
        # writeoff all back
        for w, q in ((a, 2), (b, 3)):
            r = admin.post(f"{API}/admin/warehouse/movement", json={"product_id": product_id, "type": "writeoff", "quantity": q, "warehouse_id": w["id"], "reason": "TEST"})
            assert r.status_code == 200, r.text
        it, lv = _levels(admin, product_id)
        assert it["stock"] == before["stock"]
        assert a["region"] not in it["regions"]

    def test_movement_receipt_quick(self, admin, product_id, whs):
        a = whs[0]
        r = admin.post(f"{API}/admin/warehouse/movement", json={"product_id": product_id, "type": "receipt", "quantity": 1, "warehouse_id": a["id"]})
        assert r.status_code == 200 and r.json()["warehouse_name"] == a["name"]
        r = admin.post(f"{API}/admin/warehouse/movement", json={"product_id": product_id, "type": "writeoff", "quantity": 1, "warehouse_id": a["id"]})
        assert r.status_code == 200

    def test_transfer_to_nonexistent_warehouse(self, admin, product_id, whs):
        a = whs[0]
        admin.post(f"{API}/admin/warehouse/movement", json={"product_id": product_id, "type": "receipt", "quantity": 1, "warehouse_id": a["id"]})
        r = admin.post(f"{API}/admin/warehouse/transfer", json={"product_id": product_id, "from_warehouse_id": a["id"], "to_warehouse_id": "TEST_nonexistent", "quantity": 1})
        code = r.status_code
        if code == 200:  # cleanup phantom: move back
            admin.post(f"{API}/admin/warehouse/transfer", json={"product_id": product_id, "from_warehouse_id": "TEST_nonexistent", "to_warehouse_id": a["id"], "quantity": 1})
        admin.post(f"{API}/admin/warehouse/movement", json={"product_id": product_id, "type": "writeoff", "quantity": 1, "warehouse_id": a["id"]})
        assert code in (400, 404), "transfer to nonexistent warehouse accepted"


# Regions + delivery display
class TestRegionsDelivery:
    def test_regions_public(self):
        r = requests.get(f"{API}/regions")
        assert r.status_code == 200 and isinstance(r.json()["regions"], list)

    def test_me_region(self, client):
        r = client.put(f"{API}/me/region", json={"region": "Ростов"})
        assert r.status_code == 200 and r.json()["region"] == "Ростов"
        me = client.get(f"{API}/auth/me").json()
        assert me.get("region") == "Ростов"

    def test_delivery_display_get(self):
        d = requests.get(f"{API}/delivery-display").json()
        assert set(d) >= {"in_region", "other_region", "out_of_stock"}

    def test_delivery_display_put_roundtrip(self, admin):
        orig = requests.get(f"{API}/delivery-display").json()
        new = {k: dict(v) for k, v in orig.items()}
        new["other_region"]["label"] = "TEST_label"
        r = admin.put(f"{API}/admin/delivery-display", json=new)
        assert r.status_code == 200
        assert requests.get(f"{API}/delivery-display").json()["other_region"]["label"] == "TEST_label"
        admin.put(f"{API}/admin/delivery-display", json=orig)

    def test_delivery_display_client_forbidden(self, client):
        assert client.put(f"{API}/admin/delivery-display", json={}).status_code == 403

    def test_delivery_display_bad_int(self, admin):
        r = admin.put(f"{API}/admin/delivery-display", json={"in_region": {"days_min": "abc"}})
        assert r.status_code in (400, 422), f"got {r.status_code}"


# Regression
class TestRegression:
    def test_cogs(self, admin):
        r = admin.get(f"{API}/admin/warehouse/cogs-report")
        assert r.status_code == 200 and "profit" in r.json()

    def test_stock_summary_reserved(self, admin):
        s = admin.get(f"{API}/admin/warehouse/stock").json()["summary"]
        assert "total_reserved" in s
