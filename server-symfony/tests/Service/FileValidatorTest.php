<?php

namespace App\Tests\Service;

use App\Service\FileValidator;
use PHPUnit\Framework\TestCase;

class FileValidatorTest extends TestCase
{
    private FileValidator $validator;

    protected function setUp(): void
    {
        $this->validator = new FileValidator(104857600);
    }

    public function testValidateMimeTypeWithValidImageTypes(): void
    {
        $this->assertTrue($this->validator->validateMimeType('image/jpeg'));
        $this->assertTrue($this->validator->validateMimeType('image/png'));
        $this->assertTrue($this->validator->validateMimeType('image/gif'));
    }

    public function testValidateMimeTypeWithValidVideoTypes(): void
    {
        $this->assertTrue($this->validator->validateMimeType('video/mp4'));
        $this->assertTrue($this->validator->validateMimeType('video/webm'));
    }

    public function testValidateMimeTypeWithInvalidTypes(): void
    {
        $this->assertFalse($this->validator->validateMimeType('application/pdf'));
        $this->assertFalse($this->validator->validateMimeType('text/plain'));
        $this->assertFalse($this->validator->validateMimeType('application/zip'));
    }

    public function testValidateFileSize(): void
    {
        $this->assertTrue($this->validator->validateFileSize(1024));
        $this->assertTrue($this->validator->validateFileSize(104857600)); // 100MB
        $this->assertFalse($this->validator->validateFileSize(104857601)); // > 100MB
        $this->assertFalse($this->validator->validateFileSize(0));
        $this->assertFalse($this->validator->validateFileSize(-1));
    }

    public function testValidateMagicNumberWithJpegFile(): void
    {
        $tempFile = sys_get_temp_dir() . '/test_jpeg_' . uniqid() . '.jpg';
        file_put_contents($tempFile, "\xFF\xD8\xFF\xE0\x00\x10JFIF" . str_repeat("\x00", 1000));

        try {
            $result = $this->validator->validateMagicNumber($tempFile);
            $this->assertTrue($result);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }

    public function testValidateMagicNumberWithPngFile(): void
    {
        $tempFile = sys_get_temp_dir() . '/test_png_' . uniqid() . '.png';
        file_put_contents($tempFile, "\x89\x50\x4E\x47\x0D\x0A\x1A\x0A" . str_repeat("\x00", 1000));

        try {
            $result = $this->validator->validateMagicNumber($tempFile);
            $this->assertTrue($result);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }

    public function testValidateMagicNumberWithInvalidFile(): void
    {
        $tempFile = sys_get_temp_dir() . '/test_invalid_' . uniqid() . '.txt';
        file_put_contents($tempFile, "This is not a valid image or video file");

        try {
            $result = $this->validator->validateMagicNumber($tempFile);
            $this->assertFalse($result);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }

    public function testValidateMagicNumberWithNonExistentFile(): void
    {
        $result = $this->validator->validateMagicNumber('/non/existent/file.jpg');
        $this->assertFalse($result);
    }

    public function testValidateMagicNumberWithWebpRiffHeader(): void
    {
        $tempFile = sys_get_temp_dir() . '/test_webp_' . uniqid() . '.webp';
        file_put_contents($tempFile, "RIFF" . str_repeat("\x00", 4) . "WEBP" . str_repeat("\x00", 8));

        try {
            $result = $this->validator->validateMagicNumber($tempFile);
            $this->assertTrue($result);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }

    public function testValidateMagicNumberWithMp4Brand(): void
    {
        $tempFile = sys_get_temp_dir() . '/test_mp4_' . uniqid() . '.mp4';
        // [size][ftyp][brand]
        file_put_contents($tempFile, "\x00\x00\x00\x20" . "ftyp" . "isom" . str_repeat("\x00", 8));

        try {
            $result = $this->validator->validateMagicNumber($tempFile);
            $this->assertTrue($result);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }

    public function testValidateMagicNumberWithQuickTimeBrand(): void
    {
        $tempFile = sys_get_temp_dir() . '/test_mov_' . uniqid() . '.mov';
        file_put_contents($tempFile, "\x00\x00\x00\x20" . "ftyp" . "qt  " . str_repeat("\x00", 8));

        try {
            $result = $this->validator->validateMagicNumber($tempFile);
            $this->assertTrue($result);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }

    public function testValidateMagicNumberWithShortHeader(): void
    {
        $tempFile = sys_get_temp_dir() . '/test_short_' . uniqid();
        file_put_contents($tempFile, "\x00");

        try {
            $result = $this->validator->validateMagicNumber($tempFile);
            $this->assertFalse($result);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }

    public function testGetAllowedMimeTypes(): void
    {
        $types = $this->validator->getAllowedMimeTypes();
        $this->assertIsArray($types);
        $this->assertContains('image/jpeg', $types);
        $this->assertContains('image/png', $types);
        $this->assertContains('video/mp4', $types);
    }
}

