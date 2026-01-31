"""
Test suite for new e-commerce features:
1. Popular products API
2. Related products API
3. Favorites API
4. Chat API (user and admin)
5. Telegram settings API
6. Import/Export API
7. Extended stats API
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://parts-express-8.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "test_user_features@test.com"
TEST_USER_PASSWORD = "testpass123"
TEST_USER_NAME = "Test User Features"


class TestSetup:
    """Setup tests - create admin and test user"""
    
    def test_create_admin(self):
        """Ensure admin user exists"""
        response = requests.post(f"{BASE_URL}/api/admin/create-admin")
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        print(f"Admin setup: {data}")
    
    def test_seed_data(self):
        """Seed products data"""
        response = requests.post(f"{BASE_URL}/api/seed")
        assert response.status_code == 200
        print(f"Seed response: {response.json()}")
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        print(f"Admin login successful, role: {data['user']['role']}")
    
    def test_register_test_user(self):
        """Register a test user for favorites/chat testing"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "name": TEST_USER_NAME
        })
        # May already exist
        if response.status_code == 400:
            print("Test user already exists")
        else:
            assert response.status_code == 200
            print(f"Test user registered: {response.json()}")


def get_admin_token():
    """Helper to get admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    return None


def get_user_token():
    """Helper to get test user token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["token"]
    return None


class TestPopularProducts:
    """Test popular products endpoint"""
    
    def test_get_popular_products(self):
        """GET /api/products/popular - should return list of products"""
        response = requests.get(f"{BASE_URL}/api/products/popular")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Popular products count: {len(data)}")
        if len(data) > 0:
            product = data[0]
            assert "id" in product
            assert "name" in product
            assert "price" in product
            print(f"First popular product: {product['name']}")
    
    def test_popular_products_limit(self):
        """GET /api/products/popular?limit=3 - should respect limit"""
        response = requests.get(f"{BASE_URL}/api/products/popular?limit=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 3
        print(f"Popular products with limit=3: {len(data)}")


class TestRelatedProducts:
    """Test related products endpoint"""
    
    def test_get_related_products(self):
        """GET /api/products/{id}/related - should return related products"""
        # First get a product
        products_response = requests.get(f"{BASE_URL}/api/products?limit=1")
        assert products_response.status_code == 200
        products = products_response.json()
        
        if len(products) > 0:
            product_id = products[0]["id"]
            response = requests.get(f"{BASE_URL}/api/products/{product_id}/related")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            print(f"Related products for {product_id}: {len(data)}")
            # Related products should not include the original product
            for related in data:
                assert related["id"] != product_id
        else:
            pytest.skip("No products available for testing")
    
    def test_related_products_not_found(self):
        """GET /api/products/invalid-id/related - should return 404"""
        response = requests.get(f"{BASE_URL}/api/products/invalid-product-id/related")
        assert response.status_code == 404


class TestFavoritesAPI:
    """Test favorites/wishlist functionality"""
    
    def test_get_favorites_unauthorized(self):
        """GET /api/favorites without auth - should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/favorites")
        assert response.status_code in [401, 403]
    
    def test_favorites_flow(self):
        """Test complete favorites flow: add, check, get, remove"""
        token = get_user_token()
        if not token:
            pytest.skip("Could not get user token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get a product to add to favorites
        products_response = requests.get(f"{BASE_URL}/api/products?limit=1")
        products = products_response.json()
        if len(products) == 0:
            pytest.skip("No products available")
        
        product_id = products[0]["id"]
        product_name = products[0]["name"]
        
        # 1. Add to favorites
        add_response = requests.post(
            f"{BASE_URL}/api/favorites/add",
            json={"product_id": product_id},
            headers=headers
        )
        assert add_response.status_code == 200
        print(f"Added {product_name} to favorites")
        
        # 2. Check if favorite
        check_response = requests.get(
            f"{BASE_URL}/api/favorites/check/{product_id}",
            headers=headers
        )
        assert check_response.status_code == 200
        assert check_response.json()["is_favorite"] == True
        print(f"Confirmed {product_name} is in favorites")
        
        # 3. Get all favorites
        get_response = requests.get(f"{BASE_URL}/api/favorites", headers=headers)
        assert get_response.status_code == 200
        favorites = get_response.json()
        assert "items" in favorites
        assert len(favorites["items"]) > 0
        print(f"Favorites count: {len(favorites['items'])}")
        
        # 4. Remove from favorites
        remove_response = requests.delete(
            f"{BASE_URL}/api/favorites/{product_id}",
            headers=headers
        )
        assert remove_response.status_code == 200
        print(f"Removed {product_name} from favorites")
        
        # 5. Verify removed
        check_after = requests.get(
            f"{BASE_URL}/api/favorites/check/{product_id}",
            headers=headers
        )
        assert check_after.status_code == 200
        assert check_after.json()["is_favorite"] == False
        print("Verified product removed from favorites")


class TestChatAPI:
    """Test chat functionality for users"""
    
    def test_chat_unauthorized(self):
        """Chat endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/chat/messages")
        assert response.status_code in [401, 403]
    
    def test_user_chat_flow(self):
        """Test user chat: send message, get messages, unread count, mark read"""
        token = get_user_token()
        if not token:
            pytest.skip("Could not get user token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # 1. Send a message
        send_response = requests.post(
            f"{BASE_URL}/api/chat/send",
            json={"text": "Test message from automated test"},
            headers=headers
        )
        assert send_response.status_code == 200
        send_data = send_response.json()
        assert "id" in send_data
        assert "chat_id" in send_data
        print(f"Sent message, chat_id: {send_data['chat_id']}")
        
        # 2. Get messages
        messages_response = requests.get(f"{BASE_URL}/api/chat/messages", headers=headers)
        assert messages_response.status_code == 200
        messages_data = messages_response.json()
        assert "messages" in messages_data
        assert len(messages_data["messages"]) > 0
        print(f"Messages count: {len(messages_data['messages'])}")
        
        # 3. Get unread count
        unread_response = requests.get(f"{BASE_URL}/api/chat/unread-count", headers=headers)
        assert unread_response.status_code == 200
        assert "count" in unread_response.json()
        print(f"Unread count: {unread_response.json()['count']}")
        
        # 4. Mark as read
        mark_response = requests.post(f"{BASE_URL}/api/chat/mark-read", headers=headers)
        assert mark_response.status_code == 200
        print("Marked messages as read")


class TestAdminChatAPI:
    """Test admin chat functionality"""
    
    def test_admin_get_chats(self):
        """GET /api/admin/chats - admin can see all chats"""
        token = get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/chats", headers=headers)
        assert response.status_code == 200
        chats = response.json()
        assert isinstance(chats, list)
        print(f"Admin sees {len(chats)} chats")
        
        if len(chats) > 0:
            chat = chats[0]
            assert "id" in chat
            assert "user_name" in chat
            print(f"First chat from: {chat['user_name']}")
    
    def test_admin_chat_messages_and_reply(self):
        """Admin can view chat messages and reply"""
        token = get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get chats
        chats_response = requests.get(f"{BASE_URL}/api/admin/chats", headers=headers)
        chats = chats_response.json()
        
        if len(chats) == 0:
            pytest.skip("No chats available")
        
        chat_id = chats[0]["id"]
        
        # Get messages for chat
        messages_response = requests.get(
            f"{BASE_URL}/api/admin/chats/{chat_id}/messages",
            headers=headers
        )
        assert messages_response.status_code == 200
        messages_data = messages_response.json()
        assert "messages" in messages_data
        print(f"Chat {chat_id} has {len(messages_data['messages'])} messages")
        
        # Send admin reply
        reply_response = requests.post(
            f"{BASE_URL}/api/admin/chats/{chat_id}/send",
            json={"text": "Admin reply from automated test"},
            headers=headers
        )
        assert reply_response.status_code == 200
        assert "id" in reply_response.json()
        print("Admin reply sent successfully")


class TestTelegramSettings:
    """Test Telegram notification settings"""
    
    def test_get_telegram_settings_unauthorized(self):
        """Non-admin cannot access telegram settings"""
        token = get_user_token()
        if token:
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{BASE_URL}/api/admin/telegram-settings", headers=headers)
            assert response.status_code == 403
    
    def test_get_telegram_settings(self):
        """GET /api/admin/telegram-settings - admin can get settings"""
        token = get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/telegram-settings", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "bot_token" in data
        assert "chat_id" in data
        print(f"Telegram settings: enabled={data['enabled']}")
    
    def test_update_telegram_settings(self):
        """PUT /api/admin/telegram-settings - admin can update settings"""
        token = get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Update settings (with dummy values for testing)
        update_response = requests.put(
            f"{BASE_URL}/api/admin/telegram-settings",
            json={
                "enabled": False,
                "bot_token": "test_token_123",
                "chat_id": "test_chat_456"
            },
            headers=headers
        )
        assert update_response.status_code == 200
        print("Telegram settings updated")
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/admin/telegram-settings", headers=headers)
        data = get_response.json()
        assert data["bot_token"] == "test_token_123"
        assert data["chat_id"] == "test_chat_456"
        print("Telegram settings verified")


class TestImportExport:
    """Test CSV import/export functionality"""
    
    def test_export_products(self):
        """GET /api/admin/products/export - export products to CSV"""
        token = get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/products/export", headers=headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        
        # Check CSV content
        content = response.text
        assert "article" in content
        assert "name" in content
        print(f"Export CSV length: {len(content)} chars")
        print(f"First 200 chars: {content[:200]}")
    
    def test_import_products(self):
        """POST /api/admin/products/import - import products from CSV"""
        token = get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create a test CSV
        csv_content = """article;name;price;stock;delivery_days;description
TEST-IMPORT-001;Test Import Product 1;1000;5;3;Test description 1
TEST-IMPORT-002;Test Import Product 2;2000;10;5;Test description 2"""
        
        files = {
            'file': ('test_import.csv', csv_content, 'text/csv')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/products/import",
            files=files,
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "imported" in data or "updated" in data
        print(f"Import result: imported={data.get('imported', 0)}, updated={data.get('updated', 0)}")
        
        # Verify imported products exist
        search_response = requests.get(f"{BASE_URL}/api/products?search=TEST-IMPORT")
        products = search_response.json()
        assert len(products) >= 2
        print(f"Found {len(products)} imported test products")
    
    def test_import_invalid_file(self):
        """POST /api/admin/products/import with non-CSV should fail"""
        token = get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        files = {
            'file': ('test.txt', 'not a csv', 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/products/import",
            files=files,
            headers=headers
        )
        assert response.status_code == 400
        print("Invalid file correctly rejected")


class TestExtendedStats:
    """Test extended statistics endpoint"""
    
    def test_extended_stats_unauthorized(self):
        """Non-admin cannot access extended stats"""
        token = get_user_token()
        if token:
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{BASE_URL}/api/admin/stats/extended", headers=headers)
            assert response.status_code == 403
    
    def test_get_extended_stats_month(self):
        """GET /api/admin/stats/extended?period=month"""
        token = get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats/extended?period=month", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "period" in data
        assert data["period"] == "month"
        assert "total_orders" in data
        assert "total_revenue" in data
        assert "avg_order_value" in data
        assert "daily_sales" in data
        assert "top_products" in data
        assert "top_customers" in data
        assert "status_distribution" in data
        
        print(f"Extended stats: orders={data['total_orders']}, revenue={data['total_revenue']}")
        print(f"Daily sales entries: {len(data['daily_sales'])}")
        print(f"Top products: {len(data['top_products'])}")
        print(f"Top customers: {len(data['top_customers'])}")
    
    def test_extended_stats_different_periods(self):
        """Test extended stats with different periods"""
        token = get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        for period in ["day", "week", "month", "year"]:
            response = requests.get(
                f"{BASE_URL}/api/admin/stats/extended?period={period}",
                headers=headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["period"] == period
            print(f"Period {period}: {data['total_orders']} orders, {data['total_revenue']} revenue")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_imported_products(self):
        """Remove test imported products"""
        token = get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Find and delete test products
        search_response = requests.get(f"{BASE_URL}/api/products?search=TEST-IMPORT")
        products = search_response.json()
        
        for product in products:
            delete_response = requests.delete(
                f"{BASE_URL}/api/products/{product['id']}",
                headers=headers
            )
            if delete_response.status_code == 200:
                print(f"Deleted test product: {product['article']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
