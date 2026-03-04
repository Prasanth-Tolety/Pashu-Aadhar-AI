"""
Offline Input Validator  (self-contained)
==========================================
Validates metadata + image quality entirely on-device.
No AWS / internet dependencies. No project-root imports.
"""

import os
import re
import cv2
import numpy as np

from enrollment_service.models.schemas import (
    OwnerInfo,
    AnimalMetadata,
    ValidationResult,
)
from enrollment_service.offline.capture_assistant import CaptureAssistant
from enrollment_service.config import (
    MIN_IMAGE_WIDTH,
    MIN_IMAGE_HEIGHT,
    MAX_IMAGE_SIZE_MB,
    SUPPORTED_IMAGE_FORMATS,
    MIN_QUALITY_SCORE,
)


class InputValidator:
    """Lightweight offline validator — runs on-device."""

    def __init__(self):
        self._assistant = None  # lazy

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def validate(
        self,
        image_path: str = None,
        image_bytes: bytes = None,
        owner: OwnerInfo = None,
        animal: AnimalMetadata = None,
    ) -> ValidationResult:
        errors: list[str] = []
        warnings: list[str] = []

        # Metadata
        meta_e, meta_w = self._validate_metadata(owner, animal)
        errors.extend(meta_e)
        warnings.extend(meta_w)

        # Image load + format
        frame, img_e = self._load_and_check_image(image_path, image_bytes)
        errors.extend(img_e)

        if frame is None:
            return ValidationResult(
                is_valid=False, quality_score=0,
                errors=errors, warnings=warnings,
            )

        # Quality via CaptureAssistant
        qr = self._check_quality(frame)
        warnings.extend(qr.get("suggestions", []))

        score = qr.get("score", 0)
        is_valid = len(errors) == 0 and score >= MIN_QUALITY_SCORE

        return ValidationResult(
            is_valid=is_valid,
            quality_score=score,
            errors=errors,
            warnings=warnings,
            face_box=qr.get("box"),
            suggestions=qr.get("suggestions", []),
        )

    # ------------------------------------------------------------------
    # Metadata validation
    # ------------------------------------------------------------------
    @staticmethod
    def _validate_metadata(owner: OwnerInfo = None, animal: AnimalMetadata = None):
        errors, warnings = [], []

        if owner:
            if not owner.name or len(owner.name.strip()) < 2:
                errors.append("Owner name is required (min 2 characters)")
            if not owner.phone or not re.match(r"^\d{10}$", owner.phone):
                errors.append("Valid 10-digit phone number is required")
            if owner.aadhaar_last4 and not re.match(r"^\d{4}$", owner.aadhaar_last4):
                warnings.append("Aadhaar last-4 should be exactly 4 digits")
            if not owner.village:
                warnings.append("Village name recommended for records")
            if not owner.state:
                warnings.append("State recommended for Livestock ID generation")
        else:
            errors.append("Owner information is required")

        if animal:
            if animal.species not in ("cattle", "buffalo"):
                errors.append("Species must be 'cattle' or 'buffalo'")
            if animal.sex and animal.sex not in ("male", "female"):
                warnings.append("Sex should be 'male' or 'female'")
            if animal.age_months < 0:
                errors.append("Age cannot be negative")
            if not animal.breed:
                warnings.append("Breed is recommended for records")
        else:
            errors.append("Animal information is required")

        return errors, warnings

    # ------------------------------------------------------------------
    # Image loading
    # ------------------------------------------------------------------
    @staticmethod
    def _load_and_check_image(image_path: str = None, image_bytes: bytes = None):
        errors = []

        if image_path and image_bytes:
            errors.append("Provide either image_path or image_bytes, not both")
            return None, errors

        frame = None
        if image_path:
            if not os.path.isfile(image_path):
                errors.append(f"Image file not found: {image_path}")
                return None, errors

            ext = image_path.rsplit(".", 1)[-1].lower()
            if ext not in SUPPORTED_IMAGE_FORMATS:
                errors.append(f"Unsupported format '.{ext}'. Use: {SUPPORTED_IMAGE_FORMATS}")
                return None, errors

            size_mb = os.path.getsize(image_path) / (1024 * 1024)
            if size_mb > MAX_IMAGE_SIZE_MB:
                errors.append(f"Image too large ({size_mb:.1f}MB). Max {MAX_IMAGE_SIZE_MB}MB")
                return None, errors

            frame = cv2.imread(image_path)

        elif image_bytes:
            if len(image_bytes) > MAX_IMAGE_SIZE_MB * 1024 * 1024:
                errors.append(f"Image too large. Max {MAX_IMAGE_SIZE_MB}MB")
                return None, errors
            arr = np.frombuffer(image_bytes, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        else:
            errors.append("No image provided")
            return None, errors

        if frame is None:
            errors.append("Failed to decode image")
            return None, errors

        h, w = frame.shape[:2]
        if w < MIN_IMAGE_WIDTH or h < MIN_IMAGE_HEIGHT:
            errors.append(
                f"Image resolution too low ({w}x{h}). "
                f"Minimum: {MIN_IMAGE_WIDTH}x{MIN_IMAGE_HEIGHT}"
            )

        return frame, errors

    # ------------------------------------------------------------------
    # Quality check (delegates to CaptureAssistant)
    # ------------------------------------------------------------------
    def _check_quality(self, frame: np.ndarray) -> dict:
        if self._assistant is None:
            self._assistant = CaptureAssistant()

        result = self._assistant.analyze(frame)
        return {
            "score": result["score"],
            "suggestions": result["suggestions"],
            "box": result["box"],
            "approved": result["approved"],
        }
