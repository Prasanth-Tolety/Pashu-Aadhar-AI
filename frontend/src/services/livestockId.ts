/**
 * Livestock ID generation — ported from backend/shared/utils.ts.
 * Runs entirely in the browser, no network required.
 */
export function generateLivestockId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PA-${timestamp}-${random}`;
}
