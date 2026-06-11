"""
Iteration 58 — Tests for product discount/promo fields, bonus_eligible default,
and delivery_days=0 (Сегодня).
"""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # Fallback: read from frontend/.env directly (env not propagated to pytest shell)
        try:
            with open("/app/frontend/.env", "r") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not configured")
    return url.rstrip("/")


BASE_URL = _load_backend_url()

ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def all_products():
    r = requests.get(f"{BASE_URL}/api/products", timeout=15)
    assert r.status_code == 200
    return r.json()


# ---------------------- GET /api/products: defaults ----------------------

class TestProductDefaults:
    def test_get_products_returns_discount_fields(self, all_products):
        assert len(all_products) > 0
        sample = all_products[0]
        # All discount/bonus/delivery fields should exist in response
        for field in [
            "discount_active",
            "discount_type",
            "discount_value",
            "discount_label",
            "discount_description",
            "discount_until",
            "bonus_eligible",
            "delivery_days",
        ]:
            assert field in sample, f"Field {field} missing in product response"

    def test_legacy_products_default_bonus_eligible_true(self, all_products):
        # All products should return bonus_eligible (not None); legacy default = True
        for p in all_products:
            assert p["bonus_eligible"] is not None, f"Product {p['id']} bonus_eligible is None"
            assert isinstance(p["bonus_eligible"], bool)


# ---------------------- PUT /api/products: discount fields ----------------------

class TestProductDiscountPersistence:
    def test_put_and_get_discount_percent(self, admin_headers, all_products):
        # pick a product (avoid E82KPD36 which is fixture for UI)
        target = next(
            (p for p in all_products if p.get("article") != "E82KPD36"),
            all_products[0],
        )
        pid = target["id"]

        # Save original to restore later
        original = {
            "discount_active": target.get("discount_active", False),
            "discount_type": target.get("discount_type"),
            "discount_value": target.get("discount_value", 0),
            "discount_label": target.get("discount_label", ""),
            "discount_description": target.get("discount_description", ""),
            "discount_until": target.get("discount_until"),
            "delivery_days": target.get("delivery_days", 3),
        }

        until_iso = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
        payload = {
            "discount_active": True,
            "discount_type": "percent",
            "discount_value": 15,
            "discount_label": "TEST Промо",
            "discount_description": "TEST описание акции",
            "discount_until": until_iso,
        }
        try:
            r = requests.put(
                f"{BASE_URL}/api/products/{pid}", json=payload, headers=admin_headers, timeout=15
            )
            assert r.status_code == 200, f"PUT failed: {r.status_code} {r.text}"
            updated = r.json()
            assert updated["discount_active"] is True
            assert updated["discount_type"] == "percent"
            assert float(updated["discount_value"]) == 15
            assert updated["discount_label"] == "TEST Промо"
            assert updated["discount_description"] == "TEST описание акции"
            assert updated["discount_until"] is not None
            assert until_iso in str(updated["discount_until"])

            # GET to verify persistence
            g = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15)
            assert g.status_code == 200
            got = g.json()
            assert got["discount_active"] is True
            assert got["discount_type"] == "percent"
            assert float(got["discount_value"]) == 15
            assert got["discount_label"] == "TEST Промо"
            assert got["discount_description"] == "TEST описание акции"
        finally:
            # restore
            requests.put(
                f"{BASE_URL}/api/products/{pid}", json=original, headers=admin_headers, timeout=15
            )

    def test_put_and_get_discount_amount(self, admin_headers, all_products):
        target = next(
            (p for p in all_products if p.get("article") != "E82KPD36"),
            all_products[0],
        )
        pid = target["id"]
        original = {
            "discount_active": target.get("discount_active", False),
            "discount_type": target.get("discount_type"),
            "discount_value": target.get("discount_value", 0),
            "discount_label": target.get("discount_label", ""),
            "discount_description": target.get("discount_description", ""),
            "discount_until": target.get("discount_until"),
        }
        until_iso = (datetime.now(timezone.utc) + timedelta(days=15)).strftime("%Y-%m-%d")
        payload = {
            "discount_active": True,
            "discount_type": "amount",
            "discount_value": 500,
            "discount_label": "TEST Скидка",
            "discount_description": "−500 ₽",
            "discount_until": until_iso,
        }
        try:
            r = requests.put(
                f"{BASE_URL}/api/products/{pid}", json=payload, headers=admin_headers, timeout=15
            )
            assert r.status_code == 200
            g = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15)
            got = g.json()
            assert got["discount_type"] == "amount"
            assert float(got["discount_value"]) == 500
        finally:
            requests.put(
                f"{BASE_URL}/api/products/{pid}", json=original, headers=admin_headers, timeout=15
            )

    def test_e82kpd36_has_active_discount(self, all_products):
        """E82KPD36 is the UI fixture product with active 20% discount."""
        target = next((p for p in all_products if p.get("article") == "E82KPD36"), None)
        assert target is not None, "E82KPD36 fixture product not found"
        assert target["discount_active"] is True
        assert target["discount_type"] == "percent"
        assert float(target["discount_value"]) == 20
        assert target["discount_until"] is not None


# ---------------------- delivery_days = 0 ----------------------

class TestDeliveryDaysZero:
    def test_delivery_days_zero_accepted_and_persisted(self, admin_headers, all_products):
        target = next(
            (p for p in all_products if p.get("article") not in ("E82KPD36", "PL420x")),
            all_products[0],
        )
        pid = target["id"]
        original_days = target.get("delivery_days", 3)
        try:
            r = requests.put(
                f"{BASE_URL}/api/products/{pid}",
                json={"delivery_days": 0},
                headers=admin_headers,
                timeout=15,
            )
            assert r.status_code == 200, f"PUT failed: {r.status_code} {r.text}"
            assert r.json()["delivery_days"] == 0

            g = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15)
            assert g.status_code == 200
            assert g.json()["delivery_days"] == 0
        finally:
            requests.put(
                f"{BASE_URL}/api/products/{pid}",
                json={"delivery_days": int(original_days)},
                headers=admin_headers,
                timeout=15,
            )


# ---------------------- bonus_eligible PUT ----------------------

class TestBonusEligibleToggle:
    def test_set_bonus_eligible_false_and_back(self, admin_headers, all_products):
        target = next(
            (p for p in all_products if p.get("article") not in ("E82KPD36", "PL420x")),
            all_products[0],
        )
        pid = target["id"]
        original = target.get("bonus_eligible", True)
        try:
            r = requests.put(
                f"{BASE_URL}/api/products/{pid}",
                json={"bonus_eligible": False},
                headers=admin_headers,
                timeout=15,
            )
            assert r.status_code == 200
            assert r.json()["bonus_eligible"] is False
            g = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=15)
            assert g.json()["bonus_eligible"] is False
        finally:
            requests.put(
                f"{BASE_URL}/api/products/{pid}",
                json={"bonus_eligible": bool(original)},
                headers=admin_headers,
                timeout=15,
            )
