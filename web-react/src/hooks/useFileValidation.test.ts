import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFileValidation, createFileDescriptors, validateFiles } from './useFileValidation';
import type { UploadItem } from '@shared/uploadState';

// Mock URL.createObjectURL for tests
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-url');
});

describe('useFileValidation', () => {
  const mockExistingItems: UploadItem[] = [
    {
      file: {
        id: 'existing-1',
        name: 'existing.jpg',
        size: 1024,
        type: 'image/jpeg',
      },
      status: 'completed',
      progress: { uploadedBytes: 1024, totalBytes: 1024, percent: 100 },
      retries: 0,
    },
  ];

  const config = {
    maxFiles: 10,
    maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['image/', 'video/'],
  };

  it('returns initial state with no error', () => {
    const { result } = renderHook(() => useFileValidation(mockExistingItems, config));
    expect(result.current.validationError).toBeNull();
    expect(typeof result.current.validateAndSetError).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
  });

  it('validates and sets error for too many files', () => {
    const { result } = renderHook(() => useFileValidation(mockExistingItems, config));
    const files = Array.from({ length: 11 }, (_, i) => new File([], `file${i}.jpg`, { type: 'image/jpeg' }));

    act(() => {
      const isValid = result.current.validateAndSetError(files);
      expect(isValid).toBe(false);
    });

    expect(result.current.validationError).toContain('You can select up to 10 files');
  });

  it('validates and sets error for invalid file type', () => {
    const { result } = renderHook(() => useFileValidation(mockExistingItems, config));
    const file = new File([], 'document.pdf', { type: 'application/pdf' });

    act(() => {
      const isValid = result.current.validateAndSetError([file]);
      expect(isValid).toBe(false);
    });

    expect(result.current.validationError).toContain('Unsupported file type');
  });

  it('validates and sets error for file too large', () => {
    const { result } = renderHook(() => useFileValidation(mockExistingItems, config));
    const largeFile = new File([new ArrayBuffer(101 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

    act(() => {
      const isValid = result.current.validateAndSetError([largeFile]);
      expect(isValid).toBe(false);
    });

    expect(result.current.validationError).toContain('too large');
  });

  it('validates and sets error for duplicate files', () => {
    const { result } = renderHook(() => useFileValidation(mockExistingItems, config));
    const duplicateFile = new File([], 'existing.jpg', { type: 'image/jpeg' });
    Object.defineProperty(duplicateFile, 'size', { value: 1024 });

    act(() => {
      const isValid = result.current.validateAndSetError([duplicateFile]);
      expect(isValid).toBe(false);
    });

    expect(result.current.validationError).toContain('already in the upload list');
  });

  it('returns true for valid files', () => {
    const { result } = renderHook(() => useFileValidation(mockExistingItems, config));
    const validFile = new File([], 'new.jpg', { type: 'image/jpeg' });

    act(() => {
      const isValid = result.current.validateAndSetError([validFile]);
      expect(isValid).toBe(true);
    });

    expect(result.current.validationError).toBeNull();
  });

  it('clears error when clearError is called', () => {
    const { result } = renderHook(() => useFileValidation(mockExistingItems, config));
    const invalidFile = new File([], 'document.pdf', { type: 'application/pdf' });

    act(() => {
      result.current.validateAndSetError([invalidFile]);
    });

    expect(result.current.validationError).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.validationError).toBeNull();
  });
});

describe('validateFiles', () => {
  const mockExistingItems: UploadItem[] = [];
  const config = {
    maxFiles: 5,
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/', 'video/'],
  };

  it('returns valid for empty files array', () => {
    const result = validateFiles([], mockExistingItems, config);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeNull();
  });

  it('returns invalid for too many files', () => {
    const files = Array.from({ length: 6 }, (_, i) => new File([], `file${i}.jpg`, { type: 'image/jpeg' }));
    const result = validateFiles(files, mockExistingItems, config);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('up to 5 files');
  });

  it('returns valid for correct number of files', () => {
    const files = Array.from({ length: 3 }, (_, i) => new File([], `file${i}.jpg`, { type: 'image/jpeg' }));
    const result = validateFiles(files, mockExistingItems, config);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
  });
});

describe('createFileDescriptors', () => {
  it('creates descriptors with correct structure', () => {
    const file1 = new File([], 'test1.jpg', { type: 'image/jpeg' });
    const file2 = new File([], 'test2.mp4', { type: 'video/mp4' });

    const descriptors = createFileDescriptors([file1, file2]);

    expect(descriptors).toHaveLength(2);
    expect(descriptors[0]).toMatchObject({
      name: 'test1.jpg',
      size: 0,
      type: 'image/jpeg',
    });
    expect(descriptors[0].id).toBeDefined();
    expect(descriptors[0].previewUrl).toBeDefined();
    expect(descriptors[0].previewUrl).toMatch(/^blob:/);

    expect(descriptors[1]).toMatchObject({
      name: 'test2.mp4',
      size: 0,
      type: 'video/mp4',
    });
  });

  it('creates unique IDs for each file', async () => {
    const file = new File([], 'test.jpg', { type: 'image/jpeg' });
    const descriptors1 = createFileDescriptors([file]);
    
    // Wait a bit to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 10));
    
    const descriptors2 = createFileDescriptors([file]);

    expect(descriptors1[0].id).not.toBe(descriptors2[0].id);
    expect(descriptors1[0].id).toContain('test.jpg');
    expect(descriptors2[0].id).toContain('test.jpg');
  });
});

