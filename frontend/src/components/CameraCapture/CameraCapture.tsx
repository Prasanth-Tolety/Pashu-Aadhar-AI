import { useRef, useState, useCallback, useEffect } from 'react';
import { useCowDetection, type CowDetection } from '../../hooks/useCowDetection';
import { useMuzzleDetection, type MuzzleDetection } from '../../hooks/useMuzzleDetection';
import { analyzeFrame, resetAssistant, type QualityResult } from '../../utils/captureAssistant';
import { cropMuzzleFromVideo, getMuzzleCropPreview, captureCowPhoto } from '../../utils/muzzleCropper';
import { useLanguage } from '../../context/LanguageContext';
import './CameraCapture.css';

// ─── Timing constants ────────────────────────────────────────────────
const MUZZLE_STABLE_MS = 1000;
const CAPTURE_ANIM_MS = 1800;
const OVERLAY_FPS = 20;

interface CameraCaptureProps {
  onCapture: (muzzleFile: File, cowFile: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { t } = useLanguage();

  // ─── Detection hooks (use preloaded sessions from singleton) ────────
  const cow = useCowDetection();
  const muzzleDet = useMuzzleDetection();

  // ─── UI state ──────────────────────────────────────────────────────
  const [isReady, setIsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [muzzlePreview, setMuzzlePreview] = useState<string | null>(null);
  const [muzzleFile, setMuzzleFile] = useState<File | null>(null);
  const [cowFile, setCowFile] = useState<File | null>(null);
  const [muzzleLocked, setMuzzleLocked] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [toasts, setToasts] = useState<string[]>([]);
  const [cowDetected, setCowDetected] = useState(false);

  // ─── Refs for non-render state ─────────────────────────────────────
  const muzzleStableStartRef = useRef<number | null>(null);
  const lastCowBoxRef = useRef<CowDetection | null>(null);
  const lockedMuzzleRef = useRef<MuzzleDetection | null>(null);
  const capturingRef = useRef(false);
  const overlayRafRef = useRef<number>(0);

  const bothReady = cow.isModelReady && muzzleDet.isModelReady;
  const anyLoading = cow.isModelLoading || muzzleDet.isModelLoading;
  const modelError = cow.modelError || muzzleDet.modelError;

  // ─── Camera management ─────────────────────────────────────────────
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsReady(true);
        setCameraError(null);
      }
    } catch {
      setCameraError(t.cameraPermissionError || 'Camera access denied');
    }
  }, [t]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((tr) => tr.stop());
    };
  }, [facingMode, startCamera]);

  // ─── Full reset (retake / flip camera) ──────────────────────────────
  const fullReset = useCallback(() => {
    // Cancel overlay rAF first to prevent race conditions
    cancelAnimationFrame(overlayRafRef.current);
    overlayRafRef.current = 0;
    cow.stopDetection();

    setMuzzleLocked(false);
    setCowDetected(false);
    setIsCapturing(false);
    setIsPreviewing(false);
    setMuzzlePreview(null);
    setMuzzleFile(null);
    setCowFile(null);
    setQuality(null);
    setToasts([]);
    muzzleStableStartRef.current = null;
    lockedMuzzleRef.current = null;
    lastCowBoxRef.current = null;
    capturingRef.current = false;
    resetAssistant();
    muzzleDet.clearMuzzle();
  }, [muzzleDet, cow]);

  // ─── Start cow detection loop when ready ───────────────────────────
  useEffect(() => {
    if (!isReady || !bothReady || !videoRef.current) return;
    if (isPreviewing) return;

    const video = videoRef.current;
    cow.startDetection(video);
    return () => { cow.stopDetection(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, bothReady, isPreviewing]);

  // ───────────────────────────────────────────────────────────────────
  // UNIFIED LOOP: muzzle detection + quality + overlay — all simultaneous.
  // Cow detection runs separately via useCowDetection's rAF loop.
  // This loop reacts to cow.bestDetection every frame.
  // ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !bothReady || isPreviewing) return;

    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    let lastFrameTime = 0;
    const frameInterval = 1000 / OVERLAY_FPS;

    const loop = async (now: number) => {
      overlayRafRef.current = requestAnimationFrame(loop);

      if (now - lastFrameTime < frameInterval) return;
      lastFrameTime = now;
      if (video.readyState < 2) return;

      // If capture animation is playing, don't touch detections
      if (capturingRef.current) return;

      // ── Grab latest cow detection from mutable ref (not stale React state) ──
      const cowDet = cow.bestDetectionRef.current;

      // ── If cow changed significantly or lost, reset muzzle tracking ──
      if (!cowDet) {
        setCowDetected(false);
        muzzleDet.clearMuzzle();
        muzzleStableStartRef.current = null;
        if (muzzleLocked) setMuzzleLocked(false);
        lockedMuzzleRef.current = null;
        lastCowBoxRef.current = null;
        setQuality(null);
        drawOverlay(overlay, video, null, null, null, false, 0);
        return;
      }

      // Check if the cow moved a lot (animal changed)
      const prev = lastCowBoxRef.current;
      if (prev) {
        const dx = Math.abs((cowDet.x + cowDet.width / 2) - (prev.x + prev.width / 2));
        const dy = Math.abs((cowDet.y + cowDet.height / 2) - (prev.y + prev.height / 2));
        const shift = Math.sqrt(dx * dx + dy * dy);
        // If cow center moved > 35% of frame width, treat as new animal
        if (shift > video.videoWidth * 0.35) {
          muzzleDet.clearMuzzle();
          muzzleStableStartRef.current = null;
          if (muzzleLocked) setMuzzleLocked(false);
          lockedMuzzleRef.current = null;
          resetAssistant();
        }
      }
      lastCowBoxRef.current = cowDet;
      setCowDetected(true);

      // ── Run muzzle detection on this cow (async, non-blocking) ──
      let muzzle = muzzleDet.muzzleDetectionRef.current;
      try {
        const freshMuzzle = await muzzleDet.detectMuzzle(video, cowDet);
        muzzle = freshMuzzle ?? null;
      } catch {
        // silently keep previous muzzle
      }

      // ── Muzzle stability tracking (1s continuous) ──
      let locked = muzzleLocked;
      if (muzzle && muzzle.confidence > 0.35) {
        if (!muzzleStableStartRef.current) {
          muzzleStableStartRef.current = performance.now();
        } else if (!locked && performance.now() - muzzleStableStartRef.current >= MUZZLE_STABLE_MS) {
          locked = true;
          setMuzzleLocked(true);
          lockedMuzzleRef.current = muzzle;
        }
        if (locked) lockedMuzzleRef.current = muzzle;
      } else {
        muzzleStableStartRef.current = null;
        if (locked) {
          setMuzzleLocked(false);
          locked = false;
          lockedMuzzleRef.current = null;
        }
      }

      // ── Quality check (every frame, lightweight) ──
      let q: QualityResult | null = null;
      try {
        q = analyzeFrame(video, cowDet, muzzle);
        setQuality(q);
        // Update floating toasts — only show active suggestions, auto-dismiss resolved ones
        setToasts(q.suggestions.filter(s => s !== '✅ Good to capture!').slice(0, 3));
      } catch {
        // quality analysis failed, non-fatal
      }

      // ── Redraw overlay ──
      const muzzleProgress = muzzleStableStartRef.current
        ? Math.min((performance.now() - muzzleStableStartRef.current) / MUZZLE_STABLE_MS, 1)
        : 0;
      drawOverlay(overlay, video, cowDet, muzzle, q, locked, muzzleProgress);
    };

    overlayRafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(overlayRafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, bothReady, isPreviewing, muzzleLocked]);

  // ─── Overlay drawing ───────────────────────────────────────────────
  function drawOverlay(
    overlay: HTMLCanvasElement,
    video: HTMLVideoElement,
    cowDet: CowDetection | null,
    muzzle: MuzzleDetection | null,
    q: QualityResult | null,
    locked: boolean,
    muzzleProgress: number,
  ) {
    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const now = performance.now();

    // ── Guide ovals (always show when no cow / no muzzle) ──
    if (!cowDet) {
      // Large dashed green oval in center — "place cow here"
      const cx = overlay.width / 2;
      const cy = overlay.height / 2;
      const rx = overlay.width * 0.28;
      const ry = overlay.height * 0.35;
      const dashOffset = (now / 80) % 30;
      ctx.save();
      ctx.strokeStyle = 'rgba(34,197,94,0.45)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([12, 6]);
      ctx.lineDashOffset = dashOffset;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Label
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = 'rgba(34,197,94,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText('🐄 Place cattle here', cx, cy + ry + 22);
      ctx.textAlign = 'start';
      ctx.restore();
      return;
    }

    // ── Cow bounding box ──
    const cowColor = muzzle ? (locked ? '#22c55e' : '#facc15') : '#3b82f6';
    ctx.strokeStyle = cowColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(cowDet.x, cowDet.y, cowDet.width, cowDet.height);

    const label = `🐄 Cow ${Math.round(cowDet.confidence * 100)}%`;
    ctx.font = 'bold 20px sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = cowColor;
    ctx.fillRect(cowDet.x, cowDet.y - 24, tw + 12, 24);
    ctx.fillStyle = '#000';
    ctx.fillText(label, cowDet.x + 6, cowDet.y - 6);

    // ── Muzzle guide oval (show when cow found but muzzle not yet detected) ──
    if (!muzzle) {
      // Show a green dashed oval in the lower half of the cow box (where muzzle should be)
      const guideCx = cowDet.x + cowDet.width / 2;
      const guideCy = cowDet.y + cowDet.height * 0.65;
      const guideRx = cowDet.width * 0.22;
      const guideRy = cowDet.height * 0.18;
      const dashOffset2 = (now / 80) % 30;
      ctx.save();
      ctx.strokeStyle = 'rgba(34,197,94,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      ctx.lineDashOffset = dashOffset2;
      ctx.beginPath();
      ctx.ellipse(guideCx, guideCy, Math.max(guideRx, 15), Math.max(guideRy, 12), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = 'rgba(34,197,94,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText('👃 Muzzle here', guideCx, guideCy + Math.max(guideRy, 12) + 14);
      ctx.textAlign = 'start';
      ctx.restore();
    }

    // ── Muzzle bounding box ──
    if (muzzle) {
      const baseColor = locked ? '#22c55e' : '#f59e0b';

      // Dashed border with animation
      const dashOffset3 = (now / 60) % 20;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.lineDashOffset = dashOffset3;
      ctx.strokeRect(muzzle.x, muzzle.y, muzzle.width, muzzle.height);
      ctx.setLineDash([]);

      // Green oval around the muzzle
      const mCx = muzzle.x + muzzle.width / 2;
      const mCy = muzzle.y + muzzle.height / 2;
      const mRx = muzzle.width * 0.55;
      const mRy = muzzle.height * 0.55;
      ctx.save();
      ctx.strokeStyle = locked ? 'rgba(34,197,94,0.8)' : 'rgba(245,158,11,0.6)';
      ctx.lineWidth = locked ? 3 : 2;
      ctx.beginPath();
      ctx.ellipse(mCx, mCy, mRx, mRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (locked) {
        // Subtle green glow fill when locked
        ctx.fillStyle = 'rgba(34,197,94,0.08)';
        ctx.fill();
      }
      ctx.restore();

      // Corner brackets
      const cLen = Math.min(muzzle.width, muzzle.height) * 0.25;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(muzzle.x, muzzle.y + cLen); ctx.lineTo(muzzle.x, muzzle.y); ctx.lineTo(muzzle.x + cLen, muzzle.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(muzzle.x + muzzle.width - cLen, muzzle.y); ctx.lineTo(muzzle.x + muzzle.width, muzzle.y); ctx.lineTo(muzzle.x + muzzle.width, muzzle.y + cLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(muzzle.x, muzzle.y + muzzle.height - cLen); ctx.lineTo(muzzle.x, muzzle.y + muzzle.height); ctx.lineTo(muzzle.x + cLen, muzzle.y + muzzle.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(muzzle.x + muzzle.width - cLen, muzzle.y + muzzle.height); ctx.lineTo(muzzle.x + muzzle.width, muzzle.y + muzzle.height); ctx.lineTo(muzzle.x + muzzle.width, muzzle.y + muzzle.height - cLen); ctx.stroke();

      // Stability progress ring (fills from 0→1 over 1s)
      if (!locked && muzzleProgress > 0 && muzzleProgress < 1) {
        const cx = muzzle.x + muzzle.width / 2;
        const cy = muzzle.y - 14;
        const r = 8;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * muzzleProgress); ctx.stroke();
      }

      // Muzzle label
      const mLabel = locked
        ? `✅ Muzzle locked ${Math.round(muzzle.confidence * 100)}%`
        : `👃 Muzzle ${Math.round(muzzle.confidence * 100)}%`;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = locked ? 'rgba(22,163,74,0.9)' : 'rgba(245,158,11,0.9)';
      const mtw = ctx.measureText(mLabel).width;
      ctx.fillRect(muzzle.x, muzzle.y + muzzle.height + 2, mtw + 10, 20);
      ctx.fillStyle = '#000';
      ctx.fillText(mLabel, muzzle.x + 5, muzzle.y + muzzle.height + 16);
    }

    // ── Quality bar ──
    if (q) {
      const barX = overlay.width - 120;
      const barY = 12;
      const barW = 108;
      const barH = 14;
      const pct = Math.min(q.score / 150, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
      ctx.fillStyle = pct > 0.66 ? '#22c55e' : pct > 0.4 ? '#facc15' : '#ef4444';
      ctx.fillRect(barX, barY, barW * pct, barH);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Quality: ${q.score}`, barX, barY - 2);
    }
  }

  // ─── Capture animation (slow, user-initiated) ─────────────────────
  const doCapture = useCallback((muzzle: MuzzleDetection) => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    capturingRef.current = true;
    setIsCapturing(true);

    const startTime = performance.now();
    const snapshotMuzzle = { ...muzzle }; // freeze the coords

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / CAPTURE_ANIM_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      overlay.width = video.videoWidth || 640;
      overlay.height = video.videoHeight || 480;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      const pad = 16;

      // Darken surroundings slowly
      ctx.fillStyle = `rgba(0,0,0,${0.55 * eased})`;
      ctx.fillRect(0, 0, overlay.width, overlay.height);

      // Clear muzzle region
      ctx.clearRect(
        snapshotMuzzle.x - pad * eased,
        snapshotMuzzle.y - pad * eased,
        snapshotMuzzle.width + pad * 2 * eased,
        snapshotMuzzle.height + pad * 2 * eased,
      );

      // Glowing border
      ctx.save();
      ctx.strokeStyle = `rgba(34,197,94,${0.4 + 0.6 * eased})`;
      ctx.lineWidth = 3 + 3 * eased;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 18 * eased;
      ctx.strokeRect(
        snapshotMuzzle.x - pad * eased,
        snapshotMuzzle.y - pad * eased,
        snapshotMuzzle.width + pad * 2 * eased,
        snapshotMuzzle.height + pad * 2 * eased,
      );
      ctx.restore();

      // Scanning line
      const scanY = snapshotMuzzle.y + snapshotMuzzle.height * ((now / 600) % 1);
      ctx.strokeStyle = `rgba(34,197,94,${0.25 * eased})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(snapshotMuzzle.x - pad, scanY);
      ctx.lineTo(snapshotMuzzle.x + snapshotMuzzle.width + pad, scanY);
      ctx.stroke();

      // Progress text
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#22c55e';
      ctx.textAlign = 'center';
      const pctText = Math.round(progress * 100);
      ctx.fillText(`📸 Capturing muzzle... ${pctText}%`, overlay.width / 2, overlay.height - 30);
      ctx.textAlign = 'start';

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation done → crop muzzle + capture cow photo, then show preview
        capturingRef.current = false;
        setIsCapturing(false);
        (async () => {
          try {
            const preview = getMuzzleCropPreview(video, snapshotMuzzle);
            const mFile = await cropMuzzleFromVideo(video, snapshotMuzzle);
            const cFile = await captureCowPhoto(video, cow.bestDetectionRef.current);
            setMuzzlePreview(preview);
            setMuzzleFile(mFile);
            setCowFile(cFile);
            setIsPreviewing(true);
            setToasts([]);
            cow.stopDetection();
          } catch {
            fullReset();
            // Restart detection after failed crop
            setTimeout(() => {
              if (videoRef.current && bothReady) cow.startDetection(videoRef.current);
            }, 100);
          }
        })();
      }
    };

    requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothReady, fullReset]);

  // ─── User actions ──────────────────────────────────────────────────
  const handleCaptureMuzzle = useCallback(() => {
    // Use locked muzzle if available, else current detection ref, else heuristic
    const currentCow = cow.bestDetectionRef.current;
    const muzzle = lockedMuzzleRef.current
      ?? muzzleDet.muzzleDetectionRef.current
      ?? (currentCow ? {
        x: currentCow.x + currentCow.width * 0.2,
        y: currentCow.y + currentCow.height * 0.5,
        width: currentCow.width * 0.6,
        height: currentCow.height * 0.5,
        confidence: 0.4,
      } : null);

    if (muzzle) doCapture(muzzle);
  }, [doCapture]);

  const handleAcceptCapture = useCallback(() => {
    if (muzzleFile && cowFile) {
      onCapture(muzzleFile, cowFile);
    }
  }, [muzzleFile, cowFile, onCapture]);

  const handleRetake = useCallback(() => {
    fullReset();
    // Don't restart detection here — the useEffect watching isPreviewing handles it.
    // fullReset() sets isPreviewing=false which triggers the cow detection useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullReset]);

  const toggleCamera = useCallback(() => {
    fullReset();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, [fullReset]);

  // ─── Derived status ────────────────────────────────────────────────
  const getStatusInfo = () => {
    if (anyLoading) return { text: `🔄 ${t.loadingAiModel || 'Loading AI models...'}`, cls: 'status-loading' };
    if (modelError) return { text: `⚠️ ${modelError}`, cls: 'status-error' };
    if (isCapturing) return { text: '📸 Capturing muzzle...', cls: 'status-capturing' };
    if (isPreviewing) return { text: '✅ Muzzle captured!', cls: 'status-good' };
    if (!cowDetected) return { text: `🔍 ${t.lookingForAnimal || 'Looking for cattle...'}`, cls: 'status-searching' };
    if (muzzleLocked) {
      if (quality?.approved) return { text: '✅ Muzzle locked — tap Capture!', cls: 'status-good' };
      return { text: '🔒 Muzzle locked — tap Capture or improve quality', cls: 'status-good' };
    }
    if (muzzleDet.muzzleDetection) return { text: '👃 Muzzle found — hold steady to lock...', cls: 'status-detected' };
    if (cowDetected) {
      const tip = quality?.suggestions[0] || 'Finding muzzle...';
      return { text: `🐄 Cow detected — ${tip}`, cls: 'status-detected' };
    }
    return { text: '', cls: '' };
  };
  const status = getStatusInfo();

  // ─── Which pipeline dots are active? ───────────────────────────────
  const hasCow = cowDetected;
  const hasMuzzle = !!muzzleDet.muzzleDetection || muzzleLocked;
  const hasQuality = hasMuzzle && (quality?.score ?? 0) > 0;

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="camera-overlay">
      <div className="camera-container">
        <div className="camera-header">
          <h3>{isPreviewing ? '🔬 Muzzle Preview' : (t.captureAnimalPhoto || 'Capture Animal Photo')}</h3>
          <button className="camera-close-btn" onClick={onClose} aria-label="Close camera">✕</button>
        </div>

        {cameraError ? (
          <div className="camera-error">
            <p>{cameraError}</p>
            <button className="btn btn-primary" onClick={() => startCamera(facingMode)}>
              {t.retryCamera || 'Retry'}
            </button>
          </div>
        ) : isPreviewing && muzzlePreview ? (
          <div className="muzzle-preview-container">
            <div className="muzzle-preview-image-wrap">
              <img src={muzzlePreview} alt="Muzzle capture" className="muzzle-preview-image" />
              <div className="muzzle-preview-badge">👃 Muzzle ROI</div>
            </div>
            <p className="muzzle-preview-info">
              This cropped muzzle image will be used for unique identification via embeddings.
            </p>
            <div className="muzzle-preview-actions">
              <button className="btn btn-primary muzzle-accept-btn" onClick={handleAcceptCapture}>
                ✅ Use This Capture
              </button>
              <button className="btn btn-outline muzzle-retake-btn" onClick={handleRetake}>
                🔄 Retake
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`camera-viewfinder ${isCapturing ? 'viewfinder-capturing' : ''}`}>
              <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
              <canvas ref={overlayRef} className="camera-overlay-canvas" />

              {/* Floating suggestion toasts — top-right, auto-dismiss */}
              {toasts.length > 0 && !isCapturing && (
                <div className="floating-toasts">
                  {toasts.map((msg, i) => (
                    <div key={`${msg}-${i}`} className="toast-item">💡 {msg}</div>
                  ))}
                </div>
              )}

              {/* Pipeline stage indicators */}
              <div className="pipeline-stages">
                <div className={`pipeline-dot ${hasCow ? 'active' : ''}`}>
                  <span>🐄</span><small>Cow</small>
                </div>
                <div className={`pipeline-line ${hasCow ? 'active' : ''}`} />
                <div className={`pipeline-dot ${hasMuzzle ? 'active' : ''}`}>
                  <span>👃</span><small>Muzzle</small>
                </div>
                <div className={`pipeline-line ${hasMuzzle ? 'active' : ''}`} />
                <div className={`pipeline-dot ${hasQuality ? 'active' : ''}`}>
                  <span>✅</span><small>Quality</small>
                </div>
              </div>

              <div className={`camera-ai-status ${status.cls}`}>{status.text}</div>
            </div>

            <div className="camera-controls">
              <button className="btn btn-outline camera-flip-btn" onClick={toggleCamera} aria-label="Flip camera">
                🔄 {t.flipCamera || 'Flip'}
              </button>
              <button
                className="btn btn-secondary camera-capture-btn"
                onClick={handleCaptureMuzzle}
                disabled={!isReady || anyLoading || isCapturing || !cowDetected}
                aria-label="Capture muzzle"
              >
                {muzzleLocked ? '📸 Capture Muzzle' : cowDetected ? '📸 Capture' : (t.captureBtn || 'Capture')}
              </button>
            </div>

            <p className="camera-hint">
              {muzzleLocked
                ? 'Muzzle is locked! Tap "Capture Muzzle" when ready.'
                : (t.cameraAutoCapHint || 'Hold steady once muzzle is found. Captures when you approve!')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
