# PRD — Truck Spare Parts E-Commerce Platform

## Original Problem Statement
E-commerce platform for truck spare parts with a comprehensive admin panel. Russian language UI. Features include product catalog, cart, orders, admin CRM, chat system with Telegram bot integration, maintenance mode, and customizable footer.

## Core Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI + MongoDB
- **Integrations**: Telegram Bot API, Resend (email), Cloudinary (images)

## What's Been Implemented
- Full product catalog with search, filters, cross-articles
- Cart, favorites, checkout with multiple payment methods
- Admin CRM: user management, order management, analytics
- Chat system: admin-to-client chat with Telegram bot sync
- Maintenance mode with per-page blocking and 15s polling
- Footer with customizable contacts and social toggles
- Password recovery via email (Resend)
- Bonus/loyalty system
- CSV import/export for products
- Discount request system
- Product request system
- Balance system
- Admin action logs with rollback
- Admin notifications
- Client notifications

## Completed (This Session — 2026-04-04)
- Show plaintext passwords (password_plain) in admin panel user cards, expanded details, and edit form
- Pin/Delete/Label action buttons in AdminChatsPage.js chat header
- Pin indicators and label dots in chat list
- Pinned chats sorted first in chat list (backend sort by pinned, then updated_at)
- Telegram order notifications: `send_telegram_order_notification` called on new order
- Telegram admin notification forwarding: all `notify_admin` calls forwarded to Telegram
- Fixed Telegram webhook URL (was pointing to old preview URL)
- Auto-sync of Telegram chat_id between chat bot settings and order notification settings on /start
- Fallback logic: uses env TELEGRAM_CHAT_BOT_TOKEN when DB settings empty

## Previously Completed
- Personal Files feature DELETED (per user request)
- Maintenance mode with 15s polling and per-page blocking
- Admin chats: Telegram bot replies, WhatsApp-style read receipts
- Compact footer with WhatsApp/Telegram toggles
- Forgot/Reset password workflow
- Removed 4 colored stats cards from admin panel
- Added enot meta tag

## Prioritized Backlog

### P0 (Critical)
- (none currently)

### P1 (Important)
- Real Payment Gateway Integration (replace MOCKED YuKassa)

### P2 (Enhancement)
- Refactor AdminPage.js and AdminChatsPage.js (break down 1000+ line components)

### P3 (Nice to have)
- Smart sorting for products/orders/users

## Key Notes
- YuKassa payments are MOCKED
- Admin user must send /start to Telegram bot to activate notifications
- Russian language throughout UI
