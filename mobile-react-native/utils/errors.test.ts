import {
  FileValidationError,
  UploadError,
  NetworkError,
  PermissionError,
  ErrorCodes,
} from './errors';

describe('Custom Error Classes', () => {
  describe('FileValidationError', () => {
    it('should create a FileValidationError with message and code', () => {
      const error = new FileValidationError('File is too large', ErrorCodes.FILE_TOO_LARGE);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FileValidationError);
      expect(error.message).toBe('File is too large');
      expect(error.code).toBe(ErrorCodes.FILE_TOO_LARGE);
      expect(error.name).toBe('FileValidationError');
    });
  });

  describe('UploadError', () => {
    it('should create an UploadError with message, code, and optional uploadId', () => {
      const error = new UploadError('Upload failed', ErrorCodes.UPLOAD_FAILED, 'upload-123');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(UploadError);
      expect(error.message).toBe('Upload failed');
      expect(error.code).toBe(ErrorCodes.UPLOAD_FAILED);
      expect(error.uploadId).toBe('upload-123');
      expect(error.name).toBe('UploadError');
    });

    it('should create an UploadError without uploadId', () => {
      const error = new UploadError('Upload failed', ErrorCodes.UPLOAD_FAILED);
      expect(error.uploadId).toBeUndefined();
    });
  });

  describe('NetworkError', () => {
    it('should create a NetworkError with message and optional originalError', () => {
      const originalError = new Error('Network request failed');
      const error = new NetworkError('Network error occurred', originalError);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe('Network error occurred');
      expect(error.originalError).toBe(originalError);
      expect(error.name).toBe('NetworkError');
    });

    it('should create a NetworkError without originalError', () => {
      const error = new NetworkError('Network error occurred');
      expect(error.originalError).toBeUndefined();
    });
  });

  describe('PermissionError', () => {
    it('should create a PermissionError with message and permissionType', () => {
      const error = new PermissionError('Permission denied', 'camera');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PermissionError);
      expect(error.message).toBe('Permission denied');
      expect(error.permissionType).toBe('camera');
      expect(error.name).toBe('PermissionError');
    });
  });

  describe('ErrorCodes', () => {
    it('should have all expected error codes', () => {
      expect(ErrorCodes.FILE_TOO_LARGE).toBe('FILE_TOO_LARGE');
      expect(ErrorCodes.INVALID_FILE_TYPE).toBe('INVALID_FILE_TYPE');
      expect(ErrorCodes.TOO_MANY_FILES).toBe('TOO_MANY_FILES');
      expect(ErrorCodes.DUPLICATE_FILE).toBe('DUPLICATE_FILE');
      expect(ErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(ErrorCodes.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(ErrorCodes.UPLOAD_FAILED).toBe('UPLOAD_FAILED');
      expect(ErrorCodes.CHUNK_UPLOAD_FAILED).toBe('CHUNK_UPLOAD_FAILED');
      expect(ErrorCodes.FINALIZE_FAILED).toBe('FINALIZE_FAILED');
    });
  });
});
