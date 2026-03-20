# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, bonus system, and complete admin control ("Absolute Control"). Includes a private file manager for admin with hybrid storage.

## Core Features Implemented

### File Tags, Navigation & Similar Files (March 20, 2026) — LATEST
- Add/remove tags on files (chips UI with autocomplete from existing tags)
- Tag cloud filter panel - click tag to filter, "Сбросить" to clear
- Search by tags (in addition to filename)
- Tag chips on file cards (max 2 visible + overflow count)
- Prev/Next navigation arrows in image/GIF/video preview modals (+ keyboard arrows)
- Larger GIF modal (fullscreen-like, 95vw/85vh)
- "Похожие по тегам" section in preview modals showing similar files
- Clicking similar file opens it directly

### Video Sprite Previews (March 20, 2026)
- Fixed sprite generation for ALL videos (Cloudinary + local storage)
- Seek bar hover shows frame preview in video player

### Upload Cancellation (March 20, 2026)
- Cancel button aborts all in-progress uploads
- Backend cleanup endpoint for partial chunked uploads

### Personal Files Storage (March 19, 2026)
- Password-protected private file storage (password: GenSutSu.1999)
- Hybrid storage: Cloudinary (<90MB), local (>90MB)
- Chunked uploads, parallel processing, nested folders
- File type filters, search, custom video player
- 6-hour session persistence

### Admin Cart Management, Revertible Actions, Full Admin Control
- See previous PRD entries

### Earlier Features
- E-commerce catalog, cart, checkout, orders, bonus system, crypto payments

## Key Collections
- `personal_folders`: {id, name, parent_id, created_at}
- `personal_files`: {id, folder_id, name, url, public_id, file_type, size, width, height, quality, duration, storage, local_filename, sprite_ready, sprite_cols, sprite_rows, tags[], created_at}
- `action_logs`: {id, action, before_state, document_query, collection_name, reverted}

## Key API Endpoints
- `PUT /api/personal-files/files/{file_id}/tags` - update tags
- `GET /api/personal-files/tags` - list all unique tags with counts
- `GET /api/personal-files/files?tag=xxx` - filter by tag
- `GET /api/personal-files/files/{file_id}/similar` - similar files by tags
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
