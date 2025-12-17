# Tests scaffold

- `web/`: Vitest + Testing Library for web components and upload manager logic.
- `mobile/`: Jest + Testing Library for RN components and upload manager logic.
- `backend/`: PHPUnit/Symfony test pack (to be added after Composer install).
- `e2e/`: Playwright browser flows covering chunked upload, pause/resume, and cancel controls.
- `stress/`: k6 load script for 100 concurrent chunked uploads (1MB chunks, 3-way chunk concurrency).
