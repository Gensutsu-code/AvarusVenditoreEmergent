"""
Test suite for Phase 5: Bonus Program
Tests all bonus-related endpoints:
- User bonus progress and history
- Bonus claiming
- Admin bonus settings management
- Admin user bonus management
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = f"bonustest_{int(time.time())}@test.com"
TEST_USER_PASSWORD = "test123"


class TestBonusProgram:
    """Test bonus program endpoints"""
    
    admin_token = None
    user_token = None
    test_user_id = None
    
    @classmethod
    def setup_class(cls):
        """Setup: Login as admin and create test user"""
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        cls.admin_token = response.json()["token"]
        print(f"✓ Admin login successful")
        
        # Create test user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "name": "Bonus Test User"
        })
        if response.status_code == 200:
            cls.user_token = response.json()["token"]
            cls.test_user_id = response.json()["user"]["id"]
            print(f"✓ Test user created: {TEST_USER_EMAIL}")
        elif response.status_code == 400 and "already registered" in response.text:
            # User exists, login instead
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            assert response.status_code == 200, f"Test user login failed: {response.text}"
            cls.user_token = response.json()["token"]
            cls.test_user_id = response.json()["user"]["id"]
            print(f"✓ Test user logged in: {TEST_USER_EMAIL}")
        else:
            pytest.fail(f"Failed to create/login test user: {response.text}")
    
    # ==================== USER BONUS ENDPOINTS ====================
    
    def test_01_get_bonus_progress(self):
        """Test GET /api/bonus/progress - returns user's current bonus progress"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        response = requests.get(f"{BASE_URL}/api/bonus/progress", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "current_amount" in data, "Missing current_amount"
        assert "goal_amount" in data, "Missing goal_amount"
        assert "percentage" in data, "Missing percentage"
        assert "can_claim" in data, "Missing can_claim"
        assert "total_earned" in data, "Missing total_earned"
        assert "rewards_claimed" in data, "Missing rewards_claimed"
        assert "reward_value" in data, "Missing reward_value"
        assert "contribution_percent" in data, "Missing contribution_percent"
        assert "enabled" in data, "Missing enabled"
        
        # Verify data types
        assert isinstance(data["current_amount"], (int, float))
        assert isinstance(data["goal_amount"], (int, float))
        assert isinstance(data["percentage"], (int, float))
        assert isinstance(data["can_claim"], bool)
        
        print(f"✓ Bonus progress: {data['current_amount']}/{data['goal_amount']} ({data['percentage']}%)")
    
    def test_02_get_bonus_history(self):
        """Test GET /api/bonus/history - returns user's bonus claim history"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        response = requests.get(f"{BASE_URL}/api/bonus/history", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "history" in data, "Missing history field"
        assert isinstance(data["history"], list), "History should be a list"
        
        print(f"✓ Bonus history: {len(data['history'])} records")
    
    def test_03_claim_bonus_insufficient(self):
        """Test POST /api/bonus/claim - should fail when goal not reached"""
        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        # First check current progress
        progress_response = requests.get(f"{BASE_URL}/api/bonus/progress", headers=headers)
        progress = progress_response.json()
        
        if not progress.get("can_claim", False):
            # Try to claim when not eligible
            response = requests.post(f"{BASE_URL}/api/bonus/claim", headers=headers)
            assert response.status_code == 400, f"Should fail with 400, got {response.status_code}"
            print(f"✓ Claim correctly rejected - insufficient amount")
        else:
            print(f"⚠ User can already claim, skipping insufficient test")
    
    # ==================== ADMIN BONUS SETTINGS ====================
    
    def test_04_get_admin_bonus_settings(self):
        """Test GET /api/admin/bonus/settings - returns bonus program settings"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/bonus/settings", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify settings structure
        assert "goal_amount" in data, "Missing goal_amount"
        assert "contribution_percent" in data, "Missing contribution_percent"
        assert "reward_value" in data, "Missing reward_value"
        assert "enabled" in data, "Missing enabled"
        
        print(f"✓ Bonus settings: goal={data['goal_amount']}, percent={data['contribution_percent']}%, reward={data['reward_value']}")
    
    def test_05_update_bonus_settings(self):
        """Test PUT /api/admin/bonus/settings - updates bonus settings"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get current settings first
        current = requests.get(f"{BASE_URL}/api/admin/bonus/settings", headers=headers).json()
        
        # Update settings
        new_settings = {
            "goal_amount": current.get("goal_amount", 5000),
            "contribution_percent": current.get("contribution_percent", 5),
            "reward_value": current.get("reward_value", 500),
            "enabled": True
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/bonus/settings", 
                               headers=headers, json=new_settings)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "message" in data or "goal_amount" in data, "Invalid response"
        print(f"✓ Bonus settings updated successfully")
    
    def test_06_admin_settings_requires_auth(self):
        """Test that admin endpoints require admin role"""
        # No auth
        response = requests.get(f"{BASE_URL}/api/admin/bonus/settings")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        
        # User auth (not admin)
        headers = {"Authorization": f"Bearer {self.user_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/bonus/settings", headers=headers)
        assert response.status_code == 403, f"Should require admin, got {response.status_code}"
        
        print(f"✓ Admin endpoints properly protected")
    
    # ==================== ADMIN USER BONUS MANAGEMENT ====================
    
    def test_07_get_bonus_users(self):
        """Test GET /api/admin/bonus/users - returns all users with bonus progress"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/bonus/users", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "users" in data, "Missing users field"
        assert "settings" in data, "Missing settings field"
        assert isinstance(data["users"], list), "Users should be a list"
        
        # Verify user structure
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "id" in user, "Missing user id"
            assert "name" in user, "Missing user name"
            assert "email" in user, "Missing user email"
            assert "current_amount" in user, "Missing current_amount"
            assert "percentage" in user, "Missing percentage"
        
        print(f"✓ Bonus users: {len(data['users'])} users found")
    
    def test_08_add_bonus_points(self):
        """Test POST /api/admin/bonus/add/{user_id} - manually adds bonus points"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get test user's current progress
        users_response = requests.get(f"{BASE_URL}/api/admin/bonus/users", headers=headers)
        users = users_response.json().get("users", [])
        
        # Find test user or use admin
        target_user = None
        for u in users:
            if u["email"] == TEST_USER_EMAIL:
                target_user = u
                break
        
        if not target_user and len(users) > 0:
            target_user = users[0]
        
        if target_user:
            user_id = target_user["id"]
            initial_amount = target_user["current_amount"]
            
            # Add 100 bonus points
            response = requests.post(f"{BASE_URL}/api/admin/bonus/add/{user_id}?amount=100", 
                                    headers=headers)
            
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            
            assert data.get("success") == True, "Should return success"
            assert "new_amount" in data, "Should return new_amount"
            assert data["new_amount"] >= initial_amount + 100, f"Amount should increase by 100"
            
            print(f"✓ Added 100 bonus points to user {target_user['name']}: {initial_amount} -> {data['new_amount']}")
        else:
            pytest.skip("No users found to test")
    
    def test_09_add_bonus_points_invalid_amount(self):
        """Test POST /api/admin/bonus/add/{user_id} - should fail with invalid amount"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get any user
        users_response = requests.get(f"{BASE_URL}/api/admin/bonus/users", headers=headers)
        users = users_response.json().get("users", [])
        
        if len(users) > 0:
            user_id = users[0]["id"]
            
            # Try to add 0 or negative amount
            response = requests.post(f"{BASE_URL}/api/admin/bonus/add/{user_id}?amount=0", 
                                    headers=headers)
            assert response.status_code == 400, f"Should fail with 0 amount, got {response.status_code}"
            
            response = requests.post(f"{BASE_URL}/api/admin/bonus/add/{user_id}?amount=-100", 
                                    headers=headers)
            assert response.status_code == 400, f"Should fail with negative amount, got {response.status_code}"
            
            print(f"✓ Invalid amounts correctly rejected")
        else:
            pytest.skip("No users found to test")
    
    def test_10_issue_bonus_to_user(self):
        """Test POST /api/admin/bonus/issue/{user_id} - manually issues bonus reward"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get any user
        users_response = requests.get(f"{BASE_URL}/api/admin/bonus/users", headers=headers)
        users = users_response.json().get("users", [])
        
        if len(users) > 0:
            # Find test user or use first user
            target_user = None
            for u in users:
                if u["email"] == TEST_USER_EMAIL:
                    target_user = u
                    break
            if not target_user:
                target_user = users[0]
            
            user_id = target_user["id"]
            
            response = requests.post(f"{BASE_URL}/api/admin/bonus/issue/{user_id}", 
                                    headers=headers)
            
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            
            assert data.get("success") == True, "Should return success"
            assert "promo_code" in data, "Should return promo_code"
            assert data["promo_code"].startswith("GIFT-"), f"Promo code should start with GIFT-"
            
            print(f"✓ Issued bonus to {target_user['name']}: {data['promo_code']}")
        else:
            pytest.skip("No users found to test")
    
    def test_11_get_all_bonus_history(self):
        """Test GET /api/admin/bonus/history - returns all bonus history"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/bonus/history", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "history" in data, "Missing history field"
        assert isinstance(data["history"], list), "History should be a list"
        
        # Verify history record structure if any exist
        if len(data["history"]) > 0:
            record = data["history"][0]
            assert "id" in record, "Missing record id"
            assert "user_id" in record, "Missing user_id"
            assert "promo_code" in record, "Missing promo_code"
            assert "created_at" in record, "Missing created_at"
        
        print(f"✓ Bonus history: {len(data['history'])} records")
    
    # ==================== BONUS CLAIM FLOW ====================
    
    def test_12_full_bonus_claim_flow(self):
        """Test full bonus claim flow: add points until goal, then claim"""
        headers_admin = {"Authorization": f"Bearer {self.admin_token}"}
        headers_user = {"Authorization": f"Bearer {self.user_token}"}
        
        # Get current settings
        settings = requests.get(f"{BASE_URL}/api/admin/bonus/settings", 
                               headers=headers_admin).json()
        goal = settings.get("goal_amount", 5000)
        
        # Get user's current progress
        progress = requests.get(f"{BASE_URL}/api/bonus/progress", 
                               headers=headers_user).json()
        current = progress.get("current_amount", 0)
        
        # Add enough points to reach goal
        if current < goal:
            needed = goal - current + 100  # Add extra to ensure we're over
            response = requests.post(
                f"{BASE_URL}/api/admin/bonus/add/{self.test_user_id}?amount={needed}",
                headers=headers_admin
            )
            assert response.status_code == 200, f"Failed to add points: {response.text}"
            print(f"✓ Added {needed} points to reach goal")
        
        # Verify can_claim is now true
        progress = requests.get(f"{BASE_URL}/api/bonus/progress", 
                               headers=headers_user).json()
        assert progress.get("can_claim") == True, f"Should be able to claim now, progress: {progress}"
        print(f"✓ User can now claim bonus (current: {progress['current_amount']}, goal: {progress['goal_amount']})")
        
        # Claim the bonus
        response = requests.post(f"{BASE_URL}/api/bonus/claim", headers=headers_user)
        assert response.status_code == 200, f"Claim failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Claim should succeed"
        assert "promo_code" in data, "Should return promo_code"
        assert data["promo_code"].startswith("BONUS-"), f"Promo code should start with BONUS-"
        
        print(f"✓ Bonus claimed successfully: {data['promo_code']}")
        
        # Verify progress was reset
        progress = requests.get(f"{BASE_URL}/api/bonus/progress", 
                               headers=headers_user).json()
        assert progress["current_amount"] == 0, f"Progress should be reset to 0, got {progress['current_amount']}"
        
        print(f"✓ Progress reset after claim")
        
        # Verify history was updated
        history = requests.get(f"{BASE_URL}/api/bonus/history", 
                              headers=headers_user).json()
        assert len(history["history"]) > 0, "History should have at least one record"
        
        print(f"✓ History updated with claim record")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
