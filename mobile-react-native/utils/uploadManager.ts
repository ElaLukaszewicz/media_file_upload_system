import type { UploadFileDescriptor } from '../../shared/uploadState';
import type { UploadInitiateRequest } from '../../shared/apiTypes';
import * as FileSystem from 'expo-file-system/legacy';
import { computeFileHash } from './fileHash';
import { initiateUpload, uploadChunk, finalizeUpload } from './apiClient';
import { UPLOAD_CONSTANTS } from '../constants';

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
  fileUri: string;
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
  cachedBase64?: string; // Cache the entire file as base64 to avoid re-reading
}

const CHUNK_SIZE = UPLOAD_CONSTANTS.CHUNK_SIZE;
const MAX_CONCURRENT_UPLOADS = UPLOAD_CONSTANTS.MAX_CONCURRENT_UPLOADS;
const MAX_RETRIES = UPLOAD_CONSTANTS.MAX_RETRIES;
const INITIAL_RETRY_DELAY = UPLOAD_CONSTANTS.INITIAL_RETRY_DELAY;

export class ChunkedUploadManager {
  private sessions = new Map<string, UploadSession>();
  private callbacks: UploadManagerCallbacks;
  private globalActiveUploads = 0;

  constructor(callbacks: UploadManagerCallbacks) {
    this.callbacks = callbacks;
  }

  async startUpload(fileUri: string, descriptor: UploadFileDescriptor): Promise<void> {
    if (this.sessions.has(descriptor.id)) {
      return; // Already started
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists || !fileInfo.size) {
        throw new Error('File does not exist or has no size');
      }

      const totalChunks = Math.ceil(fileInfo.size / CHUNK_SIZE);

      const session: UploadSession = {
        uploadId: '',
        fileUri,
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
        cachedBase64: undefined,
      };

      this.sessions.set(descriptor.id, session);
      this.callbacks.onStatusChange(descriptor.id, 'uploading');

      // Compute file hash
      const fileHash = await computeFileHash(fileUri);
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

      session.chunkAbortControllers.forEach((controller) => {
        controller.abort();
      });
      session.chunkAbortControllers.clear();

      this.globalActiveUploads -= session.activeChunkUploads.size;
      this.sessions.delete(uploadId);
    }
  }

  reset(uploadId: string): void {
    const session = this.sessions.get(uploadId);
    if (session) {
      session.isCancelled = true;
      session.chunkAbortControllers.forEach((controller) => {
        controller.abort();
      });
      session.chunkAbortControllers.clear();
      this.globalActiveUploads -= session.activeChunkUploads.size;
      session.uploadedBytes = 0;
      session.uploadedChunks.clear();
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

          if (
            session.uploadedChunks.size >= session.totalChunks &&
            session.activeChunkUploads.size === 0
          ) {
            this.finalizeUpload(uploadId).catch(() => {
              // Error handling done in finalizeUpload
            });
          } else if (!session.isCancelled && !session.isPaused) {
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

    const controller = new AbortController();
    session.chunkAbortControllers.set(chunkIndex, controller);

    try {
      // Read chunk from file
      // Note: expo-file-system doesn't support reading specific ranges,
      // so we cache the entire file as base64 and extract chunks from it
      const start = chunkIndex * session.chunkSize;
      const end = Math.min(start + session.chunkSize, session.descriptor.size);
      const chunkLength = end - start;

      // Cache the file content if not already cached
      if (!session.cachedBase64) {
        session.cachedBase64 = await FileSystem.readAsStringAsync(session.fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      // Decode the entire base64 to binary, extract chunk, then re-encode
      // This is memory-intensive but necessary due to expo-file-system limitations
      const binaryString = atob(session.cachedBase64);
      const binaryBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        binaryBytes[i] = binaryString.charCodeAt(i);
      }

      // Extract the chunk
      const chunkBytes = binaryBytes.slice(start, end);

      // Convert chunk back to base64
      let binaryChunk = '';
      for (let i = 0; i < chunkBytes.length; i++) {
        binaryChunk += String.fromCharCode(chunkBytes[i]);
      }
      const base64Chunk = btoa(binaryChunk);

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
        session.retryCount = 0;

        const chunkStart = chunkIndex * session.chunkSize;
        const chunkEnd = Math.min(chunkStart + session.chunkSize, session.descriptor.size);
        const chunkSize = chunkEnd - chunkStart;
        session.uploadedBytes += chunkSize;

        const totalBytes = session.descriptor.size;
        this.callbacks.onProgress(
          uploadId,
          Math.min(session.uploadedBytes, totalBytes),
          totalBytes,
        );
      }

      const currentController = session.chunkAbortControllers.get(chunkIndex);
      if (currentController === controller) {
        session.chunkAbortControllers.delete(chunkIndex);
      }
    } catch (error) {
      const currentController = session.chunkAbortControllers.get(chunkIndex);
      if (currentController === controller) {
        session.chunkAbortControllers.delete(chunkIndex);
      }

      if (session.isCancelled || session.isPaused) {
        return;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      if (retryAttempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryAttempt);
        await new Promise((resolve) => setTimeout(resolve, delay));

        const latestSession = this.sessions.get(uploadId);
        if (!latestSession || latestSession.isCancelled || latestSession.isPaused) {
          return;
        }

        return this.uploadChunkWithRetry(uploadId, chunkIndex, retryAttempt + 1);
      } else {
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
