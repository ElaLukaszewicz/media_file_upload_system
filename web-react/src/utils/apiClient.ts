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

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function initiateUpload(request: UploadInitiateRequest): Promise<UploadInitiateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/upload/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<UploadInitiateResponse>(response);
}

export async function uploadChunk(request: ChunkUploadRequest): Promise<ChunkUploadResponse> {
  const response = await fetch(`${API_BASE_URL}/api/upload/chunk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<ChunkUploadResponse>(response);
}

export async function finalizeUpload(request: FinalizeRequest): Promise<FinalizeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/upload/finalize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<FinalizeResponse>(response);
}

export async function getUploadStatus(uploadId: string): Promise<UploadStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/upload/status/${uploadId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<UploadStatusResponse>(response);
}
