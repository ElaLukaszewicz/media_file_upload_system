<?php

namespace App\Tests\Entity;

use App\Entity\UploadSession;
use PHPUnit\Framework\TestCase;

class UploadSessionTest extends TestCase
{
    public function testIsCompleted(): void
    {
        $session = new UploadSession(
            uploadId: 'test-123',
            fileName: 'test.jpg',
            fileSize: 2097152,
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576,
            totalChunks: 2,
            createdAt: new \DateTimeImmutable(),
            uploadedChunks: [0, 1],
            fileId: 'file-123',
        );

        $this->assertTrue($session->isCompleted());
    }

    public function testIsInProgress(): void
    {
        $session = new UploadSession(
            uploadId: 'test-123',
            fileName: 'test.jpg',
            fileSize: 2097152,
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576,
            totalChunks: 2,
            createdAt: new \DateTimeImmutable(),
            uploadedChunks: [0],
        );

        $this->assertTrue($session->isInProgress());
        $this->assertFalse($session->isCompleted());
    }

    public function testHasError(): void
    {
        $session = new UploadSession(
            uploadId: 'test-123',
            fileName: 'test.jpg',
            fileSize: 2097152,
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576,
            totalChunks: 2,
            createdAt: new \DateTimeImmutable(),
            error: 'Test error',
        );

        $this->assertTrue($session->hasError());
        $this->assertFalse($session->isInProgress());
    }

    public function testAddChunk(): void
    {
        $session = new UploadSession(
            uploadId: 'test-123',
            fileName: 'test.jpg',
            fileSize: 2097152,
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576,
            totalChunks: 2,
            createdAt: new \DateTimeImmutable(),
        );

        $this->assertCount(0, $session->uploadedChunks);

        $session->addChunk(1);
        $this->assertCount(1, $session->uploadedChunks);
        $this->assertContains(1, $session->uploadedChunks);

        $session->addChunk(0);
        $this->assertCount(2, $session->uploadedChunks);
        $this->assertEquals([0, 1], $session->uploadedChunks);

        // Adding duplicate should not increase count
        $session->addChunk(0);
        $this->assertCount(2, $session->uploadedChunks);
    }

    public function testGetProgress(): void
    {
        $session = new UploadSession(
            uploadId: 'test-123',
            fileName: 'test.jpg',
            fileSize: 2097152,
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576,
            totalChunks: 4,
            createdAt: new \DateTimeImmutable(),
        );

        $this->assertEquals(0.0, $session->getProgress());

        $session->addChunk(0);
        $this->assertEquals(25.0, $session->getProgress());

        $session->addChunk(1);
        $this->assertEquals(50.0, $session->getProgress());

        $session->addChunk(2);
        $this->assertEquals(75.0, $session->getProgress());

        $session->addChunk(3);
        $this->assertEquals(100.0, $session->getProgress());
    }

    public function testIsTimedOut(): void
    {
        $oldTime = new \DateTimeImmutable('@' . (time() - 2000));
        $session = new UploadSession(
            uploadId: 'test-123',
            fileName: 'test.jpg',
            fileSize: 2097152,
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576,
            totalChunks: 2,
            createdAt: $oldTime,
        );

        $this->assertTrue($session->isTimedOut(1800)); // 30 minutes
        $this->assertFalse($session->isTimedOut(3600)); // 60 minutes

        $recentTime = new \DateTimeImmutable();
        $recentSession = new UploadSession(
            uploadId: 'test-456',
            fileName: 'test.jpg',
            fileSize: 2097152,
            mimeType: 'image/jpeg',
            fileHash: md5('test'),
            chunkSize: 1048576,
            totalChunks: 2,
            createdAt: $recentTime,
        );

        $this->assertFalse($recentSession->isTimedOut(1800));
    }
}

