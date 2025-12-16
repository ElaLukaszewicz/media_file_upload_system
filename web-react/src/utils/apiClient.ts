import type {
  UploadInitiateRequest,
  UploadInitiateResponse,
  ChunkUploadRequest,
  ChunkUploadResponse,
  FinalizeRequest,
  FinalizeResponse,
  UploadStatusResponse,
} from '@shared/apiTypes';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Simple in-memory rate limiter to keep this client at or below
 * 10 requests per minute, matching the backend constraint.
 *
 * This prevents a burst of chunk requests from immediately
 * triggering lots of 429 responses and instead queues work
 * client-side.
 */
class ClientRateLimiter {
  private readonly maxRequestsPerMinute = 10;
  private readonly windowMs = 60_000;
  private timestamps: number[] = [];
  private queue: Array<() => void> = [];
  private isProcessing = false;

  private scheduleNext(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const process = () => {
      if (this.queue.length === 0) {
        this.isProcessing = false;
        return;
      }

      const now = Date.now();
      // Drop timestamps older than 1 minute
      this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

      if (this.timestamps.length >= this.maxRequestsPerMinute) {
        const waitMs = this.windowMs - (now - this.timestamps[0]);
        setTimeout(process, Math.max(waitMs, 0));
        return;
      }

      // We can execute one request
      const run = this.queue.shift();
      if (!run) {
        this.isProcessing = false;
        return;
      }

      this.timestamps.push(Date.now());
      run();

      // Immediately try to process next in queue
      setTimeout(process, 0);
    };

    setTimeout(process, 0);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
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

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
    const message = errorBody.error || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }
  return response.json();
}

export async function initiateUpload(request: UploadInitiateRequest): Promise<UploadInitiateResponse> {
  return clientRateLimiter.run(async () => {
    const response = await fetch(`${API_BASE_URL}/api/upload/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return handleResponse<UploadInitiateResponse>(response);
  });
}

export async function uploadChunk(
  request: ChunkUploadRequest,
  signal?: AbortSignal,
): Promise<ChunkUploadResponse> {
  return clientRateLimiter.run(async () => {
    const response = await fetch(`${API_BASE_URL}/api/upload/chunk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal,
    });

    return handleResponse<ChunkUploadResponse>(response);
  });
}

export async function finalizeUpload(request: FinalizeRequest): Promise<FinalizeResponse> {
  return clientRateLimiter.run(async () => {
    const response = await fetch(`${API_BASE_URL}/api/upload/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return handleResponse<FinalizeResponse>(response);
  });
}

export async function getUploadStatus(uploadId: string): Promise<UploadStatusResponse> {
  return clientRateLimiter.run(async () => {
    const response = await fetch(`${API_BASE_URL}/api/upload/status/${uploadId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return handleResponse<UploadStatusResponse>(response);
  });
}
