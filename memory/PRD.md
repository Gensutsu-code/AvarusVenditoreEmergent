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
├── routes/             # API routes (auth, products, orders, admin, etc.)
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── CheckoutPage.js # Checkout with terms agreement
│   ├── AdminPage.js    # Admin panel
│   └── ...
```

## What's Been Implemented

### Session: February 11, 2025

#### Terms of Service Agreement (NEW)
- Added checkbox for agreeing to terms on checkout page
- Clickable link "правилами предоставления услуг" opens modal
- Modal contains 8 sections of terms:
  1. Общие положения
  2. Оформление заказа
  3. Цены и оплата
  4. Доставка
  5. Возврат и обмен
  6. Гарантии
  7. Конфиденциальность
  8. Контактная информация
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

## Preview URL
https://checkout-refactor-2.preview.emergentagent.com
