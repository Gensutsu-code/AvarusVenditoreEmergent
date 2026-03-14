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

## March 2026 - Login Fix Verification + Newsletter + CSV Import (COMPLETED)
- **Login verification**: Confirmed login works for both admin and client users
- **CSV Import/Export**: Fixed URL mismatch (frontend → backend), added CSV export endpoint, template/prompt downloads working
- **Email Newsletter - Selective Sending**: Added user selection UI with search, select all/deselect, individual toggles
- **Backend**: Updated BulkEmailRequest to accept `user_ids` for selective sending, added `/admin/products/csv-export` endpoint
- **Frontend**: Updated NotificationsTab with "Все/Выборочно" toggle and user list, updated SettingsTab ImportTab with working buttons
- **Note**: Resend API is in sandbox mode - can only send to avopt.store@gmail.com. Need to verify domain at resend.com/domains for production use
- Testing: 12/12 backend + 6/6 frontend tests passed (iteration_41)

## February 2026 - Cancel Pending Orders by Client (COMPLETED)
- Clients can now cancel orders in "pending" (Ожидает) status

## February 2026 - Client Analytics System (COMPLETED)
- Analytics button in CRM tab, UserAnalyticsModal, click tracking, backend analytics API
- Testing: 15/15 backend tests passed (iteration_41)

## February 2026 - Full Notification System (COMPLETED)
- Client/admin notifications, centralized notify.py, AdminNotificationsPage
- Testing: 10/10 backend + 5/5 frontend (iteration_40)

## February 2026 - Global Notification System with Sound (COMPLETED)
- Global polling, toast + chime sound, push notifications

## February 2026 - Client Order Card Redesign (COMPLETED)
- Compact item layout, warehouse/delivery fields

## February 2026 - Surcharge Payment Method Choice (COMPLETED)
- Client can choose payment method for surcharges

## February 2026 - Order Status System Overhaul (COMPLETED)
- 4 statuses: Ожидает → Обработка → Выполнен / Отменён

## February 2026 - Balance in Header (COMPLETED)
- User balance display, auto-refresh

### Earlier Sessions (Completed)
- Product Card Redesign, Search Dropdown, Floating Promo Banner
- Product Stock System, Admin Order Price Fix, Client Order Page UI
- Admin Orders Page Overhaul, Order Change Notifications
- Sound & Push Notifications, Background task for expired orders
- Crypto Payment Modal, Balance/prepayment system

## Architecture
```
/app
├── backend/
│   ├── server.py           # FastAPI + lifespan background tasks
│   ├── models.py           # Pydantic models
│   ├── database.py         # MongoDB connection
│   └── routes/
│       ├── admin.py        # Admin CRUD, CSV import/export
│       ├── orders.py       # Cart, orders, favorites, notifications
│       ├── auth.py         # Authentication
│       ├── products.py     # Product catalog
│       ├── balance.py      # Balance management
│       ├── notifications.py # Email notifications + selective sending
│       ├── crypto_payments.py # Crypto payment logic
│       ├── payments.py     # ЮKassa (MOCKED)
│       ├── analytics.py    # User activity tracking
│       └── ... (settings, news, chat, bonus, etc.)
├── frontend/src/
│   ├── pages/
│   │   ├── AdminPage.js        # Admin panel with tabs
│   │   ├── OrdersPage.js       # Client orders
│   │   └── ... (other pages)
│   ├── components/
│   │   ├── admin/
│   │   │   ├── NotificationsTab.js  # Email settings + selective sending
│   │   │   ├── SettingsTab.js       # Import/Export + Telegram + etc.
│   │   │   ├── MarketingTab.js      # Promo + News + Newsletters
│   │   │   └── ...
│   │   └── ...
│   └── context/ (AuthContext, CartContext, ThemeContext)
```

## Key DB Schema
- `users`: `{ id, email, password, name, phone, role, balance, customer_status, individual_discount }`
- `orders`: `{ id, user_id, items[], total, status, payment_method, paid, has_changes }`
- `products`: `{ id, name, article, manufacturer, price, stock, image_url }`
- `notifications`: `{ user_id, message, link, read, created_at }`

## 3rd Party Integrations
- Resend (email - SANDBOX MODE), web3.py (crypto backend), ethers.js (crypto frontend)
- CoinGecko (exchange rates), Cloudinary (image uploads)
- ЮKassa (MOCKED card payments)

## Upcoming Tasks (P1)
1. **WalletConnect Support** - Wider range of crypto wallets for payment
2. **Real Payment Gateway** - Replace ЮKassa placeholder with production provider

## Future/Backlog (P2)
1. **Refactoring**: Extract ProductCard, simplify AdminPage.js, centralize notification helpers
2. **Resend Domain Verification** - Verify domain for production email sending

## Credentials
- Admin: admin@avarus.ru / admin
- Client: user@demo.com / demo123
