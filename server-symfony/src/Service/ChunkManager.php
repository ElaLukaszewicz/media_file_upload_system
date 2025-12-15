<?php

namespace App\Service;

use App\Entity\UploadSession;

class ChunkManager implements ChunkManagerInterface
{
    private const SESSIONS_FILE = 'sessions.json';

    public function __construct(
        private readonly string $uploadDir,
        private readonly int $chunkTimeout = 1800,
    ) {
        $this->ensureDirectoryExists($this->uploadDir);
        $this->ensureDirectoryExists($this->getChunksDir());
    }

    public function createSession(string $uploadId, UploadSession $session): void
    {
        $sessions = $this->loadSessions();
        $sessions[$uploadId] = $this->serializeSession($session);
        $this->saveSessions($sessions);
    }

    public function getSession(string $uploadId): ?UploadSession
    {
        $sessions = $this->loadSessions();
        if (!isset($sessions[$uploadId])) {
            return null;
        }

        return $this->deserializeSession($sessions[$uploadId]);
    }

    public function saveChunk(string $uploadId, int $chunkIndex, string $chunkData): void
    {
        $chunkDir = $this->getChunkDirectory($uploadId);
        $this->ensureDirectoryExists($chunkDir);

        $chunkPath = $this->getChunkPath($uploadId, $chunkIndex);
        file_put_contents($chunkPath, $chunkData);

        // Update session to mark chunk as uploaded
        $session = $this->getSession($uploadId);
        if ($session) {
            $session->addChunk($chunkIndex);
            $this->updateSession($session);
        }
    }

    public function hasChunk(string $uploadId, int $chunkIndex): bool
    {
        $chunkPath = $this->getChunkPath($uploadId, $chunkIndex);
        return file_exists($chunkPath);
    }

    public function reassembleFile(UploadSession $session): string
    {
        $outputPath = $this->getTempFilePath($session->uploadId);
        
        $outputHandle = fopen($outputPath, 'wb');
        if (!$outputHandle) {
            throw new \RuntimeException('Failed to create output file for reassembly');
        }

        try {
            for ($i = 0; $i < $session->totalChunks; $i++) {
                $chunkPath = $this->getChunkPath($session->uploadId, $i);
                
                if (!file_exists($chunkPath)) {
                    throw new \RuntimeException("Missing chunk {$i} for upload {$session->uploadId}");
                }

                $chunkData = file_get_contents($chunkPath);
                if ($chunkData === false) {
                    throw new \RuntimeException("Failed to read chunk {$i}");
                }

                fwrite($outputHandle, $chunkData);
            }
        } finally {
            fclose($outputHandle);
        }

        return $outputPath;
    }

    public function cleanupIncompleteChunks(int $timeoutSeconds): int
    {
        $sessions = $this->loadSessions();
        $cleanedCount = 0;
        $now = time();

        foreach ($sessions as $uploadId => $sessionData) {
            $session = $this->deserializeSession($sessionData);
            
            if ($session->isTimedOut($timeoutSeconds) && !$session->isCompleted()) {
                // Delete chunks
                $chunkDir = $this->getChunkDirectory($uploadId);
                if (is_dir($chunkDir)) {
                    $this->deleteDirectory($chunkDir);
                }

                // Remove session
                unset($sessions[$uploadId]);
                $cleanedCount++;
            }
        }

        if ($cleanedCount > 0) {
            $this->saveSessions($sessions);
        }

        return $cleanedCount;
    }

    public function updateSession(UploadSession $session): void
    {
        $sessions = $this->loadSessions();
        $sessions[$session->uploadId] = $this->serializeSession($session);
        $this->saveSessions($sessions);
    }

    public function cleanupChunks(string $uploadId): void
    {
        $chunkDir = $this->getChunkDirectory($uploadId);
        if (is_dir($chunkDir)) {
            $this->deleteDirectory($chunkDir);
        }
    }

    private function getChunksDir(): string
    {
        return $this->uploadDir . '/chunks';
    }

    private function getChunkDirectory(string $uploadId): string
    {
        return $this->getChunksDir() . '/' . $uploadId;
    }

    private function getChunkPath(string $uploadId, int $chunkIndex): string
    {
        return $this->getChunkDirectory($uploadId) . '/' . $chunkIndex;
    }

    private function getTempFilePath(string $uploadId): string
    {
        $tempDir = $this->uploadDir . '/temp';
        $this->ensureDirectoryExists($tempDir);
        return $tempDir . '/' . $uploadId;
    }

    private function getSessionsFile(): string
    {
        return $this->uploadDir . '/' . self::SESSIONS_FILE;
    }

    private function loadSessions(): array
    {
        $sessionsFile = $this->getSessionsFile();
        if (!file_exists($sessionsFile)) {
            return [];
        }

        $content = file_get_contents($sessionsFile);
        if ($content === false) {
            return [];
        }

        $sessions = json_decode($content, true);
        return is_array($sessions) ? $sessions : [];
    }

    private function saveSessions(array $sessions): void
    {
        $sessionsFile = $this->getSessionsFile();
        file_put_contents($sessionsFile, json_encode($sessions, JSON_PRETTY_PRINT));
    }

    private function serializeSession(UploadSession $session): array
    {
        return [
            'uploadId' => $session->uploadId,
            'fileName' => $session->fileName,
            'fileSize' => $session->fileSize,
            'mimeType' => $session->mimeType,
            'fileHash' => $session->fileHash,
            'chunkSize' => $session->chunkSize,
            'totalChunks' => $session->totalChunks,
            'uploadedChunks' => $session->uploadedChunks,
            'fileId' => $session->fileId,
            'createdAt' => $session->createdAt->format('c'),
            'completedAt' => $session->completedAt?->format('c'),
            'error' => $session->error,
        ];
    }

    private function deserializeSession(array $data): UploadSession
    {
        return new UploadSession(
            uploadId: $data['uploadId'],
            fileName: $data['fileName'],
            fileSize: $data['fileSize'],
            mimeType: $data['mimeType'],
            fileHash: $data['fileHash'],
            chunkSize: $data['chunkSize'],
            totalChunks: $data['totalChunks'],
            createdAt: new \DateTimeImmutable($data['createdAt']),
            uploadedChunks: $data['uploadedChunks'] ?? [],
            fileId: $data['fileId'] ?? null,
            completedAt: isset($data['completedAt']) ? new \DateTimeImmutable($data['completedAt']) : null,
            error: $data['error'] ?? null,
        );
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
}

