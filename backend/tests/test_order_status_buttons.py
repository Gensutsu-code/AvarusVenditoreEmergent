"""
Test Order Status Buttons Feature
- Only 4 statuses: pending, processing, completed, cancelled
- Status transitions via buttons: 
  - pending → processing (Принять)
  - processing → completed (Выполнен) 
  - any (not completed/cancelled) → cancelled (Отменить)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://absolute-powers.preview.emergentagent.com"

ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"
CLIENT_EMAIL = "user@demo.com"
CLIENT_PASSWORD = "demo123"


class TestAuthentication:
    """Test login for admin and client"""
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        print(f"Admin login response: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data or "access_token" in data
        return data.get("token") or data.get("access_token")

    def test_client_login(self):
        """Test client can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        print(f"Client login response: {response.status_code}")
        assert response.status_code == 200, f"Client login failed: {response.text}"
        data = response.json()
        assert "token" in data or "access_token" in data


class TestOrderStatuses:
    """Test the 4 valid status values"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        data = response.json()
        return data.get("token") or data.get("access_token")
    
    @pytest.fixture(scope="class")
    def client_token(self):
        """Get client auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        data = response.json()
        return data.get("token") or data.get("access_token")
    
    def test_get_admin_orders(self, admin_token):
        """Test GET /api/admin/orders returns orders"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=headers)
        print(f"Admin orders response: {response.status_code}")
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list)
        print(f"Total orders: {len(orders)}")
        
        # Check statuses in orders
        statuses = set(o.get("status") for o in orders)
        print(f"Unique statuses found: {statuses}")
        
        # Valid statuses are: pending, processing, completed, cancelled
        valid_statuses = {"pending", "processing", "completed", "cancelled"}
        for status in statuses:
            assert status in valid_statuses, f"Invalid status '{status}' found. Valid: {valid_statuses}"
        
        return orders
    
    def test_status_update_pending_to_processing(self, admin_token):
        """Test PUT /api/admin/orders/{id} with status=processing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get pending orders
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=headers)
        orders = response.json()
        
        pending_orders = [o for o in orders if o.get("status") == "pending"]
        print(f"Found {len(pending_orders)} pending orders")
        
        if pending_orders:
            order = pending_orders[0]
            order_id = order["id"]
            
            # Update to processing
            update_response = requests.put(
                f"{BASE_URL}/api/admin/orders/{order_id}",
                headers=headers,
                json={"status": "processing"}
            )
            print(f"Update to processing: {update_response.status_code}")
            print(f"Response: {update_response.text[:500]}")
            assert update_response.status_code == 200
            
            updated_order = update_response.json()
            assert updated_order.get("status") == "processing"
            print(f"✓ Order {order_id[:8]} status changed to processing")
            
            # Change back to pending for other tests
            requests.put(
                f"{BASE_URL}/api/admin/orders/{order_id}",
                headers=headers,
                json={"status": "pending"}
            )
        else:
            pytest.skip("No pending orders to test")
    
    def test_status_update_processing_to_completed(self, admin_token):
        """Test PUT /api/admin/orders/{id} with status=completed"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get processing orders
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=headers)
        orders = response.json()
        
        processing_orders = [o for o in orders if o.get("status") == "processing"]
        print(f"Found {len(processing_orders)} processing orders")
        
        if processing_orders:
            order = processing_orders[0]
            order_id = order["id"]
            
            # Update to completed
            update_response = requests.put(
                f"{BASE_URL}/api/admin/orders/{order_id}",
                headers=headers,
                json={"status": "completed"}
            )
            print(f"Update to completed: {update_response.status_code}")
            assert update_response.status_code == 200
            
            updated_order = update_response.json()
            assert updated_order.get("status") == "completed"
            print(f"✓ Order {order_id[:8]} status changed to completed")
            
            # Change back to processing for other tests  
            requests.put(
                f"{BASE_URL}/api/admin/orders/{order_id}",
                headers=headers,
                json={"status": "processing"}
            )
        else:
            pytest.skip("No processing orders to test")
    
    def test_status_update_to_cancelled(self, admin_token):
        """Test PUT /api/admin/orders/{id} with status=cancelled"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get any non-cancelled order
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=headers)
        orders = response.json()
        
        active_orders = [o for o in orders if o.get("status") not in ["cancelled", "completed"]]
        print(f"Found {len(active_orders)} active orders (not cancelled/completed)")
        
        if active_orders:
            order = active_orders[0]
            order_id = order["id"]
            original_status = order.get("status")
            
            # Update to cancelled
            update_response = requests.put(
                f"{BASE_URL}/api/admin/orders/{order_id}",
                headers=headers,
                json={"status": "cancelled"}
            )
            print(f"Update to cancelled: {update_response.status_code}")
            assert update_response.status_code == 200
            
            updated_order = update_response.json()
            assert updated_order.get("status") == "cancelled"
            print(f"✓ Order {order_id[:8]} status changed to cancelled")
            
            # Restore original status
            requests.put(
                f"{BASE_URL}/api/admin/orders/{order_id}",
                headers=headers,
                json={"status": original_status}
            )
        else:
            pytest.skip("No active orders to test cancellation")
    
    def test_invalid_status_rejected(self, admin_token):
        """Test that invalid statuses are rejected"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get any order
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=headers)
        orders = response.json()
        
        if orders:
            order = orders[0]
            order_id = order["id"]
            
            # Try invalid statuses (old ones that were removed)
            invalid_statuses = ["new", "shipped", "delivered", "unknown"]
            
            for invalid_status in invalid_statuses:
                update_response = requests.put(
                    f"{BASE_URL}/api/admin/orders/{order_id}",
                    headers=headers,
                    json={"status": invalid_status}
                )
                print(f"Update to '{invalid_status}': {update_response.status_code}")
                assert update_response.status_code == 400, f"Status '{invalid_status}' should be rejected"
                print(f"✓ Invalid status '{invalid_status}' correctly rejected")
        else:
            pytest.skip("No orders to test")


class TestClientOrderStatuses:
    """Test client sees correct status labels"""
    
    @pytest.fixture(scope="class")
    def client_token(self):
        """Get client auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CLIENT_EMAIL,
            "password": CLIENT_PASSWORD
        })
        data = response.json()
        return data.get("token") or data.get("access_token")
    
    def test_get_client_orders(self, client_token):
        """Test client can get orders with valid statuses"""
        headers = {"Authorization": f"Bearer {client_token}"}
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        print(f"Client orders response: {response.status_code}")
        assert response.status_code == 200
        orders = response.json()
        
        if orders:
            statuses = set(o.get("status") for o in orders)
            print(f"Client sees statuses: {statuses}")
            
            valid_statuses = {"pending", "processing", "completed", "cancelled"}
            for status in statuses:
                assert status in valid_statuses
        
        return orders


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
