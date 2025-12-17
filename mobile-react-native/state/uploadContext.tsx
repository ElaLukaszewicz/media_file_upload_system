/**
 * Upload Context Provider
 *
 * Manages upload state and provides upload control functionality.
 *
 * Background Upload Support:
 * - True background execution is limited on mobile (iOS 15min minimum intervals, unreliable)
 * - Our approach: Persist state when app goes to background, restore and resume on foreground
 * - Uploads continue while app is in foreground or briefly backgrounded (not terminated)
 * - If app is terminated, uploads resume automatically when user returns to app
 *
 * The upload manager handles persistence of chunk progress, allowing uploads to resume
 * from where they left off even after app termination.
 */

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
import { AppState, type AppStateStatus } from 'react-native';
import type {
  UploadController,
  UploadFileDescriptor,
  UploadItem,
  UploadState,
  UploadStatus,
} from '../../shared/uploadState';
import { ChunkedUploadManager } from '../utils/uploadManager';
import { updateUploadHistoryFromCompletedItems } from '../utils/uploadHistory';
import {
  saveUploadState,
  loadUploadState,
  saveFileUriMap,
  loadFileUriMap,
} from '../utils/uploadStatePersistence';
import {
  initializeBackgroundUploadService,
  registerBackgroundUploadTask,
  unregisterBackgroundUploadTask,
} from '../services/backgroundUploadService';
import { UPLOAD_CONSTANTS } from '../constants';

// Provide an emit-capable AppState for tests/development where emit may be missing
const maybeAppState = AppState as any;
if (typeof maybeAppState.emit !== 'function') {
  type Listener = (state: AppStateStatus) => void;
  const listeners = new Map<string, Set<Listener>>();
  const originalAdd =
    typeof maybeAppState.addEventListener === 'function'
      ? maybeAppState.addEventListener.bind(maybeAppState)
      : null;
  const originalRemove =
    typeof maybeAppState.removeEventListener === 'function'
      ? maybeAppState.removeEventListener.bind(maybeAppState)
      : null;

  const emit = (event: string, state: AppStateStatus) => {
    const handlers = listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(state));
    }
  };

  const add = (event: string, handler: Listener) => {
    const handlers = listeners.get(event) ?? new Set<Listener>();
    handlers.add(handler);
    listeners.set(event, handlers);
    const originalSubscription = originalAdd ? originalAdd(event, handler) : null;
    return {
      remove: () => {
        const existing = listeners.get(event);
        existing?.delete(handler);
        originalSubscription?.remove?.();
      },
    };
  };

  maybeAppState.emit = emit;
  maybeAppState.addEventListener = (event: string, handler: (state: AppStateStatus) => void) => {
    return add(event, handler);
  };
  maybeAppState.removeEventListener = (event: string, handler: (state: AppStateStatus) => void) => {
    const existing = listeners.get(event);
    existing?.delete(handler);
    return originalRemove ? originalRemove(event, handler) : undefined;
  };
}

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
  const [isInitialized, setIsInitialized] = useState(false);
  const fileUriMapRef = useRef<Map<string, string>>(new Map());
  const uploadManagerRef = useRef<ChunkedUploadManager | null>(null);
  const progressUpdateTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const updateItem = useCallback((uploadId: string, updater: (item: UploadItem) => UploadItem) => {
    setState((current) => {
      const items = current.items.map((item) => (item.file.id === uploadId ? updater(item) : item));
      return { items, overallPercent: computeOverallPercent(items) };
    });
  }, []);

  // Initialize upload manager and restore state
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Load persisted state
        const persistedState = await loadUploadState();
        const persistedFileUriMap = await loadFileUriMap();

        if (persistedState && isMounted) {
          setState(persistedState);
        }

        if (persistedFileUriMap.size > 0 && isMounted) {
          fileUriMapRef.current = persistedFileUriMap;
        }

        // Create upload manager with callbacks
        const callbacks = {
          onProgress: (uploadId: string, uploadedBytes: number, totalBytes: number) => {
            // Debounce progress updates to avoid excessive re-renders
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

              // Persist state (debounced internally)
              if (isMounted) {
                setState((current) => {
                  saveUploadState(current).catch(() => {});
                  saveFileUriMap(fileUriMapRef.current).catch(() => {});
                  return current;
                });
              }
            }, PROGRESS_DEBOUNCE_MS);

            progressUpdateTimeoutRef.current.set(uploadId, timeoutId);
          },
          onStatusChange: (uploadId: string, status: UploadStatus, errorMessage?: string) => {
            // Cancel any pending progress update for this upload
            const existingTimeout = progressUpdateTimeoutRef.current.get(uploadId);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
              progressUpdateTimeoutRef.current.delete(uploadId);
            }

            updateItem(uploadId, (item) => {
              // When completed, set progress to 100% immediately (bypass debounce)
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

            // Persist state immediately on status change
            if (isMounted) {
              setState((current) => {
                saveUploadState(current).catch(() => {});
                saveFileUriMap(fileUriMapRef.current).catch(() => {});
                return current;
              });
            }
          },
        };

        const manager = new ChunkedUploadManager(callbacks, true);
        uploadManagerRef.current = manager;

        // Initialize background upload service (for optional background fetch)
        initializeBackgroundUploadService(manager);

        // Register background task (optional, may not be available)
        registerBackgroundUploadTask().catch(() => {
          // Background fetch may not be available on all devices - this is expected
        });

        // Restore upload sessions
        if (persistedState && persistedState.items.length > 0) {
          await manager.restoreSessions();
        }

        if (isMounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize upload manager:', error);
        if (isMounted) {
          setIsInitialized(true); // Still mark as initialized to allow app to continue
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      progressUpdateTimeoutRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      progressUpdateTimeoutRef.current.clear();
      unregisterBackgroundUploadTask().catch(() => {});
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
      if (uploadManagerRef.current) {
        uploadManagerRef.current.resume(uploadId);
        startedUploadsRef.current.add(uploadId);
      }
      if (fileUri) {
        fileUriMapRef.current.set(uploadId, fileUri);
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
    if (!uploadManager || !isInitialized) return;

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
  }, [state.items, isInitialized]);

  /**
   * Handle app state changes (background/foreground)
   *
   * When app goes to background: Persist state so uploads can be resumed later.
   * When app returns to foreground: Restore and resume any active uploads.
   *
   * Note: True background execution is limited on mobile. This ensures uploads
   * can continue when the user returns to the app.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      const manager = uploadManagerRef.current;
      if (!manager) return;

      // App returned to foreground: restore and resume uploads
      const previousStateValue =
        typeof previousState === 'string' ? previousState : String(previousState);
      if (previousStateValue.match(/inactive|background/) && nextAppState === 'active') {
        // Restore persisted upload sessions
        manager.restoreSessions().catch((error) => {
          console.error('Failed to restore sessions on foreground:', error);
        });

        // Resume any uploads that should be active
        state.items.forEach((item) => {
          if (item.status === 'uploading' || item.status === 'queued') {
            const fileUri = fileUriMapRef.current.get(item.file.id);
            if (fileUri) {
              manager.resume(item.file.id);
            }
          }
        });
      }

      // App went to background: persist state for recovery
      if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
        saveUploadState(state).catch(() => {});
        saveFileUriMap(fileUriMapRef.current).catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, [state]);

  /**
   * Persist state whenever it changes (debounced internally).
   * This ensures upload state is saved for recovery if the app is terminated.
   */
  useEffect(() => {
    if (isInitialized) {
      // Persistence is debounced internally, so safe to call frequently
      saveUploadState(state).catch(() => {});
      saveFileUriMap(fileUriMapRef.current).catch(() => {});
    }
  }, [state, isInitialized]);

  /**
   * Save completed uploads to history.
   * Handles rounding edge cases (percent >= 99 or uploadedBytes >= totalBytes).
   */
  useEffect(() => {
    const completedItems = state.items.filter(
      (item) =>
        item.status === 'completed' &&
        item.progress.totalBytes > 0 &&
        (item.progress.percent >= 99 || item.progress.uploadedBytes >= item.progress.totalBytes),
    );
    if (completedItems.length) {
      updateUploadHistoryFromCompletedItems(completedItems).catch(() => {
        // Ignore storage errors - history is non-critical
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
