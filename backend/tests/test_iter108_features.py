"""Iteration 108 features:
- Guest AI assistant + per-IP guest quota
- Handoff of AI dialog to manager
- Bulk AI descriptions (admin background job)
- Server cart preview (POST /api/cart/preview) must equal created order total
- Storefront promo banner (GET /api/promotions/active)
- Category discount (POST /api/admin/products/category-discount)
"""
import os
import uuid
import time
import json
import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime, timezone

load_dotenv("/app/backend/.env")
BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    BASE = "https://order-merge-fulfill.preview.emergentagent.com"
API = f"{BASE}/api"

MONGO_URL = os.environ["MONGO_URL"].strip('"')
DB_NAME = os.environ["DB_NAME"].strip('"')
mongo = MongoClient(MONGO_URL)
dbm = mongo[DB_NAME]


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_tok():
    return _login("admin@avarus.ru", os.environ["TEST_ADMIN_PASSWORD"])


@pytest.fixture(scope="session")
def user_tok():
    return _login("user@demo.com", os.environ["TEST_CLIENT_PASSWORD"])


@pytest.fixture(scope="session")
def admin_h(admin_tok):
    return {"Authorization": f"Bearer {admin_tok}"}


@pytest.fixture(scope="session")
def user_h(user_tok):
    return {"Authorization": f"Bearer {user_tok}"}


# ========= 1. GUEST ASSISTANT =========

def test_guest_assistant_history_no_auth():
    sid = "test" + uuid.uuid4().hex[:12]
    r = requests.get(f"{API}/ai/assistant/history", params={"session_id": sid}, timeout=15)
    assert r.status_code == 200
    assert r.json() == {"messages": []}


def test_guest_assistant_garbage_token_treated_as_guest():
    sid = "test" + uuid.uuid4().hex[:12]
    r = requests.get(f"{API}/ai/assistant/history",
                     params={"session_id": sid},
                     headers={"Authorization": "Bearer garbage.token.value"},
                     timeout=15)
    assert r.status_code == 200
    assert r.json() == {"messages": []}


def test_guest_limit_429_without_llm_calls():
    """Insert 5 ai_usage docs for a synthetic IP, then call directly and expect 429."""
    ip = f"203.0.113.{int(time.time()) % 250}"
    uid = f"guest-ip:{ip}"
    marker = f"TEST_IT108_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        dbm.ai_usage.insert_many([
            {"user_id": uid, "guest": True, "kind": "assistant",
             "created_at": now_iso, "marker": marker}
            for _ in range(5)
        ])
        # Try external first (ingress may or may not overwrite XFF)
        sid = "test" + uuid.uuid4().hex[:12]
        r = requests.post(f"{API}/ai/assistant/chat",
                          json={"session_id": sid, "message": "тест"},
                          headers={"X-Forwarded-For": ip},
                          timeout=30)
        if r.status_code != 429:
            # Fallback: hit backend directly
            try:
                r = requests.post("http://localhost:8001/api/ai/assistant/chat",
                                  json={"session_id": sid, "message": "тест"},
                                  headers={"X-Forwarded-For": ip},
                                  timeout=30)
            except Exception as e:
                pytest.skip(f"internal backend unreachable: {e}")
        assert r.status_code == 429, f"expected 429, got {r.status_code} {r.text[:200]}"
        assert "Лимит" in r.text or "лимит" in r.text or "входа" in r.text
    finally:
        dbm.ai_usage.delete_many({"marker": marker})


# ========= 2. HANDOFF TO MANAGER =========

def test_handoff_requires_messages(user_h):
    r = requests.post(f"{API}/ai/assistant/handoff",
                      json={"session_id": "test" + uuid.uuid4().hex[:12]},
                      headers=user_h, timeout=15)
    assert r.status_code == 400
    assert "сообщений" in r.text.lower() or "диалог" in r.text.lower()


def test_handoff_requires_auth():
    r = requests.post(f"{API}/ai/assistant/handoff",
                      json={"session_id": "test" + uuid.uuid4().hex[:12]}, timeout=15)
    assert r.status_code in (401, 403)


def test_handoff_full_flow_and_duplicate(user_tok, user_h, admin_h):
    """Seed 2 ai_chat_messages and perform handoff; verify chat message created; duplicate -> 400."""
    import jwt
    uid = jwt.decode(user_tok, options={"verify_signature": False})["user_id"]
    sid = "test" + uuid.uuid4().hex[:12]
    now_iso = datetime.now(timezone.utc).isoformat()
    m1 = {"id": str(uuid.uuid4()), "session_id": sid, "user_id": uid,
          "role": "user", "text": "TEST_IT108 вопрос про фильтр", "products": [], "created_at": now_iso}
    m2 = {"id": str(uuid.uuid4()), "session_id": sid, "user_id": uid,
          "role": "assistant", "text": "TEST_IT108 ответ помощника", "products": [], "created_at": now_iso}
    dbm.ai_chat_messages.insert_many([m1, m2])
    created_chat_message_ids = []
    created_chat_id = None
    try:
        r = requests.post(f"{API}/ai/assistant/handoff",
                          json={"session_id": sid}, headers=user_h, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        chat_id = data["chat_id"]
        msg_id = data["message_id"]
        created_chat_id = chat_id
        created_chat_message_ids.append(msg_id)

        # Verify message in chat_messages contains transcript
        chat_msg = dbm.chat_messages.find_one({"id": msg_id}, {"_id": 0})
        assert chat_msg is not None
        assert "Передаю диалог" in chat_msg["text"]
        assert "TEST_IT108" in chat_msg["text"]

        # Duplicate handoff should 400
        r2 = requests.post(f"{API}/ai/assistant/handoff",
                           json={"session_id": sid}, headers=user_h, timeout=20)
        assert r2.status_code == 400
        assert "уже передан" in r2.text
    finally:
        dbm.ai_chat_messages.delete_many({"session_id": sid})
        for m in created_chat_message_ids:
            dbm.chat_messages.delete_one({"id": m})


# ========= 3. BULK AI DESCRIPTIONS =========

def test_bulk_descriptions_status_shape(admin_h):
    r = requests.get(f"{API}/admin/ai/bulk-descriptions", headers=admin_h, timeout=15)
    assert r.status_code == 200
    d = r.json()
    for key in ("status", "total", "done", "failed", "without_description"):
        assert key in d


def test_bulk_descriptions_non_admin_forbidden(user_h):
    r = requests.get(f"{API}/admin/ai/bulk-descriptions", headers=user_h, timeout=15)
    assert r.status_code == 403
    r = requests.post(f"{API}/admin/ai/bulk-descriptions/start", headers=user_h, timeout=15)
    assert r.status_code == 403


def test_bulk_descriptions_400_when_none(admin_h):
    """If there are 0 without description, start -> 400."""
    status = requests.get(f"{API}/admin/ai/bulk-descriptions", headers=admin_h, timeout=15).json()
    if status.get("without_description", 0) == 0 and status.get("status") != "running":
        r = requests.post(f"{API}/admin/ai/bulk-descriptions/start", headers=admin_h, timeout=15)
        assert r.status_code == 400
    else:
        pytest.skip("Products without description exist or job is running; skipping empty-start test.")


# ========= 4. SERVER CART PREVIEW vs ORDER TOTAL =========

def _reset_cart(h):
    requests.delete(f"{API}/cart", headers=h, timeout=15)


def _add_item(h, product_id, qty=1):
    r = requests.post(f"{API}/cart/add",
                      json={"product_id": product_id, "quantity": qty},
                      headers=h, timeout=15)
    assert r.status_code == 200, r.text


def _get_any_product(min_price=500, max_price=20000):
    """Pick a product with stock > 0 that's within price range."""
    prods = list(dbm.products.find(
        {"stock": {"$gt": 1}, "price": {"$gte": min_price, "$lte": max_price}},
        {"_id": 0, "id": 1, "price": 1, "stock": 1}
    ).limit(5))
    assert prods, "No in-stock products found for preview test"
    return prods[0]


@pytest.mark.parametrize("payment_method,pay_with_balance", [
    ("cash", False),
    ("card", False),
])
def test_preview_equals_order_total(user_h, user_tok, payment_method, pay_with_balance):
    import jwt
    uid = jwt.decode(user_tok, options={"verify_signature": False})["user_id"]

    # Ensure user has enough balance just in case
    if pay_with_balance:
        dbm.users.update_one({"id": uid}, {"$set": {"balance": 1_000_000}})

    _reset_cart(user_h)
    product = _get_any_product()
    _add_item(user_h, product["id"], 1)

    body = {"payment_method": payment_method, "pay_with_balance": pay_with_balance}
    preview = requests.post(f"{API}/cart/preview", json=body, headers=user_h, timeout=20)
    assert preview.status_code == 200, preview.text
    pv = preview.json()
    preview_total = pv["total"]

    # Create order with the same choice
    order_payload = {
        "full_name": "TEST Иван",
        "address": "TEST Адрес 1",
        "phone": "+79990000000",
        "comment": "TEST_IT108",
        "payment_method": payment_method,
        "pay_with_balance": pay_with_balance,
    }
    r = requests.post(f"{API}/orders", json=order_payload, headers=user_h, timeout=30)
    assert r.status_code == 200, r.text
    order = r.json()
    order_id = order["id"]
    try:
        assert abs(order["total"] - preview_total) < 0.01, \
            f"preview {preview_total} != order {order['total']}"
    finally:
        # Cancel order to restore stock
        requests.post(f"{API}/orders/{order_id}/cancel", headers=user_h, timeout=20)
        _reset_cart(user_h)


def test_preview_empty_cart_400(user_h):
    _reset_cart(user_h)
    r = requests.post(f"{API}/cart/preview", json={"payment_method": "cash"},
                      headers=user_h, timeout=15)
    assert r.status_code == 400


def test_preview_invalid_promo_400(user_h):
    _reset_cart(user_h)
    product = _get_any_product()
    _add_item(user_h, product["id"], 1)
    try:
        r = requests.post(f"{API}/cart/preview",
                          json={"payment_method": "cash",
                                "promo_code": f"TEST_IT108_NOPE_{uuid.uuid4().hex[:6]}"},
                          headers=user_h, timeout=15)
        assert r.status_code == 400
    finally:
        _reset_cart(user_h)


# ========= 5. STOREFRONT PROMO BANNER =========

def test_active_promotions_public_and_filtered():
    """Create a storefront code and a hidden code, verify public shows only storefront one with no internal fields leaked."""
    code_show = f"TESTIT108_{uuid.uuid4().hex[:6].upper()}"
    code_hide = f"TESTIT108_H_{uuid.uuid4().hex[:6].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()
    dbm.promo_codes.insert_many([
        {"id": str(uuid.uuid4()), "code": code_show, "type": "percent", "value": 10,
         "min_order": 0, "max_uses": 0, "per_user_limit": 0, "active": True,
         "valid_until": None, "description": "TEST_IT108 shown",
         "show_on_storefront": True, "used_count": 0, "created_at": now_iso},
        {"id": str(uuid.uuid4()), "code": code_hide, "type": "percent", "value": 5,
         "min_order": 0, "max_uses": 0, "per_user_limit": 0, "active": True,
         "valid_until": None, "description": "TEST_IT108 hidden",
         "show_on_storefront": False, "used_count": 0, "created_at": now_iso},
    ])
    try:
        r = requests.get(f"{API}/promotions/active", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "promo_codes" in data and "discounted_products" in data
        codes = {c["code"]: c for c in data["promo_codes"]}
        assert code_show in codes, f"storefront code missing; got {list(codes.keys())}"
        assert code_hide not in codes
        c = codes[code_show]
        # No internal fields leaked
        for leaked in ("id", "description", "used_count", "max_uses", "active", "show_on_storefront"):
            assert leaked not in c, f"internal field leaked: {leaked}"
        assert c["type"] == "percent"
        assert c["value"] == 10
    finally:
        dbm.promo_codes.delete_many({"code": {"$in": [code_show, code_hide]}})


# ========= 6. CATEGORY DISCOUNT =========

def test_category_discount_apply_clear_and_validation(admin_h):
    # Create test category + subcategory + products
    cat = {"id": str(uuid.uuid4()), "name": "TEST_IT108_cat", "parent_id": None,
           "display_order": 9999}
    sub = {"id": str(uuid.uuid4()), "name": "TEST_IT108_sub", "parent_id": cat["id"],
           "display_order": 9999}
    dbm.categories.insert_one(cat)
    dbm.categories.insert_one(sub)
    now = datetime.now(timezone.utc).isoformat()
    p1 = {"id": str(uuid.uuid4()), "name": "TEST_IT108_p1", "article": f"TP1{uuid.uuid4().hex[:6]}",
          "price": 1000, "stock": 10, "category_id": cat["id"], "created_at": now}
    p2 = {"id": str(uuid.uuid4()), "name": "TEST_IT108_p2", "article": f"TP2{uuid.uuid4().hex[:6]}",
          "price": 2000, "stock": 10, "category_id": sub["id"], "created_at": now}
    p_other = {"id": str(uuid.uuid4()), "name": "TEST_IT108_other", "article": f"TPO{uuid.uuid4().hex[:6]}",
               "price": 500, "stock": 10, "category_id": None, "created_at": now}
    dbm.products.insert_many([p1, p2, p_other])
    try:
        # 404 on unknown category
        r = requests.post(f"{API}/admin/products/category-discount",
                          json={"category_id": "no-such-id", "action": "apply",
                                "discount_type": "percent", "discount_value": 10,
                                "discount_until": "2099-12-31"},
                          headers=admin_h, timeout=15)
        assert r.status_code == 404

        # 400: percent > 90
        r = requests.post(f"{API}/admin/products/category-discount",
                          json={"category_id": cat["id"], "action": "apply",
                                "discount_type": "percent", "discount_value": 95,
                                "discount_until": "2099-12-31"},
                          headers=admin_h, timeout=15)
        assert r.status_code == 400

        # 400: missing date
        r = requests.post(f"{API}/admin/products/category-discount",
                          json={"category_id": cat["id"], "action": "apply",
                                "discount_type": "percent", "discount_value": 10},
                          headers=admin_h, timeout=15)
        assert r.status_code == 400

        # 400: past date
        r = requests.post(f"{API}/admin/products/category-discount",
                          json={"category_id": cat["id"], "action": "apply",
                                "discount_type": "percent", "discount_value": 10,
                                "discount_until": "2000-01-01"},
                          headers=admin_h, timeout=15)
        assert r.status_code == 400

        # Apply happy path — should cover p1 (cat) and p2 (sub), NOT p_other
        r = requests.post(f"{API}/admin/products/category-discount",
                          json={"category_id": cat["id"], "action": "apply",
                                "discount_type": "percent", "discount_value": 15,
                                "discount_until": "2099-12-31",
                                "discount_label": "TEST акция"},
                          headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["matched_count"] >= 2

        got1 = dbm.products.find_one({"id": p1["id"]}, {"_id": 0})
        got2 = dbm.products.find_one({"id": p2["id"]}, {"_id": 0})
        gotO = dbm.products.find_one({"id": p_other["id"]}, {"_id": 0})
        assert got1["discount_active"] and got1["discount_value"] == 15
        assert got2["discount_active"] and got2["discount_value"] == 15
        assert not gotO.get("discount_active")

        # Clear — p1/p2 cleared; discount_tiers untouched
        dbm.products.update_one({"id": p1["id"]}, {"$set": {"discount_tiers": [{"min_qty": 5, "type": "percent", "value": 8}]}})
        r = requests.post(f"{API}/admin/products/category-discount",
                          json={"category_id": cat["id"], "action": "clear"},
                          headers=admin_h, timeout=15)
        assert r.status_code == 200
        got1 = dbm.products.find_one({"id": p1["id"]}, {"_id": 0})
        assert not got1.get("discount_active")
        assert got1.get("discount_tiers") == [{"min_qty": 5, "type": "percent", "value": 8}], \
            "discount_tiers should be preserved on clear"
    finally:
        dbm.products.delete_many({"id": {"$in": [p1["id"], p2["id"], p_other["id"]]}})
        dbm.categories.delete_many({"id": {"$in": [cat["id"], sub["id"]]}})


def test_category_discount_non_admin_forbidden(user_h):
    r = requests.post(f"{API}/admin/products/category-discount",
                      json={"category_id": "x", "action": "apply",
                            "discount_type": "percent", "discount_value": 10,
                            "discount_until": "2099-12-31"},
                      headers=user_h, timeout=15)
    assert r.status_code == 403


def test_zzz_cleanup():
    """Final sweep of any stray TEST_IT108 artifacts."""
    dbm.ai_usage.delete_many({"marker": {"$regex": "^TEST_IT108"}})
    dbm.promo_codes.delete_many({"code": {"$regex": "^TESTIT108"}})
    dbm.products.delete_many({"name": {"$regex": "^TEST_IT108"}})
    dbm.categories.delete_many({"name": {"$regex": "^TEST_IT108"}})
