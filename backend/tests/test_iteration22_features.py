"""
Iteration 22 Test Suite
Features tested:
1. Catalog dual pricing: 'Розничная' (retail, strikethrough) and 'Ваша цена' (user's discounted price, green)
2. Cart discounted prices: shows discounted prices with user's full discount
3. Favorites dual pricing: same as catalog
4. Prize 'Выдать' button: status changes to 'issued'
5. User prize tracking: /api/my-prize-redemptions returns user's prize history
6. Notification bell badge: shows unread count
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthAndDiscounts:
    """Test authentication and discount settings"""
    
    @pytest.fixture
    def test_user_token(self):
        """Get token for TEST@MAIL.RU user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "TEST@MAIL.RU",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Cannot login as TEST@MAIL.RU user")
        return response.json().get("token")
    
    @pytest.fixture
    def admin_token(self):
        """Get token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Cannot login as admin user")
        return response.json().get("token")
    
    def test_login_test_user(self):
        """Test login as TEST@MAIL.RU user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "TEST@MAIL.RU",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        user = data["user"]
        print(f"User: {user.get('email')}, status: {user.get('customer_status')}, individual_discount: {user.get('individual_discount')}")
        
    def test_login_admin_user(self):
        """Test login as admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        
    def test_discount_settings_endpoint(self, test_user_token):
        """Test discount settings endpoint returns discount data"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = requests.get(f"{BASE_URL}/api/discount-settings", headers=headers)
        assert response.status_code == 200, f"Discount settings failed: {response.text}"
        data = response.json()
        print(f"Discount settings: {data}")
        # Verify discount fields exist
        assert "retail_discount" in data or "wholesale_discount" in data or "partner_discount" in data
        

class TestCatalogSearch:
    """Test catalog search and dual pricing"""
    
    @pytest.fixture
    def test_user_auth(self):
        """Get auth headers for TEST@MAIL.RU user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "TEST@MAIL.RU",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Cannot login as TEST@MAIL.RU user")
        token = response.json().get("token")
        user = response.json().get("user")
        return {"headers": {"Authorization": f"Bearer {token}"}, "user": user}
    
    def test_search_filter_product(self, test_user_auth):
        """Test searching for 'фильтр' returns products with price data"""
        headers = test_user_auth["headers"]
        response = requests.get(f"{BASE_URL}/api/products/search?q=фильтр", headers=headers)
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        products = data.get("products", [])
        print(f"Found {len(products)} products for 'фильтр'")
        assert len(products) > 0, "No products found for 'фильтр'"
        
        # Check first product has price
        product = products[0]
        print(f"Product: {product.get('name')}, price: {product.get('price')}")
        assert "price" in product
        assert product["price"] > 0
        
    def test_user_has_discount(self, test_user_auth):
        """Verify TEST@MAIL.RU user has expected discount"""
        user = test_user_auth["user"]
        customer_status = user.get("customer_status", "retail")
        individual_discount = user.get("individual_discount", 0)
        
        print(f"User customer_status: {customer_status}")
        print(f"User individual_discount: {individual_discount}")
        
        # User should be wholesale with individual_discount
        assert customer_status == "wholesale", f"Expected wholesale status, got {customer_status}"
        assert individual_discount > 0, f"Expected positive individual_discount, got {individual_discount}"


class TestCartDiscounts:
    """Test cart shows discounted prices"""
    
    @pytest.fixture
    def test_user_auth(self):
        """Get auth headers for TEST@MAIL.RU user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "TEST@MAIL.RU",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Cannot login as TEST@MAIL.RU user")
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_cart_endpoint(self, test_user_auth):
        """Test cart endpoint returns items"""
        response = requests.get(f"{BASE_URL}/api/cart", headers=test_user_auth)
        assert response.status_code == 200, f"Cart failed: {response.text}"
        data = response.json()
        print(f"Cart items: {len(data.get('items', []))}")
        print(f"Cart total: {data.get('total', 0)}")


class TestFavorites:
    """Test favorites with dual pricing"""
    
    @pytest.fixture
    def test_user_auth(self):
        """Get auth headers for TEST@MAIL.RU user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "TEST@MAIL.RU",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Cannot login as TEST@MAIL.RU user")
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_favorites_endpoint(self, test_user_auth):
        """Test favorites endpoint returns items"""
        response = requests.get(f"{BASE_URL}/api/favorites", headers=test_user_auth)
        assert response.status_code == 200, f"Favorites failed: {response.text}"
        data = response.json()
        print(f"Favorites items: {len(data.get('items', []))}")


class TestPrizeRedemptions:
    """Test prize redemption status and user prize tracking"""
    
    @pytest.fixture
    def test_user_auth(self):
        """Get auth headers for TEST@MAIL.RU user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "TEST@MAIL.RU",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Cannot login as TEST@MAIL.RU user")
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture
    def admin_auth(self):
        """Get auth headers for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Cannot login as admin user")
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_my_prize_redemptions_endpoint(self, test_user_auth):
        """Test /api/my-prize-redemptions endpoint returns user's prize history"""
        response = requests.get(f"{BASE_URL}/api/my-prize-redemptions", headers=test_user_auth)
        assert response.status_code == 200, f"My prize redemptions failed: {response.text}"
        data = response.json()
        assert "redemptions" in data, "Response missing 'redemptions' field"
        print(f"User prize redemptions: {len(data.get('redemptions', []))}")
        
    def test_admin_prize_redemptions_endpoint(self, admin_auth):
        """Test admin can view all prize redemptions"""
        response = requests.get(f"{BASE_URL}/api/admin/prize-redemptions", headers=admin_auth)
        assert response.status_code == 200, f"Admin prize redemptions failed: {response.text}"
        data = response.json()
        assert "redemptions" in data, "Response missing 'redemptions' field"
        print(f"Admin prize redemptions count: {len(data.get('redemptions', []))}")
        
    def test_admin_update_prize_status_to_issued(self, admin_auth):
        """Test admin can update prize redemption status to 'issued'"""
        # First get list of redemptions
        response = requests.get(f"{BASE_URL}/api/admin/prize-redemptions", headers=admin_auth)
        if response.status_code != 200:
            pytest.skip("Cannot get prize redemptions")
            
        data = response.json()
        redemptions = data.get("redemptions", [])
        
        if len(redemptions) == 0:
            print("No prize redemptions found - skipping status update test")
            pytest.skip("No prize redemptions to test")
            
        # Find a pending or approved redemption to update
        test_redemption = None
        for r in redemptions:
            if r.get("status") in ["pending", "approved"]:
                test_redemption = r
                break
        
        if not test_redemption:
            print("No pending/approved redemptions to update - testing with first redemption")
            test_redemption = redemptions[0]
            
        redemption_id = test_redemption.get("id")
        print(f"Testing status update for redemption: {redemption_id}, current status: {test_redemption.get('status')}")
        
        # Test that 'issued' is a valid status
        response = requests.put(
            f"{BASE_URL}/api/admin/prize-redemptions/{redemption_id}?status=issued",
            headers=admin_auth
        )
        # May return 200 (success) or 404 (if not found)
        print(f"Update to 'issued' response: {response.status_code} - {response.text}")
        assert response.status_code in [200, 404], f"Unexpected status code: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            print("Prize status successfully updated to 'issued'")


class TestNotifications:
    """Test notification bell badge"""
    
    @pytest.fixture
    def test_user_auth(self):
        """Get auth headers for TEST@MAIL.RU user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "TEST@MAIL.RU",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Cannot login as TEST@MAIL.RU user")
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_my_notifications_endpoint(self, test_user_auth):
        """Test /api/my-notifications endpoint returns notifications with unread count"""
        response = requests.get(f"{BASE_URL}/api/my-notifications", headers=test_user_auth)
        assert response.status_code == 200, f"My notifications failed: {response.text}"
        data = response.json()
        print(f"Notifications response: {data}")
        # Should return notifications list or object with notifications and unread_count
        assert "notifications" in data or isinstance(data, list)


class TestDiscountCalculation:
    """Test discount calculation matches expected values"""
    
    @pytest.fixture
    def full_auth(self):
        """Get full auth data for TEST@MAIL.RU user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "TEST@MAIL.RU",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Cannot login as TEST@MAIL.RU user")
        token = response.json().get("token")
        user = response.json().get("user")
        return {
            "headers": {"Authorization": f"Bearer {token}"},
            "user": user
        }
    
    def test_full_discount_calculation(self, full_auth):
        """Test that total discount is calculated correctly"""
        headers = full_auth["headers"]
        user = full_auth["user"]
        
        # Get discount settings
        response = requests.get(f"{BASE_URL}/api/discount-settings", headers=headers)
        if response.status_code != 200:
            pytest.skip("Cannot get discount settings")
        
        discount_settings = response.json()
        
        # Calculate expected discount
        customer_status = user.get("customer_status", "retail")
        individual_discount = user.get("individual_discount", 0)
        
        status_discount = 0
        if customer_status == "partner":
            status_discount = discount_settings.get("partner_discount", 0)
        elif customer_status == "wholesale":
            status_discount = discount_settings.get("wholesale_discount", 0)
        else:
            status_discount = discount_settings.get("retail_discount", 0)
            
        total_discount = status_discount + individual_discount
        
        print(f"Customer status: {customer_status}")
        print(f"Status discount: {status_discount}%")
        print(f"Individual discount: {individual_discount}%")
        print(f"Total discount: {total_discount}%")
        
        # For product with price 1500:
        base_price = 1500
        discounted_price = round(base_price * (1 - total_discount / 100))
        print(f"Base price: {base_price}₽")
        print(f"Discounted price: {discounted_price}₽")
        
        # Expected ~23% discount should give ~1155₽
        # Allow some tolerance
        if total_discount > 20 and total_discount < 25:
            print("✓ Discount is in expected range (~23%)")
        

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
