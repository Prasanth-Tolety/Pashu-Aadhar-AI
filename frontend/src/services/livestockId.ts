/**
 * Livestock ID generation — ported from backend/shared/utils.ts.
 * Runs entirely in the browser, no network required.
 * Uses crypto.getRandomValues() for better uniqueness guarantees.
 */
export function generateLivestockId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const random = Array.from(buf)
    .map((b) => b.toString(36))
    .join('')
    .substring(0, 6)
    .toUpperCase();
  return `PA-${timestamp}-${random}`;
}
