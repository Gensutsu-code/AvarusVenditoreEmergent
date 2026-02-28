# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, and glassmorphism design.

## Core Requirements
- Admin panel for managing products, orders, users
- Client-side catalog with search, filters, favorites
- Cart and checkout with multiple payment methods (cash, card, crypto, balance)
- Order management with inline editing, change tracking, and client confirmation
- Push/sound notifications
- Bonus program with cashback

## What's Been Implemented

## February 2026 - Global Notification System with Sound (COMPLETED)
- Global polling in Header (client, 10s) and AdminNotifications (admin, 5s)
- On new notifications: toast message + two-tone chime sound (Web Audio API)
- Push notifications (browser Notification API) when tab is not focused
- Tracks baseline count to only trigger on truly new notifications
- Files: Header.js, AdminNotifications.js, utils/notifications.js

## February 2026 - Client Order Card Redesign (COMPLETED)
- Removed recipient/phone/address from client order cards
- Compact item layout: small image + inline article/manufacturer/warehouse/delivery
- Added warehouse and delivery_days fields to CartItemResponse and order creation
- Backfilled 69 existing orders with warehouse/delivery data from products
- Files: OrdersPage.js, models.py, orders.py

## February 2026 - Surcharge Payment Method Choice (COMPLETED)
- Client can now choose payment method for surcharges (balance, crypto, card) regardless of original payment method
- accept-changes returns payment_required + user_balance for non-cash price increases
- New surcharge modal with 3 options, disabled balance when insufficient
- Fixed article field preservation in admin order edit
- Testing: 5/5 backend + 5/5 frontend (iteration_39)

## February 2026 - Order Status System Overhaul (COMPLETED)
- Changed to 4 statuses only: Ожидает (pending) → Обработка (processing) → Выполнен (completed) / Отменён (cancelled)
- Replaced dropdown select with action buttons in admin: "Принять", "Выполнен", "Отменить"
- Buttons activate sequentially based on current status
- Migrated all existing orders in DB (new→pending, shipped→processing, delivered→completed)
- Hidden edit/action buttons for completed and cancelled orders
- Testing: 8/8 backend + 12/12 frontend (iteration_38)

## February 2026 - Balance in Header (COMPLETED)
- Added user balance display in the header (desktop + mobile)
- Fetched from `/api/user/balance`, refreshed every 15s alongside notifications
- Clickable → navigates to account page
- Files: `/app/frontend/src/components/Header.js`

### February 2026 - Order Change Payment Logic (COMPLETED)
- **Surcharge/Refund System**: When admin edits a paid order, the system calculates the price difference:
  - **Cash orders**: Just accept changes, no financial action
  - **Balance-paid, price increase**: Deducts surcharge from user balance
  - **Balance-paid, insufficient funds**: Returns payment_required action
  - **Crypto/Card-paid, price increase**: Returns redirect to payment page
  - **Any paid order, price decrease**: Refunds difference to user balance
- **Cancel order with refund**: When a paid order is cancelled (by client or system), funds are refunded to user balance
- **Bug fixes**:
  - Removed duplicate `/orders/{order_id}/cancel` route
  - Added `new` status to STATUS_LABELS, STATUS_COLORS, and ORDER_STATUSES
  - Fixed hardcoded payment method text to show actual method (криптовалютой, наличными, с баланса, картой)
  - Allow cancellation when awaiting_confirmation regardless of 24-hour processing window
- **Endpoints**:
  - `POST /api/orders/{id}/accept-changes` - handles all payment scenarios
  - `POST /api/orders/{id}/cancel` - handles refunds for paid orders
  - `POST /api/orders/{id}/pay-additional` - additional payment endpoint
  - `GET /api/user/balance` - returns user balance
- **Files**: `/app/backend/routes/orders.py`, `/app/backend/models.py`, `/app/frontend/src/pages/OrdersPage.js`, `/app/frontend/src/pages/AdminOrdersPage.js`
- **Testing**: 26/26 backend + 10/10 frontend tests passed (iteration_37)

### Earlier Sessions (Completed)
- Product Card Redesign (Catalog Page)
- Search Dropdown Behavior
- Floating Promo Banner
- Product Stock System Overhaul (boolean in-stock)
- Admin Order Price Fix (discounts included)
- Client Order Page UI (comparison view)
- Admin Orders Page Overhaul (inline editing)
- Order Change Notifications System
- Sound & Push Notifications foundation
- Background task for auto-cancelling expired orders
- Crypto Payment Modal with QR codes
- Balance/prepayment system

## Architecture
```
/app
├── backend/
│   ├── server.py           # FastAPI + lifespan background tasks
│   ├── models.py           # Pydantic models
│   ├── database.py         # MongoDB connection
│   └── routes/
│       ├── admin.py        # Admin CRUD + order editing
│       ├── orders.py       # Cart, orders, favorites, notifications
│       ├── auth.py         # Authentication
│       ├── products.py     # Product catalog
│       ├── balance.py      # Balance management
│       ├── crypto_payments.py # Crypto payment logic
│       ├── payments.py     # ЮKassa (MOCKED)
│       └── ... (settings, news, chat, bonus, etc.)
├── frontend/src/
│   ├── pages/
│   │   ├── OrdersPage.js       # Client orders with comparison UI
│   │   ├── AdminOrdersPage.js  # Admin orders with inline editing
│   │   ├── CatalogPage.js      # Product catalog
│   │   ├── CheckoutPage.js     # Checkout flow
│   │   └── ... (other pages)
│   ├── components/
│   │   ├── CryptoPaymentModal.js
│   │   ├── SearchDropdown.js
│   │   └── ... (other components)
│   └── context/ (AuthContext, CartContext, ThemeContext)
```

## Key DB Schema
- `users`: `{ id, email, password, name, phone, role, balance: float, customer_status, individual_discount }`
- `orders`: `{ id, user_id, items[], total, status, payment_method, paid, has_changes, change_types[], awaiting_confirmation, changes_expire_at, previous_items[], previous_total, paid_from_balance }`
- `products`: `{ id, name, article, manufacturer, price, stock, image_url }`

## 3rd Party Integrations
- Resend (email), web3.py (crypto backend), ethers.js (crypto frontend)
- CoinGecko (exchange rates), react-qr-code, framer-motion
- ЮKassa (MOCKED card payments)

## Upcoming Tasks (P1)
1. **WalletConnect Support** - Other wallets for crypto payment modal
2. **Full Push/Sound Notifications Integration** - All events covered

## Future/Backlog (P2)
1. **Real Payment Gateway** - Replace ЮKassa placeholder
2. **Refactoring**: Extract ProductCard from CatalogPage, break down large order pages

## Credentials
- Admin: admin@avarus.ru / admin
- Client: user@demo.com / demo123
