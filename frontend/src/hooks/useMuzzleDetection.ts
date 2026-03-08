/**
 * useMuzzleDetection — Stage 2: Muzzle detection using ONNX model.
 *
 * The muzzle model (best.onnx / muzzle.onnx) was trained on full-frame images,
 * NOT on cropped cow regions.  Therefore we feed the ENTIRE video frame
 * (resized to 640×640 without letterboxing, matching the Python training pipeline)
 * and parse the YOLOv8 transposed output: [1, 5+C, N] → squeeze+transpose → [N, 5+C].
 *
 * Uses pre-loaded session from useModelPreloader when available.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import * as ort from 'onnxruntime-web';
import { getMuzzleSession, getModelStatus, acquireInferenceLock, releaseInferenceLock } from './useModelPreloader';
import type { CowDetection } from './useCowDetection';

// ─── Types ───────────────────────────────────────────────────────────
export interface MuzzleDetection {
  /** Muzzle box in original video coordinates */
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface MuzzleDetectionState {
  isModelLoading: boolean;
  isModelReady: boolean;
  modelError: string | null;
  muzzleDetection: MuzzleDetection | null;
}

// ─── Constants ───────────────────────────────────────────────────────
const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.35;

// ─── Preprocessing (matches Python: simple resize, NO letterbox) ─────
// The ONNX model expects RGB input (Ultralytics export bakes in BGR→RGB).
// Canvas getImageData gives RGBA, so we take R, G, B channels directly.
function preprocessFullFrame(video: HTMLVideoElement): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Direct resize to 640×640 — same as Python cv2.resize(frame, (640,640))
  ctx.drawImage(video, 0, 0, INPUT_SIZE, INPUT_SIZE);

  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const pixels = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i++) {
    tensor[i] = data[i * 4] / 255;                // R → plane 0
    tensor[pixels + i] = data[i * 4 + 1] / 255;   // G → plane 1
    tensor[2 * pixels + i] = data[i * 4 + 2] / 255; // B → plane 2
  }
  return tensor;
}

/**
 * Parse YOLOv8 muzzle output — matches the Python postprocessing exactly:
 *   predictions = outputs[0]          → shape [1, 5+C, N]
 *   predictions = squeeze(predictions).T  → shape [N, 5+C]
 *   for each row: [cx, cy, w, h, score0, score1, ...]
 *
 * Coordinates are in model space (0..640) and must be scaled back
 * to original video dimensions using videoWidth / INPUT_SIZE.
 */
function parseMuzzleOutput(
  output: Float32Array,
  dims: readonly number[],
  videoWidth: number,
  videoHeight: number,
): MuzzleDetection | null {
  // dims is typically [1, numFields, N] e.g. [1, 5, 8400]
  const numFields = dims.length === 3 ? dims[1] : dims[0];
  const numDets = dims.length === 3 ? dims[2] : dims[1];
  const numClasses = numFields - 4;

  let bestScore = 0;
  let bestBox: MuzzleDetection | null = null;

  for (let i = 0; i < numDets; i++) {
    // Find best class confidence for this detection
    let maxConf = 0;
    for (let c = 0; c < numClasses; c++) {
      const conf = output[(4 + c) * numDets + i];
      if (conf > maxConf) maxConf = conf;
    }
    if (maxConf < CONFIDENCE_THRESHOLD) continue;

    // Read cx, cy, w, h in model space (0..640)
    const cx = output[0 * numDets + i];
    const cy = output[1 * numDets + i];
    const w = output[2 * numDets + i];
    const h = output[3 * numDets + i];

    // Convert to original video coordinates (matches Python: x * frame.shape[1] / INPUT_SIZE)
    const scaleX = videoWidth / INPUT_SIZE;
    const scaleY = videoHeight / INPUT_SIZE;

    const x1 = (cx - w / 2) * scaleX;
    const y1 = (cy - h / 2) * scaleY;
    const bw = w * scaleX;
    const bh = h * scaleY;

    if (maxConf > bestScore) {
      bestScore = maxConf;
      bestBox = {
        x: Math.max(0, x1),
        y: Math.max(0, y1),
        width: Math.min(bw, videoWidth - Math.max(0, x1)),
        height: Math.min(bh, videoHeight - Math.max(0, y1)),
        confidence: maxConf,
      };
    }
  }

  return bestBox;
}

// ─── Hook ────────────────────────────────────────────────────────────
export function useMuzzleDetection(_modelUrl?: string) {
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const busyRef = useRef<boolean>(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mutable ref for rAF loop (same pattern as useCowDetection)
  const muzzleDetectionRef = useRef<MuzzleDetection | null>(null);
  const lastLogTimeRef = useRef<number>(0);

  const [state, setState] = useState<MuzzleDetectionState>({
    isModelLoading: true,
    isModelReady: false,
    modelError: null,
    muzzleDetection: null,
  });

  // Poll for preloaded session from singleton cache
  useEffect(() => {
    const cached = getMuzzleSession();
    if (cached) {
      sessionRef.current = cached;
      setState((s) => ({ ...s, isModelLoading: false, isModelReady: true }));
      return;
    }
    pollRef.current = setInterval(() => {
      const session = getMuzzleSession();
      const status = getModelStatus();
      if (session) {
        sessionRef.current = session;
        setState((s) => ({ ...s, isModelLoading: false, isModelReady: true }));
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (status.muzzleError) {
        setState((s) => ({ ...s, isModelLoading: false, modelError: status.muzzleError }));
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 200);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  /**
   * Detect muzzle in the FULL video frame.
   * The cowBox param is accepted for API compatibility but the model
   * runs on the entire frame (matching its training pipeline).
   * Returns the best muzzle detection or null.
   */
  const detectMuzzle = useCallback(async (
    video: HTMLVideoElement,
    _cowBox?: CowDetection | null,
  ): Promise<MuzzleDetection | null> => {
    // Prefer sessionRef, fall back to singleton cache
    const session = sessionRef.current || getMuzzleSession();
    if (!session || video.readyState < 2) return null;
    if (busyRef.current) return null; // skip if previous muzzle inference still running

    // Acquire global ONNX inference lock — WASM backend can only run one
    // session.run() at a time across ALL sessions (cow + muzzle share it).
    if (!acquireInferenceLock()) return null;
    busyRef.current = true;

    if (!sessionRef.current) sessionRef.current = session;

    try {
      const tensor = preprocessFullFrame(video);
      const inputTensor = new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);
      const inputName = session.inputNames[0];
      const results = await session.run({ [inputName]: inputTensor });
      const outputName = session.outputNames[0];
      const outputTensor = results[outputName];
      const outputData = outputTensor.data as Float32Array;
      const dims = outputTensor.dims;

      // ── DEBUG: log every ~2 seconds ──
      const now = performance.now();
      if (now - lastLogTimeRef.current > 2000) {
        lastLogTimeRef.current = now;

        // Find max confidence across all detections to see if model finds anything
        const numFields = dims.length === 3 ? dims[1] as number : dims[0] as number;
        const numDets = dims.length === 3 ? dims[2] as number : dims[1] as number;
        const numClasses = numFields - 4;
        let globalMax = 0;
        for (let i = 0; i < numDets; i++) {
          for (let c = 0; c < numClasses; c++) {
            const conf = outputData[(4 + c) * numDets + i];
            if (conf > globalMax) globalMax = conf;
          }
        }

        console.log(
          '[MuzzleDetection] dims:', JSON.stringify(Array.from(dims)),
          '| inputNames:', session.inputNames,
          '| outputNames:', session.outputNames,
          '| numFields:', numFields, '| numDets:', numDets,
          '| numClasses:', numClasses,
          '| maxConf(all):', globalMax.toFixed(4),
          '| videoSize:', video.videoWidth, 'x', video.videoHeight,
        );
      }

      const best = parseMuzzleOutput(
        outputData, dims,
        video.videoWidth, video.videoHeight,
      );

      // ── DEBUG: log when we find/lose a muzzle ──
      if (best && !muzzleDetectionRef.current) {
        console.log('[MuzzleDetection] ✅ FOUND muzzle:', best);
      } else if (!best && muzzleDetectionRef.current) {
        console.log('[MuzzleDetection] ❌ Lost muzzle');
      }

      // Update mutable ref (for rAF overlay loop)
      muzzleDetectionRef.current = best;

      // Update React state (for UI)
      setState((s) => ({ ...s, muzzleDetection: best }));
      return best;
    } catch (err) {
      console.warn('[MuzzleDetection] inference error:', err);
      return null;
    } finally {
      busyRef.current = false;
      releaseInferenceLock();
    }
  }, []);

  /** Clear muzzle detection (when moving to next step). */
  const clearMuzzle = useCallback(() => {
    muzzleDetectionRef.current = null;
    setState((s) => ({ ...s, muzzleDetection: null }));
  }, []);

  return {
    ...state,
    detectMuzzle,
    clearMuzzle,
    /** Mutable ref — always has the latest muzzle detection. Use in rAF loops. */
    muzzleDetectionRef,
  };
}
