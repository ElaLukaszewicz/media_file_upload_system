import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UploadItem } from '../../shared/uploadState';

const STORAGE_KEY = 'uploadHistory';

export interface UploadHistoryItem {
  id: string;
  name: string;
  size: number;
  type: string;
  completedAt: string; // ISO timestamp
}

export async function loadUploadHistory(): Promise<UploadHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter to ensure all items are valid and have required fields
    return parsed.filter(
      (item): item is UploadHistoryItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.size === 'number' &&
        item.size > 0 && // Ensure file size is valid
        typeof item.type === 'string' &&
        typeof item.completedAt === 'string' &&
        !isNaN(Date.parse(item.completedAt)), // Ensure completedAt is a valid date
    );
  } catch {
    return [];
  }
}

/**
 * Clean up history by removing any invalid or incomplete items
 */
export async function cleanupHistory(): Promise<void> {
  try {
    const history = await loadUploadHistory();
    // History is already filtered by loadUploadHistory, so we just save it back
    // This will remove any invalid entries
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore cleanup errors
  }
}

export async function updateUploadHistoryFromCompletedItems(
  completedItems: UploadItem[],
): Promise<void> {
  if (!completedItems.length) {
    return;
  }

  try {
    const existing = await loadUploadHistory();
    const existingIds = new Set(existing.map((item) => item.id));

    const now = new Date().toISOString();
    const additions: UploadHistoryItem[] = [];

    completedItems.forEach((item) => {
      if (!existingIds.has(item.file.id)) {
        additions.push({
          id: item.file.id,
          name: item.file.name,
          size: item.file.size,
          type: item.file.type,
          completedAt: now,
        });
      }
    });

    const next = additions.length ? [...additions, ...existing] : existing;

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors to avoid impacting upload flow
  }
}
