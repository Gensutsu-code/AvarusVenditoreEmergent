# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, bonus system, and complete admin control ("Absolute Control"). Includes a private file manager for admin with hybrid storage.

## Core Features Implemented

### Video Sprite Previews (March 20, 2026) — LATEST
- Fixed sprite generation for ALL videos (Cloudinary + local storage)
- Sprite sheet + VTT generated in background after upload
- Seek bar hover shows frame preview in video player
- Temp files cleaned up after sprite generation

### Upload Cancellation (March 20, 2026) — LATEST
- Cancel button in upload progress panel aborts all in-progress uploads
- Backend DELETE /api/personal-files/upload/{upload_id} cleans up partial chunks
- Frontend calls cleanup for chunked uploads on cancel

### Personal Files Storage (March 19, 2026)
- Password-protected private file storage for admin (password: GenSutSu.1999)
- Hybrid storage: Cloudinary (<90MB), local (>90MB)
- Chunked uploads for large files, parallel processing
- Nested folders, file type filters, search
- Custom video player: double-tap seek, fullscreen, quality badges
- 6-hour session persistence

### Admin Cart Management (March 19, 2026)
- View/edit all client carts, add/remove products, set individual prices

### Revertible Actions in Logs (March 17, 2026)
- All key admin actions revertible from Logs tab

### Full Admin Control ("Absolute Control")
- Granular admin controls, user tracking (fingerprint, GeoIP), action logging

### Earlier Features
- E-commerce catalog, cart, checkout, orders
- Bonus/loyalty system, crypto payments (ETH/USDT)
- News, chat widget, notifications, search, individual pricing

## Key Collections
- `personal_folders`: {id, name, parent_id, created_at}
- `personal_files`: {id, folder_id, name, url, public_id, file_type, size, width, height, quality, duration, storage, local_filename, sprite_ready, sprite_cols, sprite_rows, created_at}
- `action_logs`: {id, action, before_state, document_query, collection_name, reverted}
- `upload_sessions`: {id, filename, folder_id, total_size, created_at}

## 3rd Party
Resend, Cloudinary, web3.py, ethers.js, CoinGecko, FingerprintJS, GeoIP2, ffmpeg/pymediainfo. YuKassa (MOCKED)

## Credentials
- Admin: admin@avarus.ru / admin
- Client: user@demo.com / demo123
- Personal files: GenSutSu.1999

## Backlog
- P2: Real payment gateway (YuKassa) integration
- P2: Refactor PersonalFilesPage.js and AdminPage.js into smaller components
