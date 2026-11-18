"""Iter128 retest: password leak fix, search by customer name/email, legacy cap, global status_counts,
password preserved on admin edit. Creates only one throwaway TEST_ user (deleted by id).
Run: cd /app/backend && python -m pytest tests/test_iter128_admin_retest.py --noconftest -p no:xdist"""
import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).parents[1] / ".env")

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
DB = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
LEAK_KEYS = ("password", "password_plain", "plain_password", "password_hash")


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@avarus.ru", "password": os.environ["ADMIN_PASSWORD"]}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def test_user(admin):
    email = f"test_iter128_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "TEST_Orig_Pw_128!"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "TEST_Iter128 User"}, timeout=20)
    assert r.status_code == 200, r.text
    uid = DB.users.find_one({"email": email}, {"id": 1})["id"]
    yield {"id": uid, "email": email, "password": pwd}
    d = requests.delete(f"{API}/admin/users/{uid}", headers=admin, timeout=20)
    assert d.status_code in (200, 404)


# --- Security: no password keys leak ---
class TestPasswordLeak:
    def test_users_list_no_password_keys(self, admin):
        users = requests.get(f"{API}/admin/users", headers=admin, timeout=60).json()
        assert users
        leaked = [(u.get("email"), k) for u in users for k in LEAK_KEYS if k in u]
        assert not leaked, leaked[:5]

    def test_details_no_password_keys_for_legacy_users(self, admin):
        legacy = list(DB.users.find({"$or": [{"password_plain": {"$exists": True}}, {"plain_password": {"$exists": True}}]}, {"id": 1}).limit(5))
        if not legacy:
            pytest.skip("no legacy users with plaintext password left in DB")
        for u in legacy:
            r = requests.get(f"{API}/admin/users/{u['id']}/details", headers=admin, timeout=30)
            assert r.status_code == 200
            body = r.text
            assert "password_plain" not in body and "plain_password" not in body, u["id"]

    def test_put_response_no_password_plain(self, admin, test_user):
        # Simulate a legacy account (own TEST_ user only) and edit an unrelated field.
        DB.users.update_one({"id": test_user["id"]}, {"$set": {"password_plain": "TEST_legacy_plain"}})
        r = requests.put(f"{API}/admin/users/{test_user['id']}", headers=admin, json={"name": "TEST_Iter128 Renamed"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == "TEST_Iter128 Renamed"
        leaked = [k for k in LEAK_KEYS if k in body]
        DB.users.update_one({"id": test_user["id"]}, {"$unset": {"password_plain": ""}})
        assert not leaked, f"PUT /admin/users/{{id}} response leaks {leaked}"


# --- Password preserved when admin edits without password ---
class TestPasswordPreserved:
    def test_edit_without_password_keeps_login(self, admin, test_user):
        r = requests.put(f"{API}/admin/users/{test_user['id']}", headers=admin,
                         json={"name": "TEST_Iter128 Edited", "phone": "+70000000128", "role": "user", "customer_status": "retail"}, timeout=20)
        assert r.status_code == 200
        lg = requests.post(f"{API}/auth/login", json={"email": test_user["email"], "password": test_user["password"]}, timeout=20)
        assert lg.status_code == 200, lg.text
        assert lg.json()["user"]["name"] == "TEST_Iter128 Edited"
        assert DB.users.find_one({"id": test_user["id"]})["password"].startswith("$2")


# --- Search by customer account name/email ---
class TestSearchCustomer:
    def _find_case(self, field):
        for o in DB.orders.find({"user_id": {"$nin": [None, ""]}}, {"_id": 0, "id": 1, "user_id": 1, "full_name": 1, "phone": 1}).limit(800):
            u = DB.users.find_one({"id": o["user_id"]}, {"name": 1, "email": 1})
            val = (u or {}).get(field) or ""
            frag = val.split("@")[0][:6] if field == "email" else val[:6]
            if len(frag) < 4:
                continue
            if frag.lower() in (o.get("full_name") or "").lower() or frag in (o.get("phone") or "") or frag in o["id"]:
                continue
            return o, frag
        pytest.skip(f"no order with distinct account {field}")

    @pytest.mark.parametrize("field", ["email", "name"])
    def test_search_matches_account(self, admin, field):
        o, frag = self._find_case(field)
        d = requests.get(f"{API}/admin/orders", headers=admin, params={"page": 1, "page_size": 200, "search": frag}, timeout=30).json()
        assert o["id"] in [x["id"] for x in d["items"]] or d["total"] > 200, (frag, o["id"])
        rx = re.compile(re.escape(frag), re.I)
        uids = set(DB.users.distinct("id", {"$or": [{"name": rx}, {"email": rx}]}))
        expected = DB.orders.count_documents({"$or": [{"id": rx}, {"full_name": rx}, {"phone": rx}, {"user_id": {"$in": list(uids)}}]})
        assert d["total"] == expected


# --- Legacy path cap + global counts ---
class TestOrdersAggregates:
    def test_legacy_returns_all(self, admin):
        data = requests.get(f"{API}/admin/orders", headers=admin, timeout=60).json()
        assert isinstance(data, list)
        assert len(data) == min(DB.orders.count_documents({}), 5000)

    def test_status_counts_global_under_filters(self, admin):
        base = requests.get(f"{API}/admin/orders", headers=admin, params={"page": 1, "page_size": 10}, timeout=30).json()
        filt = requests.get(f"{API}/admin/orders", headers=admin, params={"page": 1, "page_size": 10, "status": "cancelled", "search": "a"}, timeout=30).json()
        assert filt["status_counts"] == base["status_counts"]
        assert filt["total_revenue"] == base["total_revenue"]
        assert sum(base["status_counts"].values()) == DB.orders.count_documents({})
        assert filt["total"] <= base["total"]
