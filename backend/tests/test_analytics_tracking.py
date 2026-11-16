"""Test analytics tracking and user analytics endpoints - Iteration 41"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = os.environ["TEST_ADMIN_PASSWORD"]
CLIENT_EMAIL = "user@demo.com"
CLIENT_PASSWORD = os.environ["TEST_CLIENT_PASSWORD"]


class TestAuthentication:
    """Test user authentication for analytics endpoints"""
    
    def test_admin_login(self):
        """Test admin login returns valid token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print("✓ PASS: Admin login successful")
        return data["token"]
    
    def test_client_login(self):
        """Test client login returns valid token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200, f"Client login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print("✓ PASS: Client login successful")
        return data["token"]


@pytest.fixture(scope="class")
def admin_token():
    """Get admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="class")
def client_token():
    """Get client token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CLIENT_EMAIL,
        "password": CLIENT_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Client authentication failed")


@pytest.fixture(scope="class")
def admin_headers(admin_token):
    """Admin authorization headers"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="class")
def client_headers(client_token):
    """Client authorization headers"""
    return {"Authorization": f"Bearer {client_token}"}


class TestTrackingEndpoint:
    """Test POST /api/track endpoint for batch event tracking"""
    
    def test_track_page_view(self, client_headers):
        """Test tracking a page view event"""
        response = requests.post(f"{BASE_URL}/api/track", json={
            "events": [
                {
                    "event_type": "page_view",
                    "page": "/catalog",
                    "duration": 30
                }
            ]
        }, headers=client_headers)
        assert response.status_code == 200, f"Track page view failed: {response.text}"
        data = response.json()
        assert "tracked" in data
        assert data["tracked"] == 1
        print("✓ PASS: Page view tracking works")
    
    def test_track_search_event(self, client_headers):
        """Test tracking a search event"""
        response = requests.post(f"{BASE_URL}/api/track", json={
            "events": [
                {
                    "event_type": "search",
                    "query": "TEST_search_query",
                    "page": "/catalog"
                }
            ]
        }, headers=client_headers)
        assert response.status_code == 200, f"Track search failed: {response.text}"
        data = response.json()
        assert data["tracked"] == 1
        print("✓ PASS: Search tracking works")
    
    def test_track_button_click(self, client_headers):
        """Test tracking a button click event (add_to_cart)"""
        response = requests.post(f"{BASE_URL}/api/track", json={
            "events": [
                {
                    "event_type": "button_click",
                    "element": "add_to_cart",
                    "page": "/catalog"
                }
            ]
        }, headers=client_headers)
        assert response.status_code == 200, f"Track click failed: {response.text}"
        data = response.json()
        assert data["tracked"] == 1
        print("✓ PASS: Button click tracking works")
    
    def test_track_batch_events(self, client_headers):
        """Test tracking multiple events in one batch"""
        response = requests.post(f"{BASE_URL}/api/track", json={
            "events": [
                {"event_type": "page_view", "page": "/product", "duration": 45},
                {"event_type": "button_click", "element": "add_to_cart", "page": "/product"},
                {"event_type": "page_view", "page": "/cart", "duration": 20},
                {"event_type": "button_click", "element": "checkout_from_cart", "page": "/cart"},
                {"event_type": "page_view", "page": "/checkout", "duration": 60},
                {"event_type": "button_click", "element": "place_order", "page": "/checkout"}
            ]
        }, headers=client_headers)
        assert response.status_code == 200, f"Batch tracking failed: {response.text}"
        data = response.json()
        assert data["tracked"] == 6
        print("✓ PASS: Batch event tracking works (6 events tracked)")
    
    def test_track_favorite_events(self, client_headers):
        """Test tracking add/remove favorite events"""
        response = requests.post(f"{BASE_URL}/api/track", json={
            "events": [
                {"event_type": "button_click", "element": "add_favorite", "page": "/product"},
                {"event_type": "button_click", "element": "remove_favorite", "page": "/favorites"}
            ]
        }, headers=client_headers)
        assert response.status_code == 200, f"Favorite tracking failed: {response.text}"
        data = response.json()
        assert data["tracked"] == 2
        print("✓ PASS: Favorite add/remove tracking works")
    
    def test_track_requires_auth(self):
        """Test that tracking requires authentication"""
        response = requests.post(f"{BASE_URL}/api/track", json={
            "events": [{"event_type": "page_view", "page": "/test"}]
        })
        assert response.status_code in [401, 403], f"Tracking should require auth: {response.status_code}"
        print("✓ PASS: Tracking requires authentication")


class TestUserAnalyticsEndpoint:
    """Test GET /api/admin/users/{user_id}/analytics endpoint"""
    
    def test_get_client_user_id(self, client_headers):
        """Get the client user ID for analytics testing"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=client_headers)
        assert response.status_code == 200, f"Get user failed: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ PASS: Got client user ID: {data['id'][:8]}...")
        return data["id"]
    
    def test_admin_can_view_user_analytics(self, admin_headers, client_headers):
        """Test that admin can view analytics for a specific user"""
        # First get the client user ID
        user_res = requests.get(f"{BASE_URL}/api/auth/me", headers=client_headers)
        assert user_res.status_code == 200
        client_id = user_res.json()["id"]
        
        # Admin fetches analytics for that user
        response = requests.get(f"{BASE_URL}/api/admin/users/{client_id}/analytics", headers=admin_headers)
        assert response.status_code == 200, f"Get user analytics failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "summary" in data
        assert "pages" in data
        assert "searches" in data
        assert "clicks" in data
        assert "recent_activity" in data
        
        # Validate summary structure
        summary = data["summary"]
        assert "total_events" in summary
        assert "total_page_views" in summary
        assert "total_searches" in summary
        assert "total_clicks" in summary
        assert "total_time_seconds" in summary
        
        print(f"✓ PASS: Admin can view user analytics")
        print(f"  - Total events: {summary['total_events']}")
        print(f"  - Page views: {summary['total_page_views']}")
        print(f"  - Searches: {summary['total_searches']}")
        print(f"  - Clicks: {summary['total_clicks']}")
        print(f"  - Time on site: {summary['total_time_seconds']}s")
    
    def test_analytics_requires_admin(self, client_headers):
        """Test that non-admin users cannot access analytics"""
        # Get client's own ID
        user_res = requests.get(f"{BASE_URL}/api/auth/me", headers=client_headers)
        client_id = user_res.json()["id"]
        
        # Client tries to access analytics
        response = requests.get(f"{BASE_URL}/api/admin/users/{client_id}/analytics", headers=client_headers)
        assert response.status_code == 403, f"Non-admin should not access analytics: {response.status_code}"
        print("✓ PASS: Analytics endpoint requires admin role")
    
    def test_analytics_invalid_user_id(self, admin_headers):
        """Test analytics with invalid user ID returns empty data"""
        response = requests.get(f"{BASE_URL}/api/admin/users/nonexistent_user_12345/analytics", headers=admin_headers)
        # Should return 200 with empty data, not 404
        assert response.status_code == 200, f"Invalid user analytics failed: {response.text}"
        data = response.json()
        assert data["summary"]["total_events"] == 0
        print("✓ PASS: Invalid user returns empty analytics (not 404)")


class TestAdminUsersEndpoint:
    """Test GET /api/admin/users endpoint for CRM user list"""
    
    def test_admin_can_list_users(self, admin_headers):
        """Test that admin can fetch the user list for CRM"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        assert response.status_code == 200, f"Get users failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        
        # Check that non-admin users are present
        clients = [u for u in data if u.get("role") != "admin"]
        print(f"✓ PASS: Admin can list users ({len(clients)} clients found)")
        
        # Verify user structure has required fields
        if clients:
            user = clients[0]
            assert "id" in user
            assert "email" in user
            print(f"  - Sample user: {user.get('email')}")
        return data
    
    def test_client_cannot_list_users(self, client_headers):
        """Test that non-admin cannot access user list"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=client_headers)
        assert response.status_code == 403, f"Client should not access users: {response.status_code}"
        print("✓ PASS: User list requires admin role")


class TestCRMAnalyticsIntegration:
    """Test the full CRM analytics flow"""
    
    def test_track_then_view_analytics(self, admin_headers, client_headers):
        """Test tracking events and then viewing them in admin analytics"""
        # Get client ID
        user_res = requests.get(f"{BASE_URL}/api/auth/me", headers=client_headers)
        client_id = user_res.json()["id"]
        
        # Track some test events
        track_res = requests.post(f"{BASE_URL}/api/track", json={
            "events": [
                {"event_type": "page_view", "page": "/TEST_integration_page", "duration": 10},
                {"event_type": "button_click", "element": "TEST_integration_click", "page": "/TEST_integration_page"}
            ]
        }, headers=client_headers)
        assert track_res.status_code == 200
        
        # Small delay to ensure events are stored
        time.sleep(0.5)
        
        # View analytics as admin
        analytics_res = requests.get(f"{BASE_URL}/api/admin/users/{client_id}/analytics", headers=admin_headers)
        assert analytics_res.status_code == 200
        data = analytics_res.json()
        
        # Verify the tracked events appear in the data
        assert data["summary"]["total_events"] > 0
        print("✓ PASS: Full CRM analytics flow works (track -> view)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
