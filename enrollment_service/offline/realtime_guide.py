"""
Realtime Capture Guide  (self-contained)
==========================================
Camera loop with visual guidance overlay. 100% offline.
"""

import os
import time
import cv2

from enrollment_service.offline.capture_assistant import CaptureAssistant


class RealtimeGuide:
    """Open device camera and guide the farmer to capture a quality image."""

    def __init__(self, save_dir: str = "captured_images"):
        self.assistant = CaptureAssistant()
        self.save_dir = save_dir
        os.makedirs(save_dir, exist_ok=True)

    def run(self, camera_index: int = 0) -> "str | None":
        """
        Launch live camera guide.
        Returns path to auto-captured image, or None if user quit.
        """
        cap = cv2.VideoCapture(camera_index)
        if not cap.isOpened():
            print("[RealtimeGuide] Cannot open camera.")
            return None

        previous_frame = None
        capture_count = 0
        captured_path = None

        print("=== PashuAadhar AI — Realtime Capture Guide ===")
        print("Point the camera at the cattle's face/muzzle.")
        print("Press 'c' to force capture, 'q' to quit.\n")

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            result = self.assistant.analyze(frame, previous_frame)
            box = result["box"]
            approved = result["approved"]
            suggestions = result["suggestions"]
            auto_capture = result["auto_capture"]
            score = result["score"]

            display = frame.copy()
            color = (0, 255, 0) if approved else (0, 0, 255)

            # Bounding box
            if box is not None:
                x1, y1, x2, y2 = box
                cv2.rectangle(display, (x1, y1), (x2, y2), color, 2)

            # Score bar
            bar_w = int(score / 150 * 300)
            cv2.rectangle(display, (20, 10), (20 + bar_w, 30), color, -1)
            cv2.rectangle(display, (20, 10), (320, 30), (200, 200, 200), 1)
            cv2.putText(display, f"Score: {score}",
                        (330, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

            # Suggestions
            y_off = 55
            for s in suggestions[:3]:
                cv2.putText(display, s,
                            (20, y_off), cv2.FONT_HERSHEY_SIMPLEX, 0.6,
                            (0, 255, 255), 2)
                y_off += 28

            # Status
            status = "APPROVED" if approved else "ADJUSTING..."
            cv2.putText(display, status,
                        (20, frame.shape[0] - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                        color, 2)

            cv2.imshow("PashuAadhar AI — Capture Guide", display)
            previous_frame = frame.copy()

            if auto_capture:
                captured_path = self._save(frame, capture_count)
                print(f"[AUTO-CAPTURE] {captured_path}  (score={score})")
                capture_count += 1

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            elif key == ord("c") and box is not None:
                captured_path = self._save(frame, capture_count)
                print(f"[MANUAL-CAPTURE] {captured_path}  (score={score})")
                capture_count += 1

        cap.release()
        cv2.destroyAllWindows()
        return captured_path

    def _save(self, frame, idx: int) -> str:
        ts = time.strftime("%Y%m%d_%H%M%S")
        path = os.path.join(self.save_dir, f"capture_{ts}_{idx}.jpg")
        cv2.imwrite(path, frame)
        return path


if __name__ == "__main__":
    guide = RealtimeGuide()
    result = guide.run()
    if result:
        print(f"\nFinal captured image: {result}")
    else:
        print("\nNo image captured.")
