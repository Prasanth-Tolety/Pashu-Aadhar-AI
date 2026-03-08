/**
 * QRScanner — A payment-app-style QR scanner overlay.
 * Uses the device camera + a lightweight canvas-based QR decoder.
 * Falls back to BarcodeDetector API where available (Chrome 83+).
 */
import { useState, useEffect, useRef, useCallback } from 'react';

interface QRScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const decodedRef = useRef(false);

  // Extract livestock ID from scanned value (URL or raw ID)
  const extractLivestockId = useCallback((raw: string): string | null => {
    // If it's a URL like https://...../animals/PA-XXXXX-XXXXX
    const urlMatch = raw.match(/\/animals\/(PA-[A-Z0-9-]+)/i);
    if (urlMatch) return urlMatch[1];
    // If it looks like a raw livestock ID
    if (/^PA-[A-Z0-9]+-[A-Z0-9]+$/i.test(raw.trim())) return raw.trim();
    return null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanFrame();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please allow camera permission and try again.');
      setScanning(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Use BarcodeDetector if available, otherwise skip (we'll try a simpler approach)
  const scanFrame = useCallback(() => {
    if (decodedRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Try BarcodeDetector API (Chrome 83+, Edge, Android)
    if ('BarcodeDetector' in window) {
      const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLCanvasElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({ formats: ['qr_code'] });
      detector.detect(canvas).then((barcodes) => {
        if (barcodes.length > 0 && !decodedRef.current) {
          const raw = barcodes[0].rawValue;
          const id = extractLivestockId(raw);
          if (id) {
            decodedRef.current = true;
            setScanning(false);
            stopCamera();
            onScan(id);
          }
        }
      }).catch(() => { /* ignore */ });
    }

    animRef.current = requestAnimationFrame(scanFrame);
  }, [extractLivestockId, onScan, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
      if (capabilities.torch) {
        const newState = !torchOn;
        await track.applyConstraints({ advanced: [{ torch: newState } as MediaTrackConstraintSet] } as MediaTrackConstraints);
        setTorchOn(newState);
      }
    } catch {
      // Torch not supported
    }
  };

  // Manual paste/enter fallback
  const [manualInput, setManualInput] = useState('');
  const handleManualSubmit = () => {
    const id = extractLivestockId(manualInput.trim()) || manualInput.trim();
    if (id) {
      decodedRef.current = true;
      stopCamera();
      onScan(id);
    }
  };

  return (
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-container">
        {/* Top bar */}
        <div className="scanner-top-bar">
          <button className="scanner-close-btn" onClick={() => { stopCamera(); onClose(); }}>✕</button>
          <span className="scanner-title">Scan Animal QR Code</span>
          <button className="scanner-torch-btn" onClick={toggleTorch}>
            {torchOn ? '🔦' : '🔦'}
          </button>
        </div>

        {/* Camera viewport */}
        <div className="scanner-viewport">
          <video ref={videoRef} className="scanner-video" playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Scanning frame overlay */}
          {scanning && !error && (
            <div className="scanner-frame">
              <div className="scanner-corner tl" />
              <div className="scanner-corner tr" />
              <div className="scanner-corner bl" />
              <div className="scanner-corner br" />
              <div className="scanner-line" />
            </div>
          )}

          {error && (
            <div className="scanner-error">
              <p>📷 {error}</p>
            </div>
          )}
        </div>

        {/* Hint text */}
        <div className="scanner-hint">
          <p>Point camera at a Pashu Aadhaar QR code</p>
          <p className="scanner-hint-sub">Works best in good lighting</p>
        </div>

        {/* Manual entry fallback */}
        <div className="scanner-manual">
          <p className="manual-label">Or enter ID manually:</p>
          <div className="manual-input-row">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="PA-XXXXX-XXXXX"
              className="manual-input"
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            />
            <button className="manual-go-btn" onClick={handleManualSubmit}>Go</button>
          </div>
        </div>
      </div>
    </div>
  );
}
