/**
 * muzzleCropper — Extracts the muzzle ROI from a video frame and returns it as a File.
 *
 * Used after muzzle detection to crop only the muzzle region (with padding)
 * and send it to S3 for embedding generation.
 */

import type { MuzzleDetection } from '../hooks/useMuzzleDetection';

const PADDING_RATIO = 0.15;   // 15% padding around the muzzle box
const MIN_OUTPUT_SIZE = 224;   // minimum output dimension for embeddings

/**
 * Crop the muzzle region from a video element, returning a JPEG File.
 *
 * @param video     – source video element
 * @param muzzle    – detected muzzle bounding box in video coordinates
 * @param filename  – desired output filename
 * @returns         – a File containing the muzzle ROI JPEG
 */
export function cropMuzzleFromVideo(
  video: HTMLVideoElement,
  muzzle: MuzzleDetection,
  filename = `muzzle-${Date.now()}.jpg`,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Expand with padding
    const padX = muzzle.width * PADDING_RATIO;
    const padY = muzzle.height * PADDING_RATIO;
    const x = Math.max(0, Math.round(muzzle.x - padX));
    const y = Math.max(0, Math.round(muzzle.y - padY));
    const x2 = Math.min(vw, Math.round(muzzle.x + muzzle.width + padX));
    const y2 = Math.min(vh, Math.round(muzzle.y + muzzle.height + padY));
    const cropW = x2 - x;
    const cropH = y2 - y;

    // Output size: at least MIN_OUTPUT_SIZE but maintain aspect ratio
    const scaleFactor = Math.max(1, MIN_OUTPUT_SIZE / Math.min(cropW, cropH));
    const outW = Math.round(cropW * scaleFactor);
    const outH = Math.round(cropH * scaleFactor);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    ctx.drawImage(video, x, y, cropW, cropH, 0, 0, outW, outH);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(new File([blob], filename, { type: 'image/jpeg' }));
        } else {
          reject(new Error('Failed to create muzzle crop blob'));
        }
      },
      'image/jpeg',
      0.92,
    );
  });
}

/**
 * Crop the muzzle region from a File/Blob (for gallery uploads).
 * Uses an Image element to load the file, then crops like the video version.
 */
export function cropMuzzleFromImage(
  imageFile: File,
  muzzle: MuzzleDetection,
  filename = `muzzle-${Date.now()}.jpg`,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;

      const padX = muzzle.width * PADDING_RATIO;
      const padY = muzzle.height * PADDING_RATIO;
      const x = Math.max(0, Math.round(muzzle.x - padX));
      const y = Math.max(0, Math.round(muzzle.y - padY));
      const x2 = Math.min(iw, Math.round(muzzle.x + muzzle.width + padX));
      const y2 = Math.min(ih, Math.round(muzzle.y + muzzle.height + padY));
      const cropW = x2 - x;
      const cropH = y2 - y;

      const scaleFactor = Math.max(1, MIN_OUTPUT_SIZE / Math.min(cropW, cropH));
      const outW = Math.round(cropW * scaleFactor);
      const outH = Math.round(cropH * scaleFactor);

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, x, y, cropW, cropH, 0, 0, outW, outH);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], filename, { type: 'image/jpeg' }));
          } else {
            reject(new Error('Failed to create muzzle crop blob'));
          }
        },
        'image/jpeg',
        0.92,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for muzzle cropping'));
    };

    img.src = url;
  });
}

/**
 * Get a preview data URL of the muzzle crop (for the zoom animation).
 */
export function getMuzzleCropPreview(
  video: HTMLVideoElement,
  muzzle: MuzzleDetection,
): string {
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  const padX = muzzle.width * PADDING_RATIO;
  const padY = muzzle.height * PADDING_RATIO;
  const x = Math.max(0, Math.round(muzzle.x - padX));
  const y = Math.max(0, Math.round(muzzle.y - padY));
  const x2 = Math.min(vw, Math.round(muzzle.x + muzzle.width + padX));
  const y2 = Math.min(vh, Math.round(muzzle.y + muzzle.height + padY));
  const cropW = x2 - x;
  const cropH = y2 - y;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(cropW, 200);
  canvas.height = Math.max(cropH, 200);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, x, y, cropW, cropH, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
