# AVOPT.STORE - E-Commerce Platform for Heavy Vehicle Parts

## Original Problem Statement
E-commerce platform for selling heavy vehicle parts with:
- Product catalog with categories
- Shopping cart and checkout
- User authentication and profiles
- Admin panel for managing products, orders, users
- Bonus programs
- Chat support with Telegram integration
- Multiple payment methods with configurable price adjustments

## Architecture

### Backend (FastAPI + MongoDB)
```
/app/backend/
├── server.py           # Main entry point
├── database.py         # MongoDB connection
├── models.py           # Pydantic models
├── routes/             # API routes
│   ├── crypto_payments.py  # MetaMask crypto payment system
│   ├── balance.py          # Balance/prepayment system
│   ├── terms.py            # Terms of Service CRUD
│   ├── notifications.py    # Email notifications with Resend
│   ├── orders.py           # Orders with cancel/return to cart
│   ├── settings.py         # Payment adjustments (+/- %)
│   └── ...
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── AccountPage.js      # User profile with balance
│   ├── CheckoutPage.js     # Checkout with payment adjustments
│   ├── AdminPage.js        # Admin panel
│   └── ...
├── components/
│   ├── CryptoPaymentModal.js  # MetaMask payment UI
│   ├── ClientNotifications.js # Fixed notification counter
│   └── admin/
│       ├── CryptoSettingsTab.js  # Crypto settings with markup
│       ├── DiscountsTab.js       # Payment adjustments (+/-)
│       └── ...
```

## What's Been Implemented

### Session: February 24, 2026

#### Payment Method Price Adjustments (NEW - COMPLETED)
- Changed from "discounts only" to full +/- price adjustments
- Negative value = discount (e.g., -10% for cash)
- Positive value = surcharge (e.g., +10% for card)
- All values configurable in admin panel per payment method:
  - Cash: configurable (default -10%)
  - Card: configurable (default 0%)
  - Crypto: configurable (default -15%)
  - Balance: configurable (default 0%)

**APIs:**
- `GET /api/payment-settings` - Returns all adjustments
- `PUT /api/admin/payment-settings` - Update adjustments

#### Order Cancellation and Cart Return (NEW - COMPLETED)
- Unpaid orders can be cancelled
- Items automatically return to cart
- Stock is restored

**API:**
- `POST /api/orders/{id}/cancel` - Cancel order and return items to cart

#### Notification Counter Fix (COMPLETED)
- Clicking individual notification now marks it as read
- Counter decreases immediately without requiring "read all"

**API:**
- `PUT /api/my-notifications/{id}/read` - Mark single notification as read

#### Crypto Payment Markup (UPDATED)
- Returned +3% markup to crypto conversion
- Markup percentage configurable in admin panel
- Default: 3%

#### Glassmorphism Design (IN PROGRESS)
- Updated tailwind.config.js with new animations and colors
- Updated index.css with glassmorphism utility classes
- Dark theme foundation laid
- Full component redesign pending

### Previously Completed

#### Crypto Payment System (COMPLETED)
- MetaMask wallet connection
- USDT/USDC on BSC, Base, Polygon
- Automatic blockchain verification
- Configurable receiving address

#### Prepayment/Balance System (COMPLETED)
- User balance display and top-up
- Balance payment option at checkout
- Transaction history

## Test Credentials
- **Admin:** admin@avarus.ru / admin123
- **User:** test@example.com / password123

## Current Payment Settings (as configured)
- **Cash:** -10% discount, enabled
- **Card:** +10% surcharge, enabled
- **Crypto:** -15% discount, enabled
- **Balance:** 0%, enabled
- **Crypto Markup:** 3%

## Preview URL
https://balance-checkout.preview.emergentagent.com

## Pending Tasks

### P0 - Critical (Next Session)
1. **Complete Glassmorphism Redesign**
   - Refactor all page components for dark theme
   - Update all cards, buttons, inputs to glass style
   - Add animations to all interactive elements
   - Admin panel restructuring:
     - "Оплата" + "Крипто" → "Платежи"
     - "Аналитика" + "Клиенты" → "CRM"
     - "Акции" + "Новости" + "Рассылки" → "Маркетинг"
     - "TG" + "Импорт" + "Партнеры" + "Правила" → "Настройки"
   - Orders → separate page
   - Chats → separate page

### P1 - Important
2. **YooKassa Payment Return Handling**
   - Handle incomplete card payments
   - Return items to cart if payment not completed

### P2 - Future
3. **Real Payment Gateway Integration** - Stripe
4. **Email notifications for crypto payments**
5. **Multi-language support**

## Technical Notes
- framer-motion installed for animations
- Glassmorphism CSS variables configured
- Dark theme foundation ready in index.css
- tailwind.config.js updated with new keyframes and colors
