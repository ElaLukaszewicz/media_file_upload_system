import * as ImagePicker from 'expo-image-picker';
import {
  formatFileSize,
  getFileExtension,
  getMimeType,
  processImagePickerAssets,
  formatDate,
  type ProcessedFile,
} from './fileUtils';

describe('fileUtils', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension from URI', () => {
      expect(getFileExtension('file.jpg')).toBe('jpg');
      expect(getFileExtension('path/to/file.png')).toBe('png');
      expect(getFileExtension('file.mp4')).toBe('mp4');
      expect(getFileExtension('file')).toBe('jpg'); // Default fallback
      expect(getFileExtension('file.')).toBe('jpg'); // Default fallback
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME type for images', () => {
      expect(getMimeType('image', 'jpg')).toBe('image/jpeg');
      expect(getMimeType('image', 'jpeg')).toBe('image/jpeg');
      expect(getMimeType('image', 'png')).toBe('image/png');
      expect(getMimeType('image', 'gif')).toBe('image/gif');
    });

    it('should return correct MIME type for videos', () => {
      expect(getMimeType('video', 'mp4')).toBe('video/mp4');
      expect(getMimeType('video', 'mov')).toBe('video/mov');
      expect(getMimeType('video', 'avi')).toBe('video/avi');
    });
  });

  describe('processImagePickerAssets', () => {
    it('should process ImagePicker assets correctly', () => {
      const assets: ImagePicker.ImagePickerAsset[] = [
        {
          uri: 'file:///path/to/image.jpg',
          fileName: 'image.jpg',
          fileSize: 1024 * 1024,
          type: 'image',
          width: 100,
          height: 100,
        },
        {
          uri: 'file:///path/to/video.mp4',
          fileName: 'video.mp4',
          fileSize: 5 * 1024 * 1024,
          type: 'video',
          width: 1920,
          height: 1080,
        },
      ];

      const processed = processImagePickerAssets(assets);

      expect(processed).toHaveLength(2);
      expect(processed[0]).toEqual({
        uri: 'file:///path/to/image.jpg',
        name: 'image.jpg',
        size: 1024 * 1024,
        type: 'image/jpeg',
      });
      expect(processed[1]).toEqual({
        uri: 'file:///path/to/video.mp4',
        name: 'video.mp4',
        size: 5 * 1024 * 1024,
        type: 'video/mp4',
      });
    });

    it('should generate default filename when fileName is missing', () => {
      const assets: ImagePicker.ImagePickerAsset[] = [
        {
          uri: 'file:///path/to/image.jpg',
          type: 'image',
          width: 100,
          height: 100,
        },
      ];

      const processed = processImagePickerAssets(assets);
      expect(processed[0].name).toMatch(/^file-\d+\.jpg$/);
    });

    it('should handle missing fileSize', () => {
      const assets: ImagePicker.ImagePickerAsset[] = [
        {
          uri: 'file:///path/to/image.jpg',
          fileName: 'image.jpg',
          type: 'image',
          width: 100,
          height: 100,
        },
      ];

      const processed = processImagePickerAssets(assets);
      expect(processed[0].size).toBe(0);
    });
  });

  describe('formatDate', () => {
    it('should format ISO date string correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDate(date.toISOString());

      // Check that it contains expected parts
      expect(formatted).toContain('2024');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toMatch(/\d{2}:\d{2}/); // Time format
    });

    it('should handle different dates', () => {
      const date1 = new Date('2023-12-25T00:00:00Z');
      const formatted1 = formatDate(date1.toISOString());
      expect(formatted1).toContain('2023');
      expect(formatted1).toContain('Dec');
      expect(formatted1).toContain('25');
    });
  });
});
