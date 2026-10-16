import "server-only";

/**
 * How many contact messages are waiting on the owner: the ONE number the
 * pulse tile and the Mailbox tab badge both show, and the same thing the
 * Mailbox's "Open" filter lists. Open/resolved is the state the owner
 * acts on; read/unread is only a side detail on each card.
 *
 * Before migration 236 there is no status column. A head count carries
 * no error body, so any failure on the status count falls back to the
 * unread count (the old meaning) rather than showing nothing; null only
 * when that cannot be read either.
 *
 * Takes the caller's service-role client; never call it with a member's.
 */
type HeadCount = PromiseLike<{ count: number | null; error: unknown }>;
type CountClient = {
    from: (table: string) => {
        select: (
            columns: string,
            options: { count: "exact"; head: true },
        ) => { eq: (column: string, value: string | boolean) => HeadCount };
    };
};

export async function countOpenContactMessages(admin: unknown): Promise<number | null> {
    const db = admin as CountClient;
    const head = () => db.from("contact_messages").select("id", { count: "exact", head: true });
    const open = await head().eq("status", "open");
    if (!open.error) return open.count ?? 0;
    const unread = await head().eq("is_read", false);
    return unread.error ? null : (unread.count ?? 0);
}
