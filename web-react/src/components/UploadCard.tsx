import type { UploadItem } from '@shared/uploadState';
import styles from './UploadCard.module.scss';

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className={styles.progress} role="presentation" aria-hidden>
      <div className={styles.progressFill} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function UploadCard({ item }: { item: UploadItem }) {
  const statusClass =
    {
      idle: styles.statusIdle,
      uploading: styles.statusUploading,
      queued: styles.statusQueued,
      paused: styles.statusPaused,
      error: styles.statusError,
      completed: styles.statusCompleted,
    }[item.status] ?? '';

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
        </div>
      </div>
    </li>
  );
}
