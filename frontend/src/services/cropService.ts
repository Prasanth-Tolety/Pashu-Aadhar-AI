/**
 * Cropping service — extracts the detected muzzle region from the original
 * image using the Canvas API.  Returns a new File containing the cropped JPEG.
 */

import { BoundingBox } from './faceDetection';

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Crop the given bounding box out of the source image.
 * Adds a small padding (10 %) around the box and clamps to image bounds.
 */
export async function cropRegion(file: File, box: BoundingBox): Promise<File> {
  const img = await loadImage(file);
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  // Add 10 % padding
  const padX = box.width * 0.1;
  const padY = box.height * 0.1;

  const sx = Math.max(0, Math.round(box.x - padX));
  const sy = Math.max(0, Math.round(box.y - padY));
  const sw = Math.min(imgW - sx, Math.round(box.width + padX * 2));
  const sh = Math.min(imgH - sy, Math.round(box.height + padY * 2));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  URL.revokeObjectURL(img.src);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Cropping failed'));
          return;
        }
        resolve(new File([blob], `crop-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  });
}
