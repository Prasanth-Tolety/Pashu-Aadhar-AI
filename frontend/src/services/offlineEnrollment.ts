/**
 * Offline enrollment pipeline — orchestrates the full enrollment flow
 * entirely inside the browser, with no network dependency.
 *
 * Pipeline steps:
 *   1. Image quality checks  (blur, exposure, resolution)
 *   2. Face / muzzle detection  (ONNX YOLO or centre-crop fallback)
 *   3. Crop the detected region
 *   4. Generate embedding  (ONNX model or canvas hash fallback)
 *   5. Duplicate detection  (cosine similarity against IndexedDB)
 *   6. Enroll (store in IndexedDB) or return existing match
 */

import { checkImageQuality, QualityResult } from './imageQuality';
import { detectMuzzle, DetectionResult } from './faceDetection';
import { cropRegion } from './cropService';
import { generateEmbedding, Embedding } from './embeddingService';
import { findDuplicate, storeEnrollment } from './enrollmentDb';
import { generateLivestockId } from './livestockId';
import { EnrollmentResponse } from '../types';

export type PipelineStep =
  | 'quality'
  | 'detection'
  | 'cropping'
  | 'embedding'
  | 'matching'
  | 'storing';

export interface PipelineProgress {
  step: PipelineStep;
  message: string;
}

export interface PipelineResult {
  enrollment: EnrollmentResponse;
  quality: QualityResult;
  detection: DetectionResult;
  embedding: Embedding;
}

/**
 * Execute the full offline enrollment pipeline.
 *
 * @param file        The raw image File captured / uploaded by the user.
 * @param onProgress  Optional callback invoked at the start of each step.
 */
export async function runOfflineEnrollment(
  file: File,
  onProgress?: (progress: PipelineProgress) => void,
): Promise<PipelineResult> {
  // ── Step 1: Image quality ─────────────────────────────────────────────
  onProgress?.({ step: 'quality', message: 'Checking image quality…' });
  const quality = await checkImageQuality(file);
  if (!quality.passed) {
    throw new ImageQualityError(quality);
  }

  // ── Step 2: Face / muzzle detection ───────────────────────────────────
  onProgress?.({ step: 'detection', message: 'Detecting muzzle region…' });
  const detection = await detectMuzzle(file);
  if (!detection.detected || !detection.box) {
    throw new Error('No muzzle region detected. Please retake the photo.');
  }

  // ── Step 3: Crop ──────────────────────────────────────────────────────
  onProgress?.({ step: 'cropping', message: 'Cropping muzzle region…' });
  const croppedFile = await cropRegion(file, detection.box);

  // ── Step 4: Embedding ─────────────────────────────────────────────────
  onProgress?.({ step: 'embedding', message: 'Generating biometric embedding…' });
  const embedding = await generateEmbedding(croppedFile);

  // ── Step 5: Duplicate detection ───────────────────────────────────────
  onProgress?.({ step: 'matching', message: 'Searching for duplicates…' });
  const match = await findDuplicate(embedding);

  if (match.found && match.livestock_id) {
    return {
      enrollment: {
        status: 'EXISTING',
        livestock_id: match.livestock_id,
        similarity: match.similarity,
        message: 'Animal already registered in the system',
      },
      quality,
      detection,
      embedding,
    };
  }

  // ── Step 6: Store new enrollment ──────────────────────────────────────
  onProgress?.({ step: 'storing', message: 'Enrolling new animal…' });
  const livestockId = generateLivestockId();
  await storeEnrollment({
    livestock_id: livestockId,
    embedding,
    enrolled_at: new Date().toISOString(),
    imageKey: `offline-${Date.now()}`,
  });

  return {
    enrollment: {
      status: 'NEW',
      livestock_id: livestockId,
      similarity: match.similarity,
      message: 'Animal successfully enrolled',
    },
    quality,
    detection,
    embedding,
  };
}

/**
 * Custom error carrying the quality-check details so the UI can display them.
 */
export class ImageQualityError extends Error {
  quality: QualityResult;
  constructor(quality: QualityResult) {
    super(quality.issues.join('; '));
    this.name = 'ImageQualityError';
    this.quality = quality;
  }
}
