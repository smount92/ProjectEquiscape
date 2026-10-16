/**
 * Message the host (MHH-026): the message names the show (and the entry,
 * when one is picked), goes through the ordinary inbox thread, and only
 * ever names the sender's own entries.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hostMessageHeading } from "@/lib/shows/hostMessage";

const SHOW_ID = "11111111-1111-4111-8111-111111111111";
const ENTRY_ID = "22222222-2222-4222-8222-222222222222";
const HOST = "host-1";

let viewer: { id: string } | null = { id: "member-1" };
let rows: Record<string, Record<string, unknown> | null> = {};
const filters: Record<string, Record<string, unknown>> = {};

function table(name: string) {
    const seen: Record<string, unknown> = {};
    const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
            seen[col] = val;
            filters[name] = seen;
            return chain;
        },
        maybeSingle: async () => ({ data: rows[name] ?? null, error: null }),
    };
    return chain;
}

vi.mock("@/lib/auth", () => {
    class AuthError extends Error {}
    return {
        AuthError,
        requireAuth: vi.fn(async () => {
            if (!viewer) throw new AuthError("Not authenticated.");
            return { user: viewer, supabase: { from: (name: string) => table(name) } };
        }),
    };
});

const sent: { conversationId: string; content: string }[] = [];
vi.mock("@/app/actions/messaging", () => ({
    createOrFindConversation: vi.fn(async (other: string) => ({
        success: true,
        conversationId: `thread-with-${other}`,
    })),
    sendMessage: vi.fn(async (conversationId: string, content: string) => {
        sent.push({ conversationId, content });
        return { success: true, messageId: "m1" };
    }),
}));

import { messageShowHost } from "@/app/actions/show-host-message";
import { createOrFindConversation } from "@/app/actions/messaging";

describe("hostMessageHeading", () => {
    it("names the show alone", () => {
        expect(hostMessageHeading("Summerween", null)).toBe('About "Summerween":');
    });
    it("names the entry, its number and class", () => {
        expect(
            hostMessageHeading("Summerween", { entryNumber: 12, horseName: "Rojo", className: "Arabian Halter" }),
        ).toBe('About "Summerween", entry #12, Rojo in Arabian Halter:');
    });
    it("leaves out what it doesn't know", () => {
        expect(hostMessageHeading("Summerween", { entryNumber: null, horseName: "Rojo", className: null })).toBe(
            'About "Summerween", Rojo:',
        );
    });
});

describe("messageShowHost", () => {
    beforeEach(() => {
        viewer = { id: "member-1" };
        rows = { shows: { id: SHOW_ID, title: "Summerween", host_id: HOST } };
        sent.length = 0;
        vi.mocked(createOrFindConversation).mockClear();
    });

    it("sends to the host's thread with the show named first", async () => {
        const r = await messageShowHost({ showId: SHOW_ID, message: "  Why was my entry scratched?  " });
        expect(r).toEqual({ success: true, conversationId: `thread-with-${HOST}` });
        expect(createOrFindConversation).toHaveBeenCalledWith(HOST, null);
        expect(sent[0].content).toBe('About "Summerween":\n\nWhy was my entry scratched?');
    });

    it("names the picked entry, looked up among the sender's own", async () => {
        rows.show_class_entries = { id: ENTRY_ID, class_id: "c1", horse_id: "h1", entry_number: 7 };
        rows.user_horses = { custom_name: "Rojo" };
        rows.show_classes = { name: "Arabian Halter" };
        await messageShowHost({ showId: SHOW_ID, entryId: ENTRY_ID, message: "Photo question" });
        expect(filters.show_class_entries).toMatchObject({ id: ENTRY_ID, show_id: SHOW_ID, owner_id: "member-1" });
        expect(sent[0].content).toBe('About "Summerween", entry #7, Rojo in Arabian Halter:\n\nPhoto question');
    });

    it("refuses an entry that isn't the sender's", async () => {
        const r = await messageShowHost({ showId: SHOW_ID, entryId: ENTRY_ID, message: "Hi" });
        expect(r).toEqual({ success: false, error: "That entry isn't one of yours at this show." });
        expect(sent).toEqual([]);
    });

    it("does nothing for the host, a missing show, an empty message or a guest", async () => {
        viewer = { id: HOST };
        expect((await messageShowHost({ showId: SHOW_ID, message: "Hi" })).success).toBe(false);
        viewer = { id: "member-1" };
        rows = {};
        expect((await messageShowHost({ showId: SHOW_ID, message: "Hi" })).success).toBe(false);
        rows = { shows: { id: SHOW_ID, title: "Summerween", host_id: HOST } };
        expect((await messageShowHost({ showId: SHOW_ID, message: "   " })).success).toBe(false);
        viewer = null;
        expect((await messageShowHost({ showId: SHOW_ID, message: "Hi" })).success).toBe(false);
        expect(createOrFindConversation).not.toHaveBeenCalled();
        expect(sent).toEqual([]);
    });
});
