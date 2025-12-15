/**
 * API request and response types shared between web and mobile clients.
 * These types match the backend API contract.
 */

export interface UploadInitiateRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileHash: string;
}

export interface UploadInitiateResponse {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  fileId?: string;
  message?: string;
}

export interface ChunkUploadRequest {
  uploadId: string;
  chunkIndex: number;
  chunkData: string; // base64 encoded
}

export interface ChunkUploadResponse {
  success: boolean;
  uploadId: string;
  chunkIndex: number;
}

export interface FinalizeRequest {
  uploadId: string;
}

export interface FinalizeResponse {
  success: boolean;
  uploadId: string;
  fileId: string;
}

export interface UploadStatusResponse {
  uploadId: string;
  status: 'in_progress' | 'completed' | 'error';
  uploadedChunks: number;
  totalChunks: number;
  fileId: string | null;
  error: string | null;
}
