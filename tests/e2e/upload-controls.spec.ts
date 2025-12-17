import { expect, test } from '@playwright/test';

test.describe('upload controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('pause and resume keeps upload progress intact', async ({ page }) => {
    let releaseChunks: (() => void) | null = null;
    const chunkGate = new Promise<void>((resolve) => {
      releaseChunks = resolve;
    });

    await page.route('**/api/upload/initiate', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          uploadId: 'upload-pause',
          chunkSize: 1_048_576,
          totalChunks: 2,
        }),
      });
    });

    await page.route('**/api/upload/chunk', async (route) => {
      await chunkGate;
      const body = (await route.request().postDataJSON()) as { chunkIndex: number };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          uploadId: 'upload-pause',
          chunkIndex: body.chunkIndex,
        }),
      });
    });

    await page.route('**/api/upload/finalize', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          uploadId: 'upload-pause',
          fileId: 'file-pause',
        }),
      });
    });

    await page.goto('/uploads');

    const buffer = Buffer.alloc(1.5 * 1024 * 1024, 'b');
    await page.getByLabel('Select files to upload').setInputFiles({
      name: 'pause-video.mp4',
      mimeType: 'video/mp4',
      buffer,
    });

    const status = page.getByRole('status', { name: /upload status/i });
    await expect(status).toContainText('uploading');

    const pauseButton = page.getByRole('button', { name: /pause upload/i });
    await pauseButton.click();
    await expect(status).toHaveText('paused');

    const resumeButton = page.getByRole('button', { name: /resume upload/i });
    await resumeButton.click();
    releaseChunks?.();
    await expect(status).toHaveText('uploading');

    await expect(status).toHaveText('completed', { timeout: 20_000 });
  });

  test('cancel stops in-flight uploads and removes card', async ({ page }) => {
    const finalizeCalls: string[] = [];

    await page.route('**/api/upload/initiate', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          uploadId: 'upload-cancel',
          chunkSize: 1_048_576,
          totalChunks: 1,
        }),
      });
    });

    await page.route('**/api/upload/chunk', async (route) => {
      // Give us a moment to cancel before the response arrives
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          uploadId: 'upload-cancel',
          chunkIndex: 0,
        }),
      });
    });

    await page.route('**/api/upload/finalize', async (route) => {
      finalizeCalls.push('called');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          uploadId: 'upload-cancel',
          fileId: 'file-cancel',
        }),
      });
    });

    await page.goto('/uploads');

    await page.getByLabel('Select files to upload').setInputFiles({
      name: 'cancel-video.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.alloc(800 * 1024, 'c'),
    });

    const cancelButton = page.getByRole('button', { name: /cancel upload/i });
    await cancelButton.click();

    await expect(page.getByText(/no uploads yet/i)).toBeVisible();

    // Wait briefly to confirm finalize never fired after cancel
    await page.waitForTimeout(800);
    expect(finalizeCalls).toHaveLength(0);
  });
});
