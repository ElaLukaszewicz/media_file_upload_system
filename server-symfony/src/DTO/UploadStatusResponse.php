<?php

namespace App\DTO;

class UploadStatusResponse
{
    public function __construct(
        public readonly string $uploadId,
        public readonly string $status,
        public readonly int $uploadedChunks,
        public readonly int $totalChunks,
        public readonly ?string $fileId = null,
        public readonly ?string $error = null,
    ) {
    }

    public function toArray(): array
    {
        return [
            'uploadId' => $this->uploadId,
            'status' => $this->status,
            'uploadedChunks' => $this->uploadedChunks,
            'totalChunks' => $this->totalChunks,
            'fileId' => $this->fileId,
            'error' => $this->error,
        ];
    }
}

