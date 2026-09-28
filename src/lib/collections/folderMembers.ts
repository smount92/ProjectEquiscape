import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Which horses are in a folder, for a PUBLIC view of it.
 *
 * Folder membership lives in two places: the horse_collections junction
 * (077, a horse in several folders) and the older user_horses.collection_id
 * column. The owner's own stable reads both; the public profile read only
 * the column, so a folder of 40 horses showed the 15 that happened to
 * have it as their primary folder (member report, 2026-09-28).
 *
 * The junction's row policy is owner-only, so a visitor's client cannot
 * see it. This runs on the SERVICE client and keeps to public, live
 * horses of that owner, which is exactly the set the profile shows anyway.
 */
export const FOLDER_MEMBER_CAP = 1000;

export async function publicFolderHorseIds(
    admin: SupabaseClient,
    ownerId: string,
    collectionId: string,
): Promise<string[]> {
    const [junction, legacy] = await Promise.all([
        admin
            .from("horse_collections")
            .select("horse_id, user_horses!inner(owner_id, visibility, deleted_at)")
            .eq("collection_id", collectionId)
            .eq("user_horses.owner_id", ownerId)
            .eq("user_horses.visibility", "public")
            .is("user_horses.deleted_at", null)
            .limit(FOLDER_MEMBER_CAP),
        admin
            .from("user_horses")
            .select("id")
            .eq("owner_id", ownerId)
            .eq("collection_id", collectionId)
            .eq("visibility", "public")
            .is("deleted_at", null)
            .limit(FOLDER_MEMBER_CAP),
    ]);
    const ids = new Set<string>();
    for (const r of (junction.data ?? []) as { horse_id: string }[]) ids.add(r.horse_id);
    for (const r of (legacy.data ?? []) as { id: string }[]) ids.add(r.id);
    return [...ids];
}
