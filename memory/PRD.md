# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, bonus system, and complete admin control.

## What's Been Implemented

### March 17, 2026 - Full Admin Control Overhaul (COMPLETED)
- **Removed Developer Mode toggle** — all admin control features active by default
- **Removed JSON raw editor** (Code button) from CRM
- **Bonus Points Management**: Начислить/Списать/Обнулить buttons per user in bonus tab with dialog
- **Prize Redemption Deletion**: Admin can delete issued/rejected redemptions, client can delete own
- **Order Status Rollback**: "Откатить" button on both orders page and admin panel
- **Enhanced User Data Collection**: Browser fingerprint (browser, OS, device, screen, language, timezone, referer, cores, memory, connection type, touch, cookies, DNT)
- **GeoIP Resolution**: IP → city/country/ISP via ip-api.com
- **Visual Session Cards**: User analytics modal shows device/browser/location data in visual cards (not JSON)
- **User Notifications**: Add/remove points sends notification to user

### March 15, 2026 - Absolute Control / Developer Mode (base)
- Action logging middleware, log viewer tab, data editing API, undo/revert

### March 15, 2026 - Sorting, News fix, Resend domain, Bonus fixes
- Search results sorting (price, delivery speed)
- News notification navigation fix
- Resend domain verified (noreply@avopt.store)
- Bonus points accrual fix (status check: completed)
- Prize notification to client (approve/issue/reject)
- Bonus request button removed, tabs merged

### Earlier — All previous features (blocking, maintenance, discounts, product requests, etc.)

## Key API Endpoints
- `POST /api/admin/bonus/programs/{id}/users/{uid}/add-points` — add bonus points
- `POST /api/admin/bonus/programs/{id}/users/{uid}/remove-points` — remove points
- `POST /api/admin/bonus/programs/{id}/users/{uid}/reset-points` — reset to 0
- `DELETE /api/admin/bonus/prize-redemptions/{id}` — delete redemption (admin)
- `DELETE /api/bonus/my-redemptions/{id}` — delete own redemption (client)
- `PUT /api/admin/orders/{id}/rollback-status` — rollback order status
- `POST /api/track` — track events with browser fingerprint
- `GET /api/admin/users/{id}/analytics` — analytics with sessions/geo

## Key DB Collections
- `user_sessions`: { user_id, ip, geo, browser, os, device, screen, language, timezone, visit_count, first_seen, last_seen }
- `action_logs`: { id, action, user_id, method, path, before_state, after_state, reverted }
- `bonus_progress`: { user_id, program_id, current_amount }
- `orders`: { ..., previous_status } (for rollback)

## 3rd Party: Resend (avopt.store verified), web3.py, ethers.js, CoinGecko, Cloudinary. ЮKassa (MOCKED)

## Upcoming: WalletConnect, Real Payment Gateway

## Credentials: admin@avarus.ru/admin, user@demo.com/demo123
