/**
 * Embedding generation and cosine-similarity service.
 *
 * When an ONNX embedding model is available at /models/muzzle_embed.onnx it
 * produces real 128-d embeddings.  Otherwise a lightweight canvas-based hash
 * is used as a placeholder so the full pipeline can still execute offline.
 */

import * as ort from 'onnxruntime-web';

export type Embedding = number[];

/** Expected model input size */
const INPUT_SIZE = 224;
/** Dimensionality of the fallback hash-based embedding */
const HASH_DIM = 128;

let session: ort.InferenceSession | null = null;
let modelLoadAttempted = false;

async function getSession(): Promise<ort.InferenceSession | null> {
  if (session) return session;
  if (modelLoadAttempted) return null;
  modelLoadAttempted = true;
  try {
    session = await ort.InferenceSession.create('/models/muzzle_embed.onnx', {
      executionProviders: ['wasm'],
    });
    return session;
  } catch {
    return null;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for embedding'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Preprocess an image for the embedding model: resize to 224×224, normalise,
 * convert to NCHW Float32.
 */
function preprocess(img: HTMLImageElement): ort.Tensor {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const floatData = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  const cs = INPUT_SIZE * INPUT_SIZE;
  for (let i = 0; i < cs; i++) {
    const off = i * 4;
    floatData[i] = data[off] / 255;
    floatData[cs + i] = data[off + 1] / 255;
    floatData[2 * cs + i] = data[off + 2] / 255;
  }
  return new ort.Tensor('float32', floatData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

/**
 * Fallback: produce a deterministic low-dimensional "hash" from the image
 * pixel data.  Not ML-grade, but keeps the pipeline testable offline.
 */
function fallbackEmbedding(img: HTMLImageElement): Embedding {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  // Downsample into HASH_DIM buckets
  const embedding = new Array<number>(HASH_DIM).fill(0);
  const pixelsPerBucket = Math.floor((size * size) / HASH_DIM);
  for (let b = 0; b < HASH_DIM; b++) {
    let sum = 0;
    for (let p = 0; p < pixelsPerBucket; p++) {
      const idx = (b * pixelsPerBucket + p) * 4;
      sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    embedding[b] = sum / (pixelsPerBucket * 255);
  }

  // L2-normalise
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)) || 1;
  return embedding.map((v) => v / norm);
}

/**
 * Generate an embedding vector for the given (cropped) image file.
 */
export async function generateEmbedding(file: File): Promise<Embedding> {
  const img = await loadImage(file);
  const sess = await getSession();

  if (sess) {
    const tensor = preprocess(img);
    const inputName = sess.inputNames[0];
    const feeds: Record<string, ort.Tensor> = { [inputName]: tensor };
    const results = await sess.run(feeds);
    const outputName = sess.outputNames[0];
    const raw = results[outputName].data as Float32Array;
    URL.revokeObjectURL(img.src);
    return Array.from(raw);
  }

  const emb = fallbackEmbedding(img);
  URL.revokeObjectURL(img.src);
  return emb;
}

/**
 * Cosine similarity between two embeddings (−1 … 1).
 */
export function cosineSimilarity(a: Embedding, b: Embedding): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
