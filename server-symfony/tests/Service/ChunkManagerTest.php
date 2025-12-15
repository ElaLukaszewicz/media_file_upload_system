<?php

namespace App\Tests\Service;

use App\Entity\UploadSession;
use App\Service\ChunkManager;
use PHPUnit\Framework\TestCase;

class ChunkManagerTest extends TestCase
{
    private string $testUploadDir;
    private ChunkManager $chunkManager;

    protected function setUp(): void
    {
        $this->testUploadDir = sys_get_temp_dir() . '/upload_test_' . uniqid();
        $this->chunkManager = new ChunkManager($this->testUploadDir, 1800);
    }

    protected function tearDown(): void
    {
        if (is_dir($this->testUploadDir)) {
            $this->deleteDirectory($this->testUploadDir);
        }
    }

    public function testCreateAndGetSession(): void
    {
        $uploadId = 'test-upload-123';
        $session = new UploadSession(
            uploadId: $uploadId,
            fileName: 'test.jpg',
            fileSize: 2097152, // 2MB
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576, // 1MB
            totalChunks: 2,
            createdAt: new \DateTimeImmutable(),
        );

        $this->chunkManager->createSession($uploadId, $session);

        $retrieved = $this->chunkManager->getSession($uploadId);
        $this->assertNotNull($retrieved);
        $this->assertEquals($uploadId, $retrieved->uploadId);
        $this->assertEquals('test.jpg', $retrieved->fileName);
        $this->assertEquals(2, $retrieved->totalChunks);
    }

    public function testSaveAndHasChunk(): void
    {
        $uploadId = 'test-upload-456';
        $session = new UploadSession(
            uploadId: $uploadId,
            fileName: 'test.jpg',
            fileSize: 1048576,
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576,
            totalChunks: 1,
            createdAt: new \DateTimeImmutable(),
        );

        $this->chunkManager->createSession($uploadId, $session);

        $chunkData = str_repeat('A', 1048576);
        $this->chunkManager->saveChunk($uploadId, 0, $chunkData);

        $this->assertTrue($this->chunkManager->hasChunk($uploadId, 0));
        $this->assertFalse($this->chunkManager->hasChunk($uploadId, 1));

        // Verify chunk was saved correctly
        $retrieved = $this->chunkManager->getSession($uploadId);
        $this->assertCount(1, $retrieved->uploadedChunks);
        $this->assertContains(0, $retrieved->uploadedChunks);
    }

    public function testReassembleFile(): void
    {
        $uploadId = 'test-upload-789';
        $session = new UploadSession(
            uploadId: $uploadId,
            fileName: 'test.jpg',
            fileSize: 2097152, // 2MB
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576, // 1MB
            totalChunks: 2,
            createdAt: new \DateTimeImmutable(),
        );

        $this->chunkManager->createSession($uploadId, $session);

        // Save two chunks
        $chunk1 = str_repeat('A', 1048576);
        $chunk2 = str_repeat('B', 1048576);
        $this->chunkManager->saveChunk($uploadId, 0, $chunk1);
        $this->chunkManager->saveChunk($uploadId, 1, $chunk2);

        // Reassemble
        $reassembledPath = $this->chunkManager->reassembleFile($session);

        $this->assertFileExists($reassembledPath);
        $reassembledContent = file_get_contents($reassembledPath);
        $this->assertEquals($chunk1 . $chunk2, $reassembledContent);

        // Cleanup
        if (file_exists($reassembledPath)) {
            unlink($reassembledPath);
        }
    }

    public function testCleanupIncompleteChunks(): void
    {
        $uploadId = 'test-upload-timeout';
        $session = new UploadSession(
            uploadId: $uploadId,
            fileName: 'test.jpg',
            fileSize: 1048576,
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576,
            totalChunks: 1,
            createdAt: new \DateTimeImmutable('@' . (time() - 2000)), // 2000 seconds ago
        );

        $this->chunkManager->createSession($uploadId, $session);
        $this->chunkManager->saveChunk($uploadId, 0, str_repeat('A', 1048576));

        // Cleanup with timeout of 1800 seconds (30 minutes)
        $cleaned = $this->chunkManager->cleanupIncompleteChunks(1800);

        $this->assertEquals(1, $cleaned);
        $this->assertNull($this->chunkManager->getSession($uploadId));
        $this->assertFalse($this->chunkManager->hasChunk($uploadId, 0));
    }

    public function testUpdateSession(): void
    {
        $uploadId = 'test-upload-update';
        $session = new UploadSession(
            uploadId: $uploadId,
            fileName: 'test.jpg',
            fileSize: 1048576,
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576,
            totalChunks: 1,
            createdAt: new \DateTimeImmutable(),
        );

        $this->chunkManager->createSession($uploadId, $session);

        $session->fileId = 'file-123';
        $session->completedAt = new \DateTimeImmutable();
        $this->chunkManager->updateSession($session);

        $retrieved = $this->chunkManager->getSession($uploadId);
        $this->assertEquals('file-123', $retrieved->fileId);
        $this->assertNotNull($retrieved->completedAt);
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

