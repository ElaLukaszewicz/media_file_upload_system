import type {
  UploadInitiateRequest,
  UploadInitiateResponse,
  ChunkUploadRequest,
  ChunkUploadResponse,
  FinalizeRequest,
  FinalizeResponse,
  UploadStatusResponse,
} from '../../shared/apiTypes';

// For mobile devices, use your computer's local IP address instead of localhost
// Example: http://192.168.1.100:8000
// You can find your IP with: ipconfig (Windows) or ifconfig (Mac/Linux)
// Use bracket access to avoid compile-time env substitution and allow runtime overrides in tests.
export const getApiBaseUrl = (): string => {
  const envValue =
    process.env['EXPO_PUBLIC_API_BASE_URL'] ||
    (globalThis as Record<string, unknown> | undefined)?.EXPO_PUBLIC_API_BASE_URL ||
    (globalThis as Record<string, any>)?.process?.env?.EXPO_PUBLIC_API_BASE_URL;
  return typeof envValue === 'string' && envValue.trim().length > 0
    ? envValue
    : 'http://localhost:8000';
};

// Log the API base URL for debugging (only in development, skip during tests)
if (__DEV__ && process.env['NODE_ENV'] !== 'test') {
  console.log('[API Client] Using API_BASE_URL:', getApiBaseUrl());
}

/**
 * Simple in-memory rate limiter to keep this client at or below
 * 10 requests per minute, matching the backend constraint.
 */
class ClientRateLimiter {
  private readonly maxRequestsPerMinute = 10;
  private readonly windowMs = 60_000;
  private timestamps: number[] = [];
  private queue: Array<() => void> = [];
  private isProcessing = false;
  private readonly isTestEnv =
    process.env['NODE_ENV'] === 'test' || process.env['JEST_WORKER_ID'] !== undefined;

  private scheduleNext(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const process = () => {
      if (this.queue.length === 0) {
        this.isProcessing = false;
        return;
      }

      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

      if (this.timestamps.length >= this.maxRequestsPerMinute) {
        const waitMs = this.windowMs - (now - this.timestamps[0]);
        setTimeout(process, Math.max(waitMs, 0));
        return;
      }

      const run = this.queue.shift();
      if (!run) {
        this.isProcessing = false;
        return;
      }

      this.timestamps.push(Date.now());
      run();

      setTimeout(process, 0);
    };

    setTimeout(process, 0);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isTestEnv) {
      return fn();
    }

    return new Promise<T>((resolve, reject) => {
      const wrapped = () => {
        fn().then(resolve).catch(reject);
      };

      this.queue.push(wrapped);
      this.scheduleNext();
    });
  }
}

const clientRateLimiter = new ClientRateLimiter();

interface ErrorResponse {
  error?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorBody: ErrorResponse | undefined;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = undefined;
    }
    const message = errorBody?.error || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

async function handleNetworkError(error: unknown, endpoint: string): Promise<never> {
  if (error instanceof TypeError && error.message.includes('Network request failed')) {
    console.error('[API Client] Network request failed:', {
      endpoint,
      apiBaseUrl: getApiBaseUrl(),
      error: error instanceof Error ? error.message : String(error),
    });

    const message =
      `Network request failed. Please check:\n` +
      `1. API server is running at ${getApiBaseUrl()}\n` +
      `2. For mobile devices, use your computer's IP address instead of localhost\n` +
      `3. Both devices are on the same network\n` +
      `4. Firewall allows connections on port 8000\n` +
      `\nCurrent API URL: ${getApiBaseUrl()}\n` +
      `Set EXPO_PUBLIC_API_BASE_URL environment variable with the correct URL.`;
    throw new Error(message);
  }
  throw error;
}

export async function initiateUpload(
  request: UploadInitiateRequest,
): Promise<UploadInitiateResponse> {
  return clientRateLimiter.run(async () => {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/upload/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      return handleResponse<UploadInitiateResponse>(response);
    } catch (error) {
      return handleNetworkError(error, '/api/upload/initiate');
    }
  });
}

export async function uploadChunk(
  request: ChunkUploadRequest,
  signal?: AbortSignal,
): Promise<ChunkUploadResponse> {
  return clientRateLimiter.run(async () => {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/upload/chunk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal,
      });

      return handleResponse<ChunkUploadResponse>(response);
    } catch (error) {
      return handleNetworkError(error, '/api/upload/chunk');
    }
  });
}

export async function finalizeUpload(request: FinalizeRequest): Promise<FinalizeResponse> {
  return clientRateLimiter.run(async () => {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/upload/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      return handleResponse<FinalizeResponse>(response);
    } catch (error) {
      return handleNetworkError(error, '/api/upload/finalize');
    }
  });
}

export async function getUploadStatus(uploadId: string): Promise<UploadStatusResponse> {
  return clientRateLimiter.run(async () => {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/upload/status/${uploadId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return handleResponse<UploadStatusResponse>(response);
    } catch (error) {
      return handleNetworkError(error, `/api/upload/status/${uploadId}`);
    }
  });
}
