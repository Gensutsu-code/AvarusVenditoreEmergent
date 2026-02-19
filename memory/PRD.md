# AVOPT.STORE - E-Commerce Platform for Heavy Vehicle Parts

## Original Problem Statement
E-commerce platform for selling heavy vehicle parts with:
- Product catalog with categories
- Shopping cart and checkout
- User authentication and profiles
- Admin panel for managing products, orders, users
- Bonus programs and discounts
- Chat support with Telegram integration
- Payment methods (cash, card, crypto)

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
│   ├── settings.py     # Discount, payment settings
│   ├── news.py         # News articles
│   ├── chat.py         # User/admin chat
│   ├── bonus.py        # Bonus programs
│   ├── uploads.py      # File uploads, avatars
│   ├── partners.py     # Partner brands
│   ├── requests.py     # Status/discount requests
│   ├── telegram.py     # Telegram integration
│   ├── payments.py     # YooKassa, crypto
│   └── documents.py    # Invoice/receipt routes
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── AdminPage.js    # Admin panel (monolithic, ~4900 lines)
│   ├── CheckoutPage.js # Checkout with payment methods
│   └── ...
├── components/
│   ├── admin/          # Reusable admin components (prepared for future refactoring)
│   │   ├── ProductsTab.js
│   │   ├── CategoriesTab.js
│   │   ├── OrdersTab.js
│   │   ├── UsersTab.js
│   │   └── NewsTab.js
│   └── ui/             # Shadcn UI components
```

## What's Been Implemented

### Session: February 11, 2025

#### Backend Refactoring ✅
- Split monolithic `server.py` (4000+ lines) into modular routes
- Created 14 route files in `/app/backend/routes/`
- Centralized database connection in `database.py`
- All 23+ API test cases passing
- No breaking changes to API contracts

#### Features Fixed/Added:
1. **Checkout Page Price Calculation** ✅
   - Fixed sequential discount application (user discount → payment discount)
   
2. **Payment Method Toggle** ✅
   - Admin can enable/disable payment methods
   - Disabled methods show "Временно недоступно" on checkout

3. **Bonus History Endpoint** ✅
   - Added `/api/admin/bonus/history`
   - Added alias `/api/admin/prize-redemptions`

## API Endpoints Summary

### Public
- `GET /api/health` - Health check
- `GET /api/products` - Product list
- `GET /api/categories` - Categories
- `GET /api/payment-settings` - Payment method settings
- `GET /api/discount-settings` - Discount settings
- `GET /api/promo-banner` - Promo banner
- `GET /api/news` - News articles
- `GET /api/partners` - Partner brands

### Auth Required
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `PUT /api/auth/profile` - Update profile
- `GET /api/cart` - Get cart
- `POST /api/orders` - Create order
- `GET /api/favorites` - Favorites

### Admin Required
- `GET /api/admin/stats` - Dashboard stats
- `GET /api/admin/orders` - All orders
- `GET /api/admin/users` - All users
- `GET /api/admin/products/export` - Export CSV
- `POST /api/admin/products/import` - Import CSV

## Test Credentials
- **Admin:** admin@avarus.ru / admin123
- **User:** TEST@MAIL.RU / admin123

## Remaining Tasks

### P0 (High Priority)
- [ ] Frontend refactoring - integrate prepared components into AdminPage.js

### P1 (Medium Priority)
- [ ] Payment integrations (YooKassa, crypto verification)
- [ ] Telegram bot setup

### P2 (Low Priority)
- [ ] Email notifications
- [ ] Advanced analytics
- [ ] Mobile optimization

## Known Issues
- None critical after refactoring

## Preview URL
https://checkout-refactor-2.preview.emergentagent.com
