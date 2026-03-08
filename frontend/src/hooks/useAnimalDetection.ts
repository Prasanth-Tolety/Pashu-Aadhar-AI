import { useRef, useState, useCallback, useEffect } from 'react';
import * as ort from 'onnxruntime-web';

// Only cow (COCO class 19) — we focus exclusively on cattle
const ANIMAL_CLASSES: Record<number, string> = {
  19: 'cow',
};

const LIVESTOCK_CLASSES = new Set([19]); // cow only

export interface Detection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  classId: number;
  label: string;
  isLivestock: boolean;
}

export interface MuzzleQuality {
  score: number;           // 0–1 overall quality score
  isSharp: boolean;        // not blurry
  isWellLit: boolean;      // good brightness
  isCentered: boolean;     // muzzle roughly centered in frame
  isMuzzleVisible: boolean;// muzzle crop region is present
  feedback: string;        // human-readable tip
}

export interface DetectionState {
  detections: Detection[];
  isModelLoading: boolean;
  isModelReady: boolean;
  modelError: string | null;
  bestDetection: Detection | null;
  muzzleQuality: MuzzleQuality | null;
}

// YOLOv8 input size
const INPUT_WIDTH = 640;
const INPUT_HEIGHT = 640;
const CONFIDENCE_THRESHOLD = 0.45;
const IOU_THRESHOLD = 0.45;

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union === 0 ? 0 : intersection / union;
}

function nms(detections: Detection[]): Detection[] {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const result: Detection[] = [];
  const suppressed = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    result.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[i].classId === sorted[j].classId && iou(sorted[i], sorted[j]) > IOU_THRESHOLD) {
        suppressed.add(j);
      }
    }
  }
  return result;
}

function preprocessImage(video: HTMLVideoElement): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_WIDTH;
  canvas.height = INPUT_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Letterbox: maintain aspect ratio
  const scale = Math.min(INPUT_WIDTH / video.videoWidth, INPUT_HEIGHT / video.videoHeight);
  const scaledW = video.videoWidth * scale;
  const scaledH = video.videoHeight * scale;
  const offsetX = (INPUT_WIDTH - scaledW) / 2;
  const offsetY = (INPUT_HEIGHT - scaledH) / 2;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, INPUT_WIDTH, INPUT_HEIGHT);
  ctx.drawImage(video, offsetX, offsetY, scaledW, scaledH);

  const imageData = ctx.getImageData(0, 0, INPUT_WIDTH, INPUT_HEIGHT);
  const { data } = imageData;

  // NCHW format, normalized 0-1
  const tensor = new Float32Array(3 * INPUT_WIDTH * INPUT_HEIGHT);
  for (let i = 0; i < INPUT_WIDTH * INPUT_HEIGHT; i++) {
    tensor[i] = data[i * 4] / 255.0;                     // R
    tensor[INPUT_WIDTH * INPUT_HEIGHT + i] = data[i * 4 + 1] / 255.0; // G
    tensor[2 * INPUT_WIDTH * INPUT_HEIGHT + i] = data[i * 4 + 2] / 255.0; // B
  }
  return tensor;
}

/**
 * Analyses a muzzle crop from the detected cow bounding box.
 *
 * Strategy:
 *  - Muzzle is roughly the bottom-40% × center-50% of the cow bounding box
 *  - Sharpness: Laplacian variance on the crop (high variance = sharp)
 *  - Brightness: Average luminance of the crop (too dark / too bright = bad)
 *  - Centering: cow box center close to frame center
 */
function analyzeMuzzleQuality(
  video: HTMLVideoElement,
  det: Detection,
): MuzzleQuality {
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // --- Muzzle crop: bottom 40%, center 50% of cow box ---
  const muzzleX = det.x + det.width * 0.25;
  const muzzleY = det.y + det.height * 0.60;
  const muzzleW = det.width * 0.50;
  const muzzleH = det.height * 0.40;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(muzzleW));
  canvas.height = Math.max(1, Math.round(muzzleH));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, muzzleX, muzzleY, muzzleW, muzzleH, 0, 0, canvas.width, canvas.height);

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = canvas.width * canvas.height;

  let totalLuma = 0;
  const lumas: number[] = [];

  for (let i = 0; i < pixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // BT.601 luminance
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    lumas.push(luma);
    totalLuma += luma;
  }

  const avgLuma = totalLuma / pixels;

  // Laplacian variance for sharpness
  // Sample every pixel (for small crop this is fine)
  let lapVariance = 0;
  const w = canvas.width;
  const h = canvas.height;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap =
        -lumas[(y - 1) * w + x] +
        -lumas[y * w + (x - 1)] +
        4 * lumas[idx] +
        -lumas[y * w + (x + 1)] +
        -lumas[(y + 1) * w + x];
      lapVariance += lap * lap;
    }
  }
  lapVariance /= Math.max(1, (w - 2) * (h - 2));

  // --- Thresholds ---
  const isSharp = lapVariance > 120;           // empirically tuned
  const isWellLit = avgLuma > 60 && avgLuma < 220; // not too dark, not blown out
  const isMuzzleVisible = muzzleW > 30 && muzzleH > 20;

  // Centering: cow center vs frame center (within 35% tolerance)
  const cowCenterX = det.x + det.width / 2;
  const cowCenterY = det.y + det.height / 2;
  const isCentered =
    Math.abs(cowCenterX - vw / 2) < vw * 0.35 &&
    Math.abs(cowCenterY - vh / 2) < vh * 0.35;

  // --- Overall score (0–1) ---
  const score =
    (isSharp ? 0.35 : lapVariance / 120 * 0.35) +
    (isWellLit ? 0.30 : 0) +
    (isCentered ? 0.20 : 0) +
    (isMuzzleVisible ? 0.15 : 0);

  // --- Human feedback (most important issue first) ---
  let feedback = '✅ Good shot!';
  if (!isMuzzleVisible) feedback = '🔍 Move closer to the animal';
  else if (!isWellLit && avgLuma <= 60) feedback = '💡 Too dark — find better lighting';
  else if (!isWellLit && avgLuma >= 220) feedback = '☀️ Too bright — avoid direct sunlight';
  else if (!isSharp) feedback = '📷 Hold steady — image is blurry';
  else if (!isCentered) feedback = '↔️ Center the animal in the frame';

  return { score, isSharp, isWellLit, isCentered, isMuzzleVisible, feedback };
}

function parseOutput(
  output: Float32Array,
  videoWidth: number,
  videoHeight: number
): Detection[] {
  // YOLOv8 output shape: [1, 84, 8400]
  // 84 = 4 (box) + 80 (classes)
  const numDetections = 8400;
  const numClasses = 80;
  const detections: Detection[] = [];

  const scale = Math.min(INPUT_WIDTH / videoWidth, INPUT_HEIGHT / videoHeight);
  const offsetX = (INPUT_WIDTH - videoWidth * scale) / 2;
  const offsetY = (INPUT_HEIGHT - videoHeight * scale) / 2;

  for (let i = 0; i < numDetections; i++) {
    // Find best class
    let maxScore = 0;
    let classId = -1;
    for (let c = 0; c < numClasses; c++) {
      const score = output[(4 + c) * numDetections + i];
      if (score > maxScore) {
        maxScore = score;
        classId = c;
      }
    }

    if (maxScore < CONFIDENCE_THRESHOLD) continue;
    if (!(classId in ANIMAL_CLASSES)) continue;

    // cx, cy, w, h in 640x640 space → convert to video space
    const cx = output[0 * numDetections + i];
    const cy = output[1 * numDetections + i];
    const w = output[2 * numDetections + i];
    const h = output[3 * numDetections + i];

    const x = ((cx - w / 2) - offsetX) / scale;
    const y = ((cy - h / 2) - offsetY) / scale;
    const width = w / scale;
    const height = h / scale;

    detections.push({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(width, videoWidth - x),
      height: Math.min(height, videoHeight - y),
      confidence: maxScore,
      classId,
      label: ANIMAL_CLASSES[classId],
      isLivestock: LIVESTOCK_CLASSES.has(classId),
    });
  }

  return nms(detections);
}

export function useAnimalDetection(modelUrl: string) {
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const animFrameRef = useRef<number>(0);

  const [state, setState] = useState<DetectionState>({
    detections: [],
    isModelLoading: true,
    isModelReady: false,
    modelError: null,
    bestDetection: null,
    muzzleQuality: null,
  });

  // Load model on mount
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
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            isModelLoading: false,
            modelError: 'Failed to load detection model',
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  const runDetection = useCallback(async (video: HTMLVideoElement) => {
    if (!sessionRef.current || video.readyState < 2) return;

    try {
      const input = preprocessImage(video);
      const tensor = new ort.Tensor('float32', input, [1, 3, INPUT_WIDTH, INPUT_HEIGHT]);
      const inputName = sessionRef.current.inputNames[0];
      const results = await sessionRef.current.run({ [inputName]: tensor });
      const outputName = sessionRef.current.outputNames[0];
      const outputData = results[outputName].data as Float32Array;

      const detections = parseOutput(outputData, video.videoWidth, video.videoHeight);
      const livestockDetections = detections.filter((d) => d.isLivestock);

      // Best detection = highest confidence livestock
      const bestDetection =
        livestockDetections.length > 0
          ? livestockDetections.reduce((a, b) => (a.confidence > b.confidence ? a : b))
          : null;

      // Analyse muzzle quality on the best detection
      const muzzleQuality = bestDetection
        ? analyzeMuzzleQuality(video, bestDetection)
        : null;

      setState((s) => ({ ...s, detections, bestDetection, muzzleQuality }));
    } catch {
      // Silently ignore frame errors
    }
  }, []);

  const startDetection = useCallback(
    (video: HTMLVideoElement) => {
      const loop = async () => {
        await runDetection(video);
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    },
    [runDetection]
  );

  const stopDetection = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  return { ...state, startDetection, stopDetection };
}
