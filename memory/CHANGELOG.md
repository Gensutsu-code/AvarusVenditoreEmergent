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
2. **Orders time filter** (/orders): period bar (week/month/year/all), default last month, client-side filter by `created_at`, empty-state per period. File: `OrdersPage.js`.
3. **Warehouse polish**: bulk receipt/write-off already existed — improved bulk-operations bar (own row, clearer labels) and fixed embedded-tab padding (TabsContent p-6). File: `AdminWarehousePage.js`, `AdminPage.js`.
4. **Contact chat auto-scroll removed**: deleted the messages-change autoscroll effect; chat now scrolls to bottom only on opening the chat tab and right after sending; scrolls the inner container only (never the page). File: `ContactPage.js`.

Verified by testing_agent iteration_79: backend 12/12, frontend 100% (Ozon/Warehouse/Orders), no critical issues.



