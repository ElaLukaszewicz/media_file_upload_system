import * as FileSystem from 'expo-file-system/legacy';
import { computeFileHash } from './fileHash';

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

describe('fileHash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('computeFileHash', () => {
    it('should compute hash for a valid file', async () => {
      const fileUri = 'file:///path/to/file.jpg';
      const base64Content = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 11,
      });

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(base64Content);

      const hash = await computeFileHash(fileUri);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(FileSystem.getInfoAsync).toHaveBeenCalledWith(fileUri);
      expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    });

    it('should throw error if file does not exist', async () => {
      const fileUri = 'file:///path/to/nonexistent.jpg';

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
        size: 0,
      });

      await expect(computeFileHash(fileUri)).rejects.toThrow('File does not exist or has no size');
    });

    it('should throw error if file has no size', async () => {
      const fileUri = 'file:///path/to/empty.jpg';

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 0,
      });

      await expect(computeFileHash(fileUri)).rejects.toThrow('File does not exist or has no size');
    });

    it('should handle large files by processing in chunks', async () => {
      const fileUri = 'file:///path/to/large.jpg';
      // Create a large base64 string (simulating >2MB file)
      const largeBase64 = 'A'.repeat(3 * 1024 * 1024); // 3MB of 'A' characters

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 3 * 1024 * 1024,
      });

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(largeBase64);

      const hash = await computeFileHash(fileUri);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('should handle errors during file reading', async () => {
      const fileUri = 'file:///path/to/file.jpg';
      const error = new Error('Read error');

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 100,
      });

      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(error);

      await expect(computeFileHash(fileUri)).rejects.toThrow('Failed to compute file hash');
    });

    it('should handle errors during file info check', async () => {
      const fileUri = 'file:///path/to/file.jpg';
      const error = new Error('Info error');

      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(error);

      await expect(computeFileHash(fileUri)).rejects.toThrow('Failed to compute file hash');
    });

    it('should handle non-Error exceptions', async () => {
      const fileUri = 'file:///path/to/file.jpg';

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 100,
      });

      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue('String error');

      await expect(computeFileHash(fileUri)).rejects.toThrow('Failed to compute file hash');
    });
  });
});
