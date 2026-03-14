# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, and glassmorphism design.

## Core Requirements
- Admin panel for managing products, orders, users
- Client-side catalog with search, filters, favorites
- Cart and checkout with multiple payment methods (cash, card, crypto, balance)
- Order management with inline editing, change tracking, and client confirmation
- Push/sound notifications, bonus program with cashback

## What's Been Implemented

### March 14, 2026 - Maintenance Mode with Mini-Game (COMPLETED)
- **Admin toggle**: Настройки → Техработы — кнопка включения/выключения сайта
- **Maintenance page**: Animated wrench icon, pulsing rings, rotating gears, progress bar, live clock MSK
- **Mini-game**: Truck runner (canvas-based, pure React, no extra deps) — прыгай через препятствия, счёт + рекорд
- **Custom message**: Админ может задать текст для посетителей
- **Admin access**: /login доступен во время техработ, админ видит обычный сайт
- **Hidden link**: "Панель управления" внизу страницы для доступа к логину
- Backend: `GET /api/maintenance/status`, `POST /api/maintenance/toggle`, `PUT /api/maintenance/settings`
- Testing: 9/9 backend + 11/11 frontend (iteration_43)

### March 14, 2026 - User Account Blocking (COMPLETED)
- Block/unblock toggle in CRM tab, blocked users silently can't login (generic error)
- Active session auto-logout via 401 interceptor
- Testing: 8/8 backend + 4/4 frontend (iteration_42)

### March 14, 2026 - Login Fix + Newsletter + CSV Import (COMPLETED)
- Login verified working, CSV URL fix + export endpoint, selective email sending
- Testing: 12/12 backend + 6/6 frontend (iteration_41)

### Earlier (Completed)
- Client Analytics, Notification System, News/Banners Editor
- Order cancellation, Bonus system, UI improvements, Crypto payments, Balance system

## Architecture
```
/app/backend/routes/
  maintenance.py  # NEW: Maintenance mode toggle + settings
  admin.py        # User blocking, CSV import/export
  auth.py         # Login with blocked check
  notifications.py # Selective email sending
  ...
/app/frontend/src/
  pages/MaintenancePage.js  # NEW: Animated maintenance page + truck game
  App.js                    # Maintenance status check
  components/admin/SettingsTab.js  # MaintenanceTab sub-tab
  context/AuthContext.js    # 401 interceptor for blocked users
```

## 3rd Party Integrations
- Resend (email - SANDBOX), web3.py/ethers.js (crypto), CoinGecko, Cloudinary
- ЮKassa (MOCKED card payments)

## Upcoming Tasks (P1)
1. WalletConnect Support
2. Real Payment Gateway (replace ЮKassa)

## Future/Backlog (P2)
1. Resend domain verification
2. Refactoring: notification helpers centralization

## Credentials
- Admin: admin@avarus.ru / admin
- Client: user@demo.com / demo123
