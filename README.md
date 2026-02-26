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
└── template.yaml      # AWS SAM deployment template
```

## Enrollment Flow

1. User opens the portal and clicks "Start Enrollment"
2. User captures a photo using the device camera or uploads an image
3. Frontend requests a presigned S3 upload URL from `GET /api/get-upload-url`
4. Frontend uploads image directly to S3 using the presigned URL
5. Frontend calls `POST /api/enroll` with the image key
6. Lambda retrieves the image, calls SageMaker for embeddings, searches OpenSearch
7. Returns `NEW` or `EXISTING` status with livestock ID and similarity score

## Setup

### Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env with your API Gateway URL
npm install
npm run dev
```

### Backend

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

## Environment Variables

### Frontend
| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | API Gateway base URL |

### Lambda
| Variable | Description |
|---|---|
| `S3_BUCKET_NAME` | S3 bucket for animal images |
| `SAGEMAKER_ENDPOINT_NAME` | SageMaker endpoint for embeddings |
| `OPENSEARCH_ENDPOINT` | OpenSearch cluster endpoint |
| `OPENSEARCH_INDEX` | OpenSearch index name |
| `SIMILARITY_THRESHOLD` | Cosine similarity threshold (default: 0.85) |
| `ALLOWED_ORIGIN` | CORS allowed origin |
