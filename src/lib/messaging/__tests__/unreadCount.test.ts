import { vi, describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { countUnreadMessages } from "@/lib/messaging/unreadCount";

/**
 * The unread badge used to be two round trips everywhere it appeared:
 * fetch EVERY conversation id the member has ever been part of, then
 * `.in(conversation_id, ids)`. That list is unbounded and PostgREST puts
 * `.in()` lists in the query string.
 *
 * These tests pin the replacement: ONE request, on `messages`, filtered
 * through an inner-joined `conversations` embed — same number out, half
 * the round trips, and no id list on the wire.
 */

interface Recorded {
    tables: string[];
    select: unknown[][];
    eq: unknown[][];
    neq: unknown[][];
    or: unknown[][];
    in: unknown[][];
}

function makeClient(settled: { count?: number | null; error?: unknown }) {
    const rec: Recorded = { tables: [], select: [], eq: [], neq: [], or: [], in: [] };
    const q: Record<string, unknown> = {};
    const record = (name: keyof Omit<Recorded, "tables">) =>
        vi.fn((...args: unknown[]) => {
            rec[name].push(args);
            return q;
        });
    q.select = record("select");
    q.eq = record("eq");
    q.neq = record("neq");
    q.or = record("or");
    q.in = record("in");
    q.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({
            data: null,
            count: settled.count ?? null,
            error: settled.error ?? null,
        }).then(resolve);

    const client = {
        from: vi.fn((table: string) => {
            rec.tables.push(table);
            return q;
        }),
    } as unknown as SupabaseClient;

    return { client, rec };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("countUnreadMessages", () => {
    it("counts in ONE request against messages — no conversation-id round trip", async () => {
        const { client, rec } = makeClient({ count: 7 });

        expect(await countUnreadMessages(client, "user-1")).toBe(7);

        // One request, and it never reads the conversations table on its own.
        expect(rec.tables).toEqual(["messages"]);
        // The old shape is gone: nothing is passed through `.in()`.
        expect(rec.in).toEqual([]);
    });

    it("asks for a head-only exact count over an inner-joined conversations embed", async () => {
        const { client, rec } = makeClient({ count: 3 });
        await countUnreadMessages(client, "user-1");

        const [columns, options] = rec.select[0] as [string, Record<string, unknown>];
        // The inner join is what scopes messages to the viewer's threads.
        expect(columns).toContain("conversations!inner");
        expect(options).toEqual({ count: "exact", head: true });
    });

    it("keeps the exact predicate the old two-step used: unread, not mine, my thread", async () => {
        const { client, rec } = makeClient({ count: 1 });
        await countUnreadMessages(client, "user-42");

        // is_read = false AND sender_id <> me — index-backed by
        // idx_messages_unread (migration 173).
        expect(rec.eq).toEqual([["is_read", false]]);
        expect(rec.neq).toEqual([["sender_id", "user-42"]]);
        // buyer OR seller, applied to the EMBEDDED table.
        expect(rec.or).toEqual([
            [
                "buyer_id.eq.user-42,seller_id.eq.user-42",
                { referencedTable: "conversations" },
            ],
        ]);
    });

    it("reports zero rather than NaN when the member has no threads", async () => {
        const { client } = makeClient({ count: 0 });
        expect(await countUnreadMessages(client, "user-1")).toBe(0);
    });

    it("reports zero when the count comes back null (error or empty range)", async () => {
        const { client } = makeClient({ count: null, error: { message: "boom" } });
        expect(await countUnreadMessages(client, "user-1")).toBe(0);
    });
});
