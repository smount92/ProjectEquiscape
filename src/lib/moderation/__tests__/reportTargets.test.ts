import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeDb, OK, type FakeQuery } from "@/__tests__/mocks/fakeDb";
import { describeReportTargets, excerpt, takeDownReportedContent, targetKey } from "../reportTargets";

const db = fakeDb();
const client = db as unknown as SupabaseClient;
const ADMIN = "admin-1";

/** Answer selects with rows whose id is in the query's `in` list. */
function rows(list: Record<string, unknown>[]) {
    return (q: FakeQuery) => {
        if (q.op !== "select") return OK;
        const ids = db.filter(q, "in", "id") as string[] | undefined;
        return { data: ids ? list.filter((r) => ids.includes(r.id as string)) : list, error: null };
    };
}

beforeEach(() => db.reset());

describe("describeReportTargets", () => {
    it("links a barn reply to its thread and a feed post to its page, with the author", async () => {
        db.on(
            "posts",
            rows([
                { id: "p1", content: "Buy cheap   models\nhere", author_id: "u1", parent_id: null, group_id: null },
                { id: "r1", content: "rude", author_id: "u2", parent_id: "t1", group_id: "g1", hidden_at: null },
            ]),
        );
        db.on("groups", rows([{ id: "g1", slug: "quarter-horse-barn" }]));
        db.on(
            "users",
            rows([
                { id: "u1", alias_name: "SpamBot" },
                { id: "u2", alias_name: "Grumpy" },
            ]),
        );

        const views = await describeReportTargets(client, [
            { targetType: "post", targetId: "p1" },
            { targetType: "comment", targetId: "r1" },
        ]);
        expect(views.get(targetKey("post", "p1"))).toEqual({
            summary: "Buy cheap models here",
            href: "/feed/p1",
            ownerId: "u1",
            ownerAlias: "SpamBot",
            state: null,
            takeDownLabel: "Hide the post",
        });
        expect(views.get(targetKey("comment", "r1"))).toMatchObject({
            href: "/community/groups/quarter-horse-barn/thread/t1",
            ownerAlias: "Grumpy",
            takeDownLabel: "Hide the reply",
        });
    });

    it("shows a private message's words with no link, and a show entry by horse, class and show", async () => {
        db.on("messages", rows([{ id: "m1", content: "pay me outside the site", sender_id: "u1", kind: "chat" }]));
        db.on(
            "show_class_entries",
            rows([{ id: "e1", horse_id: "h1", owner_id: "u2", show_id: "s1", class_id: "c1", status: "entered" }]),
        );
        db.on("user_horses", rows([{ id: "h1", custom_name: "Bramble" }]));
        db.on("shows", rows([{ id: "s1", title: "Autumn Gold", status: "open" }]));
        db.on("show_classes", rows([{ id: "c1", name: "Arabian Mares" }]));

        const views = await describeReportTargets(client, [
            { targetType: "message", targetId: "m1" },
            { targetType: "show_entry", targetId: "e1" },
        ]);
        expect(views.get(targetKey("message", "m1"))).toMatchObject({
            summary: "pay me outside the site",
            href: null,
            takeDownLabel: "Remove the message",
        });
        expect(views.get(targetKey("show_entry", "e1"))).toMatchObject({
            summary: "Bramble in Arabian Mares, Autumn Gold",
            href: "/shows/s1/class/c1",
            takeDownLabel: "Scratch the entry",
        });
    });

    it("says what is already down, and offers no second take-down", async () => {
        db.on("posts", rows([{ id: "p1", content: "x", author_id: "u1", hidden_at: "2026-10-15T00:00:00Z" }]));
        db.on("user_horses", rows([{ id: "h1", custom_name: "Ash", owner_id: "u1", visibility: "private" }]));
        db.on("messages", rows([{ id: "m1", content: "offer", sender_id: "u1", kind: "offer" }]));
        const views = await describeReportTargets(client, [
            { targetType: "post", targetId: "p1" },
            { targetType: "horse", targetId: "h1" },
            { targetType: "message", targetId: "m1" },
            { targetType: "id_request", targetId: "gone" },
        ]);
        expect(views.get(targetKey("post", "p1"))).toMatchObject({ state: "Hidden", takeDownLabel: null });
        expect(views.get(targetKey("horse", "h1"))).toMatchObject({ state: "Private", takeDownLabel: null });
        expect(views.get(targetKey("message", "m1"))).toMatchObject({
            state: "Part of a deal record",
            takeDownLabel: null,
        });
        expect(views.get(targetKey("id_request", "gone"))).toMatchObject({ state: "Gone", href: null });
    });

    it("names a reported member and links to their profile, with no take-down", async () => {
        db.on("users", rows([{ id: "u9", alias_name: "Trouble Maker", is_suspended: false }]));
        const views = await describeReportTargets(client, [{ targetType: "user", targetId: "u9" }]);
        expect(views.get(targetKey("user", "u9"))).toMatchObject({
            summary: "@Trouble Maker",
            href: "/profile/Trouble%20Maker",
            ownerAlias: "Trouble Maker",
            takeDownLabel: null,
        });
    });

    it("keeps excerpts short", () => {
        expect(excerpt("a".repeat(400)).length).toBe(160);
        expect(excerpt(null)).toBe("");
    });
});

describe("takeDownReportedContent", () => {
    it("hides a post with a stamp and says who made it — never deletes", async () => {
        db.on("posts", (q) => (q.op === "update" ? { data: [{ id: "p1", author_id: "u1" }], error: null } : OK));
        const result = await takeDownReportedContent(client, "post", "p1", ADMIN);
        expect(result).toEqual({ success: true, ownerId: "u1" });
        const [write] = db.writes("posts");
        expect(write.op).toBe("update");
        expect(write.payload).toEqual({ hidden_at: expect.any(String), hidden_by: ADMIN });
        expect(db.queries.some((q) => q.op === "delete")).toBe(false);
    });

    it("hides Help ID suggestions in their own table", async () => {
        db.on("id_suggestions", (q) => (q.op === "update" ? { data: [{ id: "s1", user_id: "u3" }], error: null } : OK));
        const result = await takeDownReportedContent(client, "id_suggestion", "s1", ADMIN);
        expect(result).toEqual({ success: true, ownerId: "u3" });
    });

    it("asks for migration 235 when the hide column isn't there yet", async () => {
        db.on("posts", () => ({ data: null, error: { code: "PGRST204", message: "Could not find hidden_at" } }));
        const result = await takeDownReportedContent(client, "comment", "r1", ADMIN);
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/migration 235/);
    });

    it("removes a chat message but refuses a deal-record entry", async () => {
        db.on("messages", (q) =>
            q.op === "select"
                ? {
                      data: {
                          id: "m1",
                          kind: "chat",
                          sender_id: "u1",
                          conversation_id: "c1",
                          created_at: "2026-10-01",
                      },
                      error: null,
                  }
                : OK,
        );
        db.on("conversations", (q) =>
            q.op === "select" ? { data: { last_message_at: "2026-10-01" }, error: null } : OK,
        );
        expect(await takeDownReportedContent(client, "message", "m1", ADMIN)).toEqual({
            success: true,
            ownerId: "u1",
        });
        expect(db.writes("messages")[0].payload).toEqual({ deleted_at: expect.any(String) });
        // It was the last line, so the inbox preview loses its words too.
        expect(db.writes("conversations")[0].payload).toEqual({
            last_message_preview: "Message removed by a moderator",
        });

        db.reset();
        db.on("messages", () => ({ data: { id: "m2", kind: "offer", sender_id: "u1" }, error: null }));
        const refused = await takeDownReportedContent(client, "message", "m2", ADMIN);
        expect(refused.success).toBe(false);
        expect(db.writes("messages")).toEqual([]);
    });

    it("makes a listed horse private and ends the listing", async () => {
        db.on("user_horses", (q) =>
            q.op === "select"
                ? { data: { id: "h1", owner_id: "u1", trade_status: "For Sale", deleted_at: null }, error: null }
                : OK,
        );
        expect(await takeDownReportedContent(client, "horse", "h1", ADMIN)).toEqual({ success: true, ownerId: "u1" });
        expect(db.writes("user_horses")[0].payload).toEqual({ visibility: "private", trade_status: "Not for Sale" });
    });

    it("scratches a show entry, but not once results are published", async () => {
        db.on("show_class_entries", (q) =>
            q.op === "select"
                ? { data: { id: "e1", owner_id: "u2", show_id: "s1", status: "entered" }, error: null }
                : OK,
        );
        db.on("shows", () => ({ data: { status: "judging" }, error: null }));
        expect(await takeDownReportedContent(client, "show_entry", "e1", ADMIN)).toEqual({
            success: true,
            ownerId: "u2",
        });
        expect(db.writes("show_class_entries")[0].payload).toMatchObject({ status: "scratched" });

        db.reset();
        db.on("show_class_entries", () => ({
            data: { id: "e1", owner_id: "u2", show_id: "s1", status: "entered" },
            error: null,
        }));
        db.on("shows", () => ({ data: { status: "completed" }, error: null }));
        const refused = await takeDownReportedContent(client, "show_entry", "e1", ADMIN);
        expect(refused.success).toBe(false);
        if (!refused.success) expect(refused.error).toMatch(/Strike/);
        expect(db.writes("show_class_entries")).toEqual([]);
    });

    it("sends member reports to suspension instead", async () => {
        const result = await takeDownReportedContent(client, "user", "u1", ADMIN);
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/Members/);
        expect(db.queries).toEqual([]);
    });
});
