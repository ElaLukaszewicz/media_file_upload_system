/**
 * Computes MD5 hash of a file URI in React Native
 * Uses expo-file-system to read the file
 * Note: For large files, this reads the entire file into memory
 */
import * as FileSystem from 'expo-file-system/legacy';
import SparkMD5 from 'spark-md5';

export async function computeFileHash(fileUri: string): Promise<string> {
  const spark = new SparkMD5.ArrayBuffer();

  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists || !fileInfo.size) {
      throw new Error('File does not exist or has no size');
    }

    // Read entire file as base64 using FileSystem legacy module
    const base64Content = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Process in chunks to avoid memory issues with very large files
    const chunkSize = 2097152; // 2MB chunks
    const totalSize = bytes.length;
    const chunks = Math.ceil(totalSize / chunkSize);

    for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const chunk = bytes.slice(start, end);
      spark.append(chunk.buffer);
    }

    return spark.end();
  } catch (error) {
    throw new Error(
      `Failed to compute file hash: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
