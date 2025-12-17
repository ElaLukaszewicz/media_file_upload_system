import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveUploadState,
  loadUploadState,
  saveFileUriMap,
  loadFileUriMap,
  clearUploadState,
  saveUploadSessions,
  loadUploadSessions,
  clearUploadSessions,
  type PersistedUploadState,
  type PersistedUploadSession,
} from './uploadStatePersistence';
import type { UploadState, UploadItem } from '../../shared/uploadState';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('uploadStatePersistence', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('saveUploadState', () => {
    it('should save upload state with debounce', async () => {
      const state: UploadState = {
        items: [
          {
            file: {
              id: 'file-1',
              name: 'test.jpg',
              size: 1024,
              type: 'image/jpeg',
              uri: 'file:///path/to/test.jpg',
            },
            status: 'uploading',
            progress: {
              uploadedBytes: 512,
              totalBytes: 1024,
              percent: 50,
            },
            retries: 0,
          },
        ],
        overallPercent: 50,
      };

      const savePromise = saveUploadState(state);

      // Should not save immediately
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      await savePromise;

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'uploadState',
        expect.stringContaining('"items"'),
      );
    });

    it('should debounce multiple rapid saves', async () => {
      const state1: UploadState = {
        items: [],
        overallPercent: 0,
      };
      const state2: UploadState = {
        items: [],
        overallPercent: 50,
      };

      saveUploadState(state1);
      saveUploadState(state2);

      jest.advanceTimersByTime(1000);

      // Should only save once (the last one)
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    });

    it('should handle save errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      const state: UploadState = {
        items: [],
        overallPercent: 0,
      };

      const savePromise = saveUploadState(state);
      jest.advanceTimersByTime(1000);

      await expect(savePromise).resolves.not.toThrow();
    });
  });

  describe('loadUploadState', () => {
    it('should load valid upload state', async () => {
      const persisted: PersistedUploadState = {
        items: [
          {
            file: {
              id: 'file-1',
              name: 'test.jpg',
              size: 1024,
              type: 'image/jpeg',
              uri: 'file:///path/to/test.jpg',
            },
            status: 'uploading',
            progress: {
              uploadedBytes: 512,
              totalBytes: 1024,
              percent: 50,
            },
            retries: 0,
          },
        ],
        overallPercent: 50,
        timestamp: new Date().toISOString(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(persisted));

      const state = await loadUploadState();

      expect(state).toEqual({
        items: persisted.items,
        overallPercent: 50,
      });
    });

    it('should filter out completed items', async () => {
      const persisted: PersistedUploadState = {
        items: [
          {
            file: {
              id: 'file-1',
              name: 'test.jpg',
              size: 1024,
              type: 'image/jpeg',
            },
            status: 'completed',
            progress: {
              uploadedBytes: 1024,
              totalBytes: 1024,
              percent: 100,
            },
            retries: 0,
          },
          {
            file: {
              id: 'file-2',
              name: 'test2.jpg',
              size: 2048,
              type: 'image/jpeg',
            },
            status: 'uploading',
            progress: {
              uploadedBytes: 1024,
              totalBytes: 2048,
              percent: 50,
            },
            retries: 0,
          },
        ],
        overallPercent: 75,
        timestamp: new Date().toISOString(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(persisted));

      const state = await loadUploadState();

      expect(state?.items).toHaveLength(1);
      expect(state?.items[0].file.id).toBe('file-2');
    });

    it('should return null when storage is empty', async () => {
      const state = await loadUploadState();
      expect(state).toBeNull();
    });

    it('should return null when all items are completed', async () => {
      const persisted: PersistedUploadState = {
        items: [
          {
            file: {
              id: 'file-1',
              name: 'test.jpg',
              size: 1024,
              type: 'image/jpeg',
            },
            status: 'completed',
            progress: {
              uploadedBytes: 1024,
              totalBytes: 1024,
              percent: 100,
            },
            retries: 0,
          },
        ],
        overallPercent: 100,
        timestamp: new Date().toISOString(),
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(persisted));

      const state = await loadUploadState();
      expect(state).toBeNull();
    });

    it('should handle parse errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid-json');

      const state = await loadUploadState();
      expect(state).toBeNull();
    });
  });

  describe('saveFileUriMap and loadFileUriMap', () => {
    it('should save and load file URI map', async () => {
      const fileUriMap = new Map<string, string>();
      fileUriMap.set('file-1', 'file:///path/to/file1.jpg');
      fileUriMap.set('file-2', 'file:///path/to/file2.jpg');

      const savePromise = saveFileUriMap(fileUriMap);
      jest.advanceTimersByTime(1000);
      await savePromise;

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'uploadFileUriMap',
        JSON.stringify({
          'file-1': 'file:///path/to/file1.jpg',
          'file-2': 'file:///path/to/file2.jpg',
        }),
      );

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          'file-1': 'file:///path/to/file1.jpg',
          'file-2': 'file:///path/to/file2.jpg',
        }),
      );

      const loaded = await loadFileUriMap();

      expect(loaded).toEqual(fileUriMap);
    });

    it('should return empty map when storage is empty', async () => {
      const loaded = await loadFileUriMap();
      expect(loaded).toEqual(new Map());
    });
  });

  describe('clearUploadState', () => {
    it('should clear upload state and file URI map', async () => {
      await clearUploadState();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('uploadState');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('uploadFileUriMap');
    });
  });

  describe('saveUploadSessions and loadUploadSessions', () => {
    it('should save and load upload sessions', async () => {
      const sessions = new Map<string, PersistedUploadSession>();
      sessions.set('file-1', {
        uploadId: 'upload-123',
        fileId: 'file-1',
        fileUri: 'file:///path/to/file1.jpg',
        descriptor: {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
        totalChunks: 1,
        chunkSize: 1024,
        uploadedChunks: [0],
        uploadedBytes: 1024,
        fileHash: 'abc123',
        status: 'uploading',
        createdAt: new Date().toISOString(),
      });

      await saveUploadSessions(sessions);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'uploadSessions',
        expect.stringContaining('file-1'),
      );

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          'file-1': {
            uploadId: 'upload-123',
            fileId: 'file-1',
            fileUri: 'file:///path/to/file1.jpg',
            descriptor: {
              id: 'file-1',
              name: 'test.jpg',
              size: 1024,
              type: 'image/jpeg',
            },
            totalChunks: 1,
            chunkSize: 1024,
            uploadedChunks: [0],
            uploadedBytes: 1024,
            fileHash: 'abc123',
            status: 'uploading',
            createdAt: new Date().toISOString(),
          },
        }),
      );

      const loaded = await loadUploadSessions();

      expect(loaded).toHaveProperty('file-1');
      expect(loaded.get('file-1')?.uploadId).toBe('upload-123');
    });

    it('should clean up expired sessions', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25); // 25 hours ago

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({
          'file-1': {
            uploadId: 'upload-123',
            fileId: 'file-1',
            fileUri: 'file:///path/to/file1.jpg',
            descriptor: {
              id: 'file-1',
              name: 'test.jpg',
              size: 1024,
              type: 'image/jpeg',
            },
            totalChunks: 1,
            chunkSize: 1024,
            uploadedChunks: [0],
            uploadedBytes: 1024,
            status: 'uploading',
            createdAt: oldDate.toISOString(),
          },
        }),
      );

      const loaded = await loadUploadSessions();

      // Expired session should be removed
      expect(loaded.size).toBe(0);
    });

    it('should return empty map when storage is empty', async () => {
      const loaded = await loadUploadSessions();
      expect(loaded).toEqual(new Map());
    });
  });

  describe('clearUploadSessions', () => {
    it('should clear upload sessions', async () => {
      await clearUploadSessions();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('uploadSessions');
    });
  });
});
