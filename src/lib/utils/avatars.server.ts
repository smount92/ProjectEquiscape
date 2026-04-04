/**
 * Avatar URL Resolution — Server Only
 * 
 * The `avatars` bucket is PRIVATE — requires signed URLs.
 * These helpers batch-resolve avatar storage paths for server actions.
 * 
 * IMPORTANT: This file imports `@/lib/supabase/server` and MUST only be
 * imported from server components, server actions, or API routes.
 */

import { createClient } from "@/lib/supabase/server";

/**
 * Resolve a single avatar storage path to a signed URL.
 * Returns null if the path is empty/null or already a full URL.
 * MUST be called from a server context (uses server Supabase client).
 */
export async function resolveAvatarUrl(avatarPath: string | null): Promise<string | null> {
  if (!avatarPath) return null;
  // Already a full URL (e.g. from OAuth providers) — return as-is
  if (avatarPath.startsWith("http")) return avatarPath;

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("avatars")
    .createSignedUrl(avatarPath, 3600);
  return data?.signedUrl || null;
}

/**
 * Batch-resolve avatar storage paths to signed URLs.
 * Deduplicates paths to minimize Supabase API calls.
 * Returns a Map from original avatar_url → signed URL.
 * MUST be called from a server context.
 */
export async function resolveAvatarUrls(avatarPaths: (string | null)[]): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  const uniquePaths = [...new Set(avatarPaths.filter((p): p is string => !!p && !p.startsWith("http")))];

  if (uniquePaths.length === 0) {
    // Still map any full URLs that were passed through
    for (const path of avatarPaths) {
      if (path && path.startsWith("http")) {
        urlMap.set(path, path);
      }
    }
    return urlMap;
  }

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("avatars")
    .createSignedUrls(uniquePaths, 3600);

  if (data) {
    for (const item of data) {
      if (item.signedUrl) {
        urlMap.set(item.path!, item.signedUrl);
      }
    }
  }

  // Also map full URLs directly
  for (const path of avatarPaths) {
    if (path && path.startsWith("http")) {
      urlMap.set(path, path);
    }
  }

  return urlMap;
}
