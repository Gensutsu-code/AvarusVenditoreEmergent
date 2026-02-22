# AVOPT.STORE - E-Commerce Platform for Heavy Vehicle Parts

## Original Problem Statement
E-commerce platform for selling heavy vehicle parts with:
- Product catalog with categories
- Shopping cart and checkout
- User authentication and profiles
- Admin panel for managing products, orders, users
- Bonus programs
- Chat support with Telegram integration
- Payment methods (cash, card, crypto) with discounts per payment method

## Architecture

### Backend (FastAPI + MongoDB)
```
/app/backend/
├── server.py           # Main entry point
├── database.py         # MongoDB connection
├── models.py           # Pydantic models
├── routes/             # API routes
│   ├── terms.py        # Terms of Service CRUD
│   ├── notifications.py # Email notifications with Resend
│   └── ...
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── CheckoutPage.js # Checkout with terms agreement
│   ├── AdminPage.js    # Admin panel with terms & notifications tabs
│   └── ...
```

## What's Been Implemented

### Session: February 22, 2025

#### Editable Terms of Service (NEW)
- Admin panel "Правила" tab for editing terms sections
- CRUD API for terms: GET /api/terms, PUT /api/admin/terms
- Reset to default functionality
- Sections include: title, content, order
- Checkout page modal fetches terms dynamically from API

#### Email Notifications System (NEW)
- Resend integration for sending transactional emails
- Admin panel "Рассылки" tab with:
  - Notification type toggles (Order confirmation, Order status, Promo)
  - Test email functionality
  - Bulk email/promotional emails form
- API endpoints:
  - GET/PUT /api/admin/notification-settings
  - POST /api/admin/email/test
  - POST /api/admin/email/send-bulk
- Email templates for order confirmation and status updates

### Session: February 11, 2025

#### Terms of Service Agreement
- Added checkbox for agreeing to terms on checkout page
- Clickable link "правилами предоставления услуг" opens modal
- Modal contains 8 sections of terms (dynamic from API)
- "Принять и согласиться" button automatically checks checkbox
- Order button disabled until terms accepted

#### Earlier Changes:
- Removed customer statuses (retail, wholesale, partner)
- Removed individual discounts
- Removed double prices
- Renamed "Скидки" tab to "Оплата" in admin
- Backend refactoring completed

## Test Credentials
- **Admin:** admin@avarus.ru / admin123

## Data Test IDs
- `terms-checkbox` - Terms agreement checkbox
- `terms-link` - Link to open terms modal
- `terms-modal` - Modal with terms content
- `accept-terms-btn` - Accept button in modal
- `place-order-btn` - Place order button
- `save-terms-btn` - Save terms button in admin
- `notif-order-confirmation` - Order confirmation toggle
- `notif-order-status` - Order status toggle
- `notif-promotions` - Promotions toggle
- `test-email-input` - Test email input field
- `send-test-email-btn` - Send test email button
- `bulk-email-subject` - Bulk email subject input
- `bulk-email-content` - Bulk email content textarea
- `send-bulk-email-btn` - Send bulk email button

## Preview URL
https://checkout-terms.preview.emergentagent.com

## Pending/Future Tasks
- Frontend refactoring: Split AdminPage.js into components
- Payment gateway integrations (Stripe, etc.)

## Notes
- Resend API is in test mode - emails can only be sent to verified addresses
- To enable full email functionality, verify domain at resend.com/domains
