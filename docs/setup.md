# Setup

## Prerequisites

- Node 18+ and npm
- Expo CLI (`npm install -g expo-cli`) for mobile tooling
- PHP 8.1+ and Composer 2.x for the Symfony backend
- k6 (optional) for stress tests (`brew install k6`)

## Environment Variables

- Web: copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` (e.g., `http://localhost:8000`).
- Mobile: create `.env` with `EXPO_PUBLIC_API_BASE_URL=http://<your-host-ip>:8000` (mobile devices/emulators cannot use `localhost`).
- Backend: copy `server-symfony/.env` to `.env.local` and adjust `UPLOAD_DIR`, `CHUNK_SIZE`, `FILE_RETENTION_DAYS`, `MAX_FILE_SIZE`, etc.

## Install & Run

- Root (installs Playwright deps): `npm install`
- Web: `cd web-react && npm install && npm run dev`
- Mobile: `cd mobile-react-native && npm install && npm start` (use `npm run ios` / `npm run android` as needed)
- Backend: `cd server-symfony && composer install && symfony server:start -d` (or `php -S localhost:8000 -t public`)

## Lint / Format / Test

- Root helpers: `npm run lint`, `npm run format`, `npm run test`, `npm run test:e2e`
- Web-only: `npm run lint:web`, `npm run format:web`, `npm run test:web`
- Mobile-only: `npm run lint:mobile`, `npm run format:mobile`, `npm run test:mobile`
- Backend-only: `composer --working-dir=server-symfony test`

## Stress Testing (k6)

- Script: `tests/stress/upload-stress.k6.js`
- Example run: `API_BASE_URL=http://localhost:8000 VUS=100 CHUNKS_PER_UPLOAD=10 k6 run tests/stress/upload-stress.k6.js`
- Defaults: 100 concurrent uploads, 1MB chunks, 10 chunks/file, up to 3 parallel chunk requests/upload; thresholds `<1%` failure rate and `p95 < 3s` latency. Adjust env vars to scale.
