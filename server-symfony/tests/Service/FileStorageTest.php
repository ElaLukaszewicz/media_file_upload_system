<?php

namespace App\Tests\Service;

use App\Service\FileStorage;
use PHPUnit\Framework\TestCase;

class FileStorageTest extends TestCase
{
    private string $testUploadDir;
    private FileStorage $fileStorage;

    protected function setUp(): void
    {
        $this->testUploadDir = sys_get_temp_dir() . '/storage_test_' . uniqid();
        $this->fileStorage = new FileStorage($this->testUploadDir);
    }

    protected function tearDown(): void
    {
        if (is_dir($this->testUploadDir)) {
            $this->deleteDirectory($this->testUploadDir);
        }
    }

    public function testStoreFile(): void
    {
        $tempFile = sys_get_temp_dir() . '/test_file_' . uniqid() . '.jpg';
        $content = str_repeat('A', 1024);
        file_put_contents($tempFile, $content);
        $hash = md5_file($tempFile);

        try {
            $fileId = $this->fileStorage->storeFile(
                $tempFile,
                'test.jpg',
                'image/jpeg',
                $hash
            );

            $this->assertNotEmpty($fileId);
            $this->assertIsString($fileId);

            $storedPath = $this->fileStorage->getFilePath($fileId);
            $this->assertNotNull($storedPath);
            $this->assertFileExists($storedPath);
            $this->assertEquals($content, file_get_contents($storedPath));
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }

    public function testDeduplication(): void
    {
        $tempFile1 = sys_get_temp_dir() . '/test_file1_' . uniqid() . '.jpg';
        $content = str_repeat('B', 1024);
        file_put_contents($tempFile1, $content);
        $hash = md5_file($tempFile1);

        try {
            // Store first file
            $fileId1 = $this->fileStorage->storeFile(
                $tempFile1,
                'test1.jpg',
                'image/jpeg',
                $hash
            );

            // Store second file with same hash (deduplication)
            $tempFile2 = sys_get_temp_dir() . '/test_file2_' . uniqid() . '.jpg';
            file_put_contents($tempFile2, $content);
            
            try {
                $fileId2 = $this->fileStorage->storeFile(
                    $tempFile2,
                    'test2.jpg',
                    'image/jpeg',
                    $hash
                );

                // Should return the same file ID
                $this->assertEquals($fileId1, $fileId2);
            } finally {
                if (file_exists($tempFile2)) {
                    unlink($tempFile2);
                }
            }
        } finally {
            if (file_exists($tempFile1)) {
                unlink($tempFile1);
            }
        }
    }

    public function testFindFileByHash(): void
    {
        $tempFile = sys_get_temp_dir() . '/test_file_' . uniqid() . '.jpg';
        $content = str_repeat('C', 1024);
        file_put_contents($tempFile, $content);
        $hash = md5_file($tempFile);

        try {
            $fileId = $this->fileStorage->storeFile(
                $tempFile,
                'test.jpg',
                'image/jpeg',
                $hash
            );

            $foundFileId = $this->fileStorage->findFileByHash($hash);
            $this->assertEquals($fileId, $foundFileId);

            // Non-existent hash
            $notFound = $this->fileStorage->findFileByHash('nonexistent-hash');
            $this->assertNull($notFound);
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
        }
    }

    public function testGetFilePath(): void
    {
        $tempFile = sys_get_temp_dir() . '/test_file_' . uniqid() . '.jpg';
        file_put_contents($tempFile, 'test content');
        $hash = md5_file($tempFile);

        try {
            $fileId = $this->fileStorage->storeFile(
                $tempFile,
                'test.jpg',
                'image/jpeg',
                $hash
            );

            $path = $this->fileStorage->getFilePath($fileId);
            $this->assertNotNull($path);
            $this->assertFileExists($path);
            $this->assertEquals('test content', file_get_contents($path));
        } finally {
            if (file_exists($tempFile)) {
                unlink($tempFile);
            }
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

