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
├── documents.py        # Invoice/receipt generation
├── cloudinary_service.py # Image uploads
├── routes/
│   ├── __init__.py     # Router aggregation
│   ├── auth.py         # Authentication
│   ├── products.py     # Products & categories
│   ├── orders.py       # Cart, orders, favorites
│   ├── admin.py        # Admin user/order management
│   ├── settings.py     # Payment settings
│   ├── news.py         # News articles
│   ├── chat.py         # User/admin chat
│   ├── bonus.py        # Bonus programs
│   ├── uploads.py      # File uploads, avatars
│   ├── partners.py     # Partner brands
│   ├── telegram.py     # Telegram integration
│   ├── payments.py     # YooKassa, crypto
│   └── documents.py    # Invoice/receipt routes
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── AdminPage.js    # Admin panel
│   ├── CheckoutPage.js # Checkout - only payment method discounts
│   └── ...
├── components/
│   └── ui/             # Shadcn UI components
```

## What's Been Implemented

### Session: February 11, 2025

#### Removed Features:
1. **Customer Statuses** - Removed retail, wholesale, partner statuses
2. **Status-based Discounts** - Removed discounts based on customer status
3. **Individual Discounts** - Removed per-user individual discounts
4. **Double Prices** - Removed original/discounted price display

#### Kept Features:
- ✅ Payment Method Discounts (cash, card, crypto)
- ✅ Payment Method Toggle (enable/disable)

#### Admin Panel Changes:
- Tab renamed from "Скидки" to "Оплата"
- Contains only: Payment method settings + Crypto wallets
- Removed: Status-based discounts, status statistics, individual discount settings

### Previous Session (same day):
- Backend refactoring completed (server.py split into modular routes)

## API Endpoints Summary

### Public
- `GET /api/health` - Health check
- `GET /api/products` - Product list
- `GET /api/categories` - Categories
- `GET /api/payment-settings` - Payment method settings and discounts

### Auth Required
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET /api/cart` - Get cart
- `POST /api/orders` - Create order (applies payment discount only)

### Admin Required
- `GET /api/admin/stats` - Dashboard stats
- `PUT /api/admin/payment-settings` - Update payment settings
- `PUT /api/admin/crypto-wallets` - Update crypto wallet addresses

## Test Credentials
- **Admin:** admin@avarus.ru / admin123

## Pricing Logic (Current)
```
subtotal = sum(item.price * item.quantity)
finalTotal = subtotal * (1 - paymentDiscount / 100)
```

No status-based or individual discounts are applied.

## Remaining Tasks

### P1 (Medium Priority)
- [ ] Payment integrations (YooKassa, crypto verification)
- [ ] Telegram bot setup

### P2 (Low Priority)
- [ ] Email notifications
- [ ] Mobile optimization

## Preview URL
https://checkout-refactor-2.preview.emergentagent.com
