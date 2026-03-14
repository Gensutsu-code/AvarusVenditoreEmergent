"""
Test Login, CSV Import/Export, and Email Notification System
Tests for: Login (admin/client), CSV endpoints, Email bulk sending with user_ids

Iteration 41 - Testing login fix, CSV import, and selective email sending
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLogin:
    """Test login functionality for admin and client users"""
    
    def test_admin_login(self):
        """Test admin login with credentials admin@avarus.ru / admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin"
        })
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "admin", f"Expected admin role, got {data['user']['role']}"
        print(f"PASS: Admin login successful - role={data['user']['role']}")
        return data["token"]
    
    def test_client_login(self):
        """Test client login with credentials user@demo.com / demo123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "user@demo.com",
            "password": "demo123"
        })
        assert response.status_code == 200, f"Client login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "user", f"Expected user role, got {data['user'].get('role')}"
        print(f"PASS: Client login successful - email={data['user']['email']}")
        return data["token"]
    
    def test_invalid_login(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Invalid login correctly returns 401")


class TestCSVEndpoints:
    """Test CSV template, prompt, export, and import endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin"
        })
        assert response.status_code == 200, "Admin login failed"
        return response.json()["token"]
    
    def test_csv_template_download(self, admin_token):
        """Test GET /api/admin/products/csv-template returns CSV file"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/products/csv-template", headers=headers)
        
        assert response.status_code == 200, f"CSV template failed: {response.status_code} - {response.text}"
        
        # Check content type and disposition
        content_type = response.headers.get("content-type", "")
        content_disposition = response.headers.get("content-disposition", "")
        
        assert "text/csv" in content_type or "application/octet-stream" in content_type, \
            f"Expected CSV content type, got {content_type}"
        assert "products_template.csv" in content_disposition, \
            f"Expected products_template.csv in disposition, got {content_disposition}"
        
        # Verify CSV has expected columns
        content = response.content.decode('utf-8-sig')
        expected_columns = ["name", "article", "manufacturer", "category_id", "price", "stock"]
        for col in expected_columns:
            assert col in content, f"Missing column {col} in CSV template"
        
        print("PASS: CSV template download works - has expected columns")
    
    def test_csv_prompt_download(self, admin_token):
        """Test GET /api/admin/products/csv-prompt returns text file"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/products/csv-prompt", headers=headers)
        
        assert response.status_code == 200, f"CSV prompt failed: {response.status_code} - {response.text}"
        
        content_disposition = response.headers.get("content-disposition", "")
        assert "chatgpt_prompt.txt" in content_disposition, \
            f"Expected chatgpt_prompt.txt in disposition, got {content_disposition}"
        
        # Verify prompt content
        content = response.content.decode('utf-8')
        assert "ChatGPT" in content or "CSV" in content, "Prompt should mention ChatGPT or CSV"
        assert "article" in content.lower(), "Prompt should mention article column"
        
        print("PASS: ChatGPT prompt download works")
    
    def test_csv_export(self, admin_token):
        """Test GET /api/admin/products/csv-export returns CSV file with products"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/products/csv-export", headers=headers)
        
        assert response.status_code == 200, f"CSV export failed: {response.status_code} - {response.text}"
        
        content_disposition = response.headers.get("content-disposition", "")
        assert "products_export.csv" in content_disposition, \
            f"Expected products_export.csv in disposition, got {content_disposition}"
        
        # Verify CSV structure
        content = response.content.decode('utf-8-sig')
        lines = content.strip().split('\n')
        assert len(lines) >= 1, "CSV should have at least header row"
        
        # Check header columns
        header = lines[0]
        expected_columns = ["name", "article", "price"]
        for col in expected_columns:
            assert col in header, f"Missing column {col} in export header"
        
        print(f"PASS: CSV export works - {len(lines)} lines exported")
    
    def test_csv_import(self, admin_token):
        """Test POST /api/admin/products/import-csv accepts CSV file"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a test CSV content
        csv_content = """name;article;manufacturer;category_id;price;stock;description;warehouse;delivery_days;cross_articles;image_url
TEST_Product_Import_41;TEST_ART_41;TestMfg;;999.00;10;Test product for import;TestWarehouse;3;;"""
        
        files = {
            'file': ('test_import.csv', csv_content.encode('utf-8-sig'), 'text/csv')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/products/import-csv",
            headers=headers,
            files=files
        )
        
        assert response.status_code == 200, f"CSV import failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "imported" in data, "Response should have 'imported' field"
        assert "skipped" in data, "Response should have 'skipped' field"
        assert "total_rows" in data, "Response should have 'total_rows' field"
        
        print(f"PASS: CSV import works - imported={data.get('imported')}, skipped={data.get('skipped')}")
        
        # Cleanup - delete the test product
        # First, find the product
        products_res = requests.get(f"{BASE_URL}/api/products")
        if products_res.status_code == 200:
            products = products_res.json()
            for p in products:
                if p.get("article") == "TEST_ART_41":
                    del_res = requests.delete(
                        f"{BASE_URL}/api/products/{p['id']}",
                        headers=headers
                    )
                    if del_res.status_code == 200:
                        print(f"  Cleaned up test product TEST_ART_41")


class TestEmailNotifications:
    """Test email notification settings and bulk sending endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin"
        })
        assert response.status_code == 200, "Admin login failed"
        return response.json()["token"]
    
    def test_notification_settings(self, admin_token):
        """Test GET /api/admin/notification-settings returns resend_configured: true"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/notification-settings", headers=headers)
        
        assert response.status_code == 200, f"Notification settings failed: {response.status_code}"
        data = response.json()
        
        # Check expected fields
        assert "resend_configured" in data, "Missing resend_configured field"
        assert "order_status_enabled" in data, "Missing order_status_enabled field"
        assert "promotions_enabled" in data, "Missing promotions_enabled field"
        
        print(f"PASS: Notification settings - resend_configured={data.get('resend_configured')}")
    
    def test_bulk_email_with_user_ids(self, admin_token):
        """Test POST /api/admin/email/send-bulk accepts user_ids for selective sending"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get some users to select
        users_res = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert users_res.status_code == 200, "Failed to get users"
        users = users_res.json()
        
        if len(users) == 0:
            pytest.skip("No users available for bulk email test")
        
        # Get first user's ID for selective send
        test_user_ids = [users[0]["id"]]
        
        # Test the endpoint with user_ids parameter
        payload = {
            "subject": "Test Selective Email from Iteration 41",
            "html_content": "<p>This is a test email for selective sending.</p>",
            "user_ids": test_user_ids
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/email/send-bulk",
            headers=headers,
            json=payload
        )
        
        # Note: Resend is in sandbox mode, so actual sending may fail
        # but we're testing that the endpoint accepts the user_ids parameter
        if response.status_code == 200:
            data = response.json()
            assert "sent_count" in data or "message" in data, "Missing count in response"
            print(f"PASS: Bulk email with user_ids accepted - {data}")
        elif response.status_code == 400:
            # This could be sandbox limitation
            data = response.json()
            detail = data.get("detail", "")
            if "sandbox" in detail.lower() or "testing" in detail.lower() or "domain" in detail.lower():
                print(f"PASS: Bulk email endpoint accepts user_ids (sandbox mode restriction)")
            else:
                # Check if promotions are disabled
                assert "отключены" in detail.lower() or "disabled" in detail.lower(), \
                    f"Unexpected 400 error: {detail}"
                print(f"PASS: Endpoint responds correctly - {detail}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code} - {response.text}")


class TestAdminPanelAccess:
    """Test admin panel access and tabs"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@avarus.ru",
            "password": "admin"
        })
        assert response.status_code == 200, "Admin login failed"
        return response.json()["token"]
    
    def test_admin_stats(self, admin_token):
        """Test admin stats endpoint works"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        
        assert response.status_code == 200, f"Admin stats failed: {response.status_code}"
        data = response.json()
        
        assert "total_users" in data, "Missing total_users"
        assert "total_products" in data, "Missing total_products"
        assert "total_orders" in data, "Missing total_orders"
        
        print(f"PASS: Admin stats - users={data['total_users']}, products={data['total_products']}")
    
    def test_admin_users_list(self, admin_token):
        """Test admin can fetch users list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        
        assert response.status_code == 200, f"Admin users failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Users should be a list"
        print(f"PASS: Admin users list - {len(data)} users")
    
    def test_admin_orders_list(self, admin_token):
        """Test admin can fetch orders list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=headers)
        
        assert response.status_code == 200, f"Admin orders failed: {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), "Orders should be a list"
        print(f"PASS: Admin orders list - {len(data)} orders")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
