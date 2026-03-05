import { useRef, useState, useCallback, useEffect } from 'react';
import { useAnimalDetection } from '../../hooks/useAnimalDetection';
import { useLanguage } from '../../context/LanguageContext';
import './CameraCapture.css';

// Model hosted on your CloudFront CDN (yolov8s — same COCO-80 output format)
const MODEL_URL = `${import.meta.env.VITE_CDN_URL || ''}/models/yolov8s.onnx`;

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [autoCapturing, setAutoCapturing] = useState(false);
  const { t } = useLanguage();

  const {
    isModelLoading,
    isModelReady,
    bestDetection,
    detections,
    muzzleQuality,
    startDetection,
    stopDetection,
  } = useAnimalDetection(MODEL_URL);

  // Good shot = cow detected with high confidence AND muzzle quality score ≥ 0.75
  const isGoodShot =
    bestDetection !== null &&
    bestDetection.confidence >= 0.65 &&
    muzzleQuality !== null &&
    muzzleQuality.score >= 0.75;

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsReady(true);
        setError(null);
      }
    } catch {
      setError(t.cameraPermissionError);
    }
  }, []);

  // Start/stop detection when video is ready
  useEffect(() => {
    if (isReady && isModelReady && videoRef.current) {
      startDetection(videoRef.current);
      return () => stopDetection();
    }
  }, [isReady, isModelReady, startDetection, stopDetection]);

  // Draw bounding boxes on overlay canvas
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlay || !video) return;
    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    for (const det of detections) {
      const color = det.isLivestock ? (isGoodShot ? '#22c55e' : '#facc15') : '#94a3b8';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(det.x, det.y, det.width, det.height);

      // Label background
      const label = `${det.label} ${Math.round(det.confidence * 100)}%`;
      ctx.font = 'bold 14px sans-serif';
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(det.x, det.y - 22, textW + 10, 22);
      ctx.fillStyle = '#000';
      ctx.fillText(label, det.x + 5, det.y - 5);

      // Draw muzzle region on the best livestock detection
      if (det.isLivestock) {
        const muzzleX = det.x + det.width * 0.25;
        const muzzleY = det.y + det.height * 0.60;
        const muzzleW = det.width * 0.50;
        const muzzleH = det.height * 0.40;
        ctx.strokeStyle = isGoodShot ? '#22c55e' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(muzzleX, muzzleY, muzzleW, muzzleH);
        ctx.setLineDash([]);
        // Muzzle label
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = isGoodShot ? '#22c55e' : 'rgba(255,255,255,0.9)';
        ctx.fillText('muzzle', muzzleX + 4, muzzleY - 4);
      }
    }
  }, [detections]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, startCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
        }
      },
      'image/jpeg',
      0.9
    );
  }, [onCapture]);

  // Auto-capture when good shot detected
  useEffect(() => {
    if (isGoodShot && !autoCapturing) {
      setAutoCapturing(true);
      // Small delay so user can see the green box before capture
      const timer = setTimeout(() => {
        capturePhoto();
        setAutoCapturing(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isGoodShot, autoCapturing, capturePhoto]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Status indicator text — uses muzzle quality feedback when available
  const getStatusText = () => {
    if (isModelLoading) return { text: t.loadingAiModel, cls: 'status-loading' };
    if (!isModelReady) return { text: t.aiModelUnavailable, cls: 'status-error' };
    if (!bestDetection) return { text: t.lookingForAnimal, cls: 'status-searching' };
    if (isGoodShot) return { text: t.perfectMuzzleShot, cls: 'status-good' };
    const feedbackText = muzzleQuality ? muzzleQuality.feedback : `🐄 ${bestDetection.label} (${Math.round(bestDetection.confidence * 100)}%)`;
    return { text: feedbackText, cls: 'status-detected' };
  };

  const status = getStatusText();

  return (
    <div className="camera-overlay">
      <div className="camera-container">
        <div className="camera-header">
          <h3>{t.captureAnimalPhoto}</h3>
          <button className="camera-close-btn" onClick={onClose} aria-label="Close camera">
            ✕
          </button>
        </div>

        {error ? (
          <div className="camera-error">
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => startCamera(facingMode)}>
              {t.retryCamera}
            </button>
          </div>
        ) : (
          <>
            <div className="camera-viewfinder">
              <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
              {/* Detection overlay canvas */}
              <canvas ref={overlayCanvasRef} className="camera-overlay-canvas" />
              {/* AI status badge */}
              <div className={`camera-ai-status ${status.cls}`}>{status.text}</div>
            </div>

            {/* Hidden canvases */}
            <canvas ref={canvasRef} className="camera-canvas" />

            <div className="camera-controls">
              <button
                className="btn btn-outline camera-flip-btn"
                onClick={toggleCamera}
                aria-label="Flip camera"
              >
                🔄 {t.flipCamera}
              </button>
              <button
                className="btn btn-secondary camera-capture-btn"
                onClick={capturePhoto}
                disabled={!isReady}
                aria-label="Capture photo"
              >
                📸 {t.captureBtn}
              </button>
            </div>
            <p className="camera-hint">
              {t.cameraAutoCapHint}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
