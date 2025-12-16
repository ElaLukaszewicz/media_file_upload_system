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
} from '../../shared/uploadState';
import { ChunkedUploadManager } from '../utils/uploadManager';
import { updateUploadHistoryFromCompletedItems } from '../utils/uploadHistory';
import { UPLOAD_CONSTANTS } from '../constants';

interface ExtendedUploadController extends UploadController {
  enqueue(files: UploadFileDescriptor[], fileUris?: string[]): void;
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

const PROGRESS_DEBOUNCE_MS = UPLOAD_CONSTANTS.PROGRESS_DEBOUNCE_MS;

export function UploadProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UploadState>(initialState);
  const fileUriMapRef = useRef<Map<string, string>>(new Map());
  const uploadManagerRef = useRef<ChunkedUploadManager | null>(null);
  const progressUpdateTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const updateItem = useCallback((uploadId: string, updater: (item: UploadItem) => UploadItem) => {
    setState((current) => {
      const items = current.items.map((item) => (item.file.id === uploadId ? updater(item) : item));
      return { items, overallPercent: computeOverallPercent(items) };
    });
  }, []);

  useEffect(() => {
    uploadManagerRef.current = new ChunkedUploadManager({
      onProgress: (uploadId, uploadedBytes, totalBytes) => {
        const existingTimeout = progressUpdateTimeoutRef.current.get(uploadId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeoutId = setTimeout(() => {
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
        const existingTimeout = progressUpdateTimeoutRef.current.get(uploadId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          progressUpdateTimeoutRef.current.delete(uploadId);
        }

        updateItem(uploadId, (item) => {
          // When status is 'completed', ensure progress is set to 100% immediately
          // This prevents race conditions where progress update is debounced
          const progress =
            status === 'completed'
              ? {
                  uploadedBytes: item.progress.totalBytes,
                  totalBytes: item.progress.totalBytes,
                  percent: 100,
                }
              : item.progress;

          return {
            ...item,
            status,
            errorMessage,
            progress,
          };
        });
      },
    });

    return () => {
      progressUpdateTimeoutRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      progressUpdateTimeoutRef.current.clear();
    };
  }, [updateItem]);

  const startedUploadsRef = useRef<Set<string>>(new Set());

  const enqueue = useCallback((files: UploadFileDescriptor[], fileUris?: string[]) => {
    if (!files.length) return;
    setState((current) => {
      const newItems: UploadItem[] = files.map((file, index) => {
        if (fileUris && fileUris[index]) {
          fileUriMapRef.current.set(file.id, fileUris[index]);
        }
        return {
          file,
          status: 'queued' as const,
          progress: { uploadedBytes: 0, totalBytes: file.size, percent: 0 },
          retries: 0,
        };
      });
      const items = [...current.items, ...newItems];
      return { items, overallPercent: computeOverallPercent(items) };
    });
  }, []);

  const pause = useCallback(
    (uploadId: string) => {
      uploadManagerRef.current?.pause(uploadId);
      updateItem(uploadId, (item) => ({
        ...item,
        status: 'paused' as const,
      }));
    },
    [updateItem],
  );

  const resume = useCallback(
    (uploadId: string) => {
      const fileUri = fileUriMapRef.current.get(uploadId);
      if (fileUri && uploadManagerRef.current) {
        uploadManagerRef.current.resume(uploadId);
        startedUploadsRef.current.add(uploadId);
      }
      updateItem(uploadId, (item) => ({
        ...item,
        status: 'uploading' as const,
        errorMessage: undefined,
      }));
    },
    [updateItem],
  );

  const cancel = useCallback((uploadId: string) => {
    uploadManagerRef.current?.cancel(uploadId);
    fileUriMapRef.current.delete(uploadId);
    startedUploadsRef.current.delete(uploadId);
    setState((current) => {
      const items = current.items.filter((item) => item.file.id !== uploadId);
      return { items, overallPercent: computeOverallPercent(items) };
    });
  }, []);

  const retry = useCallback((uploadId: string) => {
    const fileUri = fileUriMapRef.current.get(uploadId);
    const uploadManager = uploadManagerRef.current;
    if (fileUri && uploadManager) {
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

        if (updatedItem) {
          startedUploadsRef.current.add(uploadId);
          uploadManager.startUpload(fileUri, updatedItem.file).catch(() => {
            startedUploadsRef.current.delete(uploadId);
          });
        }

        return { items, overallPercent: computeOverallPercent(items) };
      });
    }
  }, []);

  const clearCompleted = useCallback(() => {
    setState((current) => {
      const items = current.items.filter((item) => {
        if (item.status === 'completed') {
          fileUriMapRef.current.delete(item.file.id);
          return false;
        }
        return true;
      });
      return { items, overallPercent: computeOverallPercent(items) };
    });
  }, []);

  const controller = useMemo<ExtendedUploadController>(
    () => ({
      enqueue,
      pause,
      resume,
      cancel,
      retry,
      clearCompleted,
    }),
    [enqueue, pause, resume, cancel, retry, clearCompleted],
  );

  useEffect(() => {
    const uploadManager = uploadManagerRef.current;
    if (!uploadManager) return;

    const queuedItems = state.items.filter((item) => item.status === 'queued');
    const queuedIds = new Set(queuedItems.map((item) => item.file.id));

    queuedItems.forEach((item) => {
      if (!startedUploadsRef.current.has(item.file.id)) {
        const fileUri = fileUriMapRef.current.get(item.file.id);
        if (fileUri) {
          startedUploadsRef.current.add(item.file.id);
          uploadManager.startUpload(fileUri, item.file).catch(() => {
            startedUploadsRef.current.delete(item.file.id);
          });
        }
      }
    });

    const currentIds = new Set(state.items.map((item) => item.file.id));
    startedUploadsRef.current.forEach((id) => {
      if (!currentIds.has(id) || !queuedIds.has(id)) {
        startedUploadsRef.current.delete(id);
      }
    });
  }, [state.items]);

  useEffect(() => {
    // Save items that are completed
    // Progress should be 100% but we also accept items where uploadedBytes >= totalBytes
    // or where percent is >= 99 (to handle rounding issues)
    const completedItems = state.items.filter(
      (item) =>
        item.status === 'completed' &&
        item.progress.totalBytes > 0 &&
        (item.progress.percent >= 99 || item.progress.uploadedBytes >= item.progress.totalBytes),
    );
    if (completedItems.length) {
      updateUploadHistoryFromCompletedItems(completedItems).catch(() => {
        // Ignore storage errors
      });
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

export function useUploadContext(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error('useUploadContext must be used within UploadProvider');
  }
  return ctx;
}
