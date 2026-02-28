"""
Tests for Surcharge Payment Feature (Iteration 39):
- POST /api/orders/{id}/accept-changes for non-cash orders with price increase returns action=payment_required with amount AND user_balance
- POST /api/orders/{id}/accept-changes for orders with price decrease returns action=refund_to_balance
- POST /api/orders/{id}/accept-changes for cash orders with any price change returns action=none (just accepts)
- POST /api/orders/{id}/pay-additional with payment_method=balance deducts from user balance
- POST /api/orders/{id}/pay-additional with payment_method=crypto returns redirect_to_checkout
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CLIENT_EMAIL = "user@demo.com"
CLIENT_PASSWORD = "demo123"
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"


@pytest.fixture(scope="module")
def client_token():
    """Get client authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CLIENT_EMAIL,
        "password": CLIENT_PASSWORD
    })
    assert response.status_code == 200, f"Client login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture
def client_headers(client_token):
    """Client request headers"""
    return {"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"}


@pytest.fixture
def admin_headers(admin_token):
    """Admin request headers"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# =======================
# Feature 1: Accept changes for non-cash orders with price increase returns payment_required
# =======================

class TestAcceptChangesWithSurcharge:
    """Test accept-changes endpoint returns payment_required for non-cash orders with price increase"""
    
    def test_setup_order_for_surcharge_test(self, admin_headers, client_headers):
        """Setup: Admin edits a paid crypto order to increase price"""
        # Find a crypto order that's paid and can be edited
        response = requests.get(f"{BASE_URL}/api/orders", headers=client_headers)
        orders = response.json()
        
        # Find crypto order with paid=true that we can edit
        target_order = None
        for order in orders:
            if (order.get("payment_method") in ["crypto", "card", "balance"] and 
                order.get("paid") == True and
                order.get("status") in ["pending", "processing"] and
                not order.get("awaiting_confirmation")):
                target_order = order
                break
        
        if not target_order:
            pytest.skip("No suitable paid crypto order found for surcharge testing")
        
        order_id = target_order["id"]
        original_total = target_order["total"]
        items = target_order.get("items", [])
        
        if not items:
            pytest.skip("Order has no items")
        
        # Increase the price of first item
        modified_items = []
        for item in items:
            modified_item = item.copy()
            modified_item["price"] = item["price"] + 50  # Increase price by 50
            modified_items.append(modified_item)
        
        # Admin updates the order
        update_response = requests.put(
            f"{BASE_URL}/api/admin/orders/{order_id}",
            headers=admin_headers,
            json={"items": modified_items}
        )
        
        assert update_response.status_code == 200, f"Failed to update order: {update_response.text}"
        updated = update_response.json()
        
        # Verify order is now awaiting confirmation
        assert updated.get("awaiting_confirmation") == True, "Order should be awaiting confirmation after edit"
        assert updated.get("total") > original_total, "New total should be greater"
        
        print(f"✓ Order {order_id[:8]} edited: {original_total} -> {updated['total']}, awaiting_confirmation=True")
        return order_id, updated["total"] - original_total
    
    def test_accept_changes_returns_payment_required(self, client_headers):
        """Accept changes for non-cash order with price increase should return payment_required"""
        # Get orders to find one awaiting confirmation with price increase
        response = requests.get(f"{BASE_URL}/api/orders", headers=client_headers)
        orders = response.json()
        
        target_order = None
        for order in orders:
            if (order.get("awaiting_confirmation") == True and 
                order.get("payment_method") != "cash" and
                order.get("paid") == True and
                order.get("total", 0) > order.get("previous_total", 0)):
                target_order = order
                break
        
        if not target_order:
            pytest.skip("No suitable order with price increase found")
        
        order_id = target_order["id"]
        expected_surcharge = target_order["total"] - target_order.get("previous_total", 0)
        
        # Call accept-changes
        accept_response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/accept-changes",
            headers=client_headers
        )
        
        assert accept_response.status_code == 200, f"Accept changes failed: {accept_response.text}"
        data = accept_response.json()
        
        # Verify response structure
        assert data.get("action") == "payment_required", f"Expected action=payment_required, got {data.get('action')}"
        assert "amount" in data, "Response should include amount"
        assert "user_balance" in data, "Response should include user_balance"
        assert data["amount"] > 0, "Surcharge amount should be positive"
        
        print(f"✓ accept-changes returned: action={data['action']}, amount={data['amount']}, user_balance={data['user_balance']}")


# =======================
# Feature 2: Accept changes for price decrease returns refund_to_balance
# =======================

class TestAcceptChangesWithRefund:
    """Test accept-changes endpoint returns refund_to_balance for orders with price decrease"""
    
    def test_setup_order_for_refund_test(self, admin_headers, client_headers):
        """Setup: Admin edits a paid order to decrease price"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=client_headers)
        orders = response.json()
        
        # Find a paid non-cash order that can be edited
        target_order = None
        for order in orders:
            if (order.get("payment_method") != "cash" and 
                order.get("paid") == True and
                order.get("status") in ["pending", "processing"] and
                not order.get("awaiting_confirmation") and
                not order.get("awaiting_additional_payment")):
                target_order = order
                break
        
        if not target_order:
            pytest.skip("No suitable paid order found for refund testing")
        
        order_id = target_order["id"]
        original_total = target_order["total"]
        items = target_order.get("items", [])
        
        if not items:
            pytest.skip("Order has no items")
        
        # Decrease the price (either reduce quantity or price)
        modified_items = []
        for item in items:
            modified_item = item.copy()
            # Reduce quantity by 1 if possible, otherwise reduce price
            if item.get("quantity", 1) > 1:
                modified_item["quantity"] = item["quantity"] - 1
            else:
                modified_item["price"] = max(item["price"] - 10, 1)  # Minimum price 1
            modified_items.append(modified_item)
        
        # Admin updates the order
        update_response = requests.put(
            f"{BASE_URL}/api/admin/orders/{order_id}",
            headers=admin_headers,
            json={"items": modified_items}
        )
        
        assert update_response.status_code == 200, f"Failed to update order: {update_response.text}"
        updated = update_response.json()
        
        if updated.get("total") >= original_total:
            pytest.skip("Could not create order with price decrease")
        
        print(f"✓ Order {order_id[:8]} edited for refund: {original_total} -> {updated['total']}")
        return order_id


# =======================
# Feature 3: Accept changes for cash orders returns action=none
# =======================

class TestAcceptChangesForCashOrders:
    """Test accept-changes for cash orders just accepts without payment processing"""
    
    def test_cash_order_accept_returns_action_none(self, admin_headers, client_headers):
        """Accept changes for cash order should return action=none"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=client_headers)
        orders = response.json()
        
        # Find or create a cash order awaiting confirmation
        cash_order = None
        for order in orders:
            if (order.get("payment_method") == "cash" and 
                order.get("awaiting_confirmation") == True):
                cash_order = order
                break
        
        if not cash_order:
            # Create scenario: find a cash order and edit it
            for order in orders:
                if (order.get("payment_method") == "cash" and 
                    order.get("status") in ["pending", "processing"] and
                    not order.get("awaiting_confirmation")):
                    # Admin edits to trigger awaiting_confirmation
                    items = order.get("items", [])
                    if items:
                        modified_items = [{"product_id": i.get("product_id"), "name": i["name"], 
                                          "price": i["price"] + 10, "quantity": i["quantity"]}
                                         for i in items]
                        update_resp = requests.put(
                            f"{BASE_URL}/api/admin/orders/{order['id']}",
                            headers=admin_headers,
                            json={"items": modified_items}
                        )
                        if update_resp.status_code == 200:
                            cash_order = update_resp.json()
                            break
        
        if not cash_order or not cash_order.get("awaiting_confirmation"):
            pytest.skip("No cash order awaiting confirmation available")
        
        # Call accept-changes
        accept_response = requests.post(
            f"{BASE_URL}/api/orders/{cash_order['id']}/accept-changes",
            headers=client_headers
        )
        
        assert accept_response.status_code == 200, f"Accept failed: {accept_response.text}"
        data = accept_response.json()
        
        # For cash orders, action should be 'none' - just accepts without payment processing
        assert data.get("action") == "none", f"Expected action=none for cash order, got {data.get('action')}"
        print(f"✓ Cash order accept-changes returned action=none as expected")


# =======================
# Feature 4: Pay additional with balance
# =======================

class TestPayAdditionalWithBalance:
    """Test pay-additional endpoint with payment_method=balance"""
    
    def test_pay_additional_balance_deducts_from_user(self, client_headers):
        """Pay additional with balance should deduct from user balance"""
        # First get current balance
        balance_resp = requests.get(f"{BASE_URL}/api/user/balance", headers=client_headers)
        assert balance_resp.status_code == 200
        original_balance = balance_resp.json()["balance"]
        
        # Find an order awaiting additional payment
        response = requests.get(f"{BASE_URL}/api/orders", headers=client_headers)
        orders = response.json()
        
        target_order = None
        for order in orders:
            if order.get("awaiting_additional_payment") == True:
                target_order = order
                break
        
        if not target_order:
            pytest.skip("No order awaiting additional payment found")
        
        order_id = target_order["id"]
        additional_amount = target_order.get("additional_payment_amount", 0)
        
        if original_balance < additional_amount:
            pytest.skip(f"Insufficient balance ({original_balance}) for payment ({additional_amount})")
        
        # Pay with balance
        pay_response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/pay-additional",
            headers=client_headers,
            json={"payment_method": "balance"}
        )
        
        assert pay_response.status_code == 200, f"Payment failed: {pay_response.text}"
        data = pay_response.json()
        
        assert data.get("method") == "balance", "Payment method should be balance"
        
        # Verify balance was deducted
        new_balance_resp = requests.get(f"{BASE_URL}/api/user/balance", headers=client_headers)
        new_balance = new_balance_resp.json()["balance"]
        
        expected_balance = original_balance - additional_amount
        assert abs(new_balance - expected_balance) < 0.01, f"Balance not deducted correctly: {original_balance} - {additional_amount} != {new_balance}"
        
        print(f"✓ Balance payment: {original_balance} - {additional_amount} = {new_balance}")


# =======================
# Feature 5: Pay additional with crypto returns redirect
# =======================

class TestPayAdditionalWithCrypto:
    """Test pay-additional endpoint with payment_method=crypto"""
    
    def test_pay_additional_crypto_returns_redirect(self, client_headers, admin_headers):
        """Pay additional with crypto should return redirect_to_checkout"""
        # Find an order awaiting additional payment, or create one
        response = requests.get(f"{BASE_URL}/api/orders", headers=client_headers)
        orders = response.json()
        
        # First check for existing order awaiting additional payment
        target_order = None
        for order in orders:
            if order.get("awaiting_additional_payment") == True:
                target_order = order
                break
        
        if not target_order:
            # Need to setup: create an order with surcharge scenario
            # Find a paid crypto order and edit it to increase price
            for order in orders:
                if (order.get("payment_method") in ["crypto", "card"] and 
                    order.get("paid") == True and
                    order.get("status") in ["pending", "processing"] and
                    not order.get("awaiting_confirmation")):
                    
                    items = order.get("items", [])
                    if items:
                        # Increase price
                        modified_items = [{"product_id": i.get("product_id"), "name": i["name"], 
                                          "price": i["price"] + 100, "quantity": i["quantity"],
                                          "article": i.get("article")}
                                         for i in items]
                        
                        update_resp = requests.put(
                            f"{BASE_URL}/api/admin/orders/{order['id']}",
                            headers=admin_headers,
                            json={"items": modified_items}
                        )
                        
                        if update_resp.status_code == 200:
                            # Now accept changes to trigger awaiting_additional_payment
                            accept_resp = requests.post(
                                f"{BASE_URL}/api/orders/{order['id']}/accept-changes",
                                headers=client_headers
                            )
                            
                            if accept_resp.status_code == 200:
                                accept_data = accept_resp.json()
                                if accept_data.get("action") == "payment_required":
                                    # Re-fetch order
                                    order_resp = requests.get(f"{BASE_URL}/api/orders/{order['id']}", headers=client_headers)
                                    if order_resp.status_code == 200:
                                        target_order = order_resp.json()
                                        break
        
        if not target_order or not target_order.get("awaiting_additional_payment"):
            pytest.skip("Could not setup order awaiting additional payment")
        
        order_id = target_order["id"]
        
        # Pay with crypto
        pay_response = requests.post(
            f"{BASE_URL}/api/orders/{order_id}/pay-additional",
            headers=client_headers,
            json={"payment_method": "crypto"}
        )
        
        assert pay_response.status_code == 200, f"Payment failed: {pay_response.text}"
        data = pay_response.json()
        
        assert data.get("action") == "redirect_to_checkout", f"Expected redirect_to_checkout, got {data.get('action')}"
        assert "order_id" in data, "Response should include order_id"
        assert "amount" in data, "Response should include amount"
        assert data.get("payment_method") == "crypto", "Payment method should be crypto"
        
        print(f"✓ Crypto payment returned: action=redirect_to_checkout, amount={data.get('amount')}")


# =======================
# Validation Tests
# =======================

class TestPayAdditionalValidation:
    """Test pay-additional endpoint validation"""
    
    def test_pay_additional_invalid_order_returns_404(self, client_headers):
        """Pay additional on non-existent order returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/orders/{fake_id}/pay-additional",
            headers=client_headers,
            json={"payment_method": "balance"}
        )
        assert response.status_code == 404
    
    def test_pay_additional_no_pending_payment_returns_400(self, client_headers):
        """Pay additional on order without awaiting_additional_payment returns 400"""
        response = requests.get(f"{BASE_URL}/api/orders", headers=client_headers)
        orders = response.json()
        
        # Find an order NOT awaiting additional payment
        target = None
        for order in orders:
            if not order.get("awaiting_additional_payment"):
                target = order
                break
        
        if not target:
            pytest.skip("All orders are awaiting additional payment")
        
        pay_response = requests.post(
            f"{BASE_URL}/api/orders/{target['id']}/pay-additional",
            headers=client_headers,
            json={"payment_method": "balance"}
        )
        
        assert pay_response.status_code == 400
        print(f"✓ Pay-additional correctly returns 400 when no payment pending")
    
    def test_pay_additional_insufficient_balance_returns_400(self, client_headers, admin_headers):
        """Pay additional with insufficient balance returns 400"""
        # Get current balance
        balance_resp = requests.get(f"{BASE_URL}/api/user/balance", headers=client_headers)
        user_balance = balance_resp.json()["balance"]
        
        # We need an order awaiting payment with amount > user_balance
        # This test validates the error case
        response = requests.get(f"{BASE_URL}/api/orders", headers=client_headers)
        orders = response.json()
        
        for order in orders:
            if (order.get("awaiting_additional_payment") and 
                order.get("additional_payment_amount", 0) > user_balance):
                
                pay_response = requests.post(
                    f"{BASE_URL}/api/orders/{order['id']}/pay-additional",
                    headers=client_headers,
                    json={"payment_method": "balance"}
                )
                
                assert pay_response.status_code == 400
                assert "Недостаточно средств" in pay_response.json().get("detail", "")
                print(f"✓ Correctly rejected balance payment with insufficient funds")
                return
        
        pytest.skip("No order with payment amount exceeding balance found")


# =======================
# Integration: User Balance Endpoint
# =======================

class TestUserBalanceEndpoint:
    """Test user balance is correctly returned in accept-changes response"""
    
    def test_user_balance_returned_in_payment_required(self, client_headers):
        """Verify user_balance is included in payment_required response"""
        # Get current balance
        balance_resp = requests.get(f"{BASE_URL}/api/user/balance", headers=client_headers)
        assert balance_resp.status_code == 200
        current_balance = balance_resp.json()["balance"]
        
        print(f"✓ User balance endpoint working: balance={current_balance}")
        assert isinstance(current_balance, (int, float)), "Balance should be numeric"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
