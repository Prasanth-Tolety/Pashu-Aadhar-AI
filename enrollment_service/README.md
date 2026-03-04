# Cattle Enrollment Service v2

A fully self-contained, modular enrollment pipeline for cattle biometric identification using muzzle prints.

## Architecture

```
enrollment_service/
├── config.py                     # All configuration & thresholds
├── models/
│   ├── schemas.py                # Data classes (request/response)
│   ├── face_detector.py          # ONNX cattle face detection
│   ├── keypoint_detector.py      # ONNX muzzle keypoint detection
│   └── embedding_model.py        # EfficientNet-B0 embedding (SageMaker-ready)
├── offline/
│   ├── quality_checks.py         # OpenCV quality checks (blur, exposure, etc.)
│   ├── capture_assistant.py      # Face + keypoints + quality → capture guidance
│   ├── input_validator.py        # Complete input validation
│   └── realtime_guide.py         # Camera loop with visual overlays
├── backend/
│   ├── s3_storage.py             # S3 image storage (+ offline fallback)
│   ├── embedding_service.py      # SageMaker or local embedding generation
│   ├── duplicate_detector.py     # Cosine similarity duplicate check
│   └── livestock_id_generator.py # Sequential ID generation (DynamoDB/offline)
├── sagemaker/
│   ├── inference.py              # SageMaker inference handler
│   ├── package_model.py          # Create model.tar.gz
│   └── deploy.py                 # Deploy endpoint to SageMaker
├── orchestrator.py               # 5-step enrollment pipeline
├── api.py                        # FastAPI REST endpoints
├── validate_offline.py           # Comprehensive offline test suite
├── setup_aws.py                  # Create S3 bucket + DynamoDB table
└── requirements.txt              # Python dependencies
```

## 5-Step Enrollment Pipeline

| Step | Component | Offline Mode | Online Mode |
|------|-----------|-------------|-------------|
| 1. Validate input | `InputValidator` | ONNX models + OpenCV | Same |
| 2. Store images | `S3StorageService` | Local filesystem | S3 bucket |
| 3. Generate embedding | `EmbeddingService` | Local EfficientNet-B0 | SageMaker endpoint |
| 4. Duplicate detection | `DuplicateDetector` | JSON file cache | DynamoDB scan |
| 5. Create Livestock ID | `LivestockIDGenerator` | File counter | DynamoDB atomic counter |

## Quick Start

### 1. Install dependencies
```bash
cd enrollment_service
pip install -r requirements.txt
```

### 2. Run offline validation (no AWS needed)
```bash
cd "C:\AWS Hackathon"
python -m enrollment_service.validate_offline
```

### 3. Run the REST API
```bash
# Offline mode
set ENROLLMENT_OFFLINE=1
python -m enrollment_service.api

# Online mode (requires AWS setup)
python -m enrollment_service.api
```

### 4. Deploy to SageMaker
```bash
# Package model
python -m enrollment_service.sagemaker.package_model --output model.tar.gz

# Deploy endpoint
python -m enrollment_service.sagemaker.deploy --model-tar model.tar.gz
```

## Models

| Model | File | Input | Output | Usage |
|-------|------|-------|--------|-------|
| Cattle Face YOLO | `cattle_face_yolo.onnx` | 640×640 BGR | Bounding boxes | Offline face detection |
| Muzzle Keypoints | `cattle_muzzle_pose.onnx` | 256×256 crop | Keypoint coords | Offline pose guidance |
| EfficientNet-B0 | PyTorch (torchvision) | 224×224 RGB | 512-d embedding | Biometric embedding |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/enroll` | Full enrollment pipeline |
| `POST` | `/validate` | Validate image quality only |
| `POST` | `/embed` | Generate embedding only |
| `POST` | `/duplicate-check` | Check for duplicate animal |
| `GET` | `/health` | Health check |

## AWS Resources Needed

- **S3 Bucket**: `cattle-enrollment-images`
- **DynamoDB Table**: `cattle-enrollment` (partition key: `livestock_id`)
- **SageMaker Endpoint**: `cattle-muzzle-embedding` (ml.m5.large)
- **IAM Role**: SageMaker execution role with S3 + DynamoDB access

Run `python -m enrollment_service.setup_aws` to create S3 and DynamoDB resources.
