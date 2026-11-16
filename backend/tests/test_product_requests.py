"""
Product Request System Backend Tests
=====================================
Tests for out-of-stock and not-found product request feature.
Endpoints:
- POST /api/product-requests - Create product request (client auth required)
- GET /api/product-requests/my - Get client's product requests
- GET /api/admin/product-requests - Get all product requests (admin only)
- PUT /api/admin/product-requests/{id}/respond - Respond to product request (admin only)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = os.environ["TEST_ADMIN_PASSWORD"]
CLIENT_EMAIL = "user@demo.com"
CLIENT_PASSWORD = os.environ["TEST_CLIENT_PASSWORD"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin auth failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def client_token():
    """Get client auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CLIENT_EMAIL,
        "password": CLIENT_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Client auth failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_session(admin_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


@pytest.fixture(scope="module")
def client_session(client_token):
    """Session with client auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {client_token}"
    })
    return session


class TestProductRequestCreation:
    """Tests for POST /api/product-requests endpoint"""

    def test_create_product_request_requires_auth(self):
        """Product request creation requires authentication"""
        response = requests.post(f"{BASE_URL}/api/product-requests", json={
            "article": "TEST-ARTICLE-001",
            "quantity": 1
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ POST /api/product-requests requires authentication")

    def test_create_product_request_success(self, client_session):
        """Client can create product request successfully"""
        unique_article = f"TEST-PR-{uuid.uuid4().hex[:8].upper()}"
        response = client_session.post(f"{BASE_URL}/api/product-requests", json={
            "article": unique_article,
            "quantity": 2,
            "comment": "Test comment for product request"
        })
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["article"] == unique_article, "Article should match"
        assert data["quantity"] == 2, "Quantity should match"
        assert data["status"] == "pending", "Status should be pending"
        print(f"✓ POST /api/product-requests creates request - ID: {data['id']}")

    def test_create_product_request_with_product_id(self, client_session):
        """Client can create product request with existing product ID (out-of-stock scenario)"""
        # First get a product
        products_resp = requests.get(f"{BASE_URL}/api/products?search=filter&limit=1")
        if products_resp.status_code == 200 and len(products_resp.json()) > 0:
            product = products_resp.json()[0]
            
            response = client_session.post(f"{BASE_URL}/api/product-requests", json={
                "article": product.get("article", "TEST-ARTICLE"),
                "quantity": 1,
                "product_id": product["id"],
                "product_name": product.get("name", "Test Product")
            })
            assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}"
            
            data = response.json()
            assert data.get("product_id") == product["id"], "Product ID should be saved"
            print(f"✓ Product request with product_id created successfully")
        else:
            print("⚠ No products found for testing - skipping product_id test")


class TestClientProductRequests:
    """Tests for GET /api/product-requests/my endpoint"""

    def test_get_my_requests_requires_auth(self):
        """Getting client's requests requires authentication"""
        response = requests.get(f"{BASE_URL}/api/product-requests/my")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ GET /api/product-requests/my requires authentication")

    def test_get_my_requests_returns_list(self, client_session):
        """Client can get their own product requests"""
        response = client_session.get(f"{BASE_URL}/api/product-requests/my")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/product-requests/my returns {len(data)} requests")
        
        # Verify structure of first request if exists
        if len(data) > 0:
            req = data[0]
            assert "id" in req, "Request should have id"
            assert "article" in req, "Request should have article"
            assert "status" in req, "Request should have status"
            assert "created_at" in req, "Request should have created_at"


class TestAdminProductRequests:
    """Tests for admin product request endpoints"""

    def test_get_all_requests_requires_admin(self, client_session):
        """Non-admin cannot access admin product requests endpoint"""
        response = client_session.get(f"{BASE_URL}/api/admin/product-requests")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ GET /api/admin/product-requests requires admin role")

    def test_get_all_requests_admin_success(self, admin_session):
        """Admin can get all product requests"""
        response = admin_session.get(f"{BASE_URL}/api/admin/product-requests")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/admin/product-requests returns {len(data)} requests for admin")
        
        # Verify structure
        if len(data) > 0:
            req = data[0]
            assert "id" in req
            assert "user_id" in req or "user_email" in req
            assert "article" in req
            assert "status" in req


class TestAdminRespondToProductRequest:
    """Tests for PUT /api/admin/product-requests/{id}/respond endpoint"""

    def test_respond_requires_admin(self, client_session, admin_session):
        """Non-admin cannot respond to product requests"""
        # First get a request ID from admin
        admin_resp = admin_session.get(f"{BASE_URL}/api/admin/product-requests")
        if admin_resp.status_code == 200 and len(admin_resp.json()) > 0:
            request_id = admin_resp.json()[0]["id"]
            
            response = client_session.put(f"{BASE_URL}/api/admin/product-requests/{request_id}/respond", json={
                "response_message": "Test response",
                "status": "responded"
            })
            assert response.status_code == 403, f"Expected 403, got {response.status_code}"
            print("✓ PUT /api/admin/product-requests/{id}/respond requires admin role")
        else:
            pytest.skip("No product requests found for testing")

    def test_respond_nonexistent_request(self, admin_session):
        """Responding to non-existent request returns 404"""
        fake_id = str(uuid.uuid4())
        response = admin_session.put(f"{BASE_URL}/api/admin/product-requests/{fake_id}/respond", json={
            "response_message": "Test response",
            "status": "responded"
        })
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ PUT /api/admin/product-requests/{id}/respond returns 404 for non-existent request")

    def test_respond_with_fulfilled_status(self, admin_session, client_session):
        """Admin can respond with 'fulfilled' status"""
        # Create a new request to respond to
        unique_article = f"TEST-FULFILL-{uuid.uuid4().hex[:8].upper()}"
        create_resp = client_session.post(f"{BASE_URL}/api/product-requests", json={
            "article": unique_article,
            "quantity": 1,
            "comment": "Test for fulfilled status"
        })
        
        if create_resp.status_code in [200, 201]:
            request_id = create_resp.json()["id"]
            
            response = admin_session.put(f"{BASE_URL}/api/admin/product-requests/{request_id}/respond", json={
                "response_message": "Товар найден и добавлен в каталог",
                "status": "fulfilled"
            })
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert data["status"] == "fulfilled", "Status should be fulfilled"
            assert data["admin_response"] == "Товар найден и добавлен в каталог"
            print("✓ Admin can respond with 'fulfilled' status")
        else:
            pytest.skip("Could not create request for testing")

    def test_respond_with_rejected_status(self, admin_session, client_session):
        """Admin can respond with 'rejected' status"""
        # Create a new request to reject
        unique_article = f"TEST-REJECT-{uuid.uuid4().hex[:8].upper()}"
        create_resp = client_session.post(f"{BASE_URL}/api/product-requests", json={
            "article": unique_article,
            "quantity": 1,
            "comment": "Test for rejected status"
        })
        
        if create_resp.status_code in [200, 201]:
            request_id = create_resp.json()["id"]
            
            response = admin_session.put(f"{BASE_URL}/api/admin/product-requests/{request_id}/respond", json={
                "response_message": "К сожалению, данный товар не поставляется",
                "status": "rejected"
            })
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert data["status"] == "rejected", "Status should be rejected"
            print("✓ Admin can respond with 'rejected' status")
        else:
            pytest.skip("Could not create request for testing")

    def test_respond_with_responded_status(self, admin_session, client_session):
        """Admin can respond with 'responded' status (general response)"""
        unique_article = f"TEST-RESPOND-{uuid.uuid4().hex[:8].upper()}"
        create_resp = client_session.post(f"{BASE_URL}/api/product-requests", json={
            "article": unique_article,
            "quantity": 1
        })
        
        if create_resp.status_code in [200, 201]:
            request_id = create_resp.json()["id"]
            
            response = admin_session.put(f"{BASE_URL}/api/admin/product-requests/{request_id}/respond", json={
                "response_message": "Мы ищем данный товар, свяжемся с вами",
                "status": "responded"
            })
            assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert data["status"] == "responded", "Status should be responded"
            print("✓ Admin can respond with 'responded' status")
        else:
            pytest.skip("Could not create request for testing")


class TestExistingProductRequest:
    """Tests with the existing product request mentioned in context (MANN-W940)"""

    def test_existing_request_visible_to_admin(self, admin_session):
        """Admin can see existing MANN-W940 request"""
        response = admin_session.get(f"{BASE_URL}/api/admin/product-requests")
        assert response.status_code == 200
        
        data = response.json()
        # Look for the existing request
        mann_request = None
        for req in data:
            if "MANN" in req.get("article", "").upper() or "W940" in req.get("article", "").upper():
                mann_request = req
                break
        
        if mann_request:
            print(f"✓ Found existing MANN-W940 request: status={mann_request['status']}, user={mann_request.get('user_name', mann_request.get('user_email'))}")
        else:
            print("⚠ MANN-W940 request not found (may have been processed)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
