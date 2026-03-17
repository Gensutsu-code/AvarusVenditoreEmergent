"""
Iteration 47 Tests: Bonus Points Management, Order Rollback, Enhanced Tracking, Prize Redemption Delete

Features tested:
- POST /api/admin/bonus/programs/{program_id}/users/{user_id}/add-points
- POST /api/admin/bonus/programs/{program_id}/users/{user_id}/remove-points
- POST /api/admin/bonus/programs/{program_id}/users/{user_id}/reset-points
- DELETE /api/admin/bonus/prize-redemptions/{redemption_id}
- DELETE /api/bonus/my-redemptions/{redemption_id}
- PUT /api/admin/orders/{order_id}/rollback-status
- POST /api/track (with browser fingerprint)
- GET /api/admin/users/{user_id}/analytics (with sessions data)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://absolute-powers.preview.emergentagent.com')

# Test data from requirements
BONUS_PROGRAM_ID = "cd173bac-1752-405a-b0fd-d2c75a529af6"
DEMO_USER_ID = "65fab4bf-5637-49c0-96a5-4f9f54ca2828"
MAXIM_USER_ID = "1ebf8fc9-b65f-43a6-9cac-45f3f4c5955b"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@avarus.ru",
        "password": "admin"
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    """Get client authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "user@demo.com",
        "password": "demo123"
    })
    assert response.status_code == 200, f"Client login failed: {response.text}"
    return response.json()["token"]


# ========================== BONUS POINTS MANAGEMENT TESTS ==========================

class TestBonusAddPoints:
    """Test POST /api/admin/bonus/programs/{program_id}/users/{user_id}/add-points"""

    def test_add_points_success(self, admin_token):
        """Admin should be able to add bonus points to a user"""
        url = f"{BASE_URL}/api/admin/bonus/programs/{BONUS_PROGRAM_ID}/users/{DEMO_USER_ID}/add-points"
        response = requests.post(url, json={
            "amount": 100,
            "reason": "Test bonus from pytest"
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "old_amount" in data
        assert "new_amount" in data
        assert data["new_amount"] == data["old_amount"] + 100

    def test_add_points_requires_admin(self, client_token):
        """Non-admin should not be able to add points"""
        url = f"{BASE_URL}/api/admin/bonus/programs/{BONUS_PROGRAM_ID}/users/{DEMO_USER_ID}/add-points"
        response = requests.post(url, json={
            "amount": 100,
            "reason": "Test"
        }, headers={"Authorization": f"Bearer {client_token}"})
        
        assert response.status_code == 403

    def test_add_points_negative_amount_rejected(self, admin_token):
        """Negative amount should be rejected"""
        url = f"{BASE_URL}/api/admin/bonus/programs/{BONUS_PROGRAM_ID}/users/{DEMO_USER_ID}/add-points"
        response = requests.post(url, json={
            "amount": -50,
            "reason": "Negative test"
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert response.status_code == 400


class TestBonusRemovePoints:
    """Test POST /api/admin/bonus/programs/{program_id}/users/{user_id}/remove-points"""

    def test_remove_points_success(self, admin_token):
        """Admin should be able to remove bonus points from a user"""
        # First add some points to ensure there are points to remove
        add_url = f"{BASE_URL}/api/admin/bonus/programs/{BONUS_PROGRAM_ID}/users/{DEMO_USER_ID}/add-points"
        requests.post(add_url, json={"amount": 200, "reason": "Setup for remove test"}, 
                      headers={"Authorization": f"Bearer {admin_token}"})
        
        url = f"{BASE_URL}/api/admin/bonus/programs/{BONUS_PROGRAM_ID}/users/{DEMO_USER_ID}/remove-points"
        response = requests.post(url, json={
            "amount": 50,
            "reason": "Test deduction from pytest"
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["new_amount"] == data["old_amount"] - 50

    def test_remove_points_requires_admin(self, client_token):
        """Non-admin should not be able to remove points"""
        url = f"{BASE_URL}/api/admin/bonus/programs/{BONUS_PROGRAM_ID}/users/{DEMO_USER_ID}/remove-points"
        response = requests.post(url, json={
            "amount": 50,
            "reason": "Test"
        }, headers={"Authorization": f"Bearer {client_token}"})
        
        assert response.status_code == 403


class TestBonusResetPoints:
    """Test POST /api/admin/bonus/programs/{program_id}/users/{user_id}/reset-points"""

    def test_reset_points_success(self, admin_token):
        """Admin should be able to reset bonus points to zero"""
        # First add some points
        add_url = f"{BASE_URL}/api/admin/bonus/programs/{BONUS_PROGRAM_ID}/users/{DEMO_USER_ID}/add-points"
        requests.post(add_url, json={"amount": 500, "reason": "Setup for reset test"}, 
                      headers={"Authorization": f"Bearer {admin_token}"})
        
        url = f"{BASE_URL}/api/admin/bonus/programs/{BONUS_PROGRAM_ID}/users/{DEMO_USER_ID}/reset-points"
        response = requests.post(url, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["new_amount"] == 0

    def test_reset_points_requires_admin(self, client_token):
        """Non-admin should not be able to reset points"""
        url = f"{BASE_URL}/api/admin/bonus/programs/{BONUS_PROGRAM_ID}/users/{DEMO_USER_ID}/reset-points"
        response = requests.post(url, headers={"Authorization": f"Bearer {client_token}"})
        
        assert response.status_code == 403


# ========================== PRIZE REDEMPTION DELETE TESTS ==========================

class TestPrizeRedemptionDelete:
    """Test DELETE /api/admin/bonus/prize-redemptions/{redemption_id}"""

    def test_admin_delete_prize_redemption_requires_admin(self, client_token):
        """Non-admin should not be able to delete prize redemptions"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/bonus/prize-redemptions/test-id",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 403

    def test_admin_delete_nonexistent_redemption(self, admin_token):
        """Deleting non-existent redemption should return 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/admin/bonus/prize-redemptions/{fake_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404


class TestClientDeleteRedemption:
    """Test DELETE /api/bonus/my-redemptions/{redemption_id}"""

    def test_client_delete_nonexistent_redemption(self, client_token):
        """Deleting non-existent redemption should return 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/bonus/my-redemptions/{fake_id}",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 404


# ========================== ORDER ROLLBACK TESTS ==========================

class TestOrderRollback:
    """Test PUT /api/admin/orders/{order_id}/rollback-status"""

    def test_rollback_requires_admin(self, client_token):
        """Non-admin should not be able to rollback order status"""
        # Use any order ID - it should fail with 403 before checking the order
        response = requests.put(
            f"{BASE_URL}/api/admin/orders/test-order-id/rollback-status",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 403

    def test_rollback_nonexistent_order(self, admin_token):
        """Rollback on non-existent order should return 404"""
        fake_id = str(uuid.uuid4())
        response = requests.put(
            f"{BASE_URL}/api/admin/orders/{fake_id}/rollback-status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404

    def test_rollback_workflow(self, admin_token):
        """Test full rollback workflow: get order, change status, rollback"""
        # Get orders
        orders_res = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert orders_res.status_code == 200
        orders = orders_res.json()
        
        if not orders:
            pytest.skip("No orders available for rollback test")
        
        order_id = orders[0]["id"]
        original_status = orders[0].get("status", "pending")
        
        # Change status to create a previous_status
        new_status = "processing" if original_status != "processing" else "pending"
        change_res = requests.put(
            f"{BASE_URL}/api/admin/orders/{order_id}/status?status={new_status}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert change_res.status_code == 200
        
        # Now rollback
        rollback_res = requests.put(
            f"{BASE_URL}/api/admin/orders/{order_id}/rollback-status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert rollback_res.status_code == 200
        data = rollback_res.json()
        assert "status" in data
        assert data["status"] == original_status  # Should be rolled back

    def test_rollback_no_previous_status(self, admin_token):
        """Rollback should fail if no previous_status exists"""
        # Find an order without previous_status
        orders_res = requests.get(
            f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        orders = orders_res.json()
        
        # Look for order with no previous_status
        order_without_prev = None
        for order in orders:
            if not order.get("previous_status"):
                order_without_prev = order
                break
        
        if not order_without_prev:
            pytest.skip("All orders have previous_status, cannot test this case")
        
        response = requests.put(
            f"{BASE_URL}/api/admin/orders/{order_without_prev['id']}/rollback-status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should fail with 400 because there's no previous status
        assert response.status_code == 400


# ========================== TRACKING AND ANALYTICS TESTS ==========================

class TestTracking:
    """Test POST /api/track with browser fingerprint data"""

    def test_track_with_fingerprint(self, admin_token):
        """Track events with browser fingerprint should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/track",
            json={
                "events": [
                    {"event_type": "page_view", "page": "/test-pytest"}
                ],
                "fingerprint": {
                    "user_agent": "Mozilla/5.0 Pytest Agent",
                    "browser": "Chrome",
                    "browser_version": "120.0",
                    "os": "Linux",
                    "os_version": "Ubuntu 22.04",
                    "device": "Desktop",
                    "screen_resolution": "2560x1440",
                    "viewport": "1920x900",
                    "language": "ru-RU",
                    "languages": ["ru-RU", "en-US"],
                    "timezone": "Europe/Moscow",
                    "timezone_offset": -180,
                    "platform": "Linux x86_64",
                    "cookie_enabled": True,
                    "do_not_track": False,
                    "online": True,
                    "connection_type": "wifi",
                    "memory": 16,
                    "cores": 8,
                    "touch_support": False,
                    "referer": ""
                }
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tracked" in data
        assert data["tracked"] >= 1


class TestUserAnalytics:
    """Test GET /api/admin/users/{user_id}/analytics with sessions data"""

    def test_get_user_analytics_success(self, admin_token):
        """Admin should be able to get user analytics with sessions"""
        # Use admin user ID (known to have analytics from tracking test)
        admin_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"
        
        response = requests.get(
            f"{BASE_URL}/api/admin/users/{admin_id}/analytics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check expected fields
        assert "user" in data
        assert "summary" in data
        assert "sessions" in data  # Enhanced tracking - sessions data
        assert "pages" in data
        assert "searches" in data
        assert "clicks" in data
        assert "recent_activity" in data
        
        # Check summary fields
        assert "total_events" in data["summary"]
        assert "total_page_views" in data["summary"]
        assert "total_searches" in data["summary"]
        assert "total_clicks" in data["summary"]
        assert "total_time_seconds" in data["summary"]

    def test_get_user_analytics_requires_admin(self, client_token):
        """Non-admin should not be able to get user analytics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/{DEMO_USER_ID}/analytics",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 403

    def test_sessions_contain_browser_data(self, admin_token):
        """Sessions should contain browser fingerprint data (IP, geo, browser, OS, screen, etc.)"""
        admin_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"
        
        response = requests.get(
            f"{BASE_URL}/api/admin/users/{admin_id}/analytics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        sessions = data.get("sessions", [])
        if sessions:
            session = sessions[0]
            # Check for expected session fields from browser fingerprint
            expected_fields = ["ip", "browser", "os", "device", "screen_resolution", "viewport", "language"]
            for field in expected_fields:
                assert field in session, f"Session missing expected field: {field}"


# ========================== BONUS PROGRAM USERS LIST TEST ==========================

class TestBonusProgramUsers:
    """Test GET /api/admin/bonus/programs/{program_id}/users"""

    def test_get_program_users(self, admin_token):
        """Admin should be able to get users in a bonus program"""
        response = requests.get(
            f"{BASE_URL}/api/admin/bonus/programs/{BONUS_PROGRAM_ID}/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        
        # Each user should have id, name, email, current_amount
        if data["users"]:
            user = data["users"][0]
            assert "id" in user
            assert "name" in user or "email" in user
            assert "current_amount" in user


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
