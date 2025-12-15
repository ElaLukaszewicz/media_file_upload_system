<?php

namespace App\DTO;

class UploadInitiateResponse
{
    public function __construct(
        public readonly string $uploadId,
        public readonly int $chunkSize,
        public readonly int $totalChunks,
    ) {
    }

    public function toArray(): array
    {
        return [
            'uploadId' => $this->uploadId,
            'chunkSize' => $this->chunkSize,
            'totalChunks' => $this->totalChunks,
        ];
    }
}

