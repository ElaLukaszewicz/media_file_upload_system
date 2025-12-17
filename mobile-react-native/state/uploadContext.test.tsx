import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { UploadProvider, useUploadContext } from './uploadContext';
import { ChunkedUploadManager } from '../utils/uploadManager';
import {
  loadUploadState,
  loadFileUriMap,
  saveUploadState,
  saveFileUriMap,
} from '../utils/uploadStatePersistence';
import { updateUploadHistoryFromCompletedItems } from '../utils/uploadHistory';
import type { UploadFileDescriptor, UploadState } from '../../shared/uploadState';

jest.mock('../utils/uploadManager');
jest.mock('../utils/uploadStatePersistence');
jest.mock('../utils/uploadHistory');
jest.mock('../services/backgroundUploadService', () => ({
  initializeBackgroundUploadService: jest.fn().mockResolvedValue(undefined),
  registerBackgroundUploadTask: jest.fn().mockResolvedValue(undefined),
  unregisterBackgroundUploadTask: jest.fn().mockResolvedValue(undefined),
}));

const mockLoadUploadState = loadUploadState as jest.MockedFunction<typeof loadUploadState>;
const mockLoadFileUriMap = loadFileUriMap as jest.MockedFunction<typeof loadFileUriMap>;
const mockSaveUploadState = saveUploadState as jest.MockedFunction<typeof saveUploadState>;
const mockSaveFileUriMap = saveFileUriMap as jest.MockedFunction<typeof saveFileUriMap>;
const mockUpdateUploadHistoryFromCompletedItems =
  updateUploadHistoryFromCompletedItems as jest.MockedFunction<
    typeof updateUploadHistoryFromCompletedItems
  >;

describe('UploadContext', () => {
  let mockUploadManager: {
    startUpload: jest.Mock;
    pause: jest.Mock;
    resume: jest.Mock;
    cancel: jest.Mock;
    reset: jest.Mock;
    restoreSessions: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUploadManager = {
      startUpload: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
      restoreSessions: jest.fn().mockResolvedValue(undefined),
    };

    (ChunkedUploadManager as jest.MockedClass<typeof ChunkedUploadManager>).mockImplementation(
      () => mockUploadManager as any,
    );

    mockLoadUploadState.mockResolvedValue(null);
    mockLoadFileUriMap.mockResolvedValue(new Map());
    mockSaveUploadState.mockResolvedValue(undefined);
    mockSaveFileUriMap.mockResolvedValue(undefined);
    mockUpdateUploadHistoryFromCompletedItems.mockResolvedValue(undefined);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UploadProvider>{children}</UploadProvider>
  );

  describe('initialization', () => {
    it('should initialize with empty state', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.state.items).toEqual([]);
        expect(result.current.state.overallPercent).toBe(0);
      });
    });

    it('should restore persisted state on initialization', async () => {
      const persistedState: UploadState = {
        items: [
          {
            file: {
              id: 'file-1',
              name: 'test.jpg',
              size: 1024,
              type: 'image/jpeg',
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

      mockLoadUploadState.mockResolvedValue(persistedState);

      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.state.items).toHaveLength(1);
        expect(result.current.state.overallPercent).toBe(50);
      });
    });

    it('should restore file URI map on initialization', async () => {
      const fileUriMap = new Map([['file-1', 'file:///path/to/file.jpg']]);
      mockLoadFileUriMap.mockResolvedValue(fileUriMap);

      renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(mockLoadFileUriMap).toHaveBeenCalled();
      });
    });
  });

  describe('enqueue', () => {
    it('should enqueue files and start uploads', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.controller).toBeDefined();
      });

      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      const fileUris = ['file:///path/to/test.jpg'];

      act(() => {
        result.current.controller.enqueue(files, fileUris);
      });

      await waitFor(() => {
        expect(mockUploadManager.startUpload).toHaveBeenCalledWith(
          'file:///path/to/test.jpg',
          files[0],
        );
      });
    });

    it('should create items with queued status', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.controller).toBeDefined();
      });

      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      act(() => {
        result.current.controller.enqueue(files);
      });

      await waitFor(() => {
        expect(result.current.state.items).toHaveLength(1);
        expect(result.current.state.items[0].status).toBe('queued');
      });
    });
  });

  describe('pause', () => {
    it('should pause an upload', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.controller).toBeDefined();
      });

      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      act(() => {
        result.current.controller.enqueue(files);
      });

      await waitFor(() => {
        expect(result.current.state.items).toHaveLength(1);
      });

      act(() => {
        result.current.controller.pause('file-1');
      });

      expect(mockUploadManager.pause).toHaveBeenCalledWith('file-1');
    });
  });

  describe('resume', () => {
    it('should resume a paused upload', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.controller).toBeDefined();
      });

      act(() => {
        result.current.controller.resume('file-1');
      });

      expect(mockUploadManager.resume).toHaveBeenCalledWith('file-1');
    });
  });

  describe('retry', () => {
    it('should reset and restart a failed upload when a URI is available', async () => {
      mockLoadFileUriMap.mockResolvedValue(new Map([['file-1', 'file:///retry.jpg']]));
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.controller).toBeDefined();
      });

      const files: UploadFileDescriptor[] = [
        { id: 'file-1', name: 'retry.jpg', size: 2048, type: 'image/jpeg' },
      ];

      act(() => {
        result.current.controller.enqueue(files);
      });

      await waitFor(() => {
        expect(result.current.state.items).toHaveLength(1);
      });

      mockUploadManager.startUpload.mockClear();

      act(() => {
        result.current.controller.retry('file-1');
      });

      await waitFor(() => {
        expect(mockUploadManager.reset).toHaveBeenCalledWith('file-1');
        expect(mockUploadManager.startUpload).toHaveBeenCalledWith('file:///retry.jpg', files[0]);
        expect(result.current.state.items[0].retries).toBe(1);
        expect(result.current.state.items[0].status).toBe('queued');
      });
    });
  });

  describe('cancel', () => {
    it('should cancel an upload', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.controller).toBeDefined();
      });

      act(() => {
        result.current.controller.cancel('file-1');
      });

      expect(mockUploadManager.cancel).toHaveBeenCalledWith('file-1');
    });
  });

  describe('clearCompleted', () => {
    it('should remove completed items', async () => {
      const persistedState: UploadState = {
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
        overallPercent: 50,
      };

      mockLoadUploadState.mockResolvedValue(persistedState);

      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.state.items).toHaveLength(2);
      });

      act(() => {
        result.current.controller.clearCompleted();
      });

      await waitFor(() => {
        expect(result.current.state.items).toHaveLength(1);
        expect(result.current.state.items[0].file.id).toBe('file-2');
      });
    });
  });

  describe('progress updates', () => {
    it('should update progress when manager calls onProgress', async () => {
      let progressCallback: (uploadId: string, uploadedBytes: number, totalBytes: number) => void;

      (ChunkedUploadManager as jest.MockedClass<typeof ChunkedUploadManager>).mockImplementation(
        (callbacks) => {
          progressCallback = callbacks.onProgress;
          return mockUploadManager as any;
        },
      );

      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.controller).toBeDefined();
      });

      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      act(() => {
        result.current.controller.enqueue(files);
      });

      await waitFor(() => {
        expect(result.current.state.items).toHaveLength(1);
      });

      act(() => {
        progressCallback!('file-1', 512, 1024);
      });

      // Wait for debounce
      await waitFor(
        () => {
          expect(result.current.state.items[0].progress.uploadedBytes).toBe(512);
        },
        { timeout: 200 },
      );
    });
  });

  describe('status changes', () => {
    it('should update status when manager calls onStatusChange', async () => {
      let statusCallback: (
        uploadId: string,
        status: 'queued' | 'uploading' | 'paused' | 'error' | 'completed',
        errorMessage?: string,
      ) => void;

      (ChunkedUploadManager as jest.MockedClass<typeof ChunkedUploadManager>).mockImplementation(
        (callbacks) => {
          statusCallback = callbacks.onStatusChange;
          return mockUploadManager as any;
        },
      );

      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.controller).toBeDefined();
      });

      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      act(() => {
        result.current.controller.enqueue(files);
      });

      await waitFor(() => {
        expect(result.current.state.items).toHaveLength(1);
      });

      act(() => {
        statusCallback!('file-1', 'uploading');
      });

      await waitFor(() => {
        expect(result.current.state.items[0].status).toBe('uploading');
      });
    });

    it('should handle completed status and update history', async () => {
      let statusCallback: (
        uploadId: string,
        status: 'queued' | 'uploading' | 'paused' | 'error' | 'completed',
        errorMessage?: string,
      ) => void;

      (ChunkedUploadManager as jest.MockedClass<typeof ChunkedUploadManager>).mockImplementation(
        (callbacks) => {
          statusCallback = callbacks.onStatusChange;
          return mockUploadManager as any;
        },
      );

      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.controller).toBeDefined();
      });

      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      act(() => {
        result.current.controller.enqueue(files);
      });

      await waitFor(() => {
        expect(result.current.state.items).toHaveLength(1);
      });

      act(() => {
        statusCallback!('file-1', 'completed');
      });

      await waitFor(() => {
        expect(mockUpdateUploadHistoryFromCompletedItems).toHaveBeenCalled();
      });
    });

    it('clears pending progress updates when status changes with an error', async () => {
      let statusCallback: (
        uploadId: string,
        status: 'queued' | 'uploading' | 'paused' | 'error' | 'completed',
        errorMessage?: string,
      ) => void;
      let progressCallback: (uploadId: string, uploadedBytes: number, totalBytes: number) => void;

      (ChunkedUploadManager as jest.MockedClass<typeof ChunkedUploadManager>).mockImplementation(
        (callbacks) => {
          progressCallback = callbacks.onProgress;
          statusCallback = callbacks.onStatusChange;
          return mockUploadManager as any;
        },
      );

      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.controller).toBeDefined();
      });

      const files: UploadFileDescriptor[] = [
        { id: 'file-1', name: 'test.jpg', size: 1024, type: 'image/jpeg' },
      ];

      act(() => {
        result.current.controller.enqueue(files);
      });

      await waitFor(() => {
        expect(result.current.state.items).toHaveLength(1);
      });

      act(() => {
        progressCallback!('file-1', 512, 1024);
      });

      act(() => {
        statusCallback!('file-1', 'error', 'boom');
      });

      await waitFor(() => {
        expect(result.current.state.items[0].status).toBe('error');
        expect(result.current.state.items[0].progress.uploadedBytes).toBe(0);
      });
    });
  });

  describe('app state changes', () => {
    it('should handle app state changes', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.controller).toBeDefined();
      });

      // Simulate app going to background
      act(() => {
        const event = { currentTarget: AppState, target: AppState };
        AppState.emit('change', 'background');
      });

      // Should persist state
      await waitFor(() => {
        expect(mockSaveUploadState).toHaveBeenCalled();
      });
    });

    it('restores sessions and resumes uploads when returning to foreground', async () => {
      mockLoadFileUriMap.mockResolvedValue(new Map([['file-1', 'file:///path/to/test.jpg']]));
      const persistedState: UploadState = {
        items: [
          {
            file: { id: 'file-1', name: 'test.jpg', size: 1024, type: 'image/jpeg' },
            status: 'uploading',
            progress: { uploadedBytes: 256, totalBytes: 1024, percent: 25 },
            retries: 0,
          },
        ],
        overallPercent: 25,
      };
      mockLoadUploadState.mockResolvedValue(persistedState);

      const { result } = renderHook(() => useUploadContext(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.state.items).toHaveLength(1);
        },
        { timeout: 2000 },
      );

      act(() => {
        AppState.emit('change', 'background');
      });

      act(() => {
        AppState.emit('change', 'active');
      });

      await waitFor(() => {
        expect(mockUploadManager.restoreSessions).toHaveBeenCalled();
        expect(mockUploadManager.resume).toHaveBeenCalledWith('file-1');
      });
    });
  });

  describe('useUploadContext guard', () => {
    it('throws when used outside provider', () => {
      expect(() => renderHook(() => useUploadContext())).toThrow(
        'useUploadContext must be used within UploadProvider',
      );
    });
  });
});
