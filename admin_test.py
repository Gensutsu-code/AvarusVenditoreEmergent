import requests
import sys
from datetime import datetime
import json

class AdminAPITester:
    def __init__(self, base_url="https://truckpartshub.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, use_admin=True):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        # Use admin token by default, or user token if specified
        token = self.admin_token if use_admin else self.user_token
        if token:
            test_headers['Authorization'] = f'Bearer {token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_create_admin(self):
        """Test creating admin user"""
        success, response = self.run_test("Create Admin User", "POST", "admin/create-admin", 200, use_admin=False)
        return success, response

    def test_admin_login(self):
        """Test admin login"""
        login_data = {
            "email": "admin@avarus.ru",
            "password": "admin123"
        }
        
        success, response = self.run_test("Admin Login", "POST", "auth/login", 200, login_data, use_admin=False)
        if success and response.get('token'):
            self.admin_token = response['token']
            admin_user = response.get('user', {})
            if admin_user.get('role') == 'admin':
                self.log_test("Admin Role Check", True, "User has admin role")
                return True, response
            else:
                self.log_test("Admin Role Check", False, f"Expected admin role, got {admin_user.get('role')}")
        elif success:
            self.log_test("Admin Login Token", False, "No token in response")
        
        return success, response

    def test_regular_user_login(self):
        """Test regular user login for access control testing"""
        # First register a regular user
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "name": f"Regular User {timestamp}",
            "email": f"user{timestamp}@example.com",
            "phone": "+7 (999) 123-45-67",
            "password": "userpass123"
        }
        
        success, response = self.run_test("Register Regular User", "POST", "auth/register", 200, user_data, use_admin=False)
        if success and response.get('token'):
            self.user_token = response['token']
            return True, response
        return success, response

    def test_admin_stats(self):
        """Test admin stats endpoint"""
        success, stats = self.run_test("Get Admin Stats", "GET", "admin/stats", 200)
        if success:
            required_fields = ['total_users', 'total_products', 'total_orders', 'total_revenue']
            for field in required_fields:
                if field in stats:
                    self.log_test(f"Stats Field: {field}", True, f"Value: {stats[field]}")
                else:
                    self.log_test(f"Stats Field: {field}", False, "Field missing")
        return success, stats

    def test_admin_users(self):
        """Test admin users endpoint"""
        success, users = self.run_test("Get Admin Users", "GET", "admin/users", 200)
        if success and isinstance(users, list):
            self.log_test("Users List Format", True, f"Found {len(users)} users")
            # Check if admin user is in the list
            admin_found = any(u.get('email') == 'admin@avarus.ru' for u in users)
            self.log_test("Admin User in List", admin_found, "Admin user found in users list")
        return success, users

    def test_admin_orders(self):
        """Test admin orders endpoint"""
        success, orders = self.run_test("Get Admin Orders", "GET", "admin/orders", 200)
        if success and isinstance(orders, list):
            self.log_test("Orders List Format", True, f"Found {len(orders)} orders")
        return success, orders

    def test_product_crud(self):
        """Test admin product CRUD operations"""
        # Create a new product
        new_product = {
            "name": "Test Product Admin",
            "article": "TEST-ADMIN-001",
            "price": 15000,
            "stock": 5,
            "delivery_days": 2,
            "description": "Test product for admin testing",
            "image_url": "https://images.unsplash.com/photo-1695597802538-bcb2bd533d19?w=400"
        }
        
        success, product = self.run_test("Create Product (Admin)", "POST", "products", 200, new_product)
        if not success:
            return False
        
        product_id = product.get('id')
        if not product_id:
            self.log_test("Product Creation ID", False, "No product ID returned")
            return False
        
        self.log_test("Product Creation ID", True, f"Product ID: {product_id}")
        
        # Update the product
        update_data = {
            "name": "Updated Test Product",
            "price": 18000,
            "stock": 8
        }
        
        success, updated_product = self.run_test("Update Product (Admin)", "PUT", f"products/{product_id}", 200, update_data)
        if success:
            if updated_product.get('name') == "Updated Test Product":
                self.log_test("Product Update Verification", True, "Product name updated correctly")
            else:
                self.log_test("Product Update Verification", False, f"Expected 'Updated Test Product', got '{updated_product.get('name')}'")
        
        # Delete the product
        success, _ = self.run_test("Delete Product (Admin)", "DELETE", f"products/{product_id}", 200)
        
        return success

    def test_order_status_update(self):
        """Test admin order status update"""
        # First, get orders to find one to update
        success, orders = self.run_test("Get Orders for Status Update", "GET", "admin/orders", 200)
        if not success or not orders:
            self.log_test("Order Status Update", False, "No orders available to test status update")
            return False
        
        # Use the first order
        order = orders[0]
        order_id = order.get('id')
        current_status = order.get('status')
        
        # Try to update status
        new_status = 'processing' if current_status != 'processing' else 'shipped'
        
        # Note: The API expects status as query parameter
        success, _ = self.run_test("Update Order Status", "PUT", f"admin/orders/{order_id}/status?status={new_status}", 200)
        
        return success

    def test_access_control(self):
        """Test that regular users cannot access admin endpoints"""
        if not self.user_token:
            self.log_test("Access Control Test", False, "No regular user token available")
            return False
        
        # Test admin stats with regular user token (should fail)
        success, _ = self.run_test("Admin Stats (Regular User)", "GET", "admin/stats", 403, use_admin=False)
        
        # Test admin users with regular user token (should fail)
        success2, _ = self.run_test("Admin Users (Regular User)", "GET", "admin/users", 403, use_admin=False)
        
        # Test product creation with regular user token (should fail)
        test_product = {
            "name": "Unauthorized Product",
            "article": "UNAUTH-001",
            "price": 1000
        }
        success3, _ = self.run_test("Create Product (Regular User)", "POST", "products", 403, test_product, use_admin=False)
        
        return success and success2 and success3

    def run_all_admin_tests(self):
        """Run all admin-specific tests"""
        print("🔐 Starting Admin Panel API Tests")
        print("=" * 50)
        
        # Create admin user
        self.test_create_admin()
        
        # Test admin login
        success, _ = self.test_admin_login()
        if not success:
            print("❌ Cannot proceed without admin login")
            return 1
        
        # Test regular user for access control
        self.test_regular_user_login()
        
        # Test admin endpoints
        self.test_admin_stats()
        self.test_admin_users()
        self.test_admin_orders()
        
        # Test product CRUD
        self.test_product_crud()
        
        # Test order status update
        self.test_order_status_update()
        
        # Test access control
        self.test_access_control()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Admin Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All admin tests passed!")
            return 0
        else:
            print("⚠️  Some admin tests failed!")
            return 1

def main():
    tester = AdminAPITester()
    return tester.run_all_admin_tests()

if __name__ == "__main__":
    sys.exit(main())