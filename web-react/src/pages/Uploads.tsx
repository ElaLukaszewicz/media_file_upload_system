import { UploadCard, DropZone } from '../components';
import { useUploadContext } from '../state/uploadContext';
import { useFileValidation, createFileDescriptors } from '../hooks/useFileValidation';
import styles from './Uploads.module.scss';

const MAX_FILES_PER_BATCH = 10;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB, adjust to backend limits

const VALIDATION_CONFIG = {
  maxFiles: MAX_FILES_PER_BATCH,
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  allowedTypes: ['image/', 'video/'] as string[],
};

export default function UploadsPage() {
  const { state, controller } = useUploadContext();

  const { validationError, validateAndSetError, clearError } = useFileValidation(
    state.items,
    VALIDATION_CONFIG,
  );

  const handleFilesSelected = (files: File[]) => {
    if (!files.length) return;

    const isValid = validateAndSetError(files);
    if (!isValid) return;

    clearError();

    const descriptors = createFileDescriptors(files);

    // Extended controller type supports fileObjects parameter
    controller.enqueue(descriptors, files);
  };

  return (
    <section aria-labelledby="upload-manager-heading">
      <h2 id="upload-manager-heading" className={styles.headlineSecondary}>
        Upload manager
      </h2>

      <DropZone
        onFilesSelected={handleFilesSelected}
        maxFiles={MAX_FILES_PER_BATCH}
        maxFileSizeBytes={MAX_FILE_SIZE_BYTES}
      />

      {validationError && (
        <p className={styles.validationError} role="alert" aria-live="assertive">
          {validationError}
        </p>
      )}

      {!state.items.length ? (
        <p className={styles.emptyState} aria-live="polite">
          No uploads yet. Add files to get started.
        </p>
      ) : (
        <ul className={styles.uploadedList} aria-label="Upload queue">
          {state.items.map((item) => (
            <UploadCard
              key={item.file.id}
              item={item}
              onPause={controller.pause}
              onResume={controller.resume}
              onCancel={controller.cancel}
              onRetry={controller.retry}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
