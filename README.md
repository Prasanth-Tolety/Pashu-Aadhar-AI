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
├── backend/           # AWS Lambda functions
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

### Build the backend (Lambda functions)

```bash
cd backend
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

### Backend (Lambda)
| Variable | Description |
|---|---|
| `S3_BUCKET_NAME` | S3 bucket for animal images |
| `SAGEMAKER_ENDPOINT_NAME` | SageMaker endpoint for embeddings |
| `OPENSEARCH_ENDPOINT` | OpenSearch cluster endpoint |
| `OPENSEARCH_INDEX` | OpenSearch index name (default: `livestock-embeddings`) |
| `SIMILARITY_THRESHOLD` | Cosine similarity threshold (default: `0.85`) |
| `ALLOWED_ORIGIN` | CORS allowed origin (set to your CloudFront domain in production) |

---

## Hosting on AWS — Step-by-Step Procedure

This section describes how to deploy the full Pashu-Aadhaar stack (backend + frontend) on AWS.

### Prerequisites

- **AWS Account** with appropriate permissions (IAM, Lambda, API Gateway, S3, SageMaker, OpenSearch)
- **AWS CLI** installed and configured — `aws configure`
- **AWS SAM CLI** installed — [Install SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- **Node.js 18+** and **npm 9+**

### Step 1 — Install Dependencies and Build

```bash
# From the project root
npm run install:all

# Build the backend Lambda functions
npm run build:backend

# Build the frontend
npm run build:frontend
```

### Step 2 — Build and Deploy the Backend with SAM

SAM uses the `template.yaml` at the project root to provision all AWS resources (Lambda functions, API Gateway, S3 bucket, IAM roles).

```bash
# Build the SAM application
sam build

# Deploy (first time — interactive guided setup)
sam deploy --guided
```

During the guided deployment you will be prompted for:

| Parameter | Description | Example |
|---|---|---|
| **Stack Name** | CloudFormation stack name | `pashu-aadhaar-stack` |
| **AWS Region** | Deployment region | `ap-south-1` |
| **Stage** | Environment stage | `prod` |
| **S3BucketName** | Bucket for animal images (must be globally unique) | `pashu-aadhaar-images-prod` |
| **SageMakerEndpointName** | Your SageMaker inference endpoint | `livestock-embedding-endpoint` |
| **OpenSearchEndpoint** | OpenSearch domain endpoint URL | `https://search-xxx.ap-south-1.es.amazonaws.com` |
| **OpenSearchIndex** | Index name for embeddings | `livestock-embeddings` |
| **SimilarityThreshold** | Cosine similarity threshold | `0.85` |
| **AllowedOrigin** | CORS origin (your CloudFront domain) | `https://d1234abcd.cloudfront.net` |

SAM saves your answers in `samconfig.toml` so subsequent deploys only need:

```bash
sam deploy
```

After deployment, SAM outputs the **API Gateway URL**, for example:

```
https://<api-id>.execute-api.<region>.amazonaws.com/prod
```

### Step 3 — Deploy the Frontend to S3 + CloudFront

1. **Create an S3 bucket for static hosting:**

   ```bash
   aws s3 mb s3://pashu-aadhaar-frontend-prod --region ap-south-1
   ```

2. **Configure the frontend to use the API Gateway URL:**

   ```bash
   cd frontend
   cp .env.example .env
   ```

   Edit `.env`:
   ```
   VITE_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod
   ```

3. **Rebuild the frontend with the production API URL:**

   ```bash
   npm run build
   ```

4. **Upload the build to S3:**

   ```bash
   aws s3 sync dist/ s3://pashu-aadhaar-frontend-prod --delete
   ```

5. **Create a CloudFront distribution** pointing to the S3 bucket:

   ```bash
   aws cloudfront create-distribution \
     --origin-domain-name pashu-aadhaar-frontend-prod.s3.amazonaws.com \
     --default-root-object index.html
   ```

   > For production, configure a custom domain, SSL certificate via ACM, and an Origin Access Identity (OAI) so the S3 bucket stays private.

6. **Update the AllowedOrigin** in your SAM stack to match the CloudFront domain:

   ```bash
   sam deploy --parameter-overrides AllowedOrigin=https://d1234abcd.cloudfront.net
   ```

### Step 4 — Set Up Supporting AWS Services

#### SageMaker Endpoint

Deploy your trained livestock embedding model to a SageMaker real-time inference endpoint. The endpoint name must match the `SageMakerEndpointName` parameter.

#### OpenSearch Domain

Create an Amazon OpenSearch Service domain and configure a `livestock-embeddings` index with a `knn_vector` field for storing embeddings:

```json
PUT /livestock-embeddings
{
  "settings": {
    "index.knn": true
  },
  "mappings": {
    "properties": {
      "embedding": {
        "type": "knn_vector",
        "dimension": 512  // adjust to match your SageMaker model's output dimension
      },
      "livestock_id": { "type": "keyword" },
      "image_key": { "type": "keyword" },
      "enrolled_at": { "type": "date" }
    }
  }
}
```

### Step 5 — Verify the Deployment

```bash
# Test the get-upload-url endpoint
curl "https://<api-id>.execute-api.<region>.amazonaws.com/prod/api/get-upload-url?fileName=test.jpg&contentType=image/jpeg"

# Test the enroll endpoint
curl -X POST "https://<api-id>.execute-api.<region>.amazonaws.com/prod/api/enroll" \
  -H "Content-Type: application/json" \
  -d '{"imageKey": "uploads/test.jpg"}'
```

Open the CloudFront URL in your browser to use the enrollment portal.

