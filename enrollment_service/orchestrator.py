"""
Enrollment Orchestrator
========================
Coordinates the 5-step enrollment pipeline:

    1. Validate input          (offline — InputValidator)
    2. Store images            (S3StorageService)
    3. Generate embedding      (EmbeddingService)
    4. Duplicate detection     (DuplicateDetector)
    5. Create Livestock ID     (LivestockIDGenerator)

Can run entirely offline (local storage, local model, file-based IDs)
or fully online (S3, SageMaker, DynamoDB).
"""

import time
import logging
from typing import Optional, Dict

import numpy as np
import cv2

from enrollment_service.models.schemas import (
    OwnerInfo,
    AnimalMetadata,
    ValidationResult,
    DuplicateCheckResult,
    EnrollmentResponse,
)
from enrollment_service.offline.input_validator import InputValidator
from enrollment_service.offline.capture_assistant import CaptureAssistant
from enrollment_service.backend.s3_storage import S3StorageService
from enrollment_service.backend.embedding_service import EmbeddingService
from enrollment_service.backend.duplicate_detector import DuplicateDetector
from enrollment_service.backend.livestock_id_generator import LivestockIDGenerator
from enrollment_service.config import DUPLICATE_THRESHOLD

logger = logging.getLogger(__name__)


class EnrollmentOrchestrator:
    """
    Top-level enrollment pipeline.

    Usage:
        orch = EnrollmentOrchestrator(offline=True)
        result = orch.enroll(image=frame, owner=owner, animal=animal)
    """

    def __init__(self, offline: bool = False):
        self.offline = offline
        self.validator = InputValidator()
        self.assistant = CaptureAssistant()
        self.storage = S3StorageService(offline=offline)
        self.embedder = EmbeddingService(use_local=offline)
        self.detector = DuplicateDetector(offline=offline)
        self.id_gen = LivestockIDGenerator(offline=offline)
        logger.info(f"Orchestrator initialised (offline={offline})")

    # ─────────────────────────────────────────────────────
    # Main enrollment pipeline
    # ─────────────────────────────────────────────────────

    def enroll(
        self,
        image,
        owner: OwnerInfo = None,
        animal: AnimalMetadata = None,
        image_path: str = None,
    ) -> EnrollmentResponse:
        """
        Execute the full enrollment pipeline.

        Args:
            image:       BGR numpy array, raw bytes, or None (use image_path).
            owner:       OwnerInfo dataclass (optional for offline).
            animal:      AnimalMetadata dataclass (optional for offline).
            image_path:  Path to image file (alternative to `image`).

        Returns:
            EnrollmentResponse with success/failure and details.
        """
        start = time.time()

        try:
            # ── Step 1: Validate input ────────────────────
            logger.info("Step 1/5: Validating input ...")
            if isinstance(image, np.ndarray):
                vr = self.validator.validate(image_bytes=None, image_path=None,
                                             owner=owner, animal=animal)
                # Override with frame-based quality check
                analysis = self.assistant.analyze(image)
                vr = ValidationResult(
                    is_valid=len(vr.errors) == 0 and analysis["approved"],
                    quality_score=analysis["score"],
                    errors=vr.errors,
                    warnings=vr.warnings,
                    face_box=analysis["box"],
                    suggestions=analysis["suggestions"],
                )
                frame = image
            elif image_path:
                vr = self.validator.validate(
                    image_path=image_path, owner=owner, animal=animal
                )
                frame = cv2.imread(image_path)
            elif isinstance(image, bytes):
                vr = self.validator.validate(
                    image_bytes=image, owner=owner, animal=animal
                )
                arr = np.frombuffer(image, dtype=np.uint8)
                frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            else:
                return EnrollmentResponse(
                    success=False,
                    message="No image provided (pass image, image_bytes, or image_path)",
                )

            if frame is None:
                return EnrollmentResponse(
                    success=False,
                    message=f"Cannot decode image. Errors: {vr.errors}",
                )

            if not vr.is_valid:
                return EnrollmentResponse(
                    success=False,
                    message=(
                        f"Validation failed (score={vr.quality_score}). "
                        f"Errors: {vr.errors}. Suggestions: {vr.suggestions}"
                    ),
                )

            # ── Step 2: Store images ──────────────────────
            logger.info("Step 2/5: Storing images ...")
            temp_id = f"pending_{int(time.time())}"
            image_keys = {}

            # Full image
            key = self.storage.upload_image(frame, temp_id, "original")
            image_keys["original"] = key

            # Face crop
            box = vr.face_box
            if box is not None:
                face_crop = self.assistant.crop_face(frame, box)
                if face_crop is not None:
                    key = self.storage.upload_image(face_crop, temp_id, "face")
                    image_keys["face"] = key

                muzzle_crop = self.assistant.extract_muzzle_region(frame, box)
                if muzzle_crop is not None:
                    key = self.storage.upload_image(muzzle_crop, temp_id, "muzzle")
                    image_keys["muzzle"] = key

            # ── Step 3: Generate embedding ────────────────
            logger.info("Step 3/5: Generating embedding ...")
            # Prefer muzzle crop, then face crop, then full frame
            embed_source = frame
            if box is not None:
                muzzle = self.assistant.extract_muzzle_region(frame, box)
                if muzzle is not None:
                    embed_source = muzzle
                else:
                    face = self.assistant.crop_face(frame, box)
                    if face is not None:
                        embed_source = face

            embedding = self.embedder.generate_embedding(embed_source)
            if embedding is None:
                return EnrollmentResponse(
                    success=False,
                    message="Embedding generation failed",
                )
            embedding = np.asarray(embedding, dtype=np.float32)

            # ── Step 4: Duplicate detection ───────────────
            logger.info("Step 4/5: Checking for duplicates ...")
            dup = self.detector.check_duplicate(embedding)
            dup_result = DuplicateCheckResult(
                is_duplicate=dup["is_duplicate"],
                matched_livestock_id=dup.get("match_id"),
                similarity_score=dup["similarity"],
                message=(
                    f"Matches {dup['match_id']} (sim={dup['similarity']:.4f})"
                    if dup["is_duplicate"]
                    else "No duplicate found"
                ),
            )

            if dup["is_duplicate"]:
                return EnrollmentResponse(
                    success=False,
                    livestock_id=None,
                    duplicate_check=dup_result,
                    message=(
                        f"Duplicate detected: matches {dup['match_id']} "
                        f"(similarity={dup['similarity']:.4f}, "
                        f"threshold={DUPLICATE_THRESHOLD})"
                    ),
                )

            # ── Step 5: Create Livestock ID ───────────────
            logger.info("Step 5/5: Generating Livestock ID ...")
            livestock_id = self.id_gen.generate()

            # Persist embedding under final ID
            self.detector.store_embedding(livestock_id, embedding)

            # Re-upload images under final ID
            if box is not None:
                face_crop = self.assistant.crop_face(frame, box)
                if face_crop is not None:
                    self.storage.upload_image(face_crop, livestock_id, "face")
                muzzle = self.assistant.extract_muzzle_region(frame, box)
                if muzzle is not None:
                    self.storage.upload_image(muzzle, livestock_id, "muzzle")
            self.storage.upload_image(frame, livestock_id, "original")

            elapsed = int((time.time() - start) * 1000)
            logger.info(f"Enrolled as {livestock_id} in {elapsed} ms")

            return EnrollmentResponse(
                success=True,
                livestock_id=livestock_id,
                s3_image_url=image_keys.get("original"),
                duplicate_check=dup_result,
                message=f"Enrolled successfully as {livestock_id}",
            )

        except Exception as e:
            logger.exception("Enrollment pipeline error")
            return EnrollmentResponse(
                success=False,
                message=f"Pipeline error: {e}",
            )

    # ─────────────────────────────────────────────────────
    # Individual step access (testing / granular use)
    # ─────────────────────────────────────────────────────

    def validate_only(self, image_path=None, image_bytes=None,
                      owner=None, animal=None) -> ValidationResult:
        return self.validator.validate(
            image_path=image_path, image_bytes=image_bytes,
            owner=owner, animal=animal,
        )

    def embed_only(self, image) -> Optional[np.ndarray]:
        emb = self.embedder.generate_embedding(image)
        return np.asarray(emb, dtype=np.float32) if emb is not None else None

    def check_duplicate_only(self, embedding: np.ndarray) -> Dict:
        return self.detector.check_duplicate(embedding)

    def generate_id(self) -> str:
        return self.id_gen.generate()
