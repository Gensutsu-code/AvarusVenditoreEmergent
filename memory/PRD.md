# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, bonus system, and complete admin control ("Absolute Control").

## What's Been Implemented

### March 17, 2026 - Revertible Actions in Logs (COMPLETED)
- **Expanded revert system**: All key admin actions are now revertible from the Logs tab
  - Bonus points: add, subtract, reset — all logged with `before_state` and `document_query`
  - Prize redemptions: status change (approve/reject/issue) and deletion
  - Orders: status change, rollback, deletion
  - Users: deletion (password excluded from logs for security)
  - Categories: deletion
- **Re-insertion support**: Revert endpoint now handles deleted documents by re-inserting them
- **Composite key support**: `document_query` field in logs supports bonus_progress (user_id + program_id)
- **No duplicate logs**: Middleware skip list updated to avoid double-logging for explicitly logged routes
- **Rollback button UX**: AdminOrdersPage rollback button only shown for completed/processing/cancelled orders

### March 17, 2026 - Full Admin Control Overhaul (COMPLETED)
- **Removed Developer Mode toggle** — all admin control features active by default
- **Removed JSON raw editor** (Code button) from CRM
- **Bonus Points Management**: Add/Subtract/Reset buttons per user in bonus tab
- **Prize Redemption Deletion**: Admin can delete issued/rejected redemptions
- **Order Status Rollback**: "Откатить" button on orders page
- **Enhanced User Data Collection**: Browser fingerprint, GeoIP
- **User Notifications**: Add/remove points sends notification to user

### March 15, 2026 - Base Absolute Control
- Action logging middleware, log viewer tab, data editing API, undo/revert

### Earlier — All previous features (blocking, maintenance, discounts, product requests, sorting, news fix, Resend domain, etc.)

## Key API Endpoints
- `POST /api/admin/bonus/programs/{id}/users/{uid}/add-points` — add bonus points (revertible)
- `POST /api/admin/bonus/programs/{id}/users/{uid}/remove-points` — remove points (revertible)
- `POST /api/admin/bonus/programs/{id}/users/{uid}/reset-points` — reset to 0 (revertible)
- `PUT /api/admin/bonus/prize-redemptions/{id}/status` — change prize status (revertible)
- `DELETE /api/admin/bonus/prize-redemptions/{id}` — delete redemption (revertible)
- `PUT /api/admin/orders/{id}/status` — change order status (revertible)
- `PUT /api/admin/orders/{id}/rollback-status` — rollback order status (revertible)
- `DELETE /api/admin/orders/{id}` — delete order (revertible)
- `DELETE /api/admin/users/{id}` — delete user (revertible)
- `DELETE /api/categories/{id}` — delete category (revertible)
- `GET /api/admin/action-logs` — fetch all action logs
- `POST /api/admin/action-logs/{id}/revert` — revert a logged action

## Key DB Collections
- `action_logs`: { id, action, user_id, method, path, before_state, after_state, document_query, collection_name, document_id, reverted }
- `bonus_progress`: { user_id, program_id, current_amount }
- `orders`: { ..., previous_status }
- `user_sessions`: { user_id, ip, geo, browser, os, device, ... }

## 3rd Party: Resend (avopt.store verified), web3.py, ethers.js, CoinGecko, Cloudinary, FingerprintJS, GeoIP2. ЮKassa (MOCKED)

## Upcoming Tasks
- WalletConnect integration (P2)
- Real payment gateway integration (P2)
- Refactor AdminPage.js into smaller components

## Credentials: admin@avarus.ru/admin, user@demo.com/demo123
