/** Allowed image file extensions for upload */
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic'] as const;

/** Maximum file size in bytes (10 MB) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Default cosine-similarity threshold used for matching */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

/** OpenSearch connection timeout in milliseconds */
export const OPENSEARCH_CONNECTION_TIMEOUT_MS = 10_000;

/** OpenSearch request timeout in milliseconds */
export const OPENSEARCH_REQUEST_TIMEOUT_MS = 30_000;
