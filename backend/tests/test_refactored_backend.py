"""
Test suite for Backend Refactoring - Verifying all routes work after modular split
Tests endpoints from: auth, products, orders, admin, settings routes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoints:
    """Test health check endpoints"""
    
    def test_api_health(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ /api/health endpoint working")


class TestPublicEndpoints:
    """Test public endpoints that don't require auth"""
    
    def test_get_products(self):
        """GET /api/products returns product list"""
        response = requests.get(f"{BASE_URL}/api/products?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ /api/products returned {len(data)} products")
    
    def test_get_categories(self):
        """GET /api/categories returns category list"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ /api/categories returned {len(data)} categories")
    
    def test_get_popular_products(self):
        """GET /api/products/popular returns popular products"""
        response = requests.get(f"{BASE_URL}/api/products/popular?limit=6")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ /api/products/popular returned {len(data)} products")
    
    def test_get_payment_settings(self):
        """GET /api/payment-settings returns payment config"""
        response = requests.get(f"{BASE_URL}/api/payment-settings")
        assert response.status_code == 200
        data = response.json()
        # Validate expected fields
        assert "card_enabled" in data
        assert "crypto_enabled" in data
        assert "cash_enabled" in data
        assert "card_discount" in data
        print(f"✓ /api/payment-settings: card_enabled={data['card_enabled']}, crypto_enabled={data['crypto_enabled']}")
    
    def test_get_discount_settings(self):
        """GET /api/discount-settings returns discount config"""
        response = requests.get(f"{BASE_URL}/api/discount-settings")
        assert response.status_code == 200
        data = response.json()
        assert "retail_discount" in data
        assert "wholesale_discount" in data
        assert "partner_discount" in data
        print(f"✓ /api/discount-settings: wholesale_discount={data.get('wholesale_discount')}%")
    
    def test_get_promo_banner(self):
        """GET /api/promo-banner returns promo config"""
        response = requests.get(f"{BASE_URL}/api/promo-banner")
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        print(f"✓ /api/promo-banner: enabled={data['enabled']}")
    
    def test_get_crypto_wallets(self):
        """GET /api/crypto-wallets returns wallet addresses"""
        response = requests.get(f"{BASE_URL}/api/crypto-wallets")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print("✓ /api/crypto-wallets endpoint working")


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """POST /api/auth/login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@avarus.ru"
        assert data["user"]["role"] == "admin"
        print(f"✓ Login successful for {data['user']['email']}")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly returns 401")


@pytest.fixture
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@avarus.ru",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Admin login failed")


class TestAdminEndpoints:
    """Test admin endpoints requiring authentication"""
    
    def test_admin_stats(self, admin_token):
        """GET /api/admin/stats returns statistics"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Validate expected fields
        assert "total_users" in data
        assert "total_products" in data
        assert "total_orders" in data
        assert "total_revenue" in data
        print(f"✓ /api/admin/stats: {data['total_users']} users, {data['total_orders']} orders, revenue={data['total_revenue']}")
    
    def test_admin_orders(self, admin_token):
        """GET /api/admin/orders returns order list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ /api/admin/orders returned {len(data)} orders")
    
    def test_admin_users(self, admin_token):
        """GET /api/admin/users returns user list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Validate user fields
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "total_orders" in user
            assert "total_spent" in user
        print(f"✓ /api/admin/users returned {len(data)} users")
    
    def test_admin_activities(self, admin_token):
        """GET /api/admin/activities returns activity log"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/activities", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ /api/admin/activities returned {len(data)} activities")
    
    def test_admin_notifications(self, admin_token):
        """GET /api/admin/notifications returns notifications"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        print(f"✓ /api/admin/notifications: {data['unread_count']} unread")
    
    def test_admin_stats_extended(self, admin_token):
        """GET /api/admin/stats/extended returns extended statistics"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats/extended", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "monthly_orders" in data
        assert "monthly_revenue" in data
        print(f"✓ /api/admin/stats/extended: monthly_orders={data['monthly_orders']}")
    
    def test_admin_discount_settings(self, admin_token):
        """GET /api/admin/discount-settings returns discount settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/discount-settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "retail_discount" in data
        print(f"✓ /api/admin/discount-settings: wholesale_discount={data.get('wholesale_discount')}%")
    
    def test_admin_payment_settings(self, admin_token):
        """GET /api/admin/payment-settings returns payment settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/payment-settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "card_enabled" in data
        print(f"✓ /api/admin/payment-settings working")


class TestUnauthorizedAccess:
    """Test that admin endpoints require authentication"""
    
    def test_admin_stats_requires_auth(self):
        """GET /api/admin/stats without token returns 403"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 403
        print("✓ /api/admin/stats correctly requires auth")
    
    def test_admin_orders_requires_auth(self):
        """GET /api/admin/orders without token returns 403"""
        response = requests.get(f"{BASE_URL}/api/admin/orders")
        assert response.status_code == 403
        print("✓ /api/admin/orders correctly requires auth")
    
    def test_admin_users_requires_auth(self):
        """GET /api/admin/users without token returns 403"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 403
        print("✓ /api/admin/users correctly requires auth")


class TestProductEndpoints:
    """Test product-related endpoints"""
    
    def test_search_products(self):
        """GET /api/products with search parameter"""
        response = requests.get(f"{BASE_URL}/api/products?search=фильтр")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ /api/products?search=фильтр returned {len(data)} results")
    
    def test_search_with_alternatives(self):
        """GET /api/products/search-with-alternatives returns exact and alternatives"""
        response = requests.get(f"{BASE_URL}/api/products/search-with-alternatives?search=e82kpd36")
        assert response.status_code == 200
        data = response.json()
        assert "exact" in data
        assert "alternatives" in data
        print(f"✓ /api/products/search-with-alternatives working")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
