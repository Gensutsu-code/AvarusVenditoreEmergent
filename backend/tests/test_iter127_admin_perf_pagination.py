"""Iter127: admin panel performance — /admin/users N+1 fix and /admin/orders server-side pagination.
Read-only against live data except one throwaway TEST_ order (created + deleted by id).
Run with --noconftest (conftest's session stock top-up isn't needed here)."""
import os
import time
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).parent / ".env.test")
load_dotenv(Path(__file__).parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).parents[1] / ".env")

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
DB = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@avarus.ru", "password": os.environ["ADMIN_PASSWORD"]}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _get(admin, path, **params):
    t = time.time()
    r = requests.get(f"{API}{path}", headers=admin, params=params, timeout=60)
    return r, time.time() - t


# --- /admin/users (N+1 fix) ---
class TestAdminUsers:
    def test_shape_and_timing(self, admin):
        r, dt = _get(admin, "/admin/users")
        print(f"/admin/users took {dt:.2f}s")
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) > 0
        for f in ("orders_count", "total_orders", "total_spent", "total_items", "first_order_date", "last_order_date", "popular_products", "recent_orders"):
            assert f in users[0], f
        assert all("password" not in u for u in users)
        assert all(u.get("role") != "manager" for u in users)
        assert dt < 3.0

    def test_stats_match_db(self, admin):
        users = _get(admin, "/admin/users")[0].json()
        with_orders = sorted([u for u in users if u["orders_count"] > 0], key=lambda u: -u["orders_count"])[:5]
        assert with_orders
        for u in with_orders:
            orders = list(DB.orders.find({"user_id": u["id"]}, {"_id": 0}).sort("created_at", -1))
            assert u["orders_count"] == len(orders)
            assert abs(u["total_spent"] - sum(o.get("total", 0) for o in orders)) < 0.01
            assert u["total_items"] == sum(sum(i.get("quantity", 0) for i in o.get("items", [])) for o in orders)
            assert [ro["id"] for ro in u["recent_orders"]] == [o["id"] for o in orders[:3]]
            dates = [o["created_at"] for o in orders if o.get("created_at")]
            assert u["first_order_date"] == min(dates) and u["last_order_date"] == max(dates)
            assert len(u["popular_products"]) <= 3

    def test_non_admin_forbidden(self):
        r = requests.get(f"{API}/admin/users", timeout=20)
        assert r.status_code in (401, 403)


# --- /admin/orders backward-compat flat array ---
class TestOrdersLegacy:
    def test_flat_array(self, admin):
        r, dt = _get(admin, "/admin/orders")
        print(f"/admin/orders (legacy) took {dt:.2f}s")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        db_total = DB.orders.count_documents({})
        assert len(data) == min(db_total, 1000), (len(data), db_total)
        assert all("manager_name" in o for o in data)
        assert any(o.get("customer_name") for o in data)
        assert all("_id" not in o for o in data)
        created = [o.get("created_at") or "" for o in data]
        assert created == sorted(created, reverse=True)


# --- /admin/orders paginated ---
class TestOrdersPaginated:
    def test_page1_shape_and_aggregates(self, admin):
        r, dt = _get(admin, "/admin/orders", page=1, page_size=50)
        print(f"/admin/orders?page=1&page_size=50 took {dt:.2f}s")
        assert r.status_code == 200
        d = r.json()
        assert set(d) >= {"items", "total", "page", "page_size", "status_counts", "total_revenue", "managers"}
        assert d["page"] == 1 and d["page_size"] == 50
        assert len(d["items"]) <= 50
        assert d["total"] == DB.orders.count_documents({})
        assert sum(d["status_counts"].values()) == d["total"]
        rev = sum(o.get("total", 0) for o in DB.orders.find({"status": "completed"}, {"total": 1}))
        assert abs(d["total_revenue"] - rev) < 0.01
        ids = [m["id"] for m in d["managers"]]
        assert len(ids) == len(set(ids))
        db_mgr = set(DB.orders.distinct("manager_id", {"manager_id": {"$ne": None}}))
        assert set(ids) <= db_mgr
        assert all(m["name"] is not None for m in d["managers"])
        assert all("manager_name" in o for o in d["items"])
        assert dt < 3.0

    def test_page2_non_overlapping(self, admin):
        p1 = _get(admin, "/admin/orders", page=1, page_size=20)[0].json()["items"]
        p2 = _get(admin, "/admin/orders", page=2, page_size=20)[0].json()["items"]
        assert len(p1) == 20 and len(p2) == 20
        assert not ({o["id"] for o in p1} & {o["id"] for o in p2})
        assert (p1[-1]["created_at"] or "") >= (p2[0]["created_at"] or "")

    def test_full_walk_no_dupes(self, admin):
        seen, page = [], 1
        while True:
            items = _get(admin, "/admin/orders", page=page, page_size=200)[0].json()["items"]
            if not items:
                break
            seen += [o["id"] for o in items]
            page += 1
        assert len(seen) == len(set(seen)) == DB.orders.count_documents({})

    def test_status_filter(self, admin):
        d = _get(admin, "/admin/orders", status="cancelled", page=1, page_size=10)[0].json()
        assert d["total"] == DB.orders.count_documents({"status": "cancelled"})
        assert all(o["status"] == "cancelled" for o in d["items"])
        assert len(d["items"]) <= 10

    def test_manager_filter(self, admin):
        mid = DB.orders.find_one({"manager_id": {"$nin": [None, ""]}}, {"manager_id": 1})["manager_id"]
        d = _get(admin, "/admin/orders", manager_id=mid, page=1, page_size=10)[0].json()
        assert d["total"] == DB.orders.count_documents({"manager_id": mid})
        assert all(o["manager_id"] == mid for o in d["items"])

    def test_manager_none(self, admin):
        d = _get(admin, "/admin/orders", manager_id="none", page=1, page_size=10)[0].json()
        assert d["total"] == DB.orders.count_documents({"manager_id": None})
        assert all(not o.get("manager_id") for o in d["items"])

    def test_search_phone_and_name(self, admin):
        o = DB.orders.find_one({"phone": {"$regex": r"\d{6}"}, "full_name": {"$nin": [None, ""]}}, {"_id": 0, "phone": 1, "full_name": 1, "id": 1})
        frag = o["phone"][-6:]
        d = _get(admin, "/admin/orders", search=frag, page=1, page_size=10)[0].json()
        assert d["total"] >= 1
        assert all(frag in (x.get("phone") or "") or frag.lower() in (x.get("full_name") or "").lower() or frag in x["id"] for x in d["items"])
        d2 = _get(admin, "/admin/orders", search=o["full_name"][:5], page=1, page_size=10)[0].json()
        assert d2["total"] >= 1
        d3 = _get(admin, "/admin/orders", search=o["id"][:8], page=1, page_size=10)[0].json()
        assert o["id"] in [x["id"] for x in d3["items"]]

    def test_search_regex_safe(self, admin):
        r = _get(admin, "/admin/orders", search="(.*[", page=1, page_size=10)[0]
        assert r.status_code == 200 and r.json()["total"] == 0

    def test_combined_filters(self, admin):
        d = _get(admin, "/admin/orders", status="completed", manager_id="none", page=1, page_size=10)[0].json()
        assert d["total"] == DB.orders.count_documents({"status": "completed", "manager_id": None})

    def test_bounds(self, admin):
        d = _get(admin, "/admin/orders", page=0, page_size=1000)[0].json()
        assert d["page"] == 1 and d["page_size"] == 200 and len(d["items"]) <= 200
        d = _get(admin, "/admin/orders", page=99999, page_size=50)[0].json()
        assert d["items"] == [] and d["total"] > 0
        assert _get(admin, "/admin/orders", page="x", page_size=50)[0].status_code == 422

    def test_non_admin_forbidden(self):
        assert requests.get(f"{API}/admin/orders", params={"page": 1, "page_size": 5}, timeout=20).status_code in (401, 403)
