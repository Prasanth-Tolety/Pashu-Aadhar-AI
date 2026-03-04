"""
Cattle Face Detector  (ONNX — self-contained)
================================================
Detects cattle face bounding boxes using a YOLO-format ONNX model.
Runs on CPU via onnxruntime. No external project imports.
"""

import numpy as np
import cv2
import onnxruntime as ort

from enrollment_service.config import ONNX_FACE_MODEL, FACE_CONF_THRESHOLD


class CattleFaceDetector:
    """YOLO-based cattle face detector using ONNX runtime."""

    def __init__(self, model_path: str = None, conf_threshold: float = None):
        self._model_path = model_path or ONNX_FACE_MODEL
        self._conf = conf_threshold or FACE_CONF_THRESHOLD
        self._session = None

    # ------------------------------------------------------------------
    # Lazy load
    # ------------------------------------------------------------------
    def _load(self):
        if self._session is None:
            self._session = ort.InferenceSession(
                self._model_path, providers=["CPUExecutionProvider"]
            )
            self._input_name = self._session.get_inputs()[0].name

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def detect(self, frame: np.ndarray) -> "list[int] | None":
        """
        Detect the most confident cattle face in the frame.

        Args:
            frame: BGR image (np.ndarray, HxWx3).

        Returns:
            [x1, y1, x2, y2] in original frame coords, or None.
        """
        self._load()

        h_frame, w_frame = frame.shape[:2]

        # Pre-process: resize 640×640, normalise, CHW, batch
        img = cv2.resize(frame, (640, 640))
        img = img.astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))
        img = np.expand_dims(img, axis=0)

        # Inference
        outputs = self._session.run(None, {self._input_name: img})[0]
        outputs = np.array(outputs)

        # Handle YOLO output shapes: (1, N, 5+C) or (N, 5+C)
        if outputs.ndim == 3:
            outputs = np.squeeze(outputs).T
        elif outputs.ndim == 2:
            pass
        else:
            return None

        # Confidence scores (columns 4+ are class scores)
        scores = np.max(outputs[:, 4:], axis=1)
        best_idx = np.argmax(scores)

        if scores[best_idx] < self._conf:
            return None

        # Box is center-x, center-y, w, h
        cx, cy, bw, bh = outputs[best_idx, :4]
        x1 = int(cx - bw / 2)
        y1 = int(cy - bh / 2)
        x2 = int(cx + bw / 2)
        y2 = int(cy + bh / 2)

        # Scale back to original frame
        sx = w_frame / 640
        sy = h_frame / 640

        return [
            max(0, int(x1 * sx)),
            max(0, int(y1 * sy)),
            min(w_frame, int(x2 * sx)),
            min(h_frame, int(y2 * sy)),
        ]

    def detect_all(
        self, frame: np.ndarray, max_det: int = 10
    ) -> "list[dict]":
        """
        Return all detections above confidence threshold.

        Returns:
            List of {"box": [x1,y1,x2,y2], "score": float}
        """
        self._load()

        h_frame, w_frame = frame.shape[:2]

        img = cv2.resize(frame, (640, 640))
        img = img.astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))
        img = np.expand_dims(img, axis=0)

        outputs = self._session.run(None, {self._input_name: img})[0]
        outputs = np.array(outputs)

        if outputs.ndim == 3:
            outputs = np.squeeze(outputs).T
        elif outputs.ndim != 2:
            return []

        scores = np.max(outputs[:, 4:], axis=1)
        mask = scores >= self._conf
        filtered = outputs[mask]
        filtered_scores = scores[mask]

        # Sort by score descending
        order = np.argsort(-filtered_scores)[:max_det]

        sx = w_frame / 640
        sy = h_frame / 640

        results = []
        for i in order:
            cx, cy, bw, bh = filtered[i, :4]
            results.append({
                "box": [
                    max(0, int((cx - bw / 2) * sx)),
                    max(0, int((cy - bh / 2) * sy)),
                    min(w_frame, int((cx + bw / 2) * sx)),
                    min(h_frame, int((cy + bh / 2) * sy)),
                ],
                "score": float(filtered_scores[i]),
            })

        return results
