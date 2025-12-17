## Overview

- Monorepo with three apps:
  - `server-symfony`: PHP backend for chunked uploads, validation, deduplication, cleanup.
  - `web-react`: Vite + React web client for desktop uploads/history.
  - `mobile-react-native`: Expo React Native client with offline-aware resume.
- Shared contracts live in `shared/` (`apiTypes.ts`, `uploadState.ts`) and are consumed by both clients.

## Data Flow (chunked upload)

1. Client pre-validates file size/type (images/videos, 100MB max, 1MB chunks).
2. Client computes MD5 hash (see `utils/fileHash.*`) and calls `POST /api/upload/initiate`.
   - Backend responds with `uploadId`, `chunkSize`, `totalChunks`; if the file already exists it returns `fileId` and `totalChunks: 0` to short-circuit uploads.
3. Client uploads chunks in parallel via `POST /api/upload/chunk` (base64 payloads).
4. Client calls `POST /api/upload/finalize` to reassemble and store the file.
5. Optional: `GET /api/upload/status/{uploadId}` for progress monitoring.

## Client Architecture

- Both clients use `ChunkedUploadManager` to coordinate uploads with:
  - 1MB `CHUNK_SIZE`, max 3 concurrent chunk uploads, and 3 retries with backoff.
  - Pause/resume/cancel and dedup handling (completes immediately when backend signals an existing file).
  - Upload context/state in `state/uploadContext.*` plus UI components (`UploadCard`, `HistoryItem`, `DropZone` on web; `UploadCard`, `HistoryScreen` on mobile).
- Mobile-specific:
  - Persists active sessions and file URIs to AsyncStorage (`utils/uploadStatePersistence.ts`) so uploads can recover after app restarts.
  - Uses Expo FileSystem for chunk reads and background-friendly behavior.
- Web-specific:
  - Uses File APIs for chunk slicing; Playwright e2e tests mock backend routes to validate UI/state.

## Backend Architecture (Symfony)

- Services:
  - `FileValidator`: MIME + magic-number validation and size limits.
  - `ChunkManager`: manages upload sessions, chunk writes, and status.
  - `FileStorage`: reassembles chunks, deduplicates via MD5, organizes storage by `YYYY/MM/DD`.
- Storage layout (configurable via env):

```
var/uploads/
├── chunks/{uploadId}/{chunkIndex}
├── files/YYYY/MM/DD/{fileId}.{ext}
├── temp/
└── sessions.json
```

- Scheduled maintenance: `php bin/console app:cleanup` removes expired chunks and old files (30-day retention by default).

## Environment Contracts

- Backend env (`server-symfony/.env*`): `UPLOAD_DIR`, `CHUNK_SIZE`, `CHUNK_TIMEOUT`, `FILE_RETENTION_DAYS`, `MAX_FILE_SIZE`.
- Web env (`web-react/.env.local`): `VITE_API_BASE_URL`.
- Mobile env (`mobile-react-native/.env`): `EXPO_PUBLIC_API_BASE_URL` (use host machine IP, not `localhost`).

## Cross-Cutting Concerns

- Validation: client-side size/type checks mirror backend allowlist.
- Observability: backend uses Monolog; Playwright captures traces/screenshots on retry/failure.
- Rate limiting: backend enforces 10 requests/minute/IP; clients retry with backoff and surface errors.
