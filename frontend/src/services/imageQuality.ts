/**
 * Image quality checks — blur, exposure, and resolution validation.
 * Uses the Canvas API so everything runs in the browser without a network.
 */

export interface QualityResult {
  passed: boolean;
  blurScore: number;
  brightnessScore: number;
  width: number;
  height: number;
  issues: string[];
}

/** Minimum Laplacian variance to consider the image "sharp enough" */
const BLUR_THRESHOLD = 15;

/** Acceptable mean-brightness range (0–255) */
const MIN_BRIGHTNESS = 40;
const MAX_BRIGHTNESS = 220;

/** Minimum acceptable resolution */
const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

/**
 * Load an image File/Blob into an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get the ImageData from the given image element.
 */
function getImageData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Compute a blur score using a discrete Laplacian convolution.
 * Higher = sharper; lower = blurrier.
 */
function computeBlurScore(data: ImageData): number {
  const { width, height, data: px } = data;
  // Convert to grayscale luminance first
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const off = i * 4;
    gray[i] = 0.299 * px[off] + 0.587 * px[off + 1] + 0.114 * px[off + 2];
  }

  // Apply 3×3 Laplacian kernel [0,1,0; 1,-4,1; 0,1,0]
  let sum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap =
        gray[idx - width] +
        gray[idx - 1] +
        -4 * gray[idx] +
        gray[idx + 1] +
        gray[idx + width];
      sum += lap * lap;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Compute mean brightness (0–255) from the grayscale channel.
 */
function computeBrightness(data: ImageData): number {
  const px = data.data;
  let total = 0;
  const pixelCount = data.width * data.height;
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    total += 0.299 * px[off] + 0.587 * px[off + 1] + 0.114 * px[off + 2];
  }
  return pixelCount > 0 ? total / pixelCount : 0;
}

/**
 * Run all quality checks on the given image File.
 */
export async function checkImageQuality(file: File): Promise<QualityResult> {
  const img = await loadImage(file);
  const imageData = getImageData(img);
  URL.revokeObjectURL(img.src);

  const blurScore = computeBlurScore(imageData);
  const brightnessScore = computeBrightness(imageData);
  const { width, height } = imageData;

  const issues: string[] = [];

  if (blurScore < BLUR_THRESHOLD) {
    issues.push('Image appears blurry — please use a steadier shot');
  }
  if (brightnessScore < MIN_BRIGHTNESS) {
    issues.push('Image is too dark — improve lighting conditions');
  }
  if (brightnessScore > MAX_BRIGHTNESS) {
    issues.push('Image is overexposed — reduce brightness or avoid direct light');
  }
  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    issues.push(`Resolution too low (${width}×${height}). Minimum is ${MIN_WIDTH}×${MIN_HEIGHT}`);
  }

  return {
    passed: issues.length === 0,
    blurScore,
    brightnessScore,
    width,
    height,
    issues,
  };
}
