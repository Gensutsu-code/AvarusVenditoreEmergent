import requests
import sys
from datetime import datetime
import json

class TruckPartsAPITester:
    def __init__(self, base_url="https://heavy-vehicle.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
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

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
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

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_categories(self):
        """Test categories endpoint"""
        success, response = self.run_test("Get Categories", "GET", "categories", 200)
        if success and isinstance(response, list) and len(response) == 6:
            self.log_test("Categories Count", True, f"Found {len(response)} categories")
            return True, response
        elif success:
            self.log_test("Categories Count", False, f"Expected 6 categories, got {len(response) if isinstance(response, list) else 'invalid'}")
        return success, response

    def test_seed_data(self):
        """Test seeding data"""
        return self.run_test("Seed Data", "POST", "seed", 200)

    def test_products(self):
        """Test products endpoints"""
        # Get all products
        success, products = self.run_test("Get All Products", "GET", "products", 200)
        if not success:
            return False
        
        if not isinstance(products, list) or len(products) == 0:
            self.log_test("Products Available", False, "No products found")
            return False
        
        self.log_test("Products Available", True, f"Found {len(products)} products")
        
        # Test category filtering
        success, engine_products = self.run_test("Filter by Engine Category", "GET", "products?category=engine", 200)
        if success and isinstance(engine_products, list):
            self.log_test("Category Filtering", True, f"Found {len(engine_products)} engine products")
        
        # Test search
        success, search_results = self.run_test("Search Products", "GET", "products?search=MAN", 200)
        if success and isinstance(search_results, list):
            self.log_test("Product Search", True, f"Found {len(search_results)} products for 'MAN'")
        
        # Test individual product
        if products and len(products) > 0:
            product_id = products[0]['id']
            success, product = self.run_test("Get Single Product", "GET", f"products/{product_id}", 200)
            if success and product.get('id') == product_id:
                self.log_test("Single Product Fetch", True, f"Product: {product.get('name', 'Unknown')}")
                return True, product
        
        return True, products[0] if products else None

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "name": f"Test User {timestamp}",
            "email": f"test{timestamp}@example.com",
            "phone": "+7 (999) 123-45-67",
            "password": "testpass123"
        }
        
        success, response = self.run_test("User Registration", "POST", "auth/register", 200, user_data)
        if success and response.get('token'):
            self.token = response['token']
            self.user_id = response['user']['id']
            self.log_test("Registration Token", True, "Token received")
            return True, response
        elif success:
            self.log_test("Registration Token", False, "No token in response")
        
        return success, response

    def test_user_login(self, email, password):
        """Test user login"""
        login_data = {
            "email": email,
            "password": password
        }
        
        success, response = self.run_test("User Login", "POST", "auth/login", 200, login_data)
        if success and response.get('token'):
            self.token = response['token']
            self.user_id = response['user']['id']
            self.log_test("Login Token", True, "Token received")
            return True, response
        elif success:
            self.log_test("Login Token", False, "No token in response")
        
        return success, response

    def test_auth_me(self):
        """Test getting current user info"""
        if not self.token:
            self.log_test("Auth Me", False, "No token available")
            return False, {}
        
        return self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_cart_operations(self, product_id):
        """Test cart operations"""
        if not self.token:
            self.log_test("Cart Operations", False, "No token available")
            return False
        
        # Get empty cart
        success, cart = self.run_test("Get Empty Cart", "GET", "cart", 200)
        if success and cart.get('items') == []:
            self.log_test("Empty Cart Check", True, "Cart is empty")
        
        # Add item to cart
        cart_item = {
            "product_id": product_id,
            "quantity": 2
        }
        success, _ = self.run_test("Add to Cart", "POST", "cart/add", 200, cart_item)
        if not success:
            return False
        
        # Get cart with items
        success, cart = self.run_test("Get Cart with Items", "GET", "cart", 200)
        if success and len(cart.get('items', [])) > 0:
            self.log_test("Cart Items Check", True, f"Cart has {len(cart['items'])} items")
            
            # Update quantity
            update_item = {
                "product_id": product_id,
                "quantity": 3
            }
            success, _ = self.run_test("Update Cart Item", "POST", "cart/update", 200, update_item)
            
            # Remove item
            success, _ = self.run_test("Remove from Cart", "DELETE", f"cart/{product_id}", 200)
            
            return True
        
        return False

    def test_order_operations(self, product_id):
        """Test order operations"""
        if not self.token:
            self.log_test("Order Operations", False, "No token available")
            return False
        
        # Add item to cart first
        cart_item = {
            "product_id": product_id,
            "quantity": 1
        }
        self.run_test("Add Item for Order", "POST", "cart/add", 200, cart_item)
        
        # Create order
        order_data = {
            "full_name": "Иванов Иван Иванович",
            "address": "Москва, ул. Тестовая, д. 1",
            "phone": "+7 (999) 123-45-67"
        }
        
        success, order = self.run_test("Create Order", "POST", "orders", 200, order_data)
        if success and order.get('id'):
            order_id = order['id']
            self.log_test("Order Creation", True, f"Order ID: {order_id[:8]}")
            
            # Get orders list
            success, orders = self.run_test("Get Orders List", "GET", "orders", 200)
            if success and isinstance(orders, list) and len(orders) > 0:
                self.log_test("Orders List", True, f"Found {len(orders)} orders")
                
                # Get specific order
                success, _ = self.run_test("Get Specific Order", "GET", f"orders/{order_id}", 200)
                return success
        
        return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Truck Parts API Tests")
        print("=" * 50)
        
        # Basic API tests
        self.test_root_endpoint()
        self.test_categories()
        self.test_seed_data()
        
        # Products tests
        success, product = self.test_products()
        product_id = product['id'] if product else None
        
        # Auth tests
        success, user_data = self.test_user_registration()
        if success:
            email = user_data['user']['email']
            password = "testpass123"
            
            # Test login with registered user
            self.test_user_login(email, password)
            self.test_auth_me()
            
            # Cart and order tests (require authentication)
            if product_id:
                self.test_cart_operations(product_id)
                self.test_order_operations(product_id)
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed!")
            return 1

def main():
    tester = TruckPartsAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())