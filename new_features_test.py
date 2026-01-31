import requests
import sys
from datetime import datetime
import json

class NewFeaturesAPITester:
    def __init__(self, base_url="https://truckpartshub.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_category_id = None
        self.created_product_id = None

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

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, use_admin=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        token = self.admin_token if use_admin else self.token
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

    def test_admin_login(self):
        """Test admin login with provided credentials"""
        login_data = {
            "email": "admin@avarus.ru",
            "password": "admin123"
        }
        
        success, response = self.run_test("Admin Login", "POST", "auth/login", 200, login_data)
        if success and response.get('token'):
            self.admin_token = response['token']
            user = response.get('user', {})
            if user.get('role') == 'admin':
                self.log_test("Admin Role Check", True, "User has admin role")
                return True, response
            else:
                self.log_test("Admin Role Check", False, f"User role: {user.get('role')}")
        elif success:
            self.log_test("Admin Login Token", False, "No token in response")
        
        return success, response

    def test_categories_crud(self):
        """Test Categories CRUD operations"""
        if not self.admin_token:
            self.log_test("Categories CRUD", False, "No admin token available")
            return False
        
        # 1. Get existing categories
        success, categories = self.run_test("Get Categories", "GET", "categories", 200)
        if not success:
            return False
        
        initial_count = len(categories) if isinstance(categories, list) else 0
        self.log_test("Initial Categories Count", True, f"Found {initial_count} categories")
        
        # 2. Create new category
        new_category = {
            "name": "Тестовая категория",
            "image_url": "https://images.unsplash.com/photo-1695597802538-bcb2bd533d19?w=400"
        }
        
        success, created_category = self.run_test("Create Category", "POST", "categories", 200, new_category, use_admin=True)
        if success and created_category.get('id'):
            self.created_category_id = created_category['id']
            self.log_test("Category Creation", True, f"Created category: {created_category['name']}")
        else:
            return False
        
        # 3. Update category
        update_data = {
            "name": "Обновленная тестовая категория",
            "image_url": "https://images.unsplash.com/photo-1763738173457-2a874a207215?w=400"
        }
        
        success, updated_category = self.run_test("Update Category", "PUT", f"categories/{self.created_category_id}", 200, update_data, use_admin=True)
        if success and updated_category.get('name') == update_data['name']:
            self.log_test("Category Update", True, "Category updated successfully")
        else:
            return False
        
        # 4. Get categories again to verify count increased
        success, categories_after = self.run_test("Get Categories After Create", "GET", "categories", 200)
        if success and len(categories_after) == initial_count + 1:
            self.log_test("Categories Count After Create", True, f"Count increased to {len(categories_after)}")
        else:
            self.log_test("Categories Count After Create", False, f"Expected {initial_count + 1}, got {len(categories_after) if isinstance(categories_after, list) else 'invalid'}")
        
        return True

    def test_products_with_categories(self):
        """Test Products with category assignment"""
        if not self.admin_token or not self.created_category_id:
            self.log_test("Products with Categories", False, "No admin token or category available")
            return False
        
        # Create product with category
        new_product = {
            "name": "Тестовая запчасть с категорией",
            "article": "TEST-CAT-001",
            "category_id": self.created_category_id,
            "price": 15000,
            "description": "Тестовая запчасть для проверки категорий",
            "image_url": "https://images.unsplash.com/photo-1695597802538-bcb2bd533d19?w=400",
            "stock": 5,
            "delivery_days": 2
        }
        
        success, created_product = self.run_test("Create Product with Category", "POST", "products", 200, new_product, use_admin=True)
        if success and created_product.get('id'):
            self.created_product_id = created_product['id']
            if created_product.get('category_id') == self.created_category_id:
                self.log_test("Product Category Assignment", True, "Product assigned to category")
            else:
                self.log_test("Product Category Assignment", False, f"Expected category {self.created_category_id}, got {created_product.get('category_id')}")
        else:
            return False
        
        # Test filtering products by category
        success, filtered_products = self.run_test("Filter Products by Category", "GET", f"products?category_id={self.created_category_id}", 200)
        if success and isinstance(filtered_products, list):
            category_products = [p for p in filtered_products if p.get('category_id') == self.created_category_id]
            if len(category_products) > 0:
                self.log_test("Category Filtering", True, f"Found {len(category_products)} products in category")
            else:
                self.log_test("Category Filtering", False, "No products found in category")
        else:
            return False
        
        return True

    def test_promo_banner(self):
        """Test Promo Banner functionality"""
        if not self.admin_token:
            self.log_test("Promo Banner", False, "No admin token available")
            return False
        
        # 1. Get current promo banner
        success, current_banner = self.run_test("Get Promo Banner", "GET", "promo-banner", 200)
        if not success:
            return False
        
        self.log_test("Promo Banner Get", True, f"Current enabled: {current_banner.get('enabled', False)}")
        
        # 2. Update promo banner
        new_banner = {
            "enabled": True,
            "text": "🔥 Скидка 15% на все запчасти! Только до конца месяца!",
            "link": "/catalog?search=скидка",
            "bg_color": "#dc2626"
        }
        
        success, updated_banner = self.run_test("Update Promo Banner", "PUT", "promo-banner", 200, new_banner, use_admin=True)
        if success:
            if (updated_banner.get('enabled') == new_banner['enabled'] and 
                updated_banner.get('text') == new_banner['text']):
                self.log_test("Promo Banner Update", True, "Banner updated successfully")
            else:
                self.log_test("Promo Banner Update", False, "Banner data mismatch")
        else:
            return False
        
        # 3. Verify banner is updated
        success, verified_banner = self.run_test("Verify Promo Banner Update", "GET", "promo-banner", 200)
        if success and verified_banner.get('enabled') and verified_banner.get('text') == new_banner['text']:
            self.log_test("Promo Banner Verification", True, "Banner changes persisted")
        else:
            self.log_test("Promo Banner Verification", False, "Banner changes not persisted")
        
        # 4. Disable banner
        disable_banner = {
            "enabled": False,
            "text": new_banner['text'],
            "link": new_banner['link'],
            "bg_color": new_banner['bg_color']
        }
        
        success, disabled_banner = self.run_test("Disable Promo Banner", "PUT", "promo-banner", 200, disable_banner, use_admin=True)
        if success and not disabled_banner.get('enabled'):
            self.log_test("Promo Banner Disable", True, "Banner disabled successfully")
        else:
            self.log_test("Promo Banner Disable", False, "Failed to disable banner")
        
        return True

    def test_admin_access_control(self):
        """Test admin access control for new endpoints"""
        # Test without admin token
        test_data = {"name": "Unauthorized Test", "image_url": ""}
        
        # Categories - should fail without admin
        success, _ = self.run_test("Create Category (No Auth)", "POST", "categories", 401, test_data)
        if not success:
            # This is expected - 401 means unauthorized
            self.log_test("Category Auth Protection", True, "Unauthorized access blocked")
        else:
            self.log_test("Category Auth Protection", False, "Unauthorized access allowed")
        
        # Promo banner - should fail without admin
        banner_data = {"enabled": True, "text": "Test", "link": "", "bg_color": "#000000"}
        success, _ = self.run_test("Update Banner (No Auth)", "PUT", "promo-banner", 401, banner_data)
        if not success:
            self.log_test("Banner Auth Protection", True, "Unauthorized access blocked")
        else:
            self.log_test("Banner Auth Protection", False, "Unauthorized access allowed")
        
        return True

    def cleanup_test_data(self):
        """Clean up test data"""
        if not self.admin_token:
            return
        
        # Delete test product
        if self.created_product_id:
            success, _ = self.run_test("Delete Test Product", "DELETE", f"products/{self.created_product_id}", 200, use_admin=True)
        
        # Delete test category
        if self.created_category_id:
            success, _ = self.run_test("Delete Test Category", "DELETE", f"categories/{self.created_category_id}", 200, use_admin=True)

    def run_all_tests(self):
        """Run all new features tests"""
        print("🚀 Starting New Features API Tests")
        print("=" * 50)
        
        # Admin login
        success, _ = self.test_admin_login()
        if not success:
            print("❌ Cannot proceed without admin access")
            return 1
        
        # Test new features
        self.test_categories_crud()
        self.test_products_with_categories()
        self.test_promo_banner()
        self.test_admin_access_control()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 New Features Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All new features tests passed!")
            return 0
        else:
            print("⚠️  Some new features tests failed!")
            return 1

def main():
    tester = NewFeaturesAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())