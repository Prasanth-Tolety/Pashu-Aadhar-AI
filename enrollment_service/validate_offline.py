"""
Offline Validation Script
==========================
Exercises the enrollment_service offline modules against test_images/
and writes results to results/.

Tests:
    1. Face detection on every image
    2. Keypoint detection on every image (requires face box)
    3. Quality checks on every image
    4. Full CaptureAssistant pipeline
    5. InputValidator pipeline
    6. Embedding generation (local model)
    7. Duplicate detection (offline cache)
    8. Full enrollment pipeline (offline mode)

Usage:
    cd "C:\\AWS Hackathon"
    python -m enrollment_service.validate_offline
"""

import os
import sys
import json
import time
import logging
import traceback
from pathlib import Path

import cv2
import numpy as np

# ── Setup ────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
TEST_IMAGES_DIR = os.path.join(PROJECT_ROOT, "test_images")
RESULTS_DIR = os.path.join(PROJECT_ROOT, "results")
os.makedirs(RESULTS_DIR, exist_ok=True)


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def save_json(data, filename):
    path = os.path.join(RESULTS_DIR, filename)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, cls=NumpyEncoder)
    logger.info(f"  -> Saved {path}")


def save_image(img, filename):
    path = os.path.join(RESULTS_DIR, filename)
    cv2.imwrite(path, img)
    logger.info(f"  -> Saved {path}")


def get_test_images():
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
    imgs = []
    if not os.path.isdir(TEST_IMAGES_DIR):
        logger.warning(f"test_images/ not found at {TEST_IMAGES_DIR}")
        return imgs
    for f in sorted(os.listdir(TEST_IMAGES_DIR)):
        if Path(f).suffix.lower() in exts:
            imgs.append(os.path.join(TEST_IMAGES_DIR, f))
    return imgs


# ═════════════════════════════════════════════════════════
# Tests
# ═════════════════════════════════════════════════════════

def test_face_detector(images):
    """Test 1: Face detection on all images."""
    logger.info("=" * 60)
    logger.info("TEST 1: Face Detector")
    logger.info("=" * 60)
    from enrollment_service.models.face_detector import CattleFaceDetector

    det = CattleFaceDetector()
    results = {}
    for path in images:
        name = os.path.basename(path)
        frame = cv2.imread(path)
        if frame is None:
            results[name] = {"error": "cannot read"}
            continue

        # detect() returns list [x1,y1,x2,y2] or None
        box = det.detect(frame)
        # detect_all() returns list of {"box": ..., "score": ...}
        all_dets = det.detect_all(frame)
        best_score = all_dets[0]["score"] if all_dets else 0.0

        results[name] = {
            "detected": box is not None,
            "confidence": float(best_score),
            "box": box,
            "num_detections": len(all_dets),
        }

        if box is not None:
            x1, y1, x2, y2 = box
            annotated = frame.copy()
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(annotated, f"{best_score:.2f}", (x1, y1 - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            save_image(annotated, f"face_{name}")

        logger.info(
            f"  {name}: detected={box is not None}, conf={best_score:.3f}"
        )

    save_json(results, "test1_face_detection.json")
    detected = sum(1 for v in results.values() if v.get("detected"))
    logger.info(f"  Face detected: {detected}/{len(images)}")
    return results


def test_keypoint_detector(images):
    """Test 2: Keypoint detection (requires face box first)."""
    logger.info("=" * 60)
    logger.info("TEST 2: Keypoint Detector")
    logger.info("=" * 60)
    from enrollment_service.models.face_detector import CattleFaceDetector
    from enrollment_service.models.keypoint_detector import MuzzleKeypointDetector

    face_det = CattleFaceDetector()
    kp_det = MuzzleKeypointDetector()
    results = {}

    for path in images:
        name = os.path.basename(path)
        frame = cv2.imread(path)
        if frame is None:
            results[name] = {"error": "cannot read"}
            continue

        box = face_det.detect(frame)
        if box is None:
            results[name] = {"keypoints_found": False, "reason": "no face detected"}
            logger.info(f"  {name}: no face -> skip keypoints")
            continue

        # detect() needs frame + box
        kpts = kp_det.detect(frame, box)
        is_frontal = (
            MuzzleKeypointDetector.check_frontal_pose(kpts)
            if kpts is not None
            else False
        )

        results[name] = {
            "keypoints_found": kpts is not None,
            "is_frontal": is_frontal,
            "n_keypoints": len(kpts) if kpts is not None else 0,
        }

        if kpts is not None:
            annotated = frame.copy()
            x1, y1, x2, y2 = box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
            for kp in kpts:
                x, y = int(kp[0]), int(kp[1])
                cv2.circle(annotated, (x1 + x, y1 + y), 4, (0, 0, 255), -1)
            save_image(annotated, f"kpts_{name}")

        logger.info(
            f"  {name}: kpts={kpts is not None}, frontal={is_frontal}"
        )

    save_json(results, "test2_keypoints.json")
    return results


def test_quality_checks(images):
    """Test 3: Quality checks on all images."""
    logger.info("=" * 60)
    logger.info("TEST 3: Quality Checks")
    logger.info("=" * 60)
    from enrollment_service.models.face_detector import CattleFaceDetector
    from enrollment_service.offline.quality_checks import run_all_checks

    face_det = CattleFaceDetector()
    results = {}

    for path in images:
        name = os.path.basename(path)
        frame = cv2.imread(path)
        if frame is None:
            results[name] = {"error": "cannot read"}
            continue

        box = face_det.detect(frame)
        qc = run_all_checks(frame, box)

        results[name] = {
            "score": qc["score"],
            "approved": qc["approved"],
            "suggestions": qc["suggestions"],
            "face_detected": box is not None,
        }
        logger.info(
            f"  {name}: score={qc['score']}, approved={qc['approved']}"
        )

    save_json(results, "test3_quality_checks.json")
    return results


def test_capture_assistant(images):
    """Test 4: Full CaptureAssistant pipeline."""
    logger.info("=" * 60)
    logger.info("TEST 4: Capture Assistant")
    logger.info("=" * 60)
    from enrollment_service.offline.capture_assistant import CaptureAssistant

    ca = CaptureAssistant()
    results = {}

    for path in images:
        name = os.path.basename(path)
        frame = cv2.imread(path)
        if frame is None:
            results[name] = {"error": "cannot read"}
            continue

        analysis = ca.analyze(frame)
        box = analysis["box"]

        results[name] = {
            "approved": analysis["approved"],
            "score": analysis["score"],
            "suggestions": analysis["suggestions"],
            "face_detected": box is not None,
        }

        # crop_face and extract_muzzle_region need the box from analyze
        if box is not None:
            face_crop = ca.crop_face(frame, box)
            if face_crop is not None:
                save_image(face_crop, f"crop_face_{name}")
            muzzle = ca.extract_muzzle_region(frame, box)
            if muzzle is not None:
                save_image(muzzle, f"crop_muzzle_{name}")

        logger.info(
            f"  {name}: approved={analysis['approved']}, "
            f"score={analysis['score']}"
        )

    save_json(results, "test4_capture_assistant.json")
    return results


def test_input_validator(images):
    """Test 5: InputValidator pipeline."""
    logger.info("=" * 60)
    logger.info("TEST 5: Input Validator")
    logger.info("=" * 60)
    from enrollment_service.offline.input_validator import InputValidator

    validator = InputValidator()
    results = {}

    for path in images:
        name = os.path.basename(path)
        # validate() accepts image_path kwarg
        vr = validator.validate(image_path=path)

        results[name] = {
            "is_valid": vr.is_valid,
            "quality_score": vr.quality_score,
            "errors": vr.errors,
            "warnings": vr.warnings,
            "suggestions": vr.suggestions,
            "face_detected": vr.face_box is not None,
        }
        logger.info(
            f"  {name}: is_valid={vr.is_valid}, score={vr.quality_score}"
        )

    save_json(results, "test5_input_validator.json")
    return results


def test_embedding(images):
    """Test 6: Local embedding generation."""
    logger.info("=" * 60)
    logger.info("TEST 6: Embedding Generation (Local)")
    logger.info("=" * 60)
    from enrollment_service.backend.embedding_service import EmbeddingService

    svc = EmbeddingService(use_local=True)
    results = {}
    embeddings = {}

    for path in images:
        name = os.path.basename(path)
        frame = cv2.imread(path)
        if frame is None:
            results[name] = {"error": "cannot read"}
            continue

        emb = svc.generate_embedding(frame)
        if emb is not None:
            emb = np.asarray(emb, dtype=np.float32)
            results[name] = {
                "dim": int(emb.shape[0]),
                "norm": float(np.linalg.norm(emb)),
                "sample": emb[:5].tolist(),
            }
            embeddings[name] = emb
        else:
            results[name] = {"error": "embedding failed"}

        logger.info(
            f"  {name}: dim={emb.shape[0] if emb is not None else 'N/A'}"
        )

    # Cross-similarity matrix
    names = list(embeddings.keys())
    if len(names) > 1:
        sim_matrix = {}
        for i, n1 in enumerate(names):
            for j, n2 in enumerate(names):
                if j > i:
                    sim = float(np.dot(embeddings[n1], embeddings[n2]))
                    sim_matrix[f"{n1} <-> {n2}"] = round(sim, 4)
        results["cross_similarity"] = sim_matrix
        logger.info("  Cross-similarity matrix computed")

    save_json(results, "test6_embeddings.json")
    return results


def test_duplicate_detection(images):
    """Test 7: Duplicate detection with offline cache."""
    logger.info("=" * 60)
    logger.info("TEST 7: Duplicate Detection (Offline)")
    logger.info("=" * 60)
    from enrollment_service.backend.embedding_service import EmbeddingService
    from enrollment_service.backend.duplicate_detector import DuplicateDetector

    svc = EmbeddingService(use_local=True)
    det = DuplicateDetector(offline=True)

    results = {}
    for idx, path in enumerate(images):
        name = os.path.basename(path)
        frame = cv2.imread(path)
        if frame is None:
            results[name] = {"error": "cannot read"}
            continue

        emb = svc.generate_embedding(frame)
        if emb is None:
            results[name] = {"error": "embedding failed"}
            continue

        emb = np.asarray(emb, dtype=np.float32)
        dup = det.check_duplicate(emb)
        results[name] = {
            "is_duplicate": dup["is_duplicate"],
            "match_id": dup.get("match_id"),
            "similarity": dup["similarity"],
        }
        # Store for subsequent checks
        det.store_embedding(f"TEST-{idx:04d}", emb)
        logger.info(
            f"  {name}: dup={dup['is_duplicate']}, sim={dup['similarity']:.4f}"
        )

    save_json(results, "test7_duplicate_detection.json")
    return results


def test_full_enrollment(images):
    """Test 8: Full offline enrollment pipeline."""
    logger.info("=" * 60)
    logger.info("TEST 8: Full Enrollment Pipeline (Offline)")
    logger.info("=" * 60)
    from enrollment_service.orchestrator import EnrollmentOrchestrator
    from enrollment_service.models.schemas import OwnerInfo, AnimalMetadata

    orch = EnrollmentOrchestrator(offline=True)
    results = {}

    owner = OwnerInfo(
        name="Test Owner",
        phone="9876543210",
        village="TestVillage",
        state="MH",
    )
    animal = AnimalMetadata(
        species="cattle",
        breed="Holstein",
        age_months=24,
        sex="female",
    )

    for path in images[:3]:  # Limit to first 3 for speed
        name = os.path.basename(path)
        frame = cv2.imread(path)
        if frame is None:
            results[name] = {"error": "cannot read"}
            continue

        resp = orch.enroll(image=frame, owner=owner, animal=animal)
        results[name] = {
            "success": resp.success,
            "message": resp.message,
            "livestock_id": resp.livestock_id,
        }
        logger.info(
            f"  {name}: success={resp.success}, id={resp.livestock_id}"
        )

    save_json(results, "test8_full_enrollment.json")
    return results


# ═════════════════════════════════════════════════════════
# Runner
# ═════════════════════════════════════════════════════════

def main():
    logger.info("=" * 60)
    logger.info("  Enrollment Service v2 -- Offline Validation Suite")
    logger.info("=" * 60)

    images = get_test_images()
    logger.info(f"Found {len(images)} test images in {TEST_IMAGES_DIR}")
    if not images:
        logger.error("No test images found. Exiting.")
        sys.exit(1)

    summary = {}
    tests = [
        ("face_detector", test_face_detector),
        ("keypoint_detector", test_keypoint_detector),
        ("quality_checks", test_quality_checks),
        ("capture_assistant", test_capture_assistant),
        ("input_validator", test_input_validator),
        ("embedding", test_embedding),
        ("duplicate_detection", test_duplicate_detection),
        ("full_enrollment", test_full_enrollment),
    ]

    passed = 0
    failed = 0
    for name, fn in tests:
        t0 = time.time()
        try:
            fn(images)
            elapsed = int((time.time() - t0) * 1000)
            summary[name] = {"status": "PASS", "elapsed_ms": elapsed}
            passed += 1
            logger.info(f"  >> {name} PASSED ({elapsed} ms)\n")
        except Exception as e:
            elapsed = int((time.time() - t0) * 1000)
            summary[name] = {
                "status": "FAIL",
                "error": str(e),
                "elapsed_ms": elapsed,
            }
            failed += 1
            logger.error(f"  >> {name} FAILED: {e}\n")
            traceback.print_exc()

    save_json(summary, "validation_summary.json")

    logger.info("=" * 60)
    logger.info(f"SUMMARY: {passed} passed, {failed} failed out of {len(tests)}")
    logger.info("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
