import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChunkedUploadManager } from './uploadManager';
import { computeFileHash } from './fileHash';
import { initiateUpload, uploadChunk, finalizeUpload } from './apiClient';
import type { UploadFileDescriptor } from '@shared/uploadState';
import type { UploadInitiateResponse } from '@shared/apiTypes';

vi.mock('./fileHash');
vi.mock('./apiClient');

const mockComputeFileHash = computeFileHash as ReturnType<typeof vi.fn>;
const mockInitiateUpload = initiateUpload as ReturnType<typeof vi.fn>;
const mockUploadChunk = uploadChunk as ReturnType<typeof vi.fn>;
const mockFinalizeUpload = finalizeUpload as ReturnType<typeof vi.fn>;

const createTestFile = (size: number, name = 'test.jpg', type = 'image/jpeg'): File => {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
};

describe('ChunkedUploadManager', () => {
  let callbacks: {
    onProgress: ReturnType<typeof vi.fn>;
    onStatusChange: ReturnType<typeof vi.fn>;
  };
  let manager: ChunkedUploadManager;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = {
      onProgress: vi.fn(),
      onStatusChange: vi.fn(),
    };
    manager = new ChunkedUploadManager(callbacks);
  });

  describe('startUpload', () => {
    it('should successfully start an upload', async () => {
      const file = createTestFile(2048 * 1024); // 2MB
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 2048 * 1024,
        type: 'image/jpeg',
      };

      mockComputeFileHash.mockResolvedValue('file-hash-123');

      const initiateResponse: UploadInitiateResponse = {
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      };
      mockInitiateUpload.mockResolvedValue(initiateResponse);
      mockUploadChunk.mockResolvedValue({
        success: true,
        uploadId: 'upload-123',
        chunkIndex: 0,
      });
      mockFinalizeUpload.mockResolvedValue({
        success: true,
        uploadId: 'upload-123',
        fileId: 'file-456',
      });

      await manager.startUpload(file, descriptor);

      expect(mockComputeFileHash).toHaveBeenCalledWith(file);
      expect(mockInitiateUpload).toHaveBeenCalledWith({
        fileName: descriptor.name,
        fileSize: descriptor.size,
        mimeType: descriptor.type,
        fileHash: 'file-hash-123',
      });
      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-1', 'uploading');
    });

    it('should handle duplicate file (already uploaded)', async () => {
      const file = createTestFile(2048 * 1024);
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 2048 * 1024,
        type: 'image/jpeg',
      };

      mockComputeFileHash.mockResolvedValue('file-hash-123');

      const initiateResponse: UploadInitiateResponse = {
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 0,
        fileId: 'existing-file-id',
        message: 'File already exists',
      };
      mockInitiateUpload.mockResolvedValue(initiateResponse);

      await manager.startUpload(file, descriptor);

      expect(callbacks.onProgress).toHaveBeenCalledWith('file-1', descriptor.size, descriptor.size);
      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-1', 'completed');
    });

    it('should not start upload if already started', async () => {
      const file = createTestFile(2048 * 1024);
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 2048 * 1024,
        type: 'image/jpeg',
      };

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      });

      await manager.startUpload(file, descriptor);
      vi.clearAllMocks();

      // Try to start again
      await manager.startUpload(file, descriptor);

      // Should not initiate again
      expect(mockInitiateUpload).not.toHaveBeenCalled();
    });

    it('should handle initiate upload errors', async () => {
      const file = createTestFile(2048 * 1024);
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 2048 * 1024,
        type: 'image/jpeg',
      };

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockRejectedValue(new Error('Initiate failed'));

      await manager.startUpload(file, descriptor);

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-1', 'error', 'Initiate failed');
    });
  });

  describe('chunk processing', () => {
    const descriptor: UploadFileDescriptor = {
      id: 'file-queued',
      name: 'queued.bin',
      size: 1024 * 1024,
      type: 'application/octet-stream',
    };

    class MockFileReader {
      public result: string | ArrayBuffer | null = null;
      public onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
      public onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;

      readAsDataURL() {
        queueMicrotask(() => {
          this.result = 'data:application/octet-stream;base64,Zm9v';
          // Ensure the callback receives a FileReader-compatible `this` and event
          this.onload?.call(
            this as unknown as FileReader,
            new ProgressEvent('load') as ProgressEvent<FileReader>,
          );
        });
      }
    }

    const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

    beforeEach(() => {
      vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);
      mockComputeFileHash.mockResolvedValue('hash-123');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-queued',
        chunkSize: 1024 * 1024,
        totalChunks: 1,
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('uploads a chunk and finalizes successfully', async () => {
      mockUploadChunk.mockResolvedValue({
        success: true,
        uploadId: 'upload-queued',
        chunkIndex: 0,
      });
      mockFinalizeUpload.mockResolvedValue({
        success: true,
        uploadId: 'upload-queued',
        fileId: 'file-final',
      });

      const file = createTestFile(descriptor.size, descriptor.name, descriptor.type);
      await manager.startUpload(file, descriptor);
      await flushAsync();

      expect(mockUploadChunk).toHaveBeenCalledWith(
        expect.objectContaining({ uploadId: 'upload-queued', chunkIndex: 0 }),
        expect.any(AbortSignal),
      );
      expect(mockFinalizeUpload).toHaveBeenCalledWith({ uploadId: 'upload-queued' });
      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-queued', 'completed');
      expect(callbacks.onProgress).toHaveBeenCalledWith(
        'file-queued',
        descriptor.size,
        descriptor.size,
      );
    });

    it('retries chunk upload with backoff before succeeding', async () => {
      const setTimeoutSpy = vi
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: TimerHandler) => {
          if (typeof cb === 'function') {
            cb();
          }
          return 0 as unknown as ReturnType<typeof setTimeout>;
        });

      mockUploadChunk.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce({
        success: true,
        uploadId: 'retry-upload',
        chunkIndex: 0,
      });

      const retryFile = createTestFile(descriptor.size, descriptor.name, descriptor.type);
      const session = {
        uploadId: 'retry-upload',
        file: retryFile,
        descriptor,
        totalChunks: 1,
        chunkSize: 1024 * 1024,
        uploadedChunks: new Set<number>(),
        uploadedBytes: 0,
        isPaused: false,
        isCancelled: false,
        activeChunkUploads: new Set<number>(),
        retryCount: 0,
        chunkAbortControllers: new Map<number, AbortController>(),
      };

      (manager as unknown as { sessions: Map<string, unknown> }).sessions.set(
        'retry-upload',
        session,
      );

      await (manager as any).uploadChunkWithRetry('retry-upload', 0, 0);
      setTimeoutSpy.mockRestore();

      expect(mockUploadChunk).toHaveBeenCalledTimes(2);
      expect(callbacks.onStatusChange).not.toHaveBeenCalledWith('retry-upload', 'error');
    });

    it('reports finalize errors without losing progress', async () => {
      mockUploadChunk.mockResolvedValue({
        success: true,
        uploadId: 'upload-queued',
        chunkIndex: 0,
      });
      mockFinalizeUpload.mockRejectedValue(new Error('finalize failed'));

      const file = createTestFile(descriptor.size, descriptor.name, descriptor.type);
      await manager.startUpload(file, descriptor);
      await flushAsync();

      expect(callbacks.onStatusChange).toHaveBeenCalledWith(
        'file-queued',
        'error',
        'finalize failed',
      );
      expect(callbacks.onProgress).toHaveBeenCalledWith(
        'file-queued',
        descriptor.size,
        descriptor.size,
      );
    });
  });

  describe('pause', () => {
    it('should pause an active upload', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
      };

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 1,
      });

      await manager.startUpload(file, descriptor);
      vi.clearAllMocks();

      manager.pause('file-1');

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-1', 'paused');
    });

    it('should do nothing if upload does not exist', () => {
      manager.pause('nonexistent');
      expect(callbacks.onStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('should resume a paused upload', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
      };

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 1,
      });

      await manager.startUpload(file, descriptor);
      manager.pause('file-1');
      vi.clearAllMocks();

      manager.resume('file-1');

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-1', 'uploading');
    });

    it('should do nothing if upload does not exist', () => {
      manager.resume('nonexistent');
      expect(callbacks.onStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel an active upload', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
      };

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 1,
      });

      await manager.startUpload(file, descriptor);
      vi.clearAllMocks();

      manager.cancel('file-1');

      // Session should be removed
      expect(callbacks.onStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset an upload', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
      };

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 1,
      });

      await manager.startUpload(file, descriptor);
      vi.clearAllMocks();

      manager.reset('file-1');

      // Session should be removed
      expect(callbacks.onStatusChange).not.toHaveBeenCalled();
    });
  });
});
