import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeDb, catalogRow, fakeId, type FakeDb } from "./fakeRegistryDb";

/**
 * Release 3 review fixes to the Registry engine (write.ts and
 * suggestionApply.ts): a merge runs once and keeps its undo however many
 * people click; Confirm and Decline can't both win; an approval applies
 * once; values are checked whatever their type; claims; the second look's
 * own rules; credit for a member's duplicate report; undo of approved
 * additions and merges; rejections in the History; mold scale edits.
 */

const h = vi.hoisted(() => ({
    db: null as unknown as FakeDb,
    revalidateTag: vi.fn(),
    alertOwner: vi.fn(async () => undefined),
    checkRateLimit: vi.fn(async (endpoint: string) => endpoint.length >= 0),
    notices: [] as { userId: string; content: string }[],
}));

vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => h.db.client }));
vi.mock("next/cache", () => ({ revalidateTag: h.revalidateTag, revalidatePath: vi.fn() }));
vi.mock("@/lib/utils/rateLimit", () => ({ checkRateLimit: h.checkRateLimit }));
vi.mock("@/lib/registry/alerts", () => ({ alertOwner: h.alertOwner, anyActiveModerator: vi.fn(async () => false) }));
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn(async (n: { userId: string; content: string }) => {
        h.notices.push(n);
    }),
}));

import {
    claimSuggestion,
    confirmMerge,
    declineMerge,
    linkCounts,
    releaseSuggestionClaim,
    requestMerge,
    undoAction,
    undoReady,
    updateItem,
    validateChanges,
    type CatalogRow,
} from "@/lib/catalog/write";
import {
    additionDrops,
    applySuggestion,
    decideSuggestion,
    finishMergedSuggestion,
} from "@/lib/catalog/suggestionApply";
import { noteRegistryAction, SPEED_ALARM_PER_HOUR } from "@/lib/registry/limits";
import type { RegistryActor } from "@/lib/registry/types";

const OWNER: RegistryActor = { userId: "owner-1", alias: "Owner", role: "owner" };
const MOD: RegistryActor = { userId: "mod-1", alias: "Maple", role: "moderator" };
const MOD2: RegistryActor = { userId: "mod-2", alias: "Bay", role: "moderator" };
const MEMBER = "member-1";

let db: FakeDb;
type Row = Record<string, unknown>;

function seed(over: Row = {}): CatalogRow {
    const row = catalogRow(over);
    db.tables.catalog_items.push(row);
    return row as unknown as CatalogRow;
}

function seedSuggestion(over: Row = {}) {
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
        reviewed_at: null,
        claimed_by: null,
        claimed_until: null,
        ...over,
    };
    db.tables.catalog_suggestions.push(s);
    return s;
}

const action = (id: string) => db.tables.registry_actions.find((a) => a.id === id)!;
const suggestion = (id: string) => db.tables.catalog_suggestions.find((s) => s.id === id)!;
const P0001 = (message: string, details: string) => ({ data: null, error: { code: "P0001", message, details } });

/**
 * registry_merge as migration 243 writes it, enough to race: the History
 * entry is checked first ("already applied" before "missing"), only a
 * waiting or pending entry runs, the confirmer is stamped inside, and a
 * mold's releases take the kept mold's scale.
 */
function realisticMerge(args: Row) {
    const a = db.tables.registry_actions.find((x) => x.id === args.p_action_id);
    if (!a) return P0001("not_found", "That merge request is not in the history.");
    if (
        a.applied_at ||
        a.status === "applied" ||
        a.status === "undone" ||
        db.tables.catalog_removed_items.some((r) => r.action_id === a.id)
    )
        return P0001("already_applied", "This merge has already been applied.");
    if (a.status !== "awaiting_second_look" && a.status !== "pending")
        return P0001("not_waiting", "This merge is no longer waiting for a second look.");
    const keep = db.tables.catalog_items.find((r) => r.id === args.p_keep);
    const dup = db.tables.catalog_items.find((r) => r.id === args.p_remove);
    if (!keep || !dup) return P0001("missing", "The duplicate no longer exists.");
    let rescaled = 0;
    for (const c of db.tables.catalog_items.filter((r) => r.parent_id === dup.id)) {
        c.parent_id = keep.id;
        if (keep.scale && c.scale !== keep.scale) {
            db.tables.registry_action_rows.push({
                action_id: a.id,
                catalog_item_id: c.id,
                before: { scale: c.scale },
                after: { scale: keep.scale },
            });
            c.scale = keep.scale;
            rescaled++;
        }
    }
    db.tables.catalog_items = db.tables.catalog_items.filter((r) => r.id !== dup.id);
    db.tables.catalog_removed_items.push({ id: fakeId(), action_id: a.id, item_id: dup.id, kind: "merged" });
    if (a.status === "awaiting_second_look") {
        a.second_look_by = args.p_actor;
        a.second_look_at = new Date().toISOString();
    }
    a.status = "applied";
    a.applied_at = new Date().toISOString();
    return { data: { moved: 1, rescaled }, error: null };
}

beforeEach(() => {
    db = createFakeDb();
    h.db = db;
    h.notices.length = 0;
    h.revalidateTag.mockClear();
    h.alertOwner.mockClear();
    h.checkRateLimit.mockReset();
    h.checkRateLimit.mockImplementation(async () => true);
    db.tables = {
        catalog_items: [],
        catalog_changelog: [],
        catalog_suggestions: [],
        registry_actions: [],
        registry_action_rows: [],
        catalog_removed_items: [],
        registry_moderators: [
            { user_id: MOD.userId, status: "active" },
            { user_id: MOD2.userId, status: "active" },
        ],
        users: [
            { id: MEMBER, alias_name: "Pat", approved_suggestions_count: 3 },
            { id: MOD.userId, alias_name: "Maple", approved_suggestions_count: 0 },
            { id: MOD2.userId, alias_name: "Bay", approved_suggestions_count: 0 },
        ],
        user_badges: [],
        artist_profiles: [],
    };
    db.rpcs.registry_merge = realisticMerge;
    db.rpcs.registry_link_counts = () => ({
        data: {
            horses: 0,
            wishlists: 0,
            children: 0,
            id_suggestions: 0,
            pending_suggestions: 0,
            sale_reports: 0,
            price_flags: 0,
        },
        error: null,
    });
    db.rpcs.registry_remove = (args) => {
        db.tables.catalog_items = db.tables.catalog_items.filter((r) => r.id !== args.p_item);
        const a = db.tables.registry_actions.find((x) => x.id === args.p_action_id);
        if (a) Object.assign(a, { status: "applied", applied_at: new Date().toISOString() });
        return { data: { removed_id: "arch-1" }, error: null };
    };
    db.rpcs.registry_unmerge = (args) => {
        const a = db.tables.registry_actions.find((x) => x.id === args.p_action_id);
        if (a) a.status = "undone";
        return { data: { restored: 1, left: 0 }, error: null };
    };
    db.rpcs.increment_approved_suggestions = ({ target_user_id }) => {
        const u = db.tables.users.find((x) => x.id === target_user_id);
        if (u) u.approved_suggestions_count = Number(u.approved_suggestions_count) + 1;
        return { data: null, error: null };
    };
});

async function moderatorMerge(over: { suggestionId?: string } = {}) {
    const keep = seed({ title: "Adios" });
    const dup = seed({ title: "Adios (dup)", slug: "adios-dup" });
    const asked = await requestMerge(MOD, { keepId: keep.id, removeId: dup.id, note: "same mold", ...over });
    if (!asked.success || !asked.actionId) throw new Error("merge request failed");
    return { keep, dup, actionId: asked.actionId };
}

// ══════════════════════════════════════════════════════════════
// 1. A merge runs once and keeps its undo
// ══════════════════════════════════════════════════════════════

describe("confirming a merge twice", () => {
    it("the second confirm is told it already happened; the merge stays applied and undoable", async () => {
        const { actionId } = await moderatorMerge();
        const first = await confirmMerge(MOD2, actionId);
        expect(first).toMatchObject({ success: true, status: "applied" });
        expect(action(actionId)).toMatchObject({ status: "applied", second_look_by: MOD2.userId });

        const again = await confirmMerge(OWNER, actionId);
        expect(again).toMatchObject({ success: false });
        if (!again.success) expect(again.error).toMatch(/already been applied/);
        expect(action(actionId).status).toBe("applied");
        // The second confirm never re-stamps who gave the second look.
        expect(action(actionId).second_look_by).toBe(MOD2.userId);

        const undo = await undoAction(OWNER, actionId, "not the same mold after all");
        expect(undo).toMatchObject({ success: true });
    });

    it("two confirms at the same moment: one merges, the other is told, nothing is marked failed", async () => {
        const { actionId } = await moderatorMerge();
        const [a, b] = await Promise.all([confirmMerge(MOD2, actionId), confirmMerge(OWNER, actionId)]);
        expect([a.success, b.success].sort()).toEqual([false, true]);
        expect(action(actionId).status).toBe("applied");
        expect(db.log.filter((l) => l.table === "registry_actions" && l.op === "update")).not.toContainEqual(
            expect.objectContaining({ payload: { status: "failed" } }),
        );
    });

    it("a deadlock on a second look leaves it waiting, so someone can try again", async () => {
        const { actionId } = await moderatorMerge();
        db.rpcs.registry_merge = () => ({ data: null, error: { code: "40P01", message: "deadlock detected" } });
        const r = await confirmMerge(MOD2, actionId);
        expect(r).toMatchObject({ success: false });
        expect(action(actionId).status).toBe("awaiting_second_look");
    });

    it("marking failed is guarded: it never touches an entry the database already applied", async () => {
        const { actionId } = await moderatorMerge();
        // The merge ran (by someone else) but this confirm read the entry before it did.
        db.rpcs.registry_merge = (args) => {
            realisticMerge(args);
            return P0001("missing", "The duplicate no longer exists.");
        };
        await confirmMerge(MOD2, actionId);
        expect(action(actionId).status).toBe("applied");
    });
});

describe("the owner's merge is recorded as applied only after it ran", () => {
    it("it is pending until registry_merge turns it applied", async () => {
        const keep = seed();
        const dup = seed({ slug: "adios-2" });
        let seenStatus = "";
        db.rpcs.registry_merge = (args) => {
            seenStatus = String(db.tables.registry_actions.find((a) => a.id === args.p_action_id)?.status);
            return realisticMerge(args);
        };
        const r = await requestMerge(OWNER, { keepId: keep.id, removeId: dup.id, note: "dup" });
        expect(r).toMatchObject({ success: true, status: "applied" });
        expect(seenStatus).toBe("pending");
        expect(db.tables.registry_actions[0]).toMatchObject({ status: "applied" });
        expect(db.tables.registry_actions[0].applied_at).toBeTruthy();
    });

    it.each([
        ["a deadlock", { code: "40P01", message: "deadlock detected" }],
        ["a timeout", { code: "57014", message: "canceling statement due to statement timeout" }],
        ["a foreign key", { code: "23503", message: "violates foreign key constraint" }],
        ["an entry gone", { code: "P0001", message: "missing", details: "The duplicate no longer exists." }],
    ])("any refusal (%s) marks it failed, never applied", async (_label, error) => {
        const keep = seed();
        const dup = seed({ slug: "adios-2" });
        db.rpcs.registry_merge = () => ({ data: null, error });
        const r = await requestMerge(OWNER, { keepId: keep.id, removeId: dup.id, note: "dup" });
        expect(r).toMatchObject({ success: false });
        expect(db.tables.registry_actions[0]).toMatchObject({ status: "failed", applied_at: null });
    });
});

// ══════════════════════════════════════════════════════════════
// 2. Confirm and Decline can't both succeed
// ══════════════════════════════════════════════════════════════

describe("confirm and decline", () => {
    it("a decline after the merge was confirmed is refused and changes nothing", async () => {
        const s = seedSuggestion({ suggestion_type: "duplicate", status: "under_review" });
        const { actionId } = await moderatorMerge({ suggestionId: s.id });
        expect((await confirmMerge(MOD2, actionId)).success).toBe(true);
        const d = await declineMerge(OWNER, actionId, "Different paint jobs");
        expect(d).toMatchObject({ success: false });
        if (!d.success) expect(d.error).toMatch(/already been applied/);
        expect(suggestion(s.id).status).toBe("approved");
    });

    it("a decline whose guarded update matches nothing (a confirm won the race) stops there", async () => {
        const s = seedSuggestion({ suggestion_type: "duplicate", status: "under_review" });
        const { actionId } = await moderatorMerge({ suggestionId: s.id });
        db.loseNextUpdate.add("registry_actions");
        const d = await declineMerge(MOD2, actionId, "Different paint jobs");
        expect(d).toMatchObject({ success: false });
        // The report is left alone, not sent back to pending.
        expect(suggestion(s.id).status).toBe("under_review");
        expect(h.notices).toHaveLength(0);
    });

    it("the decline's suggestion update only moves a report still under review", async () => {
        const s = seedSuggestion({ suggestion_type: "duplicate", status: "under_review" });
        const { actionId } = await moderatorMerge({ suggestionId: s.id });
        suggestion(s.id).status = "rejected"; // decided some other way meanwhile
        expect((await declineMerge(MOD2, actionId, "Different paint jobs")).success).toBe(true);
        expect(suggestion(s.id).status).toBe("rejected");
    });

    it("a confirm that finds an entry gone puts the report back to pending with a note", async () => {
        const s = seedSuggestion({ suggestion_type: "duplicate", status: "under_review" });
        const { dup, actionId } = await moderatorMerge({ suggestionId: s.id });
        db.tables.catalog_items = db.tables.catalog_items.filter((r) => r.id !== dup.id);
        const r = await confirmMerge(MOD2, actionId);
        expect(r).toMatchObject({ success: false, code: "not_found" });
        expect(action(actionId).status).toBe("failed");
        expect(suggestion(s.id).status).toBe("pending");
        expect(String(suggestion(s.id).admin_notes)).toMatch(/no longer in the Registry/);
    });

    it("rejecting a report closes the merge waiting on it", async () => {
        const keep = seed({ title: "Adios" });
        const dup = seed({ title: "Adios (dup)", slug: "adios-dup" });
        const s = seedSuggestion({
            suggestion_type: "duplicate",
            catalog_item_id: dup.id,
            field_changes: { duplicate_of: keep.id, duplicate_of_title: "Adios" },
        });
        expect(await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" })).toMatchObject({
            status: "awaiting_second_look",
        });
        const waiting = db.tables.registry_actions.find((a) => a.kind === "merge")!;
        expect(await decideSuggestion(s.id, { reviewer: MOD2, verdict: "rejected", note: "Not a duplicate" })).toEqual({
            success: true,
            status: "rejected",
        });
        expect(waiting.status).toBe("declined");
        expect(await confirmMerge(OWNER, String(waiting.id))).toMatchObject({ success: false });
        expect(db.tables.catalog_items).toHaveLength(2);
    });

    it("the owner approving the report in Admin is the second look: one merge, credited once", async () => {
        const keep = seed({ title: "Adios" });
        const dup = seed({ title: "Adios (dup)", slug: "adios-dup" });
        const s = seedSuggestion({
            suggestion_type: "duplicate",
            catalog_item_id: dup.id,
            field_changes: { duplicate_of: keep.id, duplicate_of_title: "Adios" },
        });
        await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" });
        const r = await decideSuggestion(s.id, { reviewer: OWNER, verdict: "approved" });
        expect(r).toMatchObject({ success: true, status: "approved" });
        const merges = db.tables.registry_actions.filter((a) => a.kind === "merge");
        expect(merges).toHaveLength(1);
        expect(merges[0]).toMatchObject({ status: "applied", second_look_by: OWNER.userId });
        expect(db.tables.users[0].approved_suggestions_count).toBe(4);
        expect(suggestion(s.id).status).toBe("approved");
    });

    it("the moderator who asked for the merge can't approve the report again as its second look", async () => {
        const keep = seed({ title: "Adios" });
        const dup = seed({ title: "Adios (dup)", slug: "adios-dup" });
        const s = seedSuggestion({
            suggestion_type: "duplicate",
            catalog_item_id: dup.id,
            field_changes: { duplicate_of: keep.id, duplicate_of_title: "Adios" },
        });
        await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" });
        const r = await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" });
        expect(r).toMatchObject({ success: false, code: "forbidden" });
        expect(suggestion(s.id).status).toBe("under_review");
    });
});

// ══════════════════════════════════════════════════════════════
// 3. An approval applies once
// ══════════════════════════════════════════════════════════════

describe("two approvals at the same moment", () => {
    it("an addition is inserted once and credited once", async () => {
        const s = seedSuggestion({
            suggestion_type: "addition",
            field_changes: { item_type: "plastic_release", title: "Bay Pinto", maker: "Breyer" },
        });
        const results = await Promise.all([
            decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" }),
            decideSuggestion(s.id, { reviewer: MOD2, verdict: "approved" }),
        ]);
        expect(results.filter((r) => r.success)).toHaveLength(1);
        expect(db.tables.catalog_items.filter((r) => r.title === "Bay Pinto")).toHaveLength(1);
        expect(db.tables.users[0].approved_suggestions_count).toBe(4);
        expect(db.tables.registry_actions.filter((a) => a.kind === "add")).toHaveLength(1);
    });

    it("applySuggestion takes the suggestion out of the queue before it writes anything", async () => {
        const item = seed({ attributes: { color_description: "Bay" } });
        const s = seedSuggestion({
            catalog_item_id: item.id,
            field_changes: { color_description: { from: "Bay", to: "Black" } },
        });
        const [a, b] = await Promise.all([
            applySuggestion(s.id, { reviewer: MOD }),
            applySuggestion(s.id, { reviewer: OWNER }),
        ]);
        expect([a.ok, b.ok].sort()).toEqual([false, true]);
        expect(db.tables.registry_actions.filter((x) => x.kind === "approve")).toHaveLength(1);
        expect(db.tables.users[0].approved_suggestions_count).toBe(4);
    });
});

// ══════════════════════════════════════════════════════════════
// (ii) The member changed it while it was being reviewed
// ══════════════════════════════════════════════════════════════

describe("expected: what the reviewer read", () => {
    const WORDS = "The member changed this suggestion while you were reviewing it. Look again.";

    it("decide and apply refuse with code 'changed' when the field changes or the entry differ", async () => {
        const item = seed({ attributes: { color_description: "Bay" } });
        const s = seedSuggestion({
            catalog_item_id: item.id,
            field_changes: { color_description: { from: "Bay", to: "Black" } },
        });
        const stale = { fieldChanges: { color_description: { from: "Bay", to: "Grey" } }, catalogItemId: item.id };
        expect(await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved", expected: stale })).toEqual({
            success: false,
            error: WORDS,
            code: "changed",
        });
        expect(await applySuggestion(s.id, { reviewer: MOD, expected: stale })).toEqual({
            ok: false,
            error: WORDS,
            code: "changed",
        });
        const otherItem = { fieldChanges: s.field_changes, catalogItemId: fakeId() };
        expect(await decideSuggestion(s.id, { reviewer: MOD, verdict: "rejected", expected: otherItem })).toMatchObject(
            { code: "changed" },
        );
        expect(suggestion(s.id).status).toBe("pending");
        expect((db.tables.catalog_items[0].attributes as Row).color_description).toBe("Bay");
    });

    it("passes when nothing changed (key order does not matter)", async () => {
        const item = seed({ attributes: { color_description: "Bay", run_type: "Regular Run" } });
        const fc = {
            color_description: { from: "Bay", to: "Black" },
            run_type: { from: "Regular Run", to: "Special Run" },
        };
        const s = seedSuggestion({ catalog_item_id: item.id, field_changes: fc });
        const expected = {
            fieldChanges: {
                run_type: { to: "Special Run", from: "Regular Run" },
                color_description: fc.color_description,
            },
            catalogItemId: item.id,
        };
        expect(await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved", expected })).toMatchObject({
            success: true,
        });
    });
});

// ══════════════════════════════════════════════════════════════
// (iii) Claims
// ══════════════════════════════════════════════════════════════

describe("claimSuggestion / releaseSuggestionClaim", () => {
    it("one conditional update: pending becomes under_review with the claim", async () => {
        const s = seedSuggestion();
        const r = await claimSuggestion(MOD, s.id);
        expect(r).toMatchObject({ success: true });
        if (r.success) expect(Date.parse(r.claimedUntil)).toBeGreaterThan(Date.now() + 29 * 60_000);
        expect(suggestion(s.id)).toMatchObject({ status: "under_review", claimed_by: MOD.userId });
        const claims = db.log.filter((l) => l.table === "catalog_suggestions" && l.op === "update");
        expect(claims).toHaveLength(1);
    });

    it("another moderator is refused in words while the claim runs; an expired claim can be taken", async () => {
        const s = seedSuggestion();
        await claimSuggestion(MOD, s.id);
        const other = await claimSuggestion(MOD2, s.id);
        expect(other).toMatchObject({ success: false, code: "conflict" });
        if (!other.success) expect(other.error).toMatch(/@Maple is looking at this one for another 30 minutes/);
        // Their own claim renews.
        expect((await claimSuggestion(MOD, s.id)).success).toBe(true);
        suggestion(s.id).claimed_until = "2020-01-01T00:00:00.000Z";
        expect((await claimSuggestion(MOD2, s.id)).success).toBe(true);
        expect(suggestion(s.id).claimed_by).toBe(MOD2.userId);
    });

    it("a claimed suggestion can't be decided by someone else; the claimer and the owner can", async () => {
        const item = seed({ attributes: { color_description: "Bay" } });
        const s = seedSuggestion({
            catalog_item_id: item.id,
            field_changes: { color_description: { from: "Bay", to: "Black" } },
        });
        await claimSuggestion(MOD, s.id);
        expect(await decideSuggestion(s.id, { reviewer: MOD2, verdict: "approved" })).toMatchObject({
            success: false,
            code: "conflict",
        });
        expect(await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" })).toMatchObject({ success: true });
        expect(suggestion(s.id)).toMatchObject({ status: "approved", claimed_by: null, claimed_until: null });
    });

    it("a moderator can't hold their own suggestion", async () => {
        const own = seedSuggestion({ user_id: MOD.userId });
        expect(await claimSuggestion(MOD, own.id)).toMatchObject({ success: false, code: "forbidden" });
        expect(suggestion(own.id)).toMatchObject({ status: "pending", claimed_by: null });
    });

    it("refuses a decided suggestion and a merge waiting for its second look", async () => {
        const done = seedSuggestion({ status: "approved" });
        expect(await claimSuggestion(MOD, done.id)).toMatchObject({ success: false, code: "invalid" });
        const s = seedSuggestion({ suggestion_type: "duplicate", status: "pending" });
        await moderatorMerge({ suggestionId: s.id });
        expect(suggestion(s.id)).toMatchObject({ status: "under_review", claimed_by: null });
        const r = await claimSuggestion(MOD2, s.id);
        expect(r).toMatchObject({ success: false });
        if (!r.success) expect(r.error).toMatch(/second look/);
    });

    it("releasing puts it back to pending; never a decided one; a waiting merge keeps under_review", async () => {
        const s = seedSuggestion();
        await claimSuggestion(MOD, s.id);
        // Someone else's claim is not theirs to drop.
        await releaseSuggestionClaim(MOD2, s.id);
        expect(suggestion(s.id).claimed_by).toBe(MOD.userId);
        expect((await releaseSuggestionClaim(MOD, s.id)).success).toBe(true);
        expect(suggestion(s.id)).toMatchObject({ status: "pending", claimed_by: null, claimed_until: null });

        const decided = seedSuggestion({ status: "approved", claimed_by: MOD.userId });
        await releaseSuggestionClaim(MOD, decided.id);
        expect(suggestion(decided.id).status).toBe("approved");

        const dupReport = seedSuggestion({ suggestion_type: "duplicate" });
        await moderatorMerge({ suggestionId: dupReport.id });
        suggestion(dupReport.id).claimed_by = OWNER.userId;
        await releaseSuggestionClaim(OWNER, dupReport.id);
        expect(suggestion(dupReport.id)).toMatchObject({ status: "under_review", claimed_by: null });
    });

    it("before 242 there is nothing to claim: success with no time", async () => {
        db.missingColumns.catalog_suggestions = ["claimed_by", "claimed_until"];
        const s = seedSuggestion();
        expect(await claimSuggestion(OWNER, s.id)).toEqual({ success: true, claimedUntil: "" });
        expect(suggestion(s.id).status).toBe("pending");
    });
});

// ══════════════════════════════════════════════════════════════
// 4. Every value is checked, whatever its type
// ══════════════════════════════════════════════════════════════

describe("validateChanges: numbers, lists, objects and prototype keys", () => {
    const row = catalogRow({ attributes: { color_description: "Bay" } }) as unknown as CatalogRow;
    const refusal = (changes: Row) => {
        const v = validateChanges(row, changes);
        expect(v.ok, JSON.stringify(changes)).toBe(false);
        return v.ok ? "" : v.error;
    };

    it("numbers are read as text and every check runs", () => {
        expect(refusal({ retail_price: 123456 })).toMatch(/price/i);
        expect(refusal({ model_number: 1e25 })).toMatch(/model number/);
        expect(refusal({ release_year_start: 98 })).toMatch(/four digits/);
        expect(refusal({ run_count: -5 })).toMatch(/whole number/);
        const v = validateChanges(row, { retail_price: 59.99, breed: 7 });
        expect(v.ok).toBe(true);
        if (v.ok) expect(v.after).toMatchObject({ retail_price: "59.99", breed: "7" });
    });

    it("objects and lists are refused where a value is text", () => {
        expect(refusal({ color_description: { to: "Black" } })).toMatch(/plain text, not a list/);
        expect(refusal({ set_name: ["Arabian Family"] })).toMatch(/plain text, not a list/);
        expect(refusal({ title: ["Adios"] })).toMatch(/plain text, not a list/);
    });

    it("list fields take a list of words, tidied, and refuse objects inside", () => {
        const v = validateChanges(row, { components: ["Fence", " Tree ", "", "Fence"], fits_molds: "Traditional" });
        expect(v.ok).toBe(true);
        if (v.ok) expect(v.after).toMatchObject({ components: ["Fence", "Tree"], fits_molds: "Traditional" });
        expect(refusal({ components: [{ name: "Fence" }] })).toMatch(/word or a short phrase/);
        expect(refusal({ materials: { leather: true } })).toMatch(/list of words/);
    });

    it("prototype names are never fields", () => {
        expect(refusal({ constructor: "x" })).toMatch(/not a field the Registry keeps/);
        expect(refusal({ toString: "x" })).toMatch(/not a field the Registry keeps/);
        expect(refusal(JSON.parse('{"__proto__": "x"}'))).toMatch(/not a field the Registry keeps/);
        expect(refusal({ hasOwnProperty: "x" })).toMatch(/not a field the Registry keeps/);
    });
});

// ══════════════════════════════════════════════════════════════
// 6 and 9. The second look's rules, and the member's credit
// ══════════════════════════════════════════════════════════════

describe("the second look applies the review rules", () => {
    it("nobody confirms or declines a merge from their own duplicate report", async () => {
        const s = seedSuggestion({ suggestion_type: "duplicate", user_id: MOD2.userId, status: "under_review" });
        const { actionId } = await moderatorMerge({ suggestionId: s.id });
        expect(await confirmMerge(MOD2, actionId)).toMatchObject({ success: false, code: "forbidden" });
        expect(await declineMerge(MOD2, actionId, "Different paint jobs")).toMatchObject({
            success: false,
            code: "forbidden",
        });
        expect(action(actionId).status).toBe("awaiting_second_look");
    });

    it("an artist doesn't give the second look on a report about their own piece", async () => {
        db.tables.artist_profiles.push({ user_id: MOD2.userId, studio_name: "Bay Studio", also_known_as: [] });
        const keep = seed({ title: "Adios", maker: "Bay Studio", item_type: "artist_resin" });
        const dup = seed({ title: "Adios (dup)", slug: "adios-dup", maker: "Bay Studio", item_type: "artist_resin" });
        const s = seedSuggestion({ suggestion_type: "duplicate", catalog_item_id: dup.id, status: "under_review" });
        const asked = await requestMerge(MOD, { keepId: keep.id, removeId: dup.id, note: "dup", suggestionId: s.id });
        const r = await confirmMerge(MOD2, asked.success ? asked.actionId! : "");
        expect(r).toMatchObject({ success: false, code: "forbidden" });
        if (!r.success) expect(r.error).toMatch(/your own work/);
    });

    it("a confirmed merge from a member's report credits the member in the changelog", async () => {
        const s = seedSuggestion({ suggestion_type: "duplicate", status: "under_review" });
        const { actionId } = await moderatorMerge({ suggestionId: s.id });
        await confirmMerge(MOD2, actionId);
        expect(db.tables.catalog_changelog.find((c) => c.change_type === "merge")).toMatchObject({
            contributed_by: MEMBER,
            contributor_alias: "Pat",
            approved_by: MOD2.userId,
        });
        expect(db.tables.users[0].approved_suggestions_count).toBe(4);
    });
});

// ══════════════════════════════════════════════════════════════
// 7. The removal guard sees set rows with no mold
// ══════════════════════════════════════════════════════════════

describe("linkCounts", () => {
    it("counts a set row filed under no mold that lists this mold", async () => {
        const mold = seed({ item_type: "plastic_mold", title: "Silky Sullivan", scale: "Stablemate (1:32)" });
        seed({
            title: "Racing Set With Silky Sullivan, Swaps & Native Diver",
            scale: "Stablemate (1:32)",
            parent_id: null,
            slug: "racing-set",
        });
        expect((await linkCounts(mold.id)).set_mentions).toBe(1);
    });
});

// ══════════════════════════════════════════════════════════════
// 8. Undo of an approved addition or merge
// ══════════════════════════════════════════════════════════════

describe("undo of approved additions and merges", () => {
    async function approvedAddition() {
        const s = seedSuggestion({
            suggestion_type: "addition",
            field_changes: { item_type: "plastic_release", title: "Bay Pinto", maker: "Breyer" },
        });
        expect((await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" })).success).toBe(true);
        const add = db.tables.registry_actions.find((a) => a.kind === "add")!;
        return { s, add, itemId: String(add.catalog_item_id) };
    }

    it("taking an approved addition back out also withdraws the approval and the credit", async () => {
        const { s, add } = await approvedAddition();
        expect(db.tables.users[0].approved_suggestions_count).toBe(4);
        const r = await undoAction(OWNER, String(add.id), "It was already in the Registry");
        expect(r).toMatchObject({ success: true });
        expect(suggestion(s.id).status).toBe("rejected");
        expect(db.tables.users[0].approved_suggestions_count).toBe(3);
        expect(h.notices.at(-1)?.content).toMatch(/reverted your new entry/);
    });

    it("is refused, in words, when someone else has edited the entry since", async () => {
        const { add, itemId } = await approvedAddition();
        await updateItem(MOD2, { id: itemId, expectedUpdatedAt: null, changes: { color_description: "Bay" } });
        const r = await undoAction(OWNER, String(add.id), "It was already in the Registry");
        expect(r).toMatchObject({ success: false, code: "conflict" });
        if (!r.success) expect(r.error).toMatch(/@Bay has changed it since it was added/);
        expect(db.tables.catalog_items.some((x) => x.id === itemId)).toBe(true);
    });

    it("undoing a merge from a report withdraws the report's approval", async () => {
        const s = seedSuggestion({ suggestion_type: "duplicate", status: "under_review" });
        const { actionId } = await moderatorMerge({ suggestionId: s.id });
        await confirmMerge(MOD2, actionId);
        expect(suggestion(s.id).status).toBe("approved");
        expect((await undoAction(OWNER, actionId, "Not the same mold")).success).toBe(true);
        expect(suggestion(s.id).status).toBe("rejected");
        expect(db.tables.users[0].approved_suggestions_count).toBe(3);
    });
});

// ══════════════════════════════════════════════════════════════
// 10. Rejections
// ══════════════════════════════════════════════════════════════

describe("rejections", () => {
    it("are a History entry, count toward the daily limit, and can be undone", async () => {
        const s = seedSuggestion({ catalog_item_id: seed().id });
        expect(await decideSuggestion(s.id, { reviewer: MOD, verdict: "rejected", note: "No source" })).toEqual({
            success: true,
            status: "rejected",
        });
        const reject = db.tables.registry_actions.find((a) => a.kind === "reject")!;
        expect(reject).toMatchObject({ actor_id: MOD.userId, suggestion_id: s.id, status: "applied" });
        expect(h.checkRateLimit).toHaveBeenCalledWith("registry_reject", 200, 1440, `registry:${MOD.userId}`);

        expect((await undoAction(MOD, String(reject.id), "Rejected the wrong one")).success).toBe(true);
        expect(suggestion(s.id)).toMatchObject({ status: "pending", reviewed_by: null });
        expect(reject.status).toBe("undone");
    });

    it("over the limit nothing is rejected", async () => {
        h.checkRateLimit.mockImplementation(async (endpoint: string) => endpoint !== "registry_reject");
        const s = seedSuggestion({ catalog_item_id: seed().id });
        const r = await decideSuggestion(s.id, { reviewer: MOD, verdict: "rejected", note: "No source" });
        expect(r).toMatchObject({ success: false, code: "limit" });
        if (!r.success) expect(r.error).toMatch(/200 rejections/);
        expect(suggestion(s.id).status).toBe("pending");
        expect(db.tables.registry_actions).toHaveLength(0);
    });
});

// ══════════════════════════════════════════════════════════════
// 11. The speed alarm counts a rolling hour
// ══════════════════════════════════════════════════════════════

describe("speed alarm", () => {
    const entries = (n: number, minutesAgo: number) =>
        Array.from({ length: n }, () => ({
            id: fakeId(),
            actor_id: MOD.userId,
            kind: "edit",
            status: "applied",
            created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
        }));

    it("rings past the limit within the last 60 minutes, across any clock hour", async () => {
        db.tables.registry_actions.push(...entries(SPEED_ALARM_PER_HOUR, 50), ...entries(1, 5));
        await noteRegistryAction(MOD);
        expect(h.alertOwner).toHaveBeenCalledWith("speed", expect.stringContaining("@Maple"), expect.any(String));
    });

    it("does not count anything older than an hour, and never the owner", async () => {
        db.tables.registry_actions.push(...entries(SPEED_ALARM_PER_HOUR, 61), ...entries(5, 5));
        await noteRegistryAction(MOD);
        expect(h.alertOwner).not.toHaveBeenCalled();
        db.tables.registry_actions.push(...entries(SPEED_ALARM_PER_HOUR * 2, 1));
        await noteRegistryAction(OWNER);
        expect(h.alertOwner).not.toHaveBeenCalled();
    });
});

// ══════════════════════════════════════════════════════════════
// 12. Dropped values, mold scale edits, scale refusals
// ══════════════════════════════════════════════════════════════

describe("an addition's values that fail a check", () => {
    const fc = {
        item_type: "plastic_release",
        title: "Bay Pinto",
        maker: "Breyer",
        retail_price: "$5",
        run_type: "Limited",
        color: "bay pinto",
    };

    it("are listed before approving, with why", async () => {
        const dropped = await additionDrops(fc);
        expect(dropped.map((d) => d.key).sort()).toEqual(["retail_price", "run_type"]);
        expect(dropped.find((d) => d.key === "retail_price")).toMatchObject({
            label: "Original retail price",
            value: "$5",
            error: expect.stringMatching(/\$ sign/),
        });
    });

    it("come back from decideSuggestion and are named in the member's notice", async () => {
        const s = seedSuggestion({ suggestion_type: "addition", field_changes: fc });
        const r = await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" });
        expect(r).toMatchObject({ success: true, status: "approved" });
        if (r.success) expect(r.dropped?.map((d) => d.key).sort()).toEqual(["retail_price", "run_type"]);
        expect(db.tables.catalog_items[0].attributes).toMatchObject({ color_description: "Bay pinto" });
        expect(h.notices[0].content).toMatch(/Not kept: .*"\$5"/);
        expect(h.notices[0].content).toMatch(/"Limited"/);
    });
});

describe("a mold's scale edit moves its releases with it", () => {
    it("in the same History entry, and one undo puts them all back", async () => {
        const mold = seed({ item_type: "plastic_mold", title: "Classic Arabian Mare", scale: "Classic (1:12)" });
        const kids = [
            seed({ parent_id: mold.id, scale: "Classic (1:12)", slug: "a" }),
            seed({ parent_id: mold.id, scale: "Classic (1:12)", slug: "b" }),
            seed({ parent_id: mold.id, scale: null, slug: "c" }),
        ];
        const other = seed({ scale: "Classic (1:12)", slug: "elsewhere" });
        const r = await updateItem(MOD, {
            id: mold.id,
            expectedUpdatedAt: null,
            changes: { scale: "Traditional (1:9)" },
        });
        expect(r).toMatchObject({ success: true });
        const now = (id: string) => db.tables.catalog_items.find((x) => x.id === id)!.scale;
        for (const k of kids) expect(now(k.id)).toBe("Traditional (1:9)");
        expect(now(other.id)).toBe("Classic (1:12)");
        expect(db.tables.registry_actions).toHaveLength(1);
        expect(db.tables.registry_actions[0].summary).toMatch(/and 3 releases filed under it/);
        expect(
            db.tables.registry_action_rows.filter((x) => x.action_id === db.tables.registry_actions[0].id),
        ).toHaveLength(4);

        // One release changed again since: it is left alone.
        db.tables.catalog_items.find((x) => x.id === kids[1].id)!.scale = "Stablemate (1:32)";
        const undo = await undoAction(OWNER, r.success ? r.actionId! : "", "wrong mold");
        expect(undo).toMatchObject({ success: true, restored: 3 });
        expect(now(mold.id)).toBe("Classic (1:12)");
        expect(now(kids[0].id)).toBe("Classic (1:12)");
        expect(now(kids[1].id)).toBe("Stablemate (1:32)");
        expect(now(kids[2].id)).toBeNull();
        if (undo.success) expect(undo.drifted.join(" ")).toMatch(/1 release whose scale changed again since/);
    });
});

describe("mold into mold", () => {
    it("before 243 the owner's merge moves the releases to the kept mold's scale too", async () => {
        db.missing.add("catalog_removed_items");
        db.tables.catalog_slug_history = [];
        const keep = seed({ item_type: "plastic_mold", title: "Adios", scale: "Traditional (1:9)" });
        const dup = seed({ item_type: "plastic_mold", title: "Adios", scale: "Classic (1:12)", slug: "adios-2" });
        const kid = seed({ parent_id: dup.id, scale: "Classic (1:12)", slug: "kid" });
        const r = await requestMerge(OWNER, { keepId: keep.id, removeId: dup.id, note: "same mold" });
        expect(r).toMatchObject({ success: true, legacy: true });
        expect(db.tables.catalog_items.find((x) => x.id === kid.id)).toMatchObject({
            parent_id: keep.id,
            scale: "Traditional (1:9)",
        });
    });

    it("with 243, the summary says how many releases took the kept mold's scale", async () => {
        const keep = seed({ item_type: "plastic_mold", title: "Adios", scale: "Traditional (1:9)" });
        const dup = seed({ item_type: "plastic_mold", title: "Adios", scale: "Classic (1:12)", slug: "adios-2" });
        seed({ parent_id: dup.id, scale: "Classic (1:12)", slug: "kid" });
        const r = await requestMerge(OWNER, { keepId: keep.id, removeId: dup.id, note: "same mold" });
        expect(r).toMatchObject({ success: true, status: "applied" });
        if (r.success) expect(r.summary).toMatch(/1 release now has the kept mold's scale \(Traditional \(1:9\)\)/);
    });
});

describe("undoReady", () => {
    it("says whether update 243 is in", async () => {
        expect(await undoReady()).toBe(true);
        db.missing.add("catalog_removed_items");
        expect(await undoReady()).toBe(false);
    });
});

// ══════════════════════════════════════════════════════════════
// r3-final: the rest of the engine review
// ══════════════════════════════════════════════════════════════

describe("a confirm that loses the race never sends the report back (B1, B2)", () => {
    it("the merge ran meanwhile and registry_merge says 'missing': told it is done, report left alone", async () => {
        const s = seedSuggestion({ suggestion_type: "duplicate", status: "under_review" });
        const { actionId } = await moderatorMerge({ suggestionId: s.id });
        db.rpcs.registry_merge = (args) => {
            realisticMerge(args);
            return P0001("missing", "The duplicate no longer exists.");
        };
        const r = await confirmMerge(MOD2, actionId);
        expect(r).toMatchObject({ success: false });
        if (!r.success) expect(r.error).toMatch(/already been applied/);
        expect(action(actionId).status).toBe("applied");
        expect(suggestion(s.id)).toMatchObject({ status: "under_review", admin_notes: null });
    });

    it("the merge ran between reading the request and reading the two entries: same answer", async () => {
        const s = seedSuggestion({ suggestion_type: "duplicate", status: "under_review" });
        const { keep, dup, actionId } = await moderatorMerge({ suggestionId: s.id });
        const realFrom = db.client.from;
        let armed = true;
        db.client.from = (table: string) => {
            if (armed && table === "catalog_items") {
                armed = false;
                realisticMerge({ p_action_id: actionId, p_keep: keep.id, p_remove: dup.id, p_actor: OWNER.userId });
            }
            return realFrom(table);
        };
        const r = await confirmMerge(MOD2, actionId);
        expect(r).toMatchObject({ success: false });
        if (!r.success) expect(r.error).toMatch(/already been applied/);
        expect(action(actionId).status).toBe("applied");
        expect(suggestion(s.id)).toMatchObject({ status: "under_review", admin_notes: null });
    });

    it("'missing' (an entry really gone) marks the request failed and sends the report back, whatever its words", async () => {
        const s = seedSuggestion({ suggestion_type: "duplicate", status: "under_review" });
        const { actionId } = await moderatorMerge({ suggestionId: s.id });
        db.rpcs.registry_merge = () => ({ data: null, error: { code: "P0001", message: "missing" } });
        const r = await confirmMerge(MOD2, actionId);
        expect(r).toMatchObject({ success: false, code: "not_found" });
        expect(action(actionId).status).toBe("failed");
        expect(suggestion(s.id).status).toBe("pending");
        expect(String(suggestion(s.id).admin_notes)).toMatch(/no longer in the Registry/);
    });
});

describe("a report already approved is never sent back under review (B3)", () => {
    it("requestMerge leaves an approved, credited report alone", async () => {
        const s = seedSuggestion({ suggestion_type: "duplicate", status: "approved", reviewed_by: MOD.userId });
        await moderatorMerge({ suggestionId: s.id });
        expect(suggestion(s.id).status).toBe("approved");
    });

    it("the report's own approval still waits with its merge, and is credited once when confirmed", async () => {
        const keep = seed({ title: "Adios" });
        const dup = seed({ title: "Adios (dup)", slug: "adios-dup" });
        const s = seedSuggestion({
            suggestion_type: "duplicate",
            catalog_item_id: dup.id,
            field_changes: { duplicate_of: keep.id, duplicate_of_title: "Adios" },
        });
        expect(await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" })).toMatchObject({
            status: "awaiting_second_look",
        });
        expect(suggestion(s.id).status).toBe("under_review");
        const merge = db.tables.registry_actions.find((a) => a.kind === "merge")!;
        expect((await confirmMerge(MOD2, String(merge.id))).success).toBe(true);
        await finishMergedSuggestion(s.id, { requester: { userId: MOD.userId, alias: "Maple" }, confirmer: MOD2 });
        expect(suggestion(s.id).status).toBe("approved");
        expect(db.tables.users[0].approved_suggestions_count).toBe(4);
    });
});

describe("undoing a mold's scale edit (B4, B5)", () => {
    function mold() {
        const m = seed({ item_type: "plastic_mold", title: "Classic Arabian Mare", scale: "Classic (1:12)" });
        const kids = [
            seed({ parent_id: m.id, scale: "Classic (1:12)", slug: "a" }),
            seed({ parent_id: m.id, scale: "Classic (1:12)", slug: "b" }),
        ];
        return { m, kids };
    }
    const scaleOf = (id: string) => db.tables.catalog_items.find((x) => x.id === id)!.scale;

    it("puts the releases back only when the mold's own scale is put back", async () => {
        const { m, kids } = mold();
        const r = await updateItem(MOD, {
            id: m.id,
            expectedUpdatedAt: null,
            changes: { scale: "Traditional (1:9)", mold_name: "Proud Arabian Mare" },
        });
        expect(r.success).toBe(true);
        // Someone changed the mold's scale again since; its name still holds.
        db.tables.catalog_items.find((x) => x.id === m.id)!.scale = "Stablemate (1:32)";
        const undo = await undoAction(OWNER, r.success ? r.actionId! : "", "wrong name");
        expect(undo).toMatchObject({ success: true, restored: 1 });
        expect(scaleOf(m.id)).toBe("Stablemate (1:32)");
        for (const k of kids) expect(scaleOf(k.id)).toBe("Traditional (1:9)");
        if (undo.success) {
            expect(undo.drifted).toContain("Scale");
            expect(undo.drifted.join(" ")).toMatch(/2 releases filed under it keep their scale/);
        }
    });

    it("a release move that stops part way comes back to the caller, not only in the log", async () => {
        const { m } = mold();
        const realFrom = db.client.from;
        db.client.from = (table: string) => {
            const q = realFrom(table);
            if (table !== "catalog_items") return q;
            // The releases' move (an update filtered on parent_id) times out.
            const patched = q as unknown as Record<string, (...a: unknown[]) => unknown>;
            const realEq = patched.eq.bind(q);
            const realSelect = patched.select.bind(q);
            let releaseMove = false;
            let updating = false;
            const realUpdate = patched.update.bind(q);
            patched.update = (...a: unknown[]) => {
                updating = true;
                return realUpdate(...a);
            };
            patched.eq = (...a: unknown[]) => {
                if (updating && a[0] === "parent_id") releaseMove = true;
                return realEq(...a);
            };
            patched.select = (...a: unknown[]) => {
                if (releaseMove) return Promise.resolve({ data: null, error: { code: "57014", message: "timeout" } });
                return realSelect(...a);
            };
            return q;
        };
        const r = await updateItem(MOD, { id: m.id, expectedUpdatedAt: null, changes: { scale: "Traditional (1:9)" } });
        expect(r).toMatchObject({ success: true });
        if (r.success) expect(r.warning).toMatch(/releases filed under it could not all be moved/);
    });
});

describe("taking back an addition when the history can't be read (B6)", () => {
    it("is refused, not allowed through", async () => {
        const s = seedSuggestion({
            suggestion_type: "addition",
            field_changes: { item_type: "plastic_release", title: "Bay Pinto", maker: "Breyer" },
        });
        expect((await decideSuggestion(s.id, { reviewer: MOD, verdict: "approved" })).success).toBe(true);
        const add = db.tables.registry_actions.find((a) => a.kind === "add")!;
        // The "who edited it since" read fails (here: a column the query names is refused).
        db.missingColumns.registry_actions = ["actor_id"];
        const r = await undoAction(OWNER, String(add.id), "It was already in the Registry");
        expect(r).toMatchObject({
            success: false,
            error: "We couldn't check whether others edited this; try again.",
        });
        expect(db.tables.catalog_items.some((x) => x.id === add.catalog_item_id)).toBe(true);
    });
});

describe("releaseSuggestionClaim says why nothing was let go (B7)", () => {
    it("someone else's claim, a decided suggestion, and a free one", async () => {
        const s = seedSuggestion();
        await claimSuggestion(MOD, s.id);
        expect(await releaseSuggestionClaim(MOD2, s.id)).toMatchObject({
            success: false,
            code: "forbidden",
            error: "It isn't yours to release.",
        });
        expect(suggestion(s.id).claimed_by).toBe(MOD.userId);

        const decided = seedSuggestion({ status: "approved" });
        expect(await releaseSuggestionClaim(MOD, decided.id)).toMatchObject({
            success: false,
            code: "invalid",
            error: "It was already decided.",
        });

        // Nobody holds it: nothing to let go, and nothing wrong.
        const free = seedSuggestion();
        expect(await releaseSuggestionClaim(MOD, free.id)).toEqual({ success: true });
    });
});

describe("one open merge per duplicate (B8)", () => {
    it("a merge already under way (the owner's, pending) refuses a second request in words", async () => {
        const keep = seed({ title: "Adios" });
        const dup = seed({ title: "Adios (dup)", slug: "adios-dup" });
        db.tables.registry_actions.push({
            id: fakeId(),
            kind: "merge",
            status: "pending",
            actor_id: OWNER.userId,
            actor_role: "owner",
            catalog_item_id: dup.id,
            related_item_id: keep.id,
            summary: "x",
        });
        const r = await requestMerge(MOD, { keepId: keep.id, removeId: dup.id, note: "same" });
        expect(r).toMatchObject({ success: false, code: "invalid" });
        if (!r.success) expect(r.error).toMatch(/already under way or waits for a second look/);
        expect(db.tables.registry_actions.filter((a) => a.kind === "merge")).toHaveLength(1);
    });
});
