import { ChunkedUploadManager } from './uploadManager';
import * as FileSystem from 'expo-file-system/legacy';
import { computeFileHash } from './fileHash';
import { initiateUpload, uploadChunk, finalizeUpload } from './apiClient';
import { saveUploadSessions, loadUploadSessions } from './uploadStatePersistence';
import type { UploadFileDescriptor } from '../../shared/uploadState';
import type { UploadInitiateResponse } from '../../shared/apiTypes';

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

jest.mock('./fileHash');
jest.mock('./apiClient');
jest.mock('./uploadStatePersistence');

const mockComputeFileHash = computeFileHash as jest.MockedFunction<typeof computeFileHash>;
const mockInitiateUpload = initiateUpload as jest.MockedFunction<typeof initiateUpload>;
const mockUploadChunk = uploadChunk as jest.MockedFunction<typeof uploadChunk>;
const mockFinalizeUpload = finalizeUpload as jest.MockedFunction<typeof finalizeUpload>;
const mockGetInfoAsync = FileSystem.getInfoAsync as jest.MockedFunction<
  typeof FileSystem.getInfoAsync
>;
const mockReadAsStringAsync = FileSystem.readAsStringAsync as jest.MockedFunction<
  typeof FileSystem.readAsStringAsync
>;
const mockSaveUploadSessions = saveUploadSessions as jest.MockedFunction<typeof saveUploadSessions>;
const mockLoadUploadSessions = loadUploadSessions as jest.MockedFunction<typeof loadUploadSessions>;

describe('ChunkedUploadManager', () => {
  let callbacks: {
    onProgress: jest.Mock;
    onStatusChange: jest.Mock;
  };
  let consoleErrorSpy: jest.SpyInstance;
  let manager: ChunkedUploadManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    callbacks = {
      onProgress: jest.fn(),
      onStatusChange: jest.fn(),
    };
    manager = new ChunkedUploadManager(callbacks, true);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('startUpload', () => {
    const fileUri = 'file:///path/to/test.jpg';
    const descriptor: UploadFileDescriptor = {
      id: 'file-1',
      name: 'test.jpg',
      size: 2048 * 1024, // 2MB
      type: 'image/jpeg',
      uri: fileUri,
    };

    it('should successfully start an upload', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048 * 1024,
      } as FileSystem.FileInfo);

      mockComputeFileHash.mockResolvedValue('file-hash-123');

      const initiateResponse: UploadInitiateResponse = {
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      };
      mockInitiateUpload.mockResolvedValue(initiateResponse);

      mockReadAsStringAsync.mockResolvedValue('base64content');

      await manager.startUpload(fileUri, descriptor);

      expect(mockGetInfoAsync).toHaveBeenCalledWith(fileUri);
      expect(mockComputeFileHash).toHaveBeenCalledWith(fileUri);
      expect(mockInitiateUpload).toHaveBeenCalledWith({
        fileName: descriptor.name,
        fileSize: descriptor.size,
        mimeType: descriptor.type,
        fileHash: 'file-hash-123',
      });
      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-1', 'uploading');
    });

    it('should handle file that does not exist', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: false,
        size: 0,
      } as FileSystem.FileInfo);

      await manager.startUpload(fileUri, descriptor);

      expect(callbacks.onStatusChange).toHaveBeenCalledWith(
        'file-1',
        'error',
        'File does not exist or has no size',
      );
    });

    it('should handle duplicate file (already uploaded)', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048 * 1024,
      } as FileSystem.FileInfo);

      mockComputeFileHash.mockResolvedValue('file-hash-123');

      const initiateResponse: UploadInitiateResponse = {
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 0,
        fileId: 'existing-file-id',
        message: 'File already exists',
      };
      mockInitiateUpload.mockResolvedValue(initiateResponse);

      await manager.startUpload(fileUri, descriptor);

      expect(callbacks.onProgress).toHaveBeenCalledWith('file-1', descriptor.size, descriptor.size);
      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-1', 'completed');
    });

    it('should not start upload if already started', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048 * 1024,
      } as FileSystem.FileInfo);

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      });

      await manager.startUpload(fileUri, descriptor);
      jest.clearAllMocks();

      // Try to start again
      await manager.startUpload(fileUri, descriptor);

      // Should not initiate again
      expect(mockInitiateUpload).not.toHaveBeenCalled();
    });

    it('should handle initiate upload errors', async () => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048 * 1024,
      } as FileSystem.FileInfo);

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockRejectedValue(new Error('Initiate failed'));

      await manager.startUpload(fileUri, descriptor);

      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-1', 'error', 'Initiate failed');
    });
  });

  describe('pause', () => {
    it('should pause an active upload', async () => {
      const fileUri = 'file:///path/to/test.jpg';
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 2048 * 1024,
        type: 'image/jpeg',
        uri: fileUri,
      };

      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048 * 1024,
      } as FileSystem.FileInfo);

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      });

      await manager.startUpload(fileUri, descriptor);
      jest.clearAllMocks();

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
      const fileUri = 'file:///path/to/test.jpg';
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 2048 * 1024,
        type: 'image/jpeg',
        uri: fileUri,
      };

      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048 * 1024,
      } as FileSystem.FileInfo);

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      });

      await manager.startUpload(fileUri, descriptor);
      manager.pause('file-1');
      jest.clearAllMocks();

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
      const fileUri = 'file:///path/to/test.jpg';
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 2048 * 1024,
        type: 'image/jpeg',
        uri: fileUri,
      };

      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048 * 1024,
      } as FileSystem.FileInfo);

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      });

      await manager.startUpload(fileUri, descriptor);
      jest.clearAllMocks();

      manager.cancel('file-1');

      // Session should be removed
      expect(callbacks.onStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset an upload', async () => {
      const fileUri = 'file:///path/to/test.jpg';
      const descriptor: UploadFileDescriptor = {
        id: 'file-1',
        name: 'test.jpg',
        size: 2048 * 1024,
        type: 'image/jpeg',
        uri: fileUri,
      };

      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048 * 1024,
      } as FileSystem.FileInfo);

      mockComputeFileHash.mockResolvedValue('file-hash-123');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-123',
        chunkSize: 1024 * 1024,
        totalChunks: 2,
      });

      await manager.startUpload(fileUri, descriptor);
      jest.clearAllMocks();

      manager.reset('file-1');

      // Session should be removed
      expect(callbacks.onStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('restoreSessions', () => {
    it('should restore persisted sessions', async () => {
      const persistedSessions = new Map([
        [
          'file-1',
          {
            uploadId: 'upload-123',
            fileId: 'file-1',
            fileUri: 'file:///path/to/test.jpg',
            descriptor: {
              id: 'file-1',
              name: 'test.jpg',
              size: 2048 * 1024,
              type: 'image/jpeg',
            },
            totalChunks: 2,
            chunkSize: 1024 * 1024,
            uploadedChunks: [0],
            uploadedBytes: 1024 * 1024,
            fileHash: 'file-hash-123',
            status: 'uploading',
            createdAt: new Date().toISOString(),
          },
        ],
      ]);

      mockLoadUploadSessions.mockResolvedValue(persistedSessions);
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: 2048 * 1024,
      } as FileSystem.FileInfo);

      await manager.restoreSessions();

      expect(mockLoadUploadSessions).toHaveBeenCalled();
      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-1', 'uploading');
    });

    it('should skip sessions for files that no longer exist', async () => {
      const persistedSessions = new Map([
        [
          'file-1',
          {
            uploadId: 'upload-123',
            fileId: 'file-1',
            fileUri: 'file:///path/to/test.jpg',
            descriptor: {
              id: 'file-1',
              name: 'test.jpg',
              size: 2048 * 1024,
              type: 'image/jpeg',
            },
            totalChunks: 2,
            chunkSize: 1024 * 1024,
            uploadedChunks: [0],
            uploadedBytes: 1024 * 1024,
            status: 'uploading',
            createdAt: new Date().toISOString(),
          },
        ],
      ]);

      mockLoadUploadSessions.mockResolvedValue(persistedSessions);
      mockGetInfoAsync.mockResolvedValue({
        exists: false,
        size: 0,
      } as FileSystem.FileInfo);

      await manager.restoreSessions();

      expect(callbacks.onStatusChange).not.toHaveBeenCalled();
    });

    it('should handle persistence disabled', async () => {
      const managerWithoutPersistence = new ChunkedUploadManager(callbacks, false);
      await managerWithoutPersistence.restoreSessions();

      expect(mockLoadUploadSessions).not.toHaveBeenCalled();
    });

    it('skips sessions when files are missing and logs restore errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const persistedSessions = new Map([
        [
          'file-missing',
          {
            uploadId: 'upload-missing',
            fileId: 'file-missing',
            fileUri: 'file:///missing.txt',
            descriptor: {
              id: 'file-missing',
              name: 'missing.txt',
              size: 100,
              type: 'text/plain',
            },
            totalChunks: 1,
            chunkSize: 1024,
            uploadedChunks: [],
            uploadedBytes: 0,
            status: 'uploading',
            createdAt: new Date().toISOString(),
          },
        ],
      ]);

      mockLoadUploadSessions
        .mockResolvedValueOnce(persistedSessions)
        .mockRejectedValueOnce(new Error('restore failed'));
      mockGetInfoAsync.mockResolvedValueOnce({ exists: false, size: 0 } as FileSystem.FileInfo);

      await manager.restoreSessions();
      await manager.restoreSessions();

      expect(mockGetInfoAsync).toHaveBeenCalledWith('file:///missing.txt');
      expect(callbacks.onStatusChange).not.toHaveBeenCalledWith('file-missing', 'uploading');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to restore upload sessions:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('chunk processing', () => {
    const descriptor: UploadFileDescriptor = {
      id: 'file-queued',
      name: 'queued.txt',
      size: 4,
      type: 'text/plain',
      uri: 'file:///queued.txt',
    };

    beforeEach(() => {
      mockGetInfoAsync.mockResolvedValue({
        exists: true,
        size: descriptor.size,
      } as FileSystem.FileInfo);
      mockComputeFileHash.mockResolvedValue('hash-1');
      mockInitiateUpload.mockResolvedValue({
        uploadId: 'upload-1',
        chunkSize: 1024 * 1024,
        totalChunks: 1,
      });
      mockReadAsStringAsync.mockResolvedValue(Buffer.from('test').toString('base64'));
    });

    const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

    it('uploads chunk and finalizes', async () => {
      mockUploadChunk.mockResolvedValue({
        success: true,
        uploadId: 'upload-1',
        chunkIndex: 0,
      });
      mockFinalizeUpload.mockResolvedValue({
        success: true,
        uploadId: 'upload-1',
        fileId: 'file-final',
      });

      await manager.startUpload(descriptor.uri, descriptor);
      await flushAsync();

      expect(mockUploadChunk).toHaveBeenCalledWith(
        expect.objectContaining({ uploadId: 'upload-1', chunkIndex: 0 }),
        expect.any(AbortSignal),
      );
      expect(mockFinalizeUpload).toHaveBeenCalledWith({ uploadId: 'upload-1' });
      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-queued', 'completed');
    });

    it('retries failed chunk uploads before succeeding', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      mockUploadChunk.mockRejectedValueOnce(new Error('temporary')).mockResolvedValue({
        success: true,
        uploadId: 'upload-1',
        chunkIndex: 0,
      });
      mockFinalizeUpload.mockResolvedValue({
        success: true,
        uploadId: 'upload-1',
        fileId: 'file-final',
      });

      await manager.startUpload(descriptor.uri, descriptor);

      // Advance retry delay and flush promise queue
      await jest.runAllTimersAsync();
      await flushAsync();

      expect(mockUploadChunk).toHaveBeenCalledTimes(2);
      expect(callbacks.onStatusChange).toHaveBeenCalledWith('file-queued', 'completed');
      jest.useRealTimers();
    });

    it('reports finalize errors', async () => {
      mockUploadChunk.mockResolvedValue({
        success: true,
        uploadId: 'upload-1',
        chunkIndex: 0,
      });
      mockFinalizeUpload.mockRejectedValue(new Error('finalize failed'));

      await manager.startUpload(descriptor.uri, descriptor);
      await flushAsync();

      expect(callbacks.onStatusChange).toHaveBeenCalledWith(
        'file-queued',
        'error',
        'finalize failed',
      );
    });
  });

  describe('internal helpers', () => {
    const baseSession = {
      uploadId: 'internal-1',
      fileUri: 'file:///internal.txt',
      descriptor: {
        id: 'internal-1',
        name: 'internal.txt',
        size: 10,
        type: 'text/plain',
      },
      totalChunks: 1,
      chunkSize: 10,
      uploadedChunks: new Set<number>(),
      uploadedBytes: 0,
      isPaused: false,
      isCancelled: false,
      activeChunkUploads: new Set<number>(),
      retryCount: 0,
      chunkAbortControllers: new Map<number, AbortController>(),
    } as any;

    it('persists sessions and swallows persistence errors', async () => {
      mockSaveUploadSessions.mockRejectedValueOnce(new Error('persist failed'));
      (manager as any).sessions.set('internal-1', baseSession);

      await (manager as any).persistSessions();

      expect(mockSaveUploadSessions).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to persist upload sessions:',
        expect.any(Error),
      );
    });

    it('handles upload retry exhaustion', async () => {
      mockReadAsStringAsync.mockRejectedValue(new Error('read failed'));
      (manager as any).sessions.set('internal-1', {
        ...baseSession,
        chunkAbortControllers: new Map(),
      });
      await expect((manager as any).uploadChunkWithRetry('internal-1', 0, 3)).rejects.toThrow();
      expect(callbacks.onStatusChange).toHaveBeenCalledWith('internal-1', 'error', 'read failed');
    });

    it('returns early for paused processUpload', async () => {
      (manager as any).sessions.set('internal-1', { ...baseSession, isPaused: true });
      await (manager as any).processUpload('internal-1');
      expect(callbacks.onStatusChange).not.toHaveBeenCalled();
    });

    it('ignores abort errors in uploadChunkWithRetry', async () => {
      mockReadAsStringAsync.mockRejectedValue(
        Object.assign(new Error('aborted'), { name: 'AbortError' }),
      );
      const controller = new AbortController();
      (manager as any).sessions.set('internal-1', {
        ...baseSession,
        chunkAbortControllers: new Map([[0, controller]]),
        isPaused: false,
        isCancelled: false,
      });

      await (manager as any).uploadChunkWithRetry('internal-1', 0, 0).catch(() => {});
      expect(callbacks.onStatusChange).not.toHaveBeenCalled();
    });

    it('reports finalize errors for tracked sessions', async () => {
      mockFinalizeUpload.mockRejectedValue(new Error('finalize failed'));
      (manager as any).sessions.set('finalize-1', {
        uploadId: 'upload-final',
        descriptor: { id: 'finalize-1', name: 'file.txt', size: 10, type: 'text/plain' },
        isCancelled: false,
      });

      await (manager as any).finalizeUpload('finalize-1');

      expect(callbacks.onStatusChange).toHaveBeenCalledWith(
        'finalize-1',
        'error',
        'finalize failed',
      );
    });
  });
});
