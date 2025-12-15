import { useRef, useState } from 'react';
import { UploadCard } from '../components';
import { useUploadContext } from '../state/uploadContext';
import styles from './Uploads.module.scss';

const MAX_FILES_PER_BATCH = 10;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB, adjust to backend limits

export default function UploadsPage() {
  const { state, controller } = useUploadContext();
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;

    if (files.length > MAX_FILES_PER_BATCH) {
      setValidationError(`You can select up to ${MAX_FILES_PER_BATCH} files at a time.`);
      return;
    }

    const invalidType = files.find(
      (file) => !file.type.startsWith('image/') && !file.type.startsWith('video/'),
    );
    if (invalidType) {
      setValidationError(
        `Unsupported file type: ${invalidType.name}. Only images and videos are allowed.`,
      );
      return;
    }

    const tooLarge = files.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (tooLarge) {
      setValidationError(
        `File is too large: ${tooLarge.name}. Maximum size is ${Math.round(
          MAX_FILE_SIZE_BYTES / (1024 * 1024),
        )}MB.`,
      );
      return;
    }

    setValidationError(null); 

    const descriptors = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: URL.createObjectURL(file),
    }));

    // Type assertion to access extended enqueue method that accepts File objects
    (controller as { enqueue(files: typeof descriptors, fileObjects?: File[]): void }).enqueue(
      descriptors,
      files,
    );
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      handleFiles(event.target.files);
      // Allow selecting the same file again
      event.target.value = '';
    }
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files && event.dataTransfer.files.length) {
      handleFiles(event.dataTransfer.files);
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

  return (
    <section>
      <h2 className={styles.headlineSecondary}>Upload manager</h2>

      <div className={styles.dropZone} onClick={openFilePicker} onDrop={handleDrop} onDragOver={handleDragOver}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleInputChange}
          className={styles.fileInput}
        />
        <p className={styles.dropZoneTitle}>Select files to upload</p>
        <p className={styles.dropZoneHint}>
          Drag and drop up to {MAX_FILES_PER_BATCH} image or video files, or click to browse.
        </p>
      </div>

      {validationError && <p className={styles.validationError}>{validationError}</p>}

      {!state.items.length ? (
        <p className={styles.emptyState}>No uploads yet. Add files to get started.</p>
      ) : (
        <ul className={styles.uploadedList}>
          {state.items.map((item) => (
            <UploadCard key={item.file.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
