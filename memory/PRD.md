# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management.

## What's Been Implemented

### March 14, 2026 - Product Request System (COMPLETED)
- **No results**: "Не нашли что искали? Закажите!" button when search finds nothing (article pre-filled)
- **Out of stock**: "Запросить товар" button replaces "В корзину" on product page
- **Modal**: Article, quantity, comment fields
- **Admin tab**: "Запросы товара" in admin chats with fulfill/respond/reject workflow
- Backend: 4 endpoints in `/api/product-requests` + `/api/admin/product-requests`
- Testing: 13/13 backend + all frontend (iteration_45)

### March 14, 2026 - Individual Price Discount Requests (COMPLETED)
- "Запросить скидку" button, admin approve/reject, individual prices in catalog/cart/checkout
- Testing: 12/12 backend + all frontend (iteration_44)

### March 14, 2026 - Maintenance Mode, User Blocking, Login Fix, Newsletter, CSV Import
- All completed and tested (iterations 41-43)

### Earlier Sessions - Analytics, Notifications, Bonus, Crypto, Balance, etc.

## Key DB Collections
- `product_requests`: `{ id, user_id, article, quantity, comment, product_id, status, admin_response }`
- `discount_requests`: `{ id, user_id, product_id, message, image_url, status, individual_price }`
- `individual_prices`: `{ id, user_id, product_id, price, active }`

## 3rd Party: Resend (SANDBOX), web3.py, ethers.js, CoinGecko, Cloudinary. ЮKassa (MOCKED)

## Upcoming: WalletConnect, Real Payment Gateway
## Backlog: Resend domain verification, Notification refactoring

## Credentials: admin@avarus.ru/admin, user@demo.com/demo123
