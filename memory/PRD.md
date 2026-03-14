# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, and glassmorphism design.

## What's Been Implemented

### March 14, 2026 - Individual Price Discount Requests (COMPLETED)
- **Client**: "Запросить скидку" button on product cards and product page
- **Modal**: Description of the feature, rules, text field, image upload (Cloudinary)
- **Admin**: "Запросы на скидку" tab on admin chats page with approve/reject workflow
- **Individual pricing**: Approved prices show as strikethrough original + green individual price in catalog and product page
- **Order integration**: Individual prices apply automatically in cart/checkout
- **Auto-deactivation**: Individual price deactivates after order completion
- Backend: 6 new endpoints in `/api/discount-requests` and `/api/admin/discount-requests`
- DB: `discount_requests` + `individual_prices` collections
- Testing: 12/12 backend + all frontend passed (iteration_44)

### March 14, 2026 - Maintenance Mode with Mini-Game (COMPLETED)
- Admin toggle in Settings → Техработы, animated maintenance page with truck runner game
- Testing: 9/9 backend + 11/11 frontend (iteration_43)

### March 14, 2026 - User Account Blocking (COMPLETED)
- Silent block/unblock in CRM tab, auto-logout on 401
- Testing: 8/8 backend + 4/4 frontend (iteration_42)

### March 14, 2026 - Login Fix + Newsletter + CSV Import (COMPLETED)
- Login verified, CSV export, selective email sending
- Testing: 12/12 backend + 6/6 frontend (iteration_41)

### Earlier Sessions (Completed)
- Client Analytics, Notification System, News/Banners Editor
- Order cancellation, Bonus system, Crypto payments, Balance system

## Architecture
```
/app/backend/routes/
  discount_requests.py  # NEW: Client discount requests + admin approve/reject
  maintenance.py        # Maintenance mode
  admin.py              # User blocking, CSV, order management
  orders.py             # Cart/checkout with individual price support
  ...
/app/frontend/src/
  components/DiscountRequestModal.js  # NEW: Discount request form
  pages/CatalogPage.js               # Individual prices in product cards
  pages/ProductPage.js                # Individual price display + request button
  pages/AdminChatsPage.js             # Discount requests tab
```

## Key DB Collections
- `discount_requests`: `{ id, user_id, product_id, message, image_url, status, individual_price, admin_response }`
- `individual_prices`: `{ id, user_id, product_id, price, request_id, active }`

## 3rd Party Integrations
- Resend (SANDBOX), web3.py/ethers.js, CoinGecko, Cloudinary
- ЮKassa (MOCKED)

## Upcoming Tasks (P1)
1. WalletConnect Support
2. Real Payment Gateway (replace ЮKassa)

## Future/Backlog (P2)
1. Resend domain verification
2. Notification helpers refactoring

## Credentials
- Admin: admin@avarus.ru / admin
- Client: user@demo.com / demo123
