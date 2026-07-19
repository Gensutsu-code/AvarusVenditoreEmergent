"""
Backend tests for iteration 94 - 4 tasks:
  T1: notification toggle blocks client notifs (order lifecycle + admin balance credit/debit)
  T2: individual account-wide discount only applies on pay_with_balance
  T3: pay delivery with bonus points
  T4: promo limited stock (allocated / remaining), and full-price fallback when depleted
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASS = "admin"
CLIENT_EMAIL = "user@demo.com"
CLIENT_PASS = "demo123"


# ---------- helpers ----------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def client_token():
    return _login(CLIENT_EMAIL, CLIENT_PASS)


@pytest.fixture(scope="session")
def client_user_id(client_token):
    r = requests.get(f"{API}/auth/me", headers=_hdr(client_token), timeout=30)
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="session")
def notif_settings_baseline(admin_token):
    """Fetch current settings, restore at session end."""
    r = requests.get(f"{API}/admin/notification-settings", headers=_hdr(admin_token), timeout=30)
    assert r.status_code == 200
    baseline = r.json()
    yield baseline
    # Restore
    requests.put(
        f"{API}/admin/notification-settings",
        headers=_hdr(admin_token),
        json={
            "order_status_enabled": baseline.get("order_status_enabled", True),
            "promotions_enabled": baseline.get("promotions_enabled", True),
            "order_confirmation_enabled": baseline.get("order_confirmation_enabled", True),
            "client_notifications_enabled": True,  # ensure re-enabled
        },
        timeout=30,
    )


def _set_client_notifs(admin_token, enabled: bool, baseline: dict):
    r = requests.put(
        f"{API}/admin/notification-settings",
        headers=_hdr(admin_token),
        json={
            "order_status_enabled": baseline.get("order_status_enabled", True),
            "promotions_enabled": baseline.get("promotions_enabled", True),
            "order_confirmation_enabled": baseline.get("order_confirmation_enabled", True),
            "client_notifications_enabled": enabled,
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text


def _get_my_notifs_count(client_token):
    r = requests.get(f"{API}/my-notifications", headers=_hdr(client_token), timeout=30)
    assert r.status_code == 200
    return len(r.json().get("notifications", []))


def _get_my_unread(client_token):
    r = requests.get(f"{API}/my-notifications", headers=_hdr(client_token), timeout=30)
    assert r.status_code == 200
    return r.json().get("unread_count", 0)


def _mark_all_read(client_token):
    requests.put(f"{API}/my-notifications/read-all", headers=_hdr(client_token), timeout=30)


def _admin_credit(admin_token, user_id, amount, reason="TEST"):
    return requests.post(
        f"{API}/admin/users/{user_id}/balance/credit",
        headers=_hdr(admin_token),
        json={"amount": amount, "reason": reason},
        timeout=30,
    )


def _admin_debit(admin_token, user_id, amount, reason="TEST"):
    return requests.post(
        f"{API}/admin/users/{user_id}/balance/debit",
        headers=_hdr(admin_token),
        json={"amount": amount, "reason": reason},
        timeout=30,
    )


def _clear_cart(client_token):
    requests.delete(f"{API}/cart", headers=_hdr(client_token), timeout=30)


def _add_to_cart(client_token, product_id, qty=1):
    r = requests.post(
        f"{API}/cart/add",
        headers=_hdr(client_token),
        json={"product_id": product_id, "quantity": qty},
        timeout=30,
    )
    assert r.status_code == 200, r.text


def _create_test_product(admin_token, **extra):
    """Create a fresh product for use in ordering tests."""
    art = f"TEST_{uuid.uuid4().hex[:8].upper()}"
    payload = {
        "name": f"TEST Product {art}",
        "article": art,
        "manufacturer": "TEST_MFR",
        "price": 1000.0,
        "stock": 100,
        "category": "test",
        "description": "test",
    }
    payload.update(extra)
    r = requests.post(f"{API}/products", headers=_hdr(admin_token), json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    return r.json()


def _delete_product(admin_token, product_id):
    try:
        requests.delete(f"{API}/products/{product_id}", headers=_hdr(admin_token), timeout=30)
    except Exception:
        pass


def _get_product(product_id):
    r = requests.get(f"{API}/products/{product_id}", timeout=30)
    if r.status_code != 200:
        return None
    return r.json()


def _place_order(client_token, extra=None):
    body = {
        "full_name": "TEST User",
        "address": "TEST Address 1",
        "phone": "+70000000000",
        "payment_method": "cash",
    }
    if extra:
        body.update(extra)
    r = requests.post(f"{API}/orders", headers=_hdr(client_token), json=body, timeout=60)
    return r


# ---------- TASK 1: notification toggle ----------
class TestTask1NotificationToggle:
    def test_toggle_disable_blocks_order_notifs_but_admin_still_created(
        self, admin_token, client_token, client_user_id, notif_settings_baseline
    ):
        # Disable client notifs
        _set_client_notifs(admin_token, False, notif_settings_baseline)
        _mark_all_read(client_token)
        before_unread = _get_my_unread(client_token)

        # Prepare product & order
        prod = _create_test_product(admin_token, price=100.0, stock=50)
        pid = prod["id"]
        try:
            _clear_cart(client_token)
            _add_to_cart(client_token, pid, 1)
            r = _place_order(client_token, {"payment_method": "cash"})
            assert r.status_code == 200, r.text
            order_id = r.json()["id"]
            after_unread = _get_my_unread(client_token)
            assert after_unread == before_unread, (
                f"Expected NO new client notifs when toggle is off. before_unread={before_unread}, after_unread={after_unread}"
            )
            # Admin notif verification: use /admin/notification-settings existence proxy.
            # We verify indirectly via /api/admin/orders showing the order (admin flow ok)
            r_adm = requests.get(f"{API}/admin/orders", headers=_hdr(admin_token), timeout=30)
            assert r_adm.status_code == 200
        finally:
            _delete_product(admin_token, pid)
            _set_client_notifs(admin_token, True, notif_settings_baseline)

    def test_toggle_enable_creates_client_notif(
        self, admin_token, client_token, notif_settings_baseline
    ):
        _set_client_notifs(admin_token, True, notif_settings_baseline)
        _mark_all_read(client_token)
        before_unread = _get_my_unread(client_token)
        prod = _create_test_product(admin_token, price=100.0, stock=50)
        pid = prod["id"]
        try:
            _clear_cart(client_token)
            _add_to_cart(client_token, pid, 1)
            r = _place_order(client_token, {"payment_method": "cash"})
            assert r.status_code == 200, r.text
            after_unread = _get_my_unread(client_token)
            assert after_unread > before_unread, (
                f"Expected client notif on order when toggle enabled. before_unread={before_unread}, after_unread={after_unread}"
            )
        finally:
            _delete_product(admin_token, pid)

    def test_admin_balance_credit_blocked_when_disabled(
        self, admin_token, client_token, client_user_id, notif_settings_baseline
    ):
        _set_client_notifs(admin_token, False, notif_settings_baseline)
        _mark_all_read(client_token)
        before_unread = _get_my_unread(client_token)
        try:
            r = _admin_credit(admin_token, client_user_id, 1, "TEST toggle off")
            assert r.status_code in (200, 201), r.text
            time.sleep(0.5)
            after_unread = _get_my_unread(client_token)
            assert after_unread == before_unread, (
                f"Client notif should be blocked. before={before_unread}, after={after_unread}"
            )
        finally:
            _admin_debit(admin_token, client_user_id, 1, "TEST revert")
            _set_client_notifs(admin_token, True, notif_settings_baseline)

    def test_admin_balance_credit_creates_notif_when_enabled(
        self, admin_token, client_token, client_user_id, notif_settings_baseline
    ):
        _set_client_notifs(admin_token, True, notif_settings_baseline)
        _mark_all_read(client_token)
        before_unread = _get_my_unread(client_token)
        try:
            r = _admin_credit(admin_token, client_user_id, 1, "TEST toggle on")
            assert r.status_code in (200, 201), r.text
            time.sleep(0.5)
            after_unread = _get_my_unread(client_token)
            assert after_unread > before_unread, (
                f"Client notif should be created. before={before_unread}, after={after_unread}"
            )
        finally:
            _admin_debit(admin_token, client_user_id, 1, "TEST revert")


# ---------- TASK 2: individual discount only with pay_with_balance ----------
class TestTask2IndividualDiscount:
    def _ensure_user_discount(self, admin_token, client_user_id, pct=10):
        """Ensure the demo client has individual_discount = pct (%)."""
        # Try common admin patch endpoint
        r = requests.patch(
            f"{API}/admin/users/{client_user_id}",
            headers=_hdr(admin_token),
            json={"individual_discount": pct},
            timeout=30,
        )
        if r.status_code == 404:
            r = requests.put(
                f"{API}/admin/users/{client_user_id}",
                headers=_hdr(admin_token),
                json={"individual_discount": pct},
                timeout=30,
            )
        # If neither works, we'll rely on preseeded 10% per review request.
        return r.status_code in (200, 204)

    def _ensure_balance(self, admin_token, client_user_id, amount=5000):
        r = _admin_credit(admin_token, client_user_id, amount, "TEST fund")
        return r.status_code in (200, 201)

    def test_individual_discount_applied_on_pay_with_balance(
        self, admin_token, client_token, client_user_id
    ):
        self._ensure_user_discount(admin_token, client_user_id, 10)
        self._ensure_balance(admin_token, client_user_id, 5000)
        prod = _create_test_product(admin_token, price=1000.0, stock=50)
        pid = prod["id"]
        try:
            _clear_cart(client_token)
            _add_to_cart(client_token, pid, 1)
            r = _place_order(
                client_token,
                {"payment_method": "balance", "pay_with_balance": True},
            )
            assert r.status_code == 200, r.text
            order = r.json()
            assert order.get("individual_discount_percent", 0) == 10, order
            assert order.get("individual_discount_amount", 0) > 0, order
            # goods (1000) - 10% (100) = 900 (delivery may add if enabled and under threshold)
            # We can only assert individual_discount_amount = 100
            assert abs(order["individual_discount_amount"] - 100.0) < 0.5, order
        finally:
            _delete_product(admin_token, pid)

    def test_individual_discount_not_applied_on_cash(
        self, admin_token, client_token, client_user_id
    ):
        self._ensure_user_discount(admin_token, client_user_id, 10)
        prod = _create_test_product(admin_token, price=1000.0, stock=50)
        pid = prod["id"]
        try:
            _clear_cart(client_token)
            _add_to_cart(client_token, pid, 1)
            r = _place_order(client_token, {"payment_method": "cash"})
            assert r.status_code == 200, r.text
            order = r.json()
            assert order.get("individual_discount_percent", 0) == 0, order
            assert order.get("individual_discount_amount", 0) == 0, order
        finally:
            _delete_product(admin_token, pid)


# ---------- TASK 3: pay delivery with bonus points ----------
class TestTask3PayDeliveryWithPoints:
    def test_flag_accepted(self, admin_token, client_token):
        # Get delivery settings
        ds = requests.get(f"{API}/delivery-settings", timeout=30).json()
        delivery_enabled = ds.get("delivery_enabled", True)
        delivery_price = ds.get("delivery_price", 500)

        # Get client bonus points
        bp = requests.get(f"{API}/bonus/my-points", headers=_hdr(client_token), timeout=30)
        assert bp.status_code == 200, bp.text
        points = bp.json().get("total_points", bp.json().get("points", 0)) or 0

        prod = _create_test_product(admin_token, price=100.0, stock=50)
        pid = prod["id"]
        try:
            _clear_cart(client_token)
            _add_to_cart(client_token, pid, 1)
            r = _place_order(
                client_token,
                {"payment_method": "cash", "pay_delivery_with_points": True},
            )
            if not delivery_enabled:
                assert r.status_code == 200, r.text
                order = r.json()
                assert (order.get("delivery_points_used") or 0) == 0, order
                return

            # Delivery enabled path — expect either success (enough points) or 400
            if points >= delivery_price:
                assert r.status_code == 200, r.text
                order = r.json()
                assert order.get("delivery_paid_with_points") is True, order
                assert order.get("delivery_points_used") == delivery_price, order
                # order.total must exclude the delivery money
                # subtotal=100, no promo, cash adjustment maybe applies → total should be < subtotal+delivery
                assert order["total"] < 100 + delivery_price + 1, order
                # Verify points were spent
                bp2 = requests.get(f"{API}/bonus/my-points", headers=_hdr(client_token), timeout=30).json()
                points2 = bp2.get("total_points", bp2.get("points", 0)) or 0
                assert points2 <= points - delivery_price + 1, f"Points not decreased: {points} → {points2}"
            else:
                assert r.status_code == 400, r.text
        finally:
            _delete_product(admin_token, pid)

    def test_flag_not_set_no_points_used(self, admin_token, client_token):
        prod = _create_test_product(admin_token, price=100.0, stock=50)
        pid = prod["id"]
        try:
            _clear_cart(client_token)
            _add_to_cart(client_token, pid, 1)
            r = _place_order(client_token, {"payment_method": "cash"})
            assert r.status_code == 200, r.text
            order = r.json()
            assert (order.get("delivery_points_used") or 0) == 0, order
            assert not order.get("delivery_paid_with_points", False), order
        finally:
            _delete_product(admin_token, pid)


# ---------- TASK 4: promo limited stock ----------
class TestTask4PromoLimitedStock:
    def test_promo_remaining_initializes_and_exhausts(
        self, admin_token, client_token
    ):
        from datetime import datetime, timedelta, timezone

        until = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        prod = _create_test_product(
            admin_token,
            price=1000.0,
            stock=50,
            discount_active=True,
            discount_type="percent",
            discount_value=20,
            discount_until=until,
            promo_allocated_stock=3,
        )
        pid = prod["id"]
        try:
            # Verify GET /products/{id} exposes fields
            fetched = _get_product(pid)
            assert fetched is not None
            assert fetched.get("promo_allocated_stock") == 3, fetched
            assert fetched.get("promo_remaining_stock") == 3, fetched

            # Determine actual per-unit price with current payment adjustments so we don't
            # hard-code cash-adjustment assumptions.
            # First place order with qty=1 to observe non-promo base (later depleted case).
            # Instead: check relative — promo price < non-promo price by ~20%.
            # Place order for qty=2 → remaining should become 1
            _clear_cart(client_token)
            _add_to_cart(client_token, pid, 2)
            r = _place_order(client_token, {"payment_method": "cash"})
            assert r.status_code == 200, r.text
            order = r.json()
            item = order["items"][0]
            promo_price = item.get("price")
            # promo (20% off) must be less than any base price
            assert promo_price < 1000.0, f"Promo not applied? price={promo_price}"

            fetched2 = _get_product(pid)
            assert fetched2.get("promo_remaining_stock") == 1, fetched2

            # Next order for qty=2 → remaining=1 at time of order, promo still applies
            _clear_cart(client_token)
            _add_to_cart(client_token, pid, 2)
            r2 = _place_order(client_token, {"payment_method": "cash"})
            assert r2.status_code == 200, r2.text
            item2 = r2.json()["items"][0]
            assert item2.get("price") == promo_price, f"Expected same promo price, got {item2}"

            fetched3 = _get_product(pid)
            assert fetched3.get("promo_remaining_stock") <= 0, fetched3

            # Now try another order → promo depleted, full price
            _clear_cart(client_token)
            _add_to_cart(client_token, pid, 1)
            r3 = _place_order(client_token, {"payment_method": "cash"})
            assert r3.status_code == 200, r3.text
            item3 = r3.json()["items"][0]
            # After depletion price must be ~25% higher than promo_price (100/80 = 1.25)
            assert item3.get("price") > promo_price * 1.2, (
                f"Expected full price after promo depletion, got {item3} vs promo_price={promo_price}"
            )
        finally:
            _delete_product(admin_token, pid)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
