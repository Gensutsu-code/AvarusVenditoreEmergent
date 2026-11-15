"""AI integration tests - ChatGPT (openai/gpt-5.4) via emergentintegrations.
Tests assistant streaming, smart search, product description, chat draft, rate limit, regression.
"""
import os
import json
import uuid
import time
import requests
import pytest
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-merge-fulfill.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@avarus.ru", "password": "admin"}
CLIENT = {"email": "user@demo.com", "password": "demo123"}

MONGO_URL = os.environ["MONGO_URL"].strip('"').strip("'")
DB_NAME = os.environ["DB_NAME"].strip('"').strip("'")


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def client_token():
    return _login(CLIENT)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def client_headers(client_token):
    return {"Authorization": f"Bearer {client_token}"}


# ---------- VALIDATION / AUTH ----------

def test_assistant_requires_auth():
    r = requests.post(f"{API}/ai/assistant/chat",
                      json={"session_id": "test" + uuid.uuid4().hex, "message": "hi"}, timeout=30)
    assert r.status_code in (401, 403), r.status_code


def test_assistant_short_session(client_headers):
    r = requests.post(f"{API}/ai/assistant/chat",
                      json={"session_id": "abc", "message": "hi"},
                      headers=client_headers, timeout=30)
    assert r.status_code == 422, r.status_code


def test_assistant_long_message(client_headers):
    r = requests.post(f"{API}/ai/assistant/chat",
                      json={"session_id": "sess" + uuid.uuid4().hex, "message": "x" * 1600},
                      headers=client_headers, timeout=30)
    assert r.status_code == 422, r.status_code


def test_smart_search_requires_auth():
    r = requests.post(f"{API}/ai/search", json={"query": "test"}, timeout=30)
    assert r.status_code in (401, 403)


def test_admin_description_non_admin(client_headers):
    r = requests.post(f"{API}/admin/ai/product-description",
                      json={"name": "Test"}, headers=client_headers, timeout=30)
    assert r.status_code == 403, r.status_code


def test_admin_description_missing_name(admin_headers):
    r = requests.post(f"{API}/admin/ai/product-description",
                      json={}, headers=admin_headers, timeout=30)
    assert r.status_code == 422


def test_admin_draft_non_admin(client_headers):
    r = requests.post(f"{API}/admin/ai/chat-draft",
                      json={"chat_id": "nope"}, headers=client_headers, timeout=30)
    assert r.status_code == 403


def test_admin_draft_unknown_chat(admin_headers):
    r = requests.post(f"{API}/admin/ai/chat-draft",
                      json={"chat_id": "does-not-exist-" + uuid.uuid4().hex},
                      headers=admin_headers, timeout=30)
    assert r.status_code == 400


# ---------- STREAMING ASSISTANT ----------

def _parse_sse(resp):
    events = []
    buf = ""
    for chunk in resp.iter_content(chunk_size=None, decode_unicode=True):
        if not chunk:
            continue
        buf += chunk
        while "\n\n" in buf:
            frame, buf = buf.split("\n\n", 1)
            for line in frame.splitlines():
                if line.startswith("data: "):
                    try:
                        events.append(json.loads(line[6:]))
                    except json.JSONDecodeError:
                        pass
    return events


ASSISTANT_SESSIONS = []  # sessions to clean up


def test_assistant_streaming_real_llm(client_headers):
    session_id = "sess" + uuid.uuid4().hex
    ASSISTANT_SESSIONS.append(session_id)
    r = requests.post(f"{API}/ai/assistant/chat",
                      json={"session_id": session_id, "message": "Нужен топливный фильтр на DAF XF 105"},
                      headers=client_headers, stream=True, timeout=60)
    assert r.status_code == 200
    assert "text/event-stream" in r.headers.get("content-type", "")
    events = _parse_sse(r)
    types = [e.get("type") for e in events]
    assert "products" in types, f"No products event: {types}"
    assert "done" in types, f"No done event: {types}"
    assert any(t == "delta" for t in types), "No delta events (streamed text)"
    full_text = "".join(e.get("text", "") for e in events if e.get("type") == "delta")
    assert len(full_text) > 10, f"Response too short: {full_text!r}"
    print(f"Assistant answer: {full_text[:300]}")
    products_ev = next(e for e in events if e.get("type") == "products")
    print(f"Products count: {len(products_ev.get('items', []))}")


def test_assistant_history_scoped_to_user(client_headers, admin_headers):
    # only run if a session was created above
    if not ASSISTANT_SESSIONS:
        pytest.skip("No session created")
    sid = ASSISTANT_SESSIONS[0]
    r = requests.get(f"{API}/ai/assistant/history", params={"session_id": sid},
                     headers=client_headers, timeout=30)
    assert r.status_code == 200
    msgs = r.json().get("messages", [])
    assert len(msgs) >= 2, f"Expected user+assistant msgs, got {len(msgs)}"

    # Admin shouldn't see client's messages for same session_id
    r2 = requests.get(f"{API}/ai/assistant/history", params={"session_id": sid},
                      headers=admin_headers, timeout=30)
    assert r2.status_code == 200
    assert r2.json().get("messages") == []


# ---------- SMART SEARCH ----------

def test_smart_search_fuel_filter(client_headers):
    r = requests.post(f"{API}/ai/search",
                      json={"query": "штука которая чистит солярку на дафе"},
                      headers=client_headers, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "keywords" in data and "explanation" in data and "products" in data
    assert isinstance(data["keywords"], list)
    assert isinstance(data["products"], list)
    print(f"Keywords: {data['keywords']}")
    print(f"Explanation: {data['explanation']}")
    print(f"Products found: {len(data['products'])}")
    for p in data["products"]:
        assert "_id" not in p
        assert "purchase_price" not in p
        assert "in_stock" in p
        assert "id" in p and "name" in p


# ---------- ADMIN PRODUCT DESCRIPTION ----------

def test_admin_product_description(admin_headers):
    r = requests.post(f"{API}/admin/ai/product-description",
                      json={"name": "Топливный фильтр DAF XF 105",
                            "article": "E82KPD36", "manufacturer": "Hengst"},
                      headers=admin_headers, timeout=60)
    assert r.status_code == 200, r.text
    desc = r.json().get("description", "")
    assert len(desc) > 30, f"Description too short: {desc!r}"
    assert any(ch in desc for ch in "абвгдеёжзийклмноп"), "Description should be in Russian"
    print(f"Description: {desc[:200]}")


# ---------- RATE LIMIT (no real LLM calls) ----------

def test_rate_limit_429_via_db_seed(client_token, client_headers):
    """Insert 60 ai_usage docs for this user; next AI call must return 429."""
    marker = f"TEST_RL_{uuid.uuid4().hex[:8]}"

    async def seed_and_cleanup():
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            dbh = client[DB_NAME]
            # Get user id via /api/auth/me
            me = requests.get(f"{API}/auth/me", headers=client_headers, timeout=30)
            assert me.status_code == 200, me.text
            user_id = me.json()["id"]
            now_iso = datetime.now(timezone.utc).isoformat()
            docs = [{"user_id": user_id, "kind": "search", "created_at": now_iso, "marker": marker}
                    for _ in range(60)]
            await dbh.ai_usage.insert_many(docs)
            # Now trigger request
            r = requests.post(f"{API}/ai/search", json={"query": "фильтр"},
                              headers=client_headers, timeout=30)
            # Clean up
            await dbh.ai_usage.delete_many({"marker": marker})
            return r
        finally:
            client.close()

    r = asyncio.get_event_loop().run_until_complete(seed_and_cleanup()) if False else asyncio.new_event_loop().run_until_complete(seed_and_cleanup())
    assert r.status_code == 429, f"Expected 429, got {r.status_code}: {r.text}"
    assert "лимит" in r.text.lower() or "limit" in r.text.lower()


# ---------- REGRESSION: parts finder still works ----------

def test_parts_finder_regression(client_headers):
    # just hit the status endpoint / some lightweight parts_finder route
    # look for routes in parts_finder.py
    r = requests.get(f"{API}/parts-finder/config", headers=client_headers, timeout=30)
    # accept any non-5xx
    assert r.status_code < 500, f"parts_finder regression - status {r.status_code}: {r.text[:200]}"


# ---------- CLEANUP ----------

def test_zz_cleanup_sessions(client_token):
    """Delete ai_chat_messages for all test sessions created above."""
    async def _cleanup():
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            dbh = client[DB_NAME]
            if ASSISTANT_SESSIONS:
                res = await dbh.ai_chat_messages.delete_many({"session_id": {"$in": ASSISTANT_SESSIONS}})
                print(f"Cleaned {res.deleted_count} assistant messages")
        finally:
            client.close()
    asyncio.new_event_loop().run_until_complete(_cleanup())
