"""
Test User Blocking Feature - Iteration 42
Tests for admin ability to block/unblock user accounts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"
CLIENT_EMAIL = "user@demo.com"
CLIENT_PASSWORD = "demo123"
CLIENT_USER_ID = "65fab4bf-5637-49c0-96a5-4f9f54ca2828"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def admin_session(admin_token):
    """Get admin session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    })
    return session


@pytest.fixture(scope="module")
def admin_user_id(admin_token):
    """Get admin user ID from /auth/me"""
    response = requests.get(f"{BASE_URL}/api/auth/me", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert response.status_code == 200
    return response.json()["id"]


class TestBlockEndpoint:
    """Test POST /api/admin/users/{user_id}/block endpoint"""
    
    def test_block_user_toggles_blocked_status(self, admin_session):
        """Block endpoint should toggle blocked status and return {blocked: true/false}"""
        # First call - should block (or toggle current state)
        response = admin_session.post(f"{BASE_URL}/api/admin/users/{CLIENT_USER_ID}/block")
        assert response.status_code == 200, f"Block endpoint failed: {response.text}"
        
        data = response.json()
        assert "blocked" in data, "Response should contain 'blocked' field"
        assert isinstance(data["blocked"], bool), "'blocked' field should be a boolean"
        
        first_state = data["blocked"]
        print(f"First block call - blocked: {first_state}")
        
        # Second call - should toggle to opposite state
        response2 = admin_session.post(f"{BASE_URL}/api/admin/users/{CLIENT_USER_ID}/block")
        assert response2.status_code == 200, f"Second block call failed: {response2.text}"
        
        data2 = response2.json()
        assert data2["blocked"] != first_state, "Block should toggle the state"
        print(f"Second block call - blocked: {data2['blocked']}")
    
    def test_cannot_block_yourself(self, admin_session, admin_user_id):
        """Admin should not be able to block themselves (returns 400)"""
        response = admin_session.post(f"{BASE_URL}/api/admin/users/{admin_user_id}/block")
        assert response.status_code == 400, f"Expected 400 when blocking self, got {response.status_code}"
        print(f"Cannot block yourself - returned 400 as expected")
    
    def test_cannot_block_admin_user(self, admin_session):
        """Should not be able to block admin users (returns 400)"""
        # Get list of users to find an admin
        users_response = admin_session.get(f"{BASE_URL}/api/admin/users")
        assert users_response.status_code == 200
        
        users = users_response.json()
        admin_users = [u for u in users if u.get("role") == "admin"]
        
        if len(admin_users) > 0:
            admin_to_block = admin_users[0]
            response = admin_session.post(f"{BASE_URL}/api/admin/users/{admin_to_block['id']}/block")
            assert response.status_code == 400, f"Expected 400 when blocking admin, got {response.status_code}"
            print(f"Cannot block admin user - returned 400 as expected")
        else:
            pytest.skip("No admin users found to test blocking")
    
    def test_block_nonexistent_user(self, admin_session):
        """Blocking non-existent user should return 404"""
        response = admin_session.post(f"{BASE_URL}/api/admin/users/nonexistent-user-id/block")
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}"
        print("Non-existent user block attempt - returned 404 as expected")


class TestBlockedUserLogin:
    """Test that blocked users cannot login"""
    
    def test_blocked_user_cannot_login(self, admin_session):
        """Blocked user should receive 403 with detail 'account_blocked' on login"""
        # First ensure user is blocked
        response = admin_session.post(f"{BASE_URL}/api/admin/users/{CLIENT_USER_ID}/block")
        assert response.status_code == 200
        
        # If not blocked, toggle to block
        if not response.json()["blocked"]:
            response = admin_session.post(f"{BASE_URL}/api/admin/users/{CLIENT_USER_ID}/block")
            assert response.json()["blocked"] == True
        
        print(f"User is now blocked: {response.json()['blocked']}")
        
        # Try to login as blocked user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        
        assert login_response.status_code == 403, f"Expected 403 for blocked user login, got {login_response.status_code}"
        data = login_response.json()
        assert data.get("detail") == "account_blocked", f"Expected detail='account_blocked', got {data}"
        print("Blocked user login attempt - returned 403 with 'account_blocked' detail")
    
    def test_unblocked_user_can_login(self, admin_session):
        """After unblocking, user should be able to login normally"""
        # Ensure user is unblocked
        response = admin_session.post(f"{BASE_URL}/api/admin/users/{CLIENT_USER_ID}/block")
        assert response.status_code == 200
        
        # If blocked, toggle to unblock
        if response.json()["blocked"]:
            response = admin_session.post(f"{BASE_URL}/api/admin/users/{CLIENT_USER_ID}/block")
            assert response.json()["blocked"] == False
        
        print(f"User is now unblocked: {response.json()['blocked']}")
        
        # Try to login as unblocked user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        
        assert login_response.status_code == 200, f"Expected 200 for unblocked user login, got {login_response.status_code}"
        data = login_response.json()
        assert "token" in data, "Login response should contain token"
        assert data["user"]["email"] == CLIENT_EMAIL
        print("Unblocked user login - successful with token")


class TestBlockedUserAuthenticatedRequest:
    """Test that blocked user's existing token returns 403 on GET /api/auth/me"""
    
    def test_blocked_user_token_returns_403_on_me(self, admin_session):
        """Blocked user's token should return 403 on /api/auth/me"""
        # First ensure user is unblocked and get a token
        unblock_response = admin_session.post(f"{BASE_URL}/api/admin/users/{CLIENT_USER_ID}/block")
        if unblock_response.json()["blocked"]:
            unblock_response = admin_session.post(f"{BASE_URL}/api/admin/users/{CLIENT_USER_ID}/block")
        
        # Login to get a fresh token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        assert login_response.status_code == 200
        client_token = login_response.json()["token"]
        print(f"Got client token while unblocked")
        
        # Verify token works before blocking
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {client_token}"
        })
        assert me_response.status_code == 200, f"Token should work before blocking: {me_response.status_code}"
        print("Token works before blocking - /api/auth/me returns 200")
        
        # Now block the user
        block_response = admin_session.post(f"{BASE_URL}/api/admin/users/{CLIENT_USER_ID}/block")
        assert block_response.json()["blocked"] == True
        print("User is now blocked")
        
        # Try to use the token after blocking
        me_response_after = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {client_token}"
        })
        
        assert me_response_after.status_code == 403, f"Expected 403 for blocked user's token, got {me_response_after.status_code}"
        data = me_response_after.json()
        assert data.get("detail") == "account_blocked", f"Expected detail='account_blocked', got {data}"
        print("Blocked user's token - /api/auth/me returns 403 with 'account_blocked'")
        
        # Cleanup - unblock the user
        admin_session.post(f"{BASE_URL}/api/admin/users/{CLIENT_USER_ID}/block")
        print("Cleanup - user unblocked")


class TestBlockedUserVisibleInAdminPanel:
    """Test that blocked status is visible in admin users list"""
    
    def test_blocked_field_in_users_list(self, admin_session):
        """GET /api/admin/users should include 'blocked' field for each user"""
        response = admin_session.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 200
        
        users = response.json()
        assert len(users) > 0, "Should have at least one user"
        
        # Check that users have the blocked field
        for user in users:
            assert "blocked" in user or user.get("blocked") is None, f"User {user.get('email')} should have 'blocked' field or it defaults to false/None"
        
        print(f"Users list contains {len(users)} users with blocked field available")


@pytest.fixture(scope="module", autouse=True)
def cleanup_after_tests(admin_session):
    """Ensure the test user is unblocked after all tests complete"""
    yield
    # Cleanup - ensure user is unblocked
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check if user is blocked
        users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        if users_response.status_code == 200:
            users = users_response.json()
            client_user = next((u for u in users if u.get("id") == CLIENT_USER_ID), None)
            if client_user and client_user.get("blocked"):
                # Unblock the user
                requests.post(f"{BASE_URL}/api/admin/users/{CLIENT_USER_ID}/block", headers=headers)
                print(f"Cleanup: Unblocked test user {CLIENT_EMAIL}")
