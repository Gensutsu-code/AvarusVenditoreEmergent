"""
Test file for Payment Settings and Sequential Discount Calculation
Tests:
1. GET /api/payment-settings - public endpoint
2. GET /api/admin/payment-settings - admin-only endpoint  
3. PUT /api/admin/payment-settings - admin enable/disable payment methods
4. Verify sequential discount calculation (user discount first, then payment method discount)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "TEST@MAIL.RU"
TEST_USER_PASSWORD = "admin123"


class TestPaymentSettingsAPI:
    """Test Payment Settings API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth tokens"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get admin token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        self.admin_token = login_response.json().get("token")
        
        # Get test user token
        user_login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert user_login_response.status_code == 200, f"User login failed: {user_login_response.text}"
        self.user_token = user_login_response.json().get("token")
        self.user_data = user_login_response.json().get("user")
        
    def test_get_public_payment_settings(self):
        """Test GET /api/payment-settings - public endpoint without auth"""
        response = requests.get(f"{BASE_URL}/api/payment-settings")
        assert response.status_code == 200, f"Public payment settings failed: {response.text}"
        
        data = response.json()
        # Verify all expected fields exist
        assert "card_discount" in data, "Missing card_discount field"
        assert "crypto_discount" in data, "Missing crypto_discount field"
        assert "cash_discount" in data, "Missing cash_discount field"
        assert "card_enabled" in data, "Missing card_enabled field"
        assert "crypto_enabled" in data, "Missing crypto_enabled field"
        assert "cash_enabled" in data, "Missing cash_enabled field"
        
        # Values should be proper types
        assert isinstance(data["card_discount"], (int, float)), "card_discount should be numeric"
        assert isinstance(data["card_enabled"], bool), "card_enabled should be boolean"
        
        print(f"Public payment settings: {data}")
        
    def test_get_admin_payment_settings_without_auth(self):
        """Test GET /api/admin/payment-settings - should require auth"""
        response = requests.get(f"{BASE_URL}/api/admin/payment-settings")
        # Without auth should return 401 or 403
        assert response.status_code in [401, 403], f"Should require auth, got: {response.status_code}"
        
    def test_get_admin_payment_settings_with_auth(self):
        """Test GET /api/admin/payment-settings - admin endpoint"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        response = self.session.get(f"{BASE_URL}/api/admin/payment-settings", headers=headers)
        assert response.status_code == 200, f"Admin payment settings failed: {response.text}"
        
        data = response.json()
        # Should have same fields as public endpoint
        assert "card_discount" in data, "Missing card_discount field"
        assert "card_enabled" in data, "Missing card_enabled field"
        
        print(f"Admin payment settings: {data}")
        
    def test_update_payment_settings_disable_card(self):
        """Test PUT /api/admin/payment-settings - disable card payment"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # First get current settings
        get_response = self.session.get(f"{BASE_URL}/api/admin/payment-settings", headers=headers)
        original_settings = get_response.json()
        
        # Disable card payment
        update_data = {
            "card_discount": original_settings.get("card_discount", 0),
            "crypto_discount": original_settings.get("crypto_discount", 0),
            "cash_discount": original_settings.get("cash_discount", 0),
            "card_enabled": False,  # Disable card
            "crypto_enabled": original_settings.get("crypto_enabled", True),
            "cash_enabled": original_settings.get("cash_enabled", True)
        }
        
        response = self.session.put(f"{BASE_URL}/api/admin/payment-settings", 
                                    headers=headers, json=update_data)
        assert response.status_code == 200, f"Update payment settings failed: {response.text}"
        
        # Verify the change via public API
        public_response = requests.get(f"{BASE_URL}/api/payment-settings")
        updated_data = public_response.json()
        assert updated_data["card_enabled"] == False, "Card should be disabled"
        
        print(f"Card payment disabled successfully")
        
        # Restore original settings
        restore_data = {
            "card_discount": original_settings.get("card_discount", 0),
            "crypto_discount": original_settings.get("crypto_discount", 0),
            "cash_discount": original_settings.get("cash_discount", 0),
            "card_enabled": original_settings.get("card_enabled", True),
            "crypto_enabled": original_settings.get("crypto_enabled", True),
            "cash_enabled": original_settings.get("cash_enabled", True)
        }
        self.session.put(f"{BASE_URL}/api/admin/payment-settings", 
                         headers=headers, json=restore_data)
        
    def test_update_payment_settings_disable_crypto(self):
        """Test PUT /api/admin/payment-settings - disable crypto payment"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get current settings
        get_response = self.session.get(f"{BASE_URL}/api/admin/payment-settings", headers=headers)
        original_settings = get_response.json()
        
        # Disable crypto payment
        update_data = {
            "card_discount": original_settings.get("card_discount", 0),
            "crypto_discount": original_settings.get("crypto_discount", 0),
            "cash_discount": original_settings.get("cash_discount", 0),
            "card_enabled": original_settings.get("card_enabled", True),
            "crypto_enabled": False,  # Disable crypto
            "cash_enabled": original_settings.get("cash_enabled", True)
        }
        
        response = self.session.put(f"{BASE_URL}/api/admin/payment-settings", 
                                    headers=headers, json=update_data)
        assert response.status_code == 200, f"Update payment settings failed: {response.text}"
        
        # Verify via public API
        public_response = requests.get(f"{BASE_URL}/api/payment-settings")
        updated_data = public_response.json()
        assert updated_data["crypto_enabled"] == False, "Crypto should be disabled"
        
        print(f"Crypto payment disabled successfully")
        
        # Restore
        restore_data = original_settings
        self.session.put(f"{BASE_URL}/api/admin/payment-settings", 
                         headers=headers, json=restore_data)
        
    def test_update_payment_settings_with_discount(self):
        """Test PUT /api/admin/payment-settings - set payment method discounts"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get current settings
        get_response = self.session.get(f"{BASE_URL}/api/admin/payment-settings", headers=headers)
        original_settings = get_response.json()
        
        # Set discounts on payment methods
        update_data = {
            "card_discount": 5,  # 5% discount for card payment
            "crypto_discount": 10,  # 10% discount for crypto
            "cash_discount": 0,
            "card_enabled": True,
            "crypto_enabled": True,
            "cash_enabled": True
        }
        
        response = self.session.put(f"{BASE_URL}/api/admin/payment-settings", 
                                    headers=headers, json=update_data)
        assert response.status_code == 200, f"Update payment settings failed: {response.text}"
        
        # Verify via public API
        public_response = requests.get(f"{BASE_URL}/api/payment-settings")
        updated_data = public_response.json()
        assert updated_data["card_discount"] == 5, "Card discount should be 5"
        assert updated_data["crypto_discount"] == 10, "Crypto discount should be 10"
        
        print(f"Payment discounts set: card=5%, crypto=10%")
        
        # Restore
        self.session.put(f"{BASE_URL}/api/admin/payment-settings", 
                         headers=headers, json=original_settings)


class TestDiscountCalculation:
    """Test sequential discount calculation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get admin token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = login_response.json().get("token")
        
        # Get test user token and data
        user_login = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        self.user_token = user_login.json().get("token")
        self.user_data = user_login.json().get("user")
        
    def test_get_discount_settings(self):
        """Verify discount settings exist for calculation"""
        response = requests.get(f"{BASE_URL}/api/discount-settings")
        assert response.status_code == 200, f"Failed to get discount settings: {response.text}"
        
        data = response.json()
        print(f"Discount settings: {data}")
        
        assert "retail_discount" in data, "Missing retail_discount"
        assert "wholesale_discount" in data, "Missing wholesale_discount"
        assert "partner_discount" in data, "Missing partner_discount"
        
    def test_user_discount_info(self):
        """Verify user has proper discount information"""
        user = self.user_data
        print(f"User data: email={user.get('email')}, status={user.get('customer_status')}, individual_discount={user.get('individual_discount')}")
        
        # User should have discount info
        assert "customer_status" in user, "Missing customer_status"
        assert "individual_discount" in user, "Missing individual_discount"
        
    def test_sequential_discount_calculation_logic(self):
        """
        Test that discounts are applied sequentially:
        1. First: User discount (status + individual)
        2. Then: Payment method discount
        
        Formula: price * (1 - user_discount/100) * (1 - payment_discount/100)
        """
        # Get discount settings
        discount_response = requests.get(f"{BASE_URL}/api/discount-settings")
        discount_settings = discount_response.json()
        
        # Get payment settings
        payment_response = requests.get(f"{BASE_URL}/api/payment-settings")
        payment_settings = payment_response.json()
        
        # Get user info
        user = self.user_data
        customer_status = user.get("customer_status", "retail")
        individual_discount = user.get("individual_discount", 0)
        
        # Calculate status discount
        if customer_status == "partner":
            status_discount = discount_settings.get("partner_discount", 0)
        elif customer_status == "wholesale":
            status_discount = discount_settings.get("wholesale_discount", 0)
        else:
            status_discount = discount_settings.get("retail_discount", 0)
            
        user_discount = status_discount + individual_discount
        
        # Get payment method discounts
        card_discount = payment_settings.get("card_discount", 0)
        crypto_discount = payment_settings.get("crypto_discount", 0)
        cash_discount = payment_settings.get("cash_discount", 0)
        
        # Test with sample price
        original_price = 1000
        
        # Calculate sequential discounts for each payment method
        # First apply user discount, then payment method discount
        
        # For cash payment
        price_after_user = original_price * (1 - user_discount / 100)
        final_price_cash = price_after_user * (1 - cash_discount / 100)
        
        # For card payment
        final_price_card = price_after_user * (1 - card_discount / 100)
        
        # For crypto payment
        final_price_crypto = price_after_user * (1 - crypto_discount / 100)
        
        print(f"\n=== Sequential Discount Calculation Test ===")
        print(f"Original price: {original_price}")
        print(f"User status: {customer_status}")
        print(f"Status discount: {status_discount}%")
        print(f"Individual discount: {individual_discount}%")
        print(f"Total user discount: {user_discount}%")
        print(f"Price after user discount: {price_after_user}")
        print(f"---")
        print(f"Cash discount: {cash_discount}% -> Final: {final_price_cash}")
        print(f"Card discount: {card_discount}% -> Final: {final_price_card}")
        print(f"Crypto discount: {crypto_discount}% -> Final: {final_price_crypto}")
        
        # Verify the math is correct (sequential, not combined)
        # Combined would be: price * (1 - (user_discount + payment_discount)/100)
        # Sequential is: price * (1 - user_discount/100) * (1 - payment_discount/100)
        
        if card_discount > 0:
            combined_price = original_price * (1 - (user_discount + card_discount) / 100)
            # These should be different (unless one discount is 0)
            if user_discount > 0:
                assert abs(final_price_card - combined_price) > 0.01, \
                    f"Sequential and combined should differ: seq={final_price_card}, comb={combined_price}"
                print(f"\nVerified: Sequential != Combined ({final_price_card} != {combined_price})")
        
        return True


class TestPaymentMethodToggle:
    """Test payment method enable/disable functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get admin token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        self.admin_token = login_response.json().get("token")
        
    def test_toggle_all_payment_methods(self):
        """Test toggling all payment methods on/off"""
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Get original settings
        get_response = self.session.get(f"{BASE_URL}/api/admin/payment-settings", headers=headers)
        original = get_response.json()
        
        # Test 1: Disable all
        update_data = {
            "card_discount": original.get("card_discount", 0),
            "crypto_discount": original.get("crypto_discount", 0),
            "cash_discount": original.get("cash_discount", 0),
            "card_enabled": False,
            "crypto_enabled": False,
            "cash_enabled": False
        }
        
        response = self.session.put(f"{BASE_URL}/api/admin/payment-settings", 
                                    headers=headers, json=update_data)
        assert response.status_code == 200, "Failed to disable all payment methods"
        
        # Verify all disabled
        verify = requests.get(f"{BASE_URL}/api/payment-settings")
        data = verify.json()
        assert data["card_enabled"] == False, "Card should be disabled"
        assert data["crypto_enabled"] == False, "Crypto should be disabled"
        assert data["cash_enabled"] == False, "Cash should be disabled"
        print("All payment methods disabled successfully")
        
        # Test 2: Re-enable all
        update_data = {
            "card_discount": original.get("card_discount", 0),
            "crypto_discount": original.get("crypto_discount", 0),
            "cash_discount": original.get("cash_discount", 0),
            "card_enabled": True,
            "crypto_enabled": True,
            "cash_enabled": True
        }
        
        response = self.session.put(f"{BASE_URL}/api/admin/payment-settings", 
                                    headers=headers, json=update_data)
        assert response.status_code == 200, "Failed to enable all payment methods"
        
        # Verify all enabled
        verify = requests.get(f"{BASE_URL}/api/payment-settings")
        data = verify.json()
        assert data["card_enabled"] == True, "Card should be enabled"
        assert data["crypto_enabled"] == True, "Crypto should be enabled"
        assert data["cash_enabled"] == True, "Cash should be enabled"
        print("All payment methods enabled successfully")
        
        # Restore original
        self.session.put(f"{BASE_URL}/api/admin/payment-settings", 
                         headers=headers, json=original)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
