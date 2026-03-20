# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, bonus system, and complete admin control. Includes a private file manager for admin.

## Core Features

### Large Video Upload Fix (March 20, 2026) — LATEST
- Memory-efficient upload: `upload_file_to_cloudinary()` streams from file path, no `f.read()` for large files
- Chunk size reduced from 8MB to 4MB (proxy-safe)
- Timeouts: 10min for Cloudinary upload, 2min per chunk
- Better error messages in toast notifications

### All Files to Cloudinary (March 20, 2026)
- Removed local storage - ALL files go to Cloudinary
- Cloudinary `upload_large` with 20MB chunks for big files

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
- Admin: admin@avarus.ru / admin
- Client: user@demo.com / demo123
- Personal files: GenSutSu.1999

## Backlog
- P2: Real payment gateway (YuKassa)
- P2: Refactor PersonalFilesPage.js and AdminPage.js
