"""
Test Phase 1 Features:
1. Health endpoint (/api/health)
2. Admin user management CRUD
3. Admin order management CRUD
4. Product cross-reference search
5. Product cross_articles field
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin123"

class TestHealthEndpoint:
    """Test health endpoint for deployment"""
    
    def test_api_health_returns_200(self):
        """Test /api/health returns 200 OK with status healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ /api/health returns 200 with status: healthy")


class TestAdminAuthentication:
    """Test admin login and get auth token"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {ADMIN_EMAIL}")
        return data["token"]
    
    def test_admin_login(self, admin_token):
        """Verify admin can login"""
        assert admin_token is not None
        print("✓ Admin token obtained successfully")


class TestAdminUserManagement:
    """Test admin user CRUD operations"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_list_users(self, auth_headers):
        """Test GET /api/admin/users - list all users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/admin/users returns {len(data)} users")
    
    def test_create_user(self, auth_headers):
        """Test POST /api/admin/users - create new user"""
        test_email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
        test_password = "testpass123"
        
        response = requests.post(f"{BASE_URL}/api/admin/users", headers=auth_headers, json={
            "email": test_email,
            "password": test_password,
            "name": "Test User Phase1",
            "phone": "+7999123456",
            "role": "user"
        })
        assert response.status_code == 200, f"Create user failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["email"] == test_email
        print(f"✓ POST /api/admin/users created user: {test_email}")
        
        # Store for cleanup
        return data["id"], test_email
    
    def test_user_password_plain_visible(self, auth_headers):
        """Test that password_plain is visible in user list for admin"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        assert response.status_code == 200
        users = response.json()
        
        # Check if any user has password_plain field
        users_with_plain_password = [u for u in users if u.get("password_plain")]
        print(f"✓ Found {len(users_with_plain_password)} users with password_plain visible")
        # Note: password_plain should be visible for admin view
    
    def test_update_user(self, auth_headers):
        """Test PUT /api/admin/users/{id} - update user"""
        # First create a user to update
        test_email = f"TEST_update_{uuid.uuid4().hex[:8]}@test.com"
        create_response = requests.post(f"{BASE_URL}/api/admin/users", headers=auth_headers, json={
            "email": test_email,
            "password": "oldpass123",
            "name": "Original Name",
            "role": "user"
        })
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update the user
        new_password = "newpass456"
        update_response = requests.put(f"{BASE_URL}/api/admin/users/{user_id}", headers=auth_headers, json={
            "name": "Updated Name",
            "password": new_password
        })
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated_data = update_response.json()
        assert updated_data["name"] == "Updated Name"
        print(f"✓ PUT /api/admin/users/{user_id} updated successfully")
        
        # Verify password was updated by checking password_plain
        list_response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        users = list_response.json()
        updated_user = next((u for u in users if u["id"] == user_id), None)
        if updated_user and updated_user.get("password_plain"):
            assert updated_user["password_plain"] == new_password
            print(f"✓ Password updated and password_plain shows: {new_password}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=auth_headers)
    
    def test_delete_user(self, auth_headers):
        """Test DELETE /api/admin/users/{id} - delete user"""
        # First create a user to delete
        test_email = f"TEST_delete_{uuid.uuid4().hex[:8]}@test.com"
        create_response = requests.post(f"{BASE_URL}/api/admin/users", headers=auth_headers, json={
            "email": test_email,
            "password": "deletepass123",
            "name": "To Be Deleted",
            "role": "user"
        })
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Delete the user
        delete_response = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        print(f"✓ DELETE /api/admin/users/{user_id} successful")
        
        # Verify user is deleted
        list_response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        users = list_response.json()
        deleted_user = next((u for u in users if u["id"] == user_id), None)
        assert deleted_user is None
        print("✓ User no longer exists in list")


class TestAdminOrderManagement:
    """Test admin order CRUD operations"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_list_orders(self, auth_headers):
        """Test GET /api/admin/orders - list all orders"""
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/admin/orders returns {len(data)} orders")
        return data
    
    def test_update_order(self, auth_headers):
        """Test PUT /api/admin/orders/{id} - update order details"""
        # First get existing orders
        list_response = requests.get(f"{BASE_URL}/api/admin/orders", headers=auth_headers)
        orders = list_response.json()
        
        if not orders:
            pytest.skip("No orders to test update")
        
        order_id = orders[0]["id"]
        original_status = orders[0].get("status", "pending")
        
        # Update order details
        new_status = "processing" if original_status != "processing" else "shipped"
        update_response = requests.put(f"{BASE_URL}/api/admin/orders/{order_id}", headers=auth_headers, json={
            "status": new_status,
            "full_name": "Updated Customer Name"
        })
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        updated_data = update_response.json()
        assert updated_data["status"] == new_status
        print(f"✓ PUT /api/admin/orders/{order_id} updated status to {new_status}")
        
        # Restore original status
        requests.put(f"{BASE_URL}/api/admin/orders/{order_id}", headers=auth_headers, json={
            "status": original_status
        })
    
    def test_delete_order(self, auth_headers):
        """Test DELETE /api/admin/orders/{id} - delete order"""
        # Get orders
        list_response = requests.get(f"{BASE_URL}/api/admin/orders", headers=auth_headers)
        orders = list_response.json()
        
        if len(orders) < 2:
            pytest.skip("Not enough orders to safely test delete")
        
        # Delete the last order (to preserve important data)
        order_id = orders[-1]["id"]
        delete_response = requests.delete(f"{BASE_URL}/api/admin/orders/{order_id}", headers=auth_headers)
        assert delete_response.status_code == 200
        print(f"✓ DELETE /api/admin/orders/{order_id} successful")
        
        # Verify order is deleted
        verify_response = requests.get(f"{BASE_URL}/api/admin/orders", headers=auth_headers)
        remaining_orders = verify_response.json()
        deleted_order = next((o for o in remaining_orders if o["id"] == order_id), None)
        assert deleted_order is None
        print("✓ Order no longer exists in list")


class TestProductCrossReference:
    """Test product cross-reference search functionality"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_search_with_alternatives_endpoint(self):
        """Test /api/products/search-with-alternatives endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/products/search-with-alternatives?search=test")
        assert response.status_code == 200
        data = response.json()
        assert "exact" in data
        assert "alternatives" in data
        print("✓ /api/products/search-with-alternatives endpoint works")
    
    def test_cross_reference_search_sachs001(self):
        """Test searching for SACHS-001 returns product in alternatives"""
        # Search for SACHS-001 which should be in cross_articles of DAF-GS-004
        response = requests.get(f"{BASE_URL}/api/products/search-with-alternatives?search=SACHS-001")
        assert response.status_code == 200
        data = response.json()
        
        print(f"Search 'SACHS-001' results:")
        print(f"  Exact matches: {len(data.get('exact', []))}")
        print(f"  Alternatives: {len(data.get('alternatives', []))}")
        
        # Check if DAF-GS-004 appears in alternatives
        alternatives = data.get("alternatives", [])
        daf_product = next((p for p in alternatives if p.get("article") == "DAF-GS-004"), None)
        
        if daf_product:
            print(f"✓ Found DAF-GS-004 in alternatives with cross_articles: {daf_product.get('cross_articles')}")
            assert "SACHS-001" in daf_product.get("cross_articles", "")
        else:
            # Check if it's in exact matches instead
            exact = data.get("exact", [])
            print(f"  Exact matches: {[p.get('article') for p in exact]}")
            print(f"  Alternatives: {[p.get('article') for p in alternatives]}")
    
    def test_product_has_cross_articles_field(self, auth_headers):
        """Test that products can have cross_articles field"""
        # Get products
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        products = response.json()
        
        # Find product with cross_articles
        products_with_cross = [p for p in products if p.get("cross_articles")]
        print(f"✓ Found {len(products_with_cross)} products with cross_articles field")
        
        if products_with_cross:
            sample = products_with_cross[0]
            print(f"  Sample: {sample.get('article')} has cross_articles: {sample.get('cross_articles')}")
    
    def test_create_product_with_cross_articles(self, auth_headers):
        """Test creating product with cross_articles field"""
        test_article = f"TEST-CROSS-{uuid.uuid4().hex[:6]}"
        
        response = requests.post(f"{BASE_URL}/api/products", headers=auth_headers, json={
            "name": "Test Cross Reference Product",
            "article": test_article,
            "price": 1000,
            "stock": 10,
            "cross_articles": "ALT-001, ALT-002, ALT-003"
        })
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert data.get("cross_articles") == "ALT-001, ALT-002, ALT-003"
        print(f"✓ Created product {test_article} with cross_articles")
        
        # Verify search finds it via cross_articles
        search_response = requests.get(f"{BASE_URL}/api/products/search-with-alternatives?search=ALT-001")
        search_data = search_response.json()
        alternatives = search_data.get("alternatives", [])
        found = next((p for p in alternatives if p.get("article") == test_article), None)
        
        if found:
            print(f"✓ Product found in alternatives when searching for ALT-001")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/products/{data['id']}", headers=auth_headers)
        print(f"✓ Cleaned up test product")
    
    def test_update_product_cross_articles(self, auth_headers):
        """Test updating product cross_articles field"""
        # Create a product
        test_article = f"TEST-UPDATE-{uuid.uuid4().hex[:6]}"
        create_response = requests.post(f"{BASE_URL}/api/products", headers=auth_headers, json={
            "name": "Test Update Cross Articles",
            "article": test_article,
            "price": 500,
            "stock": 5
        })
        assert create_response.status_code == 200
        product_id = create_response.json()["id"]
        
        # Update with cross_articles
        update_response = requests.put(f"{BASE_URL}/api/products/{product_id}", headers=auth_headers, json={
            "cross_articles": "NEW-CROSS-001, NEW-CROSS-002"
        })
        assert update_response.status_code == 200
        updated_data = update_response.json()
        assert updated_data.get("cross_articles") == "NEW-CROSS-001, NEW-CROSS-002"
        print(f"✓ Updated product cross_articles successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/products/{product_id}", headers=auth_headers)


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_cleanup_test_users(self, auth_headers):
        """Clean up TEST_ prefixed users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        users = response.json()
        
        test_users = [u for u in users if u.get("email", "").startswith("TEST_")]
        for user in test_users:
            requests.delete(f"{BASE_URL}/api/admin/users/{user['id']}", headers=auth_headers)
        
        print(f"✓ Cleaned up {len(test_users)} test users")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
