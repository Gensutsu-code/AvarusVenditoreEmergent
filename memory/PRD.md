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

## Prioritized Backlog

### P1 (Important)
- Real Payment Gateway Integration (replace MOCKED YuKassa)

### P2 (Enhancement)
- Refactor AdminPage.js (4600+ lines), CatalogPage.js, Header.js
- Unify save validation toasts (currently stacking when multiple fail)
- Auto-cleanup expired discounts (cron) or admin filter "Active discounts only"

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
