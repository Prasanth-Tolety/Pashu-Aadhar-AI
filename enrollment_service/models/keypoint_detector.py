"""
Muzzle Keypoint Detector  (ONNX — self-contained)
====================================================
Detects muzzle keypoints on a cattle face crop using an ONNX pose model.
Also provides frontal-pose symmetry check.
"""

import numpy as np
import cv2
import onnxruntime as ort

from enrollment_service.config import (
    ONNX_KEYPOINT_MODEL,
    KEYPOINT_CONF_THRESHOLD,
    MIN_VALID_KEYPOINTS,
)


class MuzzleKeypointDetector:
    """ONNX keypoint / pose model for cattle muzzle landmarks."""

    def __init__(self, model_path: str = None):
        self._model_path = model_path or ONNX_KEYPOINT_MODEL
        self._session = None

    # ------------------------------------------------------------------
    # Lazy load
    # ------------------------------------------------------------------
    def _load(self):
        if self._session is None:
            self._session = ort.InferenceSession(
                self._model_path, providers=["CPUExecutionProvider"]
            )
            inputs = self._session.get_inputs()
            self._input_name = inputs[0].name if inputs else None
            self._img_size = 256

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def detect(
        self, frame: np.ndarray, box: "list[int]"
    ) -> "list[np.ndarray] | None":
        """
        Detect muzzle keypoints within a cattle face bounding box.

        Args:
            frame: Full BGR image.
            box:   [x1, y1, x2, y2] face bounding box.

        Returns:
            List of keypoints as [x, y, confidence] arrays (in 256×256 crop
            coordinates), or None if too few valid keypoints.
        """
        self._load()

        x1, y1, x2, y2 = box
        face_crop = frame[y1:y2, x1:x2]

        if face_crop.size == 0:
            return None

        img = cv2.resize(face_crop, (self._img_size, self._img_size))
        img = img.astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))
        img = np.expand_dims(img, axis=0)

        if self._input_name:
            outputs = self._session.run(None, {self._input_name: img})[0]
        else:
            outputs = self._session.run(None, {})[0]

        keypoints = outputs.reshape(-1, 3)
        valid = [kp for kp in keypoints if kp[2] > KEYPOINT_CONF_THRESHOLD]

        if len(valid) < MIN_VALID_KEYPOINTS:
            return None

        return valid

    # ------------------------------------------------------------------
    # Pose checks
    # ------------------------------------------------------------------
    @staticmethod
    def check_frontal_pose(keypoints: "list[np.ndarray]") -> bool:
        """
        Check if keypoints are roughly symmetrical (frontal view).
        Returns True if the face is approximately frontal.
        """
        if keypoints is None or len(keypoints) < 3:
            return False

        xs = [kp[0] for kp in keypoints]
        center_x = np.mean(xs)

        left = sum(1 for x in xs if x < center_x)
        right = sum(1 for x in xs if x > center_x)

        return abs(left - right) <= 2

    def get_all_outputs(self, frame: np.ndarray, box: "list[int]") -> "list[np.ndarray]":
        """
        Return raw ONNX outputs (all output tensors). Useful for
        extracting intermediate features for embedding fallback.
        """
        self._load()

        x1, y1, x2, y2 = box
        face_crop = frame[y1:y2, x1:x2]

        if face_crop.size == 0:
            return []

        img = cv2.resize(face_crop, (self._img_size, self._img_size))
        img = img.astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))
        img = np.expand_dims(img, axis=0)

        if self._input_name:
            return self._session.run(None, {self._input_name: img})
        else:
            return self._session.run(None, {})
