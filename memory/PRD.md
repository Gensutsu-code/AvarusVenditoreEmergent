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

### Admin-editable Return Rules & Policy (2026-06-18 — iter 68)
- New `return_settings` (db.settings): fee_percent, min_photos, max_photos, return_window_days, warranty_enabled, desc_return, desc_warranty, warning_text, policy_text. Endpoints: public `GET /api/return-settings`, admin `GET/PUT /api/admin/return-settings`.
- `create_return` now honors settings: configurable fee % (drives refund math, stored on return), min photos, return window (days since `completed_at`), warranty on/off. Orders now stamp `completed_at` on completion (admin status update / full update / fulfill).
- **Admin** (`ReturnSettingsPanel` on /admin/returns): collapsible editor for all rules + texts. **Client** (/returns): collapsible "Условия и правила возврата" section. **ReturnModal**: texts/fee/photo limits/warranty visibility all driven by settings.
- Verified iteration_68: backend 8/8 pytest + frontend 100%. Test file: `/app/backend/tests/test_return_settings.py`.

### Real-time cart discounts, Admin-cart discounts, Return-window button (2026-06-18 — iter 69)
- **Real-time cart pricing**: `POST /api/cart/update` now returns the recomputed cart (`_build_cart` helper); `CartContext.updateQuantity` applies it → tier/quantity discounts update instantly (~300ms) without page refresh.
- **Admin carts discounts**: `admin_carts.py` (get_all_carts + get_user_cart) now apply `compute_promo_discount` → discounted price, promo_active, promo_amount, promo_label. `AdminCartsPage` shows strikethrough original + `promo-badge-{id}` and re-syncs on qty change.
- **Return-window button**: `OrdersPage` reads `/api/return-settings`; `getReturnWindow(order)` gates the return CTA. In-window → `header-return-btn-{id}` + expanded `create-return-btn-{id}`; expired → `return-expired-badge-{id}` + `return-expired-{id}` ("Срок возврата истёк"). Uses order `completed_at` (fallback created_at).
- Verified iteration_69: backend 6/6 pytest + frontend 3/3 PASS.

### PHASE 1 — Cart & Orders improvements (2026-06-18 — iter 70) ✅
- Cart summary: "Скидка на корзину" line (`cart-discount-line`), bonus-points preview (`cart-bonus-preview`, backend `GET /bonus/cart-preview` mirrors accrual), "Очистить корзину" button (`clear-cart-btn`).
- Ozon certificate progress bar (`OzonCertificateBar`, +500₽ per full 10 000₽) in cart + compact in MiniCart. On order placement: `create_order` stores `ozon_certificate` + notifies admin; admin badge `ozon-cert-badge-{id}` on /admin/orders toggles issued (`PATCH /admin/orders/{id}/ozon-certificate`).
- Client order stats restricted to current calendar month (`/orders/stats`, admins unchanged); client orders sorted newest-first.
- Verified iteration_70: backend 5/5 + frontend 100%. Test: `test_iter70_cart_ozon.py`.
- Backlog notes (non-blocking): extract shared bonus calc helper; add `order-card-{id}` testids; admin Ozon toggle could set state from PATCH response to avoid initial-load race.

### PHASE 2 — Admin product management (2026-06-18 — iter 71) ✅
- New `GET /admin/products` (search by article/manufacturer/description/name, sort, paginate), `GET /admin/products/ids` (select-all-matching), `POST /admin/products/bulk` (set_fields / clear_discount / extend_discount / adjust_price / delete; apply to selected IDs or all-matching). Public `/products` search extended to manufacturer+description.
- New page `/admin/products` (`AdminProductsPage`): search, sort, category/stock/discounted filters, pagination, row selection + select-page + select-all-matching, sticky bulk toolbar (badges original/guarantee/new/bonus on-off; availability set/clear; discount apply/extend/remove; price ± %/₽; bulk delete) + per-product edit modal. Linked from /admin Каталог via `mass-edit-btn`.
- Safety: delete+apply_all requires `confirm_all`. Verified iteration_71: backend 12/12 pytest + frontend 14/14 flows.

### PHASE 3 — Credit / Deferral payment "Отсрочка платежа" (2026-06-19 — iter 72) ✅
- Backend `routes/credit.py`: client `GET /credit/my`, `POST /credit/request`; admin `GET /admin/credit-requests`, `GET /admin/credit-accounts`, `GET /admin/deferrals`, `PUT /admin/credit-requests/{id}/approve|reject`, `PUT /admin/credit/{user_id}/set-limit`, `PUT /admin/deferrals/{id}/mark-paid`. `orders.py` (lines ~310-406) validates approved limit + available on `payment_method=deferral`, creates `deferrals` row, sets order `payment_status=deferred`, notifies admin.
- Frontend: `CreditPage.js` (`/credit`) client view (request form / approved summary + deferral list); `AdminCreditPage.js` (`/admin/credit`) tabs Запросы/Лимиты клиентов/Долги по отсрочке (approve/reject/set-limit/mark-paid); `CheckoutPage.js` new `payment-method-deferral` option (only if approved & available ≥ total). Header admin nav link `admin-credit-link`, client balance `header-credit-balance`.
- DB: `users.credit_status/credit_limit/credit_term_days`, `credit_requests`, `deferrals` collections.
- Verified iteration_72: backend 10/10 pytest + frontend 100%. Test: `test_phase3_credit_deferral.py`.
- Backlog notes (non-blocking): expose is_deferral/deferral_due_date/payment_status in OrderResponse so /orders shows deferral context without extra fetch; allow client to cancel pending request; warn admin when new limit < current debt.

### UI fix — Header balance pills (2026-06-19) ✅
- Fixed misaligned balance/credit pills in Header: rounded values (Math.round) + whitespace-nowrap + fixed h-9 so number and «₽» stay on one line; added mobile credit-balance row.

### PHASE 4 — Warehouse & Accounting "Склад и учёт" (2026-06-19 — iter 73) ✅
- Scope: single `purchase_price` per product; movements limited to Приход (receipt) + Списание (writeoff) [no inventory count]; orders auto-decrement stock + log a 'sale' movement; finance = auto income (paid orders) + auto expense (receipts) + manual income/expense entries + period profit.
- Backend `routes/warehouse.py`: `GET /admin/warehouse/stock` (items + summary: units/cost/revenue/profit/low-stock), `POST /admin/warehouse/movement` (receipt updates purchase_price + supplier; writeoff with reason, blocks overflow), `GET /admin/warehouse/movements` (filter type/product), `GET /admin/finance` (period summary + manual entries), `POST/DELETE /admin/finance/entry`. `orders.py` logs 'sale' movement on stock decrement. `purchase_price` added to Product models.
- Frontend `AdminWarehousePage.js` (`/admin/warehouse`) tabs Остатки|Движения|Финансы + movement & finance-entry modals; `product-purchase-price-input` in AdminPage product form; Header admin nav `admin-warehouse-link` ('Склад').
- DB: `stock_movements` (types receipt/writeoff/sale), `finance_entries` (manual). 
- Verified iteration_73: backend 12/12 pytest + frontend 100%. Test: `test_warehouse_finance.py`.
- Backlog notes (non-blocking): finance modal testids use *-input suffix; add mv-cancel-btn; swap native date inputs for shadcn DatePicker.

### PHASE 5 — Unified communication hub "Связь с администрацией" (2026-06-19 — iter 74) ✅
- New client page `ContactPage.js` (`/contact`) with 4 tabs reusing existing APIs: **Чат** (embedded text chat via /chat/send, /chat/messages, /chat/mark-read, polls 5s), **Скидки и условия** (current status + individual_discount display; /request-individual-discount; /request-status-upgrade wholesale/partner; /my-requests pending state), **Отсрочка** (/credit/my summary or /credit/request form), **Мои обращения** (history: /discount-requests/my [product_id ones], /product-requests/my, /individual-prices/my with status badges).
- Header client nav 'Связь' link (`contact-link`) desktop + mobile. No new backend routes.
- Fix: hid global FloatingPromoBanner on /contact (it could overlap the tab strip / page heading).
- Verified iteration_74: frontend 100% on critical flows (chat send+persist+admin-visible, all tabs render, deferral approved view, history badges, floating ChatWidget intact).
- Backlog notes (non-blocking): consolidate /individual-prices/my with approved discount_requests carrying individual_price; chat/mark-read transient 403 noise on first load (returns 200 normally).

### Stock-sync toggle — CORRECTED behavior (2026-06-19 — iter 76) ✅
- Removed per-product 3-state control from product card (stock_sync_mode dropped entirely).
- GLOBAL toggle (/admin/warehouse) ONLY affects the in-stock LABEL on product cards:
  - ON: in_stock = (warehouse stock > 0), BYPASSING the product card "Наличие" (manual_available) toggle.
  - OFF: in_stock = manual_available (the "Наличие" toggle in the product card).
- Stock ALWAYS decremented on orders + 'sale' movement logged, regardless of sync position.
- Product card "Наличие" toggle now controls `manual_available` (no longer writes to stock, so it never clobbers warehouse quantity).
- Backend: `_apply_availability` simplified (global on→stock>0, off→manual_available); orders.py decrement is unconditional. Verified via curl: all 4 label combos correct; order decremented 20→17 with sync OFF.

### Cosmetic polish (2026-06-19) ✅
- Unread chat badge on Header «Связь» link (data-testid contact-unread-badge), fed by /api/chat/unread-count; clears after visiting /contact (mark-read).
- Cancel buttons in warehouse modals: mv-cancel-btn (movement) + fin-cancel-btn (finance entry).
- OrderResponse now exposes is_deferral, deferral_due_date, payment_status, ozon_certificate(_issued) — /orders can show deferral context without extra fetch.
- Decision: kept native date inputs on finance tab (admin uses native type="date" everywhere — shadcn DatePicker would reduce consistency). Skipped fin testid rename (test-internal, no UX impact).

## Completed (Session 2026-06 — iter 94)
6 задач (см. CHANGELOG для деталей): (1) уведомления уважают глобальный тумблер [notify_user], (2) индивидуальная скидка только при оплате с баланса (стакается), (3) оплата доставки бонусными баллами, (4) лимит стока по акции (promo_allocated/remaining_stock), (5) живой таймер HH:MM:SS для акций, (6) бейдж «Скидка истекла» в админ-списке. Проверено testing_agent iter_94 — backend 8/8, frontend 100%.

## Prioritized Backlog

### Unified «Скидки и акции» tab (DONE — iter_104, backend 27/28, all UI flows pass)
- New admin tab `promotions` (label «Скидки и акции») = `DiscountsPromoTab.js`, two sub-tabs: product discount/tier editor + cart-wide promo codes.
- Discount/promo fields REMOVED from product-card form; `handleSaveProduct` strips them so a catalog save never overwrites campaign data.
- Promo codes backend `promo_codes.py`: CRUD (`/api/admin/promo-codes`), validate (`/api/promo-codes/validate`), percent/fixed, min_order, max_uses, per_user_limit, valid_until (date-only = end of day). Field validation incl. non-negative limits + duplicate guard.
- Checkout (`CartPage.js`): promo input (testids promo-code-field / promo-code-apply-btn / checkout-promo-discount-line), sent in single-method & crypto payloads (not mixed). Order stores `promo_code` + `promo_code_amount`; `used_count` increments only when discount>0.
- min_price floor enforced server-side across product discount + tier + individual price + approved cart discount + promo; validate endpoint floor-caps using cart Σ(min_price×qty).

### Регионы, карта складов, доставка в корзине, акт возврата, условия клиента (DONE — iter_105, backend 15/15, frontend testids/flows pass)
- **Справочник регионов**: коллекция `regions`; `GET/POST /api/admin/regions`, `PUT/DELETE /api/admin/regions/{id}` (переименование каскадом на склады/клиентов/stock_regions; удаление запрещено при привязанных складах). Склад принимает регион только из справочника. UI: `RegionsPanel` на вкладке Склад → Склады; в форме склада `wh-region-select`. `migrate_regions()` на старте.
- **Карта складов**: склад получил `phone, hours, lat, lng, is_public`; точка ставится кликом по карте (`LocationPicker`, leaflet + OpenStreetMap, без ключей). Публичная страница `/warehouses` (`WarehousesMapPage`, `GET /api/warehouses/public`), ссылка в шапке `warehouses-map-link` (только для вошедших клиентов).
- **Доставка в корзине**: `GET /api/cart` отдаёт `stock_regions` по позициям и `delivery_cost` клиента; в CartPage бейдж срока/даты по каждой позиции + `cart-delivery-eta`; строка «Доставка» учитывает индивидуальную стоимость (расхождение iter_104 закрыто).
- **Фильтры каталога**: «Регион склада» (`GET /api/products?region=`), «Срок доставки» и сортировка по скорости считаются по регионной оценке.
- **Акт возврата (Word)**: `GET /api/admin/orders/{id}/return-document[?return_id=]`; кнопки в /admin/orders и /admin/returns.
- **Условия клиента**: `PUT /api/admin/users/{id}` — лимит > 0 + дни отсрочки включают реальную отсрочку (`credit_status/credit_term_days`), 0 выключает; `delivery_cost: null` сбрасывает на общую; валидация отрицательных значений.
- **Вкладка «Скидки и акции»**: добавлены подвкладки «Скидки на корзину» (заявки) и «Акционный баннер».
- Не проверено кликами в UI: оформление заказа в отсрочку после настройки из карточки, скачивание акта кнопкой, фильтр «Срок доставки» (проверены API/наличие элементов).

### ChatGPT (openai gpt-5.4, универсальный ключ Emergent, emergentintegrations 0.2.2) — DONE iter_107 (backend 15/15, 4 UI-сценария)
- `routes/ai.py`: помощник `/assistant` (`POST /api/ai/assistant/chat` SSE, история в `ai_chat_messages`, сессии), умный поиск `POST /api/ai/search` (кнопка `ai-search-btn` при пустом результате каталога), описание товара `POST /api/admin/ai/product-description` (`ai-generate-description-btn`), черновик ответа `POST /api/admin/ai/chat-draft` (`ai-draft-btn`, не отправляется сам). Лимит 60 запросов/сутки на клиента (`ai_usage`). Все функции только для вошедших.

### Минимальная цена и скидки (DONE iter_106, backend 13/13 + 28/28 регресс)
- `GET /api/cart/quote?payment_method=` — сумма товаров как в заказе (общий `_price_cart_lines`); корзина и страница товара показывают цену с учётом min_price; заказ всегда оформляется, скидка урезается до пола.
- Персональная скидка клиента действует при любом способе оплаты (вкл. смешанную и отсрочку).
- Скидки/наценки за способ оплаты редактируются в «Скидки и акции» → «За способ оплаты»; в «Платежи» только просмотр.

### Iter 108 (DONE — backend 16/16 + 41/41 регресс, 8 UI-проверок)
- **Гости в помощнике**: `/assistant` без входа, 5 вопросов/сутки на IP (`_use_guest_quota`, общий потолок 300/сутки), `get_optional_user`.
- **В корзину из чата**: кнопка `ai-add-to-cart-{id}` на товарах в ответе. **Передача менеджеру**: `POST /api/ai/assistant/handoff` → сообщение в чат поддержки (`ai-handoff-btn`).
- **Описания пачкой**: `GET/POST /api/admin/ai/bulk-descriptions[/start|/stop]`, фоновая задача, состояние в `settings.ai_bulk_descriptions`; кнопка `ai-bulk-descriptions-btn` в Каталоге. Пишет только пустые описания.
- **Серверный расчёт корзины**: `_compute_order_pricing` — общий для `create_order` и `POST /api/cart/preview`; CartPage берёт итог, промокод, перс. скидку и доставку из preview.
- **Баннер на витрине**: флаг промокода `show_on_storefront`, `GET /api/promotions/active`, `PromoStrip` на главной и в каталоге.
- **Скидка на категорию**: `POST /api/admin/products/category-discount` (с подкатегориями), `CategoryDiscountPanel`.
- **Календарь**: `components/DatePicker.js` (popover + calendar, ru) для всех «Действует до».
- Не проверено кликами/полным прогоном: добавление в корзину из чата и передача менеджеру в UI (API проверены), полный прогон массовых описаний (проверены статус/права).

### Iter 109 — статусы клиентов, условия, менеджеры (DONE — backend 25/25 + 29/29 регресс, UI — смоук)
- **Статусы**: `customer_status` только `retail` / `wholesale` (миграция partner/opt/b2b → wholesale на старте). Новый клиент — retail.
- **Стандартные условия** (`settings.status_conditions`, Настройки → «Условия по статусам»): скидка, доставка, отсрочка, лимит для retail/wholesale + % от прибыли для менеджеров. `database.effective_conditions` применяется в `get_current_user` (индивидуальные > стандартных), `effective_credit` — в отсрочке.
- **Запрос индивидуальных условий**: `POST /api/conditions-requests`, `GET /api/my-conditions` (карточка «Мои условия» в /account); админ `GET/PUT /api/admin/conditions-requests` — одобрение делает клиента оптовым.
- **Роль manager** (`routes/staff.py`): CRUD `/api/admin/staff` (soft delete, пароль только bcrypt), привязка `/api/admin/staff/{id}/clients`, статистика `/api/admin/staff/{id}/stats?period=`. В заказ пишется `manager_id` на момент оформления. Страница `/admin/staff`.
- **Кабинет менеджера** `/manager`: статистика, клиенты + их индивидуальные условия, чаты своих клиентов (`/api/manager/*`).
- Демо: manager@avarus.ru / manager123, к нему привязан user@demo.com с прошлыми заказами.
- Не проверено: отправка ответа менеджером в чат и стандартные доставка/отсрочка по статусу (код есть, авто-проверки не было); UI проверен только на наличие элементов.

### Iter 110 (DONE — backend 14/14 + 25/25 регресс, UI — смоук)
- Менеджер не меняет условия клиента сам: `POST /api/manager/clients/{id}/conditions-request` → админ одобряет в «Сотрудники → Запросы условий» (статус клиента при запросе менеджера не меняется). Прямой PUT удалён.
- `GET /api/admin/orders` отдаёт `manager_name`; бейдж `order-manager-{id}` в /admin/orders.
- Выплаты: коллекция `manager_payouts` (soft cancel), `GET/POST/DELETE /api/admin/staff/{id}/payouts`, `GET /api/manager/payouts`; колонка «К выплате», панель `PayoutsPanel`.
- График: `GET /api/admin/staff-chart?months=`, `StaffSalesChart` (recharts) на /admin/staff.

### Iter 111 (DONE — backend 9/9 + 39/39 регресс, UI — смоук)
- В заказ пишется `manager_commission_percent` (на момент оформления); `_manager_stats` считает вознаграждение по проценту заказа, заказы без него (старые / засчитанные при привязке) — по текущему проценту. Объединение заказов сохраняет менеджера.
- Выплата больше остатка → 400. `staff-chart` отдаёт `profit`, переключатель `chart-metric-*`. Фильтр `orders-manager-filter` в /admin/orders.
- Тестовые менеджеры TEST_ удалены и отвязаны от заказов.

### Iter 112 (DONE — backend 28/28, UI — смоук)
- **Менеджер на странице связи**: `MyManagerCard` («Имя Ф.» + телефон / «Менеджер не назначен»).
- **ИИ-подбор с интернетом**: `_lookup_part` (Gemini 2.5 Flash + googleSearch — веб-поиск OpenAI через универсальный ключ недоступен) → номера OEM/аналогов → поиск в каталоге → ответ GPT-5.4; `done.suggest_handoff`, `done.found_articles`.
- **Гараж** (`routes/garage.py`, `/garage`): техника с VIN (17 симв.), `vehicle_id` в заказе (выбор в корзине `checkout-vehicle-select`), история запчастей и «купить снова», привязка старых заказов.
- **Панель менеджера** `/manager`: статистика по клиенту, заказы клиентов, каталог без закупочных цен (`/api/manager/products`), оформление заказа за клиента (`POST /api/manager/clients/{id}/orders` — через create_order на условиях клиента, корзина клиента сохраняется).
- Чаты менеджера — только свои клиенты; админ видит все.

### P1 (Important)
- CartPage/ProductPage display mismatches (pre-existing): payment-method adjustment & tier preview not clamped to min_price in UI (server charges correct floor). Best fixed via a server-computed cart preview.
- Ссылка на карту складов для гостей (сейчас в шапке только для вошедших клиентов).
- Индивидуальная скидка клиента действует только при оплате с баланса (решение iter 94) — уточнить у пользователя, нужна ли на все способы оплаты.

### P2 (Enhancement)
- Decrement promo `used_count` on order cancel; make max_uses check atomic (find_one_and_update)
- Allow clearing `discount_until`/`promo_allocated_stock` to null from editor (update_product drops None)
- shadcn Calendar for «Действует до» instead of native date input
- Refactor AdminPage.js (~4000 lines), orders.create_order (~400 lines)
- Unify save validation toasts (currently stacking when multiple fail)
- Persist `_ensure_new_status` flips to DB (currently mutation is Python-only)
- Apply payment_method adjustment in `GET /api/cart` for consistency with `POST /api/orders`

### P3 (Nice to have)
- Bulk discount editor (apply % to category)
- Promo banner on catalog when any discounts active
- Smart sorting

## Key Notes
- Admin must /start Telegram bot to activate notifications
- Russian UI
- Returns: 10% fee, per-program bonus deduction; photos required (min 1)
- Balance: admin can go negative
- Legacy products default `bonus_eligible=True`
- Discount auto-expires client-side via `discount_until` check


## Reward systems fine-tuning (June 2026, iteration_113)
- Three reward systems: bonus points, Ozon certificates (% of order), cashback (NEW). Client picks ONE system once on /bonus (`RewardsPage` → chooser / BonusPage / OzonRewardView / CashbackView); admin can change or reset it. Client sees only the chosen system (points endpoints return empty/403 for others).
- Settings (`db.settings` key `reward_settings`, `routes/rewards.py`, admin UI `components/admin/RewardSettings.js` in the Bonus tab): per system enabled, retail/wholesale %, min order, order-amount tiers, exclude discounted items, reduced-rate rules per product / category / warehouse (lowest matching rate wins); ozon `round_to`; cashback `allow_pay`, `max_pay_percent`, `allow_withdraw`, `min_withdraw`.
- Order stores snapshot: `reward_system`, `reward_rates`, `reward_scale`, `reward_expected`, `cashback_used`. Accrual happens on completion/fulfillment (`accrue_order_reward`, idempotent). Legacy orders (no `reward_system` key) use the old points path.
- Cashback: `users.cashback_balance`, `cashback_transactions`, `cashback_withdrawals`; pay in cart via `use_cashback`; refund on cancel; deducted on approved return; withdrawal requests handled by admin.
- Ozon certificate is no longer granted at order placement; old checkout "points vs ozon" choice removed. Legacy `/ozon-settings` endpoints unused.
- Tests: `backend/tests/test_rewards_system.py` (15/15). Frontend only smoke-tested (cart cashback block, returns with cashback not deeply UI-tested).

### Backlog
- P1: print layout refinement for return document
- P2: reward rules by manufacturer / client-specific rates; expiry of points/cashback; spend limit for points
- P2: useEffect dependency warnings in old components

## Manager earnings per product + brand reward rates (June 2026)
- `/api/manager/products` returns `commission` (₽ per unit at list price = manager % × (price − purchase_price)); `/api/manager/orders` returns `commission` per item and per order (only orders counted for the manager, snapshot % from order). Shown in ManagerSales.js: catalog, order draft (per line + total), client orders list. Purchase price itself is still not returned.
- Reward rules: new type `manufacturer` (brand, matched case-insensitively by product.manufacturer). Brand rate may be lower or higher and overrides base rate and all other rules. UI: RewardRulesEditor «Бренд».
- Self-tested via curl + screenshot (no testing agent run). Note: standard manager commission in site settings is currently 0%, so earnings show 0 ₽ until a percent is set.

## Site features page «Функционал сайта» (June 2026, iteration_114)
- `/admin/features` (`AdminFeaturesPage`, header link «Функционал»): 19 switchable functions in 5 groups; toggle with confirmation dialog; card short description; click → dialog with full description, audience (all/retail/wholesale for page-type functions) and embedded settings (`FeatureSettingsPanel`: discounts, promo codes, cart discounts, rewards, credit/managers conditions, returns, parts finder, AI bulk descriptions, news, telegram).
- Backend `routes/features.py`: flags in `db.settings` key `site_features`, cached; `is_on(key, user)`; middleware in `server.py` rejects client write requests of disabled functions (403); logic checks in orders (discounts, individual prices, cart discount, deferral), promo codes, rewards/bonus accrual, telegram sending; products hide discounts when off and product update keeps stored discount fields.
- Frontend: `lib/siteFeatures.js` registry (routes, adminRoutes, hide selectors, texts), `FeaturesContext` (isOn/isEnabled, generated CSS hides links/elements site-wide, route guard in App.js redirects to `/` or `/admin`), AdminPage hides tabs of disabled functions.
- Data of a disabled function is never deleted.
- Functions without own settings panel (toggle + audience only): price_requests, product_requests, garage, chat, favorites, warehouses_map, promo_banner, admin_carts.
- Tests: `backend/tests/test_iter114_site_features.py` (24/24), frontend 100%.

## Parameters for garage / chat / favorites / banners / product requests (June 2026, iteration_115)
- `routes/features.py`: `SETTINGS_DEFAULTS`, `fsettings(key)`, `GET /api/feature-settings`, `PUT /api/admin/feature-settings/{key}` (full replace, sanitized). Stored in `db.settings` key `feature_settings`. Frontend: `useFeatures().settings`, forms in `FeatureSettingsPanel.js` (`PARAM_FIELDS`, `ParamsForm`, `BannerManager`).
- Garage: max_vehicles, allowed_types (truck/trailer/car/special, `lib/garageTypes.js`), checkout_mode off/optional/required (required only when client has vehicles; manager orders bypass via `manager_order` contextvar).
- Chat: title/subtitle/greeting, guests_allowed (guest endpoints `/chat/guest/send|messages`, session id in localStorage `guest_chat_sid`), attachments_allowed (+ NEW `/chat/upload`, `/chat/send-media` via Cloudinary — were missing before), work hours + auto reply (max once per 3h per chat).
- Favorites: max_items, notify_price_drop, notify_back_in_stock (`notify.notify_favorites_change`, hooked in product update and warehouse stock recalculation).
- Product requests: show_out_of_stock, show_not_found, comment_required, offer_valid_days (`offer_expires_at`, status `expired`).
- Promo banner: existing editor embedded in the card.
- Tests: `backend/tests/test_iter115_feature_settings.py` (21/21). Manager test password was reset to manager123 (had drifted).
- Still toggle-only (no own params): price_requests, warehouses_map, admin_carts.

## Manager-only panel + admin regrouping (June 2026, iteration_116)
- Manager: dedicated header (`manager-header`: cabinet, AI assistant, profile, logout); App.js guard redirects every other path to /manager; no chat widget/footer/banner; /account hides balance card for manager.
- Admin header (`components/admin/AdminNav.js`, registry `lib/adminNav.js`): pinned Заказы/Чаты + 5 dropdowns (Продажи, Каталог, Клиенты, Маркетинг, Система), badges from `GET /api/admin/attention` (`routes/attention.py`), Ctrl+K search (pages, settings sub-tabs, site functions via `/admin/features?open=key`), mobile grouped menu.
- AdminPage: old tab bar + tab-order editor hidden; tab driven by `?tab=`; Settings/Marketing sub-tabs deep-linkable via `&sub=`; «Требует внимания» block on overview.
- Duplicated settings intentionally kept in both places (user choice).
- Tests: iteration_116 — backend 9/9, frontend 100%.

## Admin panel page with sidebar, live refresh, merged client functions (June 2026, iteration_118)
- Admin header: Заказы, Чаты, «Админ панель» (`admin-panel-link` → /admin), search, notifications, logout. The 5 groups (Продажи, Каталог, Клиенты, Маркетинг, Система) moved to a left sidebar `components/admin/AdminSidebar.js` shown by App.js on every /admin* page except /admin/orders and /admin/chats. Registry still `lib/adminNav.js`; mobile keeps the grouped menu.
- Real time: `lib/live.js` `useLive(fn, ms, enabled)` — polling (10–30s, paused in hidden tab) + refresh ~0.4s after any non-GET axios response. Used by attention counters, AdminPage (`refreshLive`: stats, users, orders, bonus, products, categories, partners, news — settings forms are NOT polled so edits are not overwritten), carts, returns, credit, staff, conditions requests, cashback withdrawals, cart discount requests, dashboard. AdminPage/AdminCartsPage no longer blank the page with a loader after the first load.
- Client: `/parts` (`PartsHubPage`) = AI assistant + parts finder with mode switch (`?mode=ai|params`, both stay mounted); /assistant and /parts-finder redirect there; modes follow feature flags `ai_assistant` / `parts_finder`; manager sees AI only. One header button `parts-hub-link`.
- Client: `components/RegionWarehouses.js` — one dropdown (`region-selector`): region chips, warehouses of the region, link to `/warehouses?region=` (map page pre-filters). Warehouse part follows `warehouses_map` flag.
- Tests: iteration_118 (frontend selectors/navigation 100%); live cart refresh self-verified in browser. Not click-tested: every single admin action, AI answer/finder search inside the hub, hub behaviour with functions switched off.


## Garage in finder, mobile admin drawer, safe code-review fixes (June 2026, iteration_119)
- Finder (`PartsFinderPage`): block `finder-garage-block` — select of garage vehicles fills VIN, year, brand (first word of vehicle name) and model (rest). Follows `garage` flag.
- Mobile admin: `AdminMobileDrawer` (in `AdminSidebar.js`, shadcn Sheet from the left) replaces the dropdown list; old `AdminMobileNav` removed.
- Code review, done: `GET /api/rewards/cart-preview` moved to `routes/orders.py` (no rewards→orders import); real account passwords removed from tests → `backend/tests/.env.test` (gitignored) loaded by `tests/conftest.py` together with `frontend/.env`; all 19 real `react-hooks/exhaustive-deps` warnings fixed (useCallback in Auth/Cart contexts, function refs elsewhere) — frontend compiles with 0 warnings; 22 empty catch blocks log errors; Header/SettingsTab take the token from auth context / axios defaults. Pylint found no possibly-undefined variables.
- Code review, NOT done (would change site logic or is a large risky refactor): auth token from localStorage → httpOnly cookies (changes login, needs user decision), admin password «admin», splitting big components / complex functions, array-index keys.
- Tests: iteration_119 — backend 8/8, frontend regression 100%.
- Full backend suite after these changes: 482 passed, 26 failed, 11 skipped (26 min). The 26 failures are stale tests, not login/password related: old warehouse API without `warehouse_id` (test_iter76/79, test_warehouse_finance, test_warehouse_receipts_cogs), removed `/ozon-settings` endpoints (test_iter79), data-dependent ones (empty cart in test_iter105, overdue deferral of the test client, favorites limit in test_iter115). Backlog: update or delete them.

## Garage brand/model, find-parts button, cookie login, test suite repair (June 2026, iteration_120)
- Garage: vehicles have separate `brand` (required in the form) and `model`; `name` = "brand model" is still stored for old screens. Old vehicles without `brand` are split by first word (form + finder). Card button «Подобрать запчасть» (`garage-find-parts-<id>`) → `/parts?mode=params&vehicle=<id>`, finder pre-fills from it. Button follows `parts_finder` flag.
- Login session moved to an httpOnly cookie `access_token` (Secure, SameSite=None, 7 days): `set_auth_cookie`/`clear_auth_cookie`/`request_token` in `database.py`, `POST /api/auth/logout`, `get_current_user` reads Bearer header first (API clients, tests), then the cookie. Frontend: no token in JS at all (`AuthContext` has no `token`; axios `withCredentials`; fetch `credentials: 'include'`), old `localStorage.token` is removed on load. CSRF: `cookie_origin_guard` middleware in `server.py` rejects cookie-authenticated requests whose `Origin` host is not the site (Host / X-Forwarded-Host / FRONTEND_URL / CORS_ORIGINS). Notes: /app/auth_testing.md.
- Deliberate deviation from the auth playbook: one 7-day token (as before) instead of 15-min access + refresh; no brute-force lockout added (backlog).
- Tests: stock tests now use throwaway products (`temp_products`) and `warehouse_id` fixtures from `tests/conftest.py`; removed tests of deleted Ozon settings endpoints and of prize redemption under overdue debt; tests that place orders use user@demo.com (0x0errorr@gmail.com has a really overdue deferral of 1830.6 ₽ and cannot order).
- Bug fixed: favourites limit counted products that no longer exist.
- Known data issues (not fixed): `users.password_plain` stores passwords in clear text (admin UI shows them); `products.stock` can differ from the sum of warehouse levels (e.g. product 23cda779: stock 8, levels 0) and the next warehouse operation overwrites it with the sum; demo client has unpaid deferrals due 29–30 Nov 2026 — once overdue it cannot place orders and order tests will fail.
- Admin password: secret `ADMIN_PASSWORD` (backend env, test + live slots). `sync_admin_password()` in `server.py` lifespan applies it once per value (marker `settings._id = admin_password_sync`), so a later change in the admin profile is not overwritten; also removes the admin's `password_plain`. Old password «admin» rejected (401). Production gets it on the next publish.
- Tests after all changes: full backend suite 502 passed / 0 failed (before the password change); iteration_120 — backend 13/13, frontend 100%; after password change 22/22 admin tests re-run.

## Warehouse logic rework (June 2026, iteration_121)
- Single source of truth = `stock_levels` (per warehouse); `products.stock` is always their sum. Startup `reconcile_all_stock()` (sum over warehouses wins, logs movement `correction`, drops levels of deleted products). Admin: `GET/POST /api/admin/warehouse/reconcile`, card `StockControl` in the stock tab.
- Stock typed in a product card / bulk edit / CSV import → `set_total_stock()` books the difference on the main warehouse as movement `adjustment`. Legacy orders without allocations are restored to the main warehouse.
- Selling only from stock (when global stock sync is ON): `ensure_available()` in cart add/update and order creation → 400 «в наличии только N шт.»; `allocate_stock` is conditional and rolls back. Frontend cart shows the message as a toast.
- "Reserved" = goods of unpaid orders, already taken off stock at order time (old `available = stock - reserved` double-counted; now `available == stock`).
- Min stock: `products.min_stock` (None = shop default `settings.warehouse_settings.default_min_stock`, 5; 0 = not tracked). `PUT /api/admin/warehouse/min-stock`, `PUT /api/admin/warehouse/settings`. Filter «Пора заказать», attention counter `low_stock`, admin notification when a product crosses its minimum.
- Inventory: `POST/GET /api/admin/warehouse/inventory` (docs `stock_inventories`, number И-000001), tab «Инвентаризация» (`components/admin/InventoryTab.js`).
- Returns: approve accepts `{restock, warehouse_id}`; goods go back to the chosen warehouse, else the one the order shipped from, else main; movement `return`; `returns.restocked`.
- Movement types now: receipt, writeoff, sale, transfer, inventory, adjustment, correction, return, cancel (`log_movement()` helper). Warehouse tab auto-refreshes (useLive).
- Tests: `tests/test_iter121_warehouse_logic.py`; `conftest.py` `stock_for_orders` gives every product a temporary receipt for the run and writes it off afterwards.

## Manager cabinet: showcase, tasks, repeat order, selection (June 2026, iteration_122)
- `/manager/showcase` (`pages/ManagerShowcasePage.js`): search by several words (name/article/cross/manufacturer), category/manufacturer/in-stock filters, sort (name, price, stock, commission, new), grid/list switch (saved), price + promo + min price + manager commission + price for a chosen client. Product page `/manager/showcase/:id` (description, photos, cross numbers, stock per warehouse). Purchase price is never sent.
- Backend (`routes/staff.py`): `GET /manager/products` (+category_id, manufacturer, sort, client_id, ids), `GET /manager/products/filters`, `GET /manager/products/{id}`, `POST /manager/clients/{id}/selection` (posts the list with client prices to the client's chat), `GET/POST/PUT/DELETE /manager/tasks` (collection `manager_tasks`). Client price = individual price or list price → promo → personal discount, not below `min_price` (approximation of order pricing).
- Shared order draft `lib/managerDraft.js` (localStorage `manager_draft`: items + clientId) used by showcase, product page and tab «Товары и новый заказ»; «Повторить заказ» in the orders tab; tab «Задачи» with overdue badge.
- Tests: `tests/test_iter122_manager_showcase.py` (temp manager/client/product).

## Selection in client account, test manager, manager tests repaired (June 2026, iteration_122 report)
- «Подборка для клиента» no longer goes to chat: `POST /api/manager/clients/{id}/selection` saves a doc in `manager_selections` ({id, user_id, manager_id, manager_name, note, items[{product_id, quantity}], created_at, deleted_at}) and notifies the client (link /account).
- Client: `GET /api/my-selections` (live name/stock + client price), `DELETE /api/my-selections/{id}` (soft). UI `components/ManagerSelections.js` on /account: add one / add all to cart, delete.
- Repeat order (moves goods to manager draft) and draft persistence verified in UI (iteration_122: 8/8 flows).
- Tests: persistent test manager test.manager@avarus.ru + bound client test.client@avarus.ru (see test_credentials.md); login tests use it. Tests that need the owner's manager@avarus.ru sign a token in `tests/conftest.py` (`TEST_DEMO_MANAGER_TOKEN`) — his password is never needed or changed.

### Backlog
- P1: postponed code-review items (split BonusTab / CRMTab / AdminChatsPage, complex functions in admin.py / documents.py, index keys)
- P2: manager sees whether the client opened / ordered from a selection; brute-force lockout on login; remove `users.password_plain`

## Audit + fixes in preview (June 2026) — full report: /app/memory/AUDIT_REPORT.md
Owner decisions: the third-party card gateway is removed for good (do not offer it again); card payment = requisites issued by hand by the admin; production (Beget) must not be touched; fixes go to preview only.
- Balance top-up is a request (`balance_transactions` status pending -> completed/failed): `POST /api/user/balance/topup`, admin `GET /api/admin/balance-topups`, `POST .../{id}/requisites|confirm|reject`. UI: `components/admin/BalanceTopups.js` (admin payments -> «Предоплата»), `components/TopupStatus.js` (client balance history).
- Card order payment: `card_status` always starts as `awaiting_requisites`; `/api/card-payment-settings` is an admin-only template, mode is always `per_order`.
- create_order reserves stock first (`_reserve_cart_stock`) and releases it if the order is not created; customer cancel and expired-order cancel are atomic; `/api/orders/check-expired` is admin-only.
- merge_orders keeps money/discount/stock fields, re-links related docs, archives originals in `merged_orders_archive`.
- Crypto: a tx hash pays one order (check + unique partial index); `/payments/crypto/submit` checks ownership.
- Telegram chat webhook requires Telegram secret token (webhook must be re-installed from the admin Telegram tab after deploy); commands only from the bound admin chat.
- Passwords: no new plaintext copies (`password_plain` is not written, unset on change). Existing stored values untouched — owner decision pending.
- Login limit (Mongo `login_attempts`, TTL): 10 fails / 15 min per e-mail+IP, 50 per e-mail; forgot-password 5 / 15 min.
- Search text escaped in all `$regex`; upload deny-list; indexes created at startup (`ensure_indexes` in server.py); staff pages lazy-loaded in App.js; NotificationsPage waits for auth.
- Dependencies: axios 1.21, react-router-dom 7.18; python-multipart, PyJWT, requests, urllib3, aiohttp, pymongo 4.6.3, pillow and others bumped.
- Baseline screenshots for visual regression: /app/test_reports/baseline/ (56 files).

### Pending owner decisions
- Purge stored plaintext passwords and hide them in admin UI?
- Auto-refund to balance when a card/crypto-paid order is cancelled?
- Auto-restock of the unshipped remainder on partial fulfilment?
- Case-insensitive e-mail on login/registration?

### Backlog after the audit
- P1: FastAPI/Starlette upgrade with full regression; isolated test DB
- P2: single role dependency instead of ~190 inline checks; N+1 queries and pagination; split create_order & other complex functions; split AdminPage/BonusTab/CRMTab/AdminChatsPage (compare with baseline screenshots)
- P2: API for Android (refresh tokens, /api/v1, unified errors, push)
- P3: remove unused ui files/packages/variables after checking production logs
