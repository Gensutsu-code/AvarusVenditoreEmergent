import os
import uuid
from pathlib import Path

import pytest
import requests

from dotenv import load_dotenv

# Test account passwords live in tests/.env.test (not committed), see /app/memory/test_credentials.md
load_dotenv(Path(__file__).parent / ".env.test")
load_dotenv(Path(__file__).parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).parents[1] / ".env")
os.environ["TEST_ADMIN_PASSWORD"] = os.environ["ADMIN_PASSWORD"]


def _api():
    return os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture(scope="session")
def _admin_headers():
    r = requests.post(f"{_api()}/auth/login", json={"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}, timeout=20)
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def warehouse_id(_admin_headers):
    """First warehouse of the shop: stock movements are always booked on a warehouse."""
    return requests.get(f"{_api()}/admin/warehouses", headers=_admin_headers, timeout=20).json()[0]["id"]


@pytest.fixture
def temp_products(_admin_headers):
    """Two throwaway products with zero stock, so stock tests never touch real goods."""
    ids = []
    for i in range(2):
        r = requests.post(f"{_api()}/products", headers=_admin_headers, timeout=20,
                          json={"name": f"TEST_STOCK_{i}", "article": f"TEST-STOCK-{uuid.uuid4().hex[:8]}", "price": 1000, "stock": 0})
        assert r.status_code in (200, 201), r.text
        ids.append(r.json()["id"])
    yield ids
    for pid in ids:
        requests.delete(f"{_api()}/products/{pid}", headers=_admin_headers, timeout=20)
