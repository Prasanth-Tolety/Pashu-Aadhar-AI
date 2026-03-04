/**
 * Pashu-Aadhaar Local Mock API Server
 *
 * Replaces the AWS Lambda + S3 + SageMaker + OpenSearch stack for local development.
 * Run with: npm start  (from the local-server/ directory)
 *
 * Endpoints:
 *   GET  /upload-url?fileName=...&contentType=...
 *        Returns a fake presigned URL pointing to this server's /mock-upload/* endpoint.
 *
 *   PUT  /mock-upload/<imageKey>
 *        Accepts the raw image upload (mimics S3 presigned PUT). No storage needed.
 *
 *   POST /enroll  { imageKey: string }
 *        Alternates between NEW and EXISTING responses so you can test both flows.
 *        Odd calls  → status: "NEW"      (new animal enrolled)
 *        Even calls → status: "EXISTING" (animal already registered)
 */

import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// ── CORS ────────────────────────────────────────────────────────────────────
// Allow requests from the Vite dev server (localhost:3000) and from the
// browser's direct PUT to the mock-upload endpoint.
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Mock S3 upload endpoint ─────────────────────────────────────────────────
// Must be registered BEFORE express.json() so that raw image bytes are not
// incorrectly parsed as JSON.
app.put(
  '/mock-upload/*',
  express.raw({ type: '*/*', limit: '20mb' }),
  (_req: Request, res: Response) => {
    console.log('[mock] PUT /mock-upload/* → 200 OK (image received, not stored)');
    // S3 presigned PUT returns 200 with an empty body
    res.status(200).end();
  }
);

// ── JSON body parser for API routes ─────────────────────────────────────────
app.use(express.json());

// ── GET /upload-url ─────────────────────────────────────────────────────────
app.get('/upload-url', (req: Request, res: Response) => {
  const { fileName, contentType } = req.query as {
    fileName?: string;
    contentType?: string;
  };

  if (!fileName || !contentType) {
    res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'fileName and contentType query parameters are required',
    });
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!allowedTypes.includes(contentType)) {
    res.status(400).json({
      error: 'INVALID_CONTENT_TYPE',
      message: 'Only JPEG, PNG, WebP, and HEIC images are allowed',
    });
    return;
  }

  const safeFileName = String(fileName).replace(/\s+/g, '_');
  const imageKey = `uploads/${Date.now()}-${safeFileName}`;
  // Upload URL points directly to this mock server
  const uploadUrl = `http://localhost:${PORT}/mock-upload/${imageKey}`;

  console.log(`[mock] GET /upload-url → imageKey: ${imageKey}`);
  res.json({ uploadUrl, imageKey });
});

// ── POST /enroll ─────────────────────────────────────────────────────────────
// Alternates NEW / EXISTING so you can see both result screens without real ML.
let enrollCallCount = 0;
let lastEnrolled: { livestock_id: string } | null = null;

app.post('/enroll', (req: Request, res: Response) => {
  const { imageKey } = req.body as { imageKey?: string };

  if (!imageKey || typeof imageKey !== 'string') {
    res.status(400).json({
      error: 'INVALID_IMAGE_KEY',
      message: 'imageKey is required in the request body',
    });
    return;
  }

  enrollCallCount += 1;
  const isNew = enrollCallCount % 2 !== 0; // odd → NEW, even → EXISTING

  if (isNew || !lastEnrolled) {
    const livestock_id = generateLivestockId();
    lastEnrolled = { livestock_id };
    console.log(
      `[mock] POST /enroll (call #${enrollCallCount}) → NEW  livestock_id: ${livestock_id}`
    );
    res.status(201).json({
      status: 'NEW',
      livestock_id,
      similarity: parseFloat((Math.random() * 0.15 + 0.05).toFixed(4)),
      message: 'Animal successfully enrolled',
    });
  } else {
    console.log(
      `[mock] POST /enroll (call #${enrollCallCount}) → EXISTING  livestock_id: ${lastEnrolled.livestock_id}`
    );
    res.json({
      status: 'EXISTING',
      livestock_id: lastEnrolled.livestock_id,
      similarity: parseFloat((Math.random() * 0.05 + 0.93).toFixed(4)),
      message: 'Animal already registered in the system',
    });
  }
});

// ── Utility ──────────────────────────────────────────────────────────────────
function generateLivestockId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PA-${timestamp}-${random}`;
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n🐄  Pashu-Aadhaar Mock API Server');
  console.log(`    Listening on http://localhost:${PORT}\n`);
  console.log('    Endpoints:');
  console.log('      GET  /upload-url?fileName=...&contentType=...');
  console.log('      PUT  /mock-upload/<imageKey>        (fake S3 upload)');
  console.log('      POST /enroll                       (mock ML + vector search)');
  console.log('');
  console.log('    Enrollment responses alternate:');
  console.log('      1st enroll → status: NEW');
  console.log('      2nd enroll → status: EXISTING');
  console.log('      3rd enroll → status: NEW  … and so on');
  console.log('');
  console.log('    Waiting for requests from frontend (http://localhost:3000) …\n');
});
