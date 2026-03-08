import { useRef, useState, useCallback, useEffect } from 'react';
import './CameraCapture/CameraCapture.css';

interface AgentStepCaptureProps {
  mode: 'texture' | 'selfie';
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * Simple camera capture without AI detection.
 * Used for body texture (rear camera) and agent selfie (front camera).
 */
export default function AgentStepCapture({ mode, onCapture, onClose }: AgentStepCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  const facingMode = mode === 'selfie' ? 'user' : 'environment';
  const title = mode === 'selfie' ? '🤳 Agent Selfie' : '📸 Body Texture (Side View)';
  const hint = mode === 'selfie'
    ? 'Take a clear selfie for verification. Ensure your face is visible.'
    : 'Capture the full side view of the cow. Ensure the body pattern is clearly visible.';

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsReady(true);
        setCameraError(null);
      }
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions.');
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((tr) => tr.stop());
    };
  }, [startCamera]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = mode === 'selfie'
        ? `agent-selfie-${Date.now()}.jpg`
        : `body-texture-${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      setCapturedFile(file);
      setPreview(canvas.toDataURL('image/jpeg', 0.85));
    }, 'image/jpeg', 0.85);
  }, [mode]);

  const handleAccept = useCallback(() => {
    if (capturedFile) {
      onCapture(capturedFile);
    }
  }, [capturedFile, onCapture]);

  const handleRetake = useCallback(() => {
    setPreview(null);
    setCapturedFile(null);
  }, []);

  return (
    <div className="camera-overlay">
      <div className="camera-container">
        <div className="camera-header">
          <h3>{title}</h3>
          <button className="camera-close-btn" onClick={onClose} aria-label="Close camera">✕</button>
        </div>

        {cameraError ? (
          <div className="camera-error">
            <p>{cameraError}</p>
            <button className="btn btn-primary" onClick={startCamera}>Retry</button>
          </div>
        ) : preview ? (
          <div className="muzzle-preview-container">
            <div className="muzzle-preview-image-wrap">
              <img src={preview} alt={mode === 'selfie' ? 'Agent selfie' : 'Body texture'} className="muzzle-preview-image" />
              <div className="muzzle-preview-badge">{mode === 'selfie' ? '🤳 Selfie' : '📸 Side View'}</div>
            </div>
            <p className="muzzle-preview-info">{hint}</p>
            <div className="muzzle-preview-actions">
              <button className="btn btn-primary muzzle-accept-btn" onClick={handleAccept}>
                ✅ Use This Photo
              </button>
              <button className="btn btn-outline muzzle-retake-btn" onClick={handleRetake}>
                🔄 Retake
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="camera-viewfinder">
              <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Guide overlay */}
              {mode === 'selfie' && (
                <div className="selfie-guide-overlay">
                  <div className="selfie-oval" />
                  <p className="selfie-hint">Position your face in the oval</p>
                </div>
              )}

              {mode === 'texture' && (
                <div className="texture-guide-overlay">
                  <div className="texture-rect" />
                  <p className="texture-hint">Capture full side view of the animal</p>
                </div>
              )}
            </div>

            <div className="camera-controls">
              <button
                className="btn btn-secondary camera-capture-btn"
                onClick={handleCapture}
                disabled={!isReady}
              >
                📸 Capture
              </button>
            </div>
            <p className="camera-hint">{hint}</p>
          </>
        )}
      </div>
    </div>
  );
}
