"""
Test suite for Profile Editing and Orders Statistics features
Tests:
- Profile update (name, email, phone, address)
- Email uniqueness validation
- Password change with current password verification
- Orders statistics endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://partsfinder-7.preview.emergentagent.com')

# Test credentials
TEST_USER_EMAIL = "testuser@test.com"
TEST_USER_PASSWORD = "password123"
ADMIN_EMAIL = "admin@avarus.ru"


class TestProfileAPI:
    """Profile editing API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        self.token = login_res.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = login_res.json().get("user")
    
    def test_get_current_user(self):
        """GET /api/auth/me - Get current user profile"""
        res = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert res.status_code == 200
        data = res.json()
        assert "id" in data
        assert "email" in data
        assert "name" in data
        # Password should NOT be in response
        assert "password" not in data
        assert "password_plain" not in data
        assert "password_hash" not in data
    
    def test_update_profile_basic_fields(self):
        """PUT /api/auth/profile - Update name, phone, address"""
        res = requests.put(f"{BASE_URL}/api/auth/profile", headers=self.headers, json={
            "name": "Test User Updated",
            "phone": "+7 999 888 7777",
            "address": "Moscow, Test Street 123"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "Test User Updated"
        assert data["phone"] == "+7 999 888 7777"
        assert data["address"] == "Moscow, Test Street 123"
        # Password should NOT be in response
        assert "password" not in data
        assert "password_plain" not in data
    
    def test_update_email(self):
        """PUT /api/auth/profile - Update email"""
        # Change email
        res = requests.put(f"{BASE_URL}/api/auth/profile", headers=self.headers, json={
            "email": "testuser_updated@test.com"
        })
        assert res.status_code == 200
        assert res.json()["email"] == "testuser_updated@test.com"
        
        # Revert email back
        revert_res = requests.put(f"{BASE_URL}/api/auth/profile", headers=self.headers, json={
            "email": TEST_USER_EMAIL
        })
        assert revert_res.status_code == 200
    
    def test_email_uniqueness(self):
        """PUT /api/auth/profile - Email uniqueness check"""
        res = requests.put(f"{BASE_URL}/api/auth/profile", headers=self.headers, json={
            "email": ADMIN_EMAIL  # Try to use admin's email
        })
        assert res.status_code == 400
        assert "уже используется" in res.json().get("detail", "").lower()
    
    def test_password_change_requires_current_password(self):
        """PUT /api/auth/profile - Password change requires current password"""
        res = requests.put(f"{BASE_URL}/api/auth/profile", headers=self.headers, json={
            "new_password": "newpassword123"
        })
        assert res.status_code == 400
        assert "текущий пароль" in res.json().get("detail", "").lower()
    
    def test_password_change_wrong_current_password(self):
        """PUT /api/auth/profile - Wrong current password rejected"""
        res = requests.put(f"{BASE_URL}/api/auth/profile", headers=self.headers, json={
            "current_password": "wrongpassword",
            "new_password": "newpassword123"
        })
        assert res.status_code == 400
        assert "неверный" in res.json().get("detail", "").lower()
    
    def test_password_change_success(self):
        """PUT /api/auth/profile - Password change with correct current password"""
        # Change password
        res = requests.put(f"{BASE_URL}/api/auth/profile", headers=self.headers, json={
            "current_password": TEST_USER_PASSWORD,
            "new_password": "newpassword456"
        })
        assert res.status_code == 200
        # Password should NOT be in response
        data = res.json()
        assert "password" not in data
        assert "password_plain" not in data
        
        # Verify new password works
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": "newpassword456"
        })
        assert login_res.status_code == 200
        
        # Revert password back
        new_token = login_res.json().get("token")
        revert_res = requests.put(f"{BASE_URL}/api/auth/profile", 
            headers={"Authorization": f"Bearer {new_token}"}, 
            json={
                "current_password": "newpassword456",
                "new_password": TEST_USER_PASSWORD
            })
        assert revert_res.status_code == 200


class TestOrdersStatsAPI:
    """Orders statistics API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert login_res.status_code == 200
        self.token = login_res.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_orders_stats(self):
        """GET /api/orders/stats - Get extended order statistics"""
        res = requests.get(f"{BASE_URL}/api/orders/stats", headers=self.headers)
        assert res.status_code == 200
        data = res.json()
        
        # Check all required fields are present
        required_fields = [
            "total_orders", "total_spent", "avg_order_value", "total_items",
            "by_status", "by_month", "delivered_total", "pending_total",
            "first_order_date", "last_order_date", "favorite_products", "total_products_types"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify data types
        assert isinstance(data["total_orders"], int)
        assert isinstance(data["total_spent"], (int, float))
        assert isinstance(data["delivered_total"], (int, float))
        assert isinstance(data["pending_total"], (int, float))
        assert isinstance(data["by_status"], dict)
        assert isinstance(data["by_month"], list)
        assert isinstance(data["favorite_products"], list)
        assert isinstance(data["total_products_types"], int)
    
    def test_get_orders_list(self):
        """GET /api/orders - Get orders list"""
        res = requests.get(f"{BASE_URL}/api/orders", headers=self.headers)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        
        # If there are orders, check structure
        if data:
            order = data[0]
            assert "id" in order
            assert "total" in order
            assert "status" in order
            assert "items" in order
            assert "created_at" in order


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
