import type { UploadFileDescriptor } from '@shared/uploadState';
import type { UploadInitiateRequest } from '@shared/apiTypes';
import { computeFileHash } from './fileHash';
import { initiateUpload, uploadChunk, finalizeUpload } from './apiClient';

export interface UploadManagerCallbacks {
  onProgress: (uploadId: string, uploadedBytes: number, totalBytes: number) => void;
  onStatusChange: (uploadId: string, status: 'queued' | 'uploading' | 'paused' | 'error' | 'completed', errorMessage?: string) => void;
}

interface UploadSession {
  uploadId: string;
  file: File;
  descriptor: UploadFileDescriptor;
  totalChunks: number;
  chunkSize: number;
  uploadedChunks: Set<number>;
  isPaused: boolean;
  isCancelled: boolean;
  activeChunkUploads: Set<number>;
  retryCount: number;
  fileHash?: string;
}

const CHUNK_SIZE = 1024 * 1024; // 1MB
const MAX_CONCURRENT_UPLOADS = 3;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export class ChunkedUploadManager {
  private sessions = new Map<string, UploadSession>();
  private callbacks: UploadManagerCallbacks;
  private globalActiveUploads = 0;

  constructor(callbacks: UploadManagerCallbacks) {
    this.callbacks = callbacks;
  }

  async startUpload(file: File, descriptor: UploadFileDescriptor): Promise<void> {
    if (this.sessions.has(descriptor.id)) {
      return; // Already started
    }

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const session: UploadSession = {
      uploadId: '',
      file,
      descriptor,
      totalChunks,
      chunkSize: CHUNK_SIZE,
      uploadedChunks: new Set(),
      isPaused: false,
      isCancelled: false,
      activeChunkUploads: new Set(),
      retryCount: 0,
    };

    this.sessions.set(descriptor.id, session);
    this.callbacks.onStatusChange(descriptor.id, 'uploading');

    try {
      // Compute file hash
      const fileHash = await computeFileHash(file);
      session.fileHash = fileHash;

      // Initiate upload
      const initiateRequest: UploadInitiateRequest = {
        fileName: descriptor.name,
        fileSize: descriptor.size,
        mimeType: descriptor.type,
        fileHash,
      };

      const response = await initiateUpload(initiateRequest);
      session.uploadId = response.uploadId;

      // If file already exists (deduplication)
      if (response.fileId && response.totalChunks === 0) {
        this.callbacks.onProgress(descriptor.id, descriptor.size, descriptor.size);
        this.callbacks.onStatusChange(descriptor.id, 'completed');
        this.sessions.delete(descriptor.id);
        return;
      }

      // Start uploading chunks (don't await, let it run asynchronously)
      this.processUpload(descriptor.id).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : 'Failed to process upload';
        this.callbacks.onStatusChange(descriptor.id, 'error', errorMessage);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate upload';
      this.callbacks.onStatusChange(descriptor.id, 'error', errorMessage);
    }
  }

  pause(uploadId: string): void {
    const session = this.sessions.get(uploadId);
    if (session) {
      session.isPaused = true;
      this.callbacks.onStatusChange(uploadId, 'paused');
    }
  }

  resume(uploadId: string): void {
    const session = this.sessions.get(uploadId);
    if (session && session.isPaused) {
      session.isPaused = false;
      this.callbacks.onStatusChange(uploadId, 'uploading');
      this.processUpload(uploadId).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : 'Failed to resume upload';
        this.callbacks.onStatusChange(uploadId, 'error', errorMessage);
      });
    }
  }

  cancel(uploadId: string): void {
    const session = this.sessions.get(uploadId);
    if (session) {
      session.isCancelled = true;
      session.isPaused = true;
      // Decrease global counter by the number of active chunks for this upload
      this.globalActiveUploads -= session.activeChunkUploads.size;
      this.sessions.delete(uploadId);
    }
  }

  reset(uploadId: string): void {
    const session = this.sessions.get(uploadId);
    if (session) {
      // Cancel any active uploads for this session
      session.isCancelled = true;
      this.globalActiveUploads -= session.activeChunkUploads.size;
      // Remove session to allow restart
      this.sessions.delete(uploadId);
    }
  }

  private async processUpload(uploadId: string): Promise<void> {
    const session = this.sessions.get(uploadId);
    if (!session || session.isCancelled || session.isPaused) {
      return;
    }

    // Check if all chunks are uploaded
    if (session.uploadedChunks.size >= session.totalChunks) {
      if (session.activeChunkUploads.size === 0) {
        await this.finalizeUpload(uploadId);
      }
      return;
    }

    // Start uploading chunks up to the concurrency limit
    const chunksToStart: number[] = [];
    for (let i = 0; i < session.totalChunks && this.globalActiveUploads < MAX_CONCURRENT_UPLOADS; i++) {
      if (!session.uploadedChunks.has(i) && !session.activeChunkUploads.has(i)) {
        chunksToStart.push(i);
        session.activeChunkUploads.add(i);
        this.globalActiveUploads++;
      }
    }

    // Start uploading each chunk
    chunksToStart.forEach((chunkIndex) => {
      this.uploadChunkWithRetry(uploadId, chunkIndex)
        .then(() => {
          // Chunk uploaded successfully, try to start more
          if (!session.isCancelled && !session.isPaused) {
            this.processUpload(uploadId).catch(() => {
              // Error handling done in individual chunk uploads
            });
          }
        })
        .catch(() => {
          // Error already handled in uploadChunkWithRetry
        })
        .finally(() => {
          session.activeChunkUploads.delete(chunkIndex);
          this.globalActiveUploads--;

          // Check if all chunks are done
          if (session.uploadedChunks.size >= session.totalChunks && session.activeChunkUploads.size === 0) {
            this.finalizeUpload(uploadId).catch(() => {
              // Error handling done in finalizeUpload
            });
          } else if (!session.isCancelled && !session.isPaused) {
            // Try to start more chunks
            this.processUpload(uploadId).catch(() => {
              // Error handling done in individual chunk uploads
            });
          }
        });
    });
  }

  private async uploadChunkWithRetry(uploadId: string, chunkIndex: number, retryAttempt = 0): Promise<void> {
    const session = this.sessions.get(uploadId);
    if (!session || session.isCancelled) {
      return;
    }

    try {
      // Read chunk from file
      const start = chunkIndex * session.chunkSize;
      const end = Math.min(start + session.chunkSize, session.file.size);
      const chunkBlob = session.file.slice(start, end);
      const arrayBuffer = await chunkBlob.arrayBuffer();
      
      // Convert to base64 (handle large arrays efficiently)
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Chunk = btoa(binary);

      // Upload chunk
      await uploadChunk({
        uploadId: session.uploadId,
        chunkIndex,
        chunkData: base64Chunk,
      });

      // Mark chunk as uploaded
      session.uploadedChunks.add(chunkIndex);
      session.retryCount = 0; // Reset retry count on success

      // Update progress - calculate actual uploaded bytes
      let uploadedBytes = 0;
      session.uploadedChunks.forEach((chunkIdx) => {
        const chunkStart = chunkIdx * session.chunkSize;
        const chunkEnd = Math.min(chunkStart + session.chunkSize, session.file.size);
        uploadedBytes += chunkEnd - chunkStart;
      });
      const totalBytes = session.descriptor.size;
      this.callbacks.onProgress(uploadId, Math.min(uploadedBytes, totalBytes), totalBytes);
    } catch (error) {
      if (retryAttempt < MAX_RETRIES && !session.isCancelled) {
        // Exponential backoff
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryAttempt);
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Retry
        return this.uploadChunkWithRetry(uploadId, chunkIndex, retryAttempt + 1);
      } else {
        // Max retries reached
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload chunk';
        this.callbacks.onStatusChange(uploadId, 'error', errorMessage);
        throw error;
      }
    }
  }

  private async finalizeUpload(uploadId: string): Promise<void> {
    const session = this.sessions.get(uploadId);
    if (!session || session.isCancelled) {
      return;
    }

    try {
      await finalizeUpload({ uploadId: session.uploadId });
      this.callbacks.onProgress(uploadId, session.descriptor.size, session.descriptor.size);
      this.callbacks.onStatusChange(uploadId, 'completed');
      this.sessions.delete(uploadId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to finalize upload';
      this.callbacks.onStatusChange(uploadId, 'error', errorMessage);
    }
  }
}
