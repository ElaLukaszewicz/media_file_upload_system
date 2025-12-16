import React from 'react';
import styles from './DropZone.module.scss';

export interface DropZoneProps {
  /** Callback when files are selected via file input */
  onFilesSelected: (files: File[]) => void;
  /** Maximum number of files allowed */
  maxFiles: number;
  /** Maximum file size in bytes */
  maxFileSizeBytes: number;
  /** Accepted file types (e.g., "image/*,video/*") */
  accept?: string;
  /** Whether multiple files are allowed */
  multiple?: boolean;
}

/**
 * DropZone - A presentational file upload drop zone component
 * Handles file selection via click or drag and drop
 * All logic and validation should be handled by parent component
 */
function DropZone({
  onFilesSelected,
  maxFiles,
  maxFileSizeBytes,
  accept = 'image/*,video/*',
  multiple = true,
}: DropZoneProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      onFilesSelected(files);
      // Allow selecting the same file again
      event.target.value = '';
    }
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files && event.dataTransfer.files.length) {
      const files = Array.from(event.dataTransfer.files);
      onFilesSelected(files);
      event.dataTransfer.clearData();
    }
  };

  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFilePicker();
    }
  };

  const maxSizeMB = Math.round(maxFileSizeBytes / (1024 * 1024));

  return (
    <div
      className={styles.dropZone}
      onClick={openFilePicker}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      role="button"
      tabIndex={0}
      aria-label="File upload drop zone. Click or drag and drop files here."
      onKeyDown={handleKeyDown}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleInputChange}
        className={styles.fileInput}
        aria-label="Select files to upload"
        aria-describedby="file-upload-hint"
      />
      <p className={styles.dropZoneTitle} id="file-upload-hint">
        Select files to upload
      </p>
      <p className={styles.dropZoneHint}>
        Drag and drop up to {maxFiles} image or video files, or click to browse. Maximum file size:{' '}
        {maxSizeMB}MB.
      </p>
    </div>
  );
}

export default React.memo(DropZone);
