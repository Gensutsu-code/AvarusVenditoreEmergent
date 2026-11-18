"""Iter129 final retest: PUT /admin/users/{id} no plaintext password leak, password change bumps session,
delete log snapshot has no password keys. Creates throwaway TEST_ users only (deleted by id).
Run: cd /app/backend && python -m pytest tests/test_iter129_admin_final.py --noconftest -p no:xdist"""
import os
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


def _mk_user():
    email = f"test_iter129_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "TEST_Orig_Pw_129!"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "TEST_Iter129 User"}, timeout=20)
    assert r.status_code == 200, r.text
    return {"id": DB.users.find_one({"email": email}, {"id": 1})["id"], "email": email, "password": pwd}


@pytest.fixture(scope="module")
def test_user(admin):
    u = _mk_user()
    yield u
    requests.delete(f"{API}/admin/users/{u['id']}", headers=admin, timeout=20)


# PUT response must not leak plaintext password fields (legacy simulated on own TEST user)
def test_put_no_leak_name_and_phone(admin, test_user):
    DB.users.update_one({"id": test_user["id"]}, {"$set": {"password_plain": "TEST_lp", "plain_password": "TEST_lp2"}})
    r = requests.put(f"{API}/admin/users/{test_user['id']}", headers=admin,
                     json={"name": "TEST_Iter129 Renamed", "phone": "+70000000129"}, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "TEST_Iter129 Renamed" and body["phone"] == "+70000000129"
    assert not [k for k in LEAK_KEYS if k in body], body.keys()
    assert "TEST_lp" not in r.text
    # details + list also clean
    d = requests.get(f"{API}/admin/users/{test_user['id']}/details", headers=admin, timeout=30)
    assert d.status_code == 200 and "TEST_lp" not in d.text and "password_plain" not in d.text
    lst = requests.get(f"{API}/admin/users", headers=admin, timeout=60).json()
    assert not [(u.get("email"), k) for u in lst for k in LEAK_KEYS if k in u]
    DB.users.update_one({"id": test_user["id"]}, {"$unset": {"password_plain": "", "plain_password": ""}})


# Persistence of name/phone edit
def test_edit_persists(admin, test_user):
    d = requests.get(f"{API}/admin/users/{test_user['id']}/details", headers=admin, timeout=30).json()
    u = d.get("user", d)
    assert u["name"] == "TEST_Iter129 Renamed" and u["phone"] == "+70000000129"


# Admin sets a new password -> new password works, old one fails, old session 401
def test_password_change_bumps_session(admin, test_user):
    s = requests.Session()
    lg = s.post(f"{API}/auth/login", json={"email": test_user["email"], "password": test_user["password"]}, timeout=20)
    assert lg.status_code == 200
    tok = lg.json()["token"]
    assert s.get(f"{API}/auth/me", timeout=20).status_code == 200
    new_pw = "TEST_New_Pw_129!"
    r = requests.put(f"{API}/admin/users/{test_user['id']}", headers=admin, json={"password": new_pw}, timeout=20)
    assert r.status_code == 200
    assert not [k for k in LEAK_KEYS if k in r.json()]
    assert s.get(f"{API}/auth/me", timeout=20).status_code == 401  # old cookie
    assert requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=20).status_code == 401
    assert requests.post(f"{API}/auth/login", json={"email": test_user["email"], "password": test_user["password"]}, timeout=20).status_code == 401
    assert requests.post(f"{API}/auth/login", json={"email": test_user["email"], "password": new_pw}, timeout=20).status_code == 200
    assert DB.users.find_one({"id": test_user["id"]})["password"].startswith("$2b$")


# Delete log snapshot excludes password keys
def test_delete_log_no_password(admin):
    u = _mk_user()
    DB.users.update_one({"id": u["id"]}, {"$set": {"plain_password": "TEST_dp"}})
    r = requests.delete(f"{API}/admin/users/{u['id']}", headers=admin, timeout=20)
    assert r.status_code == 200
    assert DB.users.find_one({"id": u["id"]}) is None
    hits = []
    for name in DB.list_collection_names():
        if "log" in name or "activit" in name:
            hits += list(DB[name].find({"$text": {"$search": "x"}} if False else {"$or": [
                {"entity_id": u["id"]}, {"target_id": u["id"]}, {"details.id": u["id"]}, {"old_state.id": u["id"]}]}, {"_id": 0}).limit(5))
    assert "TEST_dp" not in str(hits)
    assert "$2b$" not in str(hits)
