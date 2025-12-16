import React from 'react';
import styles from './FilePreview.module.scss';

export interface FilePreviewProps {
  previewUrl: string;
  fileType: string;
  fileName: string;
}

export const FilePreview = React.memo(function FilePreview({
  previewUrl,
  fileType,
  fileName,
}: FilePreviewProps) {
  const isImage = fileType.startsWith('image/');
  const isVideo = fileType.startsWith('video/');

  if (!isImage && !isVideo) {
    return null;
  }

  return (
    <div className={styles.preview} role="img" aria-label={`Preview thumbnail for ${fileName}`}>
      {isImage ? (
        <img
          src={previewUrl}
          alt={`Preview of ${fileName}`}
          className={styles.previewImage}
          loading="lazy"
        />
      ) : (
        <div
          className={styles.previewVideo}
          aria-label={`Video file preview: ${fileName}`}
          role="img"
        >
          <span className={styles.previewVideoIcon} aria-hidden="true">
            ▶
          </span>
        </div>
      )}
    </div>
  );
});
