import { useState, useCallback } from 'react';
import type { UploadItem } from '../../shared/uploadState';
import type { ProcessedFile } from '../utils/fileUtils';

export interface FileValidationConfig {
  readonly maxFiles: number;
  readonly maxFileSizeBytes: number;
  readonly allowedTypes?: readonly string[];
}

// Re-export ProcessedFile as FileInfo for backward compatibility
export type FileInfo = ProcessedFile;

export function validateFiles(
  files: FileInfo[],
  existingItems: UploadItem[],
  config: FileValidationConfig,
): { isValid: boolean; error: string | null } {
  if (!files.length) {
    return { isValid: false, error: null };
  }

  if (files.length > config.maxFiles) {
    return {
      isValid: false,
      error: `You can select up to ${config.maxFiles} files at a time.`,
    };
  }

  const allowedTypes = config.allowedTypes || ['image/', 'video/'];
  const invalidType = files.find(
    (file) => !allowedTypes.some((type) => file.type.startsWith(type)),
  );
  if (invalidType) {
    return {
      isValid: false,
      error: `Unsupported file type: ${invalidType.name}. Only images and videos are allowed.`,
    };
  }

  const tooLarge = files.find((file) => file.size > config.maxFileSizeBytes);
  if (tooLarge) {
    return {
      isValid: false,
      error: `File is too large: ${tooLarge.name}. Maximum size is ${Math.round(
        config.maxFileSizeBytes / (1024 * 1024),
      )}MB.`,
    };
  }

  const existingSignatures = new Set(
    existingItems.map((item) => `${item.file.name}::${item.file.size}::${item.file.type}`),
  );

  const duplicate = files.find((file) =>
    existingSignatures.has(`${file.name}::${file.size}::${file.type}`),
  );
  if (duplicate) {
    return {
      isValid: false,
      error: `File ${duplicate.name} is already in the upload list and cannot be added again.`,
    };
  }

  return { isValid: true, error: null };
}

export function createFileDescriptors(files: FileInfo[]): Array<{
  id: string;
  name: string;
  size: number;
  type: string;
  uri: string;
}> {
  return files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    name: file.name,
    size: file.size,
    type: file.type,
    uri: file.uri,
  }));
}

export function useFileValidation(existingItems: UploadItem[], config: FileValidationConfig) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateAndSetError = useCallback(
    (files: FileInfo[]) => {
      const result = validateFiles(files, existingItems, config);
      setValidationError(result.error);
      return result.isValid;
    },
    [existingItems, config],
  );

  const clearError = useCallback(() => {
    setValidationError(null);
  }, []);

  return {
    validationError,
    validateAndSetError,
    clearError,
  };
}
