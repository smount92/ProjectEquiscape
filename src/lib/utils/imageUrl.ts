/**
 * Given a Supabase Storage public URL for a horse image,
 * return the corresponding _thumb.webp URL.
 * Falls back to the original URL if the path can't be transformed.
 */
export function getThumbUrl(originalUrl: string): string {
    // Replace the file extension with _thumb.webp
    // e.g., .../photo1.webp → .../photo1_thumb.webp
    // Only the file name is touched: a name without an extension is
    // returned as is rather than having the host's ".co" rewritten.
    const slash = originalUrl.lastIndexOf("/");
    const name = originalUrl.slice(slash + 1);
    if (!/\.[^.]+$/.test(name)) return originalUrl;
    return originalUrl.slice(0, slash + 1) + name.replace(/\.[^.]+$/, "_thumb.webp");
}
