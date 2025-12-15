<?php

namespace App\Service;

class FileValidator implements FileValidatorInterface
{
    private const ALLOWED_MIME_TYPES = [
        // Images
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        // Videos
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo',
        'video/webm',
        'video/ogg',
    ];

    // Magic numbers for common image and video formats
    private const MAGIC_NUMBERS = [
        // JPEG
        "\xFF\xD8\xFF" => ['image/jpeg', 'image/jpg'],
        // PNG
        "\x89\x50\x4E\x47\x0D\x0A\x1A\x0A" => ['image/png'],
        // GIF
        "GIF87a" => ['image/gif'],
        "GIF89a" => ['image/gif'],
        // WebP (will be checked separately)
        // BMP
        "BM" => ['image/bmp'],
        // TIFF
        "\x49\x49\x2A\x00" => ['image/tiff'], // Little-endian
        "\x4D\x4D\x00\x2A" => ['image/tiff'], // Big-endian
        // MP4
        "\x00\x00\x00\x20\x66\x74\x79\x70" => ['video/mp4'], // ftyp at offset 4
        "\x00\x00\x00\x18\x66\x74\x79\x70" => ['video/mp4'], // ftyp at offset 4
        // MPEG
        "\x00\x00\x01\xB3" => ['video/mpeg'],
        "\x00\x00\x01\xBA" => ['video/mpeg'],
        // QuickTime
        "\x00\x00\x00\x20\x66\x74\x79\x70\x71\x74\x20\x20" => ['video/quicktime'],
        // AVI (will be checked separately via RIFF header)
        // OGG
        "OggS" => ['video/ogg'],
    ];

    public function __construct(
        private readonly int $maxFileSize = 104857600, // 100MB default
    ) {
    }

    public function validateMimeType(string $mimeType): bool
    {
        return in_array(strtolower($mimeType), self::ALLOWED_MIME_TYPES, true);
    }

    public function validateMagicNumber(string $filePath): bool
    {
        if (!file_exists($filePath) || !is_readable($filePath)) {
            return false;
        }

        $handle = fopen($filePath, 'rb');
        if (!$handle) {
            return false;
        }

        // Read first 12 bytes (enough for most magic numbers)
        $header = fread($handle, 12);
        fclose($handle);

        if ($header === false || strlen($header) < 4) {
            return false;
        }

            // Special handling for RIFF files (WebP, WebM, AVI)
            if (substr($header, 0, 4) === "RIFF" && strlen($header) >= 12) {
                $format = substr($header, 8, 4);
                if ($format === "WEBP") {
                    return $this->validateMimeType('image/webp');
                } elseif ($format === "WEBM") {
                    return $this->validateMimeType('video/webm');
                } elseif ($format === "AVI ") {
                    return $this->validateMimeType('video/x-msvideo');
                }
            }

            // Check each magic number pattern
            foreach (self::MAGIC_NUMBERS as $magic => $mimeTypes) {
                $magicLength = strlen($magic);
                
                if (substr($header, 0, $magicLength) === $magic) {
                    // For ftyp patterns, check at offset 4
                    if (str_contains($magic, 'ftyp')) {
                        if (substr($header, 4, 8) === substr($magic, 4)) {
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
            }

        return false;
    }

    public function validateFileSize(int $fileSize): bool
    {
        return $fileSize > 0 && $fileSize <= $this->maxFileSize;
    }

    public function getAllowedMimeTypes(): array
    {
        return self::ALLOWED_MIME_TYPES;
    }
}

