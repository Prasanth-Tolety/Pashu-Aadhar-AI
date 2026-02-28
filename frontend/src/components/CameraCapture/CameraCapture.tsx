import { useRef, useState, useCallback, useEffect } from 'react';
import './CameraCapture.css';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

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
      setError('Unable to access camera. Please allow camera permissions and try again.');
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, startCamera]);

  const capturePhoto = () => {
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
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="camera-overlay">
      <div className="camera-container">
        <div className="camera-header">
          <h3>Capture Animal Photo</h3>
          <button className="camera-close-btn" onClick={onClose} aria-label="Close camera">
            ✕
          </button>
        </div>

        {error ? (
          <div className="camera-error">
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => startCamera(facingMode)}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="camera-viewfinder">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video"
              />
              <div className="camera-guide">
                <div className="camera-guide-box" />
                <p className="camera-guide-text">Position the animal&apos;s muzzle in the frame</p>
              </div>
            </div>
            <canvas ref={canvasRef} className="camera-canvas" />
            <div className="camera-controls">
              <button
                className="btn btn-outline camera-flip-btn"
                onClick={toggleCamera}
                aria-label="Flip camera"
              >
                🔄 Flip
              </button>
              <button
                className="btn btn-secondary camera-capture-btn"
                onClick={capturePhoto}
                disabled={!isReady}
                aria-label="Capture photo"
              >
                📸 Capture
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
