import { renderHook, act } from '@testing-library/react-native';
import { useFileValidation, validateFiles, createFileDescriptors } from './useFileValidation';
import type { UploadItem } from '../../shared/uploadState';
import type { FileInfo } from './useFileValidation';

describe('useFileValidation', () => {
  const config = {
    maxFiles: 5,
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/', 'video/'] as const,
  };

  const existingItems: UploadItem[] = [
    {
      file: {
        id: 'existing-1',
        name: 'existing.jpg',
        size: 1024,
        type: 'image/jpeg',
      },
      status: 'uploading',
      progress: {
        uploadedBytes: 512,
        totalBytes: 1024,
        percent: 50,
      },
      retries: 0,
    },
  ];

  describe('validateFiles', () => {
    it('should return invalid for empty files array', () => {
      const result = validateFiles([], existingItems, config);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeNull();
    });

    it('should validate files within limits', () => {
      const files: FileInfo[] = [
        {
          uri: 'file:///path/to/test.jpg',
          name: 'test.jpg',
          size: 1024 * 1024,
          type: 'image/jpeg',
        },
      ];

      const result = validateFiles(files, existingItems, config);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject too many files', () => {
      const files: FileInfo[] = Array.from({ length: 6 }, (_, i) => ({
        uri: `file:///path/to/test${i}.jpg`,
        name: `test${i}.jpg`,
        size: 1024,
        type: 'image/jpeg',
      }));

      const result = validateFiles(files, existingItems, config);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('up to 5 files');
    });

    it('should reject invalid file types', () => {
      const files: FileInfo[] = [
        {
          uri: 'file:///path/to/test.pdf',
          name: 'test.pdf',
          size: 1024,
          type: 'application/pdf',
        },
      ];

      const result = validateFiles(files, existingItems, config);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('should reject files that are too large', () => {
      const files: FileInfo[] = [
        {
          uri: 'file:///path/to/large.jpg',
          name: 'large.jpg',
          size: 11 * 1024 * 1024, // 11MB
          type: 'image/jpeg',
        },
      ];

      const result = validateFiles(files, existingItems, config);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should reject duplicate files', () => {
      const files: FileInfo[] = [
        {
          uri: 'file:///path/to/existing.jpg',
          name: 'existing.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      const result = validateFiles(files, existingItems, config);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('already in the upload list');
    });

    it('should use default allowed types when not specified', () => {
      const configWithoutTypes = {
        maxFiles: 5,
        maxFileSizeBytes: 10 * 1024 * 1024,
      };

      const files: FileInfo[] = [
        {
          uri: 'file:///path/to/test.jpg',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      const result = validateFiles(files, existingItems, configWithoutTypes);
      expect(result.isValid).toBe(true);
    });
  });

  describe('createFileDescriptors', () => {
    it('should create file descriptors with unique IDs', () => {
      const files: FileInfo[] = [
        {
          uri: 'file:///path/to/test1.jpg',
          name: 'test1.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
        {
          uri: 'file:///path/to/test2.jpg',
          name: 'test2.jpg',
          size: 2048,
          type: 'image/png',
        },
      ];

      const descriptors = createFileDescriptors(files);

      expect(descriptors).toHaveLength(2);
      expect(descriptors[0].id).toBeTruthy();
      expect(descriptors[1].id).toBeTruthy();
      expect(descriptors[0].id).not.toBe(descriptors[1].id);
      expect(descriptors[0].name).toBe('test1.jpg');
      expect(descriptors[0].size).toBe(1024);
      expect(descriptors[0].type).toBe('image/jpeg');
      expect(descriptors[0].uri).toBe('file:///path/to/test1.jpg');
    });
  });

  describe('useFileValidation hook', () => {
    it('should initialize with no validation error', () => {
      const { result } = renderHook(() => useFileValidation(existingItems, config));

      expect(result.current.validationError).toBeNull();
    });

    it('should validate files and set error when invalid', () => {
      const { result } = renderHook(() => useFileValidation(existingItems, config));

      const invalidFiles: FileInfo[] = [
        {
          uri: 'file:///path/to/test.pdf',
          name: 'test.pdf',
          size: 1024,
          type: 'application/pdf',
        },
      ];

      act(() => {
        const isValid = result.current.validateAndSetError(invalidFiles);
        expect(isValid).toBe(false);
      });

      expect(result.current.validationError).toContain('Unsupported file type');
    });

    it('should clear validation error', () => {
      const { result } = renderHook(() => useFileValidation(existingItems, config));

      const invalidFiles: FileInfo[] = [
        {
          uri: 'file:///path/to/test.pdf',
          name: 'test.pdf',
          size: 1024,
          type: 'application/pdf',
        },
      ];

      act(() => {
        result.current.validateAndSetError(invalidFiles);
      });

      expect(result.current.validationError).toBeTruthy();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.validationError).toBeNull();
    });

    it('should return true for valid files', () => {
      const { result } = renderHook(() => useFileValidation(existingItems, config));

      const validFiles: FileInfo[] = [
        {
          uri: 'file:///path/to/test.jpg',
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      act(() => {
        const isValid = result.current.validateAndSetError(validFiles);
        expect(isValid).toBe(true);
      });

      expect(result.current.validationError).toBeNull();
    });

    it('should update validation when existingItems change', () => {
      const { result, rerender } = renderHook(({ items }) => useFileValidation(items, config), {
        initialProps: { items: existingItems },
      });

      const files: FileInfo[] = [
        {
          uri: 'file:///path/to/new.jpg',
          name: 'new.jpg',
          size: 1024,
          type: 'image/jpeg',
        },
      ];

      act(() => {
        result.current.validateAndSetError(files);
      });

      expect(result.current.validationError).toBeNull();

      // Add a new existing item that matches the file
      const newExistingItems: UploadItem[] = [
        ...existingItems,
        {
          file: {
            id: 'new-1',
            name: 'new.jpg',
            size: 1024,
            type: 'image/jpeg',
          },
          status: 'uploading',
          progress: {
            uploadedBytes: 512,
            totalBytes: 1024,
            percent: 50,
          },
          retries: 0,
        },
      ];

      rerender({ items: newExistingItems });

      act(() => {
        result.current.validateAndSetError(files);
      });

      expect(result.current.validationError).toContain('already in the upload list');
    });
  });
});
