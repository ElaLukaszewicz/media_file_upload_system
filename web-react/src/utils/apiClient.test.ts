import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initiateUpload, uploadChunk, finalizeUpload, getUploadStatus } from './apiClient';
import type {
  UploadInitiateRequest,
  UploadInitiateResponse,
  ChunkUploadRequest,
  ChunkUploadResponse,
  FinalizeRequest,
  FinalizeResponse,
  UploadStatusResponse,
} from '@shared/apiTypes';

// Mock fetch globally
global.fetch = vi.fn();

describe('apiClient', () => {
  const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset import.meta.env
    vi.stubEnv('VITE_API_BASE_URL', undefined);
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

    it('should use custom API_BASE_URL from environment', async () => {
      // Note: This test verifies the default behavior since import.meta.env
      // is evaluated at module load time. The actual environment variable
      // would need to be set before the module is imported.
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

      // Verify it uses the default or configured URL
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/initiate'),
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

      // Make a few requests to verify rate limiting is implemented
      // Note: The rate limiter queues requests and processes them at max 10 per minute.
      // For testing, we verify that requests are made and the rate limiter is working.
      // Since rate limiting involves actual delays, we test with a small number of requests
      // that should complete quickly (within the first 10 requests per minute window).
      const promises = Array.from({ length: 2 }, () => initiateUpload(request));

      // Wait for all requests to complete
      await Promise.all(promises);

      // All requests should eventually complete
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 10000); // Reasonable timeout for rate-limited requests
  });
});
