import React from 'react';
import type { UploadItem } from '@shared/uploadState';
import { ProgressBar } from './ProgressBar';
import { FilePreview } from './FilePreview';
import styles from './UploadCard.module.scss';

export interface UploadCardProps {
  item: UploadItem;
  onPause: (uploadId: string) => void;
  onResume: (uploadId: string) => void;
  onCancel: (uploadId: string) => void;
  onRetry: (uploadId: string) => void;
}

const STATUS_CLASS_MAP = {
  idle: styles.statusIdle,
  uploading: styles.statusUploading,
  queued: styles.statusQueued,
  paused: styles.statusPaused,
  error: styles.statusError,
  completed: styles.statusCompleted,
} as const;

function UploadCard({ item, onPause, onResume, onCancel, onRetry }: UploadCardProps) {
  const statusClass = STATUS_CLASS_MAP[item.status] ?? '';

  // Bind uploadId to controller methods - controller methods are stable (memoized in context)
  const handlePause = React.useCallback(() => {
    onPause(item.file.id);
  }, [item.file.id, onPause]);

  const handleResume = React.useCallback(() => {
    onResume(item.file.id);
  }, [item.file.id, onResume]);

  const handleCancel = React.useCallback(() => {
    onCancel(item.file.id);
  }, [item.file.id, onCancel]);

  const handleRetry = React.useCallback(() => {
    onRetry(item.file.id);
  }, [item.file.id, onRetry]);

  // Computed values
  const showControls = item.status !== 'completed' && item.status !== 'idle';
  const fileSizeKB = Math.round(item.file.size / 1024);
  const statusClassName = statusClass ? `${styles.status} ${statusClass}` : styles.status;

  return (
    <li className={styles.card} role="listitem">
      <div className={styles.cardRow}>
        {item.file.previewUrl && (
          <FilePreview
            previewUrl={item.file.previewUrl}
            fileType={item.file.type}
            fileName={item.file.name}
          />
        )}

        <div className={styles.content}>
          <div className={styles.header}>
            <div>
              <h3 className={styles.fileName} id={`file-name-${item.file.id}`}>
                {item.file.name}
              </h3>
              <p className={styles.fileMeta} aria-describedby={`file-name-${item.file.id}`}>
                {fileSizeKB} KB • {item.file.type}
              </p>
            </div>
            <span
              className={statusClassName}
              role="status"
              aria-label={`Upload status: ${item.status}`}
              aria-live="polite"
            >
              {item.status}
            </span>
          </div>

          <ProgressBar
            percent={item.progress.percent}
            aria-label={`Upload progress for ${item.file.name}: ${item.progress.percent}%`}
          />

          {item.errorMessage ? (
            <p className={styles.errorMessage} role="alert" aria-live="assertive">
              {item.errorMessage}
            </p>
          ) : (
            <p className={styles.progressInfo} aria-live="polite">
              Uploaded {item.progress.uploadedBytes} of {item.progress.totalBytes} bytes
            </p>
          )}

          {showControls && (
            <div className={styles.controls}>
              {item.status === 'uploading' && (
                <button
                  type="button"
                  onClick={handlePause}
                  className={styles.button}
                  aria-label="Pause upload"
                >
                  Pause
                </button>
              )}
              {item.status === 'paused' && (
                <button
                  type="button"
                  onClick={handleResume}
                  className={styles.button}
                  aria-label="Resume upload"
                >
                  Resume
                </button>
              )}
              {item.status === 'error' && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className={styles.button}
                  aria-label="Retry upload"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className={styles.button}
                aria-label="Cancel upload"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export default React.memo(UploadCard);
