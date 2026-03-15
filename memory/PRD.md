# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management.

## What's Been Implemented

### March 15, 2026 - Absolute Control / Developer Mode (COMPLETED)
- **Action Logging Middleware**: FastAPI middleware logs all POST/PUT/DELETE API requests with user info, path, status code, duration. GET requests excluded to reduce noise.
- **Log Viewer**: New "Логи" tab in admin panel with stats cards (total/today/revertable), search, method filters (Все/GET/POST/PUT/DELETE), paginated log table.
- **Log Detail Modal**: Click any log to see details - action, user, method, path, IP, status, date. For data edits, shows before/after JSON state.
- **Raw Data Editing**: JSON editor modal accessible from CRM tab (Code button per user). Supports collections: users, orders, products, categories, individual_prices, discount_requests, product_requests, site_settings, settings.
- **Undo/Revert**: Data edits store before/after snapshots. Revert button in log detail modal restores document to previous state.
- **Developer Mode Toggle**: Settings > Developer sub-tab with toggle to enable/disable the mode.
- **Backend**: 8 new endpoints in `/api/admin/` (action_logs.py). ActionLoggingMiddleware in server.py.
- **Frontend**: LogsTab.js, DataEditorModal.js, DeveloperModeTab in SettingsTab.js, Code button in CRMTab.js.
- **Testing**: 23/23 backend + all frontend (iteration_46)

### March 14, 2026 - Product Request System (COMPLETED)
- "Не нашли что искали? Закажите!" button, admin manage tab
- Testing: 13/13 backend + all frontend (iteration_45)

### March 14, 2026 - Individual Price Discount Requests (COMPLETED)
- "Запросить скидку" button, admin approve/reject, individual prices in catalog/cart/checkout
- Testing: 12/12 backend + all frontend (iteration_44)

### March 14, 2026 - Maintenance Mode, User Blocking, Login Fix, Newsletter, CSV Import
- All completed and tested (iterations 41-43)

### Earlier Sessions - Analytics, Notifications, Bonus, Crypto, Balance, etc.

## Key DB Collections
- `action_logs`: `{ id, action, user_id, user_name, user_role, method, path, ip, status_code, details, before_state, after_state, collection_name, document_id, reverted, created_at }`
- `product_requests`: `{ id, user_id, article, quantity, comment, product_id, status, admin_response }`
- `discount_requests`: `{ id, user_id, product_id, message, image_url, status, individual_price }`
- `individual_prices`: `{ id, user_id, product_id, price, active }`
- `settings`: `{ type: "developer_mode", enabled: bool }`

## Key API Endpoints (New)
- `GET/PUT /api/admin/developer-mode` - Toggle developer mode
- `GET /api/admin/action-logs` - Paginated logs with filters
- `GET /api/admin/action-logs/stats` - Log statistics
- `GET/PUT /api/admin/data/{collection}/{document_id}` - Raw data read/edit
- `POST /api/admin/action-logs/{log_id}/revert` - Undo a data change
- `DELETE /api/admin/action-logs/clear` - Clear all logs

## 3rd Party: Resend (SANDBOX), web3.py, ethers.js, CoinGecko, Cloudinary. ЮKassa (MOCKED)

## Upcoming: WalletConnect, Real Payment Gateway
## Backlog: Resend domain verification, Notification refactoring

## Credentials: admin@avarus.ru/admin, user@demo.com/demo123
