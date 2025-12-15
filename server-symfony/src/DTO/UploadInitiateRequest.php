<?php

namespace App\DTO;

class UploadInitiateRequest
{
    public function __construct(
        public readonly string $fileName,
        public readonly int $fileSize,
        public readonly string $mimeType,
        public readonly string $fileHash,
    ) {
    }
}

