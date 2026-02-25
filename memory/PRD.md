# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with:
- Product catalog with search and filters
- User authentication and profiles
- Shopping cart and checkout
- Order management
- Admin panel for products, orders, users management
- Mock prepayment/balance system
- Cryptocurrency payment system (MetaMask)
- Full site redesign with glassmorphism aesthetic
- Theme switching (dark/light)

## User Personas
1. **Customers** - Browse products, place orders, manage account balance
2. **Administrators** - Manage products, orders, users, payment settings

## Core Requirements

### User-Facing Features
- [x] Product catalog with search, filters, categories
- [x] User registration and authentication
- [x] Shopping cart functionality
- [x] Checkout with multiple payment methods
- [x] User profile management
- [x] Balance/prepayment system
- [x] Cryptocurrency payments (MetaMask)
- [x] Order tracking
- [x] Notifications

### Admin Features
- [x] Product CRUD operations
- [x] Order management
- [x] User management
- [x] Payment settings (adjustments/discounts)
- [x] Crypto wallet settings
- [x] Analytics dashboard

## What's Been Implemented

### December 2025 - Session Updates:

#### Theme Switching Feature (COMPLETED)
- Created ThemeContext for managing dark/light themes
- Added theme toggle button in Header (Sun/Moon icons)
- Implemented localStorage persistence for theme preference
- **Light theme colors** (as requested by user):
  - Background gradient: RGB(224,255,255) → RGB(255,192,203) → RGB(240,255,255)
  - Primary accents: Green (green-500 to emerald-600)
  - Text: slate-800
  - Cards: white/60 with cyan borders
- **Dark theme colors**:
  - Background: zinc-950
  - Primary accents: Orange (orange-500 to orange-600)
  - Text: zinc-100
  - Cards: zinc-900/60 with white/10 borders
- CSS variables properly configured for both themes
- Glassmorphism effects work in both themes

#### Glassmorphism Redesign (IN PROGRESS)
Completed pages:
- [x] HomePage - Hero section, features, about
- [x] LoginPage - Glass card, gradient background
- [x] RegisterPage - Glass card, animations
- [x] CatalogPage - Product cards, filters
- [x] CartPage - Item list, summary
- [x] CheckoutPage - Form, payment methods, summary
- [x] AccountPage - Profile, balance, security

Remaining pages:
- [ ] AdminPage and all admin tabs
- [ ] ProductPage (single product view)

#### Previous Session Completions:
- Mock prepayment system (user balance top-up)
- Cryptocurrency payment system (MetaMask modal)
- Order cancellation with cart restoration
- Payment method adjustments (surcharges/discounts)
- Notification counter fix

## Tech Stack
- **Frontend**: React, TailwindCSS, Shadcn/UI, Framer Motion
- **Backend**: FastAPI, Python
- **Database**: MongoDB
- **Auth**: JWT

## Key Files
- `/app/frontend/src/context/ThemeContext.js` - Theme management
- `/app/frontend/src/components/Header.js` - Navigation with theme toggle
- `/app/frontend/src/index.css` - Theme CSS variables and glassmorphism styles
- `/app/frontend/tailwind.config.js` - Tailwind theme configuration

## Mocked Features
- **Prepayment system** - Simulates balance top-up (card/crypto)
- **Crypto payments** - MetaMask flow without real transactions

## Prioritized Backlog

### P0 (High Priority)
- [ ] Complete AdminPage glassmorphism redesign
- [ ] Admin panel restructuring (merge tabs as requested)

### P1 (Medium Priority)
- [ ] ProductPage redesign
- [ ] More animations on page transitions
- [ ] Mobile responsiveness improvements

### P2 (Future)
- [ ] Real payment integration (Stripe/YooKassa)
- [ ] Real crypto payment processing
- [ ] Email notifications (Resend integration ready)

## Test Credentials
- **User**: newtest@example.com / password123
- **Admin**: admin@avarus.ru / admin

## API Endpoints Reference
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET/PUT /api/auth/profile` - Profile management
- `GET/POST /api/user/balance` - Balance operations
- `GET /api/products` - Product listing
- `POST /api/orders` - Create order
- `POST /api/orders/{id}/cancel` - Cancel order
- `GET/POST /api/admin/payment-settings` - Payment configuration
- `GET/POST /api/admin/crypto-settings` - Crypto wallet settings
