import { expect, test } from '@playwright/test';

test.describe('web upload flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('uploads a file with chunking and records history', async ({ page }) => {
    const chunkCalls: number[] = [];
    let finalizeCalled = false;

    // Mock backend endpoints
    await page.route('**/api/upload/initiate', async (route) => {
      const body = (await route.request().postDataJSON()) as { fileSize: number };
      const totalChunks = Math.ceil(body.fileSize / 1_048_576);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          uploadId: 'upload-e2e-1',
          chunkSize: 1_048_576,
          totalChunks,
        }),
      });
    });

    await page.route('**/api/upload/chunk', async (route) => {
      const body = (await route.request().postDataJSON()) as { chunkIndex: number };
      chunkCalls.push(body.chunkIndex);

      // Small delay so progress UI has time to update
      await new Promise((resolve) => setTimeout(resolve, 30));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          uploadId: 'upload-e2e-1',
          chunkIndex: body.chunkIndex,
        }),
      });
    });

    await page.route('**/api/upload/finalize', async (route) => {
      finalizeCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          uploadId: 'upload-e2e-1',
          fileId: 'file-xyz',
        }),
      });
    });

    await page.goto('/uploads');

    const buffer = Buffer.alloc(2.5 * 1024 * 1024, 'a');
    await page.getByLabel('Select files to upload').setInputFiles({
      name: 'sample-video.mp4',
      mimeType: 'video/mp4',
      buffer,
    });

    const status = page.getByRole('status', { name: /upload status/i });
    await expect(status).toContainText('uploading');

    await expect
      .poll(() => chunkCalls.length, { timeout: 20_000, message: 'Wait for all chunks' })
      .toBe(3);

    const progress = page.getByRole('progressbar', {
      name: /upload progress for sample-video.mp4/i,
    });
    await expect(progress).toHaveAttribute('aria-valuenow', '100', { timeout: 20_000 });
    await expect(status).toHaveText('completed', { timeout: 20_000 });
    expect(finalizeCalled).toBe(true);

    // Ensure every chunk was requested
    chunkCalls.sort((a, b) => a - b);
    expect(chunkCalls).toEqual([0, 1, 2]);

    // History should show the completed upload
    await page.getByRole('link', { name: /history/i }).click();
    await expect(page.getByRole('heading', { name: /upload history/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'sample-video.mp4' })).toBeVisible();
  });
});
