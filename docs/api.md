## REST Endpoints (Symfony backend)

### POST `/api/upload/initiate`

- Validates file size/type/hash and creates an upload session.
- Request body:

```json
{ "fileName": "example.jpg", "fileSize": 2097152, "mimeType": "image/jpeg", "fileHash": "md5hex" }
```

- Responses:
  - 201 Created: `{ "uploadId": "...", "chunkSize": 1048576, "totalChunks": 2 }`
  - 200 OK (deduped): `{ "uploadId": "...", "chunkSize": 1048576, "totalChunks": 0, "fileId": "existing-id", "message": "File already exists" }`

### POST `/api/upload/chunk`

- Uploads a single base64 chunk; supports parallel requests.
- Request body:

```json
{ "uploadId": "...", "chunkIndex": 0, "chunkData": "base64" }
```

- Response 200 OK: `{ "success": true, "uploadId": "...", "chunkIndex": 0 }`

### POST `/api/upload/finalize`

- Reassembles chunks, validates checksum, stores file by date, returns final `fileId`.
- Request body: `{ "uploadId": "..." }`
- Response 200 OK: `{ "success": true, "uploadId": "...", "fileId": "..." }`

### GET `/api/upload/status/{uploadId}`

- Returns current progress.
- Response 200 OK:

```json
{
  "uploadId": "...",
  "status": "in_progress",
  "uploadedChunks": 1,
  "totalChunks": 2,
  "fileId": null,
  "error": null
}
```

- Status values: `in_progress`, `completed`, `error`.

## Validation and Limits

- Allowed types: images/videos (MIME + magic number validation).
- Max size: 100MB (`MAX_FILE_SIZE` env).
- Chunk size: 1MB (`CHUNK_SIZE` env).
- Rate limit: 10 requests/min/IP (429 when exceeded).

## Error Shape

All errors follow:

```json
{ "error": "message" }
```

Common statuses: 400 (invalid input), 404 (session not found), 429 (rate limited), 500 (server error).

## Client Contracts

- Shared TypeScript contracts live in `shared/apiTypes.ts` and are consumed by both clients.
- Clients compute MD5 hashes before initiate; if `totalChunks` is 0, they mark the upload as completed without chunking.
