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
                // A barn reply has no group_id of its own (replyToThread
                // doesn't pass one); its thread does.
                { id: "r1", content: "rude", author_id: "u2", parent_id: "t1", group_id: null, hidden_at: null },
                { id: "t1", title: "Show me your bays", content: "…", author_id: "u3", group_id: "g1" },
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
            name: "Buy cheap models here",
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

    it("names each thing the way a notice says it: a title, the start of the words, a horse, an entry", async () => {
        db.on(
            "posts",
            rows([
                { id: "t1", title: "Selling my whole herd", content: "long words", author_id: "u1" },
                { id: "p2", content: "x".repeat(200), author_id: "u1" },
            ]),
        );
        db.on("user_horses", rows([{ id: "h1", custom_name: "Bramble", owner_id: "u1", visibility: "public" }]));
        db.on(
            "show_class_entries",
            rows([{ id: "e1", horse_id: "h1", owner_id: "u2", show_id: "s1", class_id: "c1", status: "entered" }]),
        );
        db.on("show_classes", rows([{ id: "c1", name: "Arabian Mares" }]));
        db.on("messages", rows([{ id: "m1", content: "", sender_id: "u1", kind: "photo" }]));
        const views = await describeReportTargets(client, [
            { targetType: "post", targetId: "t1" },
            { targetType: "post", targetId: "p2" },
            { targetType: "horse", targetId: "h1" },
            { targetType: "show_entry", targetId: "e1" },
            { targetType: "message", targetId: "m1" },
        ]);
        expect(views.get(targetKey("post", "t1"))?.name).toBe("Selling my whole herd");
        expect(views.get(targetKey("post", "p2"))?.name).toHaveLength(60);
        expect(views.get(targetKey("horse", "h1"))?.name).toBe("Bramble");
        expect(views.get(targetKey("show_entry", "e1"))?.name).toBe("Bramble in Arabian Mares");
        expect(views.get(targetKey("message", "m1"))?.name).toBeNull();
    });

    it("tells a moderator's hold from the owner's own choice (235)", async () => {
        db.on(
            "user_horses",
            rows([
                { id: "h1", custom_name: "Held", visibility: "private", moderation_hidden_at: "2026-10-15T00:00:00Z" },
                { id: "h2", custom_name: "Shy", visibility: "private", moderation_hidden_at: null },
            ]),
        );
        db.on(
            "show_class_entries",
            rows([
                { id: "e1", horse_id: "h1", status: "scratched", moderation_scratched_at: "2026-10-15T00:00:00Z" },
                { id: "e2", horse_id: "h2", status: "scratched", moderation_scratched_at: null },
            ]),
        );
        const views = await describeReportTargets(client, [
            { targetType: "horse", targetId: "h1" },
            { targetType: "horse", targetId: "h2" },
            { targetType: "show_entry", targetId: "e1" },
            { targetType: "show_entry", targetId: "e2" },
        ]);
        expect(views.get(targetKey("horse", "h1"))).toMatchObject({
            state: "Made private by the site team",
            takeDownLabel: null,
        });
        // Private by its owner's choice: the owner could make it public
        // again, so it can still be held.
        expect(views.get(targetKey("horse", "h2"))).toMatchObject({
            state: "Private",
            takeDownLabel: "Keep the horse private",
        });
        expect(views.get(targetKey("show_entry", "e1"))).toMatchObject({
            state: "Scratched by the site team",
            takeDownLabel: null,
        });
        expect(views.get(targetKey("show_entry", "e2"))).toMatchObject({
            state: "Scratched",
            takeDownLabel: "Keep it out of this class",
        });
    });
});

describe("takeDownReportedContent", () => {
    it("hides a post with a stamp and says who made it — never deletes the post", async () => {
        db.on("posts", (q) => (q.op === "update" ? { data: [{ id: "p1", author_id: "u1" }], error: null } : OK));
        const result = await takeDownReportedContent(client, "post", "p1", ADMIN);
        expect(result).toEqual({ success: true, ownerId: "u1", withdrawnOffers: [] });
        const [write] = db.writes("posts");
        expect(write.op).toBe("update");
        expect(write.payload).toEqual({ hidden_at: expect.any(String), hidden_by: ADMIN });
        expect(db.queries.some((q) => q.op === "delete" && q.table === "posts")).toBe(false);
    });

    it("clears every notification pointing at a hidden barn thread", async () => {
        db.on("posts", (q) =>
            q.op === "update"
                ? { data: [{ id: "t1", author_id: "u1", parent_id: null, group_id: "g1" }], error: null }
                : OK,
        );
        await takeDownReportedContent(client, "post", "t1", ADMIN);
        const [cleared] = db.writes("notifications");
        expect(cleared.op).toBe("delete");
        expect(db.filter(cleared, "like", "link_url")).toBe("%/thread/t1");
    });

    it("hides only what is still showing; a second take-down closes the report and tells nobody", async () => {
        db.on("posts", (q) => (q.op === "update" ? { data: [], error: null } : { data: { id: "p1" }, error: null }));
        expect(await takeDownReportedContent(client, "post", "p1", ADMIN)).toEqual({
            success: true,
            ownerId: null,
            withdrawnOffers: [],
        });
        expect(db.filter(db.writes("posts")[0], "is", "hidden_at")).toBeNull();
        expect(db.writes("notifications")).toEqual([]);

        db.reset();
        db.on("posts", (q) => (q.op === "update" ? { data: [], error: null } : { data: null, error: null }));
        expect((await takeDownReportedContent(client, "post", "p1", ADMIN)).success).toBe(false);
    });

    it("clears only the notices a hidden reply sent, not the thread's others", async () => {
        db.on("posts", (q) =>
            q.op === "update"
                ? {
                      data: [
                          {
                              id: "r1",
                              author_id: "u2",
                              parent_id: "t1",
                              group_id: null, // as real barn replies are; the thread has it
                              created_at: "2026-10-15T10:00:00.000Z",
                          },
                      ],
                      error: null,
                  }
                : { data: { group_id: "g1" }, error: null },
        );
        await takeDownReportedContent(client, "comment", "r1", ADMIN);
        const [cleared] = db.writes("notifications");
        expect(cleared.op).toBe("delete");
        expect(db.filter(cleared, "like", "link_url")).toBe("%/thread/t1");
        expect(db.filter(cleared, "eq", "actor_id")).toBe("u2");
        expect(db.filter(cleared, "gte", "created_at")).toBe("2026-10-15T10:00:00.000Z");
        expect(db.filter(cleared, "lte", "created_at")).toBe("2026-10-15T10:05:00.000Z");
    });

    it("clears a hidden feed post's notifications by its page", async () => {
        db.on("posts", (q) =>
            q.op === "update"
                ? { data: [{ id: "p1", author_id: "u1", parent_id: null, group_id: null }], error: null }
                : OK,
        );
        await takeDownReportedContent(client, "post", "p1", ADMIN);
        expect(db.filter(db.writes("notifications")[0], "eq", "link_url")).toBe("/feed/p1");
    });

    it("hides Help ID suggestions in their own table", async () => {
        db.on("id_suggestions", (q) => (q.op === "update" ? { data: [{ id: "s1", user_id: "u3" }], error: null } : OK));
        const result = await takeDownReportedContent(client, "id_suggestion", "s1", ADMIN);
        expect(result).toEqual({ success: true, ownerId: "u3", withdrawnOffers: [] });
        expect(db.writes("notifications")).toEqual([]);
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
            withdrawnOffers: [],
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

    describe("a horse", () => {
        const LISTED_HORSE = { id: "h1", owner_id: "u1", trade_status: "For Sale", deleted_at: null };

        it("goes private, its listing ends, and it is stamped so its owner can't undo it (235)", async () => {
            db.on("user_horses", (q) =>
                q.op === "select" ? { data: { ...LISTED_HORSE, moderation_hidden_at: null }, error: null } : OK,
            );
            expect(await takeDownReportedContent(client, "horse", "h1", ADMIN)).toEqual({
                success: true,
                ownerId: "u1",
                withdrawnOffers: [],
            });
            expect(db.writes("user_horses")[0].payload).toEqual({
                visibility: "private",
                trade_status: "Not for Sale",
                moderation_hidden_at: expect.any(String),
                moderation_hidden_by: ADMIN,
            });
        });

        it("still goes private, without the stamp, before 235 is pasted", async () => {
            db.on("user_horses", (q) =>
                q.op === "select"
                    ? { data: LISTED_HORSE, error: null }
                    : (q.payload as Record<string, unknown>).moderation_hidden_at
                      ? { data: null, error: { code: "PGRST204", message: "no moderation_hidden_at" } }
                      : OK,
            );
            const result = await takeDownReportedContent(client, "horse", "h1", ADMIN);
            expect(result.success).toBe(true);
            expect(db.writes("user_horses")[1].payload).toEqual({
                visibility: "private",
                trade_status: "Not for Sale",
            });
        });

        it("withdraws open offers first and returns their buyers", async () => {
            db.on("user_horses", (q) => (q.op === "select" ? { data: LISTED_HORSE, error: null } : OK));
            db.on("transactions", (q) =>
                q.op === "update"
                    ? {
                          data: [
                              { id: "t1", party_b_id: "b1", conversation_id: "c1" },
                              { id: "t2", party_b_id: "b2", conversation_id: null },
                          ],
                          error: null,
                      }
                    : { data: [], error: null },
            );
            const result = await takeDownReportedContent(client, "horse", "h1", ADMIN);
            expect(result).toEqual({
                success: true,
                ownerId: "u1",
                withdrawnOffers: [
                    { buyerId: "b1", conversationId: "c1" },
                    { buyerId: "b2", conversationId: null },
                ],
            });
            const [withdraw] = db.writes("transactions");
            expect(withdraw.payload).toEqual({ status: "cancelled" });
            expect(db.filter(withdraw, "eq", "status")).toBe("offer_made");
            expect(db.filter(withdraw, "eq", "horse_id")).toBe("h1");
            // Offers go before the horse does, so none is accepted in between.
            const order = db.queries.filter((q) => q.op === "update").map((q) => q.table);
            expect(order).toEqual(["transactions", "user_horses"]);
        });

        it("waits for a sale under way to be resolved in the Deal Room", async () => {
            db.on("user_horses", (q) => (q.op === "select" ? { data: LISTED_HORSE, error: null } : OK));
            db.on("transactions", () => ({
                data: [{ id: "t1", status: "pending_payment", conversation_id: "c9" }],
                error: null,
            }));
            const result = await takeDownReportedContent(client, "horse", "h1", ADMIN);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toMatch(/sale that's under way/);
                expect(result.error).toContain("/inbox/c9");
            }
            expect(db.writes("transactions")).toEqual([]);
            expect(db.writes("user_horses")).toEqual([]);
        });

        it("puts the offers back and leaves the horse alone if a sale started in between", async () => {
            db.on("user_horses", (q) => (q.op === "select" ? { data: LISTED_HORSE, error: null } : OK));
            let checks = 0;
            db.on("transactions", (q) =>
                q.op === "update"
                    ? { data: [{ id: "t1", party_b_id: "b1", conversation_id: "c1" }], error: null }
                    : { data: checks++ === 0 ? [] : [{ id: "t2", status: "pending_payment" }], error: null },
            );
            const result = await takeDownReportedContent(client, "horse", "h1", ADMIN);
            expect(result.success).toBe(false);
            const [withdraw, restore] = db.writes("transactions");
            expect(withdraw.payload).toEqual({ status: "cancelled" });
            expect(restore.payload).toEqual({ status: "offer_made" });
            expect(db.filter(restore, "in", "id")).toEqual(["t1"]);
            expect(db.writes("user_horses")).toEqual([]);
        });

        it("treats a horse already held as done: closes the report, tells nobody again", async () => {
            db.on("user_horses", () => ({
                data: { ...LISTED_HORSE, moderation_hidden_at: "2026-10-15T00:00:00Z" },
                error: null,
            }));
            const result = await takeDownReportedContent(client, "horse", "h1", ADMIN);
            expect(result).toEqual({ success: true, ownerId: null, withdrawnOffers: [] });
            expect(db.writes("user_horses")).toEqual([]);
        });

        it("clears a stale Pending Sale too, once no sale is under way", async () => {
            db.on("user_horses", (q) =>
                q.op === "select" ? { data: { ...LISTED_HORSE, trade_status: "Pending Sale" }, error: null } : OK,
            );
            await takeDownReportedContent(client, "horse", "h1", ADMIN);
            expect(db.writes("user_horses")[0].payload).toMatchObject({ trade_status: "Not for Sale" });
        });
    });

    describe("a show entry", () => {
        const ENTRY = { id: "e1", owner_id: "u2", show_id: "s1", status: "entered", moderation_scratched_at: null };

        it("is scratched and stamped, but not once results are published", async () => {
            db.on("show_class_entries", (q) => (q.op === "select" ? { data: ENTRY, error: null } : OK));
            db.on("shows", () => ({ data: { status: "judging" }, error: null }));
            expect(await takeDownReportedContent(client, "show_entry", "e1", ADMIN)).toEqual({
                success: true,
                ownerId: "u2",
                withdrawnOffers: [],
            });
            expect(db.writes("show_class_entries")[0].payload).toEqual({
                status: "scratched",
                note: "Scratched by the site team after a report.",
                moderation_scratched_at: expect.any(String),
            });

            db.reset();
            db.on("show_class_entries", () => ({ data: ENTRY, error: null }));
            db.on("shows", () => ({ data: { status: "completed" }, error: null }));
            const refused = await takeDownReportedContent(client, "show_entry", "e1", ADMIN);
            expect(refused.success).toBe(false);
            if (!refused.success) expect(refused.error).toMatch(/Strike/);
            expect(db.writes("show_class_entries")).toEqual([]);
        });

        it("still scratches, without the stamp, before 235 is pasted", async () => {
            db.on("show_class_entries", (q) =>
                q.op === "select"
                    ? { data: { id: "e1", owner_id: "u2", show_id: "s1", status: "entered" }, error: null }
                    : (q.payload as Record<string, unknown>).moderation_scratched_at
                      ? { data: null, error: { code: "42703", message: "no moderation_scratched_at" } }
                      : OK,
            );
            db.on("shows", () => ({ data: { status: "entries_open" }, error: null }));
            expect((await takeDownReportedContent(client, "show_entry", "e1", ADMIN)).success).toBe(true);
            expect(db.writes("show_class_entries")[1].payload).toEqual({
                status: "scratched",
                note: "Scratched by the site team after a report.",
            });
        });

        it("stamps an entry its owner already scratched, keeping the owner's note", async () => {
            db.on("show_class_entries", (q) =>
                q.op === "select" ? { data: { ...ENTRY, status: "scratched" }, error: null } : OK,
            );
            db.on("shows", () => ({ data: { status: "entries_open" }, error: null }));
            expect((await takeDownReportedContent(client, "show_entry", "e1", ADMIN)).success).toBe(true);
            expect(db.writes("show_class_entries")[0].payload).toEqual({ moderation_scratched_at: expect.any(String) });
        });
    });

    it("sends member reports to suspension instead", async () => {
        const result = await takeDownReportedContent(client, "user", "u1", ADMIN);
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/Members/);
        expect(db.queries).toEqual([]);
    });
});
