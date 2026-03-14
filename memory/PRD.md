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

### March 14, 2026 - User Account Blocking (COMPLETED)
- **Admin block/unblock toggle** in CRM tab (shield icons per user)
- **Backend**: `POST /api/admin/users/{user_id}/block` toggles `blocked` field
- **Login protection**: Blocked users get 403 `account_blocked` on login attempt
- **Active session protection**: `get_current_user` checks `blocked` field, returns 403 — AuthContext interceptor auto-logouts
- **Safety guards**: Can't block yourself, can't block admins
- **Frontend**: "Заблокирован" badge, block/unblock icons, confirmation dialogs, proper error toasts
- Testing: 8/8 backend + 4/4 frontend tests passed (iteration_42)

### March 14, 2026 - Login Fix + Newsletter + CSV Import (COMPLETED)
- **Login verification**: Confirmed working for admin and client
- **CSV Import/Export**: Fixed URL mismatch, added export endpoint, template/prompt downloads
- **Email Newsletter - Selective Sending**: User selection UI with search, select all/deselect
- **Note**: Resend API in sandbox mode — only avopt.store@gmail.com can receive emails
- Testing: 12/12 backend + 6/6 frontend tests passed (iteration_41)

### Earlier Sessions (Completed)
- Client Analytics, Notification System, News/Banners Editor
- Order cancellation, Bonus system, UI improvements
- Product Card Redesign, Search, Floating Promo Banner
- Product Stock, Admin Order Management, Sound/Push Notifications
- Crypto Payments, Balance system, Background tasks

## Architecture
```
/app
├── backend/routes/
│   ├── admin.py        # Admin CRUD, CSV, user blocking
│   ├── auth.py         # Authentication with blocked check
│   ├── notifications.py # Email + selective sending
│   └── ... (orders, products, analytics, bonus, etc.)
├── backend/database.py  # get_current_user with blocked check
├── frontend/src/
│   ├── context/AuthContext.js  # 403 blocked interceptor
│   ├── pages/AdminPage.js     # Main admin with tabs
│   ├── components/admin/
│   │   ├── CRMTab.js          # User list with block toggle
│   │   ├── NotificationsTab.js # Selective email sending
│   │   └── SettingsTab.js      # Import/Export
│   └── pages/LoginPage.js     # Blocked user error handling
```

## 3rd Party Integrations
- Resend (email - SANDBOX), web3.py/ethers.js (crypto), CoinGecko, Cloudinary
- ЮKassa (MOCKED card payments)

## Upcoming Tasks (P1)
1. WalletConnect Support
2. Real Payment Gateway (replace ЮKassa)

## Future/Backlog (P2)
1. Resend domain verification for production emails
2. Refactoring: notification helpers, AdminPage.js simplification

## Credentials
- Admin: admin@avarus.ru / admin
- Client: user@demo.com / demo123
