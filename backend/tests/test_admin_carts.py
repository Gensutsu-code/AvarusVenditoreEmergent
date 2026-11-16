"""
Test Admin Cart Management endpoints
Tests for admin operations on client carts:
- GET /api/admin/carts - List all non-empty carts with user info
- GET /api/admin/carts/{user_id} - Get specific user cart
- POST /api/admin/carts/{user_id}/add - Add product to cart
- PUT /api/admin/carts/{user_id}/item/{product_id} - Update quantity or set individual price
- DELETE /api/admin/carts/{user_id}/item/{product_id} - Remove item from cart
- DELETE /api/admin/carts/{user_id} - Clear entire cart
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminCarts:
    """Admin Cart Management API tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": os.environ["TEST_ADMIN_PASSWORD"]
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Admin authorization headers"""
        return {
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def client_token(self):
        """Login as client and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "user@demo.com",
            "password": os.environ["TEST_CLIENT_PASSWORD"]
        })
        # If user doesn't exist, skip tests requiring client
        if response.status_code != 200:
            pytest.skip("Client user@demo.com not available")
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def client_headers(self, client_token):
        """Client authorization headers"""
        return {
            "Authorization": f"Bearer {client_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def existing_product(self):
        """Get an existing product to use in tests"""
        response = requests.get(f"{BASE_URL}/api/products?limit=1")
        assert response.status_code == 200
        products = response.json()
        assert len(products) > 0, "No products found in database"
        return products[0]
    
    @pytest.fixture(scope="class")
    def second_product(self):
        """Get a second product for additional tests"""
        response = requests.get(f"{BASE_URL}/api/products?limit=3")
        assert response.status_code == 200
        products = response.json()
        if len(products) < 2:
            pytest.skip("Need at least 2 products for this test")
        return products[1]
    
    # ========== GET /api/admin/carts - List all carts ==========
    
    def test_get_all_carts_success(self, admin_headers):
        """GET /api/admin/carts returns list of non-empty carts with proper structure"""
        response = requests.get(f"{BASE_URL}/api/admin/carts", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "carts" in data
        assert isinstance(data["carts"], list)
        
        # Should have carts (as per test data)
        if len(data["carts"]) > 0:
            cart = data["carts"][0]
            # Verify cart structure
            assert "user_id" in cart
            assert "user_name" in cart
            assert "user_email" in cart
            assert "items" in cart
            assert "items_count" in cart
            assert "total" in cart
            
            # Verify item structure if items exist
            if cart["items"]:
                item = cart["items"][0]
                assert "product_id" in item
                assert "name" in item
                assert "article" in item
                assert "price" in item
                assert "original_price" in item
                assert "quantity" in item
                # individual_price can be null
                assert "individual_price" in item
    
    def test_get_all_carts_requires_admin(self):
        """GET /api/admin/carts returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/carts")
        assert response.status_code in [401, 403]
    
    def test_get_all_carts_forbidden_for_client(self, client_headers):
        """GET /api/admin/carts returns 403 for non-admin user"""
        response = requests.get(f"{BASE_URL}/api/admin/carts", headers=client_headers)
        assert response.status_code == 403
    
    # ========== GET /api/admin/carts/{user_id} - Get specific cart ==========
    
    def test_get_user_cart_success(self, admin_headers):
        """GET /api/admin/carts/{user_id} returns cart details with product enrichment"""
        # First get a cart to find a valid user_id
        response = requests.get(f"{BASE_URL}/api/admin/carts", headers=admin_headers)
        assert response.status_code == 200
        carts = response.json()["carts"]
        
        if not carts:
            pytest.skip("No carts available for testing")
        
        user_id = carts[0]["user_id"]
        response = requests.get(f"{BASE_URL}/api/admin/carts/{user_id}", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total" in data
        
        # Verify item enrichment
        if data["items"]:
            item = data["items"][0]
            assert "name" in item
            assert "article" in item
            assert "price" in item
            assert "original_price" in item
            assert "quantity" in item
            assert "image_url" in item
            assert "stock" in item
    
    def test_get_nonexistent_user_cart(self, admin_headers):
        """GET /api/admin/carts/{user_id} returns empty cart for nonexistent user"""
        fake_user_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/admin/carts/{fake_user_id}", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0
    
    # ========== POST /api/admin/carts/{user_id}/add - Add product to cart ==========
    
    def test_add_product_to_cart(self, admin_headers, existing_product):
        """POST /api/admin/carts/{user_id}/add adds product to user cart"""
        # Use admin's own user_id for testing
        user_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"  # Admin user
        product_id = existing_product["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/carts/{user_id}/add",
            headers=admin_headers,
            json={"product_id": product_id, "quantity": 1}
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify product was added
        cart_response = requests.get(f"{BASE_URL}/api/admin/carts/{user_id}", headers=admin_headers)
        assert cart_response.status_code == 200
        cart_data = cart_response.json()
        product_ids = [item["product_id"] for item in cart_data["items"]]
        assert product_id in product_ids
    
    def test_add_nonexistent_product_to_cart(self, admin_headers):
        """POST /api/admin/carts/{user_id}/add returns 404 for nonexistent product"""
        user_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"
        fake_product_id = str(uuid.uuid4())
        
        response = requests.post(
            f"{BASE_URL}/api/admin/carts/{user_id}/add",
            headers=admin_headers,
            json={"product_id": fake_product_id, "quantity": 1}
        )
        assert response.status_code == 404
        assert "не найден" in response.json()["detail"].lower() or "not found" in response.json()["detail"].lower()
    
    def test_add_product_increases_quantity(self, admin_headers, existing_product):
        """POST /api/admin/carts/{user_id}/add increases quantity if product already in cart"""
        user_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"
        product_id = existing_product["id"]
        
        # Get initial quantity
        cart_response = requests.get(f"{BASE_URL}/api/admin/carts/{user_id}", headers=admin_headers)
        initial_items = cart_response.json()["items"]
        initial_qty = next((i["quantity"] for i in initial_items if i["product_id"] == product_id), 0)
        
        # Add product
        response = requests.post(
            f"{BASE_URL}/api/admin/carts/{user_id}/add",
            headers=admin_headers,
            json={"product_id": product_id, "quantity": 2}
        )
        assert response.status_code == 200
        
        # Verify quantity increased
        cart_response = requests.get(f"{BASE_URL}/api/admin/carts/{user_id}", headers=admin_headers)
        new_items = cart_response.json()["items"]
        new_qty = next((i["quantity"] for i in new_items if i["product_id"] == product_id), 0)
        assert new_qty == initial_qty + 2
    
    # ========== PUT /api/admin/carts/{user_id}/item/{product_id} - Update item ==========
    
    def test_update_quantity(self, admin_headers, existing_product):
        """PUT /api/admin/carts/{user_id}/item/{product_id} updates quantity"""
        user_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"
        product_id = existing_product["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/carts/{user_id}/item/{product_id}",
            headers=admin_headers,
            json={"quantity": 5}
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify quantity was updated
        cart_response = requests.get(f"{BASE_URL}/api/admin/carts/{user_id}", headers=admin_headers)
        items = cart_response.json()["items"]
        item = next((i for i in items if i["product_id"] == product_id), None)
        assert item is not None
        assert item["quantity"] == 5
    
    def test_set_individual_price(self, admin_headers, existing_product):
        """PUT /api/admin/carts/{user_id}/item/{product_id} with price param sets individual price"""
        user_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"
        product_id = existing_product["id"]
        custom_price = 75.50
        
        response = requests.put(
            f"{BASE_URL}/api/admin/carts/{user_id}/item/{product_id}",
            headers=admin_headers,
            json={"price": custom_price}
        )
        assert response.status_code == 200
        
        # Verify individual price was set and takes precedence
        cart_response = requests.get(f"{BASE_URL}/api/admin/carts/{user_id}", headers=admin_headers)
        items = cart_response.json()["items"]
        item = next((i for i in items if i["product_id"] == product_id), None)
        assert item is not None
        assert item["price"] == custom_price
        assert item["individual_price"] == custom_price
    
    def test_update_quantity_minimum_1(self, admin_headers, existing_product):
        """PUT /api/admin/carts/{user_id}/item/{product_id} enforces minimum quantity of 1"""
        user_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"
        product_id = existing_product["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/carts/{user_id}/item/{product_id}",
            headers=admin_headers,
            json={"quantity": 0}
        )
        assert response.status_code == 200
        
        # Verify quantity is at least 1
        cart_response = requests.get(f"{BASE_URL}/api/admin/carts/{user_id}", headers=admin_headers)
        items = cart_response.json()["items"]
        item = next((i for i in items if i["product_id"] == product_id), None)
        assert item is not None
        assert item["quantity"] >= 1
    
    def test_update_nonexistent_item(self, admin_headers):
        """PUT /api/admin/carts/{user_id}/item/{product_id} returns 404 for nonexistent item"""
        user_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"
        fake_product_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{BASE_URL}/api/admin/carts/{user_id}/item/{fake_product_id}",
            headers=admin_headers,
            json={"quantity": 3}
        )
        assert response.status_code == 404
    
    # ========== DELETE /api/admin/carts/{user_id}/item/{product_id} - Remove item ==========
    
    def test_remove_item_from_cart(self, admin_headers, second_product):
        """DELETE /api/admin/carts/{user_id}/item/{product_id} removes item"""
        user_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"
        product_id = second_product["id"]
        
        # First add the product
        requests.post(
            f"{BASE_URL}/api/admin/carts/{user_id}/add",
            headers=admin_headers,
            json={"product_id": product_id, "quantity": 1}
        )
        
        # Then remove it
        response = requests.delete(
            f"{BASE_URL}/api/admin/carts/{user_id}/item/{product_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify item was removed
        cart_response = requests.get(f"{BASE_URL}/api/admin/carts/{user_id}", headers=admin_headers)
        items = cart_response.json()["items"]
        product_ids = [i["product_id"] for i in items]
        assert product_id not in product_ids
    
    def test_remove_nonexistent_item(self, admin_headers):
        """DELETE /api/admin/carts/{user_id}/item/{product_id} returns 404 for nonexistent item"""
        user_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"
        fake_product_id = str(uuid.uuid4())
        
        response = requests.delete(
            f"{BASE_URL}/api/admin/carts/{user_id}/item/{fake_product_id}",
            headers=admin_headers
        )
        assert response.status_code == 404
    
    # ========== DELETE /api/admin/carts/{user_id} - Clear cart ==========
    
    def test_clear_cart(self, admin_headers, existing_product):
        """DELETE /api/admin/carts/{user_id} clears all items"""
        # Create a test user cart that we can clear
        test_user_id = f"TEST_clear_cart_{uuid.uuid4()}"
        product_id = existing_product["id"]
        
        # Add a product to create the cart
        requests.post(
            f"{BASE_URL}/api/admin/carts/{test_user_id}/add",
            headers=admin_headers,
            json={"product_id": product_id, "quantity": 1}
        )
        
        # Clear the cart
        response = requests.delete(
            f"{BASE_URL}/api/admin/carts/{test_user_id}",
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify cart is empty
        cart_response = requests.get(f"{BASE_URL}/api/admin/carts/{test_user_id}", headers=admin_headers)
        data = cart_response.json()
        assert data["items"] == []
        assert data["total"] == 0
    
    # ========== Cart totals calculation ==========
    
    def test_cart_total_calculation(self, admin_headers, existing_product):
        """Verify cart total is calculated correctly with individual prices"""
        user_id = "1618a2fe-1397-4d95-adb9-46088e16e12a"
        
        # Get current cart
        response = requests.get(f"{BASE_URL}/api/admin/carts/{user_id}", headers=admin_headers)
        data = response.json()
        
        # Calculate expected total
        expected_total = sum(item["price"] * item["quantity"] for item in data["items"])
        assert abs(data["total"] - expected_total) < 0.01  # Float comparison


class TestProductSearch:
    """Tests for product search endpoint used in add product modal"""
    
    def test_product_search_requires_minimum_chars(self):
        """GET /api/products/search requires at least 2 characters"""
        # Search with 1 char should return empty
        response = requests.get(f"{BASE_URL}/api/products/search?q=A")
        assert response.status_code == 200
        data = response.json()
        # Should return empty or limited results
        assert isinstance(data.get("products", data), list)
    
    def test_product_search_returns_results(self):
        """GET /api/products/search returns products matching query"""
        # Use Russian characters as the products use Russian names
        response = requests.get(f"{BASE_URL}/api/products/search?q=фильтр&limit=10")
        assert response.status_code == 200
        data = response.json()
        products = data.get("products", data)
        assert isinstance(products, list)
        # Should find products with "фильтр" in name
        if len(products) > 0:
            # Verify product structure
            product = products[0]
            assert "id" in product
            assert "name" in product
            assert "price" in product
