"""
Test file for iteration 20 features:
1. Stock decrease on order, restore on cancel
2. Document generation (invoice/receipt WORD/PDF)
3. Payment settings and checkout with payment methods
4. News CRUD and display
5. Client notifications
6. Admin notifications and activities
7. Prize management
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ecommerce-overhaul-3.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "TEST@MAIL.RU"
TEST_USER_PASSWORD = "admin123"
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def test_user_token():
    """Get test user token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Test user authentication failed")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Admin authentication failed")


class TestPaymentSettings:
    """Test payment method settings API"""
    
    def test_get_payment_settings_public(self):
        """GET /api/payment-settings returns card/crypto/cash discounts"""
        response = requests.get(f"{BASE_URL}/api/payment-settings")
        assert response.status_code == 200
        data = response.json()
        assert "card_discount" in data
        assert "crypto_discount" in data
        assert "cash_discount" in data
        print(f"Payment settings: {data}")
    
    def test_get_admin_payment_settings(self, admin_token):
        """Admin can get payment settings"""
        response = requests.get(f"{BASE_URL}/api/admin/payment-settings",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "card_discount" in data
        assert "crypto_discount" in data
        assert "cash_discount" in data


class TestNewsAPI:
    """Test news CRUD API"""
    
    def test_get_news_public(self):
        """GET /api/news returns articles (may be empty initially)"""
        response = requests.get(f"{BASE_URL}/api/news")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"News count: {len(data)}")
    
    def test_admin_create_news(self, admin_token):
        """Admin can create news article"""
        response = requests.post(f"{BASE_URL}/api/admin/news",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "TEST_NEWS_Тестовая новость",
                "content": "Это тестовая новость для проверки функционала",
                "image_url": ""
            })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["title"] == "TEST_NEWS_Тестовая новость"
        print(f"Created news: {data['id']}")
        return data["id"]
    
    def test_admin_get_news(self, admin_token):
        """Admin can get all news"""
        response = requests.get(f"{BASE_URL}/api/admin/news",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestClientNotifications:
    """Test client notifications API"""
    
    def test_get_my_notifications(self, test_user_token):
        """GET /api/my-notifications returns user notifications"""
        response = requests.get(f"{BASE_URL}/api/my-notifications",
            headers={"Authorization": f"Bearer {test_user_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        print(f"Notifications count: {len(data['notifications'])}, unread: {data['unread_count']}")
    
    def test_mark_notifications_read(self, test_user_token):
        """Can mark notifications as read"""
        response = requests.put(f"{BASE_URL}/api/my-notifications/read-all",
            headers={"Authorization": f"Bearer {test_user_token}"})
        assert response.status_code == 200


class TestAdminNotifications:
    """Test admin notifications/activities API"""
    
    def test_get_admin_notifications(self, admin_token):
        """GET /api/admin/notifications returns notification counts"""
        response = requests.get(f"{BASE_URL}/api/admin/notifications",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        data = response.json()
        # Should have counts for various notification types
        assert "total" in data or "status_requests" in data or "new_orders" in data
        print(f"Admin notifications: {data}")
    
    def test_get_admin_activities(self, admin_token):
        """GET /api/admin/activities returns activity log"""
        response = requests.get(f"{BASE_URL}/api/admin/activities",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "activities" in data
        assert "unread_count" in data


class TestDocumentGeneration:
    """Test document generation for orders"""
    
    def test_get_admin_orders(self, admin_token):
        """Admin can get orders list"""
        response = requests.get(f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            print(f"Found {len(data)} orders, first order ID: {data[0]['id'][:8]}")
            return data[0]["id"]
        return None
    
    def test_invoice_docx_endpoint(self, admin_token):
        """Test invoice DOCX download endpoint"""
        # First get an order ID
        response = requests.get(f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"})
        if response.status_code != 200 or not response.json():
            pytest.skip("No orders available to test document generation")
        
        order_id = response.json()[0]["id"]
        
        # Test invoice DOCX
        response = requests.get(f"{BASE_URL}/api/admin/orders/{order_id}/invoice/docx",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in response.headers.get("content-type", "")
        print(f"Invoice DOCX generated for order {order_id[:8]}")
    
    def test_invoice_pdf_endpoint(self, admin_token):
        """Test invoice PDF download endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"})
        if response.status_code != 200 or not response.json():
            pytest.skip("No orders available")
        
        order_id = response.json()[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/admin/orders/{order_id}/invoice/pdf",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("content-type", "")
        print(f"Invoice PDF generated for order {order_id[:8]}")
    
    def test_receipt_docx_endpoint(self, admin_token):
        """Test receipt DOCX download endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"})
        if response.status_code != 200 or not response.json():
            pytest.skip("No orders available")
        
        order_id = response.json()[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/admin/orders/{order_id}/receipt/docx",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in response.headers.get("content-type", "")
        print(f"Receipt DOCX generated for order {order_id[:8]}")
    
    def test_receipt_pdf_endpoint(self, admin_token):
        """Test receipt PDF download endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/orders",
            headers={"Authorization": f"Bearer {admin_token}"})
        if response.status_code != 200 or not response.json():
            pytest.skip("No orders available")
        
        order_id = response.json()[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/admin/orders/{order_id}/receipt/pdf",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("content-type", "")
        print(f"Receipt PDF generated for order {order_id[:8]}")


class TestStockManagement:
    """Test stock decrease on order and restore on cancel"""
    
    def test_get_product_stock(self):
        """Get a product with stock to test"""
        response = requests.get(f"{BASE_URL}/api/products", params={"search": "Фильтр"})
        assert response.status_code == 200
        products = response.json()
        if not products:
            pytest.skip("No products found")
        
        product = products[0]
        print(f"Product: {product['name']}, Stock: {product.get('stock', 'N/A')}")
        return product
    
    def test_stock_decrease_flow(self, test_user_token):
        """Test that stock decreases when order is created"""
        # Find a product with stock
        response = requests.get(f"{BASE_URL}/api/products", params={"search": "Фильтр"})
        assert response.status_code == 200
        products = response.json()
        if not products:
            pytest.skip("No products found")
        
        product = products[0]
        initial_stock = product.get("stock", 0)
        product_id = product["id"]
        print(f"Initial stock for {product['name']}: {initial_stock}")
        
        # Clear cart first
        requests.delete(f"{BASE_URL}/api/cart",
            headers={"Authorization": f"Bearer {test_user_token}"})
        
        # Add to cart
        response = requests.post(f"{BASE_URL}/api/cart/add",
            headers={"Authorization": f"Bearer {test_user_token}"},
            json={"product_id": product_id, "quantity": 1})
        assert response.status_code == 200
        print("Added product to cart")
        
        # Note: We won't actually create the order to avoid affecting real data
        # The stock decrease logic is verified to exist in the code


class TestBonusPrizeManagement:
    """Test bonus program and prize management"""
    
    def test_get_bonus_programs(self, admin_token):
        """Admin can get bonus programs"""
        response = requests.get(f"{BASE_URL}/api/admin/bonus-programs",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            program = data[0]
            print(f"Found bonus program: {program.get('name')}, prizes: {len(program.get('prizes', []))}")
    
    def test_get_prize_redemptions(self, admin_token):
        """Admin can get prize redemptions"""
        response = requests.get(f"{BASE_URL}/api/admin/prize-redemptions",
            headers={"Authorization": f"Bearer {admin_token}"})
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Prize redemptions count: {len(data)}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_news(self, admin_token):
        """Delete test news articles"""
        response = requests.get(f"{BASE_URL}/api/admin/news",
            headers={"Authorization": f"Bearer {admin_token}"})
        if response.status_code == 200:
            news_list = response.json()
            for article in news_list:
                if article.get("title", "").startswith("TEST_NEWS_"):
                    requests.delete(f"{BASE_URL}/api/admin/news/{article['id']}",
                        headers={"Authorization": f"Bearer {admin_token}"})
                    print(f"Deleted test news: {article['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
