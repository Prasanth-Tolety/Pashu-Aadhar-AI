/**
 * useCowDetection — Stage 1: Cow detection using a custom YOLOv8 ONNX model.
 *
 * Uses pre-loaded session from useModelPreloader when available.
 * No longer loads the model itself — relies on preloadModels() being called
 * from Enrollment page on mount so models are warm before camera opens.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import * as ort from 'onnxruntime-web';
import { getCowSession, getModelStatus } from './useModelPreloader';

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

/**
 * Parse YOLOv8 output — supports both single-class and multi-class outputs.
 * Handles output shapes: [1, 5, N] (single-class) or [1, 4+C, N] (multi-class).
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
  // dims might be [1, 5, 8400] or [1, 84, 8400] etc.
  const numFields = dims.length === 3 ? dims[1] : dims[0];
  const numDetections = dims.length === 3 ? dims[2] : dims[1];
  const detections: CowDetection[] = [];

  for (let i = 0; i < numDetections; i++) {
    // For single class: fields = [cx, cy, w, h, conf]
    // For multi class: fields = [cx, cy, w, h, class0_conf, class1_conf, ...]
    const numClasses = numFields - 4;
    let maxConf = 0;
    for (let c = 0; c < numClasses; c++) {
      const conf = output[(4 + c) * numDetections + i];
      if (conf > maxConf) maxConf = conf;
    }

    if (maxConf < CONFIDENCE_THRESHOLD) continue;

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

// ─── Hook ────────────────────────────────────────────────────────────
export function useCowDetection(_modelUrl?: string) {
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const animRef = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const runDetection = useCallback(async (video: HTMLVideoElement) => {
    const session = sessionRef.current;
    if (!session || video.readyState < 2) return;

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

      setState((s) => ({ ...s, detections: dets, bestDetection: best }));
    } catch {
      // silently skip frame
    }
  }, []);

  const startDetection = useCallback((video: HTMLVideoElement) => {
    let lastTime = 0;
    const TARGET_FPS = 15; // run detection at ~15 fps to save CPU
    const interval = 1000 / TARGET_FPS;

    const loop = (timestamp: number) => {
      if (timestamp - lastTime >= interval) {
        lastTime = timestamp;
        runDetection(video);
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  }, [runDetection]);

  const stopDetection = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    animRef.current = 0;
  }, []);

  return { ...state, startDetection, stopDetection };
}
