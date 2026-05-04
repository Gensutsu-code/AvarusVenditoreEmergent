# PRD — Truck Spare Parts E-Commerce Platform

## Original Problem Statement
E-commerce platform for truck spare parts with a comprehensive admin panel. Russian language UI. Features include product catalog, cart, orders, admin CRM, chat system with Telegram bot integration, maintenance mode, customizable footer, bonus/loyalty program, returns management, balance management.

## Core Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI + MongoDB
- **Integrations**: Telegram Bot API, Resend (email), Cloudinary (images)

## What's Been Implemented
- Full product catalog with search, filters, cross-articles
- Cart, favorites, checkout with multiple payment methods (card MOCKED, crypto live, balance, cash)
- Admin CRM: user management, order management, analytics, plaintext passwords visible
- Chat system: admin-to-client chat with Telegram bot sync (+Telegram admin notifications)
- Maintenance mode (global + per-page, admin/login bypass)
- Footer with customizable contacts and social toggles
- Password recovery via email (Resend)
- Bonus/loyalty system (auto-accrual on delivery, prize redemption, list/grid view)
- CSV import/export for products
- Discount request system, Product request system
- Balance system with balance transactions
- Admin action logs with rollback
- Admin + client notifications
- Product badges: "Оригинал", "Гарантия", **"Бонусы"** (new)
- Admin can add/remove items from existing orders
- Admin can edit order date/time (with proper TZ)

## Completed (Session 2026-05-04)

### Returns Management System (P0) — DONE & TESTED (15/15 backend)
- Client: "Оформить возврат" button on completed orders → modal with 2 types
- Standard return: 10% fee, refund on balance, bonus points reversed per-program
- Warranty return: 1:1 exchange
- **Photos required (min 1, max 5) for both return types** via `/api/upload`
- **Duplicate quantity protection**: cannot return more than remaining (pending/approved blocked quantities tracked)
- **Per-program bonus breakdown** stored on return (`program_bonus_totals` dict) → correct deduction when multiple programs enabled
- **bonus_eligible filter**: only bonus_eligible=true items contribute bonus deductions
- Client `/returns` page, Admin `/admin/returns` page with filters + approve/reject modal
- Notifications on all events (client + admin + Telegram forward)
- New collection: `returns` with photos, items, program_bonus_totals, status
- Endpoints: POST/GET /api/returns, GET/PUT /api/admin/returns[/{id}/approve|reject]

### Admin Balance Management (NEW)
- Buttons "+" (Начислить) / "−" (Списать) next to user balance in CRM cards
- Modal with amount + reason input
- **Debit can go into negative** (with warning in UI)
- Creates `balance_transactions` with `type=admin_credit`/`admin_debit`
- Client notification on every operation
- Endpoints: POST /api/admin/users/{id}/balance/credit|debit

### Product Bonus Eligibility (NEW)
- New field `bonus_eligible: bool` on Product model (default `True` for backward compatibility)
- Admin toggle in product edit form: "Участвует в бонусной программе"
- Green "Бонусы" badge on `ProductCard.js` when `bonus_eligible !== false`
- `update_bonus_on_order_delivered` uses `eligible_total` computed from product `bonus_eligible` flags; non-eligible items skipped from bonus accrual
- Returns: non-eligible items deduct 10% but do NOT reverse bonus points

### Header.js NavLink fix (from iter 56)
- Internal NavLink now spreads `...rest` so data-testid and other props propagate correctly

## Prioritized Backlog

### P0 (Critical)
- (none currently)

### P1 (Important)
- Real Payment Gateway Integration (replace MOCKED YuKassa card payments)

### P2 (Enhancement)
- Refactor AdminPage.js (4400+ lines), CatalogPage.js, Header.js
- Consider per-program bonus breakdown for legacy returns (dormant bug when multiple programs and old returns w/o `program_bonus_totals`)
- Write admin action_log entry for balance adjustments (compliance trail)
- Toast on photo upload failure in ReturnModal (UX polish)

### P3 (Nice to have)
- Smart sorting for products/orders/users
- Recalculate bonus progress for already-completed orders when a product's `bonus_eligible` changes

## Key Notes
- YuKassa card payments are MOCKED
- Admin must send /start to Telegram bot to activate notifications
- Russian language throughout UI
- Returns: 10% fee, bonus deduction per-program at current cashback level
- Balance adjustments can go negative (explicit user requirement)
- Legacy products default to `bonus_eligible=True`
