import type { UploadFileDescriptor } from '@shared/uploadState';
import type { UploadInitiateRequest } from '@shared/apiTypes';
import { computeFileHash } from './fileHash';
import { initiateUpload, uploadChunk, finalizeUpload } from './apiClient';

export interface UploadManagerCallbacks {
  onProgress: (uploadId: string, uploadedBytes: number, totalBytes: number) => void;
  onStatusChange: (
    uploadId: string,
    status: 'queued' | 'uploading' | 'paused' | 'error' | 'completed',
    errorMessage?: string,
  ) => void;
}

interface UploadSession {
  uploadId: string;
  file: File;
  descriptor: UploadFileDescriptor;
  totalChunks: number;
  chunkSize: number;
  uploadedChunks: Set<number>;
  uploadedBytes: number;
  isPaused: boolean;
  isCancelled: boolean;
  activeChunkUploads: Set<number>;
  retryCount: number;
  fileHash?: string;
  chunkAbortControllers: Map<number, AbortController>;
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
      uploadedBytes: 0,
      isPaused: false,
      isCancelled: false,
      activeChunkUploads: new Set(),
      retryCount: 0,
      chunkAbortControllers: new Map(),
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

      // Abort all in-flight chunk uploads so we don't have to wait
      // for slow or stuck network requests when resuming.
      // Note: We don't clear the map here because old error handlers
      // need to be able to check if their controller is still current
      // using the identity check in uploadChunkWithRetry.
      session.chunkAbortControllers.forEach((controller) => {
        controller.abort();
      });
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

      // Abort any in-flight chunk uploads for this session.
      session.chunkAbortControllers.forEach((controller) => {
        controller.abort();
      });
      session.chunkAbortControllers.clear();

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
      session.chunkAbortControllers.forEach((controller) => {
        controller.abort();
      });
      session.chunkAbortControllers.clear();
      this.globalActiveUploads -= session.activeChunkUploads.size;
      session.uploadedBytes = 0;
      session.uploadedChunks.clear();
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
    for (
      let i = 0;
      i < session.totalChunks && this.globalActiveUploads < MAX_CONCURRENT_UPLOADS;
      i++
    ) {
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
          if (
            session.uploadedChunks.size >= session.totalChunks &&
            session.activeChunkUploads.size === 0
          ) {
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

  private async uploadChunkWithRetry(
    uploadId: string,
    chunkIndex: number,
    retryAttempt = 0,
  ): Promise<void> {
    const session = this.sessions.get(uploadId);
    if (!session || session.isCancelled || session.isPaused) {
      return;
    }

    // Create an AbortController for this chunk attempt and keep track of it
    const controller = new AbortController();
    session.chunkAbortControllers.set(chunkIndex, controller);

    try {
      // Read chunk from file
      const start = chunkIndex * session.chunkSize;
      const end = Math.min(start + session.chunkSize, session.file.size);
      const chunkBlob = session.file.slice(start, end);

      // Convert to base64 efficiently using FileReader (more efficient for large chunks)
      const base64Chunk = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            // Remove data URL prefix (data:application/octet-stream;base64,)
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          } else {
            reject(new Error('Failed to read chunk as base64'));
          }
        };
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsDataURL(chunkBlob);
      });

      // Upload chunk with abort signal
      await uploadChunk(
        {
          uploadId: session.uploadId,
          chunkIndex,
          chunkData: base64Chunk,
        },
        controller.signal,
      );

      // Mark chunk as uploaded and update progress incrementally
      if (!session.uploadedChunks.has(chunkIndex)) {
        session.uploadedChunks.add(chunkIndex);
        session.retryCount = 0; // Reset retry count on success

        // Calculate chunk size and add to uploaded bytes
        const chunkStart = chunkIndex * session.chunkSize;
        const chunkEnd = Math.min(chunkStart + session.chunkSize, session.file.size);
        const chunkSize = chunkEnd - chunkStart;
        session.uploadedBytes += chunkSize;

        const totalBytes = session.descriptor.size;
        this.callbacks.onProgress(
          uploadId,
          Math.min(session.uploadedBytes, totalBytes),
          totalBytes,
        );
      }

      // Clean up: only delete if this is still the controller we created
      // This prevents race conditions where an old error handler deletes
      // a new controller created by a retry after pause/resume.
      const currentController = session.chunkAbortControllers.get(chunkIndex);
      if (currentController === controller) {
        session.chunkAbortControllers.delete(chunkIndex);
      }
    } catch (error) {
      // Clean up: only delete if this is still the controller we created
      // This prevents race conditions where an old error handler deletes
      // a new controller created by a retry after pause/resume.
      const currentController = session.chunkAbortControllers.get(chunkIndex);
      if (currentController === controller) {
        session.chunkAbortControllers.delete(chunkIndex);
      }

      // If the upload was paused or cancelled while this chunk was in-flight,
      // do not schedule any further retries for it.
      if (session.isCancelled || session.isPaused) {
        return;
      }

      // Don't retry if the error was due to abort
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      if (retryAttempt < MAX_RETRIES) {
        // Exponential backoff
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryAttempt);
        await new Promise((resolve) => setTimeout(resolve, delay));

        // If the session has been paused or cancelled during the backoff,
        // stop retrying.
        const latestSession = this.sessions.get(uploadId);
        if (!latestSession || latestSession.isCancelled || latestSession.isPaused) {
          return;
        }

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
