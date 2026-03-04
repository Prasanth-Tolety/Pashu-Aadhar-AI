"""
Capture Assistant  (self-contained)
=====================================
Combines FaceDetector + KeypointDetector + QualityChecks into a single
analyze() call. Also provides face cropping.

No imports from outside enrollment_service.
"""

import time
import cv2
import numpy as np

from enrollment_service.models.face_detector import CattleFaceDetector
from enrollment_service.models.keypoint_detector import MuzzleKeypointDetector
from enrollment_service.offline.quality_checks import run_all_checks, check_anti_spoof
from enrollment_service.config import STABILITY_HOLD_SECONDS


class CaptureAssistant:
    """
    Full offline capture assistant.
    Uses the ONNX cattle face model + keypoint model + quality checks.
    """

    def __init__(self):
        self.face_detector = CattleFaceDetector()
        self.keypoint_detector = MuzzleKeypointDetector()
        self._approval_start: float | None = None

    # ------------------------------------------------------------------
    # Main analysis
    # ------------------------------------------------------------------
    def analyze(
        self, frame: np.ndarray, previous_frame: np.ndarray = None
    ) -> dict:
        """
        Analyze a single frame for enrollment quality.

        Returns dict:
            approved      bool
            score         int
            suggestions   list[str]
            box           list[int] | None
            auto_capture  bool
            keypoints     list | None
            checks        dict[str, bool]
        """
        # 1. Face detection
        box = self.face_detector.detect(frame)

        # 2. Quality checks (all at once)
        qc = run_all_checks(frame, box, previous_frame)
        score = qc["score"]
        approved = qc["approved"]
        suggestions = qc["suggestions"]
        checks = qc["checks"]

        # 3. Keypoints (if face found)
        keypoints = None
        if box is not None:
            keypoints = self.keypoint_detector.detect(frame, box)
            checks["Keypoints Detected"] = keypoints is not None
            if keypoints is not None:
                frontal = self.keypoint_detector.check_frontal_pose(keypoints)
                checks["Frontal Pose (symmetry)"] = frontal

        # 4. Anti-spoof
        spoof_ok = check_anti_spoof(frame, previous_frame)
        checks["Anti-Spoof"] = spoof_ok

        # 5. Auto-capture stability
        auto_capture = self._check_stability(approved)

        return {
            "approved": approved,
            "score": score,
            "suggestions": suggestions,
            "box": box,
            "auto_capture": auto_capture,
            "keypoints": keypoints,
            "checks": checks,
        }

    # ------------------------------------------------------------------
    # Face cropping
    # ------------------------------------------------------------------
    def crop_face(
        self, frame: np.ndarray, box: "list[int]", padding: float = 0.15
    ) -> np.ndarray | None:
        """Crop the cattle face with padding. Returns BGR image or None."""
        if box is None:
            return None

        h, w = frame.shape[:2]
        x1, y1, x2, y2 = box
        bw, bh = x2 - x1, y2 - y1

        x1 = max(0, int(x1 - bw * padding))
        y1 = max(0, int(y1 - bh * padding))
        x2 = min(w, int(x2 + bw * padding))
        y2 = min(h, int(y2 + bh * padding))

        crop = frame[y1:y2, x1:x2]
        return crop if crop.size > 0 else None

    # ------------------------------------------------------------------
    # Muzzle region extraction
    # ------------------------------------------------------------------
    @staticmethod
    def extract_muzzle_region(
        frame: np.ndarray, box: "list[int]"
    ) -> np.ndarray | None:
        """Extract the lower-centre muzzle region from a face box."""
        if box is None:
            return None
        x1, y1, x2, y2 = box
        face = frame[y1:y2, x1:x2]
        if face.size == 0:
            return None
        fh, fw = face.shape[:2]
        muzzle = face[int(fh * 0.55) : fh, int(fw * 0.25) : int(fw * 0.75)]
        return muzzle if muzzle.size > 0 else None

    # ------------------------------------------------------------------
    # Stability timer
    # ------------------------------------------------------------------
    def _check_stability(self, approved: bool) -> bool:
        if approved:
            if self._approval_start is None:
                self._approval_start = time.time()
            elif time.time() - self._approval_start >= STABILITY_HOLD_SECONDS:
                return True
        else:
            self._approval_start = None
        return False
