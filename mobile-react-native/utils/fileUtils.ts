import * as ImagePicker from 'expo-image-picker';

/**
 * Utility functions for file handling and formatting
 */

export interface ProcessedFile {
  uri: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Formats file size in bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Extracts file extension from URI
 */
export function getFileExtension(uri: string): string {
  const parts = uri.split('.');
  const extension = parts.length > 1 ? parts.pop() : undefined;
  return extension && extension.trim().length > 0 ? extension : 'jpg';
}

/**
 * Determines MIME type from ImagePicker asset type and extension
 */
export function getMimeType(assetType: ImagePicker.MediaType, extension: string): string {
  if (assetType === 'image') {
    return `image/${extension === 'jpg' ? 'jpeg' : extension}`;
  }
  return `video/${extension}`;
}

/**
 * Processes ImagePicker assets into a standardized file format
 */
export function processImagePickerAssets(assets: ImagePicker.ImagePickerAsset[]): ProcessedFile[] {
  return assets.map((asset) => {
    const extension = getFileExtension(asset.uri);
    const mimeType = getMimeType(asset.type, extension);

    return {
      uri: asset.uri,
      name: asset.fileName || `file-${Date.now()}.${extension}`,
      size: asset.fileSize || 0,
      type: mimeType,
    };
  });
}

/**
 * Formats date to localized string
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
