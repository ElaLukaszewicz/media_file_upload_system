## Test Suites

- Web (Vitest + Testing Library): `npm --workspace web-react run test`
- Mobile (Jest + Testing Library): `npm --workspace mobile-react-native run test`
- Backend (PHPUnit): `composer --working-dir=server-symfony test`
- Root convenience: `npm run test` runs web + mobile + backend.

### Coverage

- Web: `npm --workspace web-react run test:coverage`
- Mobile: `npm --workspace mobile-react-native run test -- --coverage`
- Backend: `composer --working-dir=server-symfony test:coverage`
- Root convenience: `npm run test:coverage`

### End-to-End (Playwright)

- Command: `npm run test:e2e`
- The config (`playwright.config.ts`) auto-starts `web-react` dev server on port 5173 and uses mocked backend routes; no Symfony server is required.
- Prereq (first run): `npx playwright install --with-deps`
- Outputs: HTML report at `playwright-report/index.html`, traces/screenshots on failures.

### Stress (k6)

- Script: `tests/stress/upload-stress.k6.js`
- Example: `API_BASE_URL=http://localhost:8000 VUS=100 CHUNKS_PER_UPLOAD=10 k6 run tests/stress/upload-stress.k6.js`
- Defaults: 100 concurrent uploads, 1MB chunks, 10 chunks/file, up to 3 parallel chunk requests/upload; thresholds `<1%` failure and `p95 < 3s`.

### Useful Env Vars

- `VITE_API_BASE_URL` (web) / `EXPO_PUBLIC_API_BASE_URL` (mobile) for pointing clients at your backend during manual runs.
- `API_BASE_URL`, `VUS`, `CHUNKS_PER_UPLOAD` for k6 stress scenarios.
