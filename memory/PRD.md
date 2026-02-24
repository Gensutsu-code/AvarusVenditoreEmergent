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
```
/app/backend/
├── server.py           # Main entry point
├── database.py         # MongoDB connection
├── models.py           # Pydantic models
├── routes/             # API routes
│   ├── balance.py      # Balance/prepayment system
│   ├── terms.py        # Terms of Service CRUD
│   ├── notifications.py # Email notifications with Resend
│   ├── orders.py       # Orders with balance payment support
│   └── ...
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── AccountPage.js  # User profile with balance card
│   ├── CheckoutPage.js # Checkout with balance payment option
│   ├── AdminPage.js    # Admin panel
│   └── ...
├── components/admin/   # Extracted admin tab components
│   ├── PromoTab.js
│   ├── TelegramTab.js
│   ├── TermsTab.js
│   ├── NotificationsTab.js
│   └── ...
```

## What's Been Implemented

### Session: February 24, 2026

#### Prepayment/Balance System (NEW - COMPLETED)
Full mock prepayment system allowing users to manage account balance:

**Backend APIs:**
- `GET /api/user/balance` - Get user's current balance
- `POST /api/user/balance/topup` - Top up balance (card = instant, crypto = pending)
- `GET /api/user/balance/history` - Get transaction history
- `POST /api/user/balance/confirm-crypto` - Confirm crypto topup with tx_hash
- `GET /api/prepayment-settings` - Public prepayment settings
- `GET/PUT /api/admin/prepayment-settings` - Admin settings management
- `GET /api/admin/balance-transactions` - Admin view all transactions

**Frontend Features:**
- Balance card on `/account` page showing current balance
- "Пополнить" (Top up) button with modal
- Quick amount buttons (1000, 3000, 5000, 10000₽)
- Card and Crypto payment method selection
- Crypto network selection (ETH, BSC, Base, TRC20)
- Balance history modal showing all transactions
- "Оплата с баланса" (Pay from balance) option on checkout
- Balance deduction on order with full transaction logging

**Testing Status:** PASSED (100% backend, 100% frontend)

### Session: February 22, 2025

#### Editable Terms of Service
- Admin panel "Правила" tab for editing terms sections
- CRUD API for terms: GET /api/terms, PUT /api/admin/terms
- Reset to default functionality
- Checkout page modal fetches terms dynamically

#### Email Notifications System
- Resend integration for sending transactional emails
- Admin panel "Рассылки" tab with notification toggles
- Test email functionality
- Bulk email/promotional emails form

#### AdminPage.js Refactoring
Extracted 8 components from AdminPage.js:
- `PromoTab.js` - Promo banner management
- `TelegramTab.js` - Telegram notification settings
- `StatsTab.js` - Analytics dashboard
- `DiscountsTab.js` - Payment settings and crypto wallets
- `TermsTab.js` - Terms of Service editor
- `NotificationsTab.js` - Email notification settings
- `PartnersTab.js` - Partners management
- `BonusTab.js` - Bonus programs

### Session: February 11, 2025
- Terms of Service agreement checkbox on checkout
- Removed customer statuses and individual discounts
- Backend refactoring completed

## Test Credentials
- **Admin:** admin@example.com / admin123
- **User:** test@example.com / password123

## Data Test IDs

### Balance/Prepayment System
- `account-page` - Account page container
- `balance-amount` - Balance display
- `topup-btn` - Open topup modal button
- `balance-history-btn` - Open history modal button
- `topup-modal` - Topup modal container
- `topup-amount-input` - Topup amount input
- `topup-card-method` - Card payment option
- `topup-crypto-method` - Crypto payment option
- `confirm-topup-btn` - Confirm topup button
- `history-modal` - History modal container
- `payment-method-balance` - Balance payment option on checkout

### Checkout/Terms
- `terms-checkbox` - Terms agreement checkbox
- `terms-link` - Link to open terms modal
- `terms-modal` - Modal with terms content
- `accept-terms-btn` - Accept button in modal
- `place-order-btn` - Place order button
- `checkout-success` - Success page container

### Admin Panel
- `save-terms-btn` - Save terms button
- `notif-order-confirmation` - Order confirmation toggle
- `notif-order-status` - Order status toggle
- `notif-promotions` - Promotions toggle
- `test-email-input` - Test email input
- `send-test-email-btn` - Send test email button

## Preview URL
https://balance-checkout.preview.emergentagent.com

## Pending/Future Tasks

### P1 - Upcoming
- **Extract ChatTab from AdminPage.js** - The ChatTab content is still inline within AdminPage.js. Should be extracted to `/app/frontend/src/components/admin/ChatTab.js`

### P2 - Future
- **Real Payment Gateway Integration** - Integrate Stripe or other payment systems to replace the mock prepayment system
- **Additional email templates** - More customizable email templates for different notification types

## Notes
- **Prepayment is MOCKED:** Card payments instantly credit balance, no real payment processing
- **Resend API is in sandbox mode:** Emails can only be sent to verified addresses
- **To enable full email:** Verify domain at resend.com/domains
