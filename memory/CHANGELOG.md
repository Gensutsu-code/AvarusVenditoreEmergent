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

