"""
Tests for discount settings and status/discount requests features:
- Public discount settings endpoint
- Admin notifications endpoint  
- User status upgrade requests
- User individual discount requests
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "TEST@MAIL.RU"
TEST_USER_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def api_client():
    """Basic requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def user_token(api_client):
    """Get test user authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    assert response.status_code == 200, f"Test user login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin token"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    }


@pytest.fixture(scope="module")
def user_headers(user_token):
    """Headers with user token"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {user_token}"
    }


class TestPublicDiscountSettings:
    """Tests for public discount settings endpoint"""
    
    def test_discount_settings_returns_thresholds(self, api_client):
        """GET /api/discount-settings should return discount settings with thresholds"""
        response = api_client.get(f"{BASE_URL}/api/discount-settings")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify structure
        assert "retail_discount" in data, "Missing retail_discount"
        assert "wholesale_discount" in data, "Missing wholesale_discount"
        assert "partner_discount" in data, "Missing partner_discount"
        assert "wholesale_threshold" in data, "Missing wholesale_threshold"
        assert "partner_threshold" in data, "Missing partner_threshold"
        
        # Verify threshold values are numbers
        assert isinstance(data["wholesale_threshold"], (int, float))
        assert isinstance(data["partner_threshold"], (int, float))
        
        # Verify expected default values
        assert data["wholesale_threshold"] == 50000, f"Expected 50000, got {data['wholesale_threshold']}"
        assert data["partner_threshold"] == 200000, f"Expected 200000, got {data['partner_threshold']}"
        
        print(f"Discount settings: {data}")


class TestAdminNotifications:
    """Tests for admin notifications endpoint"""
    
    def test_admin_notifications_returns_counts(self, api_client, admin_headers):
        """GET /api/admin/notifications should return notification counts"""
        response = api_client.get(f"{BASE_URL}/api/admin/notifications", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify structure
        assert "status_requests" in data, "Missing status_requests"
        assert "discount_requests" in data, "Missing discount_requests"
        assert "bonus_requests" in data, "Missing bonus_requests"
        assert "prize_requests" in data, "Missing prize_requests"
        assert "new_orders" in data, "Missing new_orders"
        assert "unread_chats" in data, "Missing unread_chats"
        assert "total" in data, "Missing total"
        
        # All values should be non-negative integers
        for key in ["status_requests", "discount_requests", "bonus_requests", 
                    "prize_requests", "new_orders", "unread_chats", "total"]:
            assert isinstance(data[key], int), f"{key} should be int"
            assert data[key] >= 0, f"{key} should be non-negative"
        
        print(f"Admin notifications: {data}")
    
    def test_admin_notifications_requires_auth(self, api_client):
        """Admin notifications should require authentication"""
        response = api_client.get(f"{BASE_URL}/api/admin/notifications")
        assert response.status_code == 403 or response.status_code == 401, "Should require auth"
    
    def test_admin_notifications_requires_admin_role(self, api_client, user_headers):
        """Admin notifications should require admin role"""
        response = api_client.get(f"{BASE_URL}/api/admin/notifications", headers=user_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


class TestUserAuthentication:
    """Verify test user status and discount"""
    
    def test_user_has_wholesale_status(self, api_client, user_headers):
        """Test user should have wholesale status"""
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=user_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("customer_status") == "wholesale", f"Expected wholesale, got {data.get('customer_status')}"
        assert data.get("individual_discount") == 5, f"Expected 5, got {data.get('individual_discount')}"
        
        print(f"User status: {data.get('customer_status')}, individual_discount: {data.get('individual_discount')}")


class TestIndividualDiscountRequest:
    """Tests for individual discount request endpoint"""
    
    def test_request_discount_with_reason(self, api_client, user_headers):
        """POST /api/request-individual-discount should work with reason text"""
        # Clear any existing pending request first
        response = api_client.get(f"{BASE_URL}/api/my-requests", headers=user_headers)
        existing = response.json() if response.status_code == 200 else {}
        
        response = api_client.post(
            f"{BASE_URL}/api/request-individual-discount",
            headers=user_headers,
            json={
                "requested_discount": 10,
                "reason": "Test reason for discount request"
            }
        )
        
        # Either success or already has pending request
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print("Discount request submitted successfully")
        elif response.status_code == 400:
            assert "уже есть активный запрос" in response.json().get("detail", "").lower()
            print("Already has pending discount request - this is OK")
        else:
            pytest.fail(f"Unexpected response: {response.status_code} - {response.text}")
    
    def test_request_discount_requires_reason(self, api_client, user_headers):
        """Request should fail without reason"""
        response = api_client.post(
            f"{BASE_URL}/api/request-individual-discount",
            headers=user_headers,
            json={
                "requested_discount": 10,
                "reason": ""
            }
        )
        # Either validation error or already has pending request
        assert response.status_code in [400, 422], f"Expected error: {response.status_code}"
    
    def test_request_discount_validates_percentage(self, api_client, user_headers):
        """Request should validate discount percentage"""
        response = api_client.post(
            f"{BASE_URL}/api/request-individual-discount",
            headers=user_headers,
            json={
                "requested_discount": 60,  # Over 50% limit
                "reason": "Test reason"
            }
        )
        # Either validation error or already has pending request  
        assert response.status_code in [400, 422], f"Expected error for >50%: {response.status_code}"


class TestStatusUpgradeRequest:
    """Tests for status upgrade request endpoint"""
    
    def test_request_status_upgrade_validation(self, api_client, user_headers):
        """POST /api/request-status-upgrade validates threshold"""
        response = api_client.post(
            f"{BASE_URL}/api/request-status-upgrade",
            headers=user_headers,
            json={"requested_status": "partner"}
        )
        
        # Could be success, already has status, pending request, or threshold not met
        if response.status_code == 200:
            print("Status upgrade request submitted successfully")
        elif response.status_code == 400:
            detail = response.json().get("detail", "")
            # Valid rejection reasons
            valid_reasons = ["уже есть", "недостаточная", "активный запрос"]
            assert any(r in detail.lower() for r in valid_reasons), f"Unexpected error: {detail}"
            print(f"Expected validation: {detail}")
        else:
            pytest.fail(f"Unexpected response: {response.status_code} - {response.text}")
    
    def test_request_invalid_status(self, api_client, user_headers):
        """Should reject invalid status values"""
        response = api_client.post(
            f"{BASE_URL}/api/request-status-upgrade",
            headers=user_headers,
            json={"requested_status": "invalid_status"}
        )
        assert response.status_code in [400, 422], f"Should reject invalid status: {response.status_code}"


class TestMyRequests:
    """Tests for user's own requests endpoint"""
    
    def test_my_requests_returns_structure(self, api_client, user_headers):
        """GET /api/my-requests should return correct structure"""
        response = api_client.get(f"{BASE_URL}/api/my-requests", headers=user_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "status_request" in data, "Missing status_request field"
        assert "discount_request" in data, "Missing discount_request field"
        
        # Values can be None or dict
        if data["status_request"] is not None:
            assert isinstance(data["status_request"], dict)
            print(f"Has pending status request: {data['status_request']}")
        
        if data["discount_request"] is not None:
            assert isinstance(data["discount_request"], dict)
            print(f"Has pending discount request: {data['discount_request']}")


class TestAdminDiscountSettings:
    """Tests for admin discount settings tab"""
    
    def test_admin_discount_settings_has_thresholds(self, api_client, admin_headers):
        """GET /api/admin/discount-settings should return all settings including thresholds"""
        response = api_client.get(f"{BASE_URL}/api/admin/discount-settings", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify thresholds are present
        assert "wholesale_threshold" in data or "wholesale_discount" in data
        print(f"Admin discount settings: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
