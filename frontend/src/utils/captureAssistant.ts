/**
 * captureAssistant — Real-time quality checks ported from AdvancedRealtimeCaptureAssistant.py
 *
 * Provides frame-level quality scoring: blur, exposure, distance, centering,
 * shadow, motion, frontal orientation, muzzle visibility, and auto-capture stability.
 *
 * All checks work on HTMLVideoElement + bounding boxes without Python/OpenCV.
 */

import type { CowDetection } from '../hooks/useCowDetection';
import type { MuzzleDetection } from '../hooks/useMuzzleDetection';

// ─── Types ───────────────────────────────────────────────────────────
export interface QualityResult {
  /** Overall score (0–150 max) */
  score: number;
  /** Whether quality is high enough for capture */
  approved: boolean;
  /** Human-readable suggestions (empty = perfect) */
  suggestions: string[];
  /** Whether stable long enough for auto-capture */
  autoCapture: boolean;
}

// ─── Thresholds ──────────────────────────────────────────────────────
const APPROVAL_THRESHOLD = 100;
const STABLE_DURATION_MS = 1500;

// ─── State (module-level for stability tracking) ─────────────────────
let approvalStartTime: number | null = null;
let previousGrayData: Uint8ClampedArray | null = null;

export function resetAssistant() {
  approvalStartTime = null;
  previousGrayData = null;
}

// ─── Canvas helpers ──────────────────────────────────────────────────

/** Get grayscale ImageData from a video region. */
function getGray(video: HTMLVideoElement, x = 0, y = 0, w?: number, h?: number): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const vw = w ?? video.videoWidth;
  const vh = h ?? video.videoHeight;
  const canvas = document.createElement('canvas');
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, x, y, vw, vh, 0, 0, vw, vh);
  const { data } = ctx.getImageData(0, 0, vw, vh);

  // Convert to grayscale in-place
  const gray = new Uint8ClampedArray(vw * vh);
  for (let i = 0; i < vw * vh; i++) {
    gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }
  return { data: gray, width: vw, height: vh };
}

/** Compute Laplacian variance (sharpness) from grayscale data. */
function laplacianVariance(gray: Uint8ClampedArray, w: number, h: number): number {
  let sum = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap =
        -gray[(y - 1) * w + x] -
        gray[y * w + (x - 1)] +
        4 * gray[idx] -
        gray[y * w + (x + 1)] -
        gray[(y + 1) * w + x];
      sum += lap * lap;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

// ─── Quality checks (mirrors Python AdvancedRealtimeCaptureAssistant) ─

/** Check if the frame is too blurry. Returns null if OK, or suggestion string. */
function checkBlur(video: HTMLVideoElement): string | null {
  const { data, width, height } = getGray(video);
  const variance = laplacianVariance(data, width, height);
  return variance > 120 ? null : 'Steady — blurry';
}

/** Check exposure balance. */
function checkExposure(video: HTMLVideoElement): string | null {
  const { data } = getGray(video);
  const total = data.length;
  let dark = 0, bright = 0;
  for (let i = 0; i < total; i++) {
    if (data[i] < 30) dark++;
    if (data[i] > 225) bright++;
  }
  if (dark / total > 0.4) return 'Too dark';
  if (bright / total > 0.4) return 'Too bright';
  return null;
}

/** Check cow-to-frame distance (face area ratio). */
function checkDistance(cow: CowDetection, vw: number, vh: number): string | null {
  const faceArea = cow.width * cow.height;
  const frameArea = vw * vh;
  const ratio = faceArea / frameArea;
  if (ratio < 0.08) return 'Move closer';
  if (ratio > 0.5) return 'Move back';
  return null;
}

/** Check if cow is centered in frame. */
function checkCentering(cow: CowDetection, vw: number, vh: number): string | null {
  const cx = cow.x + cow.width / 2;
  const cy = cow.y + cow.height / 2;
  if (Math.abs(cx - vw / 2) > vw * 0.2) return 'Center cattle';
  if (Math.abs(cy - vh / 2) > vh * 0.2) return 'Adjust height';
  return null;
}

/** Check for heavy shadows on the frame. */
function checkShadow(video: HTMLVideoElement): string | null {
  const { data } = getGray(video);
  let darkCount = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < 40) darkCount++;
  }
  return darkCount / data.length > 0.35 ? 'Avoid shadow' : null;
}

/** Check inter-frame motion (too much = blurry). */
function checkMotion(video: HTMLVideoElement): string | null {
  const { data } = getGray(video);
  if (previousGrayData && previousGrayData.length === data.length) {
    let diff = 0;
    for (let i = 0; i < data.length; i++) {
      diff += Math.abs(data[i] - previousGrayData[i]);
    }
    const meanDiff = diff / data.length;
    previousGrayData = data;
    if (meanDiff > 20) return 'Hold steady';
  } else {
    previousGrayData = data;
  }
  return null;
}

/** Check frontal orientation via aspect ratio of the cow box. */
function checkFrontalOrientation(cow: CowDetection): string | null {
  const ratio = cow.width / cow.height;
  if (ratio > 1.4) return 'Face camera';
  return null;
}

/** Check muzzle region texture (bottom-center of cow box). */
function checkMuzzleVisibility(video: HTMLVideoElement, cow: CowDetection): string | null {
  const muzzleX = Math.round(cow.x + cow.width * 0.25);
  const muzzleY = Math.round(cow.y + cow.height * 0.55);
  const muzzleW = Math.round(cow.width * 0.5);
  const muzzleH = Math.round(cow.height * 0.45);

  if (muzzleW < 10 || muzzleH < 10) return 'Show muzzle';

  const canvas = document.createElement('canvas');
  canvas.width = muzzleW;
  canvas.height = muzzleH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, muzzleX, muzzleY, muzzleW, muzzleH, 0, 0, muzzleW, muzzleH);
  const { data } = ctx.getImageData(0, 0, muzzleW, muzzleH);

  // Grayscale + Laplacian
  const gray = new Uint8ClampedArray(muzzleW * muzzleH);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }
  const variance = laplacianVariance(gray, muzzleW, muzzleH);
  return variance < 40 ? 'Show muzzle' : null;
}

/** Check if face crop is large enough. */
function checkFaceCrop(cow: CowDetection, vw: number, vh: number): string | null {
  const ratio = (cow.width * cow.height) / (vw * vh);
  return ratio < 0.15 ? 'Closer to face' : null;
}

/** Auto-capture stability: approved for STABLE_DURATION_MS continuously. */
function checkStability(approved: boolean): boolean {
  if (approved) {
    if (approvalStartTime === null) {
      approvalStartTime = performance.now();
    } else if (performance.now() - approvalStartTime >= STABLE_DURATION_MS) {
      return true;
    }
  } else {
    approvalStartTime = null;
  }
  return false;
}

// ─── Main analyzer ───────────────────────────────────────────────────

/**
 * Run all quality checks on the current frame.
 *
 * @param video            – the live video element
 * @param cowDetection     – Stage 1 cow bounding box (or null)
 * @param muzzleDetection  – Stage 2 muzzle bounding box (or null)
 */
export function analyzeFrame(
  video: HTMLVideoElement,
  cowDetection: CowDetection | null,
  muzzleDetection: MuzzleDetection | null,
): QualityResult {
  const suggestions: string[] = [];
  let score = 0;
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // ── No cow detected ──
  if (!cowDetection) {
    approvalStartTime = null;
    return { score: 0, approved: false, suggestions: ['Point at cattle'], autoCapture: false };
  }

  // Cow detected: +20
  score += 20;

  // Distance check: +15
  const distTip = checkDistance(cowDetection, vw, vh);
  if (distTip) suggestions.push(distTip); else score += 15;

  // Centering: +15
  const centerTip = checkCentering(cowDetection, vw, vh);
  if (centerTip) suggestions.push(centerTip); else score += 15;

  // Blur: +15
  const blurTip = checkBlur(video);
  if (blurTip) suggestions.push(blurTip); else score += 15;

  // Exposure: +15
  const exposureTip = checkExposure(video);
  if (exposureTip) suggestions.push(exposureTip); else score += 15;

  // Shadow: +10
  const shadowTip = checkShadow(video);
  if (shadowTip) suggestions.push(shadowTip); else score += 10;

  // Motion: +10
  const motionTip = checkMotion(video);
  if (motionTip) suggestions.push(motionTip); else score += 10;

  // Frontal orientation: +15
  const orientTip = checkFrontalOrientation(cowDetection);
  if (orientTip) suggestions.push(orientTip); else score += 15;

  // Muzzle visibility (heuristic): +10
  const muzzleVisTip = checkMuzzleVisibility(video, cowDetection);
  if (muzzleVisTip) suggestions.push(muzzleVisTip); else score += 10;

  // Muzzle model detection bonus: +20
  if (muzzleDetection && muzzleDetection.confidence > 0.4) {
    score += 20;
  } else {
    suggestions.push('Show muzzle clearly');
  }

  // Face crop: +5
  const faceTip = checkFaceCrop(cowDetection, vw, vh);
  if (faceTip) suggestions.push(faceTip); else score += 5;

  const approved = score >= APPROVAL_THRESHOLD;
  const autoCapture = checkStability(approved);

  return {
    score,
    approved,
    suggestions: suggestions.length > 0 ? suggestions : ['✅ Good to capture!'],
    autoCapture,
  };
}
