# Changelog

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

## 2026-06-26 — Счёт: правки формата + платный подбор запчастей
- СЧЁТ (Word): «Товары» = название товара; дата из заказа; колонки Кол-во/Цена/Сумма по центру; «Всего к оплате» вынесено последней строкой таблицы товаров (значение впритык к правому краю, в границах таблицы); строка «Итого» и строка скидки убраны (цены уже со скидкой); между блоком и «Всего наименований» ровно 2 пустые строки; «Ст.№»→«Сч.№». Файл: `routes/invoices.py`.
- PARTS FINDER теперь ПЛАТНЫЙ (`routes/parts_finder.py`, `pages/PartsFinderPage.js`, `components/admin/PartsFinderSettings.js`): только авторизованные. Подписка (период, безлимит) + разовый запрос. Оплата с баланса (₽) или баллами (= ₽×множитель, по умолч. 2). Эндпоинты: `GET /parts-finder/access`, `POST /parts-finder/subscribe`, `POST /parts-finder/search` (paywall: подписка → бесплатные запросы → требование оплаты `requires_payment`, затем оплата `pay_with=balance|points`). Подписка хранится в `users.pf_subscription_until`, бесплатные — `users.pf_free_used`. Админ-настройки: paid_enabled, request_price(100), subscription_price(990), subscription_days(30), free_requests(0), points_multiplier(2). Клиентские подсказки про «настройки/каталог» убраны (note нейтральный). Проверено testing_agent iter_92 — 7/7 PASS.
- PARTS FINDER история подборов: каждый успешный подбор сохраняется в `parts_finder_history` (параметры + найденные товары + дата + режим). `GET /parts-finder/history` (последние 30). Блок «История подборов» на /parts-finder (`finder-history`) со ссылками на товары. Проверено curl (сохранение + выдача).
- BONUS: баллы теперь ЦЕЛЫЕ везде. `bonus/cart-preview` возвращает int (`total_points`, per-program `points`). Начисление `update_bonus_on_order_delivered` округляет до целого (`round`) и принимает `bonus_base`.
- BONUS-консистентность: при создании заказа сохраняется `bonus_base` = скорректированная (после скидки/наценки способа оплаты) сумма товаров по bonus-eligible позициям — идентична тому, что показывает предпросмотр. Начисление при выполнении заказа использует именно её (передаётся из `admin.py`), чтобы факт = предпросмотру (раньше смешанная оплата расходилась). Файлы: `routes/bonus.py`, `routes/orders.py` (order doc + поле), `routes/admin.py` (2 вызова).
- СЧЁТ (Word): полностью переписан на генерацию ИЗ файла-шаблона `backend/templates/invoice_template.docx` (подстановка с сохранением ширин колонок/шрифтов/рамок 1-в-1). Числа: в таблице товаров — ЦЕЛЫЕ (пробел-разделитель тысяч, без копеек); в итогах — 2 знака. Строка скидки УБРАНА (по требованию пользователя): цены пишутся уже со скидкой (item.price), только «Итого» и «Всего к оплате» (= order.total). Заголовок «Счет № {seq} от {дата} г.» с последовательным номером (счётчик `db.counters.invoice_no`, начиная с 1001, сохраняется на заказе `invoice_no`). Реквизиты банка/продавца, способ оплаты, покупатель, сумма прописью, примечание — из настроек/заказа. Файл: `routes/invoices.py`. Проверено: HTTP 200 + инспекция docx (ширины [0.93/2.55/7.07/1.72/1.94/2.71] см совпадают с образцом, целые цены, 2-знач. итоги).
