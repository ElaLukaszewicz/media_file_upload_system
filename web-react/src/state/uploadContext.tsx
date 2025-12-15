import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type {
  UploadController,
  UploadFileDescriptor,
  UploadItem,
  UploadState,
} from '@shared/uploadState';

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

  const updateItem = (uploadId: string, updater: (item: UploadItem) => UploadItem) => {
    setState((current) => {
      const items = current.items.map((item) => (item.file.id === uploadId ? updater(item) : item));
      return { items, overallPercent: computeOverallPercent(items) };
    });
  };

  const controller = useMemo<UploadController>(
    () => ({
      enqueue(files: UploadFileDescriptor[]) {
        if (!files.length) return;
        setState((current) => {
          const newItems: UploadItem[] = files.map((file) => ({
            file,
            status: 'queued',
            progress: { uploadedBytes: 0, totalBytes: file.size, percent: 0 },
            retries: 0,
          }));
          const items = [...current.items, ...newItems];
          return { items, overallPercent: computeOverallPercent(items) };
        });
      },
      pause(uploadId: string) {
        updateItem(uploadId, (item) => ({
          ...item,
          status: 'paused',
        }));
      },
      resume(uploadId: string) {
        updateItem(uploadId, (item) => ({
          ...item,
          status: 'uploading',
          errorMessage: undefined,
        }));
      },
      cancel(uploadId: string) {
        setState((current) => {
          const items = current.items.filter((item) => item.file.id !== uploadId);
          return { items, overallPercent: computeOverallPercent(items) };
        });
      },
      retry(uploadId: string) {
        updateItem(uploadId, (item) => ({
          ...item,
          status: 'queued',
          errorMessage: undefined,
          retries: item.retries + 1,
        }));
      },
      clearCompleted() {
        setState((current) => {
          const items = current.items.filter((item) => item.status !== 'completed');
          return { items, overallPercent: computeOverallPercent(items) };
        });
      },
    }),
    [],
  );

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
