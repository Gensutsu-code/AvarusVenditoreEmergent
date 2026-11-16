# Iteration 105: regions directory, warehouse form, map, cart delivery, return doc, individual conditions
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
        pytest.skip(f"login failed {email}: {r.status_code} {r.text[:200]}")
    tok = r.json().get("token") or r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin@avarus.ru", os.environ["TEST_ADMIN_PASSWORD"])


@pytest.fixture(scope="module")
def client():
    return _login("user@demo.com", os.environ["TEST_CLIENT_PASSWORD"])


@pytest.fixture(scope="module")
def client2():
    return _login("0x0errorr@gmail.com", os.environ["TEST_CLIENT2_PASSWORD"])


# --- REGIONS DIRECTORY ---
class TestRegionsDirectory:
    def test_list_regions_auth(self, admin):
        r = admin.get(f"{API}/admin/regions")
        assert r.status_code == 200
        regs = r.json()
        assert isinstance(regs, list)
        names = [r["name"] for r in regs]
        assert "Москва" in names
        for reg in regs:
            assert "warehouses_count" in reg

    def test_client_cannot_list_regions(self, client):
        assert client.get(f"{API}/admin/regions").status_code == 403

    def test_create_rename_delete_region(self, admin):
        tag = uuid.uuid4().hex[:6].upper()
        name = f"TEST_Region_{tag}"
        r = admin.post(f"{API}/admin/regions", json={"name": name})
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        assert r.json()["name"] == name

        # Duplicate case-insensitive
        r2 = admin.post(f"{API}/admin/regions", json={"name": name.lower()})
        assert r2.status_code == 400

        # Empty
        assert admin.post(f"{API}/admin/regions", json={"name": "   "}).status_code == 400

        # Rename
        new_name = f"TEST_Region_{tag}_R"
        r = admin.put(f"{API}/admin/regions/{rid}", json={"name": new_name})
        assert r.status_code == 200, r.text
        # list reflects
        regs = admin.get(f"{API}/admin/regions").json()
        assert any(x["id"] == rid and x["name"] == new_name for x in regs)

        # Delete (no warehouses)
        r = admin.delete(f"{API}/admin/regions/{rid}")
        assert r.status_code == 200
        # Deleting again -> 404
        assert admin.delete(f"{API}/admin/regions/{rid}").status_code == 404

    def test_delete_region_with_warehouses_rejected(self, admin):
        regs = admin.get(f"{API}/admin/regions").json()
        msk = next(r for r in regs if r["name"] == "Москва")
        r = admin.delete(f"{API}/admin/regions/{msk['id']}")
        assert r.status_code == 400
        assert "склад" in r.text.lower()

    def test_rename_cascades_to_warehouses(self, admin):
        # Create region + warehouse, rename region, confirm warehouse.region updated
        tag = uuid.uuid4().hex[:6].upper()
        n1 = f"TEST_Casc_{tag}"
        n2 = f"TEST_Casc_{tag}_X"
        r = admin.post(f"{API}/admin/regions", json={"name": n1})
        assert r.status_code == 200
        rid = r.json()["id"]
        wr = admin.post(f"{API}/admin/warehouses", json={"name": f"TEST_WH_{tag}", "region": n1, "address": "a"})
        assert wr.status_code == 200, wr.text
        wid = wr.json()["id"]
        try:
            # rename
            assert admin.put(f"{API}/admin/regions/{rid}", json={"name": n2}).status_code == 200
            whs = admin.get(f"{API}/admin/warehouses").json()
            w = next(x for x in whs if x["id"] == wid)
            assert w["region"] == n2
        finally:
            admin.delete(f"{API}/admin/warehouses/{wid}")
            admin.delete(f"{API}/admin/regions/{rid}")


# --- WAREHOUSE FORM: region validation, phone/hours/coords/is_public ---
class TestWarehouseForm:
    def test_create_wh_region_must_be_in_directory(self, admin):
        bad = f"TEST_NoSuchReg_{uuid.uuid4().hex[:6]}"
        r = admin.post(f"{API}/admin/warehouses", json={"name": "TEST_wh_x", "region": bad})
        assert r.status_code == 400
        assert "регион" in r.text.lower()

    def test_coords_validation(self, admin):
        tag = uuid.uuid4().hex[:6].upper()
        reg = f"TEST_CoordReg_{tag}"
        admin.post(f"{API}/admin/regions", json={"name": reg})
        try:
            # Only lat
            r = admin.post(f"{API}/admin/warehouses", json={"name": "x", "region": reg, "lat": 55.0})
            assert r.status_code == 400
            # Out of range
            r = admin.post(f"{API}/admin/warehouses", json={"name": "x", "region": reg, "lat": 999, "lng": 10})
            assert r.status_code == 400
            # Valid full
            r = admin.post(f"{API}/admin/warehouses", json={
                "name": f"TEST_WH_C_{tag}", "region": reg, "address": "addr",
                "phone": "+7 999", "hours": "9-18", "lat": 55.75, "lng": 37.62, "is_public": False
            })
            assert r.status_code == 200, r.text
            wid = r.json()["id"]
            try:
                # saved all fields
                w = next(x for x in admin.get(f"{API}/admin/warehouses").json() if x["id"] == wid)
                assert w["lat"] == 55.75 and w["lng"] == 37.62
                assert w["phone"] == "+7 999" and w["hours"] == "9-18"
                assert w["is_public"] is False
                # public endpoint hides it
                pub = requests.get(f"{API}/warehouses/public").json()
                assert not any(x["id"] == wid for x in pub)
                # make public and re-check
                assert admin.put(f"{API}/admin/warehouses/{wid}", json={
                    "name": w["name"], "region": reg, "address": "addr", "lat": 55.75, "lng": 37.62,
                    "phone": "+7 999", "hours": "9-18", "is_public": True
                }).status_code == 200
                pub = requests.get(f"{API}/warehouses/public").json()
                assert any(x["id"] == wid for x in pub)
            finally:
                admin.delete(f"{API}/admin/warehouses/{wid}")
        finally:
            # delete region
            regs = admin.get(f"{API}/admin/regions").json()
            r = next((x for x in regs if x["name"] == reg), None)
            if r:
                admin.delete(f"{API}/admin/regions/{r['id']}")


# --- CLIENT MAP PAGE / PUBLIC WAREHOUSES ---
class TestPublicWarehouses:
    def test_public_no_auth(self):
        r = requests.get(f"{API}/warehouses/public")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        for w in r.json():
            # is_public should not be false
            assert w.get("is_public") is not False or "is_public" not in w


# --- CART DELIVERY & INDIVIDUAL DELIVERY COST ---
class TestCartDelivery:
    @pytest.fixture(autouse=True)
    def cart_item(self, client):
        """Delivery cost is only calculated for a cart with goods."""
        pid = next(p["id"] for p in client.get(f"{API}/products").json() if (p.get("stock") or 0) > 0)
        client.post(f"{API}/cart/add", json={"product_id": pid, "quantity": 1})
        yield
        client.delete(f"{API}/cart/{pid}")

    def test_get_cart_includes_stock_regions_and_delivery_cost(self, client):
        r = client.get(f"{API}/cart")
        assert r.status_code == 200
        data = r.json()
        # user@demo.com has individual delivery_cost=0
        assert "delivery_cost" in data
        assert data["delivery_cost"] == 0
        for it in data.get("items", []):
            assert "stock_regions" in it

    def test_admin_set_delivery_cost_then_null(self, admin, client):
        # fetch user id
        users = admin.get(f"{API}/admin/users").json()
        if isinstance(users, dict):
            users = users.get("users") or users.get("items") or []
        u = next(x for x in users if x.get("email") == "user@demo.com")
        uid = u["id"]
        orig_delivery = u.get("delivery_cost")

        try:
            # Set to 250
            r = admin.put(f"{API}/admin/users/{uid}", json={"delivery_cost": 250})
            assert r.status_code == 200, r.text
            cart = client.get(f"{API}/cart").json()
            assert cart["delivery_cost"] == 250

            # Set to null -> site-wide (should be None)
            r = admin.put(f"{API}/admin/users/{uid}", json={"delivery_cost": None})
            assert r.status_code == 200, r.text
            cart = client.get(f"{API}/cart").json()
            assert cart.get("delivery_cost") is None

            # Negative rejected
            r = admin.put(f"{API}/admin/users/{uid}", json={"delivery_cost": -5})
            assert r.status_code == 400
        finally:
            # restore
            admin.put(f"{API}/admin/users/{uid}", json={"delivery_cost": orig_delivery})


# --- PRODUCTS region filter ---
class TestProductsRegionFilter:
    def test_filter_by_region(self):
        # Fetch any product with stock_regions
        all_p = requests.get(f"{API}/products?limit=500").json()
        with_reg = [p for p in all_p if p.get("stock_regions")]
        if not with_reg:
            pytest.skip("no products with stock_regions")
        reg = with_reg[0]["stock_regions"][0]
        filtered = requests.get(f"{API}/products?region={reg}&limit=500").json()
        assert all(reg in (p.get("stock_regions") or []) for p in filtered)
        assert any(p["id"] == with_reg[0]["id"] for p in filtered)


# --- RETURN DOCUMENT ---
class TestReturnDocument:
    def test_order_404(self, admin):
        r = admin.get(f"{API}/admin/orders/nope-404/return-document")
        assert r.status_code == 404

    def test_non_admin_forbidden(self, client):
        # find any order for the client
        orders = client.get(f"{API}/orders").json()
        if isinstance(orders, dict):
            orders = orders.get("orders") or orders.get("items") or []
        if not orders:
            pytest.skip("no orders")
        oid = orders[0]["id"]
        r = client.get(f"{API}/admin/orders/{oid}/return-document")
        assert r.status_code == 403

    def test_return_doc_ok(self, admin, client2):
        orders = client2.get(f"{API}/orders").json()
        if isinstance(orders, dict):
            orders = orders.get("orders") or orders.get("items") or []
        if not orders:
            pytest.skip("no orders")
        oid = orders[0]["id"]
        r = admin.get(f"{API}/admin/orders/{oid}/return-document")
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "wordprocessingml" in ct or "officedocument" in ct or "docx" in ct
        assert len(r.content) > 1000
        # unknown return id -> 404
        r404 = admin.get(f"{API}/admin/orders/{oid}/return-document?return_id=nope-xx")
        assert r404.status_code == 404


# --- CLIENT INDIVIDUAL CONDITIONS -> credit sync ---
class TestIndividualConditions:
    def test_credit_sync_and_validation(self, admin, client):
        users = admin.get(f"{API}/admin/users").json()
        if isinstance(users, dict):
            users = users.get("users") or users.get("items") or []
        u = next(x for x in users if x.get("email") == "user@demo.com")
        uid = u["id"]
        orig = {
            "individual_discount": u.get("individual_discount"),
            "delivery_cost": u.get("delivery_cost"),
            "deferral_days": u.get("deferral_days"),
            "credit_limit": u.get("credit_limit"),
        }
        try:
            # Negative discount
            assert admin.put(f"{API}/admin/users/{uid}", json={"individual_discount": -5}).status_code == 400
            # >100 discount
            assert admin.put(f"{API}/admin/users/{uid}", json={"individual_discount": 150}).status_code == 400
            # Negative deferral
            assert admin.put(f"{API}/admin/users/{uid}", json={"deferral_days": -1}).status_code == 400
            # Negative credit limit
            assert admin.put(f"{API}/admin/users/{uid}", json={"credit_limit": -1}).status_code == 400

            # Set credit_limit 50000, deferral_days 7 -> credit approved
            r = admin.put(f"{API}/admin/users/{uid}", json={"credit_limit": 50000, "deferral_days": 7})
            assert r.status_code == 200, r.text
            me = client.get(f"{API}/credit/my")
            assert me.status_code == 200, me.text
            cj = me.json()
            # approved status with limit and 7 days term
            status = cj.get("status") or cj.get("credit_status")
            assert status == "approved"
            limit = cj.get("limit") or cj.get("credit_limit")
            assert float(limit) == 50000
            term = cj.get("term_days") or cj.get("credit_term_days") or cj.get("deferral_days")
            assert int(term) == 7

            # Set credit_limit 0 -> credit_status none
            r = admin.put(f"{API}/admin/users/{uid}", json={"credit_limit": 0})
            assert r.status_code == 200
            me = client.get(f"{API}/credit/my").json()
            status = me.get("status") or me.get("credit_status")
            assert status in (None, "none", "rejected")
        finally:
            admin.put(f"{API}/admin/users/{uid}", json=orig)
