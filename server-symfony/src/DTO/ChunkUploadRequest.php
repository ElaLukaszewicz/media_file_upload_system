<?php

namespace App\DTO;

class ChunkUploadRequest
{
    public function __construct(
        public readonly string $uploadId,
        public readonly int $chunkIndex,
        public readonly string $chunkData,
    ) {
    }
}

