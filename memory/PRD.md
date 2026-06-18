# PRD — Truck Spare Parts E-Commerce Platform

## Original Problem Statement
E-commerce platform for truck spare parts with a comprehensive admin panel. Russian language UI. Features include product catalog, cart, orders, admin CRM, chat system with Telegram bot integration, maintenance mode, customizable footer, bonus/loyalty program, returns management, balance management, product-level discounts.

## Core Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI + MongoDB
- **Integrations**: Telegram Bot API, Resend (email), Cloudinary (images)

## What's Been Implemented (Cumulative)
- Catalog, search, filters, cross-articles
- Cart, favorites, checkout (card MOCKED, crypto live, balance, cash)
- Admin CRM: user management, order management, analytics, plaintext passwords
- Chat system + Telegram bot sync (+admin Telegram forward)
- Maintenance mode (global + per-page, admin/login bypass)
- Footer, password recovery (Resend)
- Bonus/loyalty system (auto-accrual, prize redemption, list/grid view)
- CSV import/export, discount/product request systems
- Balance system + transactions
- Admin action logs with rollback
- Notifications (client + admin + Telegram)
- Returns management (standard + warranty, photos required, duplicate protection, per-program bonus breakdown)
- Admin balance credit/debit (can go negative, with notifications)
- Product flags: `is_original`, `has_guarantee`, `bonus_eligible` with badges
- **NEW** Per-product discounts/promo (percent or amount, label, description, until date)
- **NEW** Color-coded delivery badges with "Сегодня" support
- **NEW** Admin product cards show mini-badges for bonus + discount

## Completed (Session 2026-05-04 — iter 58)

### Per-product Discount/Promo (P0)
- New Product fields: `discount_active`, `discount_type` ('percent'|'amount'), `discount_value`, `discount_label`, `discount_description`, `discount_until`
- Admin form section "Скидка/Акция" with toggle + all 6 fields + preview
- Frontend helpers: `computeDiscount()`, `formatDiscountBadge()`, `formatUntilDate()` (auto-expires when `discount_until <= now`)
- ProductCard + CatalogPage list + ProductPage all show: struck old price, new rose price, badge with %/sum, hover tooltip with label + description + until
- Required validation: `discount_until` mandatory when discount_active=true
- Admin catalog cards show small `admin-badge-discount-{id}` with label + percent

### Bonus Badge for Admin (P0)
- Admin product cards in catalog list show small `БОН` badge for bonus_eligible products (no need to open edit form)

### Delivery "Сегодня" + Color Tiers (P0)
- `delivery_days = 0` allowed in admin form (input `min="0"`); label "Сегодня"
- `getDeliveryBadge(days)` returns color class:
  - 0–1: emerald (green)
  - 2–7: amber (yellow)
  - >7: rose (red)
- Applied on ProductCard, CatalogPage inline card

## Completed (Session 2026-06-18 — iter 59)

### Virtual Catalog Categories (P0)
- New virtual category tabs on `/catalog`: **Ассортимент**, **Новинки**, **Скидки и Акции**
- Backend: `GET /api/products?virtual_category=assortment|new|discounted`
- `_ensure_new_status()` auto-expires `is_new` based on `new_until` on each GET
- Products auto-receive `is_new=true` + `new_until = created_at + 14d` on creation
- Persistent virtual category tabs (`tab-assortment`, `tab-new`, `tab-discounted`) — one-click switching even when a virtual category is active
- `virtual_category=discounted` includes products with either active promo OR non-empty `discount_tiers`

### Tiered Quantity Discounts (P0)
- Product field `discount_tiers: [{min_qty, type, value}]`
- `compute_effective_price()` in orders.py picks highest matching tier
- Stacks on top of base price (or `individual_price`), applied in both cart preview and order checkout
- Admin product modal has tier editor (add/remove rows)

### Auto "Новинки" Ribbon (P0)
- Green unfurling ribbon on `ProductCard` (`badge-new-{id}`) positioned below discount ribbon when both present
- 14-day default expiry; admin toggle controls `is_new` and resets `new_until`

### Admin Category Grid Customization (P0)
- `display_order` on `categories` (reorderable via up/down arrows: `cat-up-{id}`, `cat-down-{id}`)
- `columns_count` (2..6) in settings `type='category_display'`, applied via `gridTemplateColumns`
- Endpoints: `POST /api/categories/reorder`, `GET/PUT /api/categories/display-settings`

### Telegram Diagnostics (P0)
- New "Telegram" tab in Admin panel with `GET /api/admin/telegram/diagnostics`
- Webhook auto-detects host header (fixes prod/preview mismatch)

## Prioritized Backlog

### P1 (Important)
- Real Payment Gateway Integration (replace MOCKED YuKassa)

### P2 (Enhancement)
- Refactor AdminPage.js (4800+ lines), CatalogPage.js (1200+ lines), Header.js
- Unify save validation toasts (currently stacking when multiple fail)
- Auto-cleanup expired discounts (cron) or admin filter "Active discounts only"
- Persist `_ensure_new_status` flips to DB (currently mutation is Python-only)
- Apply payment_method adjustment in `GET /api/cart` for consistency with `POST /api/orders`

### P3 (Nice to have)
- Bulk discount editor (apply % to category)
- Promo banner on catalog when any discounts active
- Smart sorting

## Key Notes
- YuKassa card payments MOCKED
- Admin must /start Telegram bot to activate notifications
- Russian UI
- Returns: 10% fee, per-program bonus deduction; photos required (min 1)
- Balance: admin can go negative
- Legacy products default `bonus_eligible=True`
- Discount auto-expires client-side via `discount_until` check
