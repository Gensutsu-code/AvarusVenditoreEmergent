# AVOPT.STORE - E-Commerce Platform for Heavy Vehicle Parts

## Original Problem Statement
E-commerce platform for selling heavy vehicle parts with:
- Product catalog with categories
- Shopping cart and checkout
- User authentication and profiles
- Admin panel for managing products, orders, users
- Bonus programs
- Chat support with Telegram integration
- Payment methods (cash, card, crypto) with discounts per payment method

## Architecture

### Backend (FastAPI + MongoDB)
**Refactored Structure (February 2025):**
```
/app/backend/
├── server.py           # Main entry point (~70 lines)
├── database.py         # MongoDB connection, auth helpers
├── models.py           # Pydantic models
├── routes/
│   ├── auth.py         # Authentication
│   ├── products.py     # Products & categories
│   ├── orders.py       # Cart, orders, favorites
│   ├── admin.py        # Admin user/order management
│   ├── settings.py     # Payment settings
│   ├── news.py, chat.py, bonus.py, etc.
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── AdminPage.js    # Admin panel - tab "Оплата"
│   ├── CheckoutPage.js # Checkout - only payment method discounts
│   ├── AccountPage.js  # User profile - clean, no status/discount info
│   ├── CatalogPage.js  # Single price display
│   ├── CartPage.js     # Single price display
│   ├── FavoritesPage.js # Single price display
│   └── ...
```

## What's Been Implemented

### Session: February 11, 2025

#### REMOVED Features:
1. **Customer Statuses** - retail, wholesale, partner
2. **Status-based Discounts** - discounts based on customer status
3. **Individual Discounts** - per-user individual discounts
4. **Double Prices** - all strikethrough/original price displays removed
5. **Status upgrade requests** - removed from user profile
6. **Personal discount requests** - removed from user profile

#### KEPT Features:
- ✅ Payment Method Discounts (cash, card, crypto)
- ✅ Payment Method Toggle (enable/disable)
- ✅ Crypto wallet settings

#### Admin Panel Changes:
- Tab renamed from "Скидки" to "Оплата"
- Contains only: Payment method settings + Crypto wallets

#### User Profile Changes:
- Removed: Status card, discount card, status upgrade request, personal discount request
- Kept: Avatar, name, email, password change

#### Pricing Display:
- All pages now show single price only
- No strikethrough prices
- No "Your price" vs "Retail price" comparisons

## API Endpoints Summary

### Public
- `GET /api/products` - Product list (single price)
- `GET /api/payment-settings` - Payment method settings

### Auth Required
- `POST /api/orders` - Create order (applies only payment discount)

### Admin Required
- `PUT /api/admin/payment-settings` - Update payment settings

## Test Credentials
- **Admin:** admin@avarus.ru / admin123

## Pricing Logic (Current)
```
subtotal = sum(item.price * item.quantity)
finalTotal = subtotal * (1 - paymentDiscount / 100)
```

No status-based or individual discounts. Single price everywhere.

## Preview URL
https://checkout-refactor-2.preview.emergentagent.com
