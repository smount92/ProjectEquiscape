/**
 * Feed stream assembly — pure.
 *
 * The one feed reads TWO stores: `posts` (the real spine) and the
 * legacy `activity_events` text posts, which stay readable forever
 * but are never written again. Both are chronological, both are
 * cursor-paged on created_at, and the page the reader sees is the
 * chronological merge of the two.
 */

export interface StreamRow {
    id: string;
    createdAt: string;
}

/** Newest-first merge of any number of already-sorted (or unsorted) sources. */
export function mergeByCreatedAtDesc<T extends StreamRow>(...sources: T[][]): T[] {
    const all: T[] = [];
    for (const source of sources) all.push(...source);
    all.sort((a, b) => {
        const delta = Date.parse(b.createdAt) - Date.parse(a.createdAt);
        if (delta !== 0) return delta;
        // Stable tiebreak so identical timestamps page deterministically.
        return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    });
    return all;
}

export interface Page<T> {
    items: T[];
    nextCursor: string | null;
}

/**
 * Cut a merged list down to one page.
 *
 * `nextCursor` is the created_at of the LAST returned row, and the
 * next fetch asks each source for rows strictly older than it. Rows
 * that were fetched but fell past the cut are simply re-fetched next
 * round — wasteful by a few rows, but it can never skip one, which
 * is the failure mode that matters in a feed.
 */
export function takePage<T extends StreamRow>(merged: T[], limit: number, sourceExhausted: boolean): Page<T> {
    if (merged.length === 0) return { items: [], nextCursor: null };
    const items = merged.slice(0, limit);
    const more = merged.length > limit || !sourceExhausted;
    return {
        items,
        nextCursor: more ? items[items.length - 1].createdAt : null,
    };
}

/**
 * Which contextual posts belong in the GLOBAL stream.
 *
 * The rule the owner ratified, stated once so it can be tested:
 * a post reaches the global feed only when it is either
 *   (a) a top-level post with no context at all, or
 *   (b) attached to a horse the whole site can see, or
 *   (c) attached to a group the whole site can see.
 * Everything else — private/unlisted horses, private and restricted
 * groups, group forum channels, studio and help-request threads,
 * event comment threads — stays where it was written.
 *
 * A show-results announcement carries a show_id and nothing else; it
 * is deliberately allowed through as a context-free post.
 */
export interface ContextualRow {
    horseId: string | null;
    groupId: string | null;
    eventId: string | null;
    studioId: string | null;
    helpRequestId: string | null;
    channelId: string | null;
}

/**
 * System/audit notes written onto passport threads (reference-identity
 * changes, transfer expirations) are provenance lines, not shareable
 * content — they stay on the passport but never reach the feed.
 * Matched by their writer's fixed prefixes until migration 166's
 * posts.kind='audit' tag covers them; rows the migration backfills
 * carry the kind and skip the prefix scan entirely.
 */
const AUDIT_PREFIXES = ["📋 Reference identity updated", "⏰ Parked transfer expired"];

export function isAuditNote(content: string | null | undefined, kind?: string | null): boolean {
    if (kind === "audit") return true;
    if (kind && kind !== "user") return false; // tagged non-audit kinds pass
    const text = content ?? "";
    return AUDIT_PREFIXES.some((p) => text.startsWith(p));
}

export function isGloballyVisible(
    row: ContextualRow,
    publicHorseIds: ReadonlySet<string>,
    publicGroupIds: ReadonlySet<string>,
): boolean {
    // Forum-channel posts live inside a group's channel tree, never the feed.
    if (row.channelId) return false;
    // Surfaces with their own home and their own audience.
    if (row.studioId || row.helpRequestId || row.eventId) return false;

    if (row.horseId) {
        // A horse post rides on its horse's visibility. Unknown horse
        // (deleted, private, unlisted, or simply not returned) → out.
        return publicHorseIds.has(row.horseId) && !row.groupId;
    }
    if (row.groupId) {
        return publicGroupIds.has(row.groupId);
    }
    return true;
}
