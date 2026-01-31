"""
Test suite for Extended Statistics feature in Admin Panel
Tests the /api/admin/stats/extended endpoint with various periods
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestExtendedStatistics:
    """Tests for extended statistics endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    # === Main KPI Fields Tests ===
    
    def test_stats_returns_main_kpis(self):
        """Test that main KPI fields are present in response"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Main KPIs
        assert "total_revenue" in data
        assert "total_orders" in data
        assert "avg_order_value" in data
        assert "total_users" in data
        
        # Verify types
        assert isinstance(data["total_revenue"], (int, float))
        assert isinstance(data["total_orders"], int)
        assert isinstance(data["avg_order_value"], (int, float))
        assert isinstance(data["total_users"], int)
    
    def test_stats_returns_growth_percentages(self):
        """Test that growth percentage fields are present"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Growth fields
        assert "revenue_growth" in data
        assert "orders_growth" in data
        assert "prev_revenue" in data
        assert "prev_orders" in data
        
        # Verify types
        assert isinstance(data["revenue_growth"], (int, float))
        assert isinstance(data["orders_growth"], (int, float))
    
    # === Secondary Stats Tests ===
    
    def test_stats_returns_secondary_metrics(self):
        """Test secondary stats row fields"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Secondary stats
        assert "total_products" in data
        assert "active_products" in data
        assert "out_of_stock" in data
        assert "all_time_orders" in data
        assert "all_time_revenue" in data
        assert "avg_orders_per_customer" in data
        assert "conversion_rate" in data
        assert "new_users" in data
        assert "unique_customers" in data
    
    # === Charts Data Tests ===
    
    def test_stats_returns_daily_sales_chart_data(self):
        """Test daily sales chart data structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "daily_sales" in data
        assert isinstance(data["daily_sales"], list)
        
        # If there are sales, verify structure
        if len(data["daily_sales"]) > 0:
            day = data["daily_sales"][0]
            assert "date" in day
            assert "total" in day
            assert "orders" in day
            assert "items" in day
    
    def test_stats_returns_hourly_distribution(self):
        """Test hourly distribution chart data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "hourly_distribution" in data
        assert isinstance(data["hourly_distribution"], list)
        assert len(data["hourly_distribution"]) == 24  # 24 hours
        
        # Verify structure
        for hour_data in data["hourly_distribution"]:
            assert "hour" in hour_data
            assert "orders" in hour_data
            assert 0 <= hour_data["hour"] <= 23
    
    # === Status Distribution Tests ===
    
    def test_stats_returns_status_distribution(self):
        """Test status distribution data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "status_distribution" in data
        assert isinstance(data["status_distribution"], dict)
    
    # === Top Lists Tests ===
    
    def test_stats_returns_top_products(self):
        """Test top products list structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "top_products" in data
        assert isinstance(data["top_products"], list)
        
        # If there are products, verify structure
        if len(data["top_products"]) > 0:
            product = data["top_products"][0]
            assert "name" in product
            assert "article" in product
            assert "count" in product
            assert "revenue" in product
    
    def test_stats_returns_top_customers(self):
        """Test top customers list structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "top_customers" in data
        assert isinstance(data["top_customers"], list)
        
        # If there are customers, verify structure
        if len(data["top_customers"]) > 0:
            customer = data["top_customers"][0]
            assert "name" in customer
            assert "email" in customer
            assert "total_spent" in customer
            assert "orders" in customer
    
    def test_stats_returns_top_manufacturers(self):
        """Test top manufacturers list structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "top_manufacturers" in data
        assert isinstance(data["top_manufacturers"], list)
        
        # If there are manufacturers, verify structure
        if len(data["top_manufacturers"]) > 0:
            mfr = data["top_manufacturers"][0]
            assert "name" in mfr
            assert "count" in mfr
            assert "revenue" in mfr
    
    # === Period Selector Tests ===
    
    def test_stats_period_day(self):
        """Test stats with day period"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=day",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"] == "day"
        assert data["period_label"] == "За день"
    
    def test_stats_period_week(self):
        """Test stats with week period"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=week",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"] == "week"
        assert data["period_label"] == "За неделю"
    
    def test_stats_period_month(self):
        """Test stats with month period (default)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"] == "month"
        assert data["period_label"] == "За месяц"
    
    def test_stats_period_year(self):
        """Test stats with year period"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=year",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"] == "year"
        assert data["period_label"] == "За год"
    
    def test_stats_default_period_is_month(self):
        """Test that default period is month when not specified"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"] == "month"
    
    # === Authorization Tests ===
    
    def test_stats_requires_admin_auth(self):
        """Test that endpoint requires admin authentication"""
        # Without token
        response = requests.get(f"{BASE_URL}/api/admin/stats/extended")
        assert response.status_code in [401, 403]
    
    def test_stats_rejects_non_admin_user(self):
        """Test that non-admin users cannot access stats"""
        # Create a regular user and try to access
        # First register a test user
        test_email = f"test_stats_user_{os.urandom(4).hex()}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": "Test Stats User"
        })
        
        if reg_response.status_code == 200:
            user_token = reg_response.json()["token"]
            
            # Try to access stats with regular user token
            response = requests.get(
                f"{BASE_URL}/api/admin/stats/extended",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            assert response.status_code == 403
    
    # === Data Consistency Tests ===
    
    def test_stats_data_consistency(self):
        """Test that stats data is consistent across fields"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stats/extended?period=month",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Total products should equal active + out of stock
        assert data["total_products"] == data["active_products"] + data["out_of_stock"]
        
        # All-time orders should be >= period orders
        assert data["all_time_orders"] >= data["total_orders"]
        
        # All-time revenue should be >= period revenue
        assert data["all_time_revenue"] >= data["total_revenue"]
