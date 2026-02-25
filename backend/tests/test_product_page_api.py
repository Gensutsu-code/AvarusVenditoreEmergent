"""
Test suite for ProductPage API endpoints
Tests: product details, related products, cart, and favorites
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test product ID provided
TEST_PRODUCT_ID = "8cd5b1c5-7980-4765-9db9-8e309614f8c5"

# Test credentials
TEST_USER_EMAIL = "newtest@example.com"
TEST_USER_PASSWORD = "password123"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestProductEndpoint:
    """Tests for GET /api/products/{product_id}"""
    
    def test_get_product_success(self, api_client):
        """Test getting product details by ID"""
        response = api_client.get(f"{BASE_URL}/api/products/{TEST_PRODUCT_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "id" in data
        assert data["id"] == TEST_PRODUCT_ID
        assert "name" in data
        assert "article" in data
        assert "price" in data
        assert isinstance(data["price"], (int, float))
        assert "stock" in data
        print(f"Product: {data['name']} - {data['price']} ₽")
    
    def test_get_product_has_required_fields(self, api_client):
        """Test product response includes all required fields for ProductPage"""
        response = api_client.get(f"{BASE_URL}/api/products/{TEST_PRODUCT_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Required fields for ProductPage display
        required_fields = ["id", "name", "article", "price", "stock"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Optional but expected fields
        optional_fields = ["manufacturer", "description", "image_url", "images", "delivery_days", "cross_articles"]
        for field in optional_fields:
            if field in data:
                print(f"Optional field present: {field}")
    
    def test_get_product_not_found(self, api_client):
        """Test getting non-existent product returns 404"""
        response = api_client.get(f"{BASE_URL}/api/products/non-existent-id-12345")
        
        assert response.status_code == 404


class TestRelatedProductsEndpoint:
    """Tests for GET /api/products/{product_id}/related"""
    
    def test_get_related_products_success(self, api_client):
        """Test getting related products"""
        response = api_client.get(f"{BASE_URL}/api/products/{TEST_PRODUCT_ID}/related?limit=4")
        
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} related products")
    
    def test_get_related_products_excludes_current(self, api_client):
        """Test related products don't include the current product"""
        response = api_client.get(f"{BASE_URL}/api/products/{TEST_PRODUCT_ID}/related?limit=10")
        
        assert response.status_code == 200
        data = response.json()
        
        product_ids = [p["id"] for p in data]
        assert TEST_PRODUCT_ID not in product_ids, "Related products should not include current product"


class TestCartEndpoint:
    """Tests for cart operations - requires authentication"""
    
    def test_add_to_cart_success(self, authenticated_client):
        """Test adding product to cart"""
        response = authenticated_client.post(f"{BASE_URL}/api/cart/add", json={
            "product_id": TEST_PRODUCT_ID,
            "quantity": 1
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Product added to cart successfully")
    
    def test_add_to_cart_with_quantity(self, authenticated_client):
        """Test adding product with specific quantity"""
        response = authenticated_client.post(f"{BASE_URL}/api/cart/add", json={
            "product_id": TEST_PRODUCT_ID,
            "quantity": 3
        })
        
        assert response.status_code == 200
    
    def test_get_cart(self, authenticated_client):
        """Test getting cart contents"""
        response = authenticated_client.get(f"{BASE_URL}/api/cart")
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        print(f"Cart has {len(data['items'])} items")


class TestFavoritesEndpoint:
    """Tests for favorites operations - requires authentication"""
    
    def test_add_to_favorites(self, authenticated_client):
        """Test adding product to favorites"""
        response = authenticated_client.post(f"{BASE_URL}/api/favorites/add", json={
            "product_id": TEST_PRODUCT_ID
        })
        
        # 200 for success, may return error if already favorited
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        print(f"Favorites response: {response.status_code}")
    
    def test_check_favorite_status(self, authenticated_client):
        """Test checking if product is in favorites"""
        response = authenticated_client.get(f"{BASE_URL}/api/favorites/check/{TEST_PRODUCT_ID}")
        
        assert response.status_code == 200
        data = response.json()
        assert "is_favorite" in data
        print(f"Is favorite: {data['is_favorite']}")
    
    def test_remove_from_favorites(self, authenticated_client):
        """Test removing product from favorites"""
        # First add to ensure it exists
        authenticated_client.post(f"{BASE_URL}/api/favorites/add", json={
            "product_id": TEST_PRODUCT_ID
        })
        
        # Then remove
        response = authenticated_client.delete(f"{BASE_URL}/api/favorites/{TEST_PRODUCT_ID}")
        
        assert response.status_code == 200
        print("Product removed from favorites")


class TestProductsListEndpoint:
    """Tests for products list endpoint"""
    
    def test_get_products_list(self, api_client):
        """Test getting products list"""
        response = api_client.get(f"{BASE_URL}/api/products?limit=10")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} products")
    
    def test_search_products(self, api_client):
        """Test searching products"""
        response = api_client.get(f"{BASE_URL}/api/products?search=фильтр")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Search found {len(data)} products")


class TestPopularProductsEndpoint:
    """Tests for popular products endpoint"""
    
    def test_get_popular_products(self, api_client):
        """Test getting popular products"""
        response = api_client.get(f"{BASE_URL}/api/products/popular?limit=6")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} popular products")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
