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

## What's Been Implemented

### December 2025 - Bug Fixes & Improvements

#### Promo Banner Fixes (COMPLETED)
- Fixed banner save API endpoint (was `/api/promo-banner`, now correctly `/api/admin/promo-banner`)
- Moved banner from below header into the header itself (centered between logo and icons)
- Removed "Avarus-Venditore" center text from header
- Added collapse/expand animation for banner:
  - Clicking X collapses banner to a small tag icon
  - Clicking icon expands banner back
  - State persisted in sessionStorage
- Banner no longer redirects on X click - just collapses

#### Theme Switching Feature (COMPLETED)
- Created ThemeContext for managing dark/light themes
- Added theme toggle button in Header (Sun/Moon icons)
- Implemented localStorage persistence for theme preference
- **Light theme colors** (as requested by user):
  - Background gradient: RGB(224,255,255) → RGB(255,192,203) → RGB(240,255,255)
  - Primary accents: Green (green-500 to emerald-600)
- **Dark theme colors**:
  - Background: zinc-950
  - Primary accents: Orange (orange-500 to orange-600)

#### Glassmorphism Redesign (IN PROGRESS)
Completed pages:
- [x] HomePage
- [x] LoginPage  
- [x] RegisterPage
- [x] CatalogPage
- [x] CartPage
- [x] CheckoutPage
- [x] AccountPage
- [x] BonusPage (partial - added theme support)

Remaining pages:
- [ ] AdminPage and all admin tabs
- [ ] ProductPage (single product view)

#### Previous Completions:
- Mock prepayment system (user balance top-up)
- Cryptocurrency payment system (MetaMask modal)
- Order cancellation with cart restoration
- Payment method adjustments (surcharges/discounts)

## Tech Stack
- **Frontend**: React, TailwindCSS, Shadcn/UI, Framer Motion
- **Backend**: FastAPI, Python
- **Database**: MongoDB
- **Auth**: JWT

## Key Files
- `/app/frontend/src/context/ThemeContext.js` - Theme management
- `/app/frontend/src/components/Header.js` - Navigation with theme toggle
- `/app/frontend/src/components/HeaderPromoBanner.js` - Banner in header with animations
- `/app/frontend/src/index.css` - Theme CSS variables and glassmorphism styles

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

### P2 (Future)
- [ ] Real payment integration (Stripe/YooKassa)
- [ ] Real crypto payment processing

## Test Credentials
- **User**: newtest@example.com / password123
- **Admin**: admin@avarus.ru / admin

## API Endpoints Reference
- `POST /api/auth/login` - User login
- `GET/PUT /api/admin/promo-banner` - Banner management (admin only)
- `GET /api/promo-banner` - Get banner settings (public)
- `GET /api/bonus/programs` - Bonus programs (authenticated)
