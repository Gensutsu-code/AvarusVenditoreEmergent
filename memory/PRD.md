# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, bonus system, and complete admin control ("Absolute Control").

## Core Features Implemented

### Personal Files Storage (March 19, 2026) — NEW
- Password-protected private file storage for admin (password: GenSutSu1999)
- Upload photos, videos, GIFs to Cloudinary
- Folder creation, renaming, deletion (with cascade file delete)
- Search by filename
- Grid view with thumbnails, video play overlay, GIF badges
- Enlarged preview modal (images) / video player
- Access via subtle "Личные файлы" button on admin profile page
- Dark theme (bg-slate-950), Russian interface

### Admin Cart Management (March 19, 2026)
- View all client carts from "Корзины" link in header
- Add/remove products, change quantities, set individual prices
- Search by client name, email, product

### Revertible Actions in Logs (March 17, 2026)
- All key admin actions revertible from Logs tab
- Bonus add/subtract/reset, prize status, deletions (prizes/orders/users/categories)

### Full Admin Control ("Absolute Control")
- Granular admin controls for bonus points, prize history, order rollback
- Enhanced user tracking (browser fingerprint, GeoIP)
- Action logging middleware with revert system

### Earlier Features
- E-commerce catalog, cart, checkout, orders
- Bonus/loyalty system with tiers, crypto payments (ETH/USDT)
- News, chat widget, notifications, search with sorting
- Individual pricing per user, product/discount requests

## Key Collections
- `personal_folders`: {id, name, created_at}
- `personal_files`: {id, folder_id, name, url, public_id, file_type, size, created_at}
- `action_logs`: {id, action, before_state, document_query, collection_name, reverted}

## 3rd Party: Resend, Cloudinary, web3.py, ethers.js, CoinGecko, FingerprintJS, GeoIP2. ЮKassa (MOCKED)

## Credentials
- Admin: admin@avarus.ru / admin
- Client: user@demo.com / demo123
- Personal files: GenSutSu1999
