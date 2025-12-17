import { describe, it, expect, beforeEach } from 'vitest';
import { computeFileHash } from './fileHash';

// Mock Blob.slice to ensure arrayBuffer works
const originalSlice = Blob.prototype.slice;
beforeEach(() => {
  Blob.prototype.slice = function (start?: number, end?: number) {
    const sliced = originalSlice.call(this, start, end);
    // Ensure arrayBuffer exists on sliced blob
    if (!sliced.arrayBuffer) {
      Object.defineProperty(sliced, 'arrayBuffer', {
        value: async function () {
          const reader = new FileReader();
          return new Promise<ArrayBuffer>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(sliced);
          });
        },
        writable: true,
        configurable: true,
      });
    }
    return sliced;
  };
});

describe('fileHash', () => {
  describe('computeFileHash', () => {
    it('should compute hash for a file', async () => {
      const content = 'Hello World';
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], 'test.txt', { type: 'text/plain' });

      const hash = await computeFileHash(file);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should compute consistent hash for same file', async () => {
      const content = 'Test content';
      const blob = new Blob([content], { type: 'text/plain' });
      const file1 = new File([blob], 'test1.txt', { type: 'text/plain' });
      const file2 = new File([blob], 'test2.txt', { type: 'text/plain' });

      const hash1 = await computeFileHash(file1);
      const hash2 = await computeFileHash(file2);

      expect(hash1).toBe(hash2);
    });

    it('should compute different hash for different content', async () => {
      const file1 = new File(['Content 1'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['Content 2'], 'test2.txt', { type: 'text/plain' });

      const hash1 = await computeFileHash(file1);
      const hash2 = await computeFileHash(file2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle large files by processing in chunks', async () => {
      // Create a file larger than 2MB
      const largeContent = 'A'.repeat(3 * 1024 * 1024); // 3MB
      const blob = new Blob([largeContent], { type: 'text/plain' });
      const file = new File([blob], 'large.txt', { type: 'text/plain' });

      const hash = await computeFileHash(file);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('should handle empty file', async () => {
      const file = new File([], 'empty.txt', { type: 'text/plain' });

      const hash = await computeFileHash(file);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });
  });
});
