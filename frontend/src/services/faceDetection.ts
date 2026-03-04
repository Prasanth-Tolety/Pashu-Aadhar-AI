/**
 * Face / muzzle detection service.
 *
 * When an ONNX YOLO model is available (placed at /models/muzzle_detect.onnx)
 * it runs real inference via onnxruntime-web.  Otherwise a canvas-based
 * centre-crop fallback is used so the rest of the pipeline still works.
 */

import * as ort from 'onnxruntime-web';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface DetectionResult {
  detected: boolean;
  box: BoundingBox | null;
  modelUsed: boolean;
}

/** Expected ONNX model input size (standard YOLO) */
const MODEL_INPUT_SIZE = 640;

/** Confidence threshold for YOLO detections */
const CONFIDENCE_THRESHOLD = 0.4;

let session: ort.InferenceSession | null = null;
let modelLoadAttempted = false;

/**
 * Attempt to load the ONNX detection model once.
 */
async function getSession(): Promise<ort.InferenceSession | null> {
  if (session) return session;
  if (modelLoadAttempted) return null;
  modelLoadAttempted = true;
  try {
    session = await ort.InferenceSession.create('/models/muzzle_detect.onnx', {
      executionProviders: ['wasm'],
    });
    return session;
  } catch {
    // Model file not deployed — fall back to centre-crop heuristic.
    return null;
  }
}

/**
 * Pre-process an image for YOLO: resize to 640×640, normalise to [0,1],
 * and convert to NCHW Float32 tensor.
 */
function preprocessForYolo(img: HTMLImageElement): { tensor: ort.Tensor; scaleX: number; scaleY: number } {
  const canvas = document.createElement('canvas');
  canvas.width = MODEL_INPUT_SIZE;
  canvas.height = MODEL_INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const imageData = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const { data } = imageData;

  const floatData = new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
  const channelSize = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
  for (let i = 0; i < channelSize; i++) {
    const off = i * 4;
    floatData[i] = data[off] / 255;                     // R
    floatData[channelSize + i] = data[off + 1] / 255;   // G
    floatData[2 * channelSize + i] = data[off + 2] / 255; // B
  }

  const tensor = new ort.Tensor('float32', floatData, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
  return {
    tensor,
    scaleX: img.naturalWidth / MODEL_INPUT_SIZE,
    scaleY: img.naturalHeight / MODEL_INPUT_SIZE,
  };
}

/**
 * Post-process YOLO output: extract best detection above the confidence
 * threshold and scale back to original image coordinates.
 *
 * Assumes the standard YOLOv8 output shape [1, N, 5+classes] where each
 * row is [cx, cy, w, h, obj_conf, ...class_scores].
 */
function postprocessYolo(
  output: ort.Tensor,
  scaleX: number,
  scaleY: number,
): BoundingBox | null {
  const raw = output.data as Float32Array;
  const dims = output.dims;

  // YOLOv8 outputs shape [1, 5+C, N] — we transpose to iterate detections.
  const numCols = Number(dims[2]); // N detections
  const rowLen = Number(dims[1]);  // 5+C

  let best: BoundingBox | null = null;
  let bestConf = CONFIDENCE_THRESHOLD;

  for (let i = 0; i < numCols; i++) {
    // Confidence = max of class scores (indices 4…rowLen-1)
    let conf = 0;
    for (let c = 4; c < rowLen; c++) {
      const v = raw[c * numCols + i];
      if (v > conf) conf = v;
    }

    if (conf > bestConf) {
      const cx = raw[0 * numCols + i] * scaleX;
      const cy = raw[1 * numCols + i] * scaleY;
      const w = raw[2 * numCols + i] * scaleX;
      const h = raw[3 * numCols + i] * scaleY;
      best = {
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h,
        confidence: conf,
      };
      bestConf = conf;
    }
  }
  return best;
}

/**
 * Centre-crop fallback: returns a box covering the centre 60 % of the image.
 */
function centreCropFallback(img: HTMLImageElement): BoundingBox {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const cropW = w * 0.6;
  const cropH = h * 0.6;
  return {
    x: (w - cropW) / 2,
    y: (h - cropH) / 2,
    width: cropW,
    height: cropH,
    confidence: 0,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for detection'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Detect a face / muzzle region in the given image file.
 */
export async function detectMuzzle(file: File): Promise<DetectionResult> {
  const img = await loadImage(file);
  const sess = await getSession();

  if (sess) {
    const { tensor, scaleX, scaleY } = preprocessForYolo(img);
    const inputName = sess.inputNames[0];
    const feeds: Record<string, ort.Tensor> = { [inputName]: tensor };
    const results = await sess.run(feeds);
    const outputName = sess.outputNames[0];
    const output = results[outputName];
    const box = postprocessYolo(output, scaleX, scaleY);
    URL.revokeObjectURL(img.src);
    return { detected: box !== null, box, modelUsed: true };
  }

  // Fallback: centre crop
  const box = centreCropFallback(img);
  URL.revokeObjectURL(img.src);
  return { detected: true, box, modelUsed: false };
}
