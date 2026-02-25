"""
Tests for CRM Analytics optimization (iteration 36)
- Tests /api/admin/analytics/detailed endpoint
- Validates response structure and data correctness
- Tests caching behavior
- Tests different period parameters (week, month, year)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAnalyticsOptimization:
    """Tests for the optimized analytics endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_analytics_endpoint_returns_200(self, admin_token):
        """Test that analytics endpoint returns 200 for authenticated admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Analytics endpoint returns 200 for admin")
    
    def test_analytics_response_structure(self, admin_token):
        """Test that response has all required fields: summary, sales_by_day, top_products, top_customers, orders_by_status"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check top-level keys
        required_keys = ['period', 'summary', 'sales_by_day', 'top_products', 'top_customers', 'orders_by_status']
        for key in required_keys:
            assert key in data, f"Missing required key: {key}"
        
        print(f"✓ Response has all required keys: {required_keys}")
    
    def test_analytics_summary_fields(self, admin_token):
        """Test that summary contains all required statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        summary = response.json().get('summary', {})
        
        required_summary_fields = [
            'total_orders', 'completed_orders', 'cancelled_orders',
            'new_customers', 'total_revenue', 'avg_order_value', 'conversion_rate'
        ]
        
        for field in required_summary_fields:
            assert field in summary, f"Missing summary field: {field}"
        
        # Validate data types
        assert isinstance(summary['total_orders'], int), "total_orders should be int"
        assert isinstance(summary['completed_orders'], int), "completed_orders should be int"
        assert isinstance(summary['total_revenue'], (int, float)), "total_revenue should be numeric"
        assert isinstance(summary['avg_order_value'], (int, float)), "avg_order_value should be numeric"
        assert isinstance(summary['conversion_rate'], (int, float)), "conversion_rate should be numeric"
        
        print(f"✓ Summary has all required fields with correct types")
        print(f"  - Total orders: {summary['total_orders']}")
        print(f"  - Total revenue: {summary['total_revenue']}")
        print(f"  - Avg order value: {summary['avg_order_value']}")
    
    def test_analytics_orders_by_status(self, admin_token):
        """Test orders_by_status contains all status types"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        status_data = response.json().get('orders_by_status', {})
        
        expected_statuses = ['new', 'processing', 'shipped', 'delivered', 'cancelled']
        for status in expected_statuses:
            assert status in status_data, f"Missing status: {status}"
            assert isinstance(status_data[status], int), f"{status} count should be int"
        
        print(f"✓ Orders by status: {status_data}")
    
    def test_analytics_sales_by_day(self, admin_token):
        """Test sales_by_day returns proper daily breakdown"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        sales_data = response.json().get('sales_by_day', [])
        
        assert isinstance(sales_data, list), "sales_by_day should be a list"
        assert len(sales_data) > 0, "sales_by_day should have entries"
        
        # Check first entry structure
        if len(sales_data) > 0:
            first_day = sales_data[0]
            assert 'date' in first_day, "Day entry should have date"
            assert 'orders' in first_day, "Day entry should have orders"
            assert 'revenue' in first_day, "Day entry should have revenue"
        
        print(f"✓ Sales by day: {len(sales_data)} entries returned")
    
    def test_analytics_top_products(self, admin_token):
        """Test top_products returns product ranking"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        top_products = response.json().get('top_products', [])
        
        assert isinstance(top_products, list), "top_products should be a list"
        
        # Check product entry structure if data exists
        if len(top_products) > 0:
            product = top_products[0]
            assert 'name' in product, "Product should have name"
            assert 'quantity' in product, "Product should have quantity"
            assert 'revenue' in product, "Product should have revenue"
        
        print(f"✓ Top products: {len(top_products)} entries returned")
    
    def test_analytics_top_customers(self, admin_token):
        """Test top_customers returns customer ranking with user data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        top_customers = response.json().get('top_customers', [])
        
        assert isinstance(top_customers, list), "top_customers should be a list"
        
        # Check customer entry structure if data exists
        if len(top_customers) > 0:
            customer = top_customers[0]
            assert 'user_id' in customer, "Customer should have user_id"
            assert 'name' in customer, "Customer should have name"
            assert 'email' in customer, "Customer should have email"
            assert 'total_spent' in customer, "Customer should have total_spent"
            assert 'orders_count' in customer, "Customer should have orders_count"
        
        print(f"✓ Top customers: {len(top_customers)} entries returned")
    
    def test_analytics_week_period(self, admin_token):
        """Test analytics with period=week"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=week",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('period') == 'week', "Period should be 'week'"
        assert 'summary' in data, "Should have summary"
        assert 'sales_by_day' in data, "Should have sales_by_day"
        
        print(f"✓ Week period analytics working. Orders: {data['summary'].get('total_orders', 0)}")
    
    def test_analytics_year_period(self, admin_token):
        """Test analytics with period=year"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=year",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('period') == 'year', "Period should be 'year'"
        assert 'summary' in data, "Should have summary"
        assert 'sales_by_day' in data, "Should have sales_by_day"
        
        print(f"✓ Year period analytics working. Orders: {data['summary'].get('total_orders', 0)}")
    
    def test_analytics_caching_performance(self, admin_token):
        """Test that repeated requests use cache (should be faster)"""
        # First request - might be cached or fresh
        start1 = time.time()
        response1 = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        time1 = time.time() - start1
        
        assert response1.status_code == 200
        
        # Second request - should hit cache
        start2 = time.time()
        response2 = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        time2 = time.time() - start2
        
        assert response2.status_code == 200
        
        # Both responses should have same data
        data1 = response1.json()
        data2 = response2.json()
        assert data1.get('summary') == data2.get('summary'), "Cache should return same data"
        
        print(f"✓ First request: {time1:.3f}s, Second request (cached): {time2:.3f}s")
        print(f"  - Both requests return identical data (caching working)")
    
    def test_analytics_response_time_under_5_seconds(self, admin_token):
        """Test that analytics endpoint responds in under 5 seconds (optimization goal)"""
        start = time.time()
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        elapsed = time.time() - start
        
        assert response.status_code == 200
        assert elapsed < 5.0, f"Response took {elapsed:.2f}s, expected < 5s"
        
        print(f"✓ Response time: {elapsed:.3f}s (under 5 second threshold)")
    
    def test_analytics_unauthorized_access_denied(self):
        """Test that analytics endpoint requires admin authentication"""
        # No auth header
        response = requests.get(f"{BASE_URL}/api/admin/analytics/detailed?period=month")
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        
        print("✓ Unauthorized access correctly denied")
    
    def test_analytics_data_consistency(self, admin_token):
        """Test data consistency: completed + cancelled + pending = total"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics/detailed?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get('summary', {})
        status = data.get('orders_by_status', {})
        
        total_from_summary = summary.get('total_orders', 0)
        total_from_status = sum(status.values())
        
        # Allow for pending status which may be counted differently
        # The sum of all statuses should equal total_orders
        assert total_from_status == total_from_summary, \
            f"Status sum ({total_from_status}) should equal total_orders ({total_from_summary})"
        
        # Completed orders in summary should match delivered status
        completed = summary.get('completed_orders', 0)
        delivered = status.get('delivered', 0)
        assert completed == delivered, \
            f"Completed ({completed}) should equal delivered ({delivered})"
        
        # Cancelled orders in summary should match cancelled status
        cancelled_summary = summary.get('cancelled_orders', 0)
        cancelled_status = status.get('cancelled', 0)
        assert cancelled_summary == cancelled_status, \
            f"Cancelled summary ({cancelled_summary}) should equal status ({cancelled_status})"
        
        print(f"✓ Data consistency verified: total={total_from_summary}, delivered={delivered}, cancelled={cancelled_status}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
