/**
 * useMuzzleDetection — Stage 2: Muzzle detection within a cow bounding box.
 *
 * Loads `muzzle.onnx` from CDN. Given a cow bounding box from Stage 1,
 * crops the cow region, runs inference, and returns the muzzle bounding box
 * in original video coordinates.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import * as ort from 'onnxruntime-web';
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
const INPUT_SIZE = 640; // muzzle model input (YOLOv8)
const CONFIDENCE_THRESHOLD = 0.35;
const IOU_THRESHOLD = 0.45;
const CROP_PADDING = 0.15; // expand cow box by 15% for context

// ─── Helpers ─────────────────────────────────────────────────────────

function nms(dets: MuzzleDetection[]): MuzzleDetection[] {
  const sorted = [...dets].sort((a, b) => b.confidence - a.confidence);
  const result: MuzzleDetection[] = [];
  const suppressed = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    result.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      const x1 = Math.max(a.x, b.x);
      const y1 = Math.max(a.y, b.y);
      const x2 = Math.min(a.x + a.width, b.x + b.width);
      const y2 = Math.min(a.y + a.height, b.y + b.height);
      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const union = a.width * a.height + b.width * b.height - inter;
      if (union > 0 && inter / union > IOU_THRESHOLD) suppressed.add(j);
    }
  }
  return result;
}

/**
 * Crop the cow region from the video, preprocess to model input size.
 * Returns the tensor and mapping info to convert coordinates back.
 */
function preprocessCrop(
  video: HTMLVideoElement,
  cowBox: CowDetection,
): {
  tensor: Float32Array;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  scale: number;
  offsetX: number;
  offsetY: number;
} | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // Expand cow box with padding
  const padW = cowBox.width * CROP_PADDING;
  const padH = cowBox.height * CROP_PADDING;
  const cropX = Math.max(0, Math.round(cowBox.x - padW));
  const cropY = Math.max(0, Math.round(cowBox.y - padH));
  const cropX2 = Math.min(vw, Math.round(cowBox.x + cowBox.width + padW));
  const cropY2 = Math.min(vh, Math.round(cowBox.y + cowBox.height + padH));
  const cropW = cropX2 - cropX;
  const cropH = cropY2 - cropY;

  if (cropW < 10 || cropH < 10) return null;

  // Draw cow crop onto a canvas, then letterbox to INPUT_SIZE
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = cropW;
  tempCanvas.height = cropH;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  // Letterbox
  const scale = Math.min(INPUT_SIZE / cropW, INPUT_SIZE / cropH);
  const scaledW = cropW * scale;
  const scaledH = cropH * scale;
  const offsetX = (INPUT_SIZE - scaledW) / 2;
  const offsetY = (INPUT_SIZE - scaledH) / 2;

  const inputCanvas = document.createElement('canvas');
  inputCanvas.width = INPUT_SIZE;
  inputCanvas.height = INPUT_SIZE;
  const ctx = inputCanvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(tempCanvas, offsetX, offsetY, scaledW, scaledH);

  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const pixels = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i++) {
    tensor[i] = data[i * 4] / 255;
    tensor[pixels + i] = data[i * 4 + 1] / 255;
    tensor[2 * pixels + i] = data[i * 4 + 2] / 255;
  }

  return { tensor, cropX, cropY, cropW, cropH, scale, offsetX, offsetY };
}

function parseOutput(
  output: Float32Array,
  dims: readonly number[],
  cropX: number,
  cropY: number,
  scale: number,
  offsetX: number,
  offsetY: number,
): MuzzleDetection[] {
  const numFields = dims.length === 3 ? dims[1] : dims[0];
  const numDets = dims.length === 3 ? dims[2] : dims[1];
  const numClasses = numFields - 4;
  const detections: MuzzleDetection[] = [];

  for (let i = 0; i < numDets; i++) {
    let maxConf = 0;
    for (let c = 0; c < numClasses; c++) {
      const conf = output[(4 + c) * numDets + i];
      if (conf > maxConf) maxConf = conf;
    }
    if (maxConf < CONFIDENCE_THRESHOLD) continue;

    const cx = output[0 * numDets + i];
    const cy = output[1 * numDets + i];
    const w = output[2 * numDets + i];
    const h = output[3 * numDets + i];

    // Convert from letterboxed model space → crop space → video space
    const localX = ((cx - w / 2) - offsetX) / scale;
    const localY = ((cy - h / 2) - offsetY) / scale;
    const localW = w / scale;
    const localH = h / scale;

    detections.push({
      x: cropX + localX,
      y: cropY + localY,
      width: localW,
      height: localH,
      confidence: maxConf,
    });
  }

  return nms(detections);
}

// ─── Hook ────────────────────────────────────────────────────────────
export function useMuzzleDetection(modelUrl: string) {
  const sessionRef = useRef<ort.InferenceSession | null>(null);

  const [state, setState] = useState<MuzzleDetectionState>({
    isModelLoading: true,
    isModelReady: false,
    modelError: null,
    muzzleDetection: null,
  });

  // Load model
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
        const session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
        if (!cancelled) {
          sessionRef.current = session;
          setState((s) => ({ ...s, isModelLoading: false, isModelReady: true }));
        }
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, isModelLoading: false, modelError: 'Failed to load muzzle detection model' }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [modelUrl]);

  /**
   * Detect muzzle within a cow bounding box.
   * Call this from the detection loop whenever a cow is detected.
   */
  const detectMuzzle = useCallback(async (
    video: HTMLVideoElement,
    cowBox: CowDetection,
  ): Promise<MuzzleDetection | null> => {
    const session = sessionRef.current;
    if (!session || video.readyState < 2) return null;

    try {
      const prep = preprocessCrop(video, cowBox);
      if (!prep) return null;

      const { tensor, cropX, cropY, scale, offsetX, offsetY } = prep;
      const inputTensor = new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);
      const inputName = session.inputNames[0];
      const results = await session.run({ [inputName]: inputTensor });
      const outputName = session.outputNames[0];
      const outputTensor = results[outputName];
      const outputData = outputTensor.data as Float32Array;

      const dets = parseOutput(
        outputData, outputTensor.dims,
        cropX, cropY, scale, offsetX, offsetY,
      );

      const best = dets.length > 0
        ? dets.reduce((a, b) => (a.confidence > b.confidence ? a : b))
        : null;

      setState((s) => ({ ...s, muzzleDetection: best }));
      return best;
    } catch {
      return null;
    }
  }, []);

  /** Clear muzzle detection (when cow is lost). */
  const clearMuzzle = useCallback(() => {
    setState((s) => ({ ...s, muzzleDetection: null }));
  }, []);

  return { ...state, detectMuzzle, clearMuzzle };
}
