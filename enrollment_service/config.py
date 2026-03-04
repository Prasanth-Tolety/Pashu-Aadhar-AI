"""
Configuration — Single source of truth.
=========================================
Change URLs / bucket names / ARNs here. Everything else works out of the box.
"""

import os

# ─────────────────────────────────────────────────────────
# PROJECT PATHS  (resolved relative to this file)
# ─────────────────────────────────────────────────────────
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(_THIS_DIR, ".."))

# ─────────────────────────────────────────────────────────
# AWS GENERAL
# ─────────────────────────────────────────────────────────
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")

# ─────────────────────────────────────────────────────────
# S3 — Image Storage
# ─────────────────────────────────────────────────────────
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "pashuaadhar-livestock-images")
S3_REGION = os.getenv("S3_REGION", AWS_REGION)
S3_PREFIX = "enrollments/"

S3_BUCKET_URL = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com"

# ─────────────────────────────────────────────────────────
# SAGEMAKER — Embedding Model Endpoint
# ─────────────────────────────────────────────────────────
SAGEMAKER_ENDPOINT_NAME = os.getenv(
    "SAGEMAKER_ENDPOINT_NAME", "pashuaadhar-muzzle-embedding-endpoint"
)
SAGEMAKER_REGION = os.getenv("SAGEMAKER_REGION", AWS_REGION)

# Embedding dimension produced by the CNN backbone
EMBEDDING_DIMENSION = 512

# SageMaker model data location (for deployment)
SAGEMAKER_MODEL_S3_URI = os.getenv(
    "SAGEMAKER_MODEL_S3_URI",
    f"s3://{S3_BUCKET_NAME}/sagemaker-models/muzzle_embedding/model.tar.gz",
)
SAGEMAKER_EXECUTION_ROLE = os.getenv("SAGEMAKER_EXECUTION_ROLE", "")
SAGEMAKER_INSTANCE_TYPE = os.getenv("SAGEMAKER_INSTANCE_TYPE", "ml.m5.large")

# ─────────────────────────────────────────────────────────
# DYNAMODB — Livestock Records & Embeddings
# ─────────────────────────────────────────────────────────
DYNAMODB_TABLE_NAME = os.getenv("DYNAMODB_TABLE_NAME", "PashuAadhar_Livestock")
DYNAMODB_REGION = os.getenv("DYNAMODB_REGION", AWS_REGION)

# ─────────────────────────────────────────────────────────
# DUPLICATE DETECTION
# ─────────────────────────────────────────────────────────
DUPLICATE_SIMILARITY_THRESHOLD = float(
    os.getenv("DUPLICATE_SIMILARITY_THRESHOLD", "0.85")
)

# ─────────────────────────────────────────────────────────
# LIVESTOCK ID
# ─────────────────────────────────────────────────────────
LIVESTOCK_ID_PREFIX = "PASH"
DEFAULT_STATE_CODE = "MH"

# ─────────────────────────────────────────────────────────
# ONNX MODEL PATHS  (for offline / on-device use)
# Resolved from PROJECT_ROOT so they work regardless of cwd.
# ─────────────────────────────────────────────────────────
ONNX_FACE_MODEL = os.getenv(
    "ONNX_FACE_MODEL",
    os.path.join(PROJECT_ROOT, "Models", "cattle_face_yolo.onnx"),
)
ONNX_KEYPOINT_MODEL = os.getenv(
    "ONNX_KEYPOINT_MODEL",
    os.path.join(PROJECT_ROOT, "Models", "cattle_muzzle_pose.onnx"),
)

# ─────────────────────────────────────────────────────────
# QUALITY THRESHOLDS (offline validation)
# ─────────────────────────────────────────────────────────
MIN_IMAGE_WIDTH = 640
MIN_IMAGE_HEIGHT = 480
MAX_IMAGE_SIZE_MB = 10
SUPPORTED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "bmp", "webp"]
MIN_QUALITY_SCORE = 120

# Individual check thresholds (tunable)
FACE_CONF_THRESHOLD = 0.5
BLUR_LAPLACIAN_THRESHOLD = 120
EXPOSURE_DARK_LIMIT = 0.4       # max fraction of very dark pixels
EXPOSURE_BRIGHT_LIMIT = 0.4     # max fraction of very bright pixels
SHADOW_DARK_RATIO = 0.35
MOTION_THRESHOLD = 20
DISTANCE_MIN_RATIO = 0.08
DISTANCE_MAX_RATIO = 0.5
CENTER_OFFSET_RATIO = 0.2
ORIENTATION_ASPECT_LIMIT = 1.4
MUZZLE_TEXTURE_THRESHOLD = 40
FACE_CROP_MIN_RATIO = 0.15
KEYPOINT_CONF_THRESHOLD = 0.5
MIN_VALID_KEYPOINTS = 3
ANTI_SPOOF_MOTION_MIN = 2
STABILITY_HOLD_SECONDS = 1.5

# ─────────────────────────────────────────────────────────
# RESULTS / OFFLINE STORAGE
# ─────────────────────────────────────────────────────────
RESULTS_DIR = os.path.join(PROJECT_ROOT, "results")

# ─────────────────────────────────────────────────────────
# ALIASES  (keep both names so every module finds what it imports)
# ─────────────────────────────────────────────────────────
DUPLICATE_THRESHOLD = DUPLICATE_SIMILARITY_THRESHOLD
S3_IMAGE_PREFIX = S3_PREFIX

# ─────────────────────────────────────────────────────────
# API
# ─────────────────────────────────────────────────────────
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
