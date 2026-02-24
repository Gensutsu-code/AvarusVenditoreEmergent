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
- Glassmorphism UI redesign

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
│   ├── orders.py           # Orders with cancel/return to cart
│   ├── settings.py         # Payment adjustments (+/- %)
│   └── ...
```

### Frontend (React + Framer Motion)
```
/app/frontend/src/
├── pages/              # Glassmorphism redesigned pages
│   ├── HomePage.js     # ✅ Redesigned
│   ├── LoginPage.js    # ✅ Redesigned
│   ├── CartPage.js     # ✅ Redesigned
│   ├── CatalogPage.js  # ✅ Partially redesigned
│   ├── CheckoutPage.js # ⏳ Needs completion
│   └── AdminPage.js    # ⏳ Needs restructuring
├── components/
│   ├── Header.js       # ✅ Redesigned
│   ├── ProductCard.js  # ✅ Redesigned
│   ├── PopularProducts.js # ✅ Redesigned
│   └── ...
```

## What's Been Implemented

### Session: February 24, 2026

#### Functional Improvements (COMPLETED)
1. **Payment Method Price Adjustments**
   - Changed from "discounts only" to full +/- price adjustments
   - Negative value = discount (e.g., -10% for cash)
   - Positive value = surcharge (e.g., +10% for card)
   - All configurable in admin panel

2. **Order Cancellation and Cart Return**
   - Unpaid orders can be cancelled
   - Items automatically return to cart
   - Stock is restored
   - API: `POST /api/orders/{id}/cancel`

3. **Notification Counter Fix**
   - Clicking individual notification marks it as read
   - Counter decreases immediately
   - API: `PUT /api/my-notifications/{id}/read`

4. **Crypto Payment Markup (+3%)**
   - Returned configurable markup to crypto conversion
   - Adjustable in admin panel

#### Glassmorphism Redesign (IN PROGRESS)

**Completed:**
- Header.js - Dark theme with gradient logo, framer-motion animations
- HomePage.js - Full glassmorphism with animated hero section
- LoginPage.js - Glass card with animated background
- CartPage.js - Glass cards with motion animations
- ProductCard.js - Glass effect with hover animations
- PopularProducts.js - Grid with glass cards
- CatalogPage.js - Partial update (search, categories)
- tailwind.config.js - Extended with glass utilities, keyframes
- index.css - Glassmorphism utility classes, dark theme variables

**Pending:**
- CheckoutPage.js - Full redesign
- AccountPage.js - Full redesign
- AdminPage.js - Full restructuring + redesign
- RegisterPage.js - Full redesign
- OrdersPage.js - Full redesign

**Admin Panel Restructuring (PENDING):**
- "Оплата" + "Крипто" → "Платежи"
- "Аналитика" + "Клиенты" → "CRM"
- "Акции" + "Новости" + "Рассылки" → "Маркетинг"
- "TG" + "Импорт" + "Партнеры" + "Правила" → "Настройки"
- Orders → separate page
- Chats → separate page

## Test Credentials
- **Admin:** admin@avarus.ru / admin123
- **User:** test@example.com / password123

## Current Payment Settings
- **Cash:** Adjustable (default -15%)
- **Card:** Adjustable (default 0%)
- **Crypto:** Adjustable (default -20%)
- **Balance:** Adjustable (default 0%)
- **Crypto Markup:** 3% (configurable)

## Preview URL
https://balance-checkout.preview.emergentagent.com

## Design System

### Color Palette (Dark Glassmorphism)
- Background: zinc-950 (#09090b)
- Primary: orange-500 (#f97316) to orange-600
- Glass: white/5 to white/10 with backdrop-blur-xl
- Text: zinc-100 (primary), zinc-400 (secondary), zinc-500 (muted)
- Borders: white/10

### Components
- Buttons: Gradient with shadow-glow, rounded-xl
- Cards: glass-card class (bg-zinc-900/60 backdrop-blur-xl border-white/10)
- Inputs: bg-zinc-800/50 border-zinc-700/50 rounded-xl
- Animations: framer-motion for all interactions

## Pending Tasks

### P0 - Critical (Continue Next Session)
1. **Complete Glassmorphism Redesign**
   - CheckoutPage.js
   - AccountPage.js  
   - RegisterPage.js
   - OrdersPage.js
   - All remaining components

2. **Admin Panel Restructuring**
   - Merge tabs as specified
   - Create separate Orders page
   - Create separate Chats page
   - Apply glassmorphism to admin UI

### P1 - Important
3. **YooKassa Payment Return Handling**
   - Handle incomplete card payments
   - Return items to cart if payment not completed

### P2 - Future
4. **Real Payment Gateway Integration** - Stripe
5. **Multi-language support**

## Technical Notes
- framer-motion installed for animations
- Glassmorphism CSS variables configured in index.css
- Dark theme foundation ready
- tailwind.config.js extended with custom animations and colors
