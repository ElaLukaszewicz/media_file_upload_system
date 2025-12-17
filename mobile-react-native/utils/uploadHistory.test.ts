import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadUploadHistory,
  cleanupHistory,
  updateUploadHistoryFromCompletedItems,
  type UploadHistoryItem,
} from './uploadHistory';
import type { UploadItem } from '../../shared/uploadState';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const STORAGE_KEY = 'uploadHistory';

describe('uploadHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('loadUploadHistory', () => {
    it('should return empty array when storage is empty', async () => {
      const history = await loadUploadHistory();
      expect(history).toEqual([]);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should return valid history items', async () => {
      const validHistory: UploadHistoryItem[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
          completedAt: '2024-01-15T10:30:00Z',
        },
        {
          id: 'file-2',
          name: 'test2.png',
          size: 2048,
          type: 'image/png',
          completedAt: '2024-01-16T11:00:00Z',
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(validHistory));

      const history = await loadUploadHistory();
      expect(history).toEqual(validHistory);
      expect(history).toHaveLength(2);
    });

    it('should filter out invalid items', async () => {
      const invalidHistory = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
          completedAt: '2024-01-15T10:30:00Z',
        },
        {
          id: 'file-2',
          name: 'test2.png',
          // Missing size
          type: 'image/png',
          completedAt: '2024-01-16T11:00:00Z',
        },
        {
          id: 'file-3',
          name: 'test3.jpg',
          size: 0, // Invalid size
          type: 'image/jpeg',
          completedAt: '2024-01-17T12:00:00Z',
        },
        {
          id: 'file-4',
          name: 'test4.jpg',
          size: 1024,
          type: 'image/jpeg',
          completedAt: 'invalid-date', // Invalid date
        },
        null,
        'not-an-object',
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(invalidHistory));

      const history = await loadUploadHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('file-1');
    });

    it('should return empty array when storage contains non-array', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ not: 'array' }));

      const history = await loadUploadHistory();
      expect(history).toEqual([]);
    });

    it('should handle JSON parse errors', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid-json');

      const history = await loadUploadHistory();
      expect(history).toEqual([]);
    });

    it('should handle storage errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const history = await loadUploadHistory();
      expect(history).toEqual([]);
    });
  });

  describe('cleanupHistory', () => {
    it('should save filtered history back to storage', async () => {
      const validHistory: UploadHistoryItem[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
          completedAt: '2024-01-15T10:30:00Z',
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(validHistory));

      await cleanupHistory();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(validHistory));
    });

    it('should handle errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(cleanupHistory()).resolves.not.toThrow();
    });
  });

  describe('updateUploadHistoryFromCompletedItems', () => {
    it('should add new completed items to history', async () => {
      const existingHistory: UploadHistoryItem[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
          completedAt: '2024-01-15T10:30:00Z',
        },
      ];

      const completedItems: UploadItem[] = [
        {
          file: {
            id: 'file-2',
            name: 'test2.png',
            size: 2048,
            type: 'image/png',
            uri: 'file:///path/to/test2.png',
          },
          status: 'completed',
          progress: 100,
        },
        {
          file: {
            id: 'file-3',
            name: 'test3.jpg',
            size: 3072,
            type: 'image/jpeg',
            uri: 'file:///path/to/test3.jpg',
          },
          status: 'completed',
          progress: 100,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingHistory));

      await updateUploadHistoryFromCompletedItems(completedItems);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedHistory: UploadHistoryItem[] = JSON.parse(callArgs[1]);

      expect(savedHistory).toHaveLength(3);
      expect(savedHistory[0].id).toBe('file-2'); // New items first
      expect(savedHistory[1].id).toBe('file-3');
      expect(savedHistory[2].id).toBe('file-1'); // Existing items after
    });

    it('should not add duplicate items', async () => {
      const existingHistory: UploadHistoryItem[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
          completedAt: '2024-01-15T10:30:00Z',
        },
      ];

      const completedItems: UploadItem[] = [
        {
          file: {
            id: 'file-1', // Already in history
            name: 'test.jpg',
            size: 1024,
            type: 'image/jpeg',
            uri: 'file:///path/to/test.jpg',
          },
          status: 'completed',
          progress: 100,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingHistory));

      await updateUploadHistoryFromCompletedItems(completedItems);

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedHistory: UploadHistoryItem[] = JSON.parse(callArgs[1]);

      expect(savedHistory).toHaveLength(1); // No duplicates added
    });

    it('should do nothing when completedItems is empty', async () => {
      await updateUploadHistoryFromCompletedItems([]);

      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      const completedItems: UploadItem[] = [
        {
          file: {
            id: 'file-1',
            name: 'test.jpg',
            size: 1024,
            type: 'image/jpeg',
            uri: 'file:///path/to/test.jpg',
          },
          status: 'completed',
          progress: 100,
        },
      ];

      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(updateUploadHistoryFromCompletedItems(completedItems)).resolves.not.toThrow();
    });
  });
});
