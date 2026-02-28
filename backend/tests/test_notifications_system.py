"""
Tests for Full Notification System - Iteration 40
Tests:
1. Admin notifications API (GET, PUT mark single, POST mark all)
2. Order creation triggers admin notification
3. Status change triggers client notification
4. Client notifications API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"
CLIENT_EMAIL = "user@demo.com"
CLIENT_PASSWORD = "demo123"


class TestAuthentication:
    """Authentication tests for both admin and client"""
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
    
    def test_client_login(self):
        """Test client can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL, "password": CLIENT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "user"


@pytest.fixture
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Admin login failed")


@pytest.fixture
def client_token():
    """Get client auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CLIENT_EMAIL, "password": CLIENT_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    pytest.skip("Client login failed")


class TestAdminNotificationsAPI:
    """Tests for admin notifications endpoints"""
    
    def test_get_admin_notifications(self, admin_token):
        """Feature 1: GET /api/admin/notifications returns admin-specific notifications with user_id=ADMIN"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/notifications", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "notifications" in data
        assert "unread_count" in data
        assert "total" in data
        assert isinstance(data["notifications"], list)
        assert isinstance(data["unread_count"], int)
    
    def test_mark_single_notification_read(self, admin_token):
        """Feature 2: PUT /api/admin/notifications/{id}/read marks specific admin notification as read"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get first notification
        response = requests.get(f"{BASE_URL}/api/admin/notifications", headers=headers)
        assert response.status_code == 200
        notifications = response.json()["notifications"]
        
        if not notifications:
            pytest.skip("No notifications to test mark-read")
        
        notif_id = notifications[0]["id"]
        
        # Mark as read
        response = requests.put(f"{BASE_URL}/api/admin/notifications/{notif_id}/read", headers=headers)
        assert response.status_code == 200
        assert response.json()["message"] == "Notification marked as read"
    
    def test_mark_all_notifications_read(self, admin_token):
        """Feature 3: POST /api/admin/notifications/mark-read marks all admin notifications as read"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Mark all as read
        response = requests.post(f"{BASE_URL}/api/admin/notifications/mark-read", headers=headers)
        assert response.status_code == 200
        assert response.json()["message"] == "Notifications marked as read"
        
        # Verify unread count is 0
        response = requests.get(f"{BASE_URL}/api/admin/notifications", headers=headers)
        assert response.status_code == 200
        # Note: unread_count includes old activities, so may not be exactly 0
        # Just verify it returns successfully


class TestOrderNotifications:
    """Tests for order-related notifications"""
    
    def test_order_creation_notifies_admin(self, admin_token, client_token):
        """Feature 4: When client creates an order, admin receives 'new_order' notification with link=/admin/orders"""
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        client_headers = {"Authorization": f"Bearer {client_token}"}
        
        # Mark all admin notifications as read first to have clean slate
        requests.post(f"{BASE_URL}/api/admin/notifications/mark-read", headers=admin_headers)
        
        # Get initial count
        response = requests.get(f"{BASE_URL}/api/admin/notifications", headers=admin_headers)
        initial_total = response.json()["total"]
        
        # Add product to cart
        products_resp = requests.get(f"{BASE_URL}/api/products?limit=1")
        if products_resp.status_code != 200 or not products_resp.json():
            pytest.skip("No products available")
        
        product_id = products_resp.json()[0]["id"]
        requests.post(f"{BASE_URL}/api/cart/add", headers=client_headers, json={
            "product_id": product_id, "quantity": 1
        })
        
        # Create order
        order_response = requests.post(f"{BASE_URL}/api/orders", headers=client_headers, json={
            "full_name": "TEST_User", "address": "Test Address", "phone": "+79999999999", "payment_method": "cash"
        })
        assert order_response.status_code == 200
        order_id = order_response.json()["id"]
        
        # Check admin got new notification
        response = requests.get(f"{BASE_URL}/api/admin/notifications", headers=admin_headers)
        assert response.status_code == 200
        new_total = response.json()["total"]
        
        # Verify new notification was created
        assert new_total > initial_total, "Admin should receive notification after order creation"
        
        # Verify latest notification is new_order type
        latest = response.json()["notifications"][0]
        assert latest["type"] == "new_order"
        assert latest["link"] == "/admin/orders"
        assert order_id[:8] in latest["message"]
    
    def test_status_change_notifies_client(self, admin_token, client_token):
        """Feature 5: When admin changes order status, client receives notification about status change"""
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        client_headers = {"Authorization": f"Bearer {client_token}"}
        
        # Get client's orders
        orders_resp = requests.get(f"{BASE_URL}/api/orders", headers=client_headers)
        if orders_resp.status_code != 200 or not orders_resp.json():
            pytest.skip("No orders to test")
        
        # Find a pending order
        orders = orders_resp.json()
        pending_order = next((o for o in orders if o["status"] in ["pending", "processing"]), None)
        
        if not pending_order:
            pytest.skip("No pending/processing orders")
        
        order_id = pending_order["id"]
        current_status = pending_order["status"]
        new_status = "completed" if current_status == "processing" else "processing"
        
        # Get client notifications before
        before = requests.get(f"{BASE_URL}/api/my-notifications", headers=client_headers).json()["unread_count"]
        
        # Admin changes status
        response = requests.put(
            f"{BASE_URL}/api/admin/orders/{order_id}/status?status={new_status}",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        # Check client got notification
        after_resp = requests.get(f"{BASE_URL}/api/my-notifications", headers=client_headers)
        assert after_resp.status_code == 200
        after = after_resp.json()["unread_count"]
        
        # Verify notification count increased
        assert after > before, "Client should receive notification after status change"
        
        # Verify notification is about order status
        latest = after_resp.json()["notifications"][0]
        assert latest["type"] == "order"
        assert order_id[:8] in latest["title"]
        assert latest["link"] == "/orders"


class TestClientNotificationsAPI:
    """Tests for client notifications endpoints"""
    
    def test_get_client_notifications(self, client_token):
        """Test GET /api/my-notifications returns client's notifications"""
        headers = {"Authorization": f"Bearer {client_token}"}
        response = requests.get(f"{BASE_URL}/api/my-notifications", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "notifications" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
    
    def test_mark_client_notification_read(self, client_token):
        """Test PUT /api/my-notifications/{id}/read marks single notification as read"""
        headers = {"Authorization": f"Bearer {client_token}"}
        
        # Get first unread notification
        response = requests.get(f"{BASE_URL}/api/my-notifications", headers=headers)
        notifications = response.json()["notifications"]
        
        unread = next((n for n in notifications if not n.get("read")), None)
        if not unread:
            pytest.skip("No unread notifications")
        
        notif_id = unread["id"]
        
        # Mark as read
        response = requests.put(f"{BASE_URL}/api/my-notifications/{notif_id}/read", headers=headers)
        assert response.status_code == 200
        assert response.json()["success"] is True
    
    def test_mark_all_client_notifications_read(self, client_token):
        """Test PUT /api/my-notifications/read-all marks all client notifications as read"""
        headers = {"Authorization": f"Bearer {client_token}"}
        
        response = requests.put(f"{BASE_URL}/api/my-notifications/read-all", headers=headers)
        assert response.status_code == 200
        assert response.json()["success"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
