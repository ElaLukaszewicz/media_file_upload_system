# Setup (current state)

## Prerequisites
- Node 18+ and npm.
- Expo CLI (`npm install -g expo-cli`) for mobile dev tools.
- Composer 2.x (needed to scaffold/install the Symfony backend once available).

## Install
- Root JS workspaces: `npm install --workspaces=false` (installs per-app when run inside each package).
- Web: `cd web-react && npm install && npm run dev`.
- Mobile: `cd mobile-react-native && npm install && npm run start`.
- Server: `cd server-symfony && composer create-project symfony/skeleton .` (composer required), then install required bundles noted in `server-symfony/README.md`.

## Lint/Format/Test
- Root helpers: `npm run lint`, `npm run format`, `npm run test` (proxy to web/mobile workspaces).
- Web-only: `npm run lint:web`, `npm run format:web`, `npm run test:web`.
- Mobile-only: `npm run lint:mobile`, `npm run format:mobile`, `npm run test:mobile`.
