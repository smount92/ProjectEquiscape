/**
 * The Registry Desk's actions (Release 3 Phase 1, Package B).
 *
 * - every export asks requireRegistryModerator() before anything else, by
 *   reading the source and by refusing a non-moderator for real;
 * - a suggestion is held for 30 minutes by whoever opened it, and only
 *   that long;
 * - the Mold view reads the rows filed under the mold and nothing else: a
 *   set row filed under another mold that names this one stays out.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── A small in-memory PostgREST stand-in ──

type Row = Record<string, unknown>;

const db = vi.hoisted(() => ({
    tables: {} as Record<string, Row[]>,
    touched: [] as string[],
    updates: [] as { table: string; values: Row; or: string | null }[],
    /** Force the next guarded update on this table to match nothing (a lost race). */
    loseRace: false,
}));

function field(r: Row, col: string): unknown {
    if (col.includes("->>")) {
        const [c, k] = col.split("->>");
        const v = ((r[c] as Row | null) ?? {})[k];
        return v == null ? null : String(v);
    }
    return r[col];
}

function orMatches(r: Row, expr: string): boolean {
    return expr.split(",").some((part) => {
        const [col, op, ...rest] = part.split(".");
        const value = rest.join(".");
        const v = r[col];
        if (op === "is") return value === "null" ? v == null : String(v) === value;
        if (op === "eq") return String(v) === value;
        if (op === "lt") return v != null && String(v) < value;
        return false;
    });
}

function builder(table: string) {
    db.touched.push(table);
    const filters: ((r: Row) => boolean)[] = [];
    let mode: "select" | "update" = "select";
    let values: Row = {};
    let head = false;
    let one = false;
    let orExpr: string | null = null;
    let max = Infinity;

    const run = async () => {
        const rows = (db.tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
        if (mode === "update") {
            db.updates.push({ table, values, or: orExpr });
            if (db.loseRace && orExpr) return { data: [], error: null };
            for (const r of rows) Object.assign(r, values);
            return { data: rows.map((r) => ({ id: r.id })), error: null };
        }
        if (head) return { data: null, count: rows.length, error: null };
        const out = rows.slice(0, max);
        return one ? { data: out[0] ?? null, error: null } : { data: out, error: null };
    };

    const b = {
        select: (_cols?: string, opts?: { head?: boolean }) => {
            head = !!opts?.head;
            return b;
        },
        update: (v: Row) => {
            mode = "update";
            values = v;
            return b;
        },
        eq: (col: string, val: unknown) => (filters.push((r) => field(r, col) === val), b),
        neq: (col: string, val: unknown) => (filters.push((r) => field(r, col) !== val), b),
        in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(field(r, col))), b),
        gte: (col: string, val: string) => (filters.push((r) => String(field(r, col)) >= val), b),
        ilike: (col: string, pat: string) => {
            const re = new RegExp(`^${pat.replace(/%/g, ".*")}$`, "i");
            filters.push((r) => re.test(String(field(r, col) ?? "")));
            return b;
        },
        or: (expr: string) => {
            orExpr = expr;
            filters.push((r) => orMatches(r, expr));
            return b;
        },
        order: () => b,
        limit: (n: number) => ((max = n), b),
        maybeSingle: () => ((one = true), run()),
        single: () => ((one = true), run()),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => run().then(res, rej),
    };
    return b;
}

vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => ({ from: (t: string) => builder(t) }) }));

const auth = vi.hoisted(() => ({ requireRegistryModerator: vi.fn() }));
vi.mock("@/lib/auth", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/auth")>()),
    requireRegistryModerator: auth.requireRegistryModerator,
}));

const write = vi.hoisted(() => ({
    updateItem: vi.fn(),
    insertItem: vi.fn(),
    confirmMerge: vi.fn(),
    declineMerge: vi.fn(),
    removeItem: vi.fn(),
    linkCounts: vi.fn(),
    knownAttributeKeys: vi.fn(() => new Set(["model_number", "cast_medium", "materials"])),
}));
vi.mock("@/lib/catalog/write", () => write);

// The engine interfaces the Desk codes against (r3-engine-fixes). At merge
// this mock moves to @/lib/catalog/write and @/lib/catalog/suggestionApply.
const engine = vi.hoisted(() => ({
    undoReady: vi.fn(),
    claimSuggestion: vi.fn(),
    releaseSuggestionClaim: vi.fn(),
    requestMerge: vi.fn(),
    decideSuggestion: vi.fn(),
}));
vi.mock("@/lib/catalog/desk-engine-interfaces", () => engine);
const apply = vi.hoisted(() => ({ applySuggestion: vi.fn() }));
vi.mock("@/lib/catalog/suggestionApply", () => apply);

import { AuthError } from "@/lib/auth";
import * as desk from "@/app/actions/registry-desk";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const MEMBER = "33333333-3333-3333-3333-333333333333";

function suggestion(over: Row = {}): Row {
    return {
        id: "s1",
        user_id: MEMBER,
        catalog_item_id: "r1",
        suggestion_type: "correction",
        field_changes: { release_year_end: { from: "", to: "1988" } },
        reason: "It ran until 1988.",
        status: "pending",
        admin_notes: null,
        created_at: "2026-10-16T10:00:00Z",
        artist_name: null,
        claimed_by: null,
        claimed_until: null,
        ...over,
    };
}

function catalogRow(over: Row): Row {
    return {
        item_type: "plastic_release",
        parent_id: null,
        maker: "Breyer",
        maker_slug: "breyer",
        slug: null,
        scale: "Stablemate (1:32)",
        artist: null,
        manufacturer: "Breyer",
        attributes: {},
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
        ...over,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    db.touched = [];
    db.updates = [];
    db.loseRace = false;
    db.tables = {
        users: [
            { id: ME, alias_name: "ProjectCheapie" },
            { id: OTHER, alias_name: "BayLeaf" },
            { id: MEMBER, alias_name: "Maple" },
        ],
        catalog_suggestions: [suggestion()],
        catalog_items: [],
        user_horses: [],
        user_wishlists: [],
    };
    auth.requireRegistryModerator.mockResolvedValue({
        supabase: {},
        user: { id: ME },
        role: "moderator",
        alias: "ProjectCheapie",
    });
    // decideSuggestion does the whole decision (it applies through
    // applySuggestion itself); the Desk never calls applySuggestion.
    engine.decideSuggestion.mockResolvedValue({ success: true, status: "approved" });
    engine.undoReady.mockResolvedValue(true);
    engine.claimSuggestion.mockImplementation(async () => ({
        success: true,
        claimedUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }));
    engine.releaseSuggestionClaim.mockResolvedValue({ success: true });
});

const asOwner = () =>
    auth.requireRegistryModerator.mockResolvedValue({ supabase: {}, user: { id: ME }, role: "owner", alias: "Owner" });

describe("every export checks the role first", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "app", "actions", "registry-desk.ts"), "utf8");

    it("opens every exported action with deskGate(), which asks requireRegistryModerator()", () => {
        const file = ts.createSourceFile("registry-desk.ts", source, ts.ScriptTarget.Latest, true);
        const exported = file.statements.filter(
            (s): s is ts.FunctionDeclaration =>
                ts.isFunctionDeclaration(s) && !!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword),
        );
        expect(exported.length).toBe(Object.values(desk).filter((v) => typeof v === "function").length);
        for (const fn of exported) {
            const first = fn.body?.statements[0]?.getText(file);
            expect(first, fn.name?.text).toBe("const gate = await deskGate();");
        }
        const gate = source.match(/async function deskGate\(\)[\s\S]*?\n\}/)?.[0] ?? "";
        expect(gate).toMatch(/await requireRegistryModerator\(\)/);
        // Nothing in the file writes the Registry itself: the one writer does.
        expect(source).not.toMatch(/from\("catalog_items"\)[^;]*\.(update|insert|upsert|delete)\(/);
        expect(source).not.toMatch(/from\("catalog_changelog"\)/);
    });

    it("refuses a member who is not a moderator, before reading or writing anything", async () => {
        auth.requireRegistryModerator.mockRejectedValue(new AuthError("The Registry Desk is for Registry moderators."));
        const fns = Object.entries(desk).filter(([, v]) => typeof v === "function") as [
            string,
            (...a: unknown[]) => Promise<unknown>,
        ][];
        expect(fns.length).toBeGreaterThanOrEqual(16);
        for (const [name, fn] of fns) {
            const r = await fn("x", "y", "a long enough reason");
            expect(r, name).toEqual({ success: false, error: "The Registry Desk is for Registry moderators." });
        }
        expect(db.touched).toEqual([]);
        for (const f of Object.values(write)) expect(f).not.toHaveBeenCalled();
        for (const f of Object.values(engine)) expect(f).not.toHaveBeenCalled();
        expect(apply.applySuggestion).not.toHaveBeenCalled();
    });

    it("says log in to someone logged out, and the suspension words to a suspended account", async () => {
        auth.requireRegistryModerator.mockRejectedValueOnce(new AuthError());
        expect(await desk.getQueue("corrections")).toEqual({ success: false, error: "Please log in to do that." });
        auth.requireRegistryModerator.mockRejectedValueOnce(new AuthError("This account is suspended."));
        const r = await desk.getQueue("corrections");
        expect(r).toMatchObject({ success: false, error: expect.stringMatching(/suspended/) });
    });
});

describe("claims", () => {
    it("holds a suggestion through the engine for whoever opened it, and says until when", async () => {
        const r = await desk.claimSuggestion("s1");
        expect(r).toMatchObject({ success: true, claimed: true, until: expect.any(String) });
        expect(engine.claimSuggestion).toHaveBeenCalledWith(
            { userId: ME, alias: "ProjectCheapie", role: "moderator" },
            "s1",
        );
        // The Desk no longer writes claim columns itself.
        expect(db.updates).toEqual([]);
    });

    it("refuses while another moderator holds it, by name, and asks the engine nothing", async () => {
        db.tables.catalog_suggestions[0].claimed_by = OTHER;
        db.tables.catalog_suggestions[0].claimed_until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const r = await desk.claimSuggestion("s1");
        expect(r).toMatchObject({ success: false, error: expect.stringMatching(/^@BayLeaf is looking at this one/) });
        expect(engine.claimSuggestion).not.toHaveBeenCalled();
    });

    it("lets anyone take it once the 30 minutes are up", async () => {
        db.tables.catalog_suggestions[0].claimed_by = OTHER;
        db.tables.catalog_suggestions[0].claimed_until = new Date(Date.now() - 60 * 1000).toISOString();
        expect(await desk.claimSuggestion("s1")).toMatchObject({ success: true, claimed: true });
        expect(engine.claimSuggestion).toHaveBeenCalledTimes(1);
    });

    it("says so when another moderator won the race for it", async () => {
        engine.claimSuggestion.mockResolvedValue({ success: false, code: "conflict", error: "taken" });
        expect(await desk.claimSuggestion("s1")).toEqual({
            success: false,
            error: "Another moderator picked this one up a moment ago.",
        });
    });

    it("opens it without a hold before update 242", async () => {
        engine.claimSuggestion.mockResolvedValue({ success: false, code: "not_ready", error: "later" });
        expect(await desk.claimSuggestion("s1")).toEqual({ success: true, claimed: false, until: null });
    });

    it("lets go of a hold through the engine", async () => {
        expect(await desk.releaseClaim("s1")).toEqual({ success: true });
        expect(engine.releaseSuggestionClaim).toHaveBeenCalledWith(expect.objectContaining({ userId: ME }), "s1");
    });

    it("never lets a moderator pick up, approve or reject their own suggestion", async () => {
        db.tables.catalog_suggestions[0].user_id = ME;
        const own = { success: false, error: "This is your own suggestion. Another moderator decides it." };
        expect(await desk.claimSuggestion("s1")).toEqual(own);
        expect(await desk.approveSuggestion("s1")).toEqual(own);
        expect(await desk.rejectSuggestion("s1", "Not this one, sorry.")).toEqual(own);
        expect(engine.decideSuggestion).not.toHaveBeenCalled();
    });

    it("lets the site owner decide their own, as the engine allows", async () => {
        asOwner();
        db.tables.catalog_suggestions[0].user_id = ME;
        expect(await desk.claimSuggestion("s1")).toMatchObject({ success: true, claimed: true });
        expect(await desk.approveSuggestion("s1")).toMatchObject({ success: true, status: "applied" });
        expect(engine.decideSuggestion).toHaveBeenCalledWith(
            "s1",
            expect.objectContaining({ reviewer: expect.objectContaining({ role: "owner" }) }),
        );
    });

    it("refuses to approve one another moderator holds", async () => {
        db.tables.catalog_suggestions[0].claimed_by = OTHER;
        db.tables.catalog_suggestions[0].claimed_until = new Date(Date.now() + 60 * 1000).toISOString();
        const r = await desk.approveSuggestion("s1");
        expect(r).toMatchObject({ success: false, error: expect.stringMatching(/@BayLeaf/) });
        expect(engine.decideSuggestion).not.toHaveBeenCalled();
    });
});

describe("deciding", () => {
    const seen = { fieldChanges: { release_year_end: { from: "", to: "1988" } }, catalogItemId: "r1" };

    it("approves as the reviewer, with the moderator's fixed copy and what the card showed, and lets go of the claim", async () => {
        db.tables.catalog_suggestions[0].claimed_by = ME;
        db.tables.catalog_suggestions[0].claimed_until = new Date(Date.now() + 60 * 1000).toISOString();
        const edited = { release_year_end: { from: "", to: "1988" } };
        const r = await desk.approveSuggestion("s1", edited, "Checked against JAH.", seen);
        expect(r).toEqual({ success: true, status: "applied", dropped: [] });
        const actor = { userId: ME, alias: "ProjectCheapie", role: "moderator" };
        // One call does it all: apply, status, one notice to the member.
        expect(engine.decideSuggestion).toHaveBeenCalledTimes(1);
        expect(engine.decideSuggestion).toHaveBeenCalledWith("s1", {
            reviewer: actor,
            verdict: "approved",
            note: "Checked against JAH.",
            edited,
            expected: seen,
        });
        expect(apply.applySuggestion).not.toHaveBeenCalled();
        expect(engine.releaseSuggestionClaim).toHaveBeenCalledWith(actor, "s1");
    });

    it("says no with what the card showed, too", async () => {
        engine.decideSuggestion.mockResolvedValue({ success: true, status: "rejected" });
        expect(await desk.rejectSuggestion("s1", "The 1998 release is a different horse.", seen)).toEqual({
            success: true,
        });
        expect(engine.decideSuggestion).toHaveBeenCalledWith(
            "s1",
            expect.objectContaining({ verdict: "rejected", expected: seen }),
        );
    });

    it("decides nothing when the member changed the suggestion meanwhile, and says so", async () => {
        engine.decideSuggestion.mockResolvedValue({ success: false, code: "changed", error: "changed" });
        const r = await desk.approveSuggestion("s1", null, null, seen);
        expect(r).toMatchObject({
            success: false,
            changed: true,
            error: expect.stringMatching(/changed this suggestion/),
        });
        expect(engine.releaseSuggestionClaim).not.toHaveBeenCalled();
    });

    it("hands back the values the Registry left out of a new entry", async () => {
        const dropped = [{ key: "run_type", error: '"Store Special" is not a run type the Registry knows.' }];
        engine.decideSuggestion.mockResolvedValue({ success: true, status: "approved", dropped });
        expect(await desk.approveSuggestion("s1")).toEqual({ success: true, status: "applied", dropped });
    });

    it("leaves a duplicate waiting for its second look undecided", async () => {
        engine.decideSuggestion.mockResolvedValue({ success: true, status: "awaiting_second_look" });
        const r = await desk.approveSuggestion("s1");
        expect(r).toEqual({ success: true, status: "awaiting_second_look", dropped: [] });
        expect(engine.decideSuggestion).toHaveBeenCalledWith("s1", expect.objectContaining({ verdict: "approved" }));
    });

    it("passes the writer's refusal on in its own words", async () => {
        engine.decideSuggestion.mockResolvedValue({ success: false, error: "You can't approve your own piece." });
        expect(await desk.approveSuggestion("s1")).toEqual({
            success: false,
            error: "You can't approve your own piece.",
        });
    });

    it("needs a reason of five letters or more to say no", async () => {
        expect(await desk.rejectSuggestion("s1", "no")).toEqual({
            success: false,
            error: "Say why in a few words. The member reads it.",
        });
        expect(engine.decideSuggestion).not.toHaveBeenCalled();
        engine.decideSuggestion.mockResolvedValue({ success: true, status: "rejected" });
        expect(await desk.rejectSuggestion("s1", "The 1998 release is a different horse.")).toEqual({ success: true });
        expect(engine.decideSuggestion).toHaveBeenCalledWith("s1", expect.objectContaining({ verdict: "rejected" }));
    });

    it("refuses one already decided", async () => {
        db.tables.catalog_suggestions[0].status = "approved";
        expect(await desk.approveSuggestion("s1")).toEqual({
            success: false,
            error: "This one has already been decided.",
        });
    });
});

describe("the Queue", () => {
    it("lists a correction with who filed it, the change in words and its place on the Desk", async () => {
        db.tables.catalog_items = [
            catalogRow({ id: "m1", item_type: "plastic_mold", title: "Saddlebred" }),
            catalogRow({ id: "r1", parent_id: "m1", title: "Saddlebred" }),
        ];
        const r = await desk.getQueue("corrections");
        if (!r.success) throw new Error(r.error);
        expect(r.queue.counts.corrections).toBe(1);
        const [item] = r.queue.items;
        expect(item).toMatchObject({
            who: "@Maple",
            kindLabel: "Correction",
            title: "Saddlebred",
            moldTitle: "Saddlebred",
            deskHref: "/catalog/desk/mold/m1?release=r1",
            canEdit: true,
            mine: false,
        });
        expect(item.changes).toEqual([{ key: "release_year_end", label: "Last year", from: "", to: "1988" }]);
    });

    it("carries the entry's values now, so Edit then approve can add a field the member didn't touch", async () => {
        db.tables.catalog_items = [
            catalogRow({ id: "r1", title: "#5038 Morgan Mare", attributes: { color_description: "Bay" } }),
        ];
        const r = await desk.getQueue("corrections");
        if (!r.success) throw new Error(r.error);
        expect(r.queue.items[0].current).toMatchObject({
            title: "#5038 Morgan Mare",
            model_number: "",
            color_description: "Bay",
        });
    });

    it("counts the Desk's tabs: open suggestions, second looks, proposed rules", async () => {
        db.tables.catalog_suggestions.push(suggestion({ id: "s2", suggestion_type: "addition" }));
        db.tables.registry_actions = [{ id: "a1", status: "awaiting_second_look" }];
        db.tables.registry_style_rules = [
            { id: "x1", status: "proposed" },
            { id: "x2", status: "in_effect" },
        ];
        expect(await desk.getDeskCounts()).toEqual({
            success: true,
            counts: { queue: 2, secondLooks: 1, rules: 1 },
        });
    });
});

describe("finding any entry", () => {
    beforeEach(() => {
        db.tables.catalog_items = [
            catalogRow({ id: "sb", item_type: "plastic_mold", title: "Saddlebred" }),
            catalogRow({ id: "r1", parent_id: "sb", title: "Saddlebred", attributes: { model_number: "5002" } }),
            catalogRow({ id: "lone", title: "Saddlebred keychain", attributes: { model_number: "711198" } }),
            catalogRow({ id: "res", item_type: "artist_resin", title: "Little Bit", attributes: {} }),
        ];
    });

    it("finds releases with no mold and other kinds by name, each opening in the Desk editor", async () => {
        const r = await desk.searchEntries("saddle");
        if (!r.success) throw new Error(r.error);
        const byId = Object.fromEntries(r.entries.map((e) => [e.id, e]));
        expect(Object.keys(byId).sort()).toEqual(["lone", "r1", "sb"]);
        expect(byId.r1).toMatchObject({ href: "/catalog/desk/mold/sb?release=r1", moldTitle: "Saddlebred" });
        expect(byId.lone).toMatchObject({ href: "/catalog/desk/mold/lone", moldTitle: null, modelNumber: "711198" });
    });

    it("finds an entry by its model number, with or without the #", async () => {
        for (const term of ["711198", "#711198"]) {
            const r = await desk.searchEntries(term);
            if (!r.success) throw new Error(r.error);
            expect(r.entries.map((e) => e.id)).toEqual(["lone"]);
        }
        const resin = await desk.searchEntries("little");
        expect(resin).toMatchObject({ success: true, entries: [{ id: "res", itemType: "artist_resin" }] });
    });

    it("says yes to the Desk link only for a moderator or the owner", async () => {
        expect(await desk.canOpenDesk()).toEqual({ success: true, role: "moderator" });
        auth.requireRegistryModerator.mockRejectedValue(new AuthError("The Registry Desk is for Registry moderators."));
        expect(await desk.canOpenDesk()).toMatchObject({ success: false });
    });
});

describe("the Mold view", () => {
    beforeEach(() => {
        db.tables.catalog_items = [
            catalogRow({ id: "sb", item_type: "plastic_mold", title: "Saddlebred" }),
            catalogRow({ id: "r1", parent_id: "sb", title: "Saddlebred", attributes: { model_number: "5002" } }),
            catalogRow({ id: "r2", parent_id: "sb", title: "Raleigh", attributes: { model_number: "712248" } }),
            catalogRow({ id: "as", item_type: "plastic_mold", title: "Arabian Stallion" }),
            // A set row filed under ANOTHER mold whose title names this one.
            catalogRow({
                id: "set",
                parent_id: "as",
                title: "12-Piece Stablemates Set With Arabian Stallion, Citation, Saddlebred, Swaps",
            }),
        ];
        db.tables.user_horses = [{ catalog_id: "r1" }, { catalog_id: "r1" }, { catalog_id: "set" }];
        db.tables.user_wishlists = [{ catalog_id: "r2" }];
    });

    it("holds the mold and only the rows filed under it", async () => {
        const r = await desk.getMoldView("sb");
        if (!r.success) throw new Error(r.error);
        expect(r.view.mold.row.title).toBe("Saddlebred");
        expect(r.view.releases.map((x) => x.row.id).sort()).toEqual(["r1", "r2"]);
        expect(r.view.releases.find((x) => x.row.id === "r1")).toMatchObject({ horses: 2, wantLists: 0 });
        expect(r.view.releases.find((x) => x.row.id === "r2")).toMatchObject({ horses: 0, wantLists: 1 });
        // "Add a field" is fed by every key the Registry keeps.
        expect(r.view.fieldKeys).toEqual(["cast_medium", "materials", "model_number"]);
    });

    it("reads each same-number row's mold, so a set piece filed under its own mold is not missing", async () => {
        const title = "Stable Set With Saddlebred, Citation";
        db.tables.catalog_items.push(
            catalogRow({ id: "cit", item_type: "plastic_mold", title: "Citation" }),
            catalogRow({
                id: "p1",
                parent_id: "sb",
                title,
                attributes: { model_number: "999", color_description: "Bay" },
            }),
        );
        const flagsOfP1 = async () => {
            const r = await desk.getMoldView("sb");
            if (!r.success) throw new Error(r.error);
            return r.view.releases.find((x) => x.row.id === "p1")!.flags.map((f) => f.key);
        };
        expect(await flagsOfP1()).toContain("set_missing_pieces");
        db.tables.catalog_items.push(
            catalogRow({
                id: "p2",
                parent_id: "cit",
                title,
                attributes: { model_number: "999", color_description: "Bay" },
            }),
        );
        expect(await flagsOfP1()).not.toContain("set_missing_pieces");
    });

    it("refuses a row that is not a mold", async () => {
        expect(await desk.getMoldView("r1")).toEqual({ success: false, error: "That entry is not a mold." });
    });

    it("finds molds by name with their release counts", async () => {
        const r = await desk.searchMolds("saddle");
        expect(r).toEqual({
            success: true,
            molds: [{ id: "sb", title: "Saddlebred", maker: "Breyer", scale: "Stablemate (1:32)", releases: 2 }],
        });
    });
});

describe("saving", () => {
    beforeEach(() => {
        db.tables.catalog_items = [
            catalogRow({ id: "sb", item_type: "plastic_mold", title: "Saddlebred" }),
            catalogRow({ id: "r1", parent_id: "sb", title: "Saddlebred", attributes: { model_number: "5002" } }),
            catalogRow({ id: "r2", parent_id: "sb", title: "Pinto Saddlebred", attributes: { model_number: "5002" } }),
        ];
        db.tables.user_horses = [{ catalog_id: "r1" }];
    });

    it("hands back the other version when someone saved first", async () => {
        const current = catalogRow({ id: "r1", title: "Saddlebred (G1)", updated_at: "2026-10-16T12:00:00Z" });
        write.updateItem.mockResolvedValue({ success: false, code: "conflict", error: "changed", current });
        const r = await desk.saveItem({ id: "r1", updatedAt: "2026-10-01T00:00:00Z", changes: { title: "x" } });
        expect(r).toMatchObject({
            success: false,
            error: "Someone saved this since you opened it.",
            conflict: { id: "r1", title: "Saddlebred (G1)" },
        });
    });

    it("files a mold change as a re-file and anything else as an edit", async () => {
        write.updateItem.mockResolvedValue({
            success: true,
            item: catalogRow({ id: "r1", title: "t" }),
            actionId: "a",
            touched: ["parent_id"],
        });
        await desk.saveItem({ id: "r1", updatedAt: "u", changes: { parent_id: "m2" } });
        expect(write.updateItem).toHaveBeenLastCalledWith(
            expect.objectContaining({ userId: ME }),
            expect.objectContaining({ id: "r1", expectedUpdatedAt: "u", kind: "refile" }),
        );
        await desk.saveItem({ id: "r1", updatedAt: "u", changes: { run_detail: "Sears" } });
        expect(write.updateItem).toHaveBeenLastCalledWith(
            expect.anything(),
            expect.objectContaining({ kind: "edit", changes: { run_detail: "Sears" } }),
        );
    });

    it("passes a list on as its values", async () => {
        write.updateItem.mockResolvedValue({
            success: true,
            item: catalogRow({ id: "r1", title: "t" }),
            actionId: null,
        });
        await desk.saveItem({ id: "r1", updatedAt: "u", changes: { materials: [" Leather ", "", "Brass"] } });
        expect(write.updateItem).toHaveBeenLastCalledWith(
            expect.anything(),
            expect.objectContaining({ changes: { materials: ["Leather", "Brass"] } }),
        );
    });

    it("hands back the saved row with its fresh flags and links, and its History entry, in one trip", async () => {
        const saved = catalogRow({
            id: "r1",
            parent_id: "sb",
            title: "Saddlebred",
            attributes: { model_number: "5002" },
        });
        write.updateItem.mockResolvedValue({ success: true, item: saved, actionId: "act-9", touched: ["title"] });
        const r = await desk.saveItem({ id: "r1", updatedAt: "u", changes: { title: "Saddlebred" } });
        if (!r.success) throw new Error(r.error);
        expect(r.actionId).toBe("act-9");
        expect(r.entry).toMatchObject({ row: { id: "r1" }, horses: 1, wantLists: 0 });
        // Judged against the rows beside it: r2 shares its number.
        expect(r.entry!.flags.map((f) => f.key)).toContain("number_clash");
        // The Desk's pages are not re-rendered for a save; the writer clears the reference cache.
        const { revalidatePath } = await import("next/cache");
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("refuses an empty save without calling the writer", async () => {
        expect(await desk.saveItem({ id: "r1", updatedAt: "u", changes: {} })).toEqual({
            success: false,
            error: "Nothing has changed yet.",
        });
        expect(write.updateItem).not.toHaveBeenCalled();
    });

    it("passes a refused value on in the writer's words, naming its field", async () => {
        write.updateItem.mockResolvedValue({
            success: false,
            code: "invalid",
            field: "scale",
            error: "Scale must be one of the Registry's scales.",
        });
        expect(await desk.saveItem({ id: "r1", updatedAt: "u", changes: { scale: "huge" } })).toEqual({
            success: false,
            error: "Scale must be one of the Registry's scales.",
            field: "scale",
        });
    });
});

describe("merging and removing, through the one writer", () => {
    const none = {
        horses: 0,
        wishlists: 0,
        children: 0,
        id_suggestions: 0,
        pending_suggestions: 0,
        sale_reports: 0,
        price_flags: 0,
        set_mentions: 0,
        set_siblings: 0,
    };

    it("hands back the merge's status, summary and whether it was the one-way merge", async () => {
        engine.requestMerge.mockResolvedValue({
            success: true,
            actionId: "act1",
            status: "awaiting_second_look",
            summary: 'Merged "a" into "b"',
            legacy: false,
        });
        expect(await desk.requestMerge("k1", "r1", "Same release twice")).toEqual({
            success: true,
            actionId: "act1",
            status: "awaiting_second_look",
            summary: 'Merged "a" into "b"',
            legacy: false,
        });
        engine.requestMerge.mockResolvedValue({
            success: false,
            code: "not_ready",
            error: "Merging and removing open once the owner adds update 243.",
        });
        expect(await desk.requestMerge("k1", "r1")).toEqual({
            success: false,
            error: "Merging and removing open once the owner adds update 243.",
        });
    });

    it("merges a mold into another mold through the same engine call", async () => {
        engine.requestMerge.mockResolvedValue({
            success: true,
            actionId: "act2",
            status: "applied",
            summary: 'Merged "Saddlebred" into "Saddlebred (G1)"',
            legacy: false,
        });
        asOwner();
        const r = await desk.requestMerge("g1", "sb", "Same mold twice");
        expect(r).toMatchObject({ success: true, status: "applied" });
        expect(engine.requestMerge).toHaveBeenCalledWith(expect.objectContaining({ role: "owner" }), {
            keepId: "g1",
            removeId: "sb",
            note: "Same mold twice",
        });
    });

    it("tells the merge dialog whether update 243 is in", async () => {
        db.tables.catalog_items = [catalogRow({ id: "k1", title: "A" }), catalogRow({ id: "r1", title: "B" })];
        write.linkCounts.mockResolvedValue({ ...none, total: 0 });
        expect(await desk.previewMerge("k1", "r1")).toMatchObject({ success: true, undoReady: true });
        engine.undoReady.mockResolvedValue(false);
        expect(await desk.previewMerge("k1", "r1")).toMatchObject({ success: true, undoReady: false });
    });

    it("says a row can be removed only when nothing at all points at it", async () => {
        db.tables.catalog_items = [catalogRow({ id: "r1", title: "Saddlebred" })];
        write.linkCounts.mockResolvedValue({ ...none, total: 0 });
        expect(await desk.previewRemove("r1")).toMatchObject({ success: true, ready: true, canRemove: true });
        write.linkCounts.mockResolvedValue({ ...none, set_siblings: 2, total: 2 });
        expect(await desk.previewRemove("r1")).toMatchObject({ success: true, ready: true, canRemove: false });
    });

    it("says first, before any reason is typed, that removing waits for update 243", async () => {
        engine.undoReady.mockResolvedValue(false);
        db.tables.catalog_items = [catalogRow({ id: "r1", title: "Saddlebred" })];
        expect(await desk.previewRemove("r1")).toEqual({
            success: true,
            ready: false,
            message: "Removing opens once the site owner adds update 243. Until then nothing can be removed.",
        });
        expect(write.linkCounts).not.toHaveBeenCalled();
        asOwner();
        expect(await desk.previewRemove("r1")).toMatchObject({
            message: expect.stringMatching(/once you add update 243 \(Admin › Ops\)/),
        });
    });
});
