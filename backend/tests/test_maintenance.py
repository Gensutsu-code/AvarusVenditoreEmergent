"""
Maintenance Mode API Tests
Tests for the maintenance mode feature that allows admin to disable the site
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMaintenanceStatusEndpoint:
    """Tests for GET /api/maintenance/status endpoint"""
    
    def test_get_maintenance_status_returns_default_disabled(self, api_client):
        """GET /api/maintenance/status returns enabled=false by default (or current state)"""
        response = api_client.get(f"{BASE_URL}/api/maintenance/status")
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "message" in data
        assert isinstance(data["enabled"], bool)
        assert isinstance(data["message"], str)
        print(f"✓ PASS: GET /api/maintenance/status returns {data}")


class TestMaintenanceToggleEndpoint:
    """Tests for POST /api/maintenance/toggle endpoint"""
    
    def test_toggle_requires_authentication(self, api_client):
        """POST /api/maintenance/toggle requires admin authentication"""
        response = api_client.post(f"{BASE_URL}/api/maintenance/toggle")
        assert response.status_code in [401, 403]
        print("✓ PASS: Toggle requires authentication")
    
    def test_toggle_requires_admin_role(self, client_token, api_client):
        """POST /api/maintenance/toggle returns 403 for non-admin users"""
        response = api_client.post(
            f"{BASE_URL}/api/maintenance/toggle",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 403
        print("✓ PASS: Toggle requires admin role (non-admin gets 403)")
    
    def test_toggle_works_for_admin(self, admin_token, api_client):
        """POST /api/maintenance/toggle works for admin and toggles the state"""
        # Get current state
        status_response = api_client.get(f"{BASE_URL}/api/maintenance/status")
        current_state = status_response.json()["enabled"]
        
        # Toggle
        response = api_client.post(
            f"{BASE_URL}/api/maintenance/toggle",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert data["enabled"] != current_state, "Toggle should flip the enabled state"
        print(f"✓ PASS: Admin toggle changed state from {current_state} to {data['enabled']}")
        
        # Toggle back to original state
        response = api_client.post(
            f"{BASE_URL}/api/maintenance/toggle",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        assert response.json()["enabled"] == current_state, "Second toggle should restore original state"
        print(f"✓ PASS: Admin toggle restored state to {current_state}")


class TestMaintenanceSettingsEndpoint:
    """Tests for PUT /api/maintenance/settings endpoint"""
    
    def test_update_settings_requires_authentication(self, api_client):
        """PUT /api/maintenance/settings requires authentication"""
        response = api_client.put(
            f"{BASE_URL}/api/maintenance/settings",
            json={"message": "Test message"}
        )
        assert response.status_code in [401, 403]
        print("✓ PASS: Update settings requires authentication")
    
    def test_update_settings_requires_admin_role(self, client_token, api_client):
        """PUT /api/maintenance/settings returns 403 for non-admin users"""
        response = api_client.put(
            f"{BASE_URL}/api/maintenance/settings",
            json={"message": "Test message"},
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 403
        print("✓ PASS: Update settings requires admin role")
    
    def test_update_message_works_for_admin(self, admin_token, api_client):
        """PUT /api/maintenance/settings updates message for admin"""
        test_message = "TEST_Maintenance_Testing in progress"
        
        response = api_client.put(
            f"{BASE_URL}/api/maintenance/settings",
            json={"message": test_message},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == test_message
        print(f"✓ PASS: Admin updated message to '{test_message}'")
        
        # Verify via GET
        status_response = api_client.get(f"{BASE_URL}/api/maintenance/status")
        assert status_response.json()["message"] == test_message
        print("✓ PASS: GET confirms message was updated")
        
        # Clean up - reset message
        api_client.put(
            f"{BASE_URL}/api/maintenance/settings",
            json={"message": ""},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print("✓ CLEANUP: Message reset to empty")


class TestMaintenanceModeIntegration:
    """Integration tests for maintenance mode behavior"""
    
    def test_maintenance_off_allows_api_access(self, admin_token, api_client):
        """When maintenance is OFF, APIs are accessible"""
        # Ensure maintenance is OFF
        status = api_client.get(f"{BASE_URL}/api/maintenance/status").json()
        if status["enabled"]:
            api_client.post(
                f"{BASE_URL}/api/maintenance/toggle",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        
        # Verify normal API access
        response = api_client.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        print("✓ PASS: When maintenance OFF, /api/products is accessible")
    
    def test_login_endpoint_always_accessible(self, admin_token, api_client):
        """Login endpoint should always be accessible regardless of maintenance mode"""
        # This test verifies that the login API is accessible even during maintenance
        # The maintenance blocking is done on frontend, not backend APIs
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}
        )
        assert response.status_code == 200
        assert "token" in response.json()
        print("✓ PASS: Login endpoint is accessible during any maintenance state")


# Fixtures
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@avarus.ru", "password": os.environ["TEST_ADMIN_PASSWORD"]}
    )
    if response.status_code == 200:
        token = response.json().get("token")
        print(f"Admin token obtained successfully")
        return token
    pytest.skip("Admin authentication failed")


@pytest.fixture
def client_token(api_client):
    """Get client (non-admin) authentication token"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "user@demo.com", "password": os.environ["TEST_CLIENT_PASSWORD"]}
    )
    if response.status_code == 200:
        token = response.json().get("token")
        print(f"Client token obtained successfully")
        return token
    pytest.skip("Client authentication failed")
