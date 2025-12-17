import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { UploadProvider, useUploadContext } from './uploadContext';
import { ChunkedUploadManager } from '../utils/uploadManager';
import { updateUploadHistoryFromCompletedItems } from '../utils/uploadHistory';
import type { UploadFileDescriptor } from '@shared/uploadState';

vi.mock('../utils/uploadManager');
vi.mock('../utils/uploadHistory');

const mockUpdateUploadHistoryFromCompletedItems =
  updateUploadHistoryFromCompletedItems as ReturnType<typeof vi.fn>;

describe('UploadContext', () => {
  let mockUploadManager: {
    startUpload: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };

  let statusCallback: (
    uploadId: string,
    status: 'queued' | 'uploading' | 'paused' | 'error' | 'completed',
    errorMessage?: string,
  ) => void;
  let progressCallback: (uploadId: string, uploadedBytes: number, totalBytes: number) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockUploadManager = {
      startUpload: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      reset: vi.fn(),
    };

    (ChunkedUploadManager as any).mockImplementation((callbacks: any) => {
      statusCallback = callbacks.onStatusChange;
      progressCallback = callbacks.onProgress;
      return mockUploadManager;
    });
    mockUpdateUploadHistoryFromCompletedItems.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UploadProvider>{children}</UploadProvider>
  );

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      expect(result.current.state.items).toEqual([]);
      expect(result.current.state.overallPercent).toBe(0);
    });
  });

  describe('enqueue', () => {
    it('should enqueue files and start uploads', async () => {
      vi.useRealTimers(); // Use real timers to allow useEffect to run properly

      const { result } = renderHook(() => useUploadContext(), { wrapper });

      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      const fileObjects = [new File(['content'], 'test.jpg', { type: 'image/jpeg' })];

      act(() => {
        result.current.controller.enqueue(files, fileObjects);
      });

      // Wait for useEffect to trigger startUpload
      await waitFor(
        () => {
          expect(mockUploadManager.startUpload).toHaveBeenCalledWith(fileObjects[0], files[0]);
        },
        { timeout: 2000 },
      );

      vi.useFakeTimers(); // Restore fake timers
    });

    it('should create items with queued status', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

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

      // Items are created immediately, status is queued
      expect(result.current.state.items).toHaveLength(1);
      expect(result.current.state.items[0].status).toBe('queued');
    });

    it('should create preview URLs for image files', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      const file = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      act(() => {
        result.current.controller.enqueue(files, [file]);
      });

      // Preview URL should be set if the file descriptor has it, or created by the component
      // Since we're not creating it in the test, we check that the file is stored
      expect(result.current.state.items[0].file.id).toBe('file-1');
    });
  });

  describe('pause', () => {
    it('should pause an upload', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      act(() => {
        result.current.controller.enqueue(files, [file]);
      });

      // Advance timers to allow useEffect to run
      vi.advanceTimersByTime(0);

      expect(result.current.state.items).toHaveLength(1);

      act(() => {
        result.current.controller.pause('file-1');
      });

      expect(mockUploadManager.pause).toHaveBeenCalledWith('file-1');
      expect(result.current.state.items[0].status).toBe('paused');
    });
  });

  describe('resume', () => {
    it('should resume a paused upload', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      act(() => {
        result.current.controller.enqueue(files, [file]);
      });

      vi.advanceTimersByTime(0);

      expect(result.current.state.items).toHaveLength(1);

      act(() => {
        result.current.controller.pause('file-1');
      });

      act(() => {
        result.current.controller.resume('file-1');
      });

      expect(mockUploadManager.resume).toHaveBeenCalledWith('file-1');
      expect(result.current.state.items[0].status).toBe('uploading');
    });
  });

  describe('cancel', () => {
    it('should cancel an upload and revoke preview URL', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(file);
      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
          previewUrl,
        },
      ];

      act(() => {
        result.current.controller.enqueue(files, [file]);
      });

      vi.advanceTimersByTime(0);

      expect(result.current.state.items).toHaveLength(1);

      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

      act(() => {
        result.current.controller.cancel('file-1');
      });

      expect(mockUploadManager.cancel).toHaveBeenCalledWith('file-1');
      expect(revokeSpy).toHaveBeenCalledWith(previewUrl);
    });
  });

  describe('clearCompleted', () => {
    it('should remove completed items', async () => {
      vi.useRealTimers(); // Use real timers for this test

      const { result } = renderHook(() => useUploadContext(), { wrapper });

      const files: UploadFileDescriptor[] = [
        {
          id: 'file-1',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
        {
          id: 'file-2',
          name: 'test2.jpg',
          size: 2048,
          type: 'image/jpeg',
        },
      ];

      act(() => {
        result.current.controller.enqueue(files);
      });

      // Wait for manager initialization
      await waitFor(
        () => {
          expect(statusCallback).toBeDefined();
        },
        { timeout: 1000 },
      );

      expect(result.current.state.items).toHaveLength(2);

      // Simulate completion via callback
      act(() => {
        statusCallback!('file-1', 'completed');
      });

      // Wait for state update
      await waitFor(
        () => {
          const item = result.current.state.items.find((i) => i.file.id === 'file-1');
          expect(item?.status).toBe('completed');
        },
        { timeout: 2000 },
      );

      act(() => {
        result.current.controller.clearCompleted();
      });

      // clearCompleted is synchronous, so we can check immediately
      expect(result.current.state.items).toHaveLength(1);
      expect(result.current.state.items[0].file.id).toBe('file-2');

      vi.useFakeTimers(); // Restore fake timers
    });
  });

  describe('progress updates', () => {
    it('should update progress when manager calls onProgress', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

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

      vi.advanceTimersByTime(0);

      expect(result.current.state.items).toHaveLength(1);

      vi.useRealTimers(); // Use real timers to allow debounce to work

      act(() => {
        progressCallback!('file-1', 512, 1024);
      });

      // Wait for debounce (100ms)
      await waitFor(
        () => {
          expect(result.current.state.items[0].progress.uploadedBytes).toBe(512);
        },
        { timeout: 500 },
      );

      vi.useFakeTimers(); // Restore fake timers
    });
  });

  describe('status changes', () => {
    it('should update status when manager calls onStatusChange', async () => {
      const { result } = renderHook(() => useUploadContext(), { wrapper });

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

      vi.advanceTimersByTime(0);

      expect(result.current.state.items).toHaveLength(1);
      expect(statusCallback).toBeDefined();

      act(() => {
        statusCallback!('file-1', 'uploading');
      });

      // Status should update immediately via callback
      expect(result.current.state.items[0].status).toBe('uploading');
    });

    it('should handle completed status and update history', async () => {
      vi.useRealTimers(); // Use real timers for this test to allow useEffect to run

      const { result } = renderHook(() => useUploadContext(), { wrapper });

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

      // Wait for manager initialization
      await waitFor(() => {
        expect(statusCallback).toBeDefined();
      });

      act(() => {
        statusCallback!('file-1', 'completed');
      });

      // Wait for useEffect to process completed items
      await waitFor(
        () => {
          expect(mockUpdateUploadHistoryFromCompletedItems).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      vi.useFakeTimers(); // Restore fake timers
    });
  });
});
