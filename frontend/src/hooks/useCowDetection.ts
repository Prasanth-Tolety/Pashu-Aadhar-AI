/**
 * useCowDetection — Stage 1: Cow/livestock detection using ONNX model.
 *
 * Supports both YOLOv8 and YOLOv10 output formats:
 * - YOLOv8: [1, 4+C, N] transposed layout (cx, cy, w, h, class_confs...)
 * - YOLOv10: [1, N, 6] end-to-end NMS (x1, y1, x2, y2, conf, class_id)
 *
 * For COCO models (80 classes), only livestock classes are accepted
 * (cow=19, sheep=20, horse=21) to avoid false positives from other objects.
 *
 * Uses pre-loaded session from useModelPreloader when available.
 * No longer loads the model itself — relies on preloadModels() being called
 * from Enrollment page on mount so models are warm before camera opens.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import * as ort from 'onnxruntime-web';
import { getCowSession, getModelStatus, acquireInferenceLock, releaseInferenceLock } from './useModelPreloader';

// ─── Types ───────────────────────────────────────────────────────────
export interface CowDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface CowDetectionState {
  isModelLoading: boolean;
  isModelReady: boolean;
  modelError: string | null;
  detections: CowDetection[];
  bestDetection: CowDetection | null;
}

// ─── Constants ───────────────────────────────────────────────────────
const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.40;
const IOU_THRESHOLD = 0.45;

// ─── Helpers ─────────────────────────────────────────────────────────
function iou(a: CowDetection, b: CowDetection): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union === 0 ? 0 : inter / union;
}

function nms(dets: CowDetection[]): CowDetection[] {
  const sorted = [...dets].sort((a, b) => b.confidence - a.confidence);
  const result: CowDetection[] = [];
  const suppressed = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    result.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (iou(sorted[i], sorted[j]) > IOU_THRESHOLD) suppressed.add(j);
    }
  }
  return result;
}

/** Preprocess a video frame into an NCHW float32 tensor with letterboxing. */
function preprocessFrame(video: HTMLVideoElement): {
  tensor: Float32Array;
  scale: number;
  offsetX: number;
  offsetY: number;
} {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;

  const scale = Math.min(INPUT_SIZE / video.videoWidth, INPUT_SIZE / video.videoHeight);
  const scaledW = video.videoWidth * scale;
  const scaledH = video.videoHeight * scale;
  const offsetX = (INPUT_SIZE - scaledW) / 2;
  const offsetY = (INPUT_SIZE - scaledH) / 2;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(video, offsetX, offsetY, scaledW, scaledH);

  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const pixels = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i++) {
    tensor[i] = data[i * 4] / 255;
    tensor[pixels + i] = data[i * 4 + 1] / 255;
    tensor[2 * pixels + i] = data[i * 4 + 2] / 255;
  }
  return { tensor, scale, offsetX, offsetY };
}

// COCO livestock class indices we accept as "cow"
const LIVESTOCK_CLASSES = new Set([
  19, // cow
  20, // sheep
  21, // horse
  // Add 17 (cat), 16 (dog) if you want pet support later
]);

/**
 * Detect if the output is YOLOv10 format.
 * YOLOv10 end-to-end: [1, N, 6] where each row = [x1, y1, x2, y2, conf, class_id]
 * YOLOv8 standard:    [1, 4+C, N] where C = classes, N = anchors (8400 typical)
 */
function isYOLOv10Format(dims: readonly number[]): boolean {
  // [1, 300, 6] → YOLOv10 (dim[2] is 6 = x1,y1,x2,y2,conf,cls)
  // [1, 84, 8400] → YOLOv8 (dim[1] = 4+80 classes)
  return dims.length === 3 && dims[2] <= 7 && dims[1] > 7;
}

/**
 * Parse YOLOv10 output: [1, N, 6] → each row is [x1, y1, x2, y2, conf, class_id].
 * Coordinates are in model input space (letterboxed 640×640).
 */
function parseYOLOv10(
  output: Float32Array,
  dims: readonly number[],
  videoWidth: number,
  videoHeight: number,
  scale: number,
  offsetX: number,
  offsetY: number,
): CowDetection[] {
  const numDetections = dims[1]; // e.g. 300
  const stride = dims[2];       // e.g. 6
  const detections: CowDetection[] = [];

  for (let i = 0; i < numDetections; i++) {
    const base = i * stride;
    const conf = output[base + 4];
    const classId = Math.round(output[base + 5]);

    // Filter: only accept livestock classes
    if (conf < CONFIDENCE_THRESHOLD) continue;
    if (!LIVESTOCK_CLASSES.has(classId)) continue;

    // YOLOv10 outputs x1,y1,x2,y2 (top-left, bottom-right) in model space
    const x1 = output[base + 0];
    const y1 = output[base + 1];
    const x2 = output[base + 2];
    const y2 = output[base + 3];

    // Convert from letterboxed model space → original video space
    const x = (x1 - offsetX) / scale;
    const y = (y1 - offsetY) / scale;
    const bw = (x2 - x1) / scale;
    const bh = (y2 - y1) / scale;

    detections.push({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(bw, videoWidth - Math.max(0, x)),
      height: Math.min(bh, videoHeight - Math.max(0, y)),
      confidence: conf,
    });
  }

  return nms(detections);
}

/**
 * Parse YOLOv8 output — supports both single-class and multi-class outputs.
 * Handles output shapes: [1, 5, N] (single-class) or [1, 4+C, N] (multi-class).
 * For multi-class COCO models, only livestock classes are accepted.
 */
function parseYOLOv8(
  output: Float32Array,
  dims: readonly number[],
  videoWidth: number,
  videoHeight: number,
  scale: number,
  offsetX: number,
  offsetY: number,
): CowDetection[] {
  const numFields = dims.length === 3 ? dims[1] : dims[0];
  const numDetections = dims.length === 3 ? dims[2] : dims[1];
  const numClasses = numFields - 4;
  const detections: CowDetection[] = [];

  for (let i = 0; i < numDetections; i++) {
    let maxConf = 0;
    let bestClass = -1;

    for (let c = 0; c < numClasses; c++) {
      const conf = output[(4 + c) * numDetections + i];
      if (conf > maxConf) {
        maxConf = conf;
        bestClass = c;
      }
    }

    if (maxConf < CONFIDENCE_THRESHOLD) continue;

    // For multi-class COCO models, only accept livestock classes
    // For single-class custom cow models (numClasses === 1), accept all
    if (numClasses > 1 && !LIVESTOCK_CLASSES.has(bestClass)) continue;

    const cx = output[0 * numDetections + i];
    const cy = output[1 * numDetections + i];
    const w = output[2 * numDetections + i];
    const h = output[3 * numDetections + i];

    const x = ((cx - w / 2) - offsetX) / scale;
    const y = ((cy - h / 2) - offsetY) / scale;
    const bw = w / scale;
    const bh = h / scale;

    detections.push({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(bw, videoWidth - Math.max(0, x)),
      height: Math.min(bh, videoHeight - Math.max(0, y)),
      confidence: maxConf,
    });
  }

  return nms(detections);
}

/**
 * Parse model output — auto-detects YOLOv10 vs YOLOv8 format.
 */
function parseOutput(
  output: Float32Array,
  dims: readonly number[],
  videoWidth: number,
  videoHeight: number,
  scale: number,
  offsetX: number,
  offsetY: number,
): CowDetection[] {
  if (isYOLOv10Format(dims)) {
    return parseYOLOv10(output, dims, videoWidth, videoHeight, scale, offsetX, offsetY);
  }
  return parseYOLOv8(output, dims, videoWidth, videoHeight, scale, offsetX, offsetY);
}

// ─── Hook ────────────────────────────────────────────────────────────
export function useCowDetection(_modelUrl?: string) {
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const animRef = useRef<number>(0);
  const busyRef = useRef<boolean>(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mutable ref that is updated synchronously — the rAF overlay loop reads
  // this instead of React state so it always has the LATEST detection
  // without waiting for React to re-render.
  const bestDetectionRef = useRef<CowDetection | null>(null);
  const detectionsRef = useRef<CowDetection[]>([]);

  const [state, setState] = useState<CowDetectionState>({
    isModelLoading: true,
    isModelReady: false,
    modelError: null,
    detections: [],
    bestDetection: null,
  });

  // Poll for preloaded session from singleton cache (no self-loading)
  useEffect(() => {
    const cached = getCowSession();
    if (cached) {
      sessionRef.current = cached;
      setState((s) => ({ ...s, isModelLoading: false, isModelReady: true }));
      return;
    }
    pollRef.current = setInterval(() => {
      const session = getCowSession();
      const status = getModelStatus();
      if (session) {
        sessionRef.current = session;
        setState((s) => ({ ...s, isModelLoading: false, isModelReady: true }));
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (status.cowError) {
        setState((s) => ({ ...s, isModelLoading: false, modelError: status.cowError }));
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 200);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  /**
   * Run a single detection pass.  Uses getCowSession() directly from the
   * global singleton so it works even before the 200ms poll has set
   * sessionRef.  The result is stored in a mutable ref AND in React state:
   *   • bestDetectionRef / detectionsRef → for the overlay rAF loop (sync)
   *   • setState → for React-driven UI (buttons, suggestions, etc.)
   */
  const runDetection = useCallback(async (video: HTMLVideoElement) => {
    // Prefer sessionRef (already resolved), fall back to singleton cache
    const session = sessionRef.current || getCowSession();
    if (!session || video.readyState < 2) return;
    if (busyRef.current) return; // skip if previous cow inference still running

    // Acquire global ONNX inference lock — WASM backend can only run one
    // session.run() at a time across ALL sessions.
    if (!acquireInferenceLock()) return;
    busyRef.current = true;

    // Keep sessionRef in sync so future calls avoid the cache lookup
    if (!sessionRef.current) sessionRef.current = session;

    try {
      const { tensor, scale, offsetX, offsetY } = preprocessFrame(video);
      const inputTensor = new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);
      const inputName = session.inputNames[0];
      const results = await session.run({ [inputName]: inputTensor });
      const outputName = session.outputNames[0];
      const outputTensor = results[outputName];
      const outputData = outputTensor.data as Float32Array;
      const dims = outputTensor.dims;

      const dets = parseOutput(
        outputData, dims, video.videoWidth, video.videoHeight,
        scale, offsetX, offsetY,
      );

      const best = dets.length > 0
        ? dets.reduce((a, b) => (a.confidence > b.confidence ? a : b))
        : null;

      // Update MUTABLE refs first — overlay reads these synchronously
      bestDetectionRef.current = best;
      detectionsRef.current = dets;

      // Then update React state (for UI buttons, readiness, etc.)
      setState((s) => ({ ...s, detections: dets, bestDetection: best }));
    } catch {
      // silently skip frame
    } finally {
      busyRef.current = false;
      releaseInferenceLock();
    }
  }, []);

  const startDetection = useCallback((video: HTMLVideoElement) => {
    // Cancel any existing loop first
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
    }
    busyRef.current = false;

    let lastTime = 0;
    const TARGET_FPS = 12; // run detection at ~12 fps to avoid stacking
    const interval = 1000 / TARGET_FPS;

    const loop = (timestamp: number) => {
      animRef.current = requestAnimationFrame(loop);
      if (timestamp - lastTime >= interval) {
        lastTime = timestamp;
        runDetection(video);
      }
    };
    animRef.current = requestAnimationFrame(loop);
  }, [runDetection]);

  const stopDetection = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    animRef.current = 0;
  }, []);

  return {
    ...state,
    startDetection,
    stopDetection,
    runDetection,
    /** Mutable ref — always has the latest detection (no React render delay). Use in rAF loops. */
    bestDetectionRef,
    /** Mutable ref — always has the latest detections array. */
    detectionsRef,
  };
}
