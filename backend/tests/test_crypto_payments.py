"""
Crypto Payment System Backend Tests
Tests for USDT/USDC payments on BSC, Base, Polygon via MetaMask
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER = {"email": "test@example.com", "password": "password123"}
ADMIN_USER = {"email": "admin@avarus.ru", "password": "admin123"}


@pytest.fixture(scope="module")
def user_token():
    """Get authentication token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("User authentication failed")


@pytest.fixture(scope="module")
def admin_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture(scope="module")
def test_order_id(user_token):
    """Get an existing order ID for testing"""
    headers = {"Authorization": f"Bearer {user_token}"}
    response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
    if response.status_code == 200:
        orders = response.json()
        if orders:
            return orders[0].get("id")
    pytest.skip("No existing order found for testing")


class TestCryptoPublicEndpoints:
    """Tests for public crypto endpoints (no auth required)"""
    
    def test_get_supported_chains(self):
        """GET /api/crypto/chains - returns supported chains"""
        response = requests.get(f"{BASE_URL}/api/crypto/chains")
        assert response.status_code == 200
        
        data = response.json()
        assert "chains" in data
        assert "enabled" in data
        assert "receiving_address" in data
        
        chains = data["chains"]
        assert len(chains) == 3  # BSC, Base, Polygon
        
        # Verify chain structure
        chain_ids = [c["id"] for c in chains]
        assert "bsc" in chain_ids
        assert "base" in chain_ids
        assert "polygon" in chain_ids
        
        # Verify each chain has required fields
        for chain in chains:
            assert "id" in chain
            assert "name" in chain
            assert "chain_id" in chain
            assert "chain_id_hex" in chain
            assert "tokens" in chain
            assert "usdt" in chain["tokens"]
            assert "usdc" in chain["tokens"]
            assert "explorer" in chain
        print("PASS: GET /api/crypto/chains returns supported chains")
    
    def test_get_crypto_price_conversion(self):
        """GET /api/crypto/price - converts RUB to USD without markup"""
        test_amount = 10000
        response = requests.get(f"{BASE_URL}/api/crypto/price?amount_rub={test_amount}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["amount_rub"] == test_amount
        assert "amount_usd" in data
        assert "rate" in data
        assert data["markup_percent"] == 0  # No markup per requirements
        assert "token_amount" in data
        assert "decimals" in data
        
        # Verify conversion math
        expected_usd = test_amount / data["rate"]
        assert abs(data["amount_usd"] - expected_usd) < 0.1
        print(f"PASS: GET /api/crypto/price - {test_amount} RUB = {data['amount_usd']} USD at rate {data['rate']}")
    
    def test_crypto_price_no_markup(self):
        """Verify no markup is applied to crypto conversion"""
        response = requests.get(f"{BASE_URL}/api/crypto/price?amount_rub=5000")
        assert response.status_code == 200
        
        data = response.json()
        # Markup should be 0 per requirements
        assert data["markup_percent"] == 0
        # Token amount should equal USD amount (stablecoins)
        assert abs(data["token_amount"] - data["amount_usd"]) < 0.01
        print("PASS: Crypto price has no markup applied")


class TestCryptoPaymentCreation:
    """Tests for crypto payment creation (authenticated)"""
    
    def test_create_payment_requires_auth(self):
        """POST /api/crypto/payment/create requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment/create",
            json={"order_id": "test", "chain": "bsc", "token": "usdt"}
        )
        assert response.status_code in [401, 403]
        print("PASS: Create payment requires authentication")
    
    def test_create_payment_invalid_chain(self, user_token, test_order_id):
        """POST /api/crypto/payment/create - rejects invalid chain"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment/create",
            headers=headers,
            json={"order_id": test_order_id, "chain": "invalid_chain", "token": "usdt"}
        )
        assert response.status_code == 400
        assert "Unsupported chain" in response.json().get("detail", "")
        print("PASS: Create payment rejects invalid chain")
    
    def test_create_payment_invalid_token(self, user_token, test_order_id):
        """POST /api/crypto/payment/create - rejects invalid token"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment/create",
            headers=headers,
            json={"order_id": test_order_id, "chain": "bsc", "token": "invalid_token"}
        )
        assert response.status_code == 400
        assert "Unsupported token" in response.json().get("detail", "")
        print("PASS: Create payment rejects invalid token")
    
    def test_create_payment_success_bsc_usdt(self, user_token, test_order_id):
        """POST /api/crypto/payment/create - creates BSC USDT payment"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment/create",
            headers=headers,
            json={"order_id": test_order_id, "chain": "bsc", "token": "usdt"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "payment_id" in data
        assert data["chain"] == "bsc"
        assert data["chain_id"] == 56
        assert data["chain_id_hex"] == "0x38"
        assert data["token"] == "usdt"
        assert "token_address" in data
        assert "receiving_address" in data
        assert data["receiving_address"]  # Should not be empty
        assert "amount_usd" in data
        assert "token_amount" in data
        assert "token_amount_wei" in data
        assert "decimals" in data
        assert "explorer" in data
        print(f"PASS: Created BSC USDT payment - {data['token_amount']} USDT")
    
    def test_create_payment_success_polygon_usdc(self, user_token, test_order_id):
        """POST /api/crypto/payment/create - creates Polygon USDC payment"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment/create",
            headers=headers,
            json={"order_id": test_order_id, "chain": "polygon", "token": "usdc"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["chain"] == "polygon"
        assert data["chain_id"] == 137
        assert data["token"] == "usdc"
        print(f"PASS: Created Polygon USDC payment - {data['token_amount']} USDC")
    
    def test_create_payment_success_base_usdt(self, user_token, test_order_id):
        """POST /api/crypto/payment/create - creates Base USDT payment"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.post(
            f"{BASE_URL}/api/crypto/payment/create",
            headers=headers,
            json={"order_id": test_order_id, "chain": "base", "token": "usdt"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["chain"] == "base"
        assert data["chain_id"] == 8453
        print(f"PASS: Created Base USDT payment - {data['token_amount']} USDT")


class TestCryptoAdminEndpoints:
    """Tests for admin crypto management endpoints"""
    
    def test_admin_settings_requires_admin(self, user_token):
        """GET /api/admin/crypto/settings - requires admin role"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/crypto/settings", headers=headers)
        assert response.status_code == 403
        print("PASS: Admin crypto settings requires admin role")
    
    def test_admin_get_settings(self, admin_token):
        """GET /api/admin/crypto/settings - returns settings for admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/crypto/settings", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "receiving_address" in data
        assert "crypto_enabled" in data
        print(f"PASS: Admin can get crypto settings - enabled: {data['crypto_enabled']}")
    
    def test_admin_update_settings(self, admin_token):
        """PUT /api/admin/crypto/settings - updates settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get current settings
        current = requests.get(f"{BASE_URL}/api/admin/crypto/settings", headers=headers).json()
        original_address = current.get("receiving_address")
        
        # Update settings
        new_address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"  # Valid checksum address
        response = requests.put(
            f"{BASE_URL}/api/admin/crypto/settings",
            headers=headers,
            json={
                "receiving_address": new_address,
                "markup_percent": 3.0,
                "crypto_enabled": True
            }
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify change
        updated = requests.get(f"{BASE_URL}/api/admin/crypto/settings", headers=headers).json()
        assert updated["receiving_address"].lower() == new_address.lower()
        print("PASS: Admin can update crypto settings")
    
    def test_admin_invalid_wallet_address(self, admin_token):
        """PUT /api/admin/crypto/settings - rejects invalid wallet address"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.put(
            f"{BASE_URL}/api/admin/crypto/settings",
            headers=headers,
            json={
                "receiving_address": "invalid_address",
                "markup_percent": 3.0,
                "crypto_enabled": True
            }
        )
        assert response.status_code == 400
        print("PASS: Admin settings rejects invalid wallet address")
    
    def test_admin_payments_requires_admin(self, user_token):
        """GET /api/admin/crypto/payments - requires admin role"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/crypto/payments", headers=headers)
        assert response.status_code == 403
        print("PASS: Admin crypto payments requires admin role")
    
    def test_admin_get_payments(self, admin_token):
        """GET /api/admin/crypto/payments - returns payment list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/crypto/payments?limit=10", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "payments" in data
        assert isinstance(data["payments"], list)
        
        # If there are payments, verify structure
        if data["payments"]:
            payment = data["payments"][0]
            assert "id" in payment
            assert "chain" in payment
            assert "token" in payment
            assert "status" in payment
        print(f"PASS: Admin can get crypto payments - found {len(data['payments'])} payments")


class TestCryptoPaymentStatus:
    """Tests for payment status checking"""
    
    def test_get_payment_status_requires_auth(self):
        """GET /api/crypto/payment/{id} requires authentication"""
        response = requests.get(f"{BASE_URL}/api/crypto/payment/some-id")
        assert response.status_code in [401, 403]
        print("PASS: Payment status requires authentication")
    
    def test_get_payment_status_not_found(self, user_token):
        """GET /api/crypto/payment/{id} - returns 404 for invalid id"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(
            f"{BASE_URL}/api/crypto/payment/non-existent-id",
            headers=headers
        )
        assert response.status_code == 404
        print("PASS: Payment status returns 404 for invalid id")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
