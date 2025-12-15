<?php

namespace App\Entity;

class UploadSession
{
    public function __construct(
        public readonly string $uploadId,
        public readonly string $fileName,
        public readonly int $fileSize,
        public readonly string $mimeType,
        public readonly string $fileHash,
        public readonly int $chunkSize,
        public readonly int $totalChunks,
        public readonly \DateTimeImmutable $createdAt,
        public array $uploadedChunks = [],
        public ?string $fileId = null,
        public ?\DateTimeImmutable $completedAt = null,
        public ?string $error = null,
    ) {
    }

    public function isCompleted(): bool
    {
        return $this->fileId !== null && count($this->uploadedChunks) === $this->totalChunks;
    }

    public function isInProgress(): bool
    {
        return $this->fileId === null && $this->error === null;
    }

    public function hasError(): bool
    {
        return $this->error !== null;
    }

    public function addChunk(int $chunkIndex): void
    {
        if (!in_array($chunkIndex, $this->uploadedChunks, true)) {
            $this->uploadedChunks[] = $chunkIndex;
            sort($this->uploadedChunks);
        }
    }

    public function getProgress(): float
    {
        if ($this->totalChunks === 0) {
            return 0.0;
        }
        return (count($this->uploadedChunks) / $this->totalChunks) * 100;
    }

    public function isTimedOut(int $timeoutSeconds): bool
    {
        $now = new \DateTimeImmutable();
        $elapsed = $now->getTimestamp() - $this->createdAt->getTimestamp();
        return $elapsed > $timeoutSeconds;
    }
}

