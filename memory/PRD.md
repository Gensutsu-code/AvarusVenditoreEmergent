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
│   ├── crypto_payments.py  # NEW: MetaMask crypto payment system
│   ├── balance.py          # Balance/prepayment system
│   ├── terms.py            # Terms of Service CRUD
│   ├── notifications.py    # Email notifications with Resend
│   ├── orders.py           # Orders with balance payment support
│   └── ...
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── AccountPage.js      # User profile with balance card
│   ├── CheckoutPage.js     # Checkout with crypto payment modal
│   ├── AdminPage.js        # Admin panel
│   └── ...
├── components/
│   ├── CryptoPaymentModal.js  # NEW: MetaMask crypto payment UI
│   └── admin/
│       ├── CryptoSettingsTab.js  # NEW: Admin crypto settings
│       └── ...
```

## What's Been Implemented

### Session: February 24, 2026

#### Crypto Payment System with MetaMask (NEW - COMPLETED)
Full crypto payment system with direct wallet connection:

**Supported Networks:**
- BNB Smart Chain (BSC)
- Base
- Polygon

**Supported Tokens:**
- USDT
- USDC

**Backend APIs:**
- `GET /api/crypto/chains` - Get supported chains and tokens
- `GET /api/crypto/price?amount_rub=X` - Convert RUB to USD (no markup)
- `POST /api/crypto/payment/create` - Create payment request
- `POST /api/crypto/payment/verify` - Verify transaction on blockchain
- `GET /api/crypto/payment/{id}` - Get payment status
- `GET/PUT /api/admin/crypto/settings` - Admin settings (receiving address, enable/disable)
- `GET /api/admin/crypto/payments` - Admin view all crypto payments

**Frontend Features:**
- CryptoPaymentModal component with:
  - Network selection (BSC, Base, Polygon)
  - Token selection (USDT, USDC)
  - Real-time RUB to USD conversion via CoinGecko API
  - MetaMask wallet connection
  - Automatic network switching
  - Transaction submission and verification
- Admin CryptoSettingsTab with:
  - Enable/disable crypto payments
  - Configure receiving wallet address
  - View recent crypto payments

**Technical Details:**
- Uses ethers.js for wallet interaction
- ERC20 token transfers directly to merchant wallet
- Automatic blockchain verification using Web3.py
- Real-time exchange rates from CoinGecko (no markup)

**Testing Status:** PASSED (100% backend - 17/17, 100% frontend)

#### Prepayment/Balance System (COMPLETED)
- Balance card on `/account` page
- Top-up functionality (card instant, crypto pending)
- Balance history with transaction log
- "Pay from balance" option on checkout

### Previous Sessions

#### Editable Terms of Service (DONE)
- Admin panel "Правила" tab for editing terms
- Dynamic ToS loading on checkout

#### Email Notifications System (DONE)
- Resend integration for transactional emails
- Admin panel toggle controls

#### AdminPage.js Refactoring (DONE)
- Extracted 8+ components to `/app/frontend/src/components/admin/`

## Test Credentials
- **Admin:** admin@avarus.ru / admin123
- **User:** test@example.com / password123

## Data Test IDs

### Crypto Payment System
- `crypto-payment-modal` - Modal container
- `chain-bsc`, `chain-base`, `chain-polygon` - Chain selection buttons
- `token-usdt`, `token-usdc` - Token selection buttons
- `proceed-to-payment-btn` - Continue to wallet connect
- `connect-wallet-btn` - MetaMask connect button
- `execute-payment-btn` - Execute payment button
- `payment-success-close-btn` - Close success modal

### Admin Crypto Settings
- `crypto-settings-tab` - Tab container
- `crypto-enabled-switch` - Enable/disable toggle
- `receiving-address-input` - Wallet address input
- `save-crypto-settings-btn` - Save button

## Preview URL
https://balance-checkout.preview.emergentagent.com

## Configured Receiving Wallet
**Address:** 0x742d35Cc6634C0532925a3b844Bc454e4438f44e

## Pending/Future Tasks

### P1 - Upcoming
- **Extract ChatTab from AdminPage.js** - Move chat logic to separate component

### P2 - Future
- **Real Payment Gateway Integration** - Integrate Stripe for fiat payments
- **Transaction confirmation emails** - Send email when crypto payment verified
- **Multi-language support** - Add English language option

## Notes
- **Crypto payments:** Direct token transfers (USDT/USDC) to merchant wallet
- **Exchange rate:** Real-time via CoinGecko API, no markup
- **Blockchain verification:** Automatic using Web3.py
- **MetaMask:** Required for crypto payments
