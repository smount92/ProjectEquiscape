/**
 * Storage Utility
 * horse-images bucket is now PUBLIC for reads.
 * No more signed URLs — simple string concatenation for CDN-cacheable URLs.
 * Writes remain restricted via RLS (owner-only upload/delete).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const PUBLIC_BASE = `${SUPABASE_URL}/storage/v1/object/public/horse-images`;

/**
 * Extract the relative file path from a stored image URL or raw path.
 */
export function extractStoragePath(imageUrl: string): string {
  // Strip query params (signed URL tokens) before extracting path
  const cleanUrl = imageUrl.split("?")[0];
  const marker = "horse-images/";
  const idx = cleanUrl.indexOf(marker);
  if (idx !== -1) {
    return cleanUrl.substring(idx + marker.length);
  }
  return cleanUrl;
}

/**
 * Generate a public URL for a single image.
 * No API call needed — pure string concatenation.
 */
export function getPublicImageUrl(imageUrl: string): string {
  const path = extractStoragePath(imageUrl);
  return `${PUBLIC_BASE}/${path}`;
}

/**
 * Batch-generate public URLs for multiple images.
 * Returns a Map from original image_url → public URL.
 * Synchronous — no `await` needed.
 */
export function getPublicImageUrls(imageUrls: string[]): Map<string, string> {
  const urlMap = new Map<string, string>();
  for (const url of imageUrls) {
    urlMap.set(url, getPublicImageUrl(url));
  }
  return urlMap;
}

// ═══════════════════════════════════════════════════════════════
// Friendly Photo URL Helpers
// ═══════════════════════════════════════════════════════════════

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

/**
 * Generate a short, permanent, preview-rich share URL for a horse photo.
 * Example: https://modelhorsehub.com/photo/AbC12xyz
 */
export function getFriendlyPhotoUrl(shortSlug: string): string {
  return `${APP_URL}/photo/${shortSlug}`;
}
