/**
 * Given a Supabase Storage public URL for a horse image,
 * return the corresponding _thumb.webp URL.
 * Falls back to the original URL if the path can't be transformed.
 */
export function getThumbUrl(originalUrl: string): string {
    // Replace the file extension with _thumb.webp
    // e.g., .../photo1.webp → .../photo1_thumb.webp
    return originalUrl.replace(/\.[^.]+$/, "_thumb.webp");
}
