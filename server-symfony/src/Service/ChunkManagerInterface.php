<?php

namespace App\Service;

use App\Entity\UploadSession;

interface ChunkManagerInterface
{
    public function createSession(string $uploadId, UploadSession $session): void;

    public function getSession(string $uploadId): ?UploadSession;

    public function saveChunk(string $uploadId, int $chunkIndex, string $chunkData): void;

    public function hasChunk(string $uploadId, int $chunkIndex): bool;

    public function reassembleFile(UploadSession $session): string;

    public function cleanupIncompleteChunks(int $timeoutSeconds): int;

    public function updateSession(UploadSession $session): void;

    public function cleanupChunks(string $uploadId): void;
}

