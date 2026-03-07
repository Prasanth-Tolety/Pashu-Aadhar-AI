/**
 * useModelPreloader — Singleton model preloader.
 *
 * Call `preloadModels()` early (e.g. when Enrollment page mounts).
 * The ONNX sessions are cached globally and reused by
 * useCowDetection / useMuzzleDetection when the camera opens.
 */
import * as ort from 'onnxruntime-web';

const CDN = import.meta.env.VITE_CDN_URL || '';
const COW_MODEL_URL = `${CDN}/models/cow.onnx`;
const MUZZLE_MODEL_URL = `${CDN}/models/muzzle.onnx`;

interface ModelCache {
  cow: ort.InferenceSession | null;
  muzzle: ort.InferenceSession | null;
  cowLoading: boolean;
  muzzleLoading: boolean;
  cowError: string | null;
  muzzleError: string | null;
}

// ─── Global singleton cache ──────────────────────────────────────────
const cache: ModelCache = {
  cow: null,
  muzzle: null,
  cowLoading: false,
  muzzleLoading: false,
  cowError: null,
  muzzleError: null,
};

let preloadPromise: Promise<void> | null = null;

async function loadModel(url: string): Promise<ort.InferenceSession> {
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
  return ort.InferenceSession.create(url, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
}

/**
 * Start loading both models. Safe to call multiple times — only loads once.
 */
export function preloadModels(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    // Load cow model
    if (!cache.cow && !cache.cowLoading) {
      cache.cowLoading = true;
      try {
        cache.cow = await loadModel(COW_MODEL_URL);
      } catch {
        cache.cowError = 'Failed to load cow model';
      } finally {
        cache.cowLoading = false;
      }
    }

    // Load muzzle model
    if (!cache.muzzle && !cache.muzzleLoading) {
      cache.muzzleLoading = true;
      try {
        cache.muzzle = await loadModel(MUZZLE_MODEL_URL);
      } catch {
        cache.muzzleError = 'Failed to load muzzle model';
      } finally {
        cache.muzzleLoading = false;
      }
    }
  })();

  return preloadPromise;
}

/** Get the cached session (may be null if still loading). */
export function getCowSession(): ort.InferenceSession | null {
  return cache.cow;
}

export function getMuzzleSession(): ort.InferenceSession | null {
  return cache.muzzle;
}

export function getModelStatus() {
  return {
    cowReady: !!cache.cow,
    muzzleReady: !!cache.muzzle,
    anyLoading: cache.cowLoading || cache.muzzleLoading,
    cowError: cache.cowError,
    muzzleError: cache.muzzleError,
  };
}
