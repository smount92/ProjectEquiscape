import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Folder membership — THE module that knows where it lives.
 *
 * Two stores exist (migration 226 explains the history): the
 * horse_collections junction, which is the truth, and the older
 * user_horses.collection_id column, kept as a mirror. Every reader
 * unions the two so a row written by an old path is never lost; every
 * writer updates both so they cannot drift again. Nothing outside this
 * file (and its public sibling, folderMembers.ts) should query either
 * store for membership.
 */

export const FOLDER_ID_CAP = 5000;

/** Order-preserving union of id lists. */
export function unionIds(...lists: ReadonlyArray<ReadonlyArray<string | null | undefined>>): string[] {
    const seen = new Set<string>();
    for (const list of lists) for (const id of list) if (id) seen.add(id);
    return [...seen];
}

/** Every horse in a folder, for its owner (RLS scopes both reads to them). */
export async function folderHorseIds(
    supabase: SupabaseClient,
    ownerId: string,
    collectionId: string,
    cap = FOLDER_ID_CAP,
): Promise<string[]> {
    const [junction, legacy] = await Promise.all([
        supabase.from("horse_collections").select("horse_id").eq("collection_id", collectionId).limit(cap),
        supabase
            .from("user_horses")
            .select("id")
            .eq("owner_id", ownerId)
            .eq("collection_id", collectionId)
            .is("deleted_at", null)
            .limit(cap),
    ]);
    return unionIds(
        ((junction.data ?? []) as { horse_id: string }[]).map((r) => r.horse_id),
        ((legacy.data ?? []) as { id: string }[]).map((r) => r.id),
    );
}

/** Every folder a horse is in. */
export async function horseFolderIds(supabase: SupabaseClient, horseId: string): Promise<string[]> {
    const [junction, legacy] = await Promise.all([
        supabase.from("horse_collections").select("collection_id").eq("horse_id", horseId),
        supabase.from("user_horses").select("collection_id").eq("id", horseId).maybeSingle(),
    ]);
    return unionIds(
        ((junction.data ?? []) as { collection_id: string }[]).map((r) => r.collection_id),
        [(legacy.data as { collection_id: string | null } | null)?.collection_id],
    );
}

/**
 * Put these horses in exactly these folders (replacing what they were
 * in). Callers have already checked the horses are the caller's own.
 */
export async function setHorsesFolders(
    supabase: SupabaseClient,
    horseIds: readonly string[],
    collectionIds: readonly string[],
): Promise<{ error?: string }> {
    if (horseIds.length === 0) return {};
    const { error: delErr } = await supabase.from("horse_collections").delete().in("horse_id", [...horseIds]);
    if (delErr) return { error: delErr.message };
    if (collectionIds.length > 0) {
        const rows = horseIds.flatMap((horse_id) => collectionIds.map((collection_id) => ({ horse_id, collection_id })));
        const { error: insErr } = await supabase.from("horse_collections").insert(rows as never);
        if (insErr) return { error: insErr.message };
    }
    // The mirror: first folder, or none.
    const { error: mirrorErr } = await supabase
        .from("user_horses")
        .update({ collection_id: collectionIds[0] ?? null } as never)
        .in("id", [...horseIds]);
    if (mirrorErr) return { error: mirrorErr.message };
    return {};
}

/** Add one horse to one folder without touching its other folders (new-horse paths). */
export async function addHorseToFolder(
    supabase: SupabaseClient,
    horseId: string,
    collectionId: string,
): Promise<void> {
    await supabase
        .from("horse_collections")
        .upsert({ horse_id: horseId, collection_id: collectionId } as never, { onConflict: "horse_id,collection_id", ignoreDuplicates: true });
}
