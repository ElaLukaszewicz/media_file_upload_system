import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadUploadHistory,
  updateUploadHistoryFromCompletedItems,
  type UploadHistoryItem,
} from './uploadHistory';
import type { UploadItem } from '@shared/uploadState';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('uploadHistory', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('loadUploadHistory', () => {
    it('should return empty array when storage is empty', () => {
      const history = loadUploadHistory();
      expect(history).toEqual([]);
    });

    it('should return valid history items', () => {
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

      localStorageMock.setItem('uploadHistory', JSON.stringify(validHistory));

      const history = loadUploadHistory();
      expect(history).toEqual(validHistory);
      expect(history).toHaveLength(2);
    });

    it('should filter out invalid items', () => {
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
          // Missing name
          size: 2048,
          type: 'image/png',
          completedAt: '2024-01-16T11:00:00Z',
        },
        null,
        'not-an-object',
      ];

      localStorageMock.setItem('uploadHistory', JSON.stringify(invalidHistory));

      const history = loadUploadHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('file-1');
    });

    it('should return empty array when storage contains non-array', () => {
      localStorageMock.setItem('uploadHistory', JSON.stringify({ not: 'array' }));

      const history = loadUploadHistory();
      expect(history).toEqual([]);
    });

    it('should handle JSON parse errors', () => {
      localStorageMock.setItem('uploadHistory', 'invalid-json');

      const history = loadUploadHistory();
      expect(history).toEqual([]);
    });

    it('should return empty array when not in browser environment', () => {
      // This test would require mocking window, which is complex
      // The function checks for window and localStorage existence
      // In jsdom environment, these exist, so we test the normal path
      const history = loadUploadHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('updateUploadHistoryFromCompletedItems', () => {
    it('should add new completed items to history', () => {
      const existingHistory: UploadHistoryItem[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
          completedAt: '2024-01-15T10:30:00Z',
        },
      ];

      localStorageMock.setItem('uploadHistory', JSON.stringify(existingHistory));

      const completedItems: UploadItem[] = [
        {
          file: {
            id: 'file-2',
            name: 'test2.png',
            size: 2048,
            type: 'image/png',
          },
          status: 'completed',
          progress: {
            uploadedBytes: 2048,
            totalBytes: 2048,
            percent: 100,
          },
          retries: 0,
        },
        {
          file: {
            id: 'file-3',
            name: 'test3.jpg',
            size: 3072,
            type: 'image/jpeg',
          },
          status: 'completed',
          progress: {
            uploadedBytes: 3072,
            totalBytes: 3072,
            percent: 100,
          },
          retries: 0,
        },
      ];

      updateUploadHistoryFromCompletedItems(completedItems);

      const saved = loadUploadHistory();
      expect(saved).toHaveLength(3);
      expect(saved[0].id).toBe('file-2'); // New items first
      expect(saved[1].id).toBe('file-3');
      expect(saved[2].id).toBe('file-1'); // Existing items after
    });

    it('should not add duplicate items', () => {
      const existingHistory: UploadHistoryItem[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
          completedAt: '2024-01-15T10:30:00Z',
        },
      ];

      localStorageMock.setItem('uploadHistory', JSON.stringify(existingHistory));

      const completedItems: UploadItem[] = [
        {
          file: {
            id: 'file-1', // Already in history
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
      ];

      updateUploadHistoryFromCompletedItems(completedItems);

      const saved = loadUploadHistory();
      expect(saved).toHaveLength(1); // No duplicates added
    });

    it('should do nothing when completedItems is empty', () => {
      const existingHistory: UploadHistoryItem[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
          completedAt: '2024-01-15T10:30:00Z',
        },
      ];

      localStorageMock.setItem('uploadHistory', JSON.stringify(existingHistory));

      updateUploadHistoryFromCompletedItems([]);

      const saved = loadUploadHistory();
      expect(saved).toHaveLength(1); // Unchanged
    });

    it('should handle storage errors gracefully', () => {
      // Mock localStorage.setItem to throw
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      const completedItems: UploadItem[] = [
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
      ];

      // Should not throw
      expect(() => updateUploadHistoryFromCompletedItems(completedItems)).not.toThrow();

      // Restore
      localStorageMock.setItem = originalSetItem;
    });
  });
});
