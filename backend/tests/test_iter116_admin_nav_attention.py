"""Iteration 116 — admin attention counters + manager role restrictions"""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}
MANAGER = {"email": "manager@avarus.ru", "password": os.environ["TEST_MANAGER_PASSWORD"]}
CLIENT = {"email": "user@demo.com", "password": os.environ["TEST_CLIENT_PASSWORD"]}

ATTENTION_KEYS = [
    "orders", "returns", "price_requests", "cart_discounts", "product_requests",
    "cashback_withdrawals", "prize_redemptions", "credit_requests",
    "conditions_requests", "chats",
]


def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {creds['email']}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return login(ADMIN)


@pytest.fixture(scope="module")
def manager_token():
    return login(MANAGER)


@pytest.fixture(scope="module")
def client_token():
    return login(CLIENT)


class TestAttentionEndpoint:
    def test_admin_can_access(self, admin_token):
        r = requests.get(f"{API}/admin/attention", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ATTENTION_KEYS:
            assert k in data, f"missing key {k}"
            assert isinstance(data[k], int), f"{k} should be int, got {type(data[k])}"

    def test_manager_forbidden(self, manager_token):
        r = requests.get(f"{API}/admin/attention", headers={"Authorization": f"Bearer {manager_token}"}, timeout=30)
        assert r.status_code == 403

    def test_client_forbidden(self, client_token):
        r = requests.get(f"{API}/admin/attention", headers={"Authorization": f"Bearer {client_token}"}, timeout=30)
        assert r.status_code == 403

    def test_anon_unauthorized(self):
        r = requests.get(f"{API}/admin/attention", timeout=30)
        assert r.status_code in (401, 403)


class TestFeatureGating:
    """When a site-function is disabled, its count must be 0."""

    def _get_features(self, admin_token):
        r = requests.get(f"{API}/features", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200
        return r.json()

    def _set_feature(self, admin_token, key, enabled, audience="all"):
        r = requests.put(
            f"{API}/admin/features/{key}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"enabled": enabled, "audience": audience},
            timeout=30,
        )
        assert r.status_code == 200, r.text

    def test_disable_returns_zeroes_counter(self, admin_token):
        headers = {"Authorization": f"Bearer {admin_token}"}
        # snapshot current state
        feats = self._get_features(admin_token)
        prev = feats.get("returns")
        if not prev:
            pytest.skip("returns feature not registered")
        try:
            self._set_feature(admin_token, "returns", False)
            r = requests.get(f"{API}/admin/attention", headers=headers, timeout=30)
            assert r.status_code == 200
            assert r.json()["returns"] == 0
        finally:
            self._set_feature(admin_token, "returns", prev.get("enabled", True), prev.get("audience", "all"))

    def test_counts_are_nonnegative(self, admin_token):
        r = requests.get(f"{API}/admin/attention", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200
        for k, v in r.json().items():
            assert isinstance(v, int) and v >= 0


class TestManagerRole:
    def test_manager_login_returns_role(self):
        r = requests.post(f"{API}/auth/login", json=MANAGER, timeout=30)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "manager"

    def test_manager_cannot_list_users(self, manager_token):
        r = requests.get(f"{API}/admin/users", headers={"Authorization": f"Bearer {manager_token}"}, timeout=30)
        assert r.status_code == 403

    def test_manager_me(self, manager_token):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {manager_token}"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["role"] == "manager"
