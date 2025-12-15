# Media File Upload System

Monorepo layout:
- `server-symfony/` – Symfony backend scaffold (see README for install steps).
- `web-react/` – React + Vite (TS) web app with lint/format/test scripts.
- `mobile-react-native/` – Expo React Native (TS) app with lint/format/test scripts.
- `docs/` – setup/architecture/testing notes.
- `tests/` – placeholders for e2e/stress plans.

Root scripts (proxy to workspaces):
- `npm run lint`, `npm run lint:web`, `npm run lint:mobile`
- `npm run format`, `npm run format:web`, `npm run format:mobile`
- `npm run test`, `npm run test:web`, `npm run test:mobile`

Backend bootstrap (composer required):
- `cd server-symfony && composer create-project symfony/skeleton .`
- `composer require symfony/mime symfony/rate-limiter symfony/http-client symfony/validator symfony/uid`
- `composer require symfony/monolog-bundle`
- `composer require --dev symfony/test-pack phpunit/phpunit`

Web app:
- `cd web-react && npm install`
- `npm run dev` (dev server), `npm run test` (vitest), `npm run lint` (eslint), `npm run format` (prettier check)

Mobile app:
- `cd mobile-react-native && npm install`
- `npm run start` (Expo), `npm run test` (jest + testing-library), `npm run lint`, `npm run format`
