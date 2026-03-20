# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, bonus system, and complete admin control ("Absolute Control"). Includes a private file manager for admin with hybrid storage.

## Core Features Implemented

### Drag & Drop + Bulk Operations (March 20, 2026) — LATEST
- Selection mode: checkboxes on file cards, "Выбрать"/"Отмена" toggle
- "Выбрать все" / "Снять все" button
- Bulk action bar at bottom: Теги, Переместить, Удалить
- Bulk add tags (merges with existing, dedup, lowercase)
- Bulk move to any folder or root
- Bulk delete with confirmation
- Drag & Drop files onto folders with teal highlight

### File Tags, Navigation & Similar Files (March 20, 2026)
- Add/remove tags, tag cloud filter, search by tags
- Prev/Next navigation in preview modals
- Larger GIF modal, "Похожие по тегам" section

### Video Sprite Previews + Upload Cancel (March 20, 2026)
- Sprite generation for ALL videos (Cloudinary + local)
- Cancel button for uploads with chunk cleanup

### Personal Files Storage (March 19, 2026)
- Password-protected, hybrid storage, chunked uploads
- Nested folders, file type filters, custom video player

### Admin Cart Management, Revertible Actions, Full Admin Control
- Granular admin controls, user tracking, action logging

### Earlier Features
- E-commerce catalog, cart, checkout, orders, bonus system, crypto payments

## Key API Endpoints (File Manager)
- `PUT /api/personal-files/files/bulk/move` - bulk move files
- `PUT /api/personal-files/files/bulk/tags` - bulk add tags
- `DELETE /api/personal-files/files/bulk` - bulk delete files
- `PUT /api/personal-files/files/{file_id}/tags` - single file tags
- `GET /api/personal-files/tags` - all unique tags
- `GET /api/personal-files/files/{file_id}/similar` - similar by tags
- `DELETE /api/personal-files/upload/{upload_id}` - cancel chunked upload

## 3rd Party
Resend, Cloudinary, web3.py, ethers.js, CoinGecko, FingerprintJS, GeoIP2, ffmpeg/pymediainfo. YuKassa (MOCKED)

## Credentials
- Admin: admin@avarus.ru / admin
- Client: user@demo.com / demo123
- Personal files: GenSutSu.1999

## Backlog
- P2: Real payment gateway (YuKassa) integration
- P2: Refactor PersonalFilesPage.js and AdminPage.js into smaller components
