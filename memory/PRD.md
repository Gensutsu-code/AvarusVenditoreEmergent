# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, bonus system, and complete admin control ("Absolute Control").

## Core Features Implemented

### Admin Cart Management (March 19, 2026) — NEW
- Admin can view all client carts from "Корзины" link in header
- Each cart shows user info (name, email, phone), item count, total
- Expandable cart cards with product images, article, manufacturer, price, quantity
- **Add products**: Search modal to add any product to a client's cart
- **Remove products**: Trash icon to remove individual items or clear entire cart
- **Change quantity**: +/- buttons per item
- **Set custom price**: Inline price editor sets individual price per user per product

### Revertible Actions in Logs (March 17, 2026)
- All key admin actions revertible from Logs tab
- Supports: bonus add/subtract/reset, prize status changes, prize/order/user/category deletion
- Re-insertion support for deleted documents
- Composite key support (document_query) for bonus_progress

### Full Admin Control ("Absolute Control")
- Granular admin controls for bonus points, prize history, order rollback
- Enhanced user tracking (browser fingerprint, GeoIP)
- Action logging middleware with revert system
- Order status sequential rollback

### Balance Bug Fix (March 17, 2026)
- Fixed: balance hidden when notifications disabled (early return in fetchUserData)

### Earlier Features
- E-commerce catalog, cart, checkout, orders
- Bonus/loyalty system with tiers
- Crypto payments (ETH/USDT)
- News, chat widget, notifications
- User analytics, search with sorting
- Individual pricing per user
- Product/discount requests

## Key API Endpoints
- `GET/POST/PUT/DELETE /api/admin/carts/*` — Admin cart management
- `POST /api/admin/bonus/programs/{id}/users/{uid}/add-points` — Add bonus (revertible)
- `POST /api/admin/bonus/programs/{id}/users/{uid}/remove-points` — Remove points (revertible)
- `PUT /api/admin/orders/{id}/rollback-status` — Rollback order (revertible)
- `GET /api/admin/action-logs` — All action logs
- `POST /api/admin/action-logs/{id}/revert` — Revert action

## 3rd Party Integrations
Resend, Cloudinary, web3.py, ethers.js, CoinGecko, FingerprintJS, GeoIP2. ЮKassa (MOCKED)

## Upcoming Tasks
- (No active backlog — user cleared it)

## Credentials
- Admin: admin@avarus.ru / admin
- Client: user@demo.com / demo123
