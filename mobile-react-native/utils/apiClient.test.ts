import { initiateUpload, uploadChunk, finalizeUpload, getUploadStatus } from './apiClient';
import type {
  UploadInitiateRequest,
  UploadInitiateResponse,
  ChunkUploadRequest,
  ChunkUploadResponse,
  FinalizeRequest,
  FinalizeResponse,
  UploadStatusResponse,
} from '../../shared/apiTypes';

// Mock fetch globally
global.fetch = jest.fn();

describe('apiClient', () => {
  const originalEnv = process.env;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('getApiBaseUrl', () => {
    it('falls back to global env when process env missing', async () => {
      jest.isolateModules(() => {
        const { getApiBaseUrl } = require('./apiClient');
        const originalGlobalEnv = (globalThis as any).EXPO_PUBLIC_API_BASE_URL;
        delete process.env.EXPO_PUBLIC_API_BASE_URL;
        (globalThis as any).EXPO_PUBLIC_API_BASE_URL = 'http://10.0.0.1:9000';

        expect(getApiBaseUrl()).toBe('http://10.0.0.1:9000');

        (globalThis as any).EXPO_PUBLIC_API_BASE_URL = originalGlobalEnv;
      });
    });
  });

  describe('initiateUpload', () => {
    it('should successfully initiate an upload', async () => {
      const request: UploadInitiateRequest = {
        fileName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        fileHash: 'abc123',
      };

      const mockResponse: UploadInitiateResponse = {
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await initiateUpload(request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/upload/initiate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }),
      );
    });

    it('should handle API errors', async () => {
      const request: UploadInitiateRequest = {
        fileName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        fileHash: 'abc123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid request' }),
      } as Response);

      await expect(initiateUpload(request)).rejects.toThrow('Invalid request');
    });

    it('should handle network errors', async () => {
      const request: UploadInitiateRequest = {
        fileName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        fileHash: 'abc123',
      };

      const networkError = new TypeError('Network request failed');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(initiateUpload(request)).rejects.toThrow('Network request failed');
    });

    it('should use custom API_BASE_URL from environment', async () => {
      process.env.EXPO_PUBLIC_API_BASE_URL = 'http://192.168.1.100:8000';

      const request: UploadInitiateRequest = {
        fileName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        fileHash: 'abc123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadId: 'upload-123', chunkSize: 1024, totalChunks: 1 }),
      } as Response);

      await initiateUpload(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:8000/api/upload/initiate',
        expect.any(Object),
      );
    });
  });

  describe('uploadChunk', () => {
    it('should successfully upload a chunk', async () => {
      const request: ChunkUploadRequest = {
        uploadId: 'upload-123',
        chunkIndex: 0,
        chunkData: 'base64data',
      };

      const mockResponse: ChunkUploadResponse = {
        success: true,
        uploadId: 'upload-123',
        chunkIndex: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await uploadChunk(request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/upload/chunk',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }),
      );
    });

    it('should support abort signal', async () => {
      const request: ChunkUploadRequest = {
        uploadId: 'upload-123',
        chunkIndex: 0,
        chunkData: 'base64data',
      };

      const abortController = new AbortController();
      abortController.abort();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, uploadId: 'upload-123', chunkIndex: 0 }),
      } as Response);

      await uploadChunk(request, abortController.signal);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: abortController.signal,
        }),
      );
    });

    it('should handle chunk upload errors', async () => {
      const request: ChunkUploadRequest = {
        uploadId: 'upload-123',
        chunkIndex: 0,
        chunkData: 'base64data',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Upload failed' }),
      } as Response);

      await expect(uploadChunk(request)).rejects.toThrow('Upload failed');
    });
  });

  describe('finalizeUpload', () => {
    it('should successfully finalize an upload', async () => {
      const request: FinalizeRequest = {
        uploadId: 'upload-123',
      };

      const mockResponse: FinalizeResponse = {
        success: true,
        uploadId: 'upload-123',
        fileId: 'file-456',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await finalizeUpload(request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/upload/finalize',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }),
      );
    });

    it('should handle finalize errors', async () => {
      const request: FinalizeRequest = {
        uploadId: 'upload-123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Upload not found' }),
      } as Response);

      await expect(finalizeUpload(request)).rejects.toThrow('Upload not found');
    });
  });

  describe('getUploadStatus', () => {
    it('should successfully get upload status', async () => {
      const uploadId = 'upload-123';

      const mockResponse: UploadStatusResponse = {
        uploadId: 'upload-123',
        status: 'in_progress',
        uploadedChunks: 5,
        totalChunks: 10,
        fileId: null,
        error: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getUploadStatus(uploadId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/upload/status/upload-123',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('should handle status errors', async () => {
      const uploadId = 'upload-123';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Upload not found' }),
      } as Response);

      await expect(getUploadStatus(uploadId)).rejects.toThrow('Upload not found');
    });
  });

  describe('rate limiting', () => {
    it('should rate limit requests', async () => {
      const request: UploadInitiateRequest = {
        fileName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        fileHash: 'abc123',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ uploadId: 'upload-123', chunkSize: 1024, totalChunks: 1 }),
      } as Response);

      // Make multiple requests
      const promises = Array.from({ length: 15 }, () => initiateUpload(request));
      await Promise.all(promises);

      // All requests should eventually complete
      expect(mockFetch).toHaveBeenCalledTimes(15);
    });

    it('queues when not in test env', async () => {
      jest.useFakeTimers();
      const originalEnvCopy = { ...process.env };
      delete (process.env as Record<string, string | undefined>)['JEST_WORKER_ID'];
      process.env.NODE_ENV = 'production';

      const mockResponse: UploadInitiateResponse = {
        uploadId: 'upload-queued',
        chunkSize: 1024,
        totalChunks: 1,
      };

      await jest.isolateModulesAsync(async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        } as Response);

        const { initiateUpload } = require('./apiClient');

        const promise = initiateUpload({
          fileName: 'queued.jpg',
          fileSize: 123,
          mimeType: 'image/jpeg',
          fileHash: 'hash',
        });

        // Nothing should run until timers advance
        expect(global.fetch).not.toHaveBeenCalled();

        await jest.runAllTimersAsync();
        await promise;

        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      process.env = originalEnvCopy;
      jest.useRealTimers();
    });
  });

  describe('error handling', () => {
    it('should handle JSON parse errors in error response', async () => {
      const request: UploadInitiateRequest = {
        fileName: 'test.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        fileHash: 'abc123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      await expect(initiateUpload(request)).rejects.toThrow('HTTP 500: Internal Server Error');
    });
  });
});
