import { createContext, useContext, useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import type {
  UploadController,
  UploadFileDescriptor,
  UploadItem,
  UploadState,
} from '@shared/uploadState';
import { ChunkedUploadManager } from '../utils/uploadManager';

interface UploadContextValue {
  state: UploadState;
  controller: UploadController;
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

export function UploadProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UploadState>(initialState);
  const fileMapRef = useRef<Map<string, File>>(new Map());
  const uploadManagerRef = useRef<ChunkedUploadManager | null>(null);

  const updateItem = (uploadId: string, updater: (item: UploadItem) => UploadItem) => {
    setState((current) => {
      const items = current.items.map((item) => (item.file.id === uploadId ? updater(item) : item));
      return { items, overallPercent: computeOverallPercent(items) };
    });
  };

  // Initialize upload manager
  useEffect(() => {
    uploadManagerRef.current = new ChunkedUploadManager({
      onProgress: (uploadId, uploadedBytes, totalBytes) => {
        updateItem(uploadId, (item) => ({
          ...item,
          progress: {
            uploadedBytes,
            totalBytes,
            percent: Math.round((uploadedBytes / totalBytes) * 100),
          },
        }));
      },
      onStatusChange: (uploadId, status, errorMessage) => {
        updateItem(uploadId, (item) => ({
          ...item,
          status,
          errorMessage,
        }));
      },
    });

    return () => {
      // Cleanup if needed
    };
  }, []);

  interface ExtendedUploadController extends UploadController {
    enqueue(files: UploadFileDescriptor[], fileObjects?: File[]): void;
  }

  const controller = useMemo<ExtendedUploadController>(
    () => ({
      enqueue(files: UploadFileDescriptor[], fileObjects?: File[]) {
        if (!files.length) return;
        setState((current) => {
          const newItems: UploadItem[] = files.map((file, index) => {
            // Store File object if provided
            if (fileObjects && fileObjects[index]) {
              fileMapRef.current.set(file.id, fileObjects[index]);
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
        const item = state.items.find((i) => i.file.id === uploadId);
        if (file && item && uploadManagerRef.current) {
          uploadManagerRef.current.resume(uploadId);
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
        setState((current) => {
          const items = current.items.filter((item) => item.file.id !== uploadId);
          return { items, overallPercent: computeOverallPercent(items) };
        });
      },
      retry(uploadId: string) {
        const file = fileMapRef.current.get(uploadId);
        const item = state.items.find((i) => i.file.id === uploadId);
        if (file && item && uploadManagerRef.current) {
          // Reset the session in upload manager to allow restart
          uploadManagerRef.current.reset(uploadId);
          updateItem(uploadId, (item) => ({
            ...item,
            status: 'queued',
            errorMessage: undefined,
            retries: item.retries + 1,
            progress: { uploadedBytes: 0, totalBytes: item.file.size, percent: 0 },
          }));
          // Restart upload
          uploadManagerRef.current.startUpload(file, item.file).catch(() => {
            // Error handling done in upload manager
          });
        }
      },
      clearCompleted() {
        setState((current) => {
          const items = current.items.filter((item) => {
            if (item.status === 'completed') {
              fileMapRef.current.delete(item.file.id);
              return false;
            }
            return true;
          });
          return { items, overallPercent: computeOverallPercent(items) };
        });
      },
    }),
    [state.items],
  );

  // Auto-start queued uploads
  useEffect(() => {
    const uploadManager = uploadManagerRef.current;
    if (!uploadManager) return;

    const queuedItems = state.items.filter((item) => item.status === 'queued');
    queuedItems.forEach((item) => {
      const file = fileMapRef.current.get(item.file.id);
      if (file) {
        // Start upload - upload manager will check if session already exists
        uploadManager.startUpload(file, item.file).catch(() => {
          // Error handling done in upload manager
        });
      }
    });
  }, [state.items]);

  const value = useMemo(
    () => ({
      state,
      controller: controller as UploadController,
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
