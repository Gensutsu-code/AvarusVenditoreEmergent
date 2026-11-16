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


def _demo_manager_token() -> str:
    """The owner keeps the password of manager@avarus.ru to himself, so tests that need this account sign a token instead of logging in."""
    import time
    import jwt
    from pymongo import MongoClient
    manager = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]].users.find_one({"email": "manager@avarus.ru"}, {"id": 1})
    return jwt.encode({"user_id": manager["id"], "exp": time.time() + 3600}, os.environ["JWT_SECRET"], algorithm="HS256")


os.environ["TEST_DEMO_MANAGER_TOKEN"] = _demo_manager_token()


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


TOP_UP = 60


@pytest.fixture(scope="session", autouse=True)
def stock_for_orders(_admin_headers, warehouse_id):
    """Goods are sold only from stock, so order tests need something to sell: every product gets a temporary
    receipt that is written off again after the run (both visible in stock movements)."""
    api = _api()
    low = [p["id"] for p in requests.get(f"{api}/products", timeout=30).json() if (p.get("stock") or 0) < TOP_UP]
    body = {"warehouse_id": warehouse_id, "quantity": TOP_UP, "comment": "Автотесты: временный запас"}
    if low:
        requests.post(f"{api}/admin/warehouse/movements/bulk", headers=_admin_headers, json={**body, "product_ids": low, "type": "receipt"}, timeout=120)
    yield
    rows = {i["id"]: i for i in requests.get(f"{api}/admin/warehouse/stock", headers=_admin_headers, timeout=60).json()["items"]} if low else {}
    for pid in low:
        here = next((w["quantity"] for w in rows.get(pid, {}).get("warehouses", []) if w["warehouse_id"] == warehouse_id), 0)
        if here > 0:  # tests may have sold a part of the top-up
            requests.post(f"{api}/admin/warehouse/movement", headers=_admin_headers, timeout=30,
                          json={"product_id": pid, "warehouse_id": warehouse_id, "type": "writeoff", "quantity": min(TOP_UP, here), "comment": "Автотесты: временный запас"})
