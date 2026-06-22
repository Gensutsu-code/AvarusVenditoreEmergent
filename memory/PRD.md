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

### Discount Promo Banner (P1 enhancement, 2026-06-18)
- New `GET /api/products/discount-summary` returns `{total_count, max_percent, earliest_until, featured[]}`
- Auto-appearing rose/fuchsia gradient banner on `/catalog` home (when not searching/browsing a category) — only renders when there are active discounts
- Live countdown ticker (days/hours/minutes/seconds) tied to soonest `discount_until`
- One-click CTA "Смотреть все" → `?category=discounted` (testid: `discount-promo-banner`, `discount-promo-cta`, `discount-promo-count`, `discount-promo-countdown`, `discount-promo-max-percent`)

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

## Completed (Session 2026-06-18 — iter 61/62)

### Client-facing Quantity Discount Tier Preview (P0)
- New helpers in `productHelpers.js`: `getQuantityTiers(product)` (normalized+sorted tiers with per-unit final price, respects `discount_active`+expiry) and `getActiveTier(tiers, quantity)`
- **ProductPage**: new `quantity-tiers-card` ("Чем больше — тем дешевле") listing each tier (`tier-row-{minQty}`) with «от N шт.», percent/amount badge, and per-unit price. Clicking a row sets quantity to that tier's minQty; price card (`product-price`) now recomputes via `computeDiscount(product, quantity)`; `tier-active-hint` shows current per-unit price + total savings. Only shown when `individualPrice == null`.
- **CatalogPage inline ProductCard**: small `tier-badge-{id}` ("Опт. скидка от N шт.") next to delivery badge for products with active tiers.
- Verified: iteration_61 (ProductPage) + iteration_62 (catalog badge, 100% pass).
- NOTE: `/app/frontend/src/components/ProductCard.js` is DEAD CODE (not imported); catalog uses the inline ProductCard in `CatalogPage.js`.

### Cart/Checkout Upsell Hint (P1 enhancement, 2026-06-18 — iter 63/64)
- New helper `getCartUpsell(item)` in `productHelpers.js`: projects each quantity tier off the user's REAL base price (`individual_price ?? original_price`, matching backend stacking) and returns the nearest tier whose projected per-unit is strictly cheaper than `item.price` (authoritative current per-unit). Avoids suggesting a tier worse than the discount already applied.
- `GET /api/cart` now also returns `discount_active`, `discount_until`, `discount_tiers` per item.
- **CartPage**: per-item hint `upsell-hint-{id}` "Добавьте ещё X шт. и получите скидку −Y% (Z ₽/шт)" + one-click `upsell-apply-{id}` bumps qty to the tier; hint disappears at the best tier.
- **CheckoutPage**: compact `checkout-upsell-{id}` link back to /cart; render-time navigate moved into `useEffect` (fixed React warning).
- Verified iteration_64: 6/6 pass (incl. individual_price + promo + tiers stacking, correct per-unit projection).

### Search UX fixes + Free-delivery progress bar (2026-06-18 — iter 65)
- **SearchDropdown**: results dropdown moved inside the input wrapper so its width equals the search field (no longer spans the "Найти" button). Rose `search-clear-btn` (×) re-centered vertically (`inset-y-0 my-auto`).
- **CartPage**: free-delivery progress bar in header (`free-delivery-bar`) — "До бесплатной доставки осталось N ₽" with animated fill, or "Бесплатная доставка активирована!" once threshold reached. On reaching threshold: confetti burst (20 pieces) + emerald ring glow + PartyPopper icon (iter 66). Reads `GET /api/delivery-settings`; renders ONLY when delivery is enabled in admin (currently disabled in this env).
- Verified iteration_65: 3/3 PASS (bounding-box checks for width + centering, bar states).

### Header Mini-Cart Dropdown (2026-06-18 — iter 67)
- New `MiniCart.js`: hover-triggered dropdown on the desktop header cart icon showing line items (up to 4 + "ещё N"), per-item remove, total, and the same free-delivery progress bar ("До бесплатной осталось N ₽" / "Бесплатная доставка!"). Footer buttons: "В корзину" → /cart, "Оформить" → /checkout.
- Reads `GET /api/delivery-settings`; bar only when delivery enabled. Dropdown only when cart non-empty. Verified iteration_67 (6/6 PASS).

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
