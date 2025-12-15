import type { UploadItem } from '@shared/uploadState';
import { useUploadContext } from '../state/uploadContext';
import styles from './UploadCard.module.scss';

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className={styles.progress} role="presentation" aria-hidden>
      <div className={styles.progressFill} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function UploadCard({ item }: { item: UploadItem }) {
  const { controller } = useUploadContext();
  const statusClass =
    {
      idle: styles.statusIdle,
      uploading: styles.statusUploading,
      queued: styles.statusQueued,
      paused: styles.statusPaused,
      error: styles.statusError,
      completed: styles.statusCompleted,
    }[item.status] ?? '';

  const handlePause = () => {
    controller.pause(item.file.id);
  };

  const handleResume = () => {
    controller.resume(item.file.id);
  };

  const handleCancel = () => {
    controller.cancel(item.file.id);
  };

  const handleRetry = () => {
    controller.retry(item.file.id);
  };

  const showControls = item.status !== 'completed' && item.status !== 'idle';

  return (
    <li className={styles.card}>
      <div className={styles.row}>

        {item.file.previewUrl && (
          <div className={styles.preview}>
            {item.file.type.startsWith('image/') ? (
              <img
                src={item.file.previewUrl}
                alt={item.file.name}
                className={styles.previewImage}
              />
            ) : item.file.type.startsWith('video/') ? (
              <div className={styles.previewVideo} aria-label="Video file">
                <span className={styles.previewVideoIcon}>▶</span>
              </div>
            ) : null}
          </div>
        )}
        
        <div className={styles.content}>
          <div className={styles.header}>
            <div>
              <p className={styles.name}>{item.file.name}</p>
              <p className={styles.meta}>
                {Math.round(item.file.size / 1024)} KB • {item.file.type}
              </p>
            </div>
            <span className={[styles.status, statusClass].filter(Boolean).join(' ')}>
              {item.status}
            </span>
          </div>
          <ProgressBar percent={item.progress.percent} />
          {item.errorMessage ? (
            <p className={styles.error}>{item.errorMessage}</p>
          ) : (
            <p className={styles.smallText}>
              Uploaded {item.progress.uploadedBytes} of {item.progress.totalBytes} bytes
            </p>
          )}
          {showControls && (
            <div className={styles.controls}>
              {item.status === 'uploading' && (
                <button type="button" onClick={handlePause} className={styles.button}>
                  Pause
                </button>
              )}
              {item.status === 'paused' && (
                <button type="button" onClick={handleResume} className={styles.button}>
                  Resume
                </button>
              )}
              {item.status === 'error' && (
                <button type="button" onClick={handleRetry} className={styles.button}>
                  Retry
                </button>
              )}
              <button type="button" onClick={handleCancel} className={styles.button}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
