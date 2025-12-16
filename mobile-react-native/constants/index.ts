/**
 * Shared constants across the mobile app
 */

export const UPLOAD_CONSTANTS = {
  MAX_FILES_PER_BATCH: 10,
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  CHUNK_SIZE: 1024 * 1024, // 1MB
  MAX_CONCURRENT_UPLOADS: 3,
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY: 1000, // 1 second
  PROGRESS_DEBOUNCE_MS: 100,
} as const;

export const VALIDATION_CONFIG = {
  maxFiles: UPLOAD_CONSTANTS.MAX_FILES_PER_BATCH,
  maxFileSizeBytes: UPLOAD_CONSTANTS.MAX_FILE_SIZE_BYTES,
  allowedTypes: ['image/', 'video/'] as const,
} as const;
