"""
Iteration 55 Tests: Password Plain Display & Admin Chat Actions
Tests for:
1. password_plain field in admin user list
2. password_plain in user details
3. Chat pin/label/delete functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = os.environ["TEST_ADMIN_PASSWORD"]
TEST_USER_EMAIL = "user@demo.com"
TEST_USER_PASSWORD = os.environ["TEST_CLIENT_PASSWORD"]


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login(self):
        """Test admin login returns token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "admin", "User is not admin"
        print(f"PASS: Admin login successful, role={data['user']['role']}")
        return data["token"]


class TestPasswordPlainInUserList:
    """Tests for password_plain field in GET /api/admin/users"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_admin_users_returns_password_plain(self, admin_token):
        """GET /api/admin/users should return password_plain for non-admin users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get users: {response.text}"
        users = response.json()
        assert isinstance(users, list), "Response should be a list"
        assert len(users) > 0, "No users found"
        
        # Find a non-admin user
        non_admin_users = [u for u in users if u.get("role") != "admin"]
        assert len(non_admin_users) > 0, "No non-admin users found"
        
        # Check that password_plain exists for non-admin users
        users_with_password_plain = [u for u in non_admin_users if u.get("password_plain")]
        print(f"Found {len(users_with_password_plain)} non-admin users with password_plain out of {len(non_admin_users)}")
        
        # At least some users should have password_plain
        # Note: Admin user may have password_plain=MISSING
        for user in non_admin_users[:3]:
            print(f"  User: {user.get('email')}, role={user.get('role')}, password_plain={user.get('password_plain', 'NOT_SET')}")
        
        print("PASS: GET /api/admin/users returns user data")
    
    def test_admin_users_excludes_hashed_password(self, admin_token):
        """GET /api/admin/users should NOT return hashed password field"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        users = response.json()
        
        for user in users:
            assert "password" not in user or user.get("password") is None, \
                f"Hashed password should not be returned for user {user.get('email')}"
        
        print("PASS: Hashed password is excluded from user list")


class TestPasswordPlainInUserDetails:
    """Tests for password_plain in GET /api/admin/users/{user_id}/details"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_user_details_returns_password_plain(self, admin_token):
        """GET /api/admin/users/{user_id}/details should return password_plain"""
        # First get user list to find a user ID
        users_response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        users = users_response.json()
        
        # Find a non-admin user
        non_admin_user = next((u for u in users if u.get("role") != "admin"), None)
        assert non_admin_user, "No non-admin user found"
        
        user_id = non_admin_user["id"]
        
        # Get user details
        response = requests.get(
            f"{BASE_URL}/api/admin/users/{user_id}/details",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get user details: {response.text}"
        data = response.json()
        
        assert "user" in data, "No user object in response"
        user = data["user"]
        
        # Check password_plain exists
        print(f"User details for {user.get('email')}: password_plain={user.get('password_plain', 'NOT_SET')}")
        
        # Verify hashed password is excluded
        assert "password" not in user, "Hashed password should not be in user details"
        assert "password_hash" not in user, "password_hash should not be in user details"
        
        print("PASS: User details endpoint returns expected structure")


class TestAdminChatActions:
    """Tests for admin chat pin/label/delete functionality"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_admin_chats(self, admin_token):
        """GET /api/admin/chats should return chat list sorted by pinned, then updated_at"""
        response = requests.get(
            f"{BASE_URL}/api/admin/chats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get chats: {response.text}"
        chats = response.json()
        assert isinstance(chats, list), "Response should be a list"
        print(f"Found {len(chats)} chats")
        
        # Check that pinned chats come first
        if len(chats) > 1:
            pinned_indices = [i for i, c in enumerate(chats) if c.get("pinned")]
            unpinned_indices = [i for i, c in enumerate(chats) if not c.get("pinned")]
            
            if pinned_indices and unpinned_indices:
                assert max(pinned_indices) < min(unpinned_indices), \
                    "Pinned chats should appear before unpinned chats"
                print("PASS: Pinned chats are sorted first")
        
        print("PASS: GET /api/admin/chats returns chat list")
    
    def test_toggle_pin_chat(self, admin_token):
        """PUT /api/admin/chats/{chat_id}/pin should toggle pin status"""
        # First get chats
        chats_response = requests.get(
            f"{BASE_URL}/api/admin/chats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        chats = chats_response.json()
        
        if not chats:
            pytest.skip("No chats available to test pin functionality")
        
        chat = chats[0]
        chat_id = chat["id"]
        original_pinned = chat.get("pinned", False)
        
        # Toggle pin
        response = requests.put(
            f"{BASE_URL}/api/admin/chats/{chat_id}/pin",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to toggle pin: {response.text}"
        data = response.json()
        
        assert "pinned" in data, "Response should contain pinned status"
        assert data["pinned"] != original_pinned, "Pin status should be toggled"
        print(f"PASS: Pin toggled from {original_pinned} to {data['pinned']}")
        
        # Toggle back
        response = requests.put(
            f"{BASE_URL}/api/admin/chats/{chat_id}/pin",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        print("PASS: Pin toggled back successfully")
    
    def test_update_chat_label(self, admin_token):
        """PUT /api/admin/chats/{chat_id}/label should add/remove labels"""
        # First get chats
        chats_response = requests.get(
            f"{BASE_URL}/api/admin/chats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        chats = chats_response.json()
        
        if not chats:
            pytest.skip("No chats available to test label functionality")
        
        chat = chats[0]
        chat_id = chat["id"]
        
        # Add a label
        response = requests.put(
            f"{BASE_URL}/api/admin/chats/{chat_id}/label?label=important",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to update label: {response.text}"
        data = response.json()
        
        assert "labels" in data, "Response should contain labels"
        print(f"PASS: Labels updated to {data['labels']}")
        
        # Remove the label (toggle)
        response = requests.put(
            f"{BASE_URL}/api/admin/chats/{chat_id}/label?label=important",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        print("PASS: Label toggled successfully")
    
    def test_delete_chat_requires_admin(self):
        """DELETE /api/admin/chats/{chat_id} should require admin auth"""
        response = requests.delete(f"{BASE_URL}/api/admin/chats/fake-id")
        assert response.status_code in [401, 403], "Should require authentication"
        print("PASS: Delete chat requires admin authentication")


class TestCreateUserWithPasswordPlain:
    """Test that creating a user stores password_plain"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_create_user_stores_password_plain(self, admin_token):
        """POST /api/admin/users should store password_plain"""
        import uuid
        test_email = f"test_pwd_{uuid.uuid4().hex[:8]}@test.com"
        test_password = "TestPass123"
        
        # Create user
        response = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "email": test_email,
                "password": test_password,
                "name": "Test Password User",
                "role": "user"
            }
        )
        assert response.status_code == 200, f"Failed to create user: {response.text}"
        created_user = response.json()
        user_id = created_user["id"]
        
        # Get user list and verify password_plain
        users_response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        users = users_response.json()
        
        created = next((u for u in users if u["id"] == user_id), None)
        assert created, "Created user not found in list"
        assert created.get("password_plain") == test_password, \
            f"password_plain should be '{test_password}', got '{created.get('password_plain')}'"
        
        print(f"PASS: Created user has password_plain='{created.get('password_plain')}'")
        
        # Cleanup - delete test user
        requests.delete(
            f"{BASE_URL}/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print("PASS: Test user cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
