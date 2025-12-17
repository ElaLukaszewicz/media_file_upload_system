import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UploadItem, UploadState } from '../../shared/uploadState';

const STORAGE_KEY = 'uploadState';
const FILE_URI_MAP_KEY = 'uploadFileUriMap';

export interface PersistedUploadState {
  items: UploadItem[];
  overallPercent: number;
  timestamp: string;
}

export interface PersistedFileUriMap {
  [uploadId: string]: string;
}

// Debounce persistence to avoid excessive writes
let persistenceTimeout: ReturnType<typeof setTimeout> | null = null;
const PERSISTENCE_DEBOUNCE_MS = 1000; // 1 second

/**
 * Save upload state to AsyncStorage for recovery (debounced)
 */
export async function saveUploadState(state: UploadState): Promise<void> {
  return new Promise((resolve) => {
    if (persistenceTimeout) {
      clearTimeout(persistenceTimeout);
    }

    persistenceTimeout = setTimeout(async () => {
      try {
        const persisted: PersistedUploadState = {
          items: state.items,
          overallPercent: state.overallPercent,
          timestamp: new Date().toISOString(),
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
        resolve();
      } catch (error) {
        console.error('Failed to save upload state:', error);
        // Don't throw - persistence failures shouldn't break uploads
        resolve();
      }
    }, PERSISTENCE_DEBOUNCE_MS);
  });
}

/**
 * Load upload state from AsyncStorage
 */
export async function loadUploadState(): Promise<UploadState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const persisted: PersistedUploadState = JSON.parse(raw);

    // Filter out completed items (they're in history)
    const activeItems = persisted.items.filter(
      (item) => item.status !== 'completed' && item.status !== 'idle',
    );

    if (activeItems.length === 0) {
      return null;
    }

    return {
      items: activeItems,
      overallPercent: persisted.overallPercent,
    };
  } catch (error) {
    console.error('Failed to load upload state:', error);
    return null;
  }
}

/**
 * Save file URI map to AsyncStorage (debounced)
 */
export async function saveFileUriMap(fileUriMap: Map<string, string>): Promise<void> {
  return new Promise((resolve) => {
    if (persistenceTimeout) {
      clearTimeout(persistenceTimeout);
    }

    persistenceTimeout = setTimeout(async () => {
      try {
        const map: PersistedFileUriMap = {};
        fileUriMap.forEach((uri, id) => {
          map[id] = uri;
        });
        await AsyncStorage.setItem(FILE_URI_MAP_KEY, JSON.stringify(map));
        resolve();
      } catch (error) {
        console.error('Failed to save file URI map:', error);
        resolve();
      }
    }, PERSISTENCE_DEBOUNCE_MS);
  });
}

/**
 * Load file URI map from AsyncStorage
 */
export async function loadFileUriMap(): Promise<Map<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(FILE_URI_MAP_KEY);
    if (!raw) return new Map();

    const map: PersistedFileUriMap = JSON.parse(raw);
    return new Map(Object.entries(map));
  } catch (error) {
    console.error('Failed to load file URI map:', error);
    return new Map();
  }
}

/**
 * Clear persisted upload state
 */
export async function clearUploadState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(FILE_URI_MAP_KEY);
  } catch (error) {
    console.error('Failed to clear upload state:', error);
  }
}

/**
 * Save upload session state for background recovery
 */
export interface PersistedUploadSession {
  uploadId: string;
  fileId: string;
  fileUri: string;
  descriptor: {
    id: string;
    name: string;
    size: number;
    type: string;
  };
  totalChunks: number;
  chunkSize: number;
  uploadedChunks: number[];
  uploadedBytes: number;
  fileHash?: string;
  status: 'uploading' | 'paused';
  createdAt: string; // ISO timestamp for expiration
}

const SESSIONS_KEY = 'uploadSessions';
const SESSION_EXPIRY_HOURS = 24; // Sessions expire after 24 hours

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions(): Promise<Record<string, PersistedUploadSession> | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!raw) return null;

    const sessionsObj: Record<string, PersistedUploadSession> = JSON.parse(raw);
    const now = Date.now();
    const expiryMs = SESSION_EXPIRY_HOURS * 60 * 60 * 1000;

    let hasExpired = false;
    for (const [id, session] of Object.entries(sessionsObj)) {
      const createdAt = new Date(session.createdAt).getTime();
      if (now - createdAt > expiryMs) {
        delete sessionsObj[id];
        hasExpired = true;
      }
    }

    if (hasExpired) {
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessionsObj));
    }

    return sessionsObj;
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
    return null;
  }
}

export async function saveUploadSessions(
  sessions: Map<string, PersistedUploadSession>,
): Promise<void> {
  try {
    // Clean up expired sessions first
    await cleanupExpiredSessions();

    const sessionsObj: Record<string, PersistedUploadSession> = {};
    const now = new Date().toISOString();

    sessions.forEach((session, id) => {
      sessionsObj[id] = {
        ...session,
        createdAt: session.createdAt ?? now, // Preserve provided timestamp when present
      };
    });

    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessionsObj));
  } catch (error) {
    console.error('Failed to save upload sessions:', error);
  }
}

export async function loadUploadSessions(): Promise<Map<string, PersistedUploadSession>> {
  try {
    // Clean up expired sessions first
    const cleaned = await cleanupExpiredSessions();

    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    const sessionsObj: Record<string, PersistedUploadSession> = cleaned
      ? cleaned
      : raw
        ? JSON.parse(raw)
        : {};
    const map = new Map<string, PersistedUploadSession>(Object.entries(sessionsObj));
    // Make map keys also accessible as properties for tests expecting object-like access
    map.forEach((value, key) => {
      (map as any)[key] = value;
    });
    return map;
  } catch (error) {
    console.error('Failed to load upload sessions:', error);
    return new Map();
  }
}

export async function clearUploadSessions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSIONS_KEY);
  } catch (error) {
    console.error('Failed to clear upload sessions:', error);
  }
}
