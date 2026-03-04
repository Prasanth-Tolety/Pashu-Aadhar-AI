"""
Embedding Service
==================
Generates 512-d muzzle embeddings via:
    1. SageMaker real-time endpoint  (online / production)
    2. Local EfficientNet-B0         (offline / development)

The caller does not need to know which path is used.
"""

import os
import io
import json
import logging
from typing import Optional

import cv2
import numpy as np

from enrollment_service.config import (
    SAGEMAKER_ENDPOINT_NAME,
    SAGEMAKER_REGION,
    EMBEDDING_DIMENSION,
)

logger = logging.getLogger(__name__)

# ─── Optional imports ────────────────────────────────────
try:
    import boto3

    _BOTO3 = True
except ImportError:
    _BOTO3 = False

try:
    from enrollment_service.models.embedding_model import MuzzleEmbeddingModel

    _LOCAL_MODEL = True
except ImportError:
    _LOCAL_MODEL = False


class EmbeddingService:
    """Generate muzzle embeddings via SageMaker or local model."""

    def __init__(self, use_local: bool = False, weights_path: str = None):
        """
        Args:
            use_local:     Force local model regardless of SageMaker availability.
            weights_path:  Fine-tuned weights for local model (optional).
        """
        self._sagemaker_client = None
        self._local_model = None
        self._use_local = use_local

        if not use_local and _BOTO3:
            try:
                client = boto3.client(
                    "sagemaker-runtime", region_name=SAGEMAKER_REGION
                )
                # Quick check — describe endpoint
                sm = boto3.client("sagemaker", region_name=SAGEMAKER_REGION)
                status = sm.describe_endpoint(
                    EndpointName=SAGEMAKER_ENDPOINT_NAME
                )["EndpointStatus"]
                if status == "InService":
                    self._sagemaker_client = client
                    logger.info(
                        f"SageMaker endpoint active: {SAGEMAKER_ENDPOINT_NAME}"
                    )
                else:
                    logger.warning(
                        f"Endpoint status={status}, falling back to local"
                    )
                    self._use_local = True
            except Exception as e:
                logger.warning(f"SageMaker unavailable ({e}), using local model")
                self._use_local = True
        else:
            self._use_local = True

        if self._use_local and _LOCAL_MODEL:
            self._local_model = MuzzleEmbeddingModel(weights_path=weights_path)
            logger.info("Local embedding model loaded")

    # ─── public API ──────────────────────────────────────

    def generate_embedding(self, image) -> Optional[np.ndarray]:
        """
        Generate a 512-d embedding from a muzzle image.

        Args:
            image:  numpy array (BGR), raw bytes, or file path.

        Returns:
            np.ndarray of shape (512,), or None on failure.
        """
        if self._sagemaker_client and not self._use_local:
            return self._invoke_sagemaker(image)
        elif self._local_model:
            return self._invoke_local(image)
        else:
            logger.error("No embedding backend available")
            return None

    def batch_embed(self, images: list) -> list:
        """Generate embeddings for a list of images."""
        return [self.generate_embedding(img) for img in images]

    @property
    def is_online(self) -> bool:
        return self._sagemaker_client is not None and not self._use_local

    # ─── SageMaker path ─────────────────────────────────

    def _invoke_sagemaker(self, image) -> Optional[np.ndarray]:
        img_bytes = self._to_bytes(image)
        try:
            response = self._sagemaker_client.invoke_endpoint(
                EndpointName=SAGEMAKER_ENDPOINT_NAME,
                ContentType="application/x-image",
                Body=img_bytes,
            )
            body = json.loads(response["Body"].read().decode())
            emb = np.array(body["embedding"], dtype=np.float32)
            if emb.shape[0] != EMBEDDING_DIMENSION:
                logger.warning(
                    f"Unexpected dimension {emb.shape[0]} "
                    f"(expected {EMBEDDING_DIMENSION})"
                )
            return emb
        except Exception as e:
            logger.error(f"SageMaker invoke error: {e}")
            # Fall back to local
            if self._local_model:
                logger.info("Falling back to local model")
                return self._invoke_local(image)
            return None

    # ─── Local path ──────────────────────────────────────

    def _invoke_local(self, image) -> Optional[np.ndarray]:
        try:
            if isinstance(image, np.ndarray):
                return self._local_model.embed_frame(image)
            elif isinstance(image, bytes):
                return self._local_model.embed_image_bytes(image)
            elif isinstance(image, str):
                frame = cv2.imread(image)
                if frame is None:
                    raise ValueError(f"Cannot read image: {image}")
                return self._local_model.embed_frame(frame)
            else:
                raise TypeError(f"Unsupported type: {type(image)}")
        except Exception as e:
            logger.error(f"Local embedding error: {e}")
            return None

    # ─── helpers ─────────────────────────────────────────

    @staticmethod
    def _to_bytes(image) -> bytes:
        if isinstance(image, bytes):
            return image
        if isinstance(image, str):
            with open(image, "rb") as f:
                return f.read()
        if isinstance(image, np.ndarray):
            ok, buf = cv2.imencode(".jpg", image)
            if not ok:
                raise ValueError("imencode failed")
            return buf.tobytes()
        raise TypeError(f"Unsupported type: {type(image)}")
