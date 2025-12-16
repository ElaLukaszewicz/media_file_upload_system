import type { UploadItem } from '@shared/uploadState';

const STORAGE_KEY = 'uploadHistory';

export interface UploadHistoryItem {
  id: string;
  name: string;
  size: number;
  type: string;
  completedAt: string; // ISO timestamp
}

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadUploadHistory(): UploadHistoryItem[] {
  if (!isBrowserEnvironment()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is UploadHistoryItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.size === 'number' &&
        typeof item.type === 'string' &&
        typeof item.completedAt === 'string',
    );
  } catch {
    return [];
  }
}

export function updateUploadHistoryFromCompletedItems(completedItems: UploadItem[]): void {
  if (!isBrowserEnvironment() || !completedItems.length) {
    return;
  }

  const existing = loadUploadHistory();
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

  if (!additions.length) return;

  // Place newest completed uploads at the beginning so they appear
  // at the top of the history list when rendered.
  const next = [...additions, ...existing];

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors to avoid impacting upload flow
  }
}


