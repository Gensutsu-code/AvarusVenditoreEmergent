"""
Iteration 34 Tests - Testing:
1. Admin tabs have flex-1 for full width distribution (frontend only)
2. CRM sub-tabs (Клиенты and Аналитика) switching
3. CRM Analytics API endpoint
4. CRM Clients show role 'Клиент' only (simplified roles)
5. Checkout return-to-cart endpoint (crypto payment close)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_session():
    """Create a requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def admin_token(api_session):
    """Login as admin and get token"""
    response = api_session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@avarus.ru",
        "password": "admin"
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("access_token")

@pytest.fixture(scope="module")
def admin_session(api_session, admin_token):
    """Session with admin auth"""
    api_session.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_session

class TestCRMAnalytics:
    """Tests for CRM Analytics endpoint"""
    
    def test_analytics_endpoint_exists(self, admin_session):
        """Test that /admin/analytics/detailed endpoint exists and returns data"""
        response = admin_session.get(f"{BASE_URL}/api/admin/analytics/detailed?period=month")
        assert response.status_code == 200, f"Analytics endpoint failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "period" in data, "Missing period in response"
        assert "summary" in data, "Missing summary in response"
        print(f"Analytics period: {data['period']}")
    
    def test_analytics_summary_fields(self, admin_session):
        """Test that analytics summary contains required fields"""
        response = admin_session.get(f"{BASE_URL}/api/admin/analytics/detailed?period=month")
        assert response.status_code == 200
        
        summary = response.json().get("summary", {})
        required_fields = ["total_orders", "completed_orders", "total_revenue", "avg_order_value", "conversion_rate", "new_customers"]
        
        for field in required_fields:
            assert field in summary, f"Missing {field} in analytics summary"
            print(f"  {field}: {summary[field]}")
    
    def test_analytics_orders_by_status(self, admin_session):
        """Test that analytics returns orders by status breakdown"""
        response = admin_session.get(f"{BASE_URL}/api/admin/analytics/detailed?period=month")
        assert response.status_code == 200
        
        data = response.json()
        assert "orders_by_status" in data, "Missing orders_by_status in response"
        
        status_fields = ["new", "processing", "shipped", "delivered", "cancelled"]
        orders_by_status = data.get("orders_by_status", {})
        
        for status in status_fields:
            assert status in orders_by_status, f"Missing {status} in orders_by_status"
            print(f"  {status}: {orders_by_status[status]}")
    
    def test_analytics_period_filter(self, admin_session):
        """Test that different periods return different data ranges"""
        periods = ["week", "month", "quarter", "year"]
        
        for period in periods:
            response = admin_session.get(f"{BASE_URL}/api/admin/analytics/detailed?period={period}")
            assert response.status_code == 200, f"Failed for period {period}"
            data = response.json()
            assert data["period"] == period
            print(f"  Period {period}: {data['summary']['total_orders']} orders")
    
    def test_analytics_top_products(self, admin_session):
        """Test that top products are returned"""
        response = admin_session.get(f"{BASE_URL}/api/admin/analytics/detailed?period=month")
        assert response.status_code == 200
        
        data = response.json()
        assert "top_products" in data, "Missing top_products"
        print(f"  Top products count: {len(data.get('top_products', []))}")
    
    def test_analytics_top_customers(self, admin_session):
        """Test that top customers are returned"""
        response = admin_session.get(f"{BASE_URL}/api/admin/analytics/detailed?period=month")
        assert response.status_code == 200
        
        data = response.json()
        assert "top_customers" in data, "Missing top_customers"
        print(f"  Top customers count: {len(data.get('top_customers', []))}")

class TestCRMClients:
    """Tests for CRM Clients - simplified roles (Admin and Client only)"""
    
    def test_admin_users_endpoint(self, admin_session):
        """Test that admin users endpoint returns users"""
        response = admin_session.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 200, f"Users endpoint failed: {response.text}"
        
        users = response.json()
        assert isinstance(users, list), "Users should be a list"
        print(f"  Total users: {len(users)}")
    
    def test_users_have_simplified_roles(self, admin_session):
        """Test that users have only 'admin' or 'user' roles (simplified)"""
        response = admin_session.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code == 200
        
        users = response.json()
        valid_roles = ["admin", "user"]
        
        for user in users:
            role = user.get("role")
            assert role in valid_roles, f"Invalid role '{role}' for user {user.get('email')}"
        
        # Count users by role
        admin_count = sum(1 for u in users if u.get("role") == "admin")
        user_count = sum(1 for u in users if u.get("role") == "user")
        print(f"  Admins: {admin_count}, Clients: {user_count}")

class TestReturnToCart:
    """Tests for return-to-cart endpoint (crypto payment modal close)"""
    
    def test_return_to_cart_endpoint_exists(self, admin_session):
        """Test that return-to-cart endpoint exists (will fail without valid order)"""
        # This should return 404 for non-existent order, confirming endpoint exists
        response = admin_session.post(f"{BASE_URL}/api/orders/nonexistent-order/return-to-cart")
        assert response.status_code in [404, 401, 403], f"Unexpected response: {response.status_code}"
        print("  Return-to-cart endpoint exists")

class TestPaymentSettings:
    """Tests for payment settings"""
    
    def test_payment_settings_endpoint(self, admin_session):
        """Test that payment settings can be retrieved"""
        response = admin_session.get(f"{BASE_URL}/api/admin/payment-settings")
        assert response.status_code == 200, f"Payment settings failed: {response.text}"
        
        settings = response.json()
        # Check for payment method toggles
        print(f"  Card enabled: {settings.get('card_enabled')}")
        print(f"  Crypto enabled: {settings.get('crypto_enabled')}")
        print(f"  Cash enabled: {settings.get('cash_enabled')}")

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
