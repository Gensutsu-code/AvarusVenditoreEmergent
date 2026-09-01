# Changelog

## 2026-06-28 — Bonus prize grid: 6 per row (compact cards)
- `BonusPage.js`: grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` → `grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6`, tighter gap; reduced card padding, title/price font sizes and button height so 6 prizes fit neatly in one row. Verified via screenshot.


## 2026-06-28 — Fix: bonus levels roadmap fill not aligned to nodes
- `BonusPage.js`: the "Путь уровней" track fill was `yearlyTotal / maxLevelPoints`, but nodes are spaced EVENLY (`justify-between`), so with uneven level thresholds the fill line didn't line up with achieved nodes. New `roadmapFillPct` is computed from node index positions: fill reaches exactly the highest achieved node + the fraction of progress toward the next node (`((achievedIdx + frac) / (levels-1)) * 100`), 100% when all achieved. The "до следующего уровня" bar already used the correct `level_percentage` (progress between current and next level).


## 2026-06-28 — Checkout reward choice: bonus points vs extra Ozon certificate
- **Checkout toggle** (`CartPage.js`): «Как начислить вознаграждение за заказ» with two cards — «Бонусные баллы» (default) and «К Ozon-сертификату». Sends `reward_choice` ('points'|'ozon') in all order paths (main/mixed/crypto). Live preview shows expected points and the equivalent «+N ₽ к сертификату». Header "+N баллов" popup fires only when 'points' is chosen.
- **Backend** (`orders.py` + `bonus.py` + `models.py`): `OrderCreate.reward_choice`. On placement, if 'ozon': expected cashback points are computed (`calc_points_for_eligible`), floored DOWN to a multiple of 500, converted at **2 points = 1 ₽**, and added ON TOP of the base Ozon certificate (`ozon_certificate_bonus`, stored on order). `accrue_order_bonus` skips point accrual when `reward_choice=='ozon'` so the reward isn't granted twice.
- Verified via curl: 15 pcs → 720 expected pts → floor 500 → +250 ₽, added to base 1000 ₽ = 1250 ₽ certificate; 'points' choice → base 1000 ₽ only, bonus 0, points accrue on fulfillment.


## 2026-06-28 — Bonus page container widened +50%
- `BonusPage.js`: main container `max-w-4xl` (896px) → `max-w-[1344px]` (~+50% wider). Hero, levels roadmap and prize grid now use the extra width. Also cleared the leftover temp description so the program `description` is empty again (to be filled in Admin).


## 2026-06-28 — Bonus: restore program description on hero
- `BonusPage.js`: the program description is now rendered as a prominent, readable full-width paragraph under the title inside the hero (`text-sm text-white/70`, wraps up to max-w-2xl) instead of the tiny truncated line introduced during the redesign. `data-testid="bonus-description"`.
- Note: the current program's `description` field is empty in the DB, so nothing displays until it is filled in Admin → Бонусы.


## 2026-06-28 — Bonus: admin hero cover, header "+N баллов" after order, remove "Мои призы"
- **Admin hero cover** (`BonusTab.js` + `bonus.py`): added `hero_preset` (6 presets: midnight/graphite/ocean/royal/sunset/forest) + optional `hero_image_url` to the program (persisted via `BonusProgramCreate`). Admin picks a preset swatch and/or uploads a background image, with a live preview. `BonusPage.js` applies `HERO_PRESETS[program.hero_preset]` to the hero background + glow colors; if `hero_image_url` is set it renders as a cover with a dark gradient overlay.
- **Header "+N баллов" after order**: `Header.js` listens for a `bonus-points-earned` window event and shows a floating emerald "+N баллов" popup above the "Бонусы" nav item (gift icon wiggles). `CartPage.js` fetches expected points via `/bonus/cart-preview` right before placing the order (cart still full) and dispatches the event on success across all payment paths (crypto, mixed, main). Verified: event → popup "+1 734 баллов".
- **Removed "Мои призы"** block (and its now-unused state/fetch) from `BonusPage.js`.


## 2026-06-28 — Bonus: "+N баллов" accrual wow animation
- `pages/BonusPage.js`: `detectPointsGain()` compares the current points balance against the last-seen value persisted per user+program in `localStorage` (`bonus_seen_<userId>_<programId>`). On an increase (e.g. cashback credited after an order), a floating emerald "+N баллов" popup rises and fades over the balance, the balance number does a scale pop, and confetti fires. First visit only stores the baseline (no false trigger); redemptions decrease the balance so they never trigger it.
- Verified via browser: popup `data-testid="points-gain-popup"` renders with the correct delta ("+2 500 баллов").


## 2026-06-28 — Bonus page RADICAL redesign (client)
- `pages/BonusPage.js` header/level/progress area fully rebuilt into a premium dark hero:
  - Animated aurora glow blobs (orange/amber/teal) + subtle dot-grid texture on a near-black `#0a0e17` panel.
  - Large glowing gradient points balance (animated counter) with a "К призам" quick-scroll button.
  - Level medallion (pulsing ring, level-color gradient, Award icon) + big gradient cashback badge.
  - Glowing "до следующего уровня" progress bar with an animated shimmer sweep and remaining ₽.
  - Gamified "Путь уровней" roadmap: connected nodes on a track, achieved=checkmark+color gradient, current level pulses, locked=dim; per-node threshold + cashback pill; staggered spring entrance.
  - Prizes moved into a "Магазин призов" section with an anchor for the scroll button; kept existing OOS badge / "+ параметры" / variant modal logic intact.
- Verified via screenshot: hero, medallion, progress and roadmap render correctly on the demo program (4 sample levels were added to the preview program so the roadmap is visible — editable in Admin → Бонусы).


## 2026-06-28 — Bonus system: out-of-stock, variants, bulk indexation, page redesign
Backend (`routes/bonus.py`):
- `redeem_prize`: accepts `selected_options`, validates each option group is chosen, adds option points to base cost; blocks redemption when prize `out_of_stock` or quantity 0; stores options breakdown on the redemption.
- `update_prize_redemption_status`: new `reason` param — `reason=out_of_stock` on reject returns points, auto-sets the prize `out_of_stock=true`, and notifies the client ("Приз закончился…"). Alias updated to pass reason.
- New `POST /api/admin/bonus/index-prices` ({percent, program_id?}) — bulk-adjusts all prize `points_cost` and option `points` by a % for one program or all.
Admin (`components/admin/BonusTab.js`):
- Prize editor: out-of-stock toggle + variant/options editor (groups → choices with +points).
- Bulk price indexation card (percent + scope select all/one + apply).
- "Нет в наличии" reject button on pending prize requests.
Client (`pages/BonusPage.js`):
- Removed the top "Бонусная программа" pill.
- Redesigned current-level hero card (pulsing trophy badge, level color gradient) and a clearer animated "Покупки за YYYY → next level" progress bar (framer-motion spring).
- Prize cards: "ЗАКОНЧИЛСЯ" red badge + grayscale + disabled button for out-of-stock; "+ параметры" badge for prizes with options.
- New variant selection modal (pill buttons per group, live animated total = base + options) before redeeming.
- Verified: testing_agent iteration_100 — backend 8/8 pytest, frontend 100%, no blockers.


## 2026-06-28 — Fix: individual price badge persisted after order + lint cleanup
- **Bug**: "Ваша цена по договорённости" (individual/negotiated price) stayed on the catalog/product card after an order was placed. Backend already deactivates one-time individual prices on every order path (`orders.py` L599-604) — verified via curl for card/deferral/mixed. Root cause was frontend: `CatalogPage`/`ProductPage` kept their own local individual-price state and never re-fetched within the SPA session.
- **Fix**: centralized on `IndividualPriceContext` as single source of truth.
  - `CatalogPage.js`: removed local `individualPrices` state + fetch; now uses `getIndividualPrice(product.id)` from context.
  - `ProductPage.js`: removed local fetch effect; derives `individualPrice` from context.
  - `CartPage.js`: calls `refreshIndividualPrices()` after every successful order (crypto, mixed, main path) so the badge clears immediately without a page reload.
- Verified e2e via browser: placed a real order for a product with an active individual price → badge disappeared, product returned to regular price with the discount-request button restored.
- **Lint cleanup** (unblocked pre-completion gate): deleted dead `backend/server_backup.py`; fixed bare `except:` in `documents.py`, `tests/test_bulk_operations.py`, `tests/test_multiple_bonus_programs.py`.


## 2026-06-24 — Checkout/Cart rework + UI fixes (7 user requests)
1. **Returns page (/returns)**: removed collapsible "Условия и правила возврата" block; fixed broken JSX (missing `{loading ? (`). File: `ClientReturnsPage.js`.
2. **Contact page (/contact) → Скидки и условия**: fully removed customer statuses (Розница/Опт/Партнёр) — deleted "Текущий статус" card, "Повышение статуса" block and `submitStatus`. Discount request kept. File: `ContactPage.js`.
3a. **Chat scroll**: mini `ChatWidget.js` and `ContactPage.js` chat now auto-scroll to bottom only when user is already near the bottom (threshold 80px); force-scroll on open and on send. Added attachment (paperclip) + emoji picker + image lightbox to ContactPage chat (parity with mini widget).
3b. **Warehouse → admin tab**: `AdminWarehousePage` now embeddable (`embedded` prop) and rendered as a "Склад" tab inside `AdminPage` (tabConfig + tabOrder migration). Route `/admin/warehouse` redirects to `/admin`; Header links removed.
4. **Admin product availability dot**: red/green dot now uses effective `in_stock` (respects global stock-sync mode) instead of raw `stock>0`. Backend `/admin/products` now applies `_apply_availability`. Files: `AdminPage.js`, `AdminProductsPage.js`, `products.py`.
5a. **Deferred card/crypto payment**: admin setting in Платежи tab (`deferred_payment_enabled`, `deferred_payment_hours`). Checkout shows "Оплатить позже" toggle for card/crypto; order created immediately with `payment_due_date`; `check_expired_orders_task` auto-cancels unpaid card/crypto orders past due (skips those with uploaded receipt) and restores stock. Files: `settings.py`, `orders.py`, `server.py`, `models.py`, `PaymentsTab.js`, `CartPage.js`.
5b. **Cart + checkout merged**: `CartPage.js` rewritten to include shipping form, payment methods, mixed payment, terms and place-order on the same page. `/checkout` now redirects to `/cart`. `CheckoutPage.js` orphaned (kept in repo).
6. **Free delivery & Ozon certificate** now computed from the ADJUSTED goods total (after payment-method discount/surcharge), both frontend bars and backend.
7. **Mixed payment** simplified: toggle + pick 2 methods + allocate base-goods amounts; each method's %adjustment applies to its own part; delivery fee allocated to a non-balance part; parts sum to total. Backend `create_order` reworked.

Tested: iteration_77 — backend 7/7 pass, frontend all testids verified, no critical issues.

## 2026-06-24 — Follow-up: payment countdown + mixed payment redesign
- **Orders page (/orders)**: added live countdown to payment deadline for deferred card/crypto orders (`payment-due-block`, `payment-countdown`). Card shows receipt-upload below; crypto shows "Оплатить сейчас" button (`pay-now-btn`) opening the crypto payment modal for the full order total. Banner switches to "Срок оплаты истёк" when expired. File: `OrdersPage.js`.
- **Mixed payment redesign (/cart)**: replaced the dropdown UI. Now an on/off toggle; when ON the visible payment-method cards become multi-select (pick exactly 2 of balance/card/cash; crypto/deferral disabled, shown with №1/№2 badges). Amount input fields appear in the "Итого" (place-order) block — first method editable, second is the auto remainder; per-part %adjustment shown and applied. Verified via screenshot. File: `CartPage.js`.

## 2026-06-24 — Mixed payment UI polish + bugfix
- Fixed runtime error "Maximum update depth exceeded" caused by a Radix `Switch` used as a controlled toggle on /cart. Replaced both mixed/pay-later toggles with smooth custom CSS switches.
- Redesigned the mixed-payment amount fields: clean white sub-cards per method, editable amount input with native number spinners hidden, read-only styled remainder, adjustment chips, and per-method "к оплате" line. Polished the place-order button (rounded-2xl gradient, hover shadow, active scale).
- Verified by testing_agent iteration_78: 100% pass, no runtime errors, math consistent, button enable/disable correct.

## 2026-06-24 — Ozon settings, orders filter, warehouse polish, chat scroll
1. **Ozon certificate admin settings** (Bonuses tab): new card to configure reward amount and order-sum step/threshold (`ozon-settings-card`, step/reward/enable). Backend `GET /ozon-settings` + `PUT /admin/ozon-settings`; `create_order` computes `floor(goods/step)*reward` (0 if disabled). `OzonCertificateBar` reads the settings. Files: `settings.py`, `orders.py`, `AdminPage.js`, `OzonCertificateBar.js`.
2. **Orders time filter** (/orders): period bar (week/month/year/all), default last month — applies to the **statistics block** (totals, avg, items, by-status recomputed from period-filtered orders), NOT the orders list. The orders list always shows all orders. File: `OrdersPage.js`.
3. **Warehouse polish**: bulk receipt/write-off already existed — improved bulk-operations bar (own row, clearer labels) and fixed embedded-tab padding (TabsContent p-6). File: `AdminWarehousePage.js`, `AdminPage.js`.
4. **Contact chat auto-scroll removed**: deleted the messages-change autoscroll effect; chat now scrolls to bottom only on opening the chat tab and right after sending; scrolls the inner container only (never the page). File: `ContactPage.js`.

Verified by testing_agent iteration_79: backend 12/12, frontend 100% (Ozon/Warehouse/Orders), no critical issues.

## 2026-06-24 — Admin dashboard + skeletons + page transitions
1. **Admin overview dashboard** (new first tab «Обзор» in /admin): KPI cards (today revenue, total orders, awaiting payment, processing), 14-day revenue bar chart, top products (30d), low-stock list, and awaiting-payment orders list. KPI/list clicks navigate to /admin/orders; low-stock links to the Warehouse tab. Backend `GET /api/admin/dashboard` aggregates metrics (admin-only). Files: `orders.py`, `components/admin/AdminDashboard.js`, `AdminPage.js` (tab order/config/migration, default tab=overview).
2. **Skeleton loaders** replace empty/spinner states on Catalog (`loading` grid), Orders (`orders-loading`), and the dashboard itself. File: `CatalogPage.js`, `OrdersPage.js`, `AdminDashboard.js`.
3. **Page transitions**: global fade/slide between routes via `AnimatePresence` + `motion.div` keyed by pathname in `App.js`.
Verified by testing_agent iteration_80: backend 100%, navigation intact, dashboard renders; fixed KPI navigation (orders is a route /admin/orders, not a tab) and re-verified.

## 2026-06-25 — Mobile design overhaul (final pass)
1. **PopularProducts** (`PopularProducts.js`): responsive visible-card count via `getVisibleCount` (2 mobile / 3 tablet / 6 desktop) — fixes truncated prices ('1 6' → '1 600 ₽') on mobile. Add-to-cart button now visible/tappable on touch (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`, `h-9 w-9`). «Все товары» link scaled down on mobile.
2. **Admin tab strip** (`AdminPage.js` ~line 1390): wrapped in relative container with `sm:hidden` right-edge gradient fade + pulsing `ChevronRight` scroll affordance (icon-only tabs on mobile already in place).
3. **Tap targets**: logo-link `min-h-[40px]`, footer-email `min-h-[36px]`, promo-banner-close `p-2` (≥36px). Mobile menu button already 44px; logged-out drawer already shows Каталог/Новости/Связь/Войти.
Verified by testing_agent iteration_82: mobile 390px NO horizontal scroll on all client+admin pages, desktop 1280px intact. Testing agent hot-fixed one missed `VISIBLE`→`visible` reference (PopularProducts.js:203).

## 2026-06-25 — Refactor: extract BonusTab from AdminPage.js
- Extracted the ~1000-line «Бонусы» tab (programs CRUD, prizes, levels, Ozon settings, points modal, prize redemptions) verbatim into `components/admin/BonusTab.js`; AdminPage now renders `<BonusTab ...props />`. AdminPage.js reduced 5047 → 4075 lines.
- Props bundle (22): bonus state/setters + ozonSettings + refs + handleFileUpload + handleSaveOzonSettings + users + uploading.
- Verified by testing_agent iteration_83: 100% bonus-tab regression pass (list, new/edit dialog, Ozon save, user expand, points modal, redemptions). Testing agent added missing `Textarea`/`Switch` imports.
- NOTE for future tab extractions: run eslint `react/jsx-no-undef` on the new file (verbatim JSX copy doesn't bring import lines). Many other tabs already live in `components/admin/`.

## 2026-06-25 — 6 owner-requested changes (statuses, payments, filters, analytics, bonus)
1. **Product-request statuses** → На рассмотрении / В обработке / Выполнен / Отклонён. Admin (`AdminChatsPage.js`) action panel: «В обработку» → «Выполнен»/reject; in-progress requests stay editable. Backend `product_requests.py` status_text = processing/completed/rejected. Client map updated in `ContactPage.js`.
2. **Manual card payment block** (`CardPaymentSettings`) moved INTO Payments→«Способы оплаты»; removed from the Crypto sub-tab (was rendered globally under all sub-tabs). Files: `PaymentsTab.js`, `AdminPage.js`.
3. **Admin catalog filter/sort** (`AdminPage.js` Каталог tab): search (name/article/manufacturer), sort (name/price/article/date/stock), manufacturer select, toggle chips В наличии/Со скидкой/Оригинал/Бонусы.
4. **Warehouse** (`AdminWarehousePage.js`): sort select (остаток/закупка/стоимость/маржа) + «Скрыть нет в наличии» toggle (`wh-hide-oos`).
5. **Collapsible analytics KPI bar** (`AdminAnalyticsBar.js`, NEW) between page header and tabs: collapsed = Всего заказов/Выручка/Средний чек/Всего клиентов; expanded = full dashboard. `/admin/dashboard` extended with total_revenue/avg_order_value/total_customers. Removed «Аналитика» sub-tab from CRM (`CRMTab.js`).
6. **Bonus page** (`BonusPage.js`): default prize view = GRID (square), compact cards with `object-contain` (photos not cropped), 4-col grid.
Verified by testing_agent iteration_84: frontend 6/6 + backend 3/3 pytest. Testing agent hot-fixed a missing `Search` lucide import in AdminPage.js.

## 2026-06-25 — Bonus: "progress to next prize" + popular-products availability fix
- `PopularProducts.js`: availability now uses shared `isProductAvailable()` (effective `in_stock`) instead of raw `stock===0`, so the "Нет в наличии" badge/disabled add-button matches the catalog and respects the admin manual-availability flag.
- `BonusPage.js`: added "До следующего приза" block per program (`data-testid=next-prize-progress`) — finds the cheapest available prize the user can't yet afford, shows points remaining + a progress bar; if all prizes affordable shows a celebratory note. Drives repeat purchases.







## 2026-06-25 — Выгрузка счёта (Счёт) в Word по образцу
- Бэкенд `routes/invoices.py`: GET /api/admin/orders/{id}/invoice генерирует .docx (python-docx) по шаблону образца — банковская таблица реквизитов, тип оплаты, № счёта (id[:8]) + дата, блок покупателя, таблица товаров (№/Артикул/Товары/Кол-во/Цена/Сумма), Итого/Скидка(реальная из заказа)/Всего к оплате, «Всего наименований N», сумма прописью (num2words + склонение), подписи, примечание.
- Редактируемые реквизиты: GET /api/invoice-settings, PUT /api/admin/invoice-settings (дефолты из образца). UI: Настройки → подвкладка «Реквизиты счёта» (`InvoiceSettings.js`).
- Кнопка «Счёт (Word)» в развёрнутой карточке заказа на /admin/orders (`AdminOrdersPage.js`).
- Зависимости: python-docx==1.2.0, num2words==0.5.14 (в requirements.txt).
- Проверено testing_agent iter_87 (настройки 100%) + iter_88 (кнопка/скачивание 100%); бэкенд счёта проверен curl (включая сумму прописью). Исправлено: кнопка изначально была в недостижимом блоке AdminPage.js → перенесена в AdminOrdersPage.js.

## 2026-06-26 — Фикс предпросмотра бонусов + Подборщик запчастей
- BUG: предпросмотр бонусов в корзине теперь учитывает скидку/наценку способа оплаты — backend `/bonus/cart-preview?amount=` масштабирует базу; фронт `CartPage.js` передаёт фактический goodsTotal. Проверено testing_agent iter_90 (бэк 4/4, фронт 3/3).
- FEATURE «Подбор запчастей» (`routes/parts_finder.py`, `pages/PartsFinderPage.js`, /parts-finder, ссылки в Header): поля VIN/марка/модель/год/двигатель/ось/кросс-номер/описание. ИИ-подбор по нашему каталогу через Emergent LLM (gpt-5.4) с ранжированием по уверенности; graceful fallback на текстовый поиск. Заглушка платного каталога (Laximo/TecDoc) + админ-настройки подключения (Настройки → «Подбор запчастей»: провайдер/URL/API-ключ + тумблеры ИИ/каталог). api_key не отдаётся в публичном /config. Проверено testing_agent iter_91 (бэк 7/7, фронт 100%).

## 2026-06-26 — Одноразовая индив. цена + бонусы за частичную выдачу
- BUG: индивидуальная (договорная) цена не убиралась после заказа. Теперь при СОЗДАНИИ заказа все использованные индив. цены деактивируются (`individual_prices.active=false`, `used_in_order_id`) — одноразовое использование. Файл: `routes/orders.py` (после insert заказа).
- BUG: за частичную/полную выдачу через `PATCH /admin/orders/{id}/fulfill` бонусы не начислялись. Начисление рефакторено в `accrue_order_bonus(order)` — идемпотентно, по ФАКТИЧЕСКИ ВЫДАННОМУ количеству (`quantity_fulfilled`), с трекингом `order.bonus_accrued_base` (начисляется только приращение, без двойного счёта). Вызывается из `fulfill` и из статус-эндпоинтов (`admin.py`, `orders.py`). Проверено e2e: выдача 1/2 → +108 (15% Gold от 720), 2/2 → ещё +108, повтор → 0. Индив. цена деактивируется сразу после создания заказа. Файлы: `routes/bonus.py`, `routes/orders.py`, `routes/admin.py`.

## 2026-06-26 — Персональная цена в каталоге + рефреш статусов обращений
- Персональная (договорная) цена теперь видна и в КАРТОЧКЕ КАТАЛОГА: зачёркнутая обычная + зелёная персональная + бейдж «Ваша цена по договорённости» (`pages/CatalogPage.js` — inline card и PriceDisplay, data-testid old-price/individual-price/individual-badge). На странице товара бейдж унифицирован (`pages/ProductPage.js`). Бэкенд: `GET /products/my-individual-prices` (auth). Контекст `IndividualPriceContext` (обёрнут в App.js). ВНИМАНИЕ: `components/ProductCard.js` — мёртвый код (нигде не импортируется), каталог использует свою inline-карточку.
- Статусы запросов товаров: бэкенд-цикл проверен e2e (pending→processing→completed, клиент видит обновление). Добавлен рефетч обращений при открытии вкладки «Мои обращения» (`ContactPage.js`), чтобы статусы всегда были свежими без перезагрузки страницы. Проблема на проде avopt.store была из-за старого билда — требуется повторный деплой.

## 2026-06-26 — Скидка способа оплаты на индив. цену + детальное уведомление
- BUG: при индивидуальной цене (одобренный «запрос скидки») не применялась скидка/наценка способа оплаты. Теперь `ind_price × price_multiplier` (как для обычных товаров). Проверено e2e: индив. 800 → наличные 720 (−10%), карта 880 (+10%). Файл: `routes/orders.py`.
- Уведомление о начислении теперь детальное: «Вам начислено N баллов с суммы M ₽ (после скидок). Баланс: …». Файл: `routes/bonus.py`.

## 2026-06-26 — Фикс: бонусы от финальной суммы выполненного заказа
- BUG: начисление бонусов не учитывало скидку на товар (в т.ч. одобренный «запрос скидки» / правку заказа админом), т.к. использовало устаревшую `bonus_base` с момента создания. Теперь `update_bonus_on_order_delivered` берёт базу из ФИНАЛЬНОЙ суммы выполненного заказа после всех скидок: `(order.total − delivery_fee) × доля bonus-eligible позиций` (доля по финальным ценам позиций). Поле `bonus_base` при создании заказа удалено; вызовы в `admin.py` передают `delivery_fee`. Проверено симуляцией: full 1000→50 (5%); скидка в цене позиции 800→40; скидка только в total (total=800, позиция 1000)→40; доставка 200 исключается (база 800→40). Файлы: `routes/bonus.py`, `routes/admin.py`, `routes/orders.py`.

## 2026-06-26 — Счёт: правки формата + платный подбор запчастей
- СЧЁТ (Word): «Товары» = название товара; дата из заказа; колонки Кол-во/Цена/Сумма по центру; «Всего к оплате» вынесено последней строкой таблицы товаров (значение впритык к правому краю, в границах таблицы); строка «Итого» и строка скидки убраны (цены уже со скидкой); между блоком и «Всего наименований» ровно 2 пустые строки; «Ст.№»→«Сч.№». Файл: `routes/invoices.py`.
- PARTS FINDER теперь ПЛАТНЫЙ (`routes/parts_finder.py`, `pages/PartsFinderPage.js`, `components/admin/PartsFinderSettings.js`): только авторизованные. Подписка (период, безлимит) + разовый запрос. Оплата с баланса (₽) или баллами (= ₽×множитель, по умолч. 2). Эндпоинты: `GET /parts-finder/access`, `POST /parts-finder/subscribe`, `POST /parts-finder/search` (paywall: подписка → бесплатные запросы → требование оплаты `requires_payment`, затем оплата `pay_with=balance|points`). Подписка хранится в `users.pf_subscription_until`, бесплатные — `users.pf_free_used`. Админ-настройки: paid_enabled, request_price(100), subscription_price(990), subscription_days(30), free_requests(0), points_multiplier(2). Клиентские подсказки про «настройки/каталог» убраны (note нейтральный). Проверено testing_agent iter_92 — 7/7 PASS.
- PARTS FINDER история подборов: каждый успешный подбор сохраняется в `parts_finder_history` (параметры + найденные товары + дата + режим). `GET /parts-finder/history` (последние 30). Блок «История подборов» на /parts-finder (`finder-history`) со ссылками на товары. Проверено curl (сохранение + выдача).
- BONUS: баллы теперь ЦЕЛЫЕ везде. `bonus/cart-preview` возвращает int (`total_points`, per-program `points`). Начисление `update_bonus_on_order_delivered` округляет до целого (`round`) и принимает `bonus_base`.
- BONUS-консистентность: при создании заказа сохраняется `bonus_base` = скорректированная (после скидки/наценки способа оплаты) сумма товаров по bonus-eligible позициям — идентична тому, что показывает предпросмотр. Начисление при выполнении заказа использует именно её (передаётся из `admin.py`), чтобы факт = предпросмотру (раньше смешанная оплата расходилась). Файлы: `routes/bonus.py`, `routes/orders.py` (order doc + поле), `routes/admin.py` (2 вызова).
- СЧЁТ (Word): полностью переписан на генерацию ИЗ файла-шаблона `backend/templates/invoice_template.docx` (подстановка с сохранением ширин колонок/шрифтов/рамок 1-в-1). Числа: в таблице товаров — ЦЕЛЫЕ (пробел-разделитель тысяч, без копеек); в итогах — 2 знака. Строка скидки УБРАНА (по требованию пользователя): цены пишутся уже со скидкой (item.price), только «Итого» и «Всего к оплате» (= order.total). Заголовок «Счет № {seq} от {дата} г.» с последовательным номером (счётчик `db.counters.invoice_no`, начиная с 1001, сохраняется на заказе `invoice_no`). Реквизиты банка/продавца, способ оплаты, покупатель, сумма прописью, примечание — из настроек/заказа. Файл: `routes/invoices.py`. Проверено: HTTP 200 + инспекция docx (ширины [0.93/2.55/7.07/1.72/1.94/2.71] см совпадают с образцом, целые цены, 2-знач. итоги).

## Session 2026-06 (iter 94) — 6 задач, все PASS (backend 8/8, frontend 100%)
- ЗАДАЧА 1 — Уведомления уважают глобальный тумблер: заменены прямые `db.notifications.insert_one` для КЛИЕНТСКИХ уведомлений на `notify_user` (который проверяет `settings.notification_settings.client_notifications_enabled`). Файлы: `bonus.py` (prize_status, add/remove points), `balance.py` (admin credit/debit), `crypto_payments.py` (оплата получена), `server.py` (авто-отмена заказов). Хелперы `requests.py`/`payments.py::create_notification` теперь тоже проверяют тумблер (с исключением для user_id='ADMIN'). Админ-уведомления по-прежнему приходят всегда.
- ЗАДАЧА 2 — Индивидуальная скидка (`users.individual_discount`) применяется ТОЛЬКО при оплате с баланса (`pay_with_balance=true`, single-method), стакается поверх акций/тиров. `orders.py` single-branch: `goods_total -= individual_discount%`. Поля заказа: `individual_discount_percent`, `individual_discount_amount`. Фронт `CheckoutPage.js`: строка `checkout-individual-discount-line`.
- ЗАДАЧА 3 — Оплата доставки баллами: `OrderCreate.pay_delivery_with_points`. Хелпер `spend_bonus_points` + `get_total_bonus_points` + `GET /bonus/my-points`. При включении списываются баллы = delivery_fee (1 балл=1₽), `total` не включает деньги за доставку. Поля заказа `delivery_paid_with_points`, `delivery_points_used`. Фронт: тумблер `pay-delivery-points-toggle`.
- ЗАДАЧА 4 — Лимит по акции: `Product.promo_allocated_stock`/`promo_remaining_stock`. Инициализация/сброс remaining при set в products.py. `compute_promo_discount` не применяет акцию когда remaining<=0. Декремент remaining при заказе. Админ-форма: `product-promo-allocated-stock`. Отображение остатка на ProductPage (`product-promo-stock`) и карточке каталога (`card-promo-stock-{id}`).
- ЗАДАЧА 5 — Живой таймер HH:MM:SS: компонент `components/PromoCountdown.js` + хелперы `formatCountdown`/`getPromoStock` в `productHelpers.js`. На ProductPage (`product-promo-countdown`) и карточке каталога (`card-countdown-{id}`).
- ЗАДАЧА 6 — Бейдж скидки в админ-списке товаров (`AdminProductsPage.js`): использует `computeDiscount(p)` → активная «Скидка» (`admin-discount-active-{id}`) vs истёкшая «Скидка истекла» (`admin-discount-expired-{id}`).
- Регресс-тесты: `/app/backend/tests/test_iter94_tasks.py` (8 тестов).

## Багфикс 2026-06 — каталог: товары >100 и «исчезновение» после приёмки
- Причина: `GET /products` был ограничен 100 и БЕЗ сортировки — Mongo без `sort` отдаёт произвольные 100 из N, а после любого `update` (приёмка склада меняет stock) окно смещалось → товары «исчезали/появлялись», и всё что >100 не показывалось.
- Фикс backend (`routes/products.py::get_products`): добавлена стабильная сортировка `[("created_at",-1),("id",1)]`, дефолтный `limit` поднят 100→1000, кап `min(limit,1000)`.
- Фикс frontend (`CatalogPage.js` fetchProducts, ветка категорий): постраничная догрузка ВСЕХ товаров (пачки по 1000 через skip) с конкатенацией — каталог показывает все товары независимо от количества.
- Проверено curl на 127 товарах: полный список отдаётся; после приёмки (movement receipt) набор/порядок товаров идентичен (SAME SET = True).

## Фича 2026-06 (iter 95) — Клиент принимает/отклоняет предложение по запросу товара
- Backend (`product_requests.py`): `ProductRequestRespond` расширен полями `offer_price`/`offer_quantity`/`offer_delivery_days`; статус `offered`. Новые клиентские эндпоинты `POST /product-requests/{id}/accept` (→ `accepted`, уведомление админу) и `/reject` (→ `rejected_by_client` + `client_reject_reason`, уведомление админу). Гард: действие возможно только из статуса `offered`, иначе 400.
- Компонент `components/ProductRequestOffer.js`: карточка оффера (цена/кол-во/срок/итог) + кнопки «Принять»/«Отклонить» (с полем причины).
- Клиент видит оффер и действует в ДВУХ местах: `ContactPage` → «Мои обращения» и `OrdersPage` → секция «Предложения по запросам товаров».
- Админ (`AdminChatsPage`): поля оффера (цена/кол-во/срок) + «Отправить/Обновить предложение», блок-сводка статуса и решения клиента; статусы в списке (Предложение/Принято/Отклонён клиентом). После отправки оффера выбор запроса сохраняется (UX-улучшение).
- Проверено testing_agent iter_95: backend 4/4, frontend 100%. Регресс-тесты: `/app/backend/tests/test_product_request_offer.py`.

## Фича 2026-06 (iter 96-98) — Запрос скидки на всю корзину
- Backend: новый роутер `routes/cart_discount_requests.py` — клиент создаёт запрос %, админ одобряет своим % (без подтверждения клиента), скидка применяется к корзине сразу; одноразовая (сгорает при оформлении заказа), стакается поверх всего, равномерно по позициям.
- `orders.py::_build_cart` возвращает `cart_discount` + по позициям `price_before_cart_discount`/`cart_discount_percent`. `create_order` применяет скидку по позициям, пишет `order.cart_discount_percent/amount`, помечает запрос `used` и очищает корзину.
- Накладная (`invoices.py`): строки «Итого без скидки», «Скидка N%», «Всего к оплате» при наличии скидки.
- Frontend КЛИЕНТ: Uq реализован в **CartPage.js** (реальная страница чекаута; `/checkout` редиректит на `/cart`). Кнопка `request-cart-discount-btn`, модалка, бейджи pending/approved, отмена, построчный показ (зачёркнутая старая → новая цена), строка «Скидка на корзину». OrdersPage: бейдж и строка скидки в заказе.
- Frontend АДМИН (`AdminChatsPage.js`): вкладка «Скидка на корзину» (`tab-cart-discounts`) со списком, одобрением с вводом % и отклонением.
- ВАЖНО (для будущих агентов): `pages/CheckoutPage.js` — МЁРТВЫЙ КОД (нигде не импортируется, `/checkout`→`/cart`). Реальная страница корзины/чекаута — `pages/CartPage.js`. Не редактировать CheckoutPage.js.
- Проверка: backend curl e2e (запрос→одобрение 8%→корзина 1600→1472→заказ cart_discount_amount=230.4→скидка used, корзина очищена→накладная содержит строки скидки). Frontend testing_agent iter_98: клиентский UI, админ-вкладка, бейджи OrdersPage — работают.

## Багфикс 2026-06 — «Оплата доставки баллами» перенесена в CartPage.js
- Ранее UI был в мёртвом CheckoutPage.js. Перенесён в реальную страницу CartPage.js: переключатель pay-delivery-points-toggle (показывается когда доставка платная и баллов >= стоимости), строка «−N ₽ (баллами)», баланс баллов. В payload заказа добавлен pay_delivery_with_points. Загрузка баланса через /bonus/my-points.
- Проверено curl e2e: заказ total исключает доставку, delivery_paid_with_points=true, delivery_points_used=500, баллы списаны.
- ОСТАЁТСЯ (следующий шаг): перенести в CartPage.js отображение индивидуальной скидки при оплате с баланса — сейчас бэкенд применяет её, но итог на /cart для оплаты с баланса показывается без учёта скидки (расхождение отображения).

## Багфикс 2026-06 — индивидуальная скидка в отображении CartPage
- Перенесён расчёт индивидуальной скидки (users.individual_discount) в CartPage: применяется ТОЛЬКО при оплате с баланса (single method), стакается поверх акций/надбавки. Введён goodsAfterIndividual, используется для порога бесплатной доставки, бонус-превью, шкалы бесплатной доставки, Ozon-сертификата и finalTotal.
- Добавлена строка «Индивидуальная скидка (N%): −сумма» (data-testid checkout-individual-discount-line).
- Проверено: заказ с баланса total=3380 (скидка 10%=320) — фронтовый finalTotal совпадает с бэкендом 1:1.

## Багфикс + дизайн 2026-06 — «Мои обращения» (ContactPage history)
- БАГ: запросы индивидуальной скидки (account-wide, без product_id) и запросы скидки на корзину не отображались в «Мои обращения». Исправлено: добавлены разделы «Запросы индивидуальной скидки» (discReqs без product_id) и «Запросы скидки на корзину» (GET /cart-discount-requests/my).
- REQ_STATUS дополнен статусами used/superseded/cancelled.
- Дизайн раздела переработан: заголовки секций с иконками-чипами и счётчиком, современные карточки (rounded-2xl, цветная левая полоса-акцент по типу, hover-lift, аккуратные статус-бейджи), адаптивная сетка sm:grid-cols-2, стильные пустые состояния (dashed). Секции: индивидуальная скидка (teal), скидка на корзину (violet, показывает одобренный % и зачёркнутый запрошенный), скидки на товары (rose), запросы товаров (sky, с офферами), индивидуальные цены (emerald-градиент).
- Проверено curl: /discount-requests/my (7% pending) и /cart-discount-requests/my (12% pending + история) возвращают данные; фронт компилируется. Скриншот авторизованной страницы снять не удалось (ограничение инструмента).

## Фича 2026-06 (iter 99) — Встречные условия (counter-offer) на отсрочку и индивидуальные условия
- Отсрочка (credit.py): PUT /admin/credit-requests/{id}/offer (limit+term+comment → status 'offered'); POST /credit/requests/{id}/accept (выдаёт кредит) и /reject. /credit/my возвращает pending/offered. Админ: кнопки «Одобрить сразу» + «Предложить условия» (AdminCreditPage). Клиент: блок credit-offer-block на /credit с Принять/Отклонить.
- Индивидуальная скидка на все заказы (discount_requests.py, account-wide без product_id): PUT /admin/discount-requests/{id}/approve-discount (применить сразу) и /offer-discount (предложить); POST /discount-requests/{id}/accept (ставит user.individual_discount) и /reject. Админ: в AdminChatsPage панель account-discount-actions (Применить сразу / Предложить / Отклонить + комментарий). Клиент: в ContactPage «Мои обращения» → «Запросы индивидуальной скидки» кнопки Принять/Отклонить.
- Оба оставили режим «сразу» + «предложение с согласием клиента» (по требованию пользователя). Комментарий админа поддерживается.
- Проверено curl e2e: отсрочка offer→accept выдаёт лимит 60000/45д; скидка offer 8%→accept ставит individual_discount=8; двойное принятие→400; уведомления админу. testing_agent iter_99: UI работает; исправлен баг CreditPage (оффер не показывался клиенту с уже одобренным лимитом) — теперь показывается всегда при status 'offered'.
