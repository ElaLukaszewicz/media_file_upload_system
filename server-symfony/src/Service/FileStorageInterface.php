<?php

namespace App\Service;

interface FileStorageInterface
{
    /**
     * Store final file and return file ID
     */
    public function storeFile(string $tempFilePath, string $fileName, string $mimeType, string $fileHash): string;

    /**
     * Check if file with given hash already exists (deduplication)
     */
    public function findFileByHash(string $fileHash): ?string;

    /**
     * Cleanup files older than retention days
     */
    public function cleanupOldFiles(int $retentionDays): int;

    /**
     * Get file path by file ID
     */
    public function getFilePath(string $fileId): ?string;
}

