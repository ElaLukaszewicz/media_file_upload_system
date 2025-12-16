import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  UploadController,
  UploadFileDescriptor,
  UploadItem,
  UploadState,
} from '@shared/uploadState';
import { ChunkedUploadManager } from '../utils/uploadManager';
import { updateUploadHistoryFromCompletedItems } from '../utils/uploadHistory';

interface ExtendedUploadController extends UploadController {
  enqueue(files: UploadFileDescriptor[], fileObjects?: File[]): void;
}

interface UploadContextValue {
  state: UploadState;
  controller: ExtendedUploadController;
}

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

const initialState: UploadState = {
  overallPercent: 0,
  items: [],
};

function computeOverallPercent(items: UploadItem[]): number {
  if (!items.length) return 0;
  const total = items.reduce((acc, item) => acc + item.progress.totalBytes, 0);
  const uploaded = items.reduce((acc, item) => acc + item.progress.uploadedBytes, 0);
  return Math.min(100, Math.round((uploaded / total) * 100));
}

// Debounce progress updates to avoid excessive re-renders
const PROGRESS_DEBOUNCE_MS = 100;

export function UploadProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UploadState>(initialState);
  const fileMapRef = useRef<Map<string, File>>(new Map());
  const previewUrlMapRef = useRef<Map<string, string>>(new Map());
  const uploadManagerRef = useRef<ChunkedUploadManager | null>(null);
  const progressUpdateTimeoutRef = useRef<Map<string, number>>(new Map());

  // Memoize updateItem to prevent unnecessary re-renders
  const updateItem = useCallback((uploadId: string, updater: (item: UploadItem) => UploadItem) => {
    setState((current) => {
      const items = current.items.map((item) => (item.file.id === uploadId ? updater(item) : item));
      return { items, overallPercent: computeOverallPercent(items) };
    });
  }, []);

  // Cleanup object URLs when items are removed
  const revokePreviewUrl = (uploadId: string) => {
    const previewUrl = previewUrlMapRef.current.get(uploadId);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrlMapRef.current.delete(uploadId);
    }
  };

  // Initialize upload manager
  useEffect(() => {
    uploadManagerRef.current = new ChunkedUploadManager({
      onProgress: (uploadId, uploadedBytes, totalBytes) => {
        // Debounce progress updates to reduce re-renders
        const existingTimeout = progressUpdateTimeoutRef.current.get(uploadId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeoutId = window.setTimeout(() => {
          updateItem(uploadId, (item) => ({
            ...item,
            progress: {
              uploadedBytes,
              totalBytes,
              percent: Math.round((uploadedBytes / totalBytes) * 100),
            },
          }));
          progressUpdateTimeoutRef.current.delete(uploadId);
        }, PROGRESS_DEBOUNCE_MS);

        progressUpdateTimeoutRef.current.set(uploadId, timeoutId);
      },
      onStatusChange: (uploadId, status, errorMessage) => {
        // Clear any pending progress updates when status changes
        const existingTimeout = progressUpdateTimeoutRef.current.get(uploadId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          progressUpdateTimeoutRef.current.delete(uploadId);
        }

        updateItem(uploadId, (item) => ({
          ...item,
          status,
          errorMessage,
        }));
      },
    });

    return () => {
      // Cleanup all preview URLs on unmount
      previewUrlMapRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      previewUrlMapRef.current.clear();

      // Clear any pending progress updates
      progressUpdateTimeoutRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      progressUpdateTimeoutRef.current.clear();
    };
  }, [updateItem]);

  // Auto-start queued uploads - track started uploads to prevent redundant starts
  const startedUploadsRef = useRef<Set<string>>(new Set());

  const controller = useMemo<ExtendedUploadController>(
    () => ({
      enqueue(files: UploadFileDescriptor[], fileObjects?: File[]) {
        if (!files.length) return;
        setState((current) => {
          const newItems: UploadItem[] = files.map((file, index) => {
            // Store File object if provided
            if (fileObjects && fileObjects[index]) {
              fileMapRef.current.set(file.id, fileObjects[index]);
              // Track preview URL for cleanup
              if (file.previewUrl) {
                previewUrlMapRef.current.set(file.id, file.previewUrl);
              }
            }
            return {
              file,
              status: 'queued',
              progress: { uploadedBytes: 0, totalBytes: file.size, percent: 0 },
              retries: 0,
            };
          });
          const items = [...current.items, ...newItems];
          return { items, overallPercent: computeOverallPercent(items) };
        });
      },
      pause(uploadId: string) {
        uploadManagerRef.current?.pause(uploadId);
        updateItem(uploadId, (item) => ({
          ...item,
          status: 'paused',
        }));
      },
      resume(uploadId: string) {
        const file = fileMapRef.current.get(uploadId);
        if (file && uploadManagerRef.current) {
          uploadManagerRef.current.resume(uploadId);
          startedUploadsRef.current.add(uploadId);
        }
        updateItem(uploadId, (item) => ({
          ...item,
          status: 'uploading',
          errorMessage: undefined,
        }));
      },
      cancel(uploadId: string) {
        uploadManagerRef.current?.cancel(uploadId);
        fileMapRef.current.delete(uploadId);
        startedUploadsRef.current.delete(uploadId);
        revokePreviewUrl(uploadId);
        setState((current) => {
          const items = current.items.filter((item) => item.file.id !== uploadId);
          return { items, overallPercent: computeOverallPercent(items) };
        });
      },
      retry(uploadId: string) {
        const file = fileMapRef.current.get(uploadId);
        const uploadManager = uploadManagerRef.current;
        if (file && uploadManager) {
          // Reset the session in upload manager to allow restart
          uploadManager.reset(uploadId);
          startedUploadsRef.current.delete(uploadId);
          setState((current) => {
            const item = current.items.find((i) => i.file.id === uploadId);
            if (!item) return current;

            const items = current.items.map((i) =>
              i.file.id === uploadId
                ? {
                    ...i,
                    status: 'queued' as const,
                    errorMessage: undefined,
                    retries: i.retries + 1,
                    progress: { uploadedBytes: 0, totalBytes: i.file.size, percent: 0 },
                  }
                : i,
            );
            const updatedItem = items.find((i) => i.file.id === uploadId);

            // Restart upload using the updated item from current state
            if (updatedItem) {
              startedUploadsRef.current.add(uploadId);
              uploadManager.startUpload(file, updatedItem.file).catch(() => {
                // Error handling done in upload manager
                startedUploadsRef.current.delete(uploadId);
              });
            }

            return { items, overallPercent: computeOverallPercent(items) };
          });
        }
      },
      clearCompleted() {
        setState((current) => {
          const items = current.items.filter((item) => {
            if (item.status === 'completed') {
              fileMapRef.current.delete(item.file.id);
              revokePreviewUrl(item.file.id);
              return false;
            }
            return true;
          });
          return { items, overallPercent: computeOverallPercent(items) };
        });
      },
    }),
    // Don't include state.items - controller methods should be stable
    // Only recreate if uploadManager changes (which it doesn't after mount)
    [],
  );

  // Auto-start queued uploads
  useEffect(() => {
    const uploadManager = uploadManagerRef.current;
    if (!uploadManager) return;

    const queuedItems = state.items.filter((item) => item.status === 'queued');
    const queuedIds = new Set(queuedItems.map((item) => item.file.id));

    queuedItems.forEach((item) => {
      // Only start if not already started
      if (!startedUploadsRef.current.has(item.file.id)) {
        const file = fileMapRef.current.get(item.file.id);
        if (file) {
          startedUploadsRef.current.add(item.file.id);
          // Start upload - upload manager will check if session already exists
          uploadManager.startUpload(file, item.file).catch(() => {
            // Error handling done in upload manager
            startedUploadsRef.current.delete(item.file.id);
          });
        }
      }
    });

    // Clean up startedUploadsRef for items no longer queued or in state
    const currentIds = new Set(state.items.map((item) => item.file.id));
    startedUploadsRef.current.forEach((id) => {
      if (!currentIds.has(id) || !queuedIds.has(id)) {
        startedUploadsRef.current.delete(id);
      }
    });
  }, [state.items]);

  // Persist completed uploads to local storage for history
  useEffect(() => {
    const completedItems = state.items.filter((item) => item.status === 'completed');
    if (completedItems.length) {
      updateUploadHistoryFromCompletedItems(completedItems);
    }
  }, [state.items]);

  const value = useMemo(
    () => ({
      state,
      controller,
    }),
    [state, controller],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUploadContext(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error('useUploadContext must be used within UploadProvider');
  }
  return ctx;
}
