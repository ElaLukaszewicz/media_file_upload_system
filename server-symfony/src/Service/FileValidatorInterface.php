<?php

namespace App\Service;

interface FileValidatorInterface
{
    /**
     * Validate file by MIME type
     */
    public function validateMimeType(string $mimeType): bool;

    /**
     * Validate file by magic number detection
     */
    public function validateMagicNumber(string $filePath): bool;

    /**
     * Validate file size
     */
    public function validateFileSize(int $fileSize): bool;

    /**
     * Get allowed MIME types
     *
     * @return string[]
     */
    public function getAllowedMimeTypes(): array;
}

