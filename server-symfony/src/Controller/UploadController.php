<?php

namespace App\Controller;

use App\DTO\UploadInitiateResponse;
use App\DTO\UploadStatusResponse;
use App\DTO\UploadInitiateRequest;
use App\Entity\UploadSession;
use App\Service\ChunkManagerInterface;
use App\Service\FileStorageInterface;
use App\Service\FileValidatorInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Uid\Uuid;

class UploadController extends AbstractController
{
    public function __construct(
        private readonly FileValidatorInterface $fileValidator,
        private readonly ChunkManagerInterface $chunkManager,
        private readonly FileStorageInterface $fileStorage,
        private readonly RateLimiterFactory $uploadApiLimiter,
        private readonly LoggerInterface $logger,
        private readonly int $chunkSize = 1048576,
    ) {
    }

    private function addCorsHeaders(JsonResponse $response): JsonResponse
    {
        // Adjust origin/headers as needed for your environment
        $response->headers->set('Access-Control-Allow-Origin', 'http://localhost:5173');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type');

        return $response;
    }

    private function createCorsPreflightResponse(): JsonResponse
    {
        $response = new JsonResponse(null, Response::HTTP_NO_CONTENT);
        return $this->addCorsHeaders($response);
    }

    private function checkRateLimit(Request $request): ?JsonResponse
    {
        $limiter = $this->uploadApiLimiter->create($request->getClientIp());
        if (!$limiter->consume()->isAccepted()) {
            return new JsonResponse(
                ['error' => 'Rate limit exceeded. Maximum 10 requests per minute.'],
                Response::HTTP_TOO_MANY_REQUESTS
            );
        }
        return null;
    }

    public function initiate(Request $request): JsonResponse
    {
        if ($request->getMethod() === 'OPTIONS') {
            return $this->createCorsPreflightResponse();
        }

        // Rate limiting
        $rateLimitError = $this->checkRateLimit($request);
        if ($rateLimitError !== null) {
            return $this->addCorsHeaders($rateLimitError);
        }

        try {
            $data = json_decode($request->getContent(), true);
            
            if (!$data || !isset($data['fileName'], $data['fileSize'], $data['mimeType'], $data['fileHash'])) {
                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'Missing required fields: fileName, fileSize, mimeType, fileHash'],
                    Response::HTTP_BAD_REQUEST
                ));
            }

            $initiateRequest = new UploadInitiateRequest(
                fileName: $data['fileName'],
                fileSize: (int) $data['fileSize'],
                mimeType: $data['mimeType'],
                fileHash: $data['fileHash'],
            );

            // Validate file size
            if (!$this->fileValidator->validateFileSize($initiateRequest->fileSize)) {
                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'File size exceeds maximum allowed size'],
                    Response::HTTP_BAD_REQUEST
                ));
            }

            // Validate MIME type
            if (!$this->fileValidator->validateMimeType($initiateRequest->mimeType)) {
                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'Invalid file type. Allowed types: ' . implode(', ', $this->fileValidator->getAllowedMimeTypes())],
                    Response::HTTP_BAD_REQUEST
                ));
            }

            // Check if file already exists (deduplication)
            $existingFileId = $this->fileStorage->findFileByHash($initiateRequest->fileHash);
            if ($existingFileId !== null) {
                return $this->addCorsHeaders(new JsonResponse([
                    'uploadId' => Uuid::v4()->toRfc4122(),
                    'chunkSize' => $this->chunkSize,
                    'totalChunks' => 0,
                    'fileId' => $existingFileId,
                    'message' => 'File already exists',
                ], Response::HTTP_OK));
            }

            // Calculate total chunks
            $totalChunks = (int) ceil($initiateRequest->fileSize / $this->chunkSize);
            
            // Create upload session
            $uploadId = Uuid::v4()->toRfc4122();
            $session = new UploadSession(
                uploadId: $uploadId,
                fileName: $initiateRequest->fileName,
                fileSize: $initiateRequest->fileSize,
                mimeType: $initiateRequest->mimeType,
                fileHash: $initiateRequest->fileHash,
                chunkSize: $this->chunkSize,
                totalChunks: $totalChunks,
                createdAt: new \DateTimeImmutable(),
            );

            $this->chunkManager->createSession($uploadId, $session);

            $this->logger->info('Upload initiated', [
                'uploadId' => $uploadId,
                'fileName' => $initiateRequest->fileName,
                'fileSize' => $initiateRequest->fileSize,
                'clientIp' => $request->getClientIp(),
            ]);

            $response = new UploadInitiateResponse(
                uploadId: $uploadId,
                chunkSize: $this->chunkSize,
                totalChunks: $totalChunks,
            );

            return $this->addCorsHeaders(new JsonResponse($response->toArray(), Response::HTTP_CREATED));
        } catch (\Exception $e) {
            $this->logger->error('Error initiating upload', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->addCorsHeaders(new JsonResponse(
                ['error' => 'Failed to initiate upload'],
                Response::HTTP_INTERNAL_SERVER_ERROR
            ));
        }
    }

    public function chunk(Request $request): JsonResponse
    {
        if ($request->getMethod() === 'OPTIONS') {
            return $this->createCorsPreflightResponse();
        }

        // Rate limiting
        $rateLimitError = $this->checkRateLimit($request);
        if ($rateLimitError !== null) {
            return $this->addCorsHeaders($rateLimitError);
        }

        try {
            $data = json_decode($request->getContent(), true);

            if (!$data || !isset($data['uploadId'], $data['chunkIndex'], $data['chunkData'])) {
                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'Missing required fields: uploadId, chunkIndex, chunkData'],
                    Response::HTTP_BAD_REQUEST
                ));
            }

            $uploadId = $data['uploadId'];
            $chunkIndex = (int) $data['chunkIndex'];
            $chunkData = base64_decode($data['chunkData'], true);

            if ($chunkData === false) {
                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'Invalid chunk data. Must be base64 encoded.'],
                    Response::HTTP_BAD_REQUEST
                ));
            }

            // Verify session exists
            $session = $this->chunkManager->getSession($uploadId);
            if (!$session) {
                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'Upload session not found'],
                    Response::HTTP_NOT_FOUND
                ));
            }

            // Validate chunk index
            if ($chunkIndex < 0 || $chunkIndex >= $session->totalChunks) {
                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'Invalid chunk index'],
                    Response::HTTP_BAD_REQUEST
                ));
            }

            // Validate chunk size (last chunk can be smaller)
            $expectedSize = ($chunkIndex === $session->totalChunks - 1)
                ? ($session->fileSize % $this->chunkSize) ?: $this->chunkSize
                : $this->chunkSize;

            if (strlen($chunkData) > $expectedSize) {
                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'Chunk size exceeds expected size'],
                    Response::HTTP_BAD_REQUEST
                ));
            }

            // Save chunk
            $this->chunkManager->saveChunk($uploadId, $chunkIndex, $chunkData);

            $this->logger->debug('Chunk uploaded', [
                'uploadId' => $uploadId,
                'chunkIndex' => $chunkIndex,
                'chunkSize' => strlen($chunkData),
            ]);

            return $this->addCorsHeaders(new JsonResponse([
                'success' => true,
                'uploadId' => $uploadId,
                'chunkIndex' => $chunkIndex,
            ], Response::HTTP_OK));
        } catch (\Exception $e) {
            $this->logger->error('Error uploading chunk', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->addCorsHeaders(new JsonResponse(
                ['error' => 'Failed to upload chunk'],
                Response::HTTP_INTERNAL_SERVER_ERROR
            ));
        }
    }

    public function finalize(Request $request): JsonResponse
    {
        if ($request->getMethod() === 'OPTIONS') {
            return $this->createCorsPreflightResponse();
        }

        // Rate limiting
        $rateLimitError = $this->checkRateLimit($request);
        if ($rateLimitError !== null) {
            return $this->addCorsHeaders($rateLimitError);
        }

        try {
            $data = json_decode($request->getContent(), true);

            if (!$data || !isset($data['uploadId'])) {
                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'Missing required field: uploadId'],
                    Response::HTTP_BAD_REQUEST
                ));
            }

            $uploadId = $data['uploadId'];

            // Get session
            $session = $this->chunkManager->getSession($uploadId);
            if (!$session) {
                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'Upload session not found'],
                    Response::HTTP_NOT_FOUND
                ));
            }

            // Check if already completed
            if ($session->isCompleted()) {
                return $this->addCorsHeaders(new JsonResponse([
                    'success' => true,
                    'uploadId' => $uploadId,
                    'fileId' => $session->fileId,
                    'message' => 'Upload already completed',
                ], Response::HTTP_OK));
            }

            // Verify all chunks are uploaded
            if (count($session->uploadedChunks) !== $session->totalChunks) {
                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'Not all chunks have been uploaded'],
                    Response::HTTP_BAD_REQUEST
                ));
            }

            // Reassemble file
            $tempFilePath = $this->chunkManager->reassembleFile($session);

            // Validate magic number
            if (!$this->fileValidator->validateMagicNumber($tempFilePath)) {
                unlink($tempFilePath);
                $session->error = 'File validation failed: Invalid file type detected';
                $this->chunkManager->updateSession($session);

                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'File validation failed: Invalid file type'],
                    Response::HTTP_BAD_REQUEST
                ));
            }

            // Verify file hash
            $actualHash = md5_file($tempFilePath);
            if ($actualHash !== $session->fileHash) {
                unlink($tempFilePath);
                $session->error = 'File hash mismatch';
                $this->chunkManager->updateSession($session);

                return $this->addCorsHeaders(new JsonResponse(
                    ['error' => 'File hash verification failed'],
                    Response::HTTP_BAD_REQUEST
                ));
            }

            // Store file
            $fileId = $this->fileStorage->storeFile(
                $tempFilePath,
                $session->fileName,
                $session->mimeType,
                $session->fileHash
            );

            // Update session
            $session->fileId = $fileId;
            $session->completedAt = new \DateTimeImmutable();
            $this->chunkManager->updateSession($session);

            // Cleanup chunks
            $this->chunkManager->cleanupChunks($uploadId);

            $this->logger->info('Upload finalized', [
                'uploadId' => $uploadId,
                'fileId' => $fileId,
                'fileName' => $session->fileName,
            ]);

            return $this->addCorsHeaders(new JsonResponse([
                'success' => true,
                'uploadId' => $uploadId,
                'fileId' => $fileId,
            ], Response::HTTP_OK));
        } catch (\Exception $e) {
            $this->logger->error('Error finalizing upload', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->addCorsHeaders(new JsonResponse(
                ['error' => 'Failed to finalize upload'],
                Response::HTTP_INTERNAL_SERVER_ERROR
            ));
        }
    }

    public function status(string $uploadId): JsonResponse
    {
        $session = $this->chunkManager->getSession($uploadId);
        
        if (!$session) {
            return $this->addCorsHeaders(new JsonResponse(
                ['error' => 'Upload session not found'],
                Response::HTTP_NOT_FOUND
            ));
        }

        $status = 'in_progress';
        if ($session->isCompleted()) {
            $status = 'completed';
        } elseif ($session->hasError()) {
            $status = 'error';
        }

        $response = new UploadStatusResponse(
            uploadId: $session->uploadId,
            status: $status,
            uploadedChunks: count($session->uploadedChunks),
            totalChunks: $session->totalChunks,
            fileId: $session->fileId,
            error: $session->error,
        );

        return $this->addCorsHeaders(new JsonResponse($response->toArray(), Response::HTTP_OK));
    }
}

