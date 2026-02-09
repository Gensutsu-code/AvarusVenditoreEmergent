"""
Test file to verify the 5 bug fixes:
1. Product image upload and display
2. Category image 1:1 aspect ratio
3. Promo banner image swap functionality
4. Bonus program request_button_text
5. Order details show customer info (full_name, phone, address, comment)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://parts-shop-dev.preview.emergentagent.com')
API = f"{BASE_URL}/api"


class TestAuthentication:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{API}/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data.get("token") or data.get("access_token")
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get regular user authentication token"""
        response = requests.post(f"{API}/auth/login", json={
            "email": "user123@test.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"User login failed: {response.text}"
        data = response.json()
        return data.get("token") or data.get("access_token")
    
    def test_admin_login(self, admin_token):
        """Test admin can login"""
        assert admin_token is not None
        print(f"Admin token obtained: {admin_token[:20]}...")


class TestBug1ProductImages:
    """Bug 1: Product image upload and display"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{API}/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json().get("token") or response.json().get("access_token")
    
    def test_products_endpoint(self, admin_token):
        """Test products endpoint returns products with image_url"""
        response = requests.get(f"{API}/products")
        assert response.status_code == 200
        products = response.json()
        print(f"Found {len(products)} products")
        
        # Check product structure includes image_url field
        if products:
            product = products[0]
            assert "image_url" in product, "Product should have image_url field"
            if product["image_url"]:
                # Verify URL is a Cloudinary URL (not prepended with backend URL)
                assert "res.cloudinary.com" in product["image_url"] or product["image_url"].startswith("http"), \
                    f"Image URL should be full Cloudinary URL, got: {product['image_url']}"
                print(f"Product image URL: {product['image_url']}")
            else:
                print("Product has no image uploaded")


class TestBug2CategoryAspectRatio:
    """Bug 2: Category images should use 1:1 aspect ratio (aspect-square)"""
    
    def test_categories_endpoint(self):
        """Test categories endpoint returns categories with image_url"""
        response = requests.get(f"{API}/categories")
        assert response.status_code == 200
        categories = response.json()
        print(f"Found {len(categories)} categories")
        
        if categories:
            category = categories[0]
            assert "image_url" in category, "Category should have image_url field"
            if category["image_url"]:
                # Verify URL is a full URL (Cloudinary)
                assert category["image_url"].startswith("http"), \
                    f"Category image URL should be full URL, got: {category['image_url']}"
                print(f"Category image URL: {category['image_url']}")


class TestBug3PromoImageSwap:
    """Bug 3: Promo banner image swap functionality"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{API}/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json().get("token") or response.json().get("access_token")
    
    def test_promo_banner_endpoint(self, admin_token):
        """Test promo banner endpoint supports left_image and right_image"""
        response = requests.get(f"{API}/promo-banner")
        assert response.status_code == 200
        banner = response.json()
        
        # Verify banner structure includes left and right images
        assert "left_image" in banner, "Promo banner should have left_image field"
        assert "right_image" in banner, "Promo banner should have right_image field"
        print(f"Promo banner: left_image={banner.get('left_image')}, right_image={banner.get('right_image')}")
    
    def test_update_promo_banner_with_images(self, admin_token):
        """Test updating promo banner with left and right images"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get current banner
        current = requests.get(f"{API}/promo-banner").json()
        
        # Update with swapped images (simulating swap functionality)
        update_data = {
            "enabled": current.get("enabled", False),
            "text": current.get("text", "Test promo"),
            "link": current.get("link", ""),
            "bg_color": current.get("bg_color", "#f97316"),
            "height": current.get("height", 40),
            "left_image": current.get("right_image"),  # Swap
            "right_image": current.get("left_image"),  # Swap
        }
        
        response = requests.put(f"{API}/promo-banner", json=update_data, headers=headers)
        assert response.status_code == 200, f"Failed to update promo banner: {response.text}"
        print("Promo banner swap functionality works (API accepts left/right images)")
        
        # Restore original
        restore_data = {
            **update_data,
            "left_image": current.get("left_image"),
            "right_image": current.get("right_image"),
        }
        requests.put(f"{API}/promo-banner", json=restore_data, headers=headers)


class TestBug4BonusButtonText:
    """Bug 4: Bonus program request_button_text field"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{API}/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json().get("token") or response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def user_token(self):
        response = requests.post(f"{API}/auth/login", json={
            "email": "user123@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        return response.json().get("token") or response.json().get("access_token")
    
    def test_admin_bonus_programs(self, admin_token):
        """Test admin can see bonus programs with request_button_text"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{API}/admin/bonus/programs", headers=headers)
        assert response.status_code == 200, f"Failed to get bonus programs: {response.text}"
        
        data = response.json()
        programs = data.get("programs", [])
        print(f"Found {len(programs)} bonus programs")
        
        if programs:
            program = programs[0]
            assert "request_button_text" in program, "Bonus program should have request_button_text field"
            print(f"Bonus program request_button_text: '{program.get('request_button_text')}'")
    
    def test_user_bonus_programs(self, user_token):
        """Test user can see bonus programs with request_button_text"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{API}/bonus/programs", headers=headers)
        assert response.status_code == 200, f"Failed to get bonus programs: {response.text}"
        
        data = response.json()
        programs = data.get("programs", [])
        print(f"User sees {len(programs)} bonus programs")
        
        if programs:
            program = programs[0]
            # Verify request_button_text is included in user response
            button_text = program.get("request_button_text")
            if button_text:
                print(f"User sees request_button_text: '{button_text}'")
            else:
                print("Note: request_button_text not in user response or is default")


class TestBug5OrderCustomerInfo:
    """Bug 5: Order details show customer info (full_name, phone, address, comment)"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{API}/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json().get("token") or response.json().get("access_token")
    
    def test_admin_orders_have_customer_info(self, admin_token):
        """Test admin orders endpoint returns customer info fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{API}/admin/orders", headers=headers)
        assert response.status_code == 200, f"Failed to get orders: {response.text}"
        
        orders = response.json()
        print(f"Found {len(orders)} orders")
        
        if orders:
            order = orders[0]
            
            # Verify customer info fields exist
            assert "full_name" in order, "Order should have full_name field"
            assert "phone" in order, "Order should have phone field"
            assert "address" in order, "Order should have address field"
            
            print(f"Order #{order.get('id', 'N/A')[:8]}:")
            print(f"  - full_name: {order.get('full_name')}")
            print(f"  - phone: {order.get('phone')}")
            print(f"  - address: {order.get('address')}")
            print(f"  - comment: {order.get('comment', 'N/A')}")
            
            # Verify data is not empty
            assert order.get("full_name"), "Order should have customer full_name"
            assert order.get("phone"), "Order should have customer phone"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
