/**
 * Storage Utility
 * Since our horse-images bucket is private, we need signed URLs
 * for images to render in the browser.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Extract the relative file path from a stored image URL or raw path.
 */
export function extractStoragePath(imageUrl: string): string {
  const marker = "horse-images/";
  const idx = imageUrl.indexOf(marker);
  if (idx !== -1) {
    return imageUrl.substring(idx + marker.length);
  }
  return imageUrl;
}

/**
 * Generate a signed URL for a single image (1 hour expiry).
 */
export async function getSignedImageUrl(
  supabase: SupabaseClient,
  imageUrl: string
): Promise<string> {
  const path = extractStoragePath(imageUrl);
  const { data } = await supabase.storage
    .from("horse-images")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? imageUrl;
}

/**
 * Batch-generate signed URLs for multiple images.
 * Returns a Map from original image_url -> signed URL.
 */
export async function getSignedImageUrls(
  supabase: SupabaseClient,
  imageUrls: string[]
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  if (imageUrls.length === 0) return urlMap;

  const paths = imageUrls.map(extractStoragePath);
  const { data } = await supabase.storage
    .from("horse-images")
    .createSignedUrls(paths, 3600);

  if (data) {
    data.forEach((item, i) => {
      if (item.signedUrl) {
        urlMap.set(imageUrls[i], item.signedUrl);
      }
    });
  }
  return urlMap;
}
