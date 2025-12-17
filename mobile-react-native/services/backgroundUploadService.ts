import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { ChunkedUploadManager } from '../utils/uploadManager';
import { loadUploadSessions } from '../utils/uploadStatePersistence';

const BACKGROUND_UPLOAD_TASK = 'background-upload-task';

let uploadManagerInstance: ChunkedUploadManager | null = null;

/**
 * Background Upload Service
 *
 * Note: True background uploads on mobile are limited by OS restrictions.
 * iOS background fetch has a 15-minute minimum interval and is unreliable.
 * Android has similar limitations.
 *
 * Our approach:
 * 1. Persist upload state when app goes to background
 * 2. Resume uploads automatically when app returns to foreground
 * 3. Use background fetch as a fallback (limited effectiveness)
 *
 * The primary mechanism is persistence + foreground resume, not true background execution.
 */

/**
 * Initialize the background upload service with the upload manager instance.
 * This allows the background task to access the manager when needed.
 */
export function initializeBackgroundUploadService(uploadManager: ChunkedUploadManager): void {
  uploadManagerInstance = uploadManager;
}

/**
 * Background task handler for processing uploads.
 *
 * Note: This runs infrequently (15+ min intervals on iOS) and is unreliable.
 * The main upload processing happens in the foreground. This is a fallback
 * that attempts to resume uploads if the app is briefly backgrounded.
 */
TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
  try {
    if (!uploadManagerInstance) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Check if there are any active upload sessions
    const sessions = await loadUploadSessions();
    if (sessions.size === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Attempt to restore and resume uploads
    // This will only work if the app is still in memory (not terminated)
    await uploadManagerInstance.restoreSessions();

    // Return result based on whether we found active uploads
    const hasActiveUploads = Array.from(sessions.values()).some(
      (session) => session.status === 'uploading',
    );

    return hasActiveUploads
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('Background upload task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background fetch task.
 * This is optional and may not be available on all devices.
 */
export async function registerBackgroundUploadTask(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
      minimumInterval: 15 * 60, // 15 minutes minimum (iOS limitation)
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('Background upload task registered');
  } catch (error) {
    // Background fetch may not be available - this is expected on some devices
    console.warn('Background upload task not available:', error);
  }
}

/**
 * Unregister the background fetch task.
 */
export async function unregisterBackgroundUploadTask(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_UPLOAD_TASK);
    console.log('Background upload task unregistered');
  } catch (error) {
    console.warn('Failed to unregister background upload task:', error);
  }
}

/**
 * Check if background fetch is available on this device.
 */
export async function isBackgroundFetchAvailable(): Promise<boolean> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    return status === BackgroundFetch.BackgroundFetchStatus.Available;
  } catch {
    return false;
  }
}
