# PRD - E-commerce Platform "AVOPT.STORE"

## Original Problem Statement
E-commerce platform for truck spare parts with full admin panel, crypto payments, order management, bonus system, and complete admin control. Includes a private file manager for admin.

## Core Features

### Personal Files Moved to Settings Tab (March 22, 2026) — LATEST
- Moved PersonalFilesPage from separate route `/admin/personal-files` into admin panel Settings → Файлы sub-tab
- Password gate preserved — requires password before accessing files
- Embedded mode: no min-h-screen, fits within Settings container
- Removed standalone route from App.js
- Updated AdminProfilePage link to point to admin panel

### Maintenance Mode: Real-time + Per-Page (March 24, 2026) — LATEST
- Polling every 15s ensures maintenance activates instantly (no page reload needed)
- Per-page maintenance: admin can disable individual pages (catalog, bonus, account, news, orders) with custom messages
- Disabled page shows header + maintenance banner; rest of site works normally
- Backend: `GET/PUT /api/maintenance/pages` endpoints
- Admin UI: Настройки → Техработы → "Техработы по страницам" section

### Upload Resilience & Broken Thumbnail Fix (March 22, 2026)
- Fixed broken video thumbnails for corrupted MP4 files (moov atom missing) — shows clean dark placeholder
- Added Cloudinary fallback to local storage if Cloudinary upload fails (both single and chunked)
- Added retry logic (3 attempts) for the `complete` step on frontend
- Fixed `duration: None` TypeError in thumb generation
- Frontend `onError` handler hides broken thumbnail images gracefully

### Auto-Slideshow for Photos (March 22, 2026) — LATEST
- Added auto-scroll slideshow for photo/GIF preview modal
- Play/Pause button + speed slider (0.1s — 10s interval)
- Controls: Space to toggle, arrows to navigate (stops slideshow), Escape to close
- Slideshow auto-stops when reaching the last file
- UI: floating control bar at top center with glassmorphism backdrop

### Video Thumbnail Fix — Single Frame from Middle (March 22, 2026)
- Bug: Video grid thumbnails showed two sprite frames instead of one + low quality
- Fix: Backend generates a separate high-quality single-frame thumbnail (640x360) from the middle of each video via ffmpeg
- For existing videos: thumbnail auto-generated on-demand (from local video via ffmpeg, or from sprite sheet via PIL crop)
- Generated thumbs are cached on disk for subsequent requests
- Frontend uses simple `<img>` tag instead of CSS sprite background — eliminates all CSS bounding issues
- Alt text removed from thumbnails to hide original filenames
- Endpoint: `GET /api/personal-files/sprites/{file_id}/thumb.jpg`

### Large Video Upload Fix (March 20, 2026)
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
- P3: Smart sorting (by date, size, label, tags)
