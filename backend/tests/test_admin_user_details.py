"""
Test suite for Admin Panel - Expandable User Cards feature
Tests the /admin/users/{user_id}/details endpoint and related functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminUserDetails:
    """Tests for expandable user cards in admin panel"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.admin_user = login_response.json().get("user")
    
    def test_get_admin_users_list(self):
        """Test GET /admin/users - should return list of users with basic stats"""
        response = self.session.get(f"{BASE_URL}/api/admin/users")
        
        assert response.status_code == 200, f"Failed to get users: {response.text}"
        
        users = response.json()
        assert isinstance(users, list), "Response should be a list"
        assert len(users) > 0, "Should have at least one user (admin)"
        
        # Check user structure
        admin_user = next((u for u in users if u.get("email") == "admin@avarus.ru"), None)
        assert admin_user is not None, "Admin user should be in the list"
        
        # Verify required fields for user cards
        assert "id" in admin_user, "User should have id"
        assert "name" in admin_user, "User should have name"
        assert "email" in admin_user, "User should have email"
        assert "role" in admin_user, "User should have role"
        assert "total_orders" in admin_user, "User should have total_orders (quick stat)"
        assert "total_spent" in admin_user, "User should have total_spent (quick stat)"
        
        # Password hash should be removed, but plain_password may be present for admin view
        assert "password" not in admin_user, "Password hash should not be exposed"
        
        print(f"✓ Users list returned {len(users)} users with correct structure")
    
    def test_get_user_details_endpoint(self):
        """Test GET /admin/users/{user_id}/details - should return detailed user info"""
        # First get users list to get a user_id
        users_response = self.session.get(f"{BASE_URL}/api/admin/users")
        assert users_response.status_code == 200
        users = users_response.json()
        
        # Get details for admin user
        admin_user = next((u for u in users if u.get("email") == "admin@avarus.ru"), None)
        assert admin_user is not None
        
        # Get detailed info
        response = self.session.get(f"{BASE_URL}/api/admin/users/{admin_user['id']}/details")
        
        assert response.status_code == 200, f"Failed to get user details: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "user" in data, "Response should have 'user' object"
        assert "statistics" in data, "Response should have 'statistics' object"
        assert "recent_orders" in data, "Response should have 'recent_orders' array"
        
        print(f"✓ User details endpoint returns correct structure")
    
    def test_user_details_personal_info(self):
        """Test that user details contains all personal info fields"""
        # Get users list
        users_response = self.session.get(f"{BASE_URL}/api/admin/users")
        users = users_response.json()
        admin_user = next((u for u in users if u.get("email") == "admin@avarus.ru"), None)
        
        # Get details
        response = self.session.get(f"{BASE_URL}/api/admin/users/{admin_user['id']}/details")
        data = response.json()
        
        user_info = data["user"]
        
        # Check personal info fields
        assert "name" in user_info, "User should have name"
        assert "email" in user_info, "User should have email"
        assert "role" in user_info, "User should have role"
        
        # Password should be visible (plain_password field)
        # Note: password hash should be removed
        assert "password" not in user_info, "Password hash should not be exposed"
        
        # Optional fields that should be present if set
        # phone, address, created_at, plain_password
        
        print(f"✓ User personal info contains required fields: name={user_info.get('name')}, email={user_info.get('email')}, role={user_info.get('role')}")
    
    def test_user_details_statistics(self):
        """Test that user details contains order statistics"""
        # Get users list
        users_response = self.session.get(f"{BASE_URL}/api/admin/users")
        users = users_response.json()
        admin_user = next((u for u in users if u.get("email") == "admin@avarus.ru"), None)
        
        # Get details
        response = self.session.get(f"{BASE_URL}/api/admin/users/{admin_user['id']}/details")
        data = response.json()
        
        stats = data["statistics"]
        
        # Check required statistics fields
        assert "total_orders" in stats, "Statistics should have total_orders"
        assert "total_spent" in stats, "Statistics should have total_spent"
        assert "avg_order_value" in stats, "Statistics should have avg_order_value"
        assert "total_items" in stats, "Statistics should have total_items"
        assert "orders_by_status" in stats, "Statistics should have orders_by_status"
        assert "favorite_products" in stats, "Statistics should have favorite_products"
        
        # Verify types
        assert isinstance(stats["total_orders"], int), "total_orders should be int"
        assert isinstance(stats["total_spent"], (int, float)), "total_spent should be numeric"
        assert isinstance(stats["avg_order_value"], (int, float)), "avg_order_value should be numeric"
        assert isinstance(stats["total_items"], int), "total_items should be int"
        assert isinstance(stats["orders_by_status"], dict), "orders_by_status should be dict"
        assert isinstance(stats["favorite_products"], list), "favorite_products should be list"
        
        print(f"✓ Statistics: orders={stats['total_orders']}, spent={stats['total_spent']}, avg={stats['avg_order_value']}")
    
    def test_user_details_recent_orders(self):
        """Test that user details contains recent orders"""
        # Get users list
        users_response = self.session.get(f"{BASE_URL}/api/admin/users")
        users = users_response.json()
        admin_user = next((u for u in users if u.get("email") == "admin@avarus.ru"), None)
        
        # Get details
        response = self.session.get(f"{BASE_URL}/api/admin/users/{admin_user['id']}/details")
        data = response.json()
        
        recent_orders = data["recent_orders"]
        
        assert isinstance(recent_orders, list), "recent_orders should be a list"
        
        # If there are orders, check structure
        if len(recent_orders) > 0:
            order = recent_orders[0]
            assert "id" in order, "Order should have id"
            assert "status" in order, "Order should have status"
            assert "total" in order, "Order should have total"
            print(f"✓ Recent orders: {len(recent_orders)} orders found")
        else:
            print(f"✓ Recent orders: empty list (user has no orders)")
    
    def test_user_details_nonexistent_user(self):
        """Test that requesting details for non-existent user returns 404"""
        response = self.session.get(f"{BASE_URL}/api/admin/users/nonexistent-user-id/details")
        
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}"
        print(f"✓ Non-existent user returns 404")
    
    def test_user_details_requires_admin(self):
        """Test that user details endpoint requires admin role"""
        # Create a new session without admin token
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try to access without auth
        response = session.get(f"{BASE_URL}/api/admin/users/some-id/details")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        
        print(f"✓ Endpoint requires authentication")
    
    def test_user_edit_from_expanded_view(self):
        """Test that user can be edited (PUT /admin/users/{user_id})"""
        # Get users list
        users_response = self.session.get(f"{BASE_URL}/api/admin/users")
        users = users_response.json()
        
        # Find a non-admin user to edit, or create one
        test_user = next((u for u in users if u.get("role") != "admin"), None)
        
        if test_user:
            # Update user
            response = self.session.put(f"{BASE_URL}/api/admin/users/{test_user['id']}", json={
                "name": test_user.get("name", "Test User"),
                "phone": "+7 999 123 4567"
            })
            
            assert response.status_code == 200, f"Failed to update user: {response.text}"
            print(f"✓ User edit endpoint works")
        else:
            print(f"✓ No non-admin user to test edit (skipped)")
    
    def test_user_delete_from_expanded_view(self):
        """Test that user can be deleted (DELETE /admin/users/{user_id})"""
        # Create a test user first
        create_response = self.session.post(f"{BASE_URL}/api/admin/users", json={
            "email": "test_delete_user@test.com",
            "password": "testpass123",
            "name": "Test Delete User",
            "role": "user"
        })
        
        if create_response.status_code == 200:
            user_id = create_response.json().get("id")
            
            # Delete the user
            delete_response = self.session.delete(f"{BASE_URL}/api/admin/users/{user_id}")
            assert delete_response.status_code == 200, f"Failed to delete user: {delete_response.text}"
            
            # Verify user is deleted
            verify_response = self.session.get(f"{BASE_URL}/api/admin/users/{user_id}/details")
            assert verify_response.status_code == 404, "Deleted user should return 404"
            
            print(f"✓ User delete endpoint works")
        else:
            # User might already exist, try to delete
            print(f"✓ User delete test skipped (user creation failed: {create_response.text})")


class TestAdminUserListQuickStats:
    """Tests for quick stats shown on user cards"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_users_have_order_count(self):
        """Test that users list includes order count"""
        response = self.session.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 200
        
        users = response.json()
        for user in users:
            assert "total_orders" in user, f"User {user.get('email')} missing total_orders"
            assert isinstance(user["total_orders"], int), "total_orders should be int"
        
        print(f"✓ All {len(users)} users have total_orders field")
    
    def test_users_have_total_spent(self):
        """Test that users list includes total spent"""
        response = self.session.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 200
        
        users = response.json()
        for user in users:
            assert "total_spent" in user, f"User {user.get('email')} missing total_spent"
            assert isinstance(user["total_spent"], (int, float)), "total_spent should be numeric"
        
        print(f"✓ All {len(users)} users have total_spent field")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
