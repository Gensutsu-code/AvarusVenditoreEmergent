# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel restructuring and glassmorphism design.

## What's Been Implemented

### December 2025 - Latest Session

#### Admin Panel Restructuring (COMPLETED ✅)
Merged tabs into 4 main categories + 2 separate pages:

**New Tab Structure:**
1. **Каталог** - Products and categories management
2. **Бонусы** - Bonus programs  
3. **Платежи** (NEW) - Combines:
   - Способы оплаты (card, cash, crypto, balance)
   - Предоплата (prepayment settings)
   - Криптовалюта (crypto wallets)
4. **CRM** (NEW) - Combines:
   - Клиенты (users list with status)
   - Аналитика (statistics)
5. **Маркетинг** (NEW) - Combines:
   - Акции и баннер
   - Новости
   - Рассылки
6. **Настройки** (NEW) - Combines:
   - Telegram
   - Импорт/Экспорт
   - Партнёры
   - Правила

**Separate Pages:**
- `/admin/orders` - Orders management
- `/admin/chats` - Chat with customers (NEW)

#### Admin Panel Dark Theme (COMPLETED ✅)
- Admin page now supports dark/light themes
- Dark background with glassmorphism tabs container
- Orange gradient title in dark mode

#### Previous Work (COMPLETED)
- Promo banner moved to header left side
- Banner expands left-to-right with spring animation
- Light theme uses teal/emerald instead of orange
- Theme toggle in all pages

## Tech Stack
- **Frontend**: React, TailwindCSS, Shadcn/UI, Framer Motion
- **Backend**: FastAPI, Python
- **Database**: MongoDB

## Key Files
- `/app/frontend/src/pages/AdminPage.js` - Restructured admin
- `/app/frontend/src/pages/AdminChatsPage.js` - Chats page
- `/app/frontend/src/components/admin/PaymentsTab.js` - Combined payments
- `/app/frontend/src/components/admin/CRMTab.js` - Combined CRM
- `/app/frontend/src/components/admin/MarketingTab.js` - Combined marketing
- `/app/frontend/src/components/admin/SettingsTab.js` - Combined settings

## Prioritized Backlog

### P0 (High Priority)
- [x] Admin panel restructuring ✅
- [x] Admin dark theme support ✅
- [ ] Apply full glassmorphism to admin tab contents

### P1 (Medium Priority)  
- [ ] ProductPage redesign
- [ ] Admin mobile responsiveness

### P2 (Future)
- [ ] Real payment integration
- [ ] Real crypto payments

## Test Credentials
- **User**: newtest@example.com / password123
- **Admin**: admin@avarus.ru / admin

## Routes
- `/admin` - Admin panel (restructured tabs)
- `/admin/orders` - Orders management (separate page)
- `/admin/chats` - Chat with customers (NEW separate page)
- `/admin/profile` - Admin profile
