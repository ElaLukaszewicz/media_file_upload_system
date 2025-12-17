import http from 'k6/http';
import { check } from 'k6';
import { randomBytes, md5 } from 'k6/crypto';
import encoding from 'k6/encoding';

const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8000';
const CHUNK_SIZE_BYTES = 1_048_576; // 1MB chunks
const MAX_PARALLEL_CHUNKS = 3;

const chunksPerUpload = Number(__ENV.CHUNKS_PER_UPLOAD || '10');
const fileSize = CHUNK_SIZE_BYTES * chunksPerUpload;
const vus = Number(__ENV.VUS || '100');

export const options = {
  scenarios: {
    concurrent_uploads: {
      executor: 'per-vu-iterations',
      vus,
      iterations: 1,
      maxDuration: '30m',
      gracefulStop: '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
  },
};

function initiateUpload(fileName, fileHash) {
  const res = http.post(
    `${API_BASE_URL}/api/upload/initiate`,
    JSON.stringify({
      fileName,
      fileSize,
      mimeType: 'application/octet-stream',
      fileHash,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  check(res, {
    'initiate 200': (r) => r.status === 200,
    'received uploadId': (r) => !!r.json('uploadId'),
  });

  if (res.status !== 200) {
    throw new Error(`initiate failed: ${res.status} ${res.body}`);
  }

  return res.json('uploadId');
}

function uploadChunks(uploadId) {
  for (let start = 0; start < chunksPerUpload; start += MAX_PARALLEL_CHUNKS) {
    const batchRequests = [];
    for (
      let chunkIndex = start;
      chunkIndex < Math.min(start + MAX_PARALLEL_CHUNKS, chunksPerUpload);
      chunkIndex += 1
    ) {
      const chunkData = encoding.b64encode(randomBytes(CHUNK_SIZE_BYTES));
      batchRequests.push([
        'POST',
        `${API_BASE_URL}/api/upload/chunk`,
        JSON.stringify({
          uploadId,
          chunkIndex,
          chunkData,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      ]);
    }

    const responses = http.batch(batchRequests);
    responses.forEach((res, offset) => {
      const chunkIndex = start + offset;
      check(res, {
        [`chunk ${chunkIndex} 200`]: (r) => r.status === 200,
      });

      if (res.status !== 200) {
        throw new Error(`chunk ${chunkIndex} failed: ${res.status} ${res.body}`);
      }
    });
  }
}

function finalizeUpload(uploadId) {
  const res = http.post(
    `${API_BASE_URL}/api/upload/finalize`,
    JSON.stringify({ uploadId }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  check(res, {
    'finalize 200': (r) => r.status === 200,
    'received fileId': (r) => !!r.json('fileId'),
  });

  if (res.status !== 200) {
    throw new Error(`finalize failed: ${res.status} ${res.body}`);
  }

  return res.json('fileId');
}

export default function () {
  const suffix = `${__VU}-${Date.now()}`;
  const fileName = `stress-${suffix}.bin`;
  const fileHash = md5(randomBytes(32), 'hex');

  const uploadId = initiateUpload(fileName, fileHash);
  uploadChunks(uploadId);
  finalizeUpload(uploadId);
}
