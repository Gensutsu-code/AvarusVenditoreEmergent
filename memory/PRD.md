# PRD — Truck Spare Parts E-Commerce Platform

## Original Problem Statement
E-commerce platform for truck spare parts with a comprehensive admin panel. Russian language UI. Features include product catalog, cart, orders, admin CRM, chat system with Telegram bot integration, maintenance mode, customizable footer, bonus/loyalty, returns management.

## Core Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI + MongoDB
- **Integrations**: Telegram Bot API, Resend (email), Cloudinary (images)

## What's Been Implemented
- Full product catalog with search, filters, cross-articles
- Cart, favorites, checkout with multiple payment methods (card MOCKED, crypto live, balance, cash)
- Admin CRM: user management, order management, analytics, plaintext passwords visible
- Chat system: admin-to-client chat with Telegram bot sync (+ Telegram admin notifications)
- Maintenance mode (global + per-page, admin/login bypass)
- Footer with customizable contacts and social toggles
- Password recovery via email (Resend)
- Bonus/loyalty system (auto-accrual on delivery, prize redemption, list/grid view)
- CSV import/export for products
- Discount request system, Product request system
- Balance system with balance transactions
- Admin action logs with rollback
- Admin notifications + client notifications
- Original / Guarantee badges on products
- Admin can add/remove items from existing orders
- Admin can edit order date/time (with proper TZ)

## Completed (Session 2026-05-04)
- **Returns Management System (P0) — DONE & TESTED (16/16 backend + 100% UI)**
  - Client: "Оформить возврат" button on completed orders → modal with 2 types (Возврат / Возврат по гарантии)
  - Standard return: 10% fee deducted from item price, refund on internal balance, bonus points reversed
  - Warranty return: 1:1 exchange, no fees, no balance/bonus changes
  - Client sees own returns on `/returns` with status, items, amounts, bonus deduction
  - Admin `/admin/returns` page with filters (all/pending/approved/rejected), approve/reject modal with comment
  - Notifications sent to both client and admin (+Telegram forward) on creation + status change
  - New collection: `returns`
  - New endpoints: `POST /api/returns`, `GET /api/returns`, `GET /api/admin/returns`, `PUT /api/admin/returns/{id}/approve`, `PUT /api/admin/returns/{id}/reject`
- Header.js NavLink fix (forwarded `...rest` so data-testid and other props propagate) — fix by testing agent

## Prioritized Backlog

### P0 (Critical)
- (none currently)

### P1 (Important)
- Real Payment Gateway Integration (replace MOCKED YuKassa)

### P2 (Enhancement)
- Refactor AdminPage.js (4400+ lines), CatalogPage.js, Header.js — break down large components
- Consider per-program bonus deduction breakdown stored on the return (currently sum + even distribution across enabled programs; dormant bug when multiple programs active)
- Prevent duplicate item returns (track already-returned quantities per order-item)

### P3 (Nice to have)
- Smart sorting for products/orders/users

## Key Notes
- YuKassa card payments are MOCKED
- Admin must send /start to Telegram bot to activate notifications
- Russian language throughout UI
- Returns system: 10% fee, bonus deduction uses user's current cashback level at time of return
