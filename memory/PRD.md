# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, bonus system, and complete admin control ("Absolute Control"). Includes a private file manager for admin.

## Core Features Implemented

### All Videos to Cloudinary (March 20, 2026) — LATEST
- Removed local storage logic - ALL files uploaded to Cloudinary
- Cloudinary `upload_large` handles files >90MB automatically
- Sprite generation preserved via temp files (deleted after)

### Drag & Drop + Bulk Operations (March 20, 2026)
- Selection mode with checkboxes, bulk add tags/move/delete
- Drag & Drop files onto folders

### File Tags, Navigation & Similar Files (March 20, 2026)
- Tags system, tag cloud filter, search by tags
- Prev/Next navigation, larger GIF modal, similar files

### Video Sprite Previews + Upload Cancel (March 20, 2026)
- Sprite generation for all videos, cancel uploads with cleanup

### Personal Files Storage (March 19, 2026)
- Password-protected, chunked uploads, nested folders, video player

## Key API Endpoints (File Manager)
- PUT/DELETE /api/personal-files/files/bulk/{move,tags,delete}
- PUT /api/personal-files/files/{file_id}/tags
- GET /api/personal-files/tags, /files/{file_id}/similar
- POST /api/personal-files/upload, /upload/init, /upload/chunk, /upload/complete
- DELETE /api/personal-files/upload/{upload_id}

## 3rd Party
Resend, Cloudinary, web3.py, ethers.js, CoinGecko, FingerprintJS, GeoIP2, ffmpeg/pymediainfo. YuKassa (MOCKED)

## Credentials
- Admin: admin@avarus.ru / admin
- Client: user@demo.com / demo123
- Personal files: GenSutSu.1999

## Backlog
- P2: Real payment gateway (YuKassa) integration
- P2: Refactor PersonalFilesPage.js and AdminPage.js
