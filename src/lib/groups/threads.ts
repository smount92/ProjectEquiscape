/**
 * Groups forum — pure thread helpers. Kept out of the "use server"
 * action file so they are importable and directly unit-testable.
 */

const DERIVED_TITLE_MAX = 80;

/**
 * Display title for a board thread. Threads created through the forum
 * UI have a stored title; older group posts predate titles, so we
 * derive one from the first line of content at READ time — the stored
 * content is never mutated.
 */
export function deriveThreadTitle(title: string | null | undefined, content: string | null | undefined): string {
    const stored = title?.trim();
    if (stored) return stored;

    const firstLine = (content ?? "").trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
    if (!firstLine) return "Untitled";
    if (firstLine.length <= DERIVED_TITLE_MAX) return firstLine;
    return `${firstLine.slice(0, DERIVED_TITLE_MAX - 1).trimEnd()}…`;
}

/**
 * A thread is unread when it has been bumped since the viewer's last
 * board visit. No group_last_read row (null lastReadAt) = everything
 * is unread — the honest default for a first visit.
 */
export function isThreadUnread(bumpedAt: string, lastReadAt: string | null): boolean {
    if (!lastReadAt) return true;
    return new Date(bumpedAt).getTime() > new Date(lastReadAt).getTime();
}

/**
 * Board ordering: pinned threads first, then most-recently-bumped.
 * The SQL query orders this way already; this comparator is the same
 * rule for client-side re-sorts (e.g. after a pin toggle) and tests.
 */
export function compareBoardThreads(
    a: { isPinned: boolean; lastActivity: string },
    b: { isPinned: boolean; lastActivity: string },
): number {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
}
