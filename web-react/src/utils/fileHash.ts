import SparkMD5 from 'spark-md5';

/**
 * Computes MD5 hash of a File object asynchronously
 * Uses chunked reading to handle large files efficiently
 */
export async function computeFileHash(file: File): Promise<string> {
  const spark = new SparkMD5.ArrayBuffer();
  const chunkSize = 2097152; // 2MB chunks for hashing
  const chunks = Math.ceil(file.size / chunkSize);

  for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    const arrayBuffer = await chunk.arrayBuffer();
    spark.append(arrayBuffer);
  }

  return spark.end();
}
