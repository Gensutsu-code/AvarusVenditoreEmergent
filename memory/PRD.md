# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel restructuring.

## What's Been Implemented

### December 2025 - Latest Session

#### Promo Banner Improvements (COMPLETED)
- ✅ Moved banner to LEFT side of header (next to logo)
- ✅ Banner now expands LEFT-TO-RIGHT with smooth spring animation
- ✅ Collapse animation with rotating sparkle icon
- ✅ Beautiful new design with shadow and sparkle icon
- ✅ X button no longer redirects - just collapses banner
- ✅ Banner state persisted in sessionStorage

#### Theme Colors Update (COMPLETED)
- ✅ Removed orange from light theme
- ✅ Light theme now uses TEAL/EMERALD colors:
  - Primary: teal-500 to emerald-500
  - Accents: teal-600
  - Focus rings: teal-400
- ✅ Dark theme keeps orange accents

#### Admin Panel Restructuring (IN PROGRESS)
- ✅ Created AdminChatsPage.js - separate page for chats
- ✅ Added /admin/chats route
- ✅ Added "Чаты" link in admin navigation
- ✅ Orders already on separate page (/admin/orders)

**New Admin Navigation:**
- Панель (main admin)
- Заказы (orders - separate page)
- Чаты (chats - new separate page)
- Профиль

**Tab Structure to implement:**
1. **Payments** = Payment methods + Prepayment + Crypto wallets
2. **CRM** = Clients list + Analytics
3. **Marketing** = Promo banner + News + Newsletters
4. **Settings** = Telegram + Import/Export + Partners + Terms

#### Previous Session Work
- Theme switching (dark/light)
- Glassmorphism redesign for user pages
- Bug fixes (banner save, bonus system)

## Tech Stack
- **Frontend**: React, TailwindCSS, Shadcn/UI, Framer Motion
- **Backend**: FastAPI, Python
- **Database**: MongoDB

## Key Files
- `/app/frontend/src/components/HeaderPromoBanner.js` - Banner with animations
- `/app/frontend/src/pages/AdminChatsPage.js` - New chat page
- `/app/frontend/src/components/Header.js` - Navigation with chat link
- `/app/frontend/src/index.css` - Theme styles (teal for light)

## Prioritized Backlog

### P0 (High Priority)
- [ ] Complete AdminPage tab restructuring (merge tabs into Payments, CRM, Marketing, Settings)
- [ ] Apply glassmorphism design to AdminPage

### P1 (Medium Priority)  
- [ ] ProductPage redesign
- [ ] More animations throughout

### P2 (Future)
- [ ] Real payment integration
- [ ] Real crypto payments

## Test Credentials
- **User**: newtest@example.com / password123
- **Admin**: admin@avarus.ru / admin

## Routes
- `/` - Home
- `/catalog` - Products
- `/cart` - Cart
- `/checkout` - Checkout
- `/login` - Login
- `/register` - Register
- `/account` - User profile
- `/bonus` - Bonus programs
- `/admin` - Admin panel
- `/admin/orders` - Orders management
- `/admin/chats` - Chat with customers (NEW)
- `/admin/profile` - Admin profile
