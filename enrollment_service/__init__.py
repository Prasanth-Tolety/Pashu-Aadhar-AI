"""
PashuAadhar AI — Livestock Enrollment Service
==============================================

Fully self-contained enrollment pipeline for cattle identification
using muzzle biometrics. No external project-root imports.

Architecture:
    models/          — ONNX face detector, keypoint detector, CNN embedding model
    offline/         — Runs on farmer's phone (no internet required)
    backend/         — AWS cloud services (S3, SageMaker, DynamoDB)
    sagemaker/       — SageMaker model packaging, inference handler, deployment
    orchestrator.py  — End-to-end pipeline
    api.py           — FastAPI REST endpoints
"""

__version__ = "2.0.0"
