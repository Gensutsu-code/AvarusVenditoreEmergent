"""Iter 120: cookie auth + CSRF origin guard + garage brand/model."""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://order-merge-fulfill.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

CLIENT = {"email": "user@demo.com", "password": os.environ["TEST_CLIENT_PASSWORD"]}
ADMIN = {"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}
MANAGER = {"email": "manager@avarus.ru", "password": os.environ["TEST_MANAGER_PASSWORD"]}


# ----- cookie auth ------
def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return s, r


@pytest.mark.parametrize("creds", [CLIENT, ADMIN, MANAGER])
def test_login_sets_httponly_cookie(creds):
    s, r = _login(creds)
    # Cookie set in response
    sc = r.headers.get("set-cookie", "")
    assert "access_token=" in sc.lower()
    assert "httponly" in sc.lower()
    assert "samesite=none" in sc.lower()
    assert "secure" in sc.lower()
    # Body still returns token for API clients
    assert "token" in r.json()
    # Session has the cookie and /me works
    assert "access_token" in s.cookies.get_dict()
    me = s.get(f"{API}/auth/me", timeout=15)
    assert me.status_code == 200
    assert me.json()["email"] == creds["email"].lower() or me.json()["email"] == creds["email"]


def test_logout_clears_cookie():
    s, _ = _login(CLIENT)
    r = s.post(f"{API}/auth/logout", timeout=15)
    assert r.status_code == 200
    # Cookie should be gone or empty
    me = s.get(f"{API}/auth/me", timeout=15)
    assert me.status_code in (401, 403)


def test_no_auth_returns_403():
    r = requests.get(f"{API}/auth/me", timeout=15)
    assert r.status_code == 403


def test_invalid_cookie_returns_401():
    r = requests.get(f"{API}/auth/me", cookies={"access_token": "garbage"}, timeout=15)
    assert r.status_code == 401


def test_bearer_token_header_works():
    r = requests.post(f"{API}/auth/login", json=CLIENT, timeout=15)
    token = r.json()["token"]
    r2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    assert r2.status_code == 200


# ----- CSRF origin guard ------
def test_evil_origin_with_cookie_is_blocked():
    s, _ = _login(CLIENT)
    r = s.get(f"{API}/auth/me", headers={"Origin": "https://evil.example"}, timeout=15)
    assert r.status_code == 403
    assert "посторон" in r.text.lower() or "detail" in r.text


def test_site_origin_with_cookie_ok():
    s, _ = _login(CLIENT)
    r = s.get(f"{API}/auth/me", headers={"Origin": BASE}, timeout=15)
    assert r.status_code == 200


def test_bearer_with_evil_origin_ok():
    r = requests.post(f"{API}/auth/login", json=CLIENT, timeout=15)
    token = r.json()["token"]
    r2 = requests.get(f"{API}/auth/me",
                     headers={"Authorization": f"Bearer {token}", "Origin": "https://evil.example"}, timeout=15)
    # Bearer bypasses cookie guard because cookie is absent in header-only request
    assert r2.status_code == 200


# ----- GARAGE brand/model ------
def test_garage_brand_model_create_and_edit():
    s, _ = _login(CLIENT)
    vin = "WMA06XZZ7KP654321"
    # cleanup any leftover
    existing = s.get(f"{API}/garage/vehicles", timeout=15).json()
    for v in existing:
        if v.get("vin") == vin:
            s.delete(f"{API}/garage/vehicles/{v['id']}", timeout=15)

    payload = {"type": "truck", "brand": "MAN", "model": "TGX 18.440",
               "vin": vin, "year": 2020, "name": ""}
    r = s.post(f"{API}/garage/vehicles", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    v = r.json()
    vid = v["id"]
    try:
        assert v["brand"] == "MAN"
        assert v["model"] == "TGX 18.440"
        assert v["name"] == "MAN TGX 18.440"

        # Update model
        r = s.put(f"{API}/garage/vehicles/{vid}",
                  json={"type": "truck", "brand": "MAN", "model": "TGX 26.500",
                        "vin": vin, "year": 2020, "name": ""}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "MAN TGX 26.500"
    finally:
        s.delete(f"{API}/garage/vehicles/{vid}", timeout=15)


def test_garage_rejects_empty_brand_and_name():
    s, _ = _login(CLIENT)
    vin = "WMA06XZZ7KP777777"
    payload = {"type": "truck", "brand": "", "model": "", "name": "",
               "vin": vin, "year": 2020}
    r = s.post(f"{API}/garage/vehicles", json=payload, timeout=15)
    assert r.status_code == 400


def test_garage_legacy_name_only_still_accepted():
    """Old API usage: just name, no brand/model - should still work."""
    s, _ = _login(CLIENT)
    vin = "WMA06XZZ7KP888888"
    existing = s.get(f"{API}/garage/vehicles", timeout=15).json()
    for v in existing:
        if v.get("vin") == vin:
            s.delete(f"{API}/garage/vehicles/{v['id']}", timeout=15)
    payload = {"type": "truck", "name": "DAF XF 105", "vin": vin, "year": 2019}
    r = s.post(f"{API}/garage/vehicles", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    vid = r.json()["id"]
    try:
        assert r.json()["name"] == "DAF XF 105"
    finally:
        s.delete(f"{API}/garage/vehicles/{vid}", timeout=15)
