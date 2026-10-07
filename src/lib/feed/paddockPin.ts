/**
 * What "pinned on the Paddock" means — in one place.
 *
 * One `posts.is_pinned` column serves two different pins: a barn's own
 * staff pin a thread to the top of THEIR board (togglePinPost in
 * groups.ts), and a site admin pins an announcement above the Paddock
 * stream (setFeedPostPinned in admin.ts). The Paddock used to read the
 * column raw, so the moment a barn pinned something, that thread sat
 * above everyone's Paddock with a 📌 stamp (member report, 2026-10-07).
 *
 * A Paddock pin is a top-level post with no barn: barn pins stay in
 * the barn. The feed query, the item mapping and the admin action all
 * decide through this one predicate.
 */

export interface PinnableRow {
    is_pinned?: boolean | null;
    group_id?: string | null;
    parent_id?: string | null;
}

export function isPaddockPin(row: PinnableRow): boolean {
    return row.is_pinned === true && !row.group_id && !row.parent_id;
}

/** Why a post cannot be pinned on the Paddock, or null when it can. */
export function paddockPinRefusal(row: PinnableRow): string | null {
    if (row.parent_id) return "Replies can't be pinned — pin the post itself.";
    if (row.group_id) return "Barn posts are pinned from inside the barn, by its own staff.";
    return null;
}
