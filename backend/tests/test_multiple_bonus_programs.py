"""
Test suite for Multiple Bonus Programs Feature
Tests the ability to create and manage multiple independent bonus programs:
- Admin CRUD operations for bonus programs
- User progress tracking per program
- Bonus request and issuance per program
- Bonus history with program title
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "testuser@test.com"
TEST_USER_PASSWORD = "password123"


class TestMultipleBonusPrograms:
    """Test multiple bonus programs feature"""
    
    admin_token = None
    user_token = None
    test_user_id = None
    created_program_ids = []
    
    @classmethod
    def setup_class(cls):
        """Setup: Login as admin and test user"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        cls.admin_token = response.json()["token"]
        print(f"✓ Admin login successful")
        
        # Login as test user
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            cls.user_token = response.json()["token"]
            cls.test_user_id = response.json()["user"]["id"]
            print(f"✓ Test user login successful: {TEST_USER_EMAIL}")
        else:
            # Create test user
            response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD,
                "name": "Test User"
            })
            assert response.status_code == 200, f"Failed to create test user: {response.text}"
            cls.user_token = response.json()["token"]
            cls.test_user_id = response.json()["user"]["id"]
            print(f"✓ Test user created: {TEST_USER_EMAIL}")
    
    @classmethod
    def teardown_class(cls):
        """Cleanup: Delete test programs"""
        headers = {"Authorization": f"Bearer {cls.admin_token}"}
        for program_id in cls.created_program_ids:
            try:
                requests.delete(f"{BASE_URL}/api/admin/bonus/programs/{program_id}", headers=headers)
            except:
                pass
    
    # ==================== ADMIN CRUD TESTS ====================
    
    def test_01_admin_can_get_programs_list(self):
        """Test GET /api/admin/bonus/programs - admin sees list of programs"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/bonus/programs", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "programs" in data, "Missing 'programs' field"
        assert isinstance(data["programs"], list), "programs should be a list"
        
        print(f"✓ Admin sees {len(data['programs'])} bonus programs")
    
    def test_02_admin_can_create_new_program(self):
        """Test POST /api/admin/bonus/programs - admin creates new program"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        program_data = {
            "title": f"TEST_Program_{uuid.uuid4().hex[:8]}",
            "description": "Test bonus program description",
            "image_url": "",
            "max_amount": 100000,
            "min_threshold": 10000,
            "contribution_type": "order_total",
            "contribution_percent": 100,
            "enabled": True
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/bonus/programs", 
                                headers=headers, json=program_data)
        
        assert response.status_code == 200, f"Failed to create program: {response.text}"
        data = response.json()
        
        assert "id" in data, "Missing 'id' in response"
        assert data["title"] == program_data["title"], "Title mismatch"
        assert data["max_amount"] == program_data["max_amount"], "max_amount mismatch"
        assert data["min_threshold"] == program_data["min_threshold"], "min_threshold mismatch"
        
        self.created_program_ids.append(data["id"])
        print(f"✓ Admin created program: {data['title']} (ID: {data['id'][:8]}...)")
    
    def test_03_admin_can_create_percentage_program(self):
        """Test creating program with percentage contribution type"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        program_data = {
            "title": f"TEST_Percentage_Program_{uuid.uuid4().hex[:8]}",
            "description": "Program with 10% contribution",
            "image_url": "",
            "max_amount": 50000,
            "min_threshold": 5000,
            "contribution_type": "percentage",
            "contribution_percent": 10,
            "enabled": True
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/bonus/programs", 
                                headers=headers, json=program_data)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["contribution_type"] == "percentage", "contribution_type should be 'percentage'"
        assert data["contribution_percent"] == 10, "contribution_percent should be 10"
        
        self.created_program_ids.append(data["id"])
        print(f"✓ Admin created percentage program: {data['title']}")
    
    def test_04_admin_can_edit_program(self):
        """Test PUT /api/admin/bonus/programs/{id} - admin edits program"""
        if not self.created_program_ids:
            pytest.skip("No programs created to edit")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        program_id = self.created_program_ids[0]
        
        updated_data = {
            "title": f"UPDATED_Program_{uuid.uuid4().hex[:8]}",
            "description": "Updated description",
            "image_url": "",
            "max_amount": 200000,
            "min_threshold": 20000,
            "contribution_type": "order_total",
            "contribution_percent": 100,
            "enabled": True
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/bonus/programs/{program_id}", 
                               headers=headers, json=updated_data)
        
        assert response.status_code == 200, f"Failed to update: {response.text}"
        data = response.json()
        
        assert data["title"] == updated_data["title"], "Title not updated"
        assert data["max_amount"] == updated_data["max_amount"], "max_amount not updated"
        
        print(f"✓ Admin updated program: {data['title']}")
    
    def test_05_admin_can_delete_program(self):
        """Test DELETE /api/admin/bonus/programs/{id} - admin deletes program"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Create a program to delete
        program_data = {
            "title": f"TEST_ToDelete_{uuid.uuid4().hex[:8]}",
            "description": "Will be deleted",
            "image_url": "",
            "max_amount": 10000,
            "min_threshold": 1000,
            "contribution_type": "order_total",
            "contribution_percent": 100,
            "enabled": True
        }
        
        create_response = requests.post(f"{BASE_URL}/api/admin/bonus/programs", 
                                       headers=headers, json=program_data)
        assert create_response.status_code == 200
        program_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/admin/bonus/programs/{program_id}", 
                                         headers=headers)
        
        assert delete_response.status_code == 200, f"Failed to delete: {delete_response.text}"
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/admin/bonus/programs", headers=headers)
        programs = get_response.json()["programs"]
        program_ids = [p["id"] for p in programs]
        assert program_id not in program_ids, "Program should be deleted"
        
        print(f"✓ Admin deleted program successfully")
    
    # ==================== ADMIN USER PROGRESS VIEW ====================
    
    def test_06_admin_can_expand_program_to_see_users(self):
        """Test GET /api/admin/bonus/programs/{id}/users - admin sees users progress"""
        if not self.created_program_ids:
            pytest.skip("No programs created")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        program_id = self.created_program_ids[0]
        
        response = requests.get(f"{BASE_URL}/api/admin/bonus/programs/{program_id}/users", 
                               headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "users" in data, "Missing 'users' field"
        assert "program" in data, "Missing 'program' field"
        assert "pending_requests" in data, "Missing 'pending_requests' field"
        
        # Verify user structure
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "id" in user, "Missing 'id' in user"
            assert "name" in user, "Missing 'name' in user"
            assert "email" in user, "Missing 'email' in user"
            assert "current_amount" in user, "Missing 'current_amount' in user"
            assert "percentage" in user, "Missing 'percentage' in user"
            assert "bonus_requested" in user, "Missing 'bonus_requested' in user"
        
        print(f"✓ Admin sees {len(data['users'])} users for program, {data['pending_requests']} pending requests")
    
    def test_07_admin_can_issue_bonus_for_specific_program(self):
        """Test POST /api/admin/bonus/programs/{id}/issue/{user_id} - admin issues bonus"""
        if not self.created_program_ids:
            pytest.skip("No programs created")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        program_id = self.created_program_ids[0]
        
        promo_code = f"TESTPROMO-{uuid.uuid4().hex[:8].upper()}"
        
        response = requests.post(
            f"{BASE_URL}/api/admin/bonus/programs/{program_id}/issue/{self.test_user_id}?bonus_code={promo_code}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Failed to issue bonus: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Should return success"
        assert data.get("bonus_code") == promo_code, "Should return the promo code"
        
        print(f"✓ Admin issued bonus with code: {promo_code}")
    
    def test_08_admin_issue_requires_promo_code(self):
        """Test that issuing bonus requires promo code"""
        if not self.created_program_ids:
            pytest.skip("No programs created")
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        program_id = self.created_program_ids[0]
        
        # Try without promo code
        response = requests.post(
            f"{BASE_URL}/api/admin/bonus/programs/{program_id}/issue/{self.test_user_id}",
            headers=headers
        )
        
        assert response.status_code == 400, f"Should fail without promo code, got {response.status_code}"
        
        print(f"✓ Issue bonus correctly requires promo code")
    
    # ==================== USER VIEW TESTS ====================
    
    def test_09_user_sees_all_active_programs(self):
        """Test GET /api/bonus/programs - user sees all active programs"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        response = requests.get(f"{BASE_URL}/api/bonus/programs", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "programs" in data, "Missing 'programs' field"
        
        # Verify program structure
        if len(data["programs"]) > 0:
            program = data["programs"][0]
            assert "id" in program, "Missing 'id'"
            assert "title" in program, "Missing 'title'"
            assert "description" in program, "Missing 'description'"
            assert "current_amount" in program, "Missing 'current_amount'"
            assert "max_amount" in program, "Missing 'max_amount'"
            assert "percentage" in program, "Missing 'percentage'"
            assert "can_request" in program, "Missing 'can_request'"
            assert "bonus_requested" in program, "Missing 'bonus_requested'"
        
        print(f"✓ User sees {len(data['programs'])} active bonus programs")
    
    def test_10_user_can_request_bonus_from_specific_program(self):
        """Test POST /api/bonus/request/{program_id} - user requests bonus"""
        if not self.created_program_ids:
            pytest.skip("No programs created")
        
        headers = {"Authorization": f"Bearer {self.user_token}"}
        program_id = self.created_program_ids[0]
        
        # First check if user can request (may fail if below threshold)
        response = requests.post(f"{BASE_URL}/api/bonus/request/{program_id}", headers=headers)
        
        # Either succeeds or fails with appropriate error
        if response.status_code == 200:
            print(f"✓ User requested bonus from program")
        elif response.status_code == 400:
            error = response.json().get("detail", "")
            if "порог" in error.lower() or "threshold" in error.lower():
                print(f"✓ Request correctly rejected - below threshold")
            elif "уже" in error.lower() or "already" in error.lower():
                print(f"✓ Request correctly rejected - already requested")
            else:
                print(f"⚠ Request rejected: {error}")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_11_bonus_history_shows_program_title(self):
        """Test GET /api/bonus/history - history shows program title"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        response = requests.get(f"{BASE_URL}/api/bonus/history", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "history" in data, "Missing 'history' field"
        
        # Check if history records have program_title
        if len(data["history"]) > 0:
            record = data["history"][0]
            assert "program_title" in record, "Missing 'program_title' in history record"
            assert "bonus_code" in record, "Missing 'bonus_code' in history record"
            print(f"✓ History shows program title: {record['program_title']}")
        else:
            print(f"⚠ No bonus history yet")
    
    # ==================== ADMIN HISTORY TEST ====================
    
    def test_12_admin_bonus_history_shows_all_programs(self):
        """Test GET /api/admin/bonus/history - admin sees all issued bonuses"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/bonus/history", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "history" in data, "Missing 'history' field"
        
        if len(data["history"]) > 0:
            record = data["history"][0]
            assert "program_id" in record, "Missing 'program_id'"
            assert "program_title" in record, "Missing 'program_title'"
            assert "bonus_code" in record, "Missing 'bonus_code'"
            assert "user_name" in record, "Missing 'user_name'"
            print(f"✓ Admin sees {len(data['history'])} bonus history records")
        else:
            print(f"⚠ No bonus history records yet")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
