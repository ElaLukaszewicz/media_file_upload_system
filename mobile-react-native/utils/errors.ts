/**
 * Custom error types for better error handling
 */

export class FileValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'FileValidationError';
  }
}

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly uploadId?: string,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class PermissionError extends Error {
  constructor(
    message: string,
    public readonly permissionType: string,
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * Error codes for categorization
 */
export const ErrorCodes = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  TOO_MANY_FILES: 'TOO_MANY_FILES',
  DUPLICATE_FILE: 'DUPLICATE_FILE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  CHUNK_UPLOAD_FAILED: 'CHUNK_UPLOAD_FAILED',
  FINALIZE_FAILED: 'FINALIZE_FAILED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
