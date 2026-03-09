/**
 * AgentLiveCapture — Continuous live-feed enrollment capture.
 *
 * The camera opens ONCE and stays open through all 4 steps:
 *   1. Cow detection   → cow.onnx only → crop cow region
 *   2. Muzzle detection → muzzle.onnx only (within cow box) → crop muzzle region
 *   3. Body texture     → no model, agent captures side view manually
 *   4. Agent selfie     → no model, front camera, agent captures face
 *
 * Features:
 *   • REAL-TIME detection driven FROM the overlay loop itself (not gated by React state)
 *   • Models preloaded in parallel on mount
 *   • CaptureAssistant quality scoring + suggestion overlays
 *   • Step checklist overlay on live feed with ✅ ticks
 *   • Agent-initiated capture via bottom button
 *   • Force-capture button after 7s without detection
 *   • PREVIEW screen before submission with retake-all option
 *   • Images held in memory — only passed to parent on final submit
 *   • MediaRecorder for continuous video recording
 *   • 2-minute session time limit with countdown
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useCowDetection } from '../../hooks/useCowDetection';
import { useMuzzleDetection } from '../../hooks/useMuzzleDetection';
import { preloadModels, getCowSession, getMuzzleSession } from '../../hooks/useModelPreloader';
import { analyzeFrame, resetAssistant, type QualityResult } from '../../utils/captureAssistant';
import { cropMuzzleFromVideo } from '../../utils/muzzleCropper';
import type { CowDetection } from '../../hooks/useCowDetection';
import type { MuzzleDetection } from '../../hooks/useMuzzleDetection';
import './AgentLiveCapture.css';

// ─── Config ──────────────────────────────────────────────────────────
const SESSION_TIME_LIMIT_MS = 2 * 60 * 1000; // 2 minutes
const HIGHLIGHT_DURATION_MS = 1200;
const OVERLAY_FPS = 20;
const DETECTION_STABLE_MS = 600; // time object must be stable before "ready"
const FORCE_CAPTURE_DELAY_MS = 7000; // show force-capture btn after 7s without detection
/** Grace period: keep using last cow box for muzzle step after cow is lost (user zooming in) */
const COW_GRACE_PERIOD_MS = 5000;

type CaptureStep = 'cow_detection' | 'muzzle_detection' | 'body_texture' | 'agent_selfie';

interface StepDef {
  id: CaptureStep;
  label: string;
  icon: string;
  hint: string;
  usesModel: boolean;
  required: boolean;
}

const STEPS: StepDef[] = [
  { id: 'cow_detection', label: 'Cow Detection', icon: '🐄', hint: 'Point camera at the cow. A bounding box will appear when detected.', usesModel: true, required: true },
  { id: 'muzzle_detection', label: 'Muzzle Capture', icon: '👃', hint: 'Move closer to the muzzle area. Hold steady until box turns green.', usesModel: true, required: true },
  { id: 'body_texture', label: 'Body Texture', icon: '📸', hint: 'Capture a clear side-view of the animal\'s body pattern.', usesModel: false, required: false },
  { id: 'agent_selfie', label: 'Agent Selfie', icon: '🤳', hint: 'Switch to front camera and take a verification selfie.', usesModel: false, required: true },
];

export interface CaptureResult {
  step: CaptureStep;
  file: File;
  /** Object URL for preview (revoked on unmount or retake) */
  previewUrl?: string;
  /** Detection confidence score (0–1) at time of capture */
  confidence?: number;
}

interface AgentLiveCaptureProps {
  /** Called when agent confirms all captures from preview. Parent should upload to S3. */
  onSubmit: (results: CaptureResult[], videoFile: File | null) => void;
  /** Called when agent closes/discards (nothing uploaded) */
  onClose: () => void;
  /** Legacy: per-step callback — now only used for progress tracking, NOT uploading */
  onStepCapture?: (result: CaptureResult) => void;
}

export default function AgentLiveCapture({ onSubmit, onClose, onStepCapture }: AgentLiveCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const overlayRafRef = useRef<number>(0);
  const sessionStartRef = useRef<number>(Date.now());
  const stableStartRef = useRef<number | null>(null);
  const lastCowBoxRef = useRef<CowDetection | null>(null);
  /** Timestamp when cow was last detected — used for grace period during muzzle step */
  const cowLastSeenTimeRef = useRef<number>(0);
  const stepStartRef = useRef<number>(Date.now());

  // MediaRecorder refs for live video capture
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartedRef = useRef(false);

  // Detection hooks
  const cow = useCowDetection();
  const muzzleDet = useMuzzleDetection();

  // State
  const [isReady, setIsReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [capturedFiles, setCapturedFiles] = useState<CaptureResult[]>([]);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [isDetectionReady, setIsDetectionReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState(SESSION_TIME_LIMIT_MS);
  const [showCameraSwitch, setShowCameraSwitch] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [, setQuality] = useState<QualityResult | null>(null);
  const [forceEnabled, setForceEnabled] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Refs for throttling detection from overlay loop
  const lastCowDetectTimeRef = useRef<number>(0);
  const lastMuzzleDetectTimeRef = useRef<number>(0);
  const COW_DETECT_INTERVAL = 1000 / 12; // ~12fps cow detection
  const MUZZLE_DETECT_INTERVAL = 1000 / 8; // ~8fps muzzle detection (heavier model)

  const currentStep = STEPS[currentStepIdx];

  // Per-step model readiness (don't gate cow step on muzzle model!)
  const cowModelNeeded = currentStep.id === 'cow_detection' || currentStep.id === 'muzzle_detection';
  const muzzleModelNeeded = currentStep.id === 'muzzle_detection';
  const stepModelReady =
    !currentStep.usesModel ||
    (cowModelNeeded && !muzzleModelNeeded && cow.isModelReady) ||
    (muzzleModelNeeded && cow.isModelReady && muzzleDet.isModelReady) ||
    false;
  const anyLoading = currentStep.usesModel && !stepModelReady;
  const modelError = (cowModelNeeded && cow.modelError) || (muzzleModelNeeded && muzzleDet.modelError) || null;

  // ─── Preload models on mount (belt-and-suspenders: Enrollment.tsx also calls) ─
  useEffect(() => {
    console.log('[AgentLiveCapture] Triggering preloadModels()');
    preloadModels().then(() => console.log('[AgentLiveCapture] Models preloaded'));
  }, []);

  // ─── MediaRecorder: start recording when stream is ready ───────────
  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || recordingStartedRef.current) return;

    // Choose a supported mime type
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

    try {
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 500_000 });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.start(2000); // collect data every 2 seconds
      mediaRecorderRef.current = recorder;
      recordingStartedRef.current = true;
      console.log('[AgentLiveCapture] MediaRecorder started:', mimeType);
    } catch (err) {
      console.warn('[AgentLiveCapture] MediaRecorder not supported:', err);
    }
  }, []);

  const stopRecordingAndCollect = useCallback(async (): Promise<File | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return null;

    return new Promise<File | null>((resolve) => {
      recorder.onstop = () => {
        const chunks = recordedChunksRef.current;
        if (chunks.length > 0) {
          const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
          const contentType = recorder.mimeType.split(';')[0] || 'video/webm';
          const blob = new Blob(chunks, { type: contentType });
          const file = new File([blob], `enrollment-recording-${Date.now()}.${ext}`, { type: contentType });
          console.log('[AgentLiveCapture] Recording ready:', file.name, `${(file.size / 1024 / 1024).toFixed(1)}MB`);
          resolve(file);
        } else {
          resolve(null);
        }
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        recordingStartedRef.current = false;
      };
      recorder.stop();
    });
  }, []);

  // Start recording once video is playing
  useEffect(() => {
    if (!isReady || !streamRef.current) return;
    startRecording();
  }, [isReady, startRecording]);

  // Stop recording on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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
      setCameraError('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((tr) => tr.stop());
    };
  }, [facingMode, startCamera]);

  // ─── Session timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (showPreview) return; // Pause timer during preview
    const timer = setInterval(() => {
      const elapsed = Date.now() - sessionStartRef.current;
      const remaining = Math.max(0, SESSION_TIME_LIMIT_MS - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        // Time's up — go to preview with whatever we have
        finishCapture();
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview]);

  // ─── UNIFIED overlay + detection loop ──────────────────────────────
  // KEY FIX: cow detection runs INSIDE the overlay loop by calling
  // cow.runDetection() directly, checking the singleton cache (getCowSession())
  // rather than depending on React state `cow.isModelReady` for triggering.
  useEffect(() => {
    if (!isReady || !videoRef.current || !overlayRef.current) return;
    if (isHighlighting || showPreview) return;

    const video = videoRef.current;
    const overlay = overlayRef.current;
    let lastFrameTime = 0;
    const frameInterval = 1000 / OVERLAY_FPS;

    const loop = async (now: number) => {
      overlayRafRef.current = requestAnimationFrame(loop);
      if (now - lastFrameTime < frameInterval) return;
      lastFrameTime = now;
      if (video.readyState < 2) return;

      const step = STEPS[currentStepIdx];

      overlay.width = video.videoWidth || 640;
      overlay.height = video.videoHeight || 480;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      // DRIVE COW DETECTION from this loop (bypass React state gating)
      if ((step.id === 'cow_detection' || step.id === 'muzzle_detection') && getCowSession()) {
        if (now - lastCowDetectTimeRef.current >= COW_DETECT_INTERVAL) {
          lastCowDetectTimeRef.current = now;
          // Fire-and-forget: runDetection updates cow.bestDetectionRef synchronously
          // so drawCowDetectionStep reads the result immediately on the SAME frame.
          cow.runDetection(video);
        }
      }

      // DRIVE MUZZLE DETECTION from this loop (full frame, no cow-box crop)
      if (step.id === 'muzzle_detection' && getMuzzleSession()) {
        if (now - lastMuzzleDetectTimeRef.current >= MUZZLE_DETECT_INTERVAL) {
          lastMuzzleDetectTimeRef.current = now;
          // Fire-and-forget: detectMuzzle updates muzzleDet.muzzleDetectionRef
          muzzleDet.detectMuzzle(video);
        }
      }

      if (step.id === 'cow_detection') {
        drawCowDetectionStep(ctx, overlay, video, now);
      } else if (step.id === 'muzzle_detection') {
        drawMuzzleDetectionStep(ctx, overlay, video, now);
      } else if (step.id === 'body_texture') {
        drawTextureStep(ctx, overlay, video);
      } else if (step.id === 'agent_selfie') {
        drawSelfieStep(ctx, overlay);
      }
    };

    overlayRafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(overlayRafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, currentStepIdx, isHighlighting, showPreview]);

  // ─── Cow detection step overlay ────────────────────────────────────
  function drawCowDetectionStep(
    ctx: CanvasRenderingContext2D,
    overlay: HTMLCanvasElement,
    video: HTMLVideoElement,
    now: number,
  ) {
    // Read from the MUTABLE REF — always current, no React render delay
    const det = cow.bestDetectionRef.current;

    // Run capture assistant for quality scoring
    const q = det ? analyzeFrame(video, det, null) : null;
    if (q) setQuality(q);

    if (!det) {
      // Guide oval
      const cx = overlay.width / 2;
      const cy = overlay.height / 2;
      const rx = overlay.width * 0.3;
      const ry = overlay.height * 0.35;
      const dashOffset = (now / 80) % 30;
      ctx.save();
      ctx.strokeStyle = 'rgba(34,197,94,0.4)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([12, 6]);
      ctx.lineDashOffset = dashOffset;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText('🐄 Point at the cow', cx, cy + ry + 24);
      ctx.restore();
      stableStartRef.current = null;
      setIsDetectionReady(false);
      setSuggestion('Point camera at the cow');
      return;
    }

    // Track stability
    if (!stableStartRef.current) {
      stableStartRef.current = now;
    }
    const stableTime = now - stableStartRef.current;
    const isStable = stableTime >= DETECTION_STABLE_MS;

    // Thick bounding box
    const color = isStable ? '#22c55e' : '#facc15';
    ctx.strokeStyle = color;
    ctx.lineWidth = isStable ? 5 : 3;
    ctx.strokeRect(det.x, det.y, det.width, det.height);

    // Corner brackets
    const cLen = Math.min(det.width, det.height) * 0.15;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    drawCornerBrackets(ctx, det.x, det.y, det.width, det.height, cLen);

    // Label
    const label = `🐄 Cow ${Math.round(det.confidence * 100)}%`;
    ctx.font = 'bold 14px sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = color;
    ctx.fillRect(det.x, det.y - 26, tw + 12, 24);
    ctx.fillStyle = '#000';
    ctx.fillText(label, det.x + 6, det.y - 8);

    // Quality bar from capture assistant
    if (q) drawQualityBar(ctx, overlay, q);

    lastCowBoxRef.current = det;
    setIsDetectionReady(isStable);

    // Suggestions from capture assistant
    const tip = q?.suggestions?.[0];
    setSuggestion(
      isStable
        ? (tip === '✅ Good to capture!' ? '✅ Cow detected! Tap Capture' : `✅ Ready — ${tip || 'Tap Capture'}`)
        : (tip || 'Hold steady...')
    );
  }

  // ─── Muzzle detection step overlay ─────────────────────────────────
  function drawMuzzleDetectionStep(
    ctx: CanvasRenderingContext2D,
    overlay: HTMLCanvasElement,
    video: HTMLVideoElement,
    now: number,
  ) {
    // Read from the MUTABLE REF — always current, no React render delay
    const liveCowDet = cow.bestDetectionRef.current;

    // Track when cow was last actively detected
    if (liveCowDet) {
      cowLastSeenTimeRef.current = now;
      lastCowBoxRef.current = liveCowDet;
    }

    // Use live cow detection, or fall back to the last-known cow box within
    // a grace period.  This lets the user zoom in on the muzzle — the cow
    // model will lose the full body, but the muzzle model keeps working.
    const cowWithinGrace =
      !liveCowDet &&
      lastCowBoxRef.current &&
      (now - cowLastSeenTimeRef.current) < COW_GRACE_PERIOD_MS;
    const cowDet = liveCowDet ?? (cowWithinGrace ? lastCowBoxRef.current : null);

    // Read muzzle from MUTABLE REF (detection driven by the overlay loop above)
    const muzzle = muzzleDet.muzzleDetectionRef.current;

    // ── When neither cow NOR muzzle is available ─────────────────────
    if (!cowDet && (!muzzle || muzzle.confidence < 0.30)) {
      stableStartRef.current = null;
      setIsDetectionReady(false);
      setSuggestion('Point camera at the cow, then move closer to its muzzle');
      ctx.save();
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'center';
      ctx.fillText('🐄 Point at the cow\'s face area', overlay.width / 2, overlay.height / 2);
      ctx.restore();
      return;
    }

    // Draw faint cow box if we have one (live or grace period)
    if (cowDet) {
      const cowAlpha = liveCowDet ? 0.3 : 0.15; // dimmer when using grace-period box
      ctx.strokeStyle = `rgba(59,130,246,${cowAlpha})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(cowDet.x, cowDet.y, cowDet.width, cowDet.height);
      ctx.setLineDash([]);
    }

    // Run capture assistant (uses cowDet for quality checks — or null if muzzle-only mode)
    const q = analyzeFrame(video, cowDet, muzzle);
    setQuality(q);

    if (!muzzle || muzzle.confidence < 0.30) {
      // Show muzzle guide oval — within cow box if available, else centered on screen
      const guideCx = cowDet ? cowDet.x + cowDet.width / 2 : overlay.width / 2;
      const guideCy = cowDet ? cowDet.y + cowDet.height * 0.65 : overlay.height / 2;
      const guideRx = cowDet ? cowDet.width * 0.22 : overlay.width * 0.15;
      const guideRy = cowDet ? cowDet.height * 0.18 : overlay.height * 0.12;
      const dashOffset = (now / 80) % 30;
      ctx.save();
      ctx.strokeStyle = 'rgba(34,197,94,0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 5]);
      ctx.lineDashOffset = dashOffset;
      ctx.beginPath();
      ctx.ellipse(guideCx, guideCy, Math.max(guideRx, 20), Math.max(guideRy, 15), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = 'rgba(34,197,94,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText('👃 Muzzle here', guideCx, guideCy + Math.max(guideRy, 15) + 14);
      ctx.restore();

      stableStartRef.current = null;
      setIsDetectionReady(false);
      const tip = q?.suggestions?.[0] || 'Move closer to the muzzle area';
      setSuggestion(tip);
      return;
    }

    // ── Muzzle found — draw bounding box & enable capture ────────────

    // Track stability
    if (!stableStartRef.current) {
      stableStartRef.current = now;
    }
    const stableTime = now - stableStartRef.current;
    const isStable = stableTime >= DETECTION_STABLE_MS;
    const color = isStable ? '#22c55e' : '#f59e0b';

    // Thick muzzle bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = isStable ? 5 : 3;
    ctx.strokeRect(muzzle.x, muzzle.y, muzzle.width, muzzle.height);

    // Corner brackets
    const cLen = Math.min(muzzle.width, muzzle.height) * 0.2;
    ctx.lineWidth = 4;
    drawCornerBrackets(ctx, muzzle.x, muzzle.y, muzzle.width, muzzle.height, cLen);

    // Green oval around muzzle
    const mCx = muzzle.x + muzzle.width / 2;
    const mCy = muzzle.y + muzzle.height / 2;
    const mRx = muzzle.width * 0.55;
    const mRy = muzzle.height * 0.55;
    ctx.save();
    ctx.strokeStyle = isStable ? 'rgba(34,197,94,0.8)' : 'rgba(245,158,11,0.6)';
    ctx.lineWidth = isStable ? 5 : 3;
    ctx.beginPath();
    ctx.ellipse(mCx, mCy, mRx, mRy, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (isStable) {
      ctx.fillStyle = 'rgba(34,197,94,0.08)';
      ctx.fill();
    }
    ctx.restore();

    // Label — show "close-up" indicator when cow is lost but muzzle is detected
    const closeUpTag = !liveCowDet ? ' 🔍' : '';
    const label = `👃 Muzzle ${Math.round(muzzle.confidence * 100)}%${closeUpTag}`;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = isStable ? 'rgba(22,163,74,0.9)' : 'rgba(245,158,11,0.9)';
    const mtw = ctx.measureText(label).width;
    ctx.fillRect(muzzle.x, muzzle.y + muzzle.height + 2, mtw + 10, 20);
    ctx.fillStyle = '#000';
    ctx.fillText(label, muzzle.x + 5, muzzle.y + muzzle.height + 16);

    // Quality bar from capture assistant
    if (q) drawQualityBar(ctx, overlay, q);

    setIsDetectionReady(isStable);
    const tip = q?.suggestions?.[0];
    setSuggestion(
      isStable
        ? (tip === '✅ Good to capture!' ? '✅ Muzzle locked! Tap Capture' : `✅ Ready — ${tip || 'Tap Capture'}`)
        : (tip || 'Hold steady...')
    );
  }

  // ─── Body texture step overlay ─────────────────────────────────────
  function drawTextureStep(
    ctx: CanvasRenderingContext2D,
    overlay: HTMLCanvasElement,
    _video: HTMLVideoElement,
  ) {
    // Guide rectangle
    const margin = 40;
    const rx = margin;
    const ry = margin;
    const rw = overlay.width - margin * 2;
    const rh = overlay.height - margin * 2;

    ctx.strokeStyle = 'rgba(59,130,246,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);

    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('📸 Capture side view of the animal', overlay.width / 2, overlay.height - 20);
    ctx.textAlign = 'start';

    setIsDetectionReady(true); // Always ready, manual capture
    setSuggestion('Capture a clear side view showing body pattern');
  }

  // ─── Selfie step overlay ───────────────────────────────────────────
  function drawSelfieStep(
    ctx: CanvasRenderingContext2D,
    overlay: HTMLCanvasElement,
  ) {
    // Face oval guide
    const cx = overlay.width / 2;
    const cy = overlay.height * 0.4;
    const rx = overlay.width * 0.2;
    const ry = overlay.height * 0.25;

    ctx.strokeStyle = 'rgba(59,130,246,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('🤳 Position your face in the oval', cx, cy + ry + 28);
    ctx.textAlign = 'start';

    setIsDetectionReady(true);
    setSuggestion('Ensure your face is clearly visible');
  }

  // ─── Corner bracket helper ─────────────────────────────────────────
  function drawCornerBrackets(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, len: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
    ctx.stroke();
  }

  // ─── Quality bar drawing ───────────────────────────────────────────
  function drawQualityBar(
    ctx: CanvasRenderingContext2D,
    overlay: HTMLCanvasElement,
    q: QualityResult,
  ) {
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

  // ─── Highlight animation after capture ─────────────────────────────
  const playHighlight = useCallback((
    region: { x: number; y: number; width: number; height: number } | null,
  ) => {
    setIsHighlighting(true);
    cancelAnimationFrame(overlayRafRef.current);

    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) {
      setIsHighlighting(false);
      return;
    }

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / HIGHLIGHT_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      overlay.width = video.videoWidth || 640;
      overlay.height = video.videoHeight || 480;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      // Darken surroundings
      ctx.fillStyle = `rgba(0,0,0,${0.5 * eased})`;
      ctx.fillRect(0, 0, overlay.width, overlay.height);

      if (region) {
        const pad = 12;
        // Clear the captured region
        ctx.clearRect(
          region.x - pad * eased,
          region.y - pad * eased,
          region.width + pad * 2 * eased,
          region.height + pad * 2 * eased,
        );

        // Green glow border
        ctx.save();
        ctx.strokeStyle = `rgba(34,197,94,${0.5 + 0.5 * eased})`;
        ctx.lineWidth = 3 + 4 * eased;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 20 * eased;
        ctx.strokeRect(
          region.x - pad * eased,
          region.y - pad * eased,
          region.width + pad * 2 * eased,
          region.height + pad * 2 * eased,
        );
        ctx.restore();
      }

      // "Captured!" text
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = `rgba(34,197,94,${eased})`;
      ctx.textAlign = 'center';
      ctx.fillText('✅ Captured!', overlay.width / 2, overlay.height - 40);
      ctx.textAlign = 'start';

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsHighlighting(false);
      }
    };

    requestAnimationFrame(animate);
  }, []);

  // ─── Force-capture timer — resets when step changes ─────────────────
  useEffect(() => {
    stepStartRef.current = Date.now();
    setForceEnabled(false);
    stableStartRef.current = null;
    setIsDetectionReady(false);
    resetAssistant();
    setQuality(null);

    if (!STEPS[currentStepIdx].usesModel) return; // non-model steps always ready

    const timer = setInterval(() => {
      const elapsed = Date.now() - stepStartRef.current;
      if (elapsed >= FORCE_CAPTURE_DELAY_MS) {
        setForceEnabled(true);
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentStepIdx]);

  // ─── Finish capture → go to preview ────────────────────────────────
  const finishCapture = useCallback(async () => {
    // Stop any detection loops
    cow.stopDetection();
    muzzleDet.clearMuzzle();

    // Stop recording, collect video file
    const vid = await stopRecordingAndCollect();
    setVideoFile(vid);

    // Stop camera to save resources during preview
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }

    setShowPreview(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopRecordingAndCollect]);

  // ─── Advance to next step helper ──────────────────────────────────
  const advanceStep = useCallback((newFiles: CaptureResult[]) => {
    stableStartRef.current = null;
    setIsDetectionReady(false);
    setForceEnabled(false);
    muzzleDet.clearMuzzle();
    resetAssistant();
    setQuality(null);

    const nextIdx = currentStepIdx + 1;
    if (nextIdx >= STEPS.length) {
      // All steps done — go to preview
      setCapturedFiles(newFiles);
      finishCapture();
    } else {
      setCurrentStepIdx(nextIdx);
      if (STEPS[nextIdx].id === 'agent_selfie') {
        setShowCameraSwitch(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIdx, finishCapture]);

  // ─── Capture handler (normal — requires detection) ─────────────────
  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const step = STEPS[currentStepIdx];
    let file: File;
    let highlightRegion: { x: number; y: number; width: number; height: number } | null = null;
    let captureConfidence: number | undefined;

    try {
      if (step.id === 'cow_detection') {
        // Read from ref for the most current detection (no stale closure risk)
        const det = cow.bestDetectionRef.current;
        if (!det) return;
        highlightRegion = { x: det.x, y: det.y, width: det.width, height: det.height };
        captureConfidence = det.confidence;
        // Crop cow region for embedding
        file = await cropRegionFromVideo(video, det, `cow-${Date.now()}.jpg`, 0.20);
      } else if (step.id === 'muzzle_detection') {
        // Read from mutable ref for the most current detection
        const muzzle = muzzleDet.muzzleDetectionRef.current;
        // Use live cow detection, or fall back to last-known cow box (close-up scenario)
        const cowDet = cow.bestDetectionRef.current ?? lastCowBoxRef.current;
        if (!muzzle && !cowDet) return;
        if (muzzle) {
          highlightRegion = { x: muzzle.x, y: muzzle.y, width: muzzle.width, height: muzzle.height };
          captureConfidence = muzzle.confidence;
          file = await cropMuzzleFromVideo(video, muzzle, `muzzle-${Date.now()}.jpg`);
        } else if (cowDet) {
          // Fallback: heuristic muzzle crop from lower cow box
          const heuristic: MuzzleDetection = {
            x: cowDet.x + cowDet.width * 0.2,
            y: cowDet.y + cowDet.height * 0.5,
            width: cowDet.width * 0.6,
            height: cowDet.height * 0.5,
            confidence: 0.4,
          };
          captureConfidence = heuristic.confidence;
          highlightRegion = { x: heuristic.x, y: heuristic.y, width: heuristic.width, height: heuristic.height };
          file = await cropMuzzleFromVideo(video, heuristic, `muzzle-${Date.now()}.jpg`);
        } else {
          return;
        }
      } else {
        // body_texture or agent_selfie — full frame capture
        file = await captureFullFrame(video, `${step.id}-${Date.now()}.jpg`);
        highlightRegion = null;
      }

      // Stop detection during highlight
      cow.stopDetection();

      // Create preview URL for later review
      const previewUrl = URL.createObjectURL(file);
      const result: CaptureResult = { step: step.id, file, previewUrl, confidence: captureConfidence };
      playHighlight(highlightRegion);

      const newFiles = [...capturedFiles, result];
      setCapturedFiles(newFiles);
      setCompletedSteps((prev) => ({ ...prev, [step.id]: true }));
      if (onStepCapture) onStepCapture(result);

      setTimeout(() => advanceStep(newFiles), HIGHLIGHT_DURATION_MS + 200);

    } catch (err) {
      console.error('Capture error:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIdx, capturedFiles, playHighlight, onStepCapture, advanceStep]);

  // ─── Force-capture handler (no detection required) ─────────────────
  const handleForceCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const step = STEPS[currentStepIdx];

    try {
      const file = await captureFullFrame(video, `${step.id}-force-${Date.now()}.jpg`);
      cow.stopDetection();

      const previewUrl = URL.createObjectURL(file);
      const result: CaptureResult = { step: step.id, file, previewUrl };
      playHighlight(null);

      const newFiles = [...capturedFiles, result];
      setCapturedFiles(newFiles);
      setCompletedSteps((prev) => ({ ...prev, [step.id]: true }));
      if (onStepCapture) onStepCapture(result);

      setTimeout(() => advanceStep(newFiles), HIGHLIGHT_DURATION_MS + 200);
    } catch (err) {
      console.error('Force capture error:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIdx, capturedFiles, playHighlight, onStepCapture, advanceStep]);

  // ─── Skip optional step ────────────────────────────────────────────
  const handleSkip = useCallback(() => {
    advanceStep(capturedFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceStep, capturedFiles]);

  // ─── Camera switch for selfie ──────────────────────────────────────
  const handleSwitchToFront = useCallback(() => {
    setFacingMode('user');
    setShowCameraSwitch(false);
  }, []);

  const handleKeepRear = useCallback(() => {
    setShowCameraSwitch(false);
  }, []);

  // ─── Close handler — discard everything, nothing uploaded ───────────
  const handleClose = useCallback(() => {
    // Revoke all preview URLs to free memory
    capturedFiles.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });

    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }

    onClose();
  }, [capturedFiles, onClose]);

  // ─── Retake All — discard everything, restart from step 1 ─────────
  const handleRetakeAll = useCallback(() => {
    // Revoke all preview URLs
    capturedFiles.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });

    // Reset all state
    setCapturedFiles([]);
    setCompletedSteps({});
    setCurrentStepIdx(0);
    setShowPreview(false);
    setVideoFile(null);
    setIsDetectionReady(false);
    setForceEnabled(false);
    stableStartRef.current = null;
    sessionStartRef.current = Date.now();
    setTimeLeft(SESSION_TIME_LIMIT_MS);
    recordedChunksRef.current = [];
    recordingStartedRef.current = false;
    setFacingMode('environment');
    resetAssistant();
    // Camera will restart from the facingMode/showPreview effect
  }, [capturedFiles]);

  // ─── Submit from preview — send all captures to parent ─────────────
  const handleSubmitFromPreview = useCallback(() => {
    onSubmit(capturedFiles, videoFile);
  }, [capturedFiles, videoFile, onSubmit]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      capturedFiles.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Format time ──────────────────────────────────────────────────
  const formatTime = (ms: number) => {
    const secs = Math.ceil(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Render ────────────────────────────────────────────────────────

  // ═══ PREVIEW SCREEN (after all steps captured) ═════════════════════
  if (showPreview) {
    const requiredSteps = STEPS.filter((s) => s.required).map((s) => s.id);
    const allRequiredCaptured = requiredSteps.every((stepId) =>
      capturedFiles.some((f) => f.step === stepId)
    );

    return (
      <div className="agent-live-overlay">
        <div className="agent-live-container preview-mode">
          <div className="agent-live-header">
            <div className="agent-live-header-left">
              <h3>📋 Review Captures</h3>
            </div>
            <div className="agent-live-header-right">
              <button className="camera-close-btn" onClick={handleClose} aria-label="Close">✕</button>
            </div>
          </div>

          <div className="preview-content">
            <p className="preview-subtitle">Review all captured images before submitting. If anything looks incorrect, retake the entire enrollment.</p>

            <div className="preview-grid">
              {STEPS.map((step) => {
                const capture = capturedFiles.find((f) => f.step === step.id);
                return (
                  <div key={step.id} className={`preview-card ${capture ? 'captured' : 'missing'}`}>
                    <div className="preview-card-header">
                      <span>{step.icon} {step.label}</span>
                      {capture ? <span className="preview-status-ok">✅</span> : (
                        step.required
                          ? <span className="preview-status-missing">❌ Missing</span>
                          : <span className="preview-status-skipped">⏭️ Skipped</span>
                      )}
                    </div>
                    {capture?.previewUrl ? (
                      <div className="preview-image-wrapper">
                        <img src={capture.previewUrl} alt={step.label} className="preview-image" />
                        <span className="preview-file-size">
                          {(capture.file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    ) : (
                      <div className="preview-placeholder">
                        <span>{step.required ? '⚠️ Required' : '—'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {videoFile && (
              <div className="preview-video-info">
                🎥 Video Recording: {(videoFile.size / 1024 / 1024).toFixed(1)} MB
              </div>
            )}

            <div className="preview-actions">
              <button
                className="btn btn-primary btn-full preview-submit-btn"
                onClick={handleSubmitFromPreview}
                disabled={!allRequiredCaptured}
              >
                {allRequiredCaptured ? '✅ Submit Enrollment' : '⚠️ Missing required captures'}
              </button>

              <button
                className="btn btn-outline btn-full preview-retake-btn"
                onClick={handleRetakeAll}
              >
                🔄 Retake All from Beginning
              </button>

              <button
                className="btn btn-outline btn-full preview-discard-btn"
                onClick={handleClose}
              >
                🗑️ Discard & Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══ LIVE CAPTURE VIEWFINDER ═══════════════════════════════════════
  return (
    <div className="agent-live-overlay">
      <div className="agent-live-container">
        {/* Header bar */}
        <div className="agent-live-header">
          <div className="agent-live-header-left">
            <h3>📋 Live Enrollment</h3>
          </div>
          <div className="agent-live-header-right">
            <span className={`timer-badge ${timeLeft < 30000 ? 'timer-warning' : ''}`}>
              ⏱️ {formatTime(timeLeft)}
            </span>
            <button className="camera-close-btn" onClick={handleClose} aria-label="Close">✕</button>
          </div>
        </div>

        {cameraError ? (
          <div className="camera-error" style={{ padding: '2rem', textAlign: 'center' }}>
            <p>{cameraError}</p>
            <button className="btn btn-primary" onClick={() => startCamera(facingMode)}>Retry</button>
          </div>
        ) : (
          <>
            {/* Viewfinder with overlay */}
            <div className="agent-live-viewfinder">
              <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
              <canvas ref={overlayRef} className="camera-overlay-canvas" />

              {/* Loading overlay */}
              {anyLoading && (
                <div className="agent-live-loading-overlay">
                  <div className="loading-spinner" />
                  <p>Loading AI models...</p>
                </div>
              )}

              {/* Model error */}
              {modelError && (
                <div className="agent-live-error-overlay">
                  <p>⚠️ {modelError}</p>
                  <p style={{ fontSize: '0.8rem', marginTop: 8 }}>Use ⚡ Force Capture below</p>
                </div>
              )}

              {/* Step checklist overlay (top-left) */}
              <div className="step-checklist-overlay">
                {STEPS.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`step-check-item ${
                      completedSteps[step.id] ? 'step-completed' :
                      idx === currentStepIdx ? 'step-active' : 'step-pending'
                    }`}
                  >
                    <span className="step-check-icon">
                      {completedSteps[step.id] ? '✅' : idx === currentStepIdx ? step.icon : '○'}
                    </span>
                    <span className="step-check-label">{step.label}</span>
                    {!step.required && <span className="step-optional-tag">opt</span>}
                  </div>
                ))}
              </div>

              {/* Suggestion overlay (top-right) */}
              {suggestion && !isHighlighting && (
                <div className="suggestion-overlay">
                  💡 {suggestion}
                </div>
              )}

              {/* Camera switch dialog */}
              {showCameraSwitch && (
                <div className="camera-switch-dialog">
                  <div className="camera-switch-card">
                    <h4>🤳 Switch to Front Camera?</h4>
                    <p>Agent selfie requires the front camera for verification.</p>
                    <div className="camera-switch-actions">
                      <button className="btn btn-primary" onClick={handleSwitchToFront}>
                        📱 Switch to Front
                      </button>
                      <button className="btn btn-outline" onClick={handleKeepRear}>
                        Keep Rear Camera
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom controls */}
            <div className="agent-live-controls">
              {/* Current step info */}
              <div className="agent-live-step-info">
                <span className="current-step-badge">
                  Step {currentStepIdx + 1}/{STEPS.length}: {currentStep.icon} {currentStep.label}
                </span>
                <p className="current-step-hint">{currentStep.hint}</p>
              </div>

              <div className="agent-live-buttons">
                {/* Skip (optional only) */}
                {!currentStep.required && (
                  <button
                    className="btn btn-outline agent-skip-btn"
                    onClick={handleSkip}
                    disabled={isHighlighting}
                  >
                    Skip →
                  </button>
                )}

                {/* Force capture button — appears after 7s without detection */}
                {currentStep.usesModel && forceEnabled && !isDetectionReady && !isHighlighting && (
                  <button
                    className="btn agent-force-btn"
                    onClick={handleForceCapture}
                  >
                    ⚡ Capture
                  </button>
                )}

                {/* Normal capture button */}
                <button
                  className={`agent-capture-btn ${isDetectionReady ? 'ready' : ''}`}
                  onClick={handleCapture}
                  disabled={
                    !isReady || isHighlighting || showCameraSwitch ||
                    (currentStep.usesModel && !isDetectionReady)
                  }
                >
                  <div className="capture-btn-inner">
                    <span className="capture-btn-icon">📸</span>
                  </div>
                </button>

                {/* Camera flip for selfie step */}
                {currentStep.id === 'agent_selfie' && !showCameraSwitch && (
                  <button
                    className="btn btn-outline agent-flip-btn"
                    onClick={() => setFacingMode(f => f === 'environment' ? 'user' : 'environment')}
                  >
                    🔄 Flip
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Utility: crop a bounding box region from video ──────────────────
function cropRegionFromVideo(
  video: HTMLVideoElement,
  box: { x: number; y: number; width: number; height: number },
  filename: string,
  padding = 0.15,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const padX = box.width * padding;
    const padY = box.height * padding;
    const x = Math.max(0, Math.round(box.x - padX));
    const y = Math.max(0, Math.round(box.y - padY));
    const x2 = Math.min(vw, Math.round(box.x + box.width + padX));
    const y2 = Math.min(vh, Math.round(box.y + box.height + padY));
    const cropW = x2 - x;
    const cropH = y2 - y;

    const minSize = 224;
    const scaleFactor = Math.max(1, minSize / Math.min(cropW, cropH));
    const outW = Math.round(cropW * scaleFactor);
    const outH = Math.round(cropH * scaleFactor);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas ctx failed')); return; }

    ctx.drawImage(video, x, y, cropW, cropH, 0, 0, outW, outH);

    canvas.toBlob(
      (blob) => {
        if (blob) resolve(new File([blob], filename, { type: 'image/jpeg' }));
        else reject(new Error('Blob creation failed'));
      },
      'image/jpeg',
      0.92,
    );
  });
}

// ─── Utility: capture full video frame ───────────────────────────────
function captureFullFrame(
  video: HTMLVideoElement,
  filename: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas ctx failed')); return; }

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) resolve(new File([blob], filename, { type: 'image/jpeg' }));
        else reject(new Error('Blob creation failed'));
      },
      'image/jpeg',
      0.88,
    );
  });
}
