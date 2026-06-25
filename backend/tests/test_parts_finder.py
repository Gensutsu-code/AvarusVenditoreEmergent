"""Backend tests for the Parts Finder feature (Подбор запчастей).
Covers: public config, search (valid/empty), admin settings GET/PUT persistence
and the critical security check that api_key is NOT exposed via public config.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-merge-fulfill.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@avarus.ru", "password": "admin"}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token in {r.json()}"
    return tok


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# --- Public config endpoint ---
class TestPartsFinderConfig:
    def test_public_config_shape(self):
        r = requests.get(f"{API}/parts-finder/config", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("catalog_enabled", "ai_enabled", "provider"):
            assert k in data, f"missing {k} in {data}"
        # CRITICAL: api_key MUST NOT leak via the public endpoint
        assert "api_key" not in data
        assert "base_url" not in data


# --- Public search endpoint ---
class TestPartsFinderSearch:
    def test_search_all_empty_returns_400(self):
        r = requests.post(f"{API}/parts-finder/search", json={}, timeout=20)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"

    def test_search_with_query_and_brand(self):
        payload = {"query": "фильтр топливный", "brand": "MAN"}
        r = requests.post(f"{API}/parts-finder/search", json=payload, timeout=45)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("mode") in ("ai", "basic", "catalog"), f"unexpected mode {data.get('mode')}"
        assert "note" in data and isinstance(data["note"], str) and data["note"]
        assert "count" in data and isinstance(data["count"], int)
        assert "results" in data and isinstance(data["results"], list)
        # Validate result item shape (when any)
        if data["results"]:
            item = data["results"][0]
            for k in ("id", "name", "article", "price"):
                assert k in item, f"missing {k} in result item {item}"

    def test_search_with_cross_number(self):
        r = requests.post(f"{API}/parts-finder/search", json={"cross_number": "AVR"}, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json().get("results"), list)


# --- Admin settings GET/PUT ---
class TestAdminSettings:
    def test_settings_requires_auth(self):
        r = requests.get(f"{API}/admin/parts-finder/settings", timeout=15)
        assert r.status_code in (401, 403), f"expected auth error got {r.status_code}"

    def test_get_settings_admin(self, admin_headers):
        r = requests.get(f"{API}/admin/parts-finder/settings", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("catalog_enabled", "provider", "base_url", "api_key", "ai_enabled"):
            assert k in data

    def test_update_settings_and_persistence(self, admin_headers):
        payload = {
            "catalog_enabled": True,
            "provider": "TEST_Laximo",
            "base_url": "https://test.example.com",
            "api_key": "TEST_KEY_12345",
            "ai_enabled": True,
        }
        r = requests.put(f"{API}/admin/parts-finder/settings", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("provider") == "TEST_Laximo"

        # Persistence: GET again
        r2 = requests.get(f"{API}/admin/parts-finder/settings", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["provider"] == "TEST_Laximo"
        assert d2["catalog_enabled"] is True
        assert d2["api_key"] == "TEST_KEY_12345"

        # Public config reflects catalog_enabled now (since api_key set) but never returns api_key
        pub = requests.get(f"{API}/parts-finder/config", timeout=15).json()
        assert pub["catalog_enabled"] is True
        assert pub["provider"] == "TEST_Laximo"
        assert "api_key" not in pub

        # Cleanup: disable catalog and clear test values
        cleanup = {
            "catalog_enabled": False,
            "provider": "",
            "base_url": "",
            "api_key": "",
            "ai_enabled": True,
        }
        requests.put(f"{API}/admin/parts-finder/settings", json=cleanup, headers=admin_headers, timeout=15)
