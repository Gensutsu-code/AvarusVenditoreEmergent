# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, bonus system, and complete admin control. Includes a private file manager for admin.

## Core Features

### Large Video Upload Fix (March 20, 2026) — LATEST
- Root cause: Cloudinary free plan has 100MB file limit → 370MB videos crashed
- Fix: Hybrid storage restored — files <=95MB go to Cloudinary, >95MB stored locally
- upload_file_to_cloudinary() streams from file path (no memory overload)
- Frontend retry logic: 3 attempts per chunk with backoff on 502/network errors
- Chunk size: 4MB (safe for K8s proxy)
- Timeouts: 2min/chunk, 10min/complete
- Tested with actual 370MB video: 93 chunks, 0 errors, successful upload

### Drag & Drop + Bulk Operations (March 20, 2026)
- Selection mode, bulk add tags/move/delete, drag-drop to folders

### File Tags, Navigation & Similar Files (March 20, 2026)
- Tags system, tag cloud filter, prev/next nav, similar files

### Video Sprite Previews + Upload Cancel (March 20, 2026)
- Sprite generation for all videos, cancel uploads

### Personal Files Storage (March 19, 2026)
- Password-protected (GenSutSu.1999), chunked uploads, nested folders, video player

## 3rd Party
Resend, Cloudinary, web3.py, ethers.js, CoinGecko, FingerprintJS, GeoIP2, ffmpeg/pymediainfo. YuKassa (MOCKED)

## Credentials
- Admin: admin@avarus.ru / admin, Client: user@demo.com / demo123
- Personal files: GenSutSu.1999

## Backlog
- P2: Real payment gateway (YuKassa)
- P2: Refactor PersonalFilesPage.js and AdminPage.js
