<?php

namespace App\Tests\Controller;

use App\Controller\UploadController;
use App\Entity\UploadSession;
use App\Service\ChunkManagerInterface;
use App\Service\FileStorageInterface;
use App\Service\FileValidatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;

class UploadControllerTest extends TestCase
{
    private FileValidatorInterface|\PHPUnit\Framework\MockObject\MockObject $validator;
    private ChunkManagerInterface|\PHPUnit\Framework\MockObject\MockObject $chunkManager;
    private FileStorageInterface|\PHPUnit\Framework\MockObject\MockObject $fileStorage;

    protected function setUp(): void
    {
        $this->validator = $this->createMock(FileValidatorInterface::class);
        $this->chunkManager = $this->createMock(ChunkManagerInterface::class);
        $this->fileStorage = $this->createMock(FileStorageInterface::class);
    }

    public function testInitiateReturnsPreflightForOptions(): void
    {
        $controller = $this->createController();
        $request = Request::create('/upload', 'OPTIONS', server: ['REMOTE_ADDR' => '127.0.0.1']);

        $response = $controller->initiate($request);

        $this->assertEquals(Response::HTTP_NO_CONTENT, $response->getStatusCode());
        $this->assertEquals('http://localhost:5173', $response->headers->get('Access-Control-Allow-Origin'));
    }

    public function testInitiateReturnsRateLimitResponse(): void
    {
        $controller = $this->createController(rateLimitAccepted: false);
        $request = Request::create('/upload', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'fileName' => 'video.mp4',
            'fileSize' => 8,
            'mimeType' => 'video/mp4',
            'fileHash' => 'hash',
        ]));

        $response = $controller->initiate($request);
        $data = json_decode($response->getContent(), true);

        $this->assertEquals(Response::HTTP_TOO_MANY_REQUESTS, $response->getStatusCode());
        $this->assertEquals('Rate limit exceeded. Maximum 10 requests per minute.', $data['error']);
        $this->assertEquals('http://localhost:5173', $response->headers->get('Access-Control-Allow-Origin'));
    }

    public function testInitiateCreatesSessionWhenValid(): void
    {
        $controller = $this->createController(chunkSize: 4);

        $this->validator->expects($this->once())->method('validateFileSize')->willReturn(true);
        $this->validator->expects($this->once())->method('validateMimeType')->willReturn(true);
        $this->fileStorage->expects($this->once())->method('findFileByHash')->willReturn(null);
        $this->chunkManager->expects($this->once())->method('createSession');

        $request = Request::create('/upload', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'fileName' => 'photo.jpg',
            'fileSize' => 8,
            'mimeType' => 'image/jpeg',
            'fileHash' => 'abc',
        ]));

        $response = $controller->initiate($request);
        $payload = json_decode($response->getContent(), true);

        $this->assertEquals(Response::HTTP_CREATED, $response->getStatusCode());
        $this->assertArrayHasKey('uploadId', $payload);
        $this->assertEquals(4, $payload['chunkSize']);
        $this->assertEquals(2, $payload['totalChunks']);
    }

    public function testInitiateDeduplicatesExistingFile(): void
    {
        $controller = $this->createController(chunkSize: 5);

        $this->validator->method('validateFileSize')->willReturn(true);
        $this->validator->method('validateMimeType')->willReturn(true);
        $this->fileStorage->expects($this->once())->method('findFileByHash')->willReturn('existing-file');
        $this->chunkManager->expects($this->never())->method('createSession');

        $request = Request::create('/upload', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'fileName' => 'photo.jpg',
            'fileSize' => 10,
            'mimeType' => 'image/jpeg',
            'fileHash' => 'existing-hash',
        ]));

        $response = $controller->initiate($request);
        $payload = json_decode($response->getContent(), true);

        $this->assertEquals(Response::HTTP_OK, $response->getStatusCode());
        $this->assertEquals('existing-file', $payload['fileId']);
        $this->assertEquals(0, $payload['totalChunks']);
        $this->assertEquals(5, $payload['chunkSize']);
    }

    public function testInitiateRejectsInvalidMimeType(): void
    {
        $controller = $this->createController();

        $this->validator->method('validateFileSize')->willReturn(true);
        $this->validator->method('validateMimeType')->willReturn(false);
        $this->validator->method('getAllowedMimeTypes')->willReturn(['image/jpeg']);

        $request = Request::create('/upload', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'fileName' => 'photo.jpg',
            'fileSize' => 2,
            'mimeType' => 'application/pdf',
            'fileHash' => 'hash',
        ]));

        $response = $controller->initiate($request);
        $payload = json_decode($response->getContent(), true);

        $this->assertEquals(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
        $this->assertStringContainsString('Invalid file type', $payload['error']);
    }

    public function testInitiateReturnsBadRequestForMissingFields(): void
    {
        $controller = $this->createController();
        $request = Request::create('/upload', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([]));

        $response = $controller->initiate($request);
        $this->assertEquals(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testChunkReturnsPreflightForOptions(): void
    {
        $controller = $this->createController();
        $request = Request::create('/upload/chunk', 'OPTIONS', server: ['REMOTE_ADDR' => '127.0.0.1']);

        $response = $controller->chunk($request);
        $this->assertEquals(Response::HTTP_NO_CONTENT, $response->getStatusCode());
    }

    public function testChunkReturnsRateLimitResponse(): void
    {
        $controller = $this->createController(rateLimitAccepted: false);
        $request = Request::create('/upload/chunk', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => 'any',
            'chunkIndex' => 0,
            'chunkData' => base64_encode('abc'),
        ]));

        $response = $controller->chunk($request);
        $this->assertEquals(Response::HTTP_TOO_MANY_REQUESTS, $response->getStatusCode());
    }

    public function testChunkValidatesAndSavesChunk(): void
    {
        $controller = $this->createController(chunkSize: 4);
        $session = $this->createSession(uploadedChunks: [], totalChunks: 2, chunkSize: 4, fileSize: 8);

        $this->chunkManager->expects($this->once())->method('getSession')->willReturn($session);
        $this->chunkManager->expects($this->once())->method('saveChunk')->with($session->uploadId, 0, 'data');

        $request = Request::create('/upload/chunk', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => $session->uploadId,
            'chunkIndex' => 0,
            'chunkData' => base64_encode('data'),
        ]));

        $response = $controller->chunk($request);
        $this->assertEquals(Response::HTTP_OK, $response->getStatusCode());
    }

    public function testChunkRejectsInvalidBase64(): void
    {
        $controller = $this->createController();
        $request = Request::create('/upload/chunk', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => 'u1',
            'chunkIndex' => 0,
            'chunkData' => '***not-base64***',
        ]));

        $response = $controller->chunk($request);
        $this->assertEquals(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testChunkRejectsInvalidChunkIndex(): void
    {
        $controller = $this->createController(chunkSize: 4);
        $session = $this->createSession(uploadedChunks: [], totalChunks: 1, chunkSize: 4, fileSize: 4);

        $this->chunkManager->method('getSession')->willReturn($session);

        $request = Request::create('/upload/chunk', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => $session->uploadId,
            'chunkIndex' => 5,
            'chunkData' => base64_encode('abcd'),
        ]));

        $response = $controller->chunk($request);
        $this->assertEquals(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testChunkRejectsOversizedChunk(): void
    {
        $controller = $this->createController(chunkSize: 4);
        $session = $this->createSession(uploadedChunks: [], totalChunks: 2, chunkSize: 4, fileSize: 8);

        $this->chunkManager->method('getSession')->willReturn($session);

        $request = Request::create('/upload/chunk', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => $session->uploadId,
            'chunkIndex' => 0,
            'chunkData' => base64_encode('toolong'),
        ]));

        $response = $controller->chunk($request);
        $this->assertEquals(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testChunkReturnsNotFoundWhenSessionMissing(): void
    {
        $controller = $this->createController();
        $this->chunkManager->method('getSession')->willReturn(null);

        $request = Request::create('/upload/chunk', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => 'missing',
            'chunkIndex' => 0,
            'chunkData' => base64_encode('data'),
        ]));

        $response = $controller->chunk($request);
        $this->assertEquals(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testFinalizeReturnsBadRequestWithoutUploadId(): void
    {
        $controller = $this->createController();
        $request = Request::create('/upload/finalize', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([]));

        $response = $controller->finalize($request);
        $this->assertEquals(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testFinalizeReturnsPreflightForOptions(): void
    {
        $controller = $this->createController();
        $request = Request::create('/upload/finalize', 'OPTIONS', server: ['REMOTE_ADDR' => '127.0.0.1']);

        $response = $controller->finalize($request);
        $this->assertEquals(Response::HTTP_NO_CONTENT, $response->getStatusCode());
    }

    public function testFinalizeReturnsRateLimitResponse(): void
    {
        $controller = $this->createController(rateLimitAccepted: false);
        $request = Request::create('/upload/finalize', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => 'limited',
        ]));

        $response = $controller->finalize($request);
        $this->assertEquals(Response::HTTP_TOO_MANY_REQUESTS, $response->getStatusCode());
    }

    public function testFinalizeReturnsNotFoundWhenSessionMissing(): void
    {
        $controller = $this->createController();
        $this->chunkManager->method('getSession')->willReturn(null);

        $request = Request::create('/upload/finalize', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => 'missing',
        ]));

        $response = $controller->finalize($request);
        $this->assertEquals(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    }

    public function testFinalizeRejectsWhenChunksMissing(): void
    {
        $controller = $this->createController(chunkSize: 3);
        $session = $this->createSession(uploadedChunks: [0], totalChunks: 2, chunkSize: 3, fileSize: 6);

        $this->chunkManager->method('getSession')->willReturn($session);

        $request = Request::create('/upload/finalize', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => $session->uploadId,
        ]));

        $response = $controller->finalize($request);
        $this->assertEquals(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testFinalizeFailsWhenMagicNumberInvalid(): void
    {
        $controller = $this->createController();
        $session = $this->createSession(uploadedChunks: [0, 1], totalChunks: 2);

        $tempFile = sys_get_temp_dir() . '/finalize_invalid_' . uniqid();
        file_put_contents($tempFile, 'bad-data');

        $this->chunkManager->method('getSession')->willReturn($session);
        $this->chunkManager->expects($this->once())->method('reassembleFile')->willReturn($tempFile);
        $this->chunkManager->expects($this->once())->method('updateSession');
        $this->validator->method('validateMagicNumber')->willReturn(false);

        $request = Request::create('/upload/finalize', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => $session->uploadId,
        ]));

        $response = $controller->finalize($request);
        $this->assertEquals(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
        $this->assertFileDoesNotExist($tempFile);
    }

    public function testFinalizeFailsOnHashMismatch(): void
    {
        $controller = $this->createController();
        $session = $this->createSession(uploadedChunks: [0, 1], totalChunks: 2);

        $tempFile = sys_get_temp_dir() . '/finalize_hash_' . uniqid();
        file_put_contents($tempFile, 'mismatch');

        $this->chunkManager->method('getSession')->willReturn($session);
        $this->chunkManager->expects($this->once())->method('reassembleFile')->willReturn($tempFile);
        $this->chunkManager->expects($this->once())->method('updateSession');
        $this->validator->method('validateMagicNumber')->willReturn(true);

        $request = Request::create('/upload/finalize', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => $session->uploadId,
        ]));

        $response = $controller->finalize($request);
        $this->assertEquals(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
        $this->assertFileDoesNotExist($tempFile);
    }

    public function testFinalizeReturnsAlreadyCompleted(): void
    {
        $controller = $this->createController();
        $session = $this->createSession(uploadedChunks: [0, 1], totalChunks: 2);
        $session->fileId = 'stored';

        $this->chunkManager->method('getSession')->willReturn($session);

        $request = Request::create('/upload/finalize', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => $session->uploadId,
        ]));

        $response = $controller->finalize($request);
        $payload = json_decode($response->getContent(), true);

        $this->assertEquals(Response::HTTP_OK, $response->getStatusCode());
        $this->assertEquals('Upload already completed', $payload['message']);
        $this->assertEquals('stored', $payload['fileId']);
    }

    public function testFinalizeSucceeds(): void
    {
        $controller = $this->createController(chunkSize: 4);

        $tempFile = sys_get_temp_dir() . '/finalize_success_' . uniqid();
        file_put_contents($tempFile, 'payload');
        $expectedHash = md5_file($tempFile);
        $session = $this->createSession(
            uploadedChunks: [0, 1],
            totalChunks: 2,
            chunkSize: 4,
            fileSize: 8,
            fileHash: $expectedHash
        );

        $this->chunkManager->method('getSession')->willReturn($session);
        $this->chunkManager->expects($this->once())->method('reassembleFile')->willReturn($tempFile);
        $this->chunkManager->expects($this->once())->method('updateSession')->with($this->callback(function (UploadSession $updated) {
            return $updated->fileId === 'stored-file';
        }));
        $this->chunkManager->expects($this->once())->method('cleanupChunks')->with($session->uploadId);
        $this->validator->method('validateMagicNumber')->willReturn(true);
        $this->fileStorage->method('storeFile')->willReturn('stored-file');

        $request = Request::create('/upload/finalize', 'POST', [], [], [], ['REMOTE_ADDR' => '127.0.0.1'], json_encode([
            'uploadId' => $session->uploadId,
        ]));

        $response = $controller->finalize($request);
        $payload = json_decode($response->getContent(), true);

        $this->assertEquals(Response::HTTP_OK, $response->getStatusCode());
        $this->assertTrue($payload['success']);
        $this->assertEquals('stored-file', $payload['fileId']);

        if (file_exists($tempFile)) {
            unlink($tempFile);
        }
    }

    public function testStatusReturnsSessionState(): void
    {
        $controller = $this->createController();
        $session = $this->createSession(uploadedChunks: [0], totalChunks: 2);
        $this->chunkManager->method('getSession')->willReturn($session);

        $response = $controller->status($session->uploadId);
        $payload = json_decode($response->getContent(), true);

        $this->assertEquals(Response::HTTP_OK, $response->getStatusCode());
        $this->assertEquals($session->uploadId, $payload['uploadId']);
        $this->assertEquals(1, $payload['uploadedChunks']);
    }

    public function testStatusReturnsErrorState(): void
    {
        $controller = $this->createController();
        $session = $this->createSession(uploadedChunks: [0], totalChunks: 2);
        $session->error = 'failure';
        $this->chunkManager->method('getSession')->willReturn($session);

        $response = $controller->status($session->uploadId);
        $payload = json_decode($response->getContent(), true);

        $this->assertEquals('error', $payload['status']);
        $this->assertEquals('failure', $payload['error']);
    }

    private function createController(bool $rateLimitAccepted = true, int $chunkSize = 4): UploadController
    {
        $rateLimiterFactory = $this->createRateLimiterFactory($rateLimitAccepted);

        return new UploadController(
            $this->validator,
            $this->chunkManager,
            $this->fileStorage,
            $rateLimiterFactory,
            new NullLogger(),
            $chunkSize
        );
    }

    private function createRateLimiterFactory(bool $accepted): RateLimiterFactory
    {
        $factory = new RateLimiterFactory(
            [
                'id' => 'test_upload',
                'policy' => 'fixed_window',
                'limit' => 1,
                'interval' => '1 minute',
            ],
            new InMemoryStorage()
        );

        if (!$accepted) {
            $factory->create('127.0.0.1')->consume(1);
        }

        return $factory;
    }

    private function createSession(
        array $uploadedChunks,
        int $totalChunks,
        int $chunkSize = 4,
        int $fileSize = 8,
        string $fileHash = 'hash'
    ): UploadSession {
        return new UploadSession(
            uploadId: 'upload-' . uniqid(),
            fileName: 'file.bin',
            fileSize: $fileSize,
            mimeType: 'application/octet-stream',
            fileHash: $fileHash,
            chunkSize: $chunkSize,
            totalChunks: $totalChunks,
            createdAt: new \DateTimeImmutable(),
            uploadedChunks: $uploadedChunks
        );
    }
}

