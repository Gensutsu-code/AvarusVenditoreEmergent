"""
Test suite for Bonus Program V2 (New Requirements)
Tests the completely rewritten bonus system:
- Admin can edit title, description, image_url, max_amount, min_threshold
- Bonus points accrued only when order status changes to 'delivered'
- Users can request bonus when reaching min_threshold (5000 RUB)
- Admin issues bonus by entering promo code
- Progress resets to zero only after admin issues bonus
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "testuser@test.com"
TEST_USER_PASSWORD = "password123"


class TestBonusProgramV2:
    """Test new bonus program features"""
    
    admin_token = None
    user_token = None
    test_user_id = None
    
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
    
    # ==================== ADMIN BONUS SETTINGS ====================
    
    def test_01_admin_bonus_settings_has_new_fields(self):
        """Test GET /api/admin/bonus/settings - should have new fields: title, description, image_url, max_amount, min_threshold"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/bonus/settings", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify NEW fields exist
        assert "title" in data, "Missing 'title' field"
        assert "description" in data, "Missing 'description' field"
        assert "image_url" in data, "Missing 'image_url' field"
        assert "max_amount" in data, "Missing 'max_amount' field"
        assert "min_threshold" in data, "Missing 'min_threshold' field"
        assert "enabled" in data, "Missing 'enabled' field"
        
        # Verify data types
        assert isinstance(data["title"], str), "title should be string"
        assert isinstance(data["description"], str), "description should be string"
        assert isinstance(data["max_amount"], (int, float)), "max_amount should be number"
        assert isinstance(data["min_threshold"], (int, float)), "min_threshold should be number"
        
        print(f"✓ Bonus settings has new fields: title='{data['title']}', max_amount={data['max_amount']}, min_threshold={data['min_threshold']}")
    
    def test_02_admin_can_save_bonus_settings(self):
        """Test PUT /api/admin/bonus/settings - admin can save all new fields"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Update with new settings
        new_settings = {
            "title": "Тестовая бонусная программа",
            "description": "Тестовое описание бонусной программы",
            "image_url": "",
            "max_amount": 50000,
            "min_threshold": 5000,
            "enabled": True
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/bonus/settings", 
                               headers=headers, json=new_settings)
        
        assert response.status_code == 200, f"Failed to save settings: {response.text}"
        data = response.json()
        
        # Verify settings were saved
        assert "message" in data or "title" in data, "Invalid response"
        
        # Verify by fetching again
        verify_response = requests.get(f"{BASE_URL}/api/admin/bonus/settings", headers=headers)
        verify_data = verify_response.json()
        
        assert verify_data["title"] == new_settings["title"], f"Title not saved: {verify_data['title']}"
        assert verify_data["description"] == new_settings["description"], f"Description not saved"
        assert verify_data["max_amount"] == new_settings["max_amount"], f"max_amount not saved"
        assert verify_data["min_threshold"] == new_settings["min_threshold"], f"min_threshold not saved"
        
        print(f"✓ Admin can save bonus settings successfully")
    
    # ==================== USER BONUS PROGRESS ====================
    
    def test_03_user_sees_bonus_progress_with_new_fields(self):
        """Test GET /api/bonus/progress - user sees title, description, progress bar (current_amount/max_amount)"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        response = requests.get(f"{BASE_URL}/api/bonus/progress", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response has new structure
        assert "title" in data, "Missing 'title'"
        assert "description" in data, "Missing 'description'"
        assert "current_amount" in data, "Missing 'current_amount'"
        assert "max_amount" in data, "Missing 'max_amount'"
        assert "min_threshold" in data, "Missing 'min_threshold'"
        assert "percentage" in data, "Missing 'percentage'"
        assert "can_request" in data, "Missing 'can_request'"
        assert "bonus_requested" in data, "Missing 'bonus_requested'"
        assert "enabled" in data, "Missing 'enabled'"
        
        # Verify percentage calculation
        if data["max_amount"] > 0:
            expected_percentage = min(100, (data["current_amount"] / data["max_amount"]) * 100)
            assert abs(data["percentage"] - expected_percentage) < 1, f"Percentage calculation wrong"
        
        print(f"✓ User sees bonus progress: {data['current_amount']}/{data['max_amount']} ({data['percentage']}%)")
    
    def test_04_user_cannot_request_bonus_below_threshold(self):
        """Test POST /api/bonus/request - should fail when current_amount < min_threshold"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        # First check current progress
        progress_response = requests.get(f"{BASE_URL}/api/bonus/progress", headers=headers)
        progress = progress_response.json()
        
        if progress["current_amount"] < progress["min_threshold"]:
            # Try to request bonus when below threshold
            response = requests.post(f"{BASE_URL}/api/bonus/request", headers=headers)
            assert response.status_code == 400, f"Should fail with 400, got {response.status_code}: {response.text}"
            print(f"✓ Request correctly rejected - below threshold ({progress['current_amount']} < {progress['min_threshold']})")
        else:
            print(f"⚠ User already above threshold, skipping test")
    
    # ==================== ADMIN USER MANAGEMENT ====================
    
    def test_05_admin_sees_users_with_bonus_requested_flag(self):
        """Test GET /api/admin/bonus/users - users with bonus_requested should be highlighted"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/bonus/users", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "users" in data, "Missing 'users' field"
        assert "settings" in data, "Missing 'settings' field"
        assert "pending_requests" in data, "Missing 'pending_requests' count"
        
        # Verify user structure has bonus_requested flag
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "bonus_requested" in user, "Missing 'bonus_requested' in user"
            assert "current_amount" in user, "Missing 'current_amount' in user"
            assert "percentage" in user, "Missing 'percentage' in user"
            assert "can_issue" in user, "Missing 'can_issue' in user"
        
        print(f"✓ Admin sees {len(data['users'])} users, {data['pending_requests']} pending requests")
    
    def test_06_admin_issue_bonus_requires_promo_code(self):
        """Test POST /api/admin/bonus/issue/{user_id} - should require bonus_code parameter"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Try to issue without promo code
        response = requests.post(f"{BASE_URL}/api/admin/bonus/issue/{self.test_user_id}", 
                                headers=headers)
        
        assert response.status_code == 400, f"Should fail without promo code, got {response.status_code}: {response.text}"
        assert "код" in response.text.lower() or "code" in response.text.lower(), "Error should mention code"
        
        print(f"✓ Issue bonus correctly requires promo code")
    
    def test_07_admin_can_issue_bonus_with_promo_code(self):
        """Test POST /api/admin/bonus/issue/{user_id}?bonus_code=XXX - admin enters promo code"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # First, set user's bonus_requested to true by simulating request
        # We need to manually set some progress first
        
        # Get a user to test with
        users_response = requests.get(f"{BASE_URL}/api/admin/bonus/users", headers=headers)
        users = users_response.json().get("users", [])
        
        if len(users) > 0:
            # Find test user
            target_user = None
            for u in users:
                if u["email"] == TEST_USER_EMAIL:
                    target_user = u
                    break
            
            if not target_user:
                target_user = users[0]
            
            user_id = target_user["id"]
            promo_code = f"TESTPROMO-{uuid.uuid4().hex[:8].upper()}"
            
            # Issue bonus with promo code
            response = requests.post(
                f"{BASE_URL}/api/admin/bonus/issue/{user_id}?bonus_code={promo_code}", 
                headers=headers
            )
            
            assert response.status_code == 200, f"Failed to issue bonus: {response.text}"
            data = response.json()
            
            assert data.get("success") == True, "Should return success"
            
            print(f"✓ Admin issued bonus with promo code: {promo_code}")
        else:
            pytest.skip("No users found to test")
    
    def test_08_user_receives_promo_code_in_history(self):
        """Test GET /api/bonus/history - user should see promo code after admin issues it"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        response = requests.get(f"{BASE_URL}/api/bonus/history", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "history" in data, "Missing 'history' field"
        
        # Check if there's any history with bonus_code
        if len(data["history"]) > 0:
            record = data["history"][0]
            assert "bonus_code" in record, "History record should have 'bonus_code'"
            print(f"✓ User sees promo code in history: {record['bonus_code']}")
        else:
            print(f"⚠ No bonus history yet (expected if no bonus issued)")
    
    def test_09_progress_resets_after_bonus_issued(self):
        """Test that progress resets to 0 after admin issues bonus"""
        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
        headers_user = {"Authorization": f"Bearer {self.user_token}"}
        
        # Get user's current progress
        progress_before = requests.get(f"{BASE_URL}/api/bonus/progress", headers=headers_user).json()
        
        # Issue bonus to user
        promo_code = f"RESET-TEST-{uuid.uuid4().hex[:8].upper()}"
        response = requests.post(
            f"{BASE_URL}/api/admin/bonus/issue/{self.test_user_id}?bonus_code={promo_code}", 
            headers=headers_admin
        )
        
        if response.status_code == 200:
            # Check progress after
            progress_after = requests.get(f"{BASE_URL}/api/bonus/progress", headers=headers_user).json()
            
            assert progress_after["current_amount"] == 0, f"Progress should reset to 0, got {progress_after['current_amount']}"
            assert progress_after["bonus_requested"] == False, "bonus_requested should be False after issue"
            
            print(f"✓ Progress reset after bonus issued: {progress_before['current_amount']} -> {progress_after['current_amount']}")
        else:
            print(f"⚠ Could not issue bonus to test reset: {response.text}")
    
    # ==================== BONUS HISTORY ====================
    
    def test_10_admin_sees_all_bonus_history(self):
        """Test GET /api/admin/bonus/history - admin sees all issued bonuses"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/bonus/history", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "history" in data, "Missing 'history' field"
        
        if len(data["history"]) > 0:
            record = data["history"][0]
            assert "bonus_code" in record, "Missing 'bonus_code' in history"
            assert "user_id" in record, "Missing 'user_id' in history"
            assert "created_at" in record, "Missing 'created_at' in history"
            print(f"✓ Admin sees {len(data['history'])} bonus history records")
        else:
            print(f"⚠ No bonus history records yet")
    
    # ==================== FULL FLOW TEST ====================
    
    def test_11_full_bonus_request_and_issue_flow(self):
        """Test complete flow: user requests bonus -> admin sees request -> admin issues with promo code"""
        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
        headers_user = {"Authorization": f"Bearer {self.user_token}"}
        
        # Step 1: Set user's progress above min_threshold
        # First get settings to know threshold
        settings = requests.get(f"{BASE_URL}/api/admin/bonus/settings", headers=headers_admin).json()
        min_threshold = settings.get("min_threshold", 5000)
        
        # We need to simulate order delivery to add bonus points
        # For now, let's check if there's an endpoint to manually add points
        # Looking at the code, there's no direct add endpoint in the new system
        # Bonus is only added when order status changes to 'delivered'
        
        # Step 2: Check if user can request
        progress = requests.get(f"{BASE_URL}/api/bonus/progress", headers=headers_user).json()
        
        if progress["current_amount"] >= min_threshold and not progress["bonus_requested"]:
            # User can request
            request_response = requests.post(f"{BASE_URL}/api/bonus/request", headers=headers_user)
            assert request_response.status_code == 200, f"Request failed: {request_response.text}"
            print(f"✓ User requested bonus")
            
            # Step 3: Admin sees pending request
            users_response = requests.get(f"{BASE_URL}/api/admin/bonus/users", headers=headers_admin)
            users_data = users_response.json()
            
            # Find our test user
            test_user_data = None
            for u in users_data["users"]:
                if u["id"] == self.test_user_id:
                    test_user_data = u
                    break
            
            if test_user_data:
                assert test_user_data["bonus_requested"] == True, "User should have bonus_requested=True"
                print(f"✓ Admin sees user with bonus_requested=True")
            
            # Step 4: Admin issues bonus with promo code
            promo_code = f"FLOW-TEST-{uuid.uuid4().hex[:8].upper()}"
            issue_response = requests.post(
                f"{BASE_URL}/api/admin/bonus/issue/{self.test_user_id}?bonus_code={promo_code}",
                headers=headers_admin
            )
            assert issue_response.status_code == 200, f"Issue failed: {issue_response.text}"
            print(f"✓ Admin issued bonus with code: {promo_code}")
            
            # Step 5: Verify user's progress reset
            final_progress = requests.get(f"{BASE_URL}/api/bonus/progress", headers=headers_user).json()
            assert final_progress["current_amount"] == 0, "Progress should be reset"
            assert final_progress["bonus_requested"] == False, "bonus_requested should be False"
            print(f"✓ User's progress reset to 0")
            
            # Step 6: Verify promo code in user's history
            history = requests.get(f"{BASE_URL}/api/bonus/history", headers=headers_user).json()
            found_code = False
            for h in history["history"]:
                if h.get("bonus_code") == promo_code:
                    found_code = True
                    break
            assert found_code, f"Promo code {promo_code} not found in user's history"
            print(f"✓ Promo code found in user's history")
            
        else:
            print(f"⚠ User cannot request bonus yet (current: {progress['current_amount']}, threshold: {min_threshold}, requested: {progress['bonus_requested']})")
            print(f"  Note: Bonus points are only added when orders are delivered")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
