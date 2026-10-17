import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeDb, catalogRow, fakeId, type FakeDb } from "./fakeRegistryDb";

/**
 * Applying and deciding suggestions (src/lib/catalog/suggestionApply.ts).
 *
 * The approver recorded is the reviewer, never the contributor; nobody
 * decides their own suggestion; an artist doesn't approve suggestions
 * about their own pieces; edit-then-approve keeps the member's original
 * and tells them what changed; a moderator's duplicate approval waits for
 * a second look, while the owner's merges at once.
 */

const h = vi.hoisted(() => ({
    db: null as unknown as FakeDb,
    notices: [] as { userId: string; content: string }[],
}));

vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => h.db.client }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/utils/rateLimit", () => ({ checkRateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/registry/alerts", () => ({
    alertOwner: vi.fn(async () => undefined),
    anyActiveModerator: vi.fn(async () => false),
}));
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn(async (n: { userId: string; content: string }) => {
        h.notices.push(n);
    }),
}));

import { applySuggestion, decideSuggestion, editDiff } from "@/lib/catalog/suggestionApply";
import type { RegistryActor } from "@/lib/registry/types";

const OWNER: RegistryActor = { userId: "owner-1", alias: "Owner", role: "owner" };
const MOD: RegistryActor = { userId: "mod-1", alias: "Maple", role: "moderator" };
const MEMBER = "member-1";

let db: FakeDb;

function seedItem(over: Record<string, unknown> = {}) {
    const row = catalogRow(over);
    db.tables.catalog_items.push(row);
    return row;
}

function seedSuggestion(over: Record<string, unknown> = {}) {
    const s = {
        id: fakeId(),
        user_id: MEMBER,
        catalog_item_id: null,
        suggestion_type: "correction",
        field_changes: {},
        reason: "The 2004 catalogue says so.",
        status: "pending",
        admin_notes: null,
        reviewed_by: null,
        ...over,
    };
    db.tables.catalog_suggestions.push(s);
    return s;
}

beforeEach(() => {
    db = createFakeDb();
    h.db = db;
    h.notices.length = 0;
    db.tables = {
        catalog_items: [],
        catalog_changelog: [],
        catalog_suggestions: [],
        registry_actions: [],
        registry_action_rows: [],
        catalog_removed_items: [],
        registry_moderators: [{ user_id: MOD.userId, status: "active" }],
        users: [
            { id: MEMBER, alias_name: "Pat", approved_suggestions_count: 3 },
            { id: MOD.userId, alias_name: "Maple", approved_suggestions_count: 0 },
        ],
        user_badges: [],
        artist_profiles: [],
    };
    db.rpcs.increment_approved_suggestions = ({ target_user_id }) => {
        const u = db.tables.users.find((x) => x.id === target_user_id);
        if (u) u.approved_suggestions_count = Number(u.approved_suggestions_count) + 1;
        return { data: null, error: null };
    };
});

describe("decideSuggestion", () => {
    it("records the reviewer as the approver, the member as the contributor, and the role", async () => {
        const item = seedItem({ attributes: { color_description: "Bay" } });
        const s = seedSuggestion({
            catalog_item_id: item.id,
            field_changes: { color_description: { from: "Bay", to: "Black" } },
        });
        const r = await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" });
        expect(r).toEqual({ success: true, status: "approved" });
        expect(db.tables.catalog_changelog[0]).toMatchObject({
            approved_by: MOD.userId,
            contributed_by: MEMBER,
            contributor_alias: "Pat",
            actor_role: "moderator",
        });
        expect(db.tables.registry_actions[0]).toMatchObject({ kind: "approve", actor_id: MOD.userId });
        expect(db.tables.catalog_suggestions[0]).toMatchObject({
            status: "approved",
            reviewed_by: MOD.userId,
            decided_role: "moderator",
        });
        // Credit to the member.
        expect(db.tables.users[0].approved_suggestions_count).toBe(4);
        expect(h.notices[0]).toMatchObject({ userId: MEMBER });
        expect(h.notices[0].content).toContain("approved by @Maple, Registry moderator");
    });

    it("an auto-applied correction names the curator, as before (MHH-070)", async () => {
        const item = seedItem({ attributes: { color_description: "Bay" } });
        const s = seedSuggestion({
            catalog_item_id: item.id,
            status: "auto_approved",
            field_changes: { color_description: { from: "Bay", to: "Black" } },
        });
        const r = await applySuggestion(s.id, { reviewer: null });
        expect(r.ok).toBe(true);
        expect(db.tables.catalog_changelog[0]).toMatchObject({ approved_by: MEMBER, actor_role: "curator" });
    });

    it("nobody decides their own suggestion", async () => {
        const item = seedItem();
        const s = seedSuggestion({
            user_id: MOD.userId,
            catalog_item_id: item.id,
            field_changes: { title: { from: "Adios", to: "Adios II" } },
        });
        const r = await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" });
        expect(r).toMatchObject({ success: false, code: "forbidden" });
        const rejected = await decideSuggestion(s.id, { reviewer: MOD, verdict: "rejected", note: "no" });
        expect(rejected).toMatchObject({ success: false, code: "forbidden" });
        expect(db.tables.catalog_items[0].title).toBe("Adios");
    });

    it("an artist can't approve a suggestion about their own piece", async () => {
        const item = seedItem({ item_type: "artist_resin", maker: "Sarah Minkiewicz", artist: "Sarah Minkiewicz" });
        db.tables.artist_profiles.push({
            user_id: MOD.userId,
            studio_name: "Minkiewicz Studio",
            also_known_as: ["Sarah Minkiewicz"],
        });
        const s = seedSuggestion({ catalog_item_id: item.id, field_changes: { breed: { from: "", to: "Arabian" } } });
        const r = await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" });
        expect(r).toMatchObject({ success: false, code: "forbidden" });
        if (!r.success) expect(r.error).toMatch(/your own work/);
        // The owner may.
        expect(await decideSuggestion(s.id, { reviewer: OWNER, verdict: "approved" })).toMatchObject({ success: true });
    });

    it("edit-then-approve keeps the member's original and the notice shows what changed", async () => {
        const item = seedItem({ attributes: { color_description: "Bay" } });
        const original = { color_description: { from: "Bay", to: "bay roan" } };
        const s = seedSuggestion({ catalog_item_id: item.id, field_changes: original });
        const edited = { color_description: { from: "Bay", to: "Bay roan, blaze" } };
        const r = await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved", edited });
        expect(r).toMatchObject({ success: true, status: "approved" });
        expect(db.tables.catalog_suggestions[0]).toMatchObject({
            original_field_changes: original,
            field_changes: edited,
        });
        expect((db.tables.catalog_items[0].attributes as Record<string, unknown>).color_description).toBe(
            "Bay roan, blaze",
        );
        expect(h.notices[0].content).toContain("It was edited first: Colour and markings: bay roan → Bay roan, blaze");
    });

    it("a moderator's duplicate approval waits for a second look; the owner's merges at once", async () => {
        const keep = seedItem({ title: "Adios" });
        const dup = seedItem({ title: "Adios (dup)", slug: "adios-dup" });
        db.rpcs.registry_merge = () => ({ data: { moved: 1 }, error: null });
        const s = seedSuggestion({
            suggestion_type: "duplicate",
            catalog_item_id: dup.id,
            field_changes: { duplicate_of: keep.id, duplicate_of_title: "Adios" },
        });

        const byMod = await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" });
        expect(byMod).toEqual({ success: true, status: "awaiting_second_look" });
        expect(db.log.some((l) => l.table === "rpc:registry_merge")).toBe(false);
        expect(db.tables.catalog_suggestions[0].status).toBe("under_review");
        expect(db.tables.registry_actions[0]).toMatchObject({ kind: "merge", status: "awaiting_second_look" });
        // No credit until the merge is confirmed.
        expect(db.tables.users[0].approved_suggestions_count).toBe(3);

        const s2 = seedSuggestion({
            suggestion_type: "duplicate",
            catalog_item_id: dup.id,
            field_changes: { duplicate_of: keep.id, duplicate_of_title: "Adios" },
        });
        const byOwner = await decideSuggestion(s2.id, { reviewer: OWNER, verdict: "approved" });
        expect(byOwner).toEqual({ success: true, status: "approved" });
        expect(db.log.some((l) => l.table === "rpc:registry_merge")).toBe(true);
    });

    it("a refused value sends the suggestion back to the queue with the reason in words", async () => {
        const item = seedItem();
        const s = seedSuggestion({
            catalog_item_id: item.id,
            field_changes: { run_type: { from: "", to: "Limited" } },
        });
        const r = await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" });
        expect(r).toMatchObject({ success: false, requeued: true });
        expect(db.tables.catalog_suggestions[0]).toMatchObject({ status: "pending" });
        expect(String(db.tables.catalog_suggestions[0].admin_notes)).toMatch(/not a run type/);
    });

    it("a rejection carries the reviewer's name and note to the member", async () => {
        const s = seedSuggestion({ catalog_item_id: seedItem().id });
        const r = await decideSuggestion(s.id, { reviewer: MOD, verdict: "rejected", note: "No source given" });
        expect(r).toEqual({ success: true, status: "rejected" });
        expect(db.tables.catalog_suggestions[0]).toMatchObject({ status: "rejected", decided_role: "moderator" });
        expect(h.notices[0].content).toContain("not approved by @Maple, Registry moderator");
        expect(h.notices[0].content).toContain("No source given");
    });

    it("before 242 the decision is stamped without the new columns", async () => {
        db.missingColumns.catalog_suggestions = [
            "decided_role",
            "claimed_by",
            "claimed_until",
            "original_field_changes",
        ];
        db.missingColumns.catalog_changelog = ["actor_role", "action_id"];
        db.missing.add("registry_actions");
        const s = seedSuggestion({
            catalog_item_id: seedItem().id,
            field_changes: { title: { from: "Adios", to: "Adios II" } },
        });
        const r = await decideSuggestion(s.id, { reviewer: OWNER, verdict: "approved" });
        expect(r).toMatchObject({ success: true });
        expect(db.tables.catalog_suggestions[0]).toMatchObject({ status: "approved", reviewed_by: OWNER.userId });
        expect(db.tables.catalog_suggestions[0]).not.toHaveProperty("decided_role");
    });
});

describe("editDiff", () => {
    it("lists only what changed, in labels", () => {
        expect(
            editDiff(
                { title: { from: "A", to: "Adios" }, run_type: { from: "", to: "Special Run" } },
                { title: { from: "A", to: "Adios" }, run_type: { from: "", to: "Web Special" } },
            ),
        ).toBe("Run type: Special Run → Web Special");
    });
});
