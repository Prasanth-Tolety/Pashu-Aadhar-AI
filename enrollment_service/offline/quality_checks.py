"""
Image Quality Checks  (pure OpenCV — self-contained)
======================================================
Every check from the original AdvancedRealtimeCaptureAssistant plus
anti-spoof texture analysis, all in one module. No external imports.

Each function takes a frame (and optionally a bounding box or previous
frame) and returns either:
    - None     if the check PASSES
    - str      a human-readable suggestion if it FAILS
or
    - bool     for simple pass/fail checks
"""

import cv2
import numpy as np

from enrollment_service.config import (
    BLUR_LAPLACIAN_THRESHOLD,
    EXPOSURE_DARK_LIMIT,
    EXPOSURE_BRIGHT_LIMIT,
    SHADOW_DARK_RATIO,
    MOTION_THRESHOLD,
    DISTANCE_MIN_RATIO,
    DISTANCE_MAX_RATIO,
    CENTER_OFFSET_RATIO,
    ORIENTATION_ASPECT_LIMIT,
    MUZZLE_TEXTURE_THRESHOLD,
    FACE_CROP_MIN_RATIO,
    ANTI_SPOOF_MOTION_MIN,
)


# ─────────────────────────────────────────────────────────
# Blur
# ─────────────────────────────────────────────────────────
def check_blur(frame: np.ndarray) -> bool:
    """True if image is sharp enough."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var()) > BLUR_LAPLACIAN_THRESHOLD


def check_blur_tip(frame: np.ndarray) -> "str | None":
    return None if check_blur(frame) else "Hold phone steady to reduce blur"


# ─────────────────────────────────────────────────────────
# Exposure / brightness histogram
# ─────────────────────────────────────────────────────────
def check_exposure(frame: np.ndarray) -> bool:
    """True if exposure is balanced (not too dark / bright)."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
    total = frame.shape[0] * frame.shape[1]

    dark = float(np.sum(hist[:30]))
    bright = float(np.sum(hist[225:]))

    if dark / total > EXPOSURE_DARK_LIMIT:
        return False
    if bright / total > EXPOSURE_BRIGHT_LIMIT:
        return False
    return True


def check_exposure_tip(frame: np.ndarray) -> "str | None":
    return None if check_exposure(frame) else "Improve lighting on cattle face"


# ─────────────────────────────────────────────────────────
# Shadow
# ─────────────────────────────────────────────────────────
def check_shadow(frame: np.ndarray) -> "str | None":
    """Returns suggestion if too much shadow, else None."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    dark_ratio = float(np.sum(gray < 40)) / gray.size
    if dark_ratio > SHADOW_DARK_RATIO:
        return "Avoid shadow on cattle face"
    return None


# ─────────────────────────────────────────────────────────
# Motion (frame diff)
# ─────────────────────────────────────────────────────────
def check_motion(
    frame: np.ndarray, previous_frame: "np.ndarray | None"
) -> "str | None":
    """Returns suggestion if too much motion, else None."""
    if previous_frame is None:
        return None
    diff = cv2.absdiff(frame, previous_frame)
    motion = float(np.mean(diff))
    if motion > MOTION_THRESHOLD:
        return "Hold phone steady"
    return None


# ─────────────────────────────────────────────────────────
# Distance (face area ratio)
# ─────────────────────────────────────────────────────────
def check_distance(
    box: "list[int]", frame: np.ndarray
) -> "str | None":
    """Returns suggestion if face too far / too close, else None."""
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = box
    face_area = (x2 - x1) * (y2 - y1)
    frame_area = w * h
    ratio = face_area / frame_area

    if ratio < DISTANCE_MIN_RATIO:
        return "Move closer to cattle"
    elif ratio > DISTANCE_MAX_RATIO:
        return "Move slightly away from cattle"
    return None


# ─────────────────────────────────────────────────────────
# Centering
# ─────────────────────────────────────────────────────────
def check_centering(
    box: "list[int]", frame: np.ndarray
) -> "str | None":
    """Returns suggestion if face not centred, else None."""
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = box
    cx = (x1 + x2) / 2
    cy = (y1 + y2) / 2

    if abs(cx - w / 2) > w * CENTER_OFFSET_RATIO:
        return "Center the cattle face in frame"
    if abs(cy - h / 2) > h * CENTER_OFFSET_RATIO:
        return "Adjust camera height to center muzzle"
    return None


# ─────────────────────────────────────────────────────────
# Frontal orientation (aspect ratio heuristic)
# ─────────────────────────────────────────────────────────
def check_frontal_orientation(
    box: "list[int]", frame: np.ndarray
) -> "str | None":
    """Returns suggestion if side-profile, else None."""
    x1, y1, x2, y2 = box
    face = frame[y1:y2, x1:x2]
    if face.size == 0:
        return "Turn cattle face towards camera"
    fh, fw = face.shape[:2]
    if fh == 0:
        return "Turn cattle face towards camera"
    ratio = fw / fh
    if ratio > ORIENTATION_ASPECT_LIMIT:
        return "Turn cattle face towards camera"
    return None


# ─────────────────────────────────────────────────────────
# Muzzle visibility (texture in nose region)
# ─────────────────────────────────────────────────────────
def check_muzzle_visibility(
    box: "list[int]", frame: np.ndarray
) -> "str | None":
    """Returns suggestion if muzzle texture is too low, else None."""
    x1, y1, x2, y2 = box
    face = frame[y1:y2, x1:x2]
    if face.size == 0:
        return "Ensure cattle nose (muzzle) is clearly visible"

    fh, fw = face.shape[:2]
    muzzle = face[int(fh * 0.55) : fh, int(fw * 0.25) : int(fw * 0.75)]

    if muzzle.size == 0:
        return "Ensure cattle nose (muzzle) is clearly visible"

    gray = cv2.cvtColor(muzzle, cv2.COLOR_BGR2GRAY)
    texture = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    if texture < MUZZLE_TEXTURE_THRESHOLD:
        return "Ensure cattle nose (muzzle) is clearly visible"
    return None


# ─────────────────────────────────────────────────────────
# Face crop size
# ─────────────────────────────────────────────────────────
def check_face_crop(
    box: "list[int]", frame: np.ndarray
) -> "str | None":
    """Returns suggestion if face too small in frame, else None."""
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = box
    face_area = (x2 - x1) * (y2 - y1)
    ratio = face_area / (h * w)
    if ratio < FACE_CROP_MIN_RATIO:
        return "Move closer to cattle face"
    return None


# ─────────────────────────────────────────────────────────
# Anti-spoof (micro-motion between frames)
# ─────────────────────────────────────────────────────────
def check_anti_spoof(
    frame: np.ndarray, previous_frame: "np.ndarray | None"
) -> bool:
    """True if the scene shows micro-motion (likely live animal)."""
    if previous_frame is None:
        return True
    diff = cv2.absdiff(frame, previous_frame)
    return float(np.mean(diff)) > ANTI_SPOOF_MOTION_MIN


# ─────────────────────────────────────────────────────────
# CLAHE contrast enhancement (optional preprocessing)
# ─────────────────────────────────────────────────────────
def enhance_contrast(frame: np.ndarray) -> np.ndarray:
    """Apply CLAHE to improve local contrast (useful for muzzle texture)."""
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


# ─────────────────────────────────────────────────────────
# Aggregate scorer
# ─────────────────────────────────────────────────────────
def run_all_checks(
    frame: np.ndarray,
    box: "list[int] | None",
    previous_frame: "np.ndarray | None" = None,
) -> dict:
    """
    Run every quality check and return a single dict:

        score        int   — cumulative quality score (0–150)
        approved     bool  — score >= 120
        suggestions  list  — human-readable tips
        checks       dict  — {check_name: passed_bool}
    """
    suggestions = []
    score = 0
    checks = {}

    # Face detection is a prerequisite
    checks["Face Detected"] = box is not None
    if box is None:
        return {
            "score": 0,
            "approved": False,
            "suggestions": ["Point camera towards cattle face"],
            "checks": checks,
        }

    score += 20  # face found

    # Distance
    tip = check_distance(box, frame)
    checks["Distance OK"] = tip is None
    if tip:
        suggestions.append(tip)
    else:
        score += 15

    # Centering
    tip = check_centering(box, frame)
    checks["Centering OK"] = tip is None
    if tip:
        suggestions.append(tip)
    else:
        score += 15

    # Blur
    ok = check_blur(frame)
    checks["Sharp (no blur)"] = ok
    if not ok:
        suggestions.append("Hold phone steady to reduce blur")
    else:
        score += 15

    # Exposure
    ok = check_exposure(frame)
    checks["Exposure OK"] = ok
    if not ok:
        suggestions.append("Improve lighting on cattle face")
    else:
        score += 15

    # Shadow
    tip = check_shadow(frame)
    checks["No Heavy Shadow"] = tip is None
    if tip:
        suggestions.append(tip)
    else:
        score += 10

    # Motion
    tip = check_motion(frame, previous_frame)
    checks["No Excessive Motion"] = tip is None
    if tip:
        suggestions.append(tip)
    else:
        score += 10

    # Frontal orientation
    tip = check_frontal_orientation(box, frame)
    checks["Frontal Orientation"] = tip is None
    if tip:
        suggestions.append(tip)
    else:
        score += 15

    # Muzzle visibility
    tip = check_muzzle_visibility(box, frame)
    checks["Muzzle Visible"] = tip is None
    if tip:
        suggestions.append(tip)
    else:
        score += 20

    # Face crop size
    tip = check_face_crop(box, frame)
    checks["Face Size Ratio"] = tip is None
    if tip:
        suggestions.append(tip)
    else:
        score += 15

    approved = score >= 120

    return {
        "score": score,
        "approved": approved,
        "suggestions": suggestions if suggestions else ["Perfect capture"],
        "checks": checks,
    }
