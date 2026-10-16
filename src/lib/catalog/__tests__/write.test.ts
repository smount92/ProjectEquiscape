import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeDb, catalogRow, fakeId, type FakeDb } from "./fakeRegistryDb";

/**
 * src/lib/catalog/write.ts: the Registry's only writer.
 *
 * Every value is checked in words; a re-file takes the mold's scale; a save
 * over someone else's is refused with the current row; moderators have
 * daily limits (the owner doesn't); history and the changelog degrade
 * before migration 242; the old one-way merge serves only the owner before
 * 243; nothing linked is ever removed; undo leaves drifted fields alone;
 * and every write clears the reference pages.
 */

const h = vi.hoisted(() => ({
    db: null as unknown as FakeDb,
    allowed: true,
    revalidateTag: vi.fn(),
    alertOwner: vi.fn(async () => undefined),
    checkRateLimit: vi.fn(async () => true),
}));

vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => h.db.client }));
vi.mock("next/cache", () => ({ revalidateTag: h.revalidateTag, revalidatePath: vi.fn() }));
vi.mock("@/lib/utils/rateLimit", () => ({ checkRateLimit: h.checkRateLimit }));
vi.mock("@/lib/registry/alerts", () => ({ alertOwner: h.alertOwner, anyActiveModerator: vi.fn(async () => false) }));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification: vi.fn(async () => undefined) }));

import {
    validateChanges,
    updateItem,
    insertItem,
    revertFields,
    requestMerge,
    confirmMerge,
    declineMerge,
    removeItem,
    undoAction,
    linkCounts,
    linkWords,
    MERGE_REMOVE_NOT_READY,
    type CatalogRow,
} from "@/lib/catalog/write";
import type { RegistryActor } from "@/lib/registry/types";

const OWNER: RegistryActor = { userId: "owner-1", alias: "Owner", role: "owner" };
const MOD: RegistryActor = { userId: "mod-1", alias: "Maple", role: "moderator" };
const MOD2: RegistryActor = { userId: "mod-2", alias: "Bay", role: "moderator" };

let db: FakeDb;

function seed(over: Record<string, unknown> = {}): CatalogRow {
    const row = catalogRow(over);
    (db.tables.catalog_items ??= []).push(row);
    return row as unknown as CatalogRow;
}

/** A database with 242 and 243 in. */
function ready() {
    db.tables.registry_actions = [];
    db.tables.registry_action_rows = [];
    db.tables.catalog_removed_items = [];
    db.tables.registry_moderators = [{ user_id: MOD.userId, status: "active" }];
}

beforeEach(() => {
    db = createFakeDb();
    h.db = db;
    h.revalidateTag.mockClear();
    h.alertOwner.mockClear();
    h.checkRateLimit.mockReset();
    h.checkRateLimit.mockImplementation(async () => true);
    db.tables.catalog_items = [];
    db.tables.catalog_changelog = [];
    ready();
});

// ══════════════════════════════════════════════════════════════
// validateChanges (pure)
// ══════════════════════════════════════════════════════════════

describe("validateChanges: every field kind, refused in words", () => {
    const row = catalogRow({
        attributes: { color_description: "Bay", release_year_start: 1998 },
    }) as unknown as CatalogRow;
    const refused = (changes: Record<string, unknown>) => {
        const v = validateChanges(row, changes);
        expect(v.ok, JSON.stringify(changes)).toBe(false);
        return v.ok ? "" : v.error;
    };
    const accepted = (changes: Record<string, unknown>) => {
        const v = validateChanges(row, changes);
        if (!v.ok) throw new Error(`${JSON.stringify(changes)} refused: ${v.error}`);
        return v;
    };

    it("names: can't be emptied, start with a capital, no stray punctuation", () => {
        expect(refused({ title: "" })).toMatch(/name can't be empty/);
        expect(refused({ maker: "  " })).toMatch(/maker can't be empty/);
        expect(refused({ title: "lady phase" })).toMatch(/capital letter/);
        expect(refused({ maker: "breyer" })).toMatch(/capital letter/);
        expect(accepted({ maker: "Breyer Animal Creations." }).after.maker).toBe("Breyer Animal Creations");
        expect(refused({ artist: "x".repeat(130) })).toMatch(/120 characters/);
        expect(accepted({ title: "  Lady Phase  " }).after.title).toBe("Lady Phase");
        expect(accepted({ artist: "" }).touched).toEqual([]); // already empty: nothing to do
    });

    it("scale, run type, material: only the Registry's lists, in their spelling", () => {
        expect(refused({ scale: "Huge" })).toMatch(/not a scale the Registry knows/);
        expect(refused({ run_type: "Limited" })).toMatch(/not a run type/);
        expect(refused({ material: "Wood" })).toMatch(/not a material/);
        expect(accepted({ scale: "classic" }).after.scale).toBe("Classic (1:12)");
        expect(accepted({ run_type: "special run" }).after.run_type).toBe("Special Run");
        expect(accepted({ material: "resin" }).after.material).toBe("Resin");
    });

    it("type: only a Registry category", () => {
        expect(refused({ item_type: "spaceship" })).toMatch(/type from the list/);
        expect(accepted({ item_type: "artist_resin" }).after.item_type).toBe("artist_resin");
    });

    it("years: four digits in range, stored as numbers, running forward", () => {
        expect(refused({ release_year_start: "98" })).toMatch(/four digits/);
        expect(refused({ release_year_start: "1492" })).toMatch(/Years run from/);
        expect(refused({ release_year_end: "1990" })).toMatch(/before the first/);
        expect(accepted({ release_year_end: "2001" }).after.release_year_end).toBe(2001);
    });

    it("facts: pieces made, price, model number, colour, gender, breed", () => {
        expect(refused({ run_count: "2,500" })).toMatch(/whole number/);
        expect(refused({ retail_price: "$59.99" })).toMatch(/no \$ sign/);
        expect(refused({ model_number: "#712053!" })).toMatch(/model number/);
        expect(refused({ color_description: "x".repeat(301) })).toMatch(/300 characters/);
        expect(refused({ gender: "mare" })).toMatch(/gender from the list/);
        expect(refused({ breed: "x".repeat(101) })).toMatch(/100 characters/);
        expect(accepted({ run_count: "0250" }).after.run_count).toBe("250");
        expect(accepted({ color_description: "dapple grey" }).after.color_description).toBe("Dapple grey");
        expect(accepted({ gender: "Mare", breed: " Arabian " }).after).toMatchObject({
            gender: "Mare",
            breed: "Arabian",
        });
    });

    it("an attribute key must be on the row or one the Registry keeps", () => {
        expect(refused({ favourite_snack: "carrots" })).toMatch(/not a field the Registry keeps/);
        expect(accepted({ set_name: "Arabian Family" }).after.set_name).toBe("Arabian Family");
        const odd = catalogRow({ attributes: { legacy_key: "x" } }) as unknown as CatalogRow;
        expect(validateChanges(odd, { legacy_key: "y" }).ok).toBe(true);
    });

    it("an empty attribute deletes the key", () => {
        const v = accepted({ color_description: "" });
        expect(v.attributes).not.toHaveProperty("color_description");
        expect(v.before.color_description).toBe("Bay");
        expect(v.after.color_description).toBeNull();
    });

    it("the database's own columns can't be edited", () => {
        expect(refused({ slug: "new-address" })).toMatch(/kept by the Registry itself/);
        expect(refused({ updated_at: "now" })).toMatch(/kept by the Registry itself/);
    });

    it("lenient mode drops a bad attribute value instead of refusing (suggested additions)", () => {
        const v = validateChanges(
            null,
            { title: "Adios", maker: "Breyer", item_type: "plastic_release", retail_price: "$5" },
            {},
            { lenient: true },
        );
        expect(v.ok).toBe(true);
        if (v.ok) expect(v.dropped.map((d) => d.key)).toEqual(["retail_price"]);
    });
});

describe("validateChanges: re-filing", () => {
    const release = catalogRow({ scale: "Traditional (1:9)" }) as unknown as CatalogRow;
    const mold = { id: fakeId(), item_type: "plastic_mold", scale: "Classic (1:12)" };

    it("a re-filed release takes its mold's scale", () => {
        const v = validateChanges(release, { parent_id: mold.id }, { parent: mold });
        expect(v.ok).toBe(true);
        if (v.ok) {
            expect(v.columns).toMatchObject({ parent_id: mold.id, scale: "Classic (1:12)" });
            expect(v.touched).toEqual(["parent_id", "scale"]);
        }
    });

    it("refuses a parent that is not a mold, or the row itself", () => {
        const notMold = { id: fakeId(), item_type: "plastic_release", scale: null };
        const v = validateChanges(release, { parent_id: notMold.id }, { parent: notMold });
        expect(v.ok ? "" : v.error).toMatch(/only be filed under a mold/);
        const self = validateChanges(release, { parent_id: release.id }, { parent: null });
        expect(self.ok ? "" : self.error).toMatch(/under itself/);
        const gone = validateChanges(release, { parent_id: fakeId() }, { parent: null });
        expect(gone.ok ? "" : gone.error).toMatch(/no longer in the Registry/);
    });

    it("a release's scale follows its mold", () => {
        const filed = { ...release, parent_id: mold.id };
        const v = validateChanges(filed, { scale: "Stablemate (1:32)" }, { parent: mold });
        expect(v.ok ? "" : v.error).toMatch(/follows its mold \(Classic \(1:12\)\)/);
    });

    it("a mold isn't filed under another mold", () => {
        const m = catalogRow({ item_type: "plastic_mold" }) as unknown as CatalogRow;
        const v = validateChanges(m, { parent_id: mold.id }, { parent: mold });
        expect(v.ok ? "" : v.error).toMatch(/mold isn't filed under another mold/);
    });
});

// ══════════════════════════════════════════════════════════════
// updateItem / insertItem
// ══════════════════════════════════════════════════════════════

describe("updateItem", () => {
    it("writes the change, the history and the changelog with the actor's role, and clears the reference pages", async () => {
        const row = seed({ attributes: { color_description: "Bay" } });
        const r = await updateItem(MOD, {
            id: row.id,
            expectedUpdatedAt: row.updated_at,
            changes: { color_description: "Black" },
        });
        expect(r.success).toBe(true);
        expect((db.tables.catalog_items[0].attributes as Record<string, unknown>).color_description).toBe("Black");
        expect(db.tables.registry_actions[0]).toMatchObject({
            kind: "edit",
            actor_role: "moderator",
            actor_id: MOD.userId,
        });
        expect(db.tables.registry_action_rows[0]).toMatchObject({
            before: { color_description: "Bay" },
            after: { color_description: "Black" },
        });
        expect(db.tables.catalog_changelog[0]).toMatchObject({
            actor_role: "moderator",
            approved_by: MOD.userId,
            contributor_alias: "Maple",
            change_type: "correction",
        });
        expect(h.revalidateTag).toHaveBeenCalledWith("reference-pages", "max");
        // The seat's last action is stamped.
        expect(db.tables.registry_moderators[0].last_action_at).toBeTruthy();
    });

    it("refuses a save over someone else's and hands back the current row", async () => {
        const row = seed();
        const r = await updateItem(MOD, {
            id: row.id,
            expectedUpdatedAt: "2020-01-01T00:00:00Z",
            changes: { title: "Adios II" },
        });
        expect(r).toMatchObject({ success: false, code: "conflict" });
        if (!r.success) expect(r.current?.id).toBe(row.id);
        expect(db.log.filter((l) => l.table === "catalog_items" && l.op === "update")).toEqual([]);
    });

    it("a save that loses the race (zero rows) is a conflict too", async () => {
        const row = seed();
        db.loseNextUpdate.add("catalog_items");
        const r = await updateItem(OWNER, {
            id: row.id,
            expectedUpdatedAt: row.updated_at,
            changes: { title: "Adios II" },
        });
        expect(r).toMatchObject({ success: false, code: "conflict" });
    });

    it("guards on updated_at in the update itself", async () => {
        const row = seed();
        const loaded = row.updated_at;
        await updateItem(OWNER, { id: row.id, expectedUpdatedAt: null, changes: { title: "Adios II" } });
        const update = db.log.find((l) => l.table === "catalog_items" && l.op === "update");
        expect(update?.filters).toEqual([`id=${row.id}`, `updated_at=${loaded}`]);
    });

    it("re-filing looks up the mold and records a refile", async () => {
        const mold = seed({ item_type: "plastic_mold", scale: "Classic (1:12)", title: "Classic Arabian Mare" });
        const row = seed();
        const r = await updateItem(MOD, {
            id: row.id,
            expectedUpdatedAt: row.updated_at,
            changes: { parent_id: mold.id },
        });
        expect(r.success).toBe(true);
        const stored = db.tables.catalog_items.find((x) => x.id === row.id)!;
        expect(stored).toMatchObject({ parent_id: mold.id, scale: "Classic (1:12)" });
        expect(db.tables.registry_actions[0].kind).toBe("refile");
    });

    it("a moderator over the daily limit is refused and the owner is told; the owner is exempt", async () => {
        const row = seed();
        h.checkRateLimit.mockImplementation(async (endpoint: string) => endpoint.endsWith("_alarm"));
        const r = await updateItem(MOD, { id: row.id, expectedUpdatedAt: null, changes: { title: "Adios II" } });
        expect(r).toMatchObject({ success: false, code: "limit" });
        if (!r.success) expect(r.error).toMatch(/today's limit of 300 edits/);
        expect(h.alertOwner).toHaveBeenCalledWith("limit_hit", expect.stringContaining("@Maple"), expect.any(String));
        h.checkRateLimit.mockClear();
        const owner = await updateItem(OWNER, { id: row.id, expectedUpdatedAt: null, changes: { title: "Adios II" } });
        expect(owner.success).toBe(true);
        expect(h.checkRateLimit).not.toHaveBeenCalled();
    });

    it("before 242: no history, and the changelog is written without the new columns", async () => {
        db.missing.add("registry_actions");
        db.missing.add("registry_action_rows");
        db.missing.add("registry_moderators");
        db.missingColumns.catalog_changelog = ["actor_role", "action_id"];
        const row = seed();
        const r = await updateItem(OWNER, { id: row.id, expectedUpdatedAt: null, changes: { title: "Adios II" } });
        expect(r).toMatchObject({ success: true, actionId: null });
        expect(db.tables.catalog_changelog).toHaveLength(1);
        expect(db.tables.catalog_changelog[0]).not.toHaveProperty("actor_role");
        expect(db.tables.catalog_changelog[0].approved_by).toBe(OWNER.userId);
    });
});

describe("insertItem", () => {
    it("adds a checked row, records an add and clears the reference pages", async () => {
        const r = await insertItem(MOD, {
            payload: {
                item_type: "plastic_release",
                title: "Bay Pinto",
                maker: "Breyer",
                attributes: { run_type: "web special" },
            },
        });
        expect(r.success).toBe(true);
        expect(db.tables.catalog_items[0]).toMatchObject({
            title: "Bay Pinto",
            attributes: { run_type: "Web Special" },
        });
        expect(db.tables.registry_actions[0].kind).toBe("add");
        expect(db.tables.catalog_changelog[0].change_type).toBe("addition");
        expect(h.revalidateTag).toHaveBeenCalledWith("reference-pages", "max");
    });

    it("refuses a new row with no name, in words", async () => {
        const r = await insertItem(MOD, { payload: { item_type: "plastic_release", maker: "Breyer" } });
        expect(r).toMatchObject({ success: false, code: "invalid", error: "A new entry needs a name." });
    });
});

describe("revertFields", () => {
    it("puts back only fields that still hold the correction's value", async () => {
        const row = seed({ attributes: { color_description: "Black", run_type: "Special Run" } });
        const r = await revertFields(MOD, {
            itemId: row.id,
            suggestionId: null,
            reason: "vandalism",
            fieldChanges: {
                color_description: { from: "Bay", to: "Black" },
                run_type: { from: "Regular Run", to: "Web Special" }, // changed again since
            },
        });
        expect(r).toMatchObject({ success: true, reverted: ["color_description"], drifted: ["run_type"] });
        expect(db.tables.catalog_items[0].attributes).toMatchObject({
            color_description: "Bay",
            run_type: "Special Run",
        });
        expect(db.tables.registry_actions[0]).toMatchObject({ kind: "revert", actor_role: "moderator" });
        expect(db.tables.catalog_changelog[0]).toMatchObject({ change_type: "revert", contributor_alias: "Maple" });
        expect(h.revalidateTag).toHaveBeenCalledWith("reference-pages", "max");
    });
});

// ══════════════════════════════════════════════════════════════
// Merge
// ══════════════════════════════════════════════════════════════

describe("requestMerge", () => {
    it("before 243 the owner gets the old one-way merge, which also moves sale reports and price flags", async () => {
        db.missing.add("catalog_removed_items");
        const keep = seed({ title: "Adios" });
        const dup = seed({ title: "Adios (dup)", slug: "adios-dup" });
        db.tables.user_horses = [{ id: "h1", catalog_id: dup.id }];
        db.tables.user_wishlists = [
            { id: "w1", user_id: "both", catalog_id: dup.id },
            { id: "w2", user_id: "both", catalog_id: keep.id },
            { id: "w3", user_id: "dup-only", catalog_id: dup.id },
        ];
        db.tables.catalog_sale_reports = [{ id: "s1", catalog_item_id: dup.id }];
        db.tables.catalog_price_signal_flags = [{ id: "f1", catalog_item_id: dup.id, reporter_id: "r1" }];
        db.tables.catalog_slug_history = [];

        const r = await requestMerge(OWNER, { keepId: keep.id, removeId: dup.id, note: "same mold" });
        expect(r).toMatchObject({ success: true, status: "applied", legacy: true });
        expect(db.tables.catalog_items.map((x) => x.id)).toEqual([keep.id]);
        expect(db.tables.user_horses[0].catalog_id).toBe(keep.id);
        expect(db.tables.user_wishlists.map((w) => w.id).sort()).toEqual(["w2", "w3"]);
        expect(db.tables.catalog_sale_reports[0].catalog_item_id).toBe(keep.id);
        expect(db.tables.catalog_price_signal_flags[0].catalog_item_id).toBe(keep.id);
        expect(db.tables.catalog_slug_history).toContainEqual(
            expect.objectContaining({ old_maker_slug: "breyer", old_slug: "adios-dup", item_id: keep.id }),
        );
        expect(h.revalidateTag).toHaveBeenCalledWith("reference-pages", "max");
    });

    it("before 243 a moderator is told merging opens with update 243", async () => {
        db.missing.add("catalog_removed_items");
        const keep = seed();
        const dup = seed({ slug: "adios-2" });
        const r = await requestMerge(MOD, { keepId: keep.id, removeId: dup.id, note: "" });
        expect(r).toMatchObject({ success: false, code: "not_ready", error: MERGE_REMOVE_NOT_READY });
        expect(db.tables.catalog_items).toHaveLength(2);
    });

    it("the owner's merge applies at once through registry_merge (undoable)", async () => {
        const keep = seed();
        const dup = seed({ slug: "adios-2" });
        db.rpcs.registry_merge = () => ({ data: { moved: 3 }, error: null });
        const r = await requestMerge(OWNER, { keepId: keep.id, removeId: dup.id, note: "same mold" });
        expect(r).toMatchObject({ success: true, status: "applied", legacy: false });
        const call = db.log.find((l) => l.table === "rpc:registry_merge");
        expect(call?.payload).toMatchObject({ p_keep: keep.id, p_remove: dup.id, p_actor: OWNER.userId });
        expect(db.tables.catalog_changelog[0]).toMatchObject({ change_type: "merge", catalog_item_id: keep.id });
    });

    it("a moderator's merge waits for a second look, which the requester can't give", async () => {
        const keep = seed();
        const dup = seed({ slug: "adios-2" });
        db.rpcs.registry_merge = () => ({ data: { moved: 1 }, error: null });
        const asked = await requestMerge(MOD, { keepId: keep.id, removeId: dup.id, note: "same mold" });
        expect(asked).toMatchObject({ success: true, status: "awaiting_second_look" });
        expect(db.log.some((l) => l.table === "rpc:registry_merge")).toBe(false);
        expect(h.alertOwner).toHaveBeenCalledWith("merge_requested", expect.any(String), expect.any(String));
        const actionId = asked.success ? asked.actionId! : "";

        const own = await confirmMerge(MOD, actionId);
        expect(own).toMatchObject({ success: false, code: "forbidden" });

        const second = await confirmMerge(MOD2, actionId);
        expect(second).toMatchObject({ success: true, status: "applied" });
        expect(db.log.some((l) => l.table === "rpc:registry_merge")).toBe(true);
        expect(h.alertOwner).toHaveBeenCalledWith("merge_applied", expect.any(String), expect.any(String));
    });

    it("a second look can decline, with a reason, but not the requester's own", async () => {
        const keep = seed();
        const dup = seed({ slug: "adios-2" });
        const asked = await requestMerge(MOD, { keepId: keep.id, removeId: dup.id, note: "" });
        const actionId = asked.success ? asked.actionId! : "";
        expect(await declineMerge(MOD, actionId, "not the same")).toMatchObject({ success: false, code: "forbidden" });
        expect(await declineMerge(MOD2, actionId, "no")).toMatchObject({ success: false, code: "invalid" });
        expect(await declineMerge(MOD2, actionId, "Different paint jobs")).toMatchObject({
            success: true,
            status: "declined",
        });
        expect(db.tables.registry_actions[0].status).toBe("declined");
    });

    it("refuses a mold merged into a release", async () => {
        const keep = seed({ item_type: "plastic_mold" });
        const dup = seed({ slug: "adios-2" });
        expect(await requestMerge(OWNER, { keepId: keep.id, removeId: dup.id, note: "" })).toMatchObject({
            success: false,
            code: "invalid",
        });
    });
});

// ══════════════════════════════════════════════════════════════
// Remove
// ══════════════════════════════════════════════════════════════

describe("removeItem: refused per link kind, including set pieces", () => {
    const counts = (over: Record<string, number> = {}) => ({
        horses: 0,
        wishlists: 0,
        children: 0,
        id_suggestions: 0,
        pending_suggestions: 0,
        sale_reports: 0,
        price_flags: 0,
        ...over,
    });

    it.each([
        ["horses", "1 horse"],
        ["wishlists", "1 want list"],
        ["children", "1 release filed under it"],
        ["id_suggestions", "1 Help ID answer"],
        ["pending_suggestions", "1 waiting suggestion"],
        ["sale_reports", "1 member sale report"],
        ["price_flags", "1 price flag"],
    ])("refuses a row with %s", async (kind, words) => {
        const row = seed();
        db.rpcs.registry_link_counts = () => ({ data: counts({ [kind]: 1 }), error: null });
        db.rpcs.registry_remove = () => ({ data: { removed_id: "x" }, error: null });
        const r = await removeItem(MOD, { id: row.id, reason: "empty import row" });
        expect(r).toMatchObject({ success: false, code: "linked" });
        if (!r.success) expect(r.error).toContain(words);
        expect(db.log.some((l) => l.table === "rpc:registry_remove")).toBe(false);
    });

    it("refuses a mold that a set elsewhere lists as a piece", async () => {
        const mold = seed({ item_type: "plastic_mold", title: "Silky Sullivan", scale: "Stablemate (1:32)" });
        seed({
            title: "Racing Set With Silky Sullivan, Swaps & Native Diver",
            scale: "Stablemate (1:32)",
            parent_id: fakeId(),
            slug: "racing-set",
        });
        db.rpcs.registry_link_counts = () => ({ data: counts(), error: null });
        const c = await linkCounts(mold.id);
        expect(c.set_mentions).toBe(1);
        const r = await removeItem(MOD, { id: mold.id, reason: "empty mold" });
        expect(r).toMatchObject({ success: false, code: "linked" });
        if (!r.success) expect(r.error).toContain("1 set that lists this mold");
    });

    it("refuses one piece of a set while the other pieces stand", async () => {
        const piece = seed({ title: "Racing Set With Silky Sullivan, Swaps", slug: "racing-1" });
        seed({ title: "Racing Set With Silky Sullivan, Swaps", slug: "racing-2" });
        db.rpcs.registry_link_counts = () => ({ data: counts(), error: null });
        const r = await removeItem(MOD, { id: piece.id, reason: "duplicate import" });
        expect(r).toMatchObject({ success: false, code: "linked" });
        if (!r.success) expect(r.error).toContain("other piece of the same set");
    });

    it("removes a row nothing points at, records it, tells the owner and clears the pages", async () => {
        const row = seed({ title: "Junk Row" });
        db.rpcs.registry_link_counts = () => ({ data: counts(), error: null });
        db.rpcs.registry_remove = () => ({ data: { removed_id: "arch-1" }, error: null });
        const r = await removeItem(MOD, { id: row.id, reason: "auction listing, not a model" });
        expect(r).toMatchObject({ success: true, removedId: "arch-1" });
        expect(db.tables.registry_actions[0]).toMatchObject({ kind: "remove", actor_role: "moderator" });
        expect(db.tables.catalog_changelog[0]).toMatchObject({ change_type: "removal", catalog_item_id: null });
        expect(h.alertOwner).toHaveBeenCalledWith("removal", expect.any(String), expect.any(String));
        expect(h.revalidateTag).toHaveBeenCalledWith("reference-pages", "max");
    });

    it("the database's own refusal (a link that appeared meanwhile) comes back in words", async () => {
        const row = seed();
        db.rpcs.registry_link_counts = () => ({ data: counts(), error: null });
        db.rpcs.registry_remove = () => ({
            data: null,
            error: { code: "P0001", message: "linked", details: JSON.stringify(counts({ horses: 2 })) },
        });
        const r = await removeItem(MOD, { id: row.id, reason: "empty row" });
        expect(r).toMatchObject({ success: false, code: "linked" });
        if (!r.success) expect(r.error).toContain("2 horses");
    });

    it("before 243 nobody removes", async () => {
        db.missing.add("catalog_removed_items");
        const row = seed();
        expect(await removeItem(OWNER, { id: row.id, reason: "empty row" })).toMatchObject({
            success: false,
            code: "not_ready",
        });
    });

    it("linkWords reads naturally", () => {
        expect(
            linkWords({ ...counts({ horses: 3, wishlists: 1, children: 2 }), set_mentions: 0, set_siblings: 0 }),
        ).toBe("3 horses, 1 want list and 2 releases filed under it");
    });
});

// ══════════════════════════════════════════════════════════════
// Undo
// ══════════════════════════════════════════════════════════════

describe("undoAction", () => {
    it("restores fields still holding the change and skips drifted ones", async () => {
        const row = seed({ attributes: { color_description: "Bay", run_type: "Regular Run" } });
        const edit = await updateItem(MOD, {
            id: row.id,
            expectedUpdatedAt: null,
            changes: { color_description: "Black", run_type: "Special Run" },
        });
        expect(edit.success).toBe(true);
        // Someone changed run type again since.
        (db.tables.catalog_items[0].attributes as Record<string, unknown>).run_type = "Web Special";
        h.revalidateTag.mockClear();

        const undo = await undoAction(OWNER, edit.success ? edit.actionId! : "", "wrong colour");
        expect(undo).toMatchObject({ success: true, restored: 1, drifted: ["Run type"] });
        expect(db.tables.catalog_items[0].attributes).toMatchObject({
            color_description: "Bay",
            run_type: "Web Special",
        });
        expect(db.tables.registry_actions[0].status).toBe("undone");
        expect(db.tables.registry_actions[1]).toMatchObject({
            kind: "undo",
            undo_of: db.tables.registry_actions[0].id,
        });
        expect(h.revalidateTag).toHaveBeenCalledWith("reference-pages", "max");
    });

    it("one moderator undoing another tells the owner", async () => {
        const row = seed({ attributes: { color_description: "Bay" } });
        const edit = await updateItem(MOD, {
            id: row.id,
            expectedUpdatedAt: null,
            changes: { color_description: "Black" },
        });
        await undoAction(MOD2, edit.success ? edit.actionId! : "", "it was bay");
        expect(h.alertOwner).toHaveBeenCalledWith("undo_other", expect.stringContaining("@Bay"), expect.any(String));
    });

    it("undoes a merge through registry_unmerge and reports links left alone", async () => {
        const keep = seed();
        const dup = seed({ slug: "adios-2" });
        db.rpcs.registry_merge = () => ({ data: { moved: 2 }, error: null });
        const merged = await requestMerge(OWNER, { keepId: keep.id, removeId: dup.id, note: "dup" });
        const actionId = merged.success ? merged.actionId! : "";
        db.tables.registry_actions.find((a) => a.id === actionId)!.status = "applied";
        db.rpcs.registry_unmerge = () => ({ data: { restored: 1, left: 1 }, error: null });
        const r = await undoAction(OWNER, actionId, "not a duplicate after all");
        expect(r).toMatchObject({ success: true, restored: 1 });
        if (r.success) expect(r.drifted[0]).toMatch(/1 link changed since/);
    });

    it("refuses an undo after 30 days, and an undo of an undo", async () => {
        const OLD = fakeId();
        const UNDO = fakeId();
        db.tables.registry_actions.push({
            id: OLD,
            kind: "edit",
            status: "applied",
            actor_id: MOD.userId,
            actor_role: "moderator",
            summary: "x",
            undo_until: "2020-01-01T00:00:00Z",
        });
        expect(await undoAction(OWNER, OLD, "too late")).toMatchObject({ success: false, code: "invalid" });
        db.tables.registry_actions.push({
            id: UNDO,
            kind: "undo",
            status: "applied",
            actor_id: MOD.userId,
            actor_role: "moderator",
            summary: "x",
            undo_until: "2099-01-01T00:00:00Z",
        });
        const r = await undoAction(OWNER, UNDO, "again");
        expect(r).toMatchObject({ success: false });
        if (!r.success) expect(r.error).toMatch(/can't be undone/);
    });
});
