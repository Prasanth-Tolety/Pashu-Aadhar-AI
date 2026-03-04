"""
S3 Image Storage Service
=========================
Stores enrollment images in S3 with a structured key layout:

    s3://<bucket>/enrollments/<livestock_id>/<timestamp>_<image_type>.jpg

Supports:
    - Upload from file path, OpenCV frame (numpy), or raw bytes
    - Download / presigned-URL generation
    - Offline stub that saves locally when no internet
"""

import os
import io
import time
import logging
from typing import Optional

import cv2
import numpy as np

from enrollment_service.config import (
    S3_BUCKET_NAME,
    S3_IMAGE_PREFIX,
    AWS_REGION,
    RESULTS_DIR,
)

logger = logging.getLogger(__name__)

# ─── boto3 is optional (offline mode) ───────────────────
try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError

    _BOTO3 = True
except ImportError:
    _BOTO3 = False


class S3StorageService:
    """Upload / retrieve images from S3 or local fallback."""

    def __init__(self, bucket: str = None, prefix: str = None, offline: bool = False):
        self.bucket = bucket or S3_BUCKET_NAME
        self.prefix = prefix or S3_IMAGE_PREFIX
        self.offline = offline or (not _BOTO3)

        if not self.offline:
            try:
                self._s3 = boto3.client("s3", region_name=AWS_REGION)
                # Quick connectivity check
                self._s3.head_bucket(Bucket=self.bucket)
                logger.info(f"S3 connected: s3://{self.bucket}/{self.prefix}")
            except Exception as e:
                logger.warning(f"S3 unavailable ({e}), falling back to offline storage")
                self.offline = True

        if self.offline:
            self._local_root = os.path.join(RESULTS_DIR, "s3_offline")
            os.makedirs(self._local_root, exist_ok=True)
            logger.info(f"Offline storage: {self._local_root}")

    # ─── public API ──────────────────────────────────────

    def upload_image(
        self,
        image,
        livestock_id: str,
        image_type: str = "muzzle",
        fmt: str = ".jpg",
    ) -> str:
        """
        Upload an image. Returns the S3 key (or local path in offline mode).

        Args:
            image:        numpy array (BGR), bytes, or file-path string.
            livestock_id: Unique animal ID for the key prefix.
            image_type:   e.g. "muzzle", "face", "full".
            fmt:          Image file extension.
        """
        ts = int(time.time() * 1000)
        filename = f"{ts}_{image_type}{fmt}"
        key = f"{self.prefix}{livestock_id}/{filename}"

        img_bytes = self._to_bytes(image, fmt)

        if self.offline:
            return self._save_local(key, img_bytes)
        else:
            return self._upload_s3(key, img_bytes, fmt)

    def download_image(self, key: str) -> Optional[np.ndarray]:
        """Download an image and return as BGR numpy array."""
        raw = self._get_bytes(key)
        if raw is None:
            return None
        arr = np.frombuffer(raw, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)

    def get_presigned_url(self, key: str, expires: int = 3600) -> Optional[str]:
        """Generate a pre-signed URL (online only)."""
        if self.offline:
            local = os.path.join(self._local_root, key)
            return f"file://{local}" if os.path.exists(local) else None
        try:
            url = self._s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires,
            )
            return url
        except Exception as e:
            logger.error(f"Presigned URL error: {e}")
            return None

    def list_images(self, livestock_id: str) -> list:
        """List all image keys for a given livestock ID."""
        prefix = f"{self.prefix}{livestock_id}/"
        if self.offline:
            local_dir = os.path.join(self._local_root, prefix)
            if not os.path.isdir(local_dir):
                return []
            return [
                os.path.join(prefix, f)
                for f in os.listdir(local_dir)
                if os.path.isfile(os.path.join(local_dir, f))
            ]
        try:
            resp = self._s3.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
            return [obj["Key"] for obj in resp.get("Contents", [])]
        except Exception as e:
            logger.error(f"list_images error: {e}")
            return []

    # ─── internals ───────────────────────────────────────

    def _to_bytes(self, image, fmt: str) -> bytes:
        if isinstance(image, bytes):
            return image
        if isinstance(image, str):
            with open(image, "rb") as f:
                return f.read()
        if isinstance(image, np.ndarray):
            ok, buf = cv2.imencode(fmt, image)
            if not ok:
                raise ValueError("Failed to encode image")
            return buf.tobytes()
        raise TypeError(f"Unsupported image type: {type(image)}")

    def _upload_s3(self, key: str, data: bytes, fmt: str) -> str:
        content_type = "image/jpeg" if fmt in (".jpg", ".jpeg") else "image/png"
        self._s3.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        logger.info(f"Uploaded s3://{self.bucket}/{key}")
        return key

    def _save_local(self, key: str, data: bytes) -> str:
        path = os.path.join(self._local_root, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        logger.info(f"Saved locally: {path}")
        return key

    def _get_bytes(self, key: str) -> Optional[bytes]:
        if self.offline:
            path = os.path.join(self._local_root, key)
            if os.path.isfile(path):
                with open(path, "rb") as f:
                    return f.read()
            return None
        try:
            resp = self._s3.get_object(Bucket=self.bucket, Key=key)
            return resp["Body"].read()
        except Exception as e:
            logger.error(f"Download error ({key}): {e}")
            return None
