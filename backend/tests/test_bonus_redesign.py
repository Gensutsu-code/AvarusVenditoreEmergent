"""
Test suite for Bonus Program Redesign and Admin Panel Real-time Updates
Tests:
1. Account page bonus API returns yearly_total and bonus_points
2. Admin panel CRUD operations for products, categories, bonus programs
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://parts-shop-dev.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "testbonus@test.com"
TEST_USER_PASSWORD = "test123"


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
def user_token():
    """Get test user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    assert response.status_code == 200, f"User login failed: {response.text}"
    return response.json()["token"]


class TestBonusProgramsAPI:
    """Test bonus programs API returns required fields for redesigned account page"""
    
    def test_bonus_programs_returns_yearly_total(self, user_token):
        """Verify /api/bonus/programs returns yearly_total field"""
        response = requests.get(
            f"{BASE_URL}/api/bonus/programs",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "programs" in data
        
        if len(data["programs"]) > 0:
            program = data["programs"][0]
            assert "yearly_total" in program, "yearly_total field missing from bonus program"
            assert isinstance(program["yearly_total"], (int, float)), "yearly_total should be numeric"
    
    def test_bonus_programs_returns_bonus_points(self, user_token):
        """Verify /api/bonus/programs returns bonus_points field"""
        response = requests.get(
            f"{BASE_URL}/api/bonus/programs",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data["programs"]) > 0:
            program = data["programs"][0]
            assert "bonus_points" in program, "bonus_points field missing from bonus program"
            assert isinstance(program["bonus_points"], (int, float)), "bonus_points should be numeric"
    
    def test_bonus_programs_returns_yearly_order_count(self, user_token):
        """Verify /api/bonus/programs returns yearly_order_count field"""
        response = requests.get(
            f"{BASE_URL}/api/bonus/programs",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data["programs"]) > 0:
            program = data["programs"][0]
            assert "yearly_order_count" in program, "yearly_order_count field missing"
            assert isinstance(program["yearly_order_count"], int), "yearly_order_count should be integer"
    
    def test_bonus_programs_returns_current_year(self, user_token):
        """Verify /api/bonus/programs returns current_year field"""
        response = requests.get(
            f"{BASE_URL}/api/bonus/programs",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data["programs"]) > 0:
            program = data["programs"][0]
            assert "current_year" in program, "current_year field missing"
            assert program["current_year"] == 2026, "current_year should be 2026"
    
    def test_bonus_programs_returns_levels(self, user_token):
        """Verify /api/bonus/programs returns levels array"""
        response = requests.get(
            f"{BASE_URL}/api/bonus/programs",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data["programs"]) > 0:
            program = data["programs"][0]
            assert "levels" in program, "levels field missing"
            assert isinstance(program["levels"], list), "levels should be a list"
    
    def test_bonus_programs_returns_current_level(self, user_token):
        """Verify /api/bonus/programs returns current_level"""
        response = requests.get(
            f"{BASE_URL}/api/bonus/programs",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data["programs"]) > 0:
            program = data["programs"][0]
            assert "current_level" in program, "current_level field missing"


class TestAdminProductCRUD:
    """Test admin product CRUD operations return proper responses for real-time updates"""
    
    def test_create_product_returns_product_data(self, admin_token):
        """Verify POST /api/products returns created product data"""
        test_product = {
            "name": f"TEST_Product_{uuid.uuid4().hex[:8]}",
            "article": f"TEST-{uuid.uuid4().hex[:8]}",
            "price": 1500,
            "description": "Test product for CRUD testing",
            "manufacturer": "Test Manufacturer",
            "in_stock": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/products",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_product
        )
        assert response.status_code == 200, f"Create product failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Created product should have id"
        assert data["name"] == test_product["name"], "Product name mismatch"
        assert data["price"] == test_product["price"], "Product price mismatch"
        
        # Cleanup
        product_id = data["id"]
        requests.delete(
            f"{BASE_URL}/api/products/{product_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_update_product_returns_updated_data(self, admin_token):
        """Verify PUT /api/products/{id} returns updated product data"""
        # Create a product first
        test_product = {
            "name": f"TEST_Update_{uuid.uuid4().hex[:8]}",
            "article": f"TEST-UPD-{uuid.uuid4().hex[:8]}",
            "price": 2000,
            "description": "Test product for update testing"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/products",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_product
        )
        assert create_response.status_code == 200
        product_id = create_response.json()["id"]
        
        # Update the product
        update_data = {"name": "TEST_Updated_Name", "price": 2500}
        update_response = requests.put(
            f"{BASE_URL}/api/products/{product_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=update_data
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated = update_response.json()
        assert updated["name"] == "TEST_Updated_Name", "Name not updated"
        assert updated["price"] == 2500, "Price not updated"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/products/{product_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_delete_product_returns_success(self, admin_token):
        """Verify DELETE /api/products/{id} returns success message"""
        # Create a product first
        test_product = {
            "name": f"TEST_Delete_{uuid.uuid4().hex[:8]}",
            "article": f"TEST-DEL-{uuid.uuid4().hex[:8]}",
            "price": 1000
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/products",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_product
        )
        assert create_response.status_code == 200
        product_id = create_response.json()["id"]
        
        # Delete the product
        delete_response = requests.delete(
            f"{BASE_URL}/api/products/{product_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        assert "message" in delete_response.json()


class TestAdminBonusProgramCRUD:
    """Test admin bonus program CRUD operations"""
    
    def test_get_admin_bonus_programs(self, admin_token):
        """Verify GET /api/admin/bonus/programs returns programs list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/bonus/programs",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # API returns {"programs": [...]} or plain list
        programs = data.get("programs", data) if isinstance(data, dict) else data
        assert isinstance(programs, list), "Should return list of programs"
    
    def test_create_bonus_program_returns_data(self, admin_token):
        """Verify POST /api/admin/bonus/programs returns created program"""
        test_program = {
            "title": f"TEST_Program_{uuid.uuid4().hex[:8]}",
            "description": "Test bonus program",
            "enabled": True,
            "contribution_type": "order_total",
            "contribution_percent": 5.0,
            "max_amount": 50000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/bonus/programs",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_program
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Created program should have id"
        assert data["title"] == test_program["title"], "Title mismatch"
        
        # Cleanup
        program_id = data["id"]
        requests.delete(
            f"{BASE_URL}/api/admin/bonus/programs/{program_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_update_bonus_program_returns_data(self, admin_token):
        """Verify PUT /api/admin/bonus/programs/{id} returns updated program"""
        # Create a program first
        test_program = {
            "title": f"TEST_Update_Program_{uuid.uuid4().hex[:8]}",
            "description": "Test program for update",
            "enabled": True
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/admin/bonus/programs",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_program
        )
        assert create_response.status_code == 200
        program_id = create_response.json()["id"]
        
        # Update the program
        update_data = {"title": "TEST_Updated_Program_Title", "description": "Updated description"}
        update_response = requests.put(
            f"{BASE_URL}/api/admin/bonus/programs/{program_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=update_data
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated = update_response.json()
        assert updated["title"] == "TEST_Updated_Program_Title", "Title not updated"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/bonus/programs/{program_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_delete_bonus_program_returns_success(self, admin_token):
        """Verify DELETE /api/admin/bonus/programs/{id} returns success"""
        # Create a program first
        test_program = {
            "title": f"TEST_Delete_Program_{uuid.uuid4().hex[:8]}",
            "description": "Test program for deletion",
            "enabled": True
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/admin/bonus/programs",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_program
        )
        assert create_response.status_code == 200
        program_id = create_response.json()["id"]
        
        # Delete the program
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/bonus/programs/{program_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        assert "message" in delete_response.json()


class TestAdminPartnersCRUD:
    """Test admin partners CRUD operations"""
    
    def test_get_partners(self, admin_token):
        """Verify GET /api/partners returns partners list"""
        response = requests.get(f"{BASE_URL}/api/partners")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return list of partners"
    
    def test_create_partner_returns_data(self, admin_token):
        """Verify POST /api/admin/partners returns created partner"""
        test_partner = {
            "name": f"TEST_Partner_{uuid.uuid4().hex[:8]}",
            "description": "Test partner brand",
            "image_url": "",
            "link": "https://test.com",
            "order": 99
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/partners",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_partner
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Created partner should have id"
        assert data["name"] == test_partner["name"], "Name mismatch"
        
        # Cleanup
        partner_id = data["id"]
        requests.delete(
            f"{BASE_URL}/api/admin/partners/{partner_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_update_partner_returns_data(self, admin_token):
        """Verify PUT /api/admin/partners/{id} returns updated partner"""
        # Create a partner first
        test_partner = {
            "name": f"TEST_Update_Partner_{uuid.uuid4().hex[:8]}",
            "description": "Test partner for update",
            "order": 99
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/admin/partners",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_partner
        )
        assert create_response.status_code == 200
        partner_id = create_response.json()["id"]
        
        # Update the partner
        update_data = {
            "name": "TEST_Updated_Partner_Name",
            "description": "Updated description",
            "order": 98
        }
        update_response = requests.put(
            f"{BASE_URL}/api/admin/partners/{partner_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=update_data
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated = update_response.json()
        assert updated["name"] == "TEST_Updated_Partner_Name", "Name not updated"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/partners/{partner_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_delete_partner_returns_success(self, admin_token):
        """Verify DELETE /api/admin/partners/{id} returns success"""
        # Create a partner first
        test_partner = {
            "name": f"TEST_Delete_Partner_{uuid.uuid4().hex[:8]}",
            "description": "Test partner for deletion",
            "order": 99
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/admin/partners",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_partner
        )
        assert create_response.status_code == 200
        partner_id = create_response.json()["id"]
        
        # Delete the partner
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/partners/{partner_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        assert "message" in delete_response.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
