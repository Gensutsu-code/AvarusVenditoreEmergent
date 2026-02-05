"""
Phase 4 Features Test Suite
Tests for:
1. Partner brands CRUD (GET /api/partners, POST/PUT/DELETE /api/admin/partners)
2. User avatar upload/delete (POST/DELETE /api/users/avatar)
3. Order statistics (GET /api/orders/stats)
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://truckparts-1.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "phase4test@test.com"
TEST_USER_PASSWORD = "test123"


class TestPartnerBrandsAPI:
    """Test partner brands CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["token"]
        self.admin_headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_partners_public(self):
        """Test GET /api/partners - public endpoint returns list"""
        response = requests.get(f"{BASE_URL}/api/partners")
        assert response.status_code == 200, f"GET partners failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Partners should be a list"
        print(f"PASS: GET /api/partners returns {len(data)} partners")
    
    def test_create_partner_admin(self):
        """Test POST /api/admin/partners - create new partner"""
        partner_data = {
            "name": "TEST_PARTNER_BRAND",
            "description": "Test partner description",
            "image_url": "https://example.com/test.png",
            "link": "https://example.com",
            "order": 99
        }
        response = requests.post(
            f"{BASE_URL}/api/admin/partners",
            json=partner_data,
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Create partner failed: {response.text}"
        data = response.json()
        assert data["name"] == partner_data["name"], "Partner name mismatch"
        assert data["description"] == partner_data["description"], "Partner description mismatch"
        assert "id" in data, "Partner should have an ID"
        self.created_partner_id = data["id"]
        print(f"PASS: POST /api/admin/partners created partner with ID: {data['id']}")
        return data["id"]
    
    def test_update_partner_admin(self):
        """Test PUT /api/admin/partners/{id} - update partner"""
        # First create a partner
        partner_data = {
            "name": "TEST_UPDATE_PARTNER",
            "description": "Original description",
            "image_url": "",
            "link": "",
            "order": 98
        }
        create_response = requests.post(
            f"{BASE_URL}/api/admin/partners",
            json=partner_data,
            headers=self.admin_headers
        )
        assert create_response.status_code == 200
        partner_id = create_response.json()["id"]
        
        # Update the partner
        update_data = {
            "name": "TEST_UPDATE_PARTNER_MODIFIED",
            "description": "Updated description",
            "image_url": "https://example.com/updated.png",
            "link": "https://updated.example.com",
            "order": 97
        }
        response = requests.put(
            f"{BASE_URL}/api/admin/partners/{partner_id}",
            json=update_data,
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Update partner failed: {response.text}"
        data = response.json()
        assert data["name"] == update_data["name"], "Updated name mismatch"
        assert data["description"] == update_data["description"], "Updated description mismatch"
        print(f"PASS: PUT /api/admin/partners/{partner_id} updated successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/partners/{partner_id}", headers=self.admin_headers)
    
    def test_delete_partner_admin(self):
        """Test DELETE /api/admin/partners/{id} - delete partner"""
        # First create a partner
        partner_data = {
            "name": "TEST_DELETE_PARTNER",
            "description": "To be deleted",
            "image_url": "",
            "link": "",
            "order": 96
        }
        create_response = requests.post(
            f"{BASE_URL}/api/admin/partners",
            json=partner_data,
            headers=self.admin_headers
        )
        assert create_response.status_code == 200
        partner_id = create_response.json()["id"]
        
        # Delete the partner
        response = requests.delete(
            f"{BASE_URL}/api/admin/partners/{partner_id}",
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Delete partner failed: {response.text}"
        
        # Verify deletion - partner should not be in list
        get_response = requests.get(f"{BASE_URL}/api/partners")
        partners = get_response.json()
        partner_ids = [p["id"] for p in partners]
        assert partner_id not in partner_ids, "Partner should be deleted"
        print(f"PASS: DELETE /api/admin/partners/{partner_id} deleted successfully")
    
    def test_seed_default_partners(self):
        """Test POST /api/admin/partners/seed - seed default partners"""
        response = requests.post(
            f"{BASE_URL}/api/admin/partners/seed",
            headers=self.admin_headers
        )
        assert response.status_code == 200, f"Seed partners failed: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"PASS: POST /api/admin/partners/seed - {data['message']}")
    
    def test_partner_requires_admin(self):
        """Test that partner CRUD requires admin authentication"""
        # Try without auth
        response = requests.post(f"{BASE_URL}/api/admin/partners", json={"name": "Test"})
        assert response.status_code in [401, 403], "Should require authentication"
        print("PASS: Partner CRUD requires admin authentication")


class TestUserAvatarAPI:
    """Test user avatar upload/delete operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test user and get token"""
        # Try to register test user (may already exist)
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "name": "Phase4 Test User"
        })
        
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Test user login failed: {response.text}"
        self.user_token = response.json()["token"]
        self.user_headers = {
            "Authorization": f"Bearer {self.user_token}"
        }
    
    def test_upload_avatar(self):
        """Test POST /api/users/avatar - upload avatar"""
        # Create a simple test image (1x1 pixel PNG)
        # PNG header for a 1x1 transparent pixel
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,  # bit depth, color type
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,  # compressed data
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,  # 
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,  # IEND chunk
            0x42, 0x60, 0x82
        ])
        
        files = {
            'file': ('test_avatar.png', io.BytesIO(png_data), 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/users/avatar",
            files=files,
            headers=self.user_headers
        )
        assert response.status_code == 200, f"Upload avatar failed: {response.text}"
        data = response.json()
        assert "avatar_url" in data, "Response should contain avatar_url"
        print(f"PASS: POST /api/users/avatar - avatar uploaded: {data['avatar_url']}")
    
    def test_delete_avatar(self):
        """Test DELETE /api/users/avatar - delete avatar"""
        response = requests.delete(
            f"{BASE_URL}/api/users/avatar",
            headers=self.user_headers
        )
        assert response.status_code == 200, f"Delete avatar failed: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"PASS: DELETE /api/users/avatar - {data['message']}")
    
    def test_avatar_requires_auth(self):
        """Test that avatar endpoints require authentication"""
        response = requests.post(f"{BASE_URL}/api/users/avatar")
        assert response.status_code in [401, 403, 422], "Should require authentication"
        print("PASS: Avatar endpoints require authentication")


class TestOrderStatisticsAPI:
    """Test order statistics endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token"""
        # Try to register test user (may already exist)
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "name": "Phase4 Test User"
        })
        
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Test user login failed: {response.text}"
        self.user_token = response.json()["token"]
        self.user_headers = {
            "Authorization": f"Bearer {self.user_token}",
            "Content-Type": "application/json"
        }
    
    def test_get_order_stats(self):
        """Test GET /api/orders/stats - returns order statistics"""
        response = requests.get(
            f"{BASE_URL}/api/orders/stats",
            headers=self.user_headers
        )
        assert response.status_code == 200, f"Get order stats failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_orders" in data, "Should have total_orders"
        assert "total_spent" in data, "Should have total_spent"
        assert "avg_order_value" in data, "Should have avg_order_value"
        assert "total_items" in data, "Should have total_items"
        assert "by_status" in data, "Should have by_status"
        assert "by_month" in data, "Should have by_month"
        
        # Verify data types
        assert isinstance(data["total_orders"], int), "total_orders should be int"
        assert isinstance(data["total_spent"], (int, float)), "total_spent should be numeric"
        assert isinstance(data["avg_order_value"], (int, float)), "avg_order_value should be numeric"
        assert isinstance(data["by_status"], dict), "by_status should be dict"
        assert isinstance(data["by_month"], list), "by_month should be list"
        
        print(f"PASS: GET /api/orders/stats - total_orders: {data['total_orders']}, total_spent: {data['total_spent']}")
    
    def test_order_stats_requires_auth(self):
        """Test that order stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/orders/stats")
        assert response.status_code in [401, 403], "Should require authentication"
        print("PASS: Order stats requires authentication")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_partners(self):
        """Remove test partners created during testing"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            print("SKIP: Could not login as admin for cleanup")
            return
        
        admin_token = response.json()["token"]
        admin_headers = {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
        
        # Get all partners
        partners_response = requests.get(f"{BASE_URL}/api/partners")
        if partners_response.status_code == 200:
            partners = partners_response.json()
            for partner in partners:
                if partner["name"].startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/admin/partners/{partner['id']}",
                        headers=admin_headers
                    )
                    print(f"Cleaned up test partner: {partner['name']}")
        
        print("PASS: Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
