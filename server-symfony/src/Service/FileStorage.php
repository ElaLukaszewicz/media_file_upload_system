<?php

namespace App\Service;

use Symfony\Component\Uid\Uuid;

class FileStorage implements FileStorageInterface
{
    private const HASH_INDEX_FILE = 'hash_index.json';

    public function __construct(
        private readonly string $uploadDir,
    ) {
        $this->ensureDirectoryExists($this->uploadDir);
    }

    public function storeFile(string $tempFilePath, string $fileName, string $mimeType, string $fileHash): string
    {
        // Check for existing file with same hash (deduplication)
        $existingFileId = $this->findFileByHash($fileHash);
        if ($existingFileId !== null) {
            // Delete temp file since we're using existing one
            if (file_exists($tempFilePath)) {
                unlink($tempFilePath);
            }
            return $existingFileId;
        }

        // Generate file ID
        $fileId = Uuid::v4()->toRfc4122();
        
        // Organize by date (YYYY/MM/DD)
        $now = new \DateTimeImmutable();
        $datePath = $now->format('Y/m/d');
        $storageDir = $this->uploadDir . '/files/' . $datePath;
        $this->ensureDirectoryExists($storageDir);

        // Get file extension from original filename
        $extension = pathinfo($fileName, PATHINFO_EXTENSION);
        $extension = $extension ? '.' . $extension : '';
        
        // Store file
        $finalPath = $storageDir . '/' . $fileId . $extension;
        if (!copy($tempFilePath, $finalPath)) {
            throw new \RuntimeException('Failed to store file');
        }

        // Update hash index for deduplication
        $this->addToHashIndex($fileHash, $fileId);

        return $fileId;
    }

    public function findFileByHash(string $fileHash): ?string
    {
        $hashIndex = $this->loadHashIndex();
        return $hashIndex[$fileHash] ?? null;
    }

    public function cleanupOldFiles(int $retentionDays): int
    {
        $filesDir = $this->uploadDir . '/files';
        if (!is_dir($filesDir)) {
            return 0;
        }

        $cutoffTimestamp = (new \DateTimeImmutable("-{$retentionDays} days"))->getTimestamp();
        $cleanedCount = 0;
        $hashIndex = $this->loadHashIndex();
        $removedFileIds = [];

        // Recursively iterate through files directory
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($filesDir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getMTime() < $cutoffTimestamp) {
                // Get file ID from filename
                $fileId = pathinfo($file->getFilename(), PATHINFO_FILENAME);
                $removedFileIds[] = $fileId;
                unlink($file->getPathname());
                $cleanedCount++;
            }
        }

        // Remove deleted file IDs from hash index
        if (!empty($removedFileIds)) {
            foreach ($removedFileIds as $fileId) {
                // Find and remove hash entry for this file ID
                foreach ($hashIndex as $hash => $id) {
                    if ($id === $fileId) {
                        unset($hashIndex[$hash]);
                        break;
                    }
                }
            }
            $this->saveHashIndex($hashIndex);
        }

        // Clean up empty directories
        $this->cleanupEmptyDirectories($filesDir);

        return $cleanedCount;
    }

    public function getFilePath(string $fileId): ?string
    {
        $filesDir = $this->uploadDir . '/files';
        if (!is_dir($filesDir)) {
            return null;
        }
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($filesDir, \RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $fileName = pathinfo($file->getFilename(), PATHINFO_FILENAME);
                if ($fileName === $fileId) {
                    return $file->getPathname();
                }
            }
        }

        return null;
    }

    private function getHashIndexFile(): string
    {
        return $this->uploadDir . '/' . self::HASH_INDEX_FILE;
    }

    private function loadHashIndex(): array
    {
        $indexFile = $this->getHashIndexFile();
        if (!file_exists($indexFile)) {
            return [];
        }

        $content = file_get_contents($indexFile);
        if ($content === false) {
            return [];
        }

        $index = json_decode($content, true);
        return is_array($index) ? $index : [];
    }

    private function saveHashIndex(array $index): void
    {
        $indexFile = $this->getHashIndexFile();
        file_put_contents($indexFile, json_encode($index, JSON_PRETTY_PRINT));
    }

    private function addToHashIndex(string $fileHash, string $fileId): void
    {
        $index = $this->loadHashIndex();
        $index[$fileHash] = $fileId;
        $this->saveHashIndex($index);
    }

    private function ensureDirectoryExists(string $dir): void
    {
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
    }

    private function deleteDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            is_dir($path) ? $this->deleteDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }

    private function cleanupEmptyDirectories(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iterator as $file) {
            if ($file->isDir()) {
                $path = $file->getPathname();
                if (count(scandir($path)) === 2) { // Only . and ..
                    rmdir($path);
                }
            }
        }
    }
}

