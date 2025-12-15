# Media File Upload System - Symfony Backend

A robust, production-ready Symfony 6 backend for handling chunked media file uploads with validation, deduplication, and automatic cleanup.

## Features

- ✅ **Chunked Upload Support**: Fixed 1MB chunks for efficient large file handling
- ✅ **File Validation**: Magic number detection + MIME type validation
- ✅ **Rate Limiting**: 10 requests per minute per IP
- ✅ **File Deduplication**: MD5 hash-based deduplication
- ✅ **Organized Storage**: Files organized by date (YYYY/MM/DD)
- ✅ **Automatic Cleanup**: Removes incomplete chunks (30min timeout) and old files (30 days retention)
- ✅ **RESTful API**: Clean, well-documented endpoints
- ✅ **Comprehensive Testing**: Unit tests with high coverage
- ✅ **Logging**: Structured logging with Monolog

## Prerequisites

- PHP 8.1 or higher
- Composer 2.x
- Required PHP extensions: `ctype`, `iconv`, `fileinfo`, `hash`

## Installation

1. **Install dependencies**:
   ```bash
   composer install
   ```

2. **Configure environment**:
   ```bash
   cp .env .env.local
   # Edit .env.local with your configuration
   ```
   
   > **Note**: The upload directory (`var/uploads` by default) is created automatically when the application starts. However, ensure the `var/` directory is writable by your web server user.

3. **Run the server**:
   ```bash
   # Development
   symfony server:start -d
   
   # Or using PHP built-in server
   php -S localhost:8000 -t public
   ```

## Configuration

Environment variables (`.env`):

```env
# Upload Configuration
UPLOAD_DIR=var/uploads           # Base directory for uploads
CHUNK_SIZE=1048576               # 1MB chunk size
CHUNK_TIMEOUT=1800               # 30 minutes (incomplete chunk timeout)
FILE_RETENTION_DAYS=30           # File retention period
MAX_FILE_SIZE=104857600          # 100MB maximum file size
```

## API Endpoints

### 1. Initiate Upload

**POST** `/api/upload/initiate`

Pre-validate file and create upload session.

**Request Body:**
```json
{
  "fileName": "example.jpg",
  "fileSize": 2097152,
  "mimeType": "image/jpeg",
  "fileHash": "5d41402abc4b2a76b9719d911017c592"
}
```

**Response (201 Created):**
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "chunkSize": 1048576,
  "totalChunks": 2
}
```

**Response (200 OK) - File exists (deduplication):**
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "chunkSize": 1048576,
  "totalChunks": 0,
  "fileId": "existing-file-id",
  "message": "File already exists"
}
```

### 2. Upload Chunk

**POST** `/api/upload/chunk`

Upload a single chunk. Supports parallel uploads.

**Request Body:**
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "chunkIndex": 0,
  "chunkData": "base64-encoded-chunk-data"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "chunkIndex": 0
}
```

### 3. Finalize Upload

**POST** `/api/upload/finalize`

Reassemble chunks and store final file.

**Request Body:**
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "fileId": "550e8400-e29b-41d4-a716-446655440001"
}
```

### 4. Get Upload Status

**GET** `/api/upload/status/{uploadId}`

Check upload progress.

**Response (200 OK):**
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "in_progress",
  "uploadedChunks": 1,
  "totalChunks": 2,
  "fileId": null,
  "error": null
}
```

**Status values:**
- `in_progress`: Upload is ongoing
- `completed`: Upload finished successfully
- `error`: Upload failed

## Error Responses

All endpoints return standard HTTP status codes:

- `400 Bad Request`: Invalid input or validation failure
- `404 Not Found`: Upload session not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

Error response format:
```json
{
  "error": "Error message description"
}
```

## Testing

Run all tests:
```bash
composer test
```

Run specific test suite:
```bash
./vendor/bin/phpunit tests/Service/FileValidatorTest.php
```

Test coverage:
- FileValidator: Magic number detection, MIME validation
- ChunkManager: Session management, chunk storage, reassembly
- FileStorage: File storage, deduplication, cleanup
- UploadSession: Entity logic and state management

## Maintenance

### Cleanup Command

Run cleanup to remove incomplete chunks and old files:

```bash
php bin/console app:cleanup
```

**Recommended:** Add to cron for automated cleanup:
```bash
# Run every hour
0 * * * * cd /path/to/project && php bin/console app:cleanup
```

## Security

- **File Type Validation**: Whitelist of allowed MIME types (images/videos only)
- **Magic Number Detection**: Secondary validation using file headers
- **Rate Limiting**: 10 requests per minute per IP address
- **File Size Limits**: Configurable maximum file size
- **Hash Verification**: MD5 checksum validation on finalize

## Supported File Types

### Images
- JPEG/JPG
- PNG
- GIF
- WebP
- BMP
- TIFF

### Videos
- MP4
- MPEG
- QuickTime (MOV)
- AVI
- WebM
- OGG

## Architecture

### Services

- **FileValidator**: Validates MIME types and magic numbers
- **ChunkManager**: Manages upload sessions and chunk storage
- **FileStorage**: Handles final file storage with deduplication

### Storage Structure

```
var/uploads/
├── chunks/              # Temporary chunk storage
│   └── {uploadId}/
│       └── {chunkIndex}
├── files/               # Final stored files
│   └── YYYY/MM/DD/
│       └── {fileId}.jpg
├── temp/                # Temporary reassembled files
└── sessions.json        # Upload session metadata
```

## Best Practices

1. **Always validate on client first**: Check file type and size before initiating upload
2. **Handle errors gracefully**: Implement retry logic with exponential backoff
3. **Monitor uploads**: Use status endpoint to track progress
4. **Cleanup regularly**: Run cleanup command via cron
5. **Monitor logs**: Check logs in `var/log/` for issues

## Troubleshooting

### Upload fails with "Rate limit exceeded"
- Wait 1 minute between requests
- Maximum 10 requests per minute per IP

### Chunks not found during finalize
- Ensure all chunks are uploaded before finalizing
- Check chunk timeout (default 30 minutes)

### Magic number validation fails
- Verify file is actually the claimed type
- Some file types may not be supported

## License

MIT
