# Pashu-Aadhaar Enrollment Portal

A production-ready web application for enrolling livestock animals using AI-powered biometric identification.

## Architecture

- **Frontend**: React + TypeScript (Vite), hosted on AWS S3 + CloudFront
- **Backend**: AWS Lambda (Node.js) + API Gateway (Serverless)
- **Storage**: AWS S3 (images), AWS OpenSearch (embeddings), AWS Aurora PostgreSQL (metadata)
- **AI**: AWS SageMaker endpoint for muzzle pattern embedding generation

## Project Structure

```
├── frontend/          # React TypeScript frontend
│   └── src/
│       ├── components/
│       │   ├── CameraCapture/
│       │   ├── EnrollmentResult/
│       │   ├── ImageUpload/
│       │   └── UploadProgress/
│       ├── pages/
│       │   ├── Home.tsx
│       │   ├── Enrollment.tsx
│       │   └── Result.tsx
│       ├── services/
│       │   ├── api.ts
│       │   └── s3.ts
│       ├── styles/
│       └── types/
├── lambda/            # AWS Lambda functions
│   ├── getUploadUrl/  # Presigned URL generator
│   ├── enroll/        # Enrollment processor
│   └── shared/        # Shared utilities
├── local-server/      # Mock API server for local development
│   └── server.ts      # Replaces Lambda + S3 + SageMaker + OpenSearch locally
└── template.yaml      # AWS SAM deployment template
```

---

## Running Locally (No AWS Required)

The `local-server` replaces all AWS services (S3, SageMaker, OpenSearch) with an in-process mock so you can develop and test the full UI flow without any cloud credentials.

### Prerequisites

- **Node.js 18+** — check with `node --version`
- **npm 9+** — check with `npm --version`

### Quick start (single command)

```bash
# 1. Install all dependencies
npm run install:all

# 2. Start both servers together
npm run dev
```

This uses [concurrently](https://github.com/open-cli-tools/concurrently) to run:
- `api` — Mock API server on **http://localhost:3001**
- `ui`  — Vite frontend on **http://localhost:3000**

Then open **http://localhost:3000** in your browser.

> If `npm run dev` isn't working, start the two servers manually (see below).

---

### Manual start (two terminals)

**Terminal 1 — Mock API server**

```bash
cd local-server
npm install
npm start
```

Expected output:
```
🐄  Pashu-Aadhaar Mock API Server
    Listening on http://localhost:3001

    Endpoints:
      GET  /api/get-upload-url?fileName=...&contentType=...
      PUT  /mock-upload/<imageKey>        (fake S3 upload)
      POST /api/enroll                   (mock ML + vector search)
```

**Terminal 2 — Frontend dev server**

```bash
cd frontend
cp .env.example .env    # VITE_API_BASE_URL is empty → uses Vite proxy
npm install
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in ...ms
  ➜  Local:   http://localhost:3000/
```

Open **http://localhost:3000** and go through the full enrollment flow.

---

### How the local mock works

| Step | What happens locally |
|---|---|
| `GET /api/get-upload-url` | Returns a fake `uploadUrl` pointing to `localhost:3001/mock-upload/…` |
| `PUT <uploadUrl>` | Mock server accepts the raw image bytes and returns `200 OK` (nothing is stored) |
| `POST /api/enroll` | Returns a mock `NEW` or `EXISTING` result (alternates on each call so you can test both screens) |

**Enrollment response pattern:**

| Enroll call | Status | Notes |
|---|---|---|
| 1st | `NEW` | Fresh animal enrolled |
| 2nd | `EXISTING` | Same `livestock_id` returned |
| 3rd | `NEW` | New animal enrolled |
| … | alternates | |

---

## Enrollment Flow

1. User opens the portal and clicks **Start Enrollment**
2. User captures a photo using the device camera or uploads an image
3. Frontend requests a presigned S3 upload URL from `GET /api/get-upload-url`
4. Frontend uploads image directly to S3 using the presigned URL
5. Frontend calls `POST /api/enroll` with the image key
6. Lambda retrieves the image, calls SageMaker for embeddings, searches OpenSearch
7. Returns `NEW` or `EXISTING` status with livestock ID and similarity score

---

## Deploying to AWS

### Build the Lambda functions

```bash
cd lambda
npm install
npm run build
```

### Deploy with AWS SAM

```bash
sam build
sam deploy --guided
```

### Configure the frontend for production

```bash
cd frontend
cp .env.example .env
# Edit .env and set:
# VITE_API_BASE_URL=https://<your-api-id>.execute-api.<region>.amazonaws.com/prod
npm run build
# Upload frontend/dist/ to your S3 + CloudFront distribution
```

---

## Environment Variables

### Frontend
| Variable | Local dev | Production |
|---|---|---|
| `VITE_API_BASE_URL` | *(empty — uses Vite proxy)* | `https://<api-id>.execute-api.<region>.amazonaws.com/prod` |

### Lambda
| Variable | Description |
|---|---|
| `S3_BUCKET_NAME` | S3 bucket for animal images |
| `SAGEMAKER_ENDPOINT_NAME` | SageMaker endpoint for embeddings |
| `OPENSEARCH_ENDPOINT` | OpenSearch cluster endpoint |
| `OPENSEARCH_INDEX` | OpenSearch index name (default: `livestock-embeddings`) |
| `SIMILARITY_THRESHOLD` | Cosine similarity threshold (default: `0.85`) |
| `ALLOWED_ORIGIN` | CORS allowed origin (set to your CloudFront domain in production) |

