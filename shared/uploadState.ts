export type UploadStatus =
  | "idle"
  | "queued"
  | "uploading"
  | "paused"
  | "error"
  | "completed";

export interface UploadFileDescriptor {
  id: string;
  name: string;
  size: number;
  type: string;
  uri?: string; // Useful for React Native file references
  previewUrl?: string; // Useful for web previews
}

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface UploadItem {
  file: UploadFileDescriptor;
  status: UploadStatus;
  progress: UploadProgress;
  errorMessage?: string;
  retries: number;
}

export interface UploadState {
  items: UploadItem[];
  overallPercent: number;
}

export interface UploadController {
  enqueue(files: UploadFileDescriptor[]): void;
  pause(uploadId: string): void;
  resume(uploadId: string): void;
  cancel(uploadId: string): void;
  retry(uploadId: string): void;
  clearCompleted(): void;
}
