/**
 * The Registry Desk's checks (Package C): a positive and a negative per
 * flag, the set rules, and the to-do counts held equal to
 * scripts/catalog-delta/registry_health.mjs on the same rows.
 */
import { describe, expect, it } from "vitest";
import {
    FLAG_LABELS,
    FLAG_TONES,
    TODO_LISTS,
    computeTodoLists,
    moldFlags,
    releaseFlags,
    type CheckRow,
    type FlagKey,
    type NumberMate,
} from "@/lib/registry/checks";

let seq = 0;
function row(over: Partial<CheckRow> & { title: string }): CheckRow {
    return {
        id: over.id ?? `r${++seq}`,
        item_type: "plastic_release",
        maker: "Breyer",
        scale: "Stablemate (1:32)",
        parent_id: null,
        artist: null,
        attributes: {},
        ...over,
    };
}
const mold = (title: string, over: Partial<CheckRow> = {}) => row({ title, item_type: "plastic_mold", ...over });
const rel = (
    title: string,
    parent: CheckRow | null,
    attributes: Record<string, unknown> = {},
    over: Partial<CheckRow> = {},
) => row({ title, parent_id: parent?.id ?? null, attributes: { color_description: "Bay", ...attributes }, ...over });

const saddlebred = mold("Saddlebred (G1)", { id: "m-sb" });

describe("flag words", () => {
    it("every flag has a label and a tone; the roster is a neutral note (owner answer 1)", () => {
        const keys = Object.keys(FLAG_LABELS) as FlagKey[];
        expect(keys).toHaveLength(18);
        for (const k of keys) expect(FLAG_TONES[k]).toBeTruthy();
        expect(FLAG_LABELS.roster_in_title).toBe("Whole set in the title");
        expect(FLAG_TONES.roster_in_title).toBe("note");
    });
});

describe("releaseFlags: a positive and a negative per flag", () => {
    const has = (r: CheckRow, f: FlagKey, ctx = {}) => releaseFlags(r, { mold: saddlebred, ...ctx }).includes(f);

    it("shop_or_sale_title", () => {
        expect(has(rel("BreyerFest 1990 — Live Auction 01", saddlebred), "shop_or_sale_title")).toBe(true);
        expect(has(rel("Sears Holiday Catalog", saddlebred), "shop_or_sale_title")).toBe(true);
        expect(has(rel("Saddlebred", saddlebred), "shop_or_sale_title")).toBe(false);
    });

    it("no_colour", () => {
        expect(has(rel("Saddlebred", saddlebred, { color_description: "" }), "no_colour")).toBe(true);
        expect(has(rel("Saddlebred", saddlebred, { color_description: "?" }), "no_colour")).toBe(true);
        expect(has(rel("Saddlebred", saddlebred, { color_description: "Bay, solid face" }), "no_colour")).toBe(false);
    });

    it("roster_in_title", () => {
        const set = "12-Piece Stablemates Set With Arabian Mare, Citation, Saddlebred, Swaps";
        expect(has(rel(set, saddlebred), "roster_in_title")).toBe(true);
        expect(has(rel("Stablemates Mini-Fanfare", saddlebred), "roster_in_title")).toBe(false);
    });

    it("description_in_title", () => {
        expect(
            has(rel("Pocket Barn (Replaced in 2006 by American Saddlebred)", saddlebred), "description_in_title"),
        ).toBe(true);
        expect(
            has(
                rel("Breyer Silver Anniversary giveaway (>1,000 made, unknown number)", saddlebred),
                "description_in_title",
            ),
        ).toBe(true);
        expect(
            has(
                rel('Stablemate Keychain On gold-tone metal keychain with metal "Breyer" tag', saddlebred),
                "description_in_title",
            ),
        ).toBe(true);
        expect(
            has(
                rel("The Mod Squad On keychain. With Appaloosa, Draft Horse, Saddlebred.", saddlebred),
                "description_in_title",
            ),
        ).toBe(true);
        // Labels in brackets are not descriptions: a generation, a year, a count, a piece name.
        expect(has(rel("Parade of Breeds (Saddlebred)", saddlebred), "description_in_title")).toBe(false);
        expect(has(rel("Saddlebred (2004)", saddlebred), "description_in_title")).toBe(false);
        expect(has(rel("Set With Arabian Mare, Saddlebred (2) & Swaps", saddlebred), "description_in_title")).toBe(
            false,
        );
    });

    it("colour_in_title (only when the title also names its mold)", () => {
        expect(has(rel("Black and White Pinto Saddlebred", saddlebred), "colour_in_title")).toBe(true);
        expect(has(rel("Pinto Saddlebred", saddlebred), "colour_in_title")).toBe(true);
        expect(has(rel("Saddlebred", saddlebred), "colour_in_title")).toBe(false);
        expect(has(rel("Black Beauty", saddlebred), "colour_in_title")).toBe(false);
    });

    it("number_in_title (the MHH-079 rule: a bare year is not a number)", () => {
        expect(has(rel("#5038 Morgan Mare", saddlebred), "number_in_title")).toBe(true);
        expect(has(rel("5038 Morgan Mare", saddlebred), "number_in_title")).toBe(true);
        expect(has(rel("2019 Holiday Horse", saddlebred), "number_in_title")).toBe(false);
    });

    it("number_clash, ignoring the rows of one set", () => {
        const a = rel("Saddlebred", saddlebred, { model_number: "5002" });
        const b = rel("Pinto Saddlebred", saddlebred, { model_number: "5002" });
        expect(has(a, "number_clash", { sameNumber: [a, b] })).toBe(true);
        // Same set name, same number: pieces of one set.
        const s1 = rel("12-Piece Stablemates Set With Citation, Saddlebred", saddlebred, { model_number: "711096" });
        const s2 = rel("12-Piece Stablemates Set With Citation, Saddlebred", null, { model_number: "711096" });
        expect(has(s1, "number_clash", { sameNumber: [s1, s2] })).toBe(false);
        // One title in several colours (Mini-Fanfare): one set.
        const f1 = rel("Stablemates Mini-Fanfare", saddlebred, {
            model_number: "701705",
            color_description: "Wedgewood",
        });
        const f2 = rel("Stablemates Mini-Fanfare", saddlebred, {
            model_number: "701705",
            color_description: "Florentine",
        });
        expect(has(f1, "number_clash", { sameNumber: [f1, f2] })).toBe(false);
        // Another maker's number is not a clash.
        const other = rel("Arabian", null, { model_number: "5002" }, { maker: "Peter Stone" });
        expect(has(a, "number_clash", { sameNumber: [a, other] })).toBe(false);
        // Without the rows sharing the number, nothing is said.
        expect(has(a, "number_clash")).toBe(false);
    });

    it("wrong_scale", () => {
        expect(has(rel("Saddlebred", saddlebred, {}, { scale: "Traditional (1:9)" }), "wrong_scale")).toBe(true);
        expect(has(rel("Saddlebred", saddlebred), "wrong_scale")).toBe(false);
    });

    it("no_mold", () => {
        expect(releaseFlags(rel("Saddlebred", null)).includes("no_mold")).toBe(true);
        expect(has(rel("Saddlebred", saddlebred), "no_mold")).toBe(false);
    });

    it("set_missing_pieces", () => {
        const title = "Stable Set With Saddlebred, Citation";
        const piece = rel(title, saddlebred, { model_number: "999" });
        expect(has(piece, "set_missing_pieces", { sameNumber: [piece] })).toBe(true);
        const citation: NumberMate = {
            ...rel(title, mold("Citation"), { model_number: "999" }),
            mold_title: "Citation",
        };
        expect(has(piece, "set_missing_pieces", { sameNumber: [piece, citation] })).toBe(false);
    });

    it("title_lowercase", () => {
        expect(has(rel("saddlebred", saddlebred), "title_lowercase")).toBe(true);
        expect(has(rel("Saddlebred", saddlebred), "title_lowercase")).toBe(false);
    });

    it("title_punctuation (an abbreviation's full stop is fine)", () => {
        expect(has(rel("Saddlebred.", saddlebred), "title_punctuation")).toBe(true);
        expect(has(rel("Saddlebred,", saddlebred), "title_punctuation")).toBe(true);
        expect(has(rel("I.C.E.", saddlebred), "title_punctuation")).toBe(false);
    });

    it("year_as_text", () => {
        expect(has(rel("Saddlebred", saddlebred, { release_year_start: "1975" }), "year_as_text")).toBe(true);
        expect(has(rel("Saddlebred", saddlebred, { release_year_start: 1975 }), "year_as_text")).toBe(false);
    });

    it("mold_name_disagrees (a leading G1 in the box is ignored)", () => {
        const sb = mold("Saddlebred");
        expect(has(rel("Saddlebred", sb, { mold_name: "Morgan" }), "mold_name_disagrees", { mold: sb })).toBe(true);
        expect(has(rel("Saddlebred", sb, { mold_name: "G1 Saddlebred" }), "mold_name_disagrees", { mold: sb })).toBe(
            false,
        );
    });

    it("duplicate_release", () => {
        const a = rel("Saddlebred", saddlebred, { model_number: "5002" });
        const b = rel("Saddlebred", saddlebred, { model_number: "5002" });
        const c = rel("Saddlebred", saddlebred, { model_number: "5002", color_description: "Black" });
        expect(has(a, "duplicate_release", { siblings: [a, b] })).toBe(true);
        expect(has(a, "duplicate_release", { siblings: [a, c] })).toBe(false);
    });
});

describe("moldFlags", () => {
    it("empty_mold", () => {
        const m = mold("Citation");
        expect(moldFlags(m, [])).toContain("empty_mold");
        expect(moldFlags(m, [rel("Citation", m)])).not.toContain("empty_mold");
    });

    it("mold_no_generation: Breyer Stablemate molds only", () => {
        expect(moldFlags(mold("Saddlebred"), [])).toContain("mold_no_generation");
        expect(moldFlags(mold("Saddlebred (G1)"), [])).not.toContain("mold_no_generation");
        expect(moldFlags(mold("Saddlebred", { scale: "Traditional (1:9)" }), [])).not.toContain("mold_no_generation");
        expect(moldFlags(mold("Saddlebred", { maker: "Peter Stone" }), [])).not.toContain("mold_no_generation");
    });
});

// ── Parity with scripts/catalog-delta/registry_health.mjs ──────────
// The lines below are the scan's own expressions, copied as they are, run
// on the same fixture rows. If a check here is changed, change the scan too.

type HealthItem = CheckRow & { attributes: Record<string, unknown> };
function healthCounts(items: HealthItem[]) {
    const byId = new Map(items.map((i) => [i.id, i]));
    const count = (arr: HealthItem[], f: (x: HealthItem) => string) =>
        arr.reduce<Record<string, number>>((a, x) => {
            const k = f(x);
            a[k] = (a[k] ?? 0) + 1;
            return a;
        }, {});
    const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const ttl = (s: unknown) =>
        String(s ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    const rel = items.filter((i) => i.item_type === "plastic_release");
    const molds = items.filter((i) => i.item_type === "plastic_mold");
    const kids = count(
        rel.filter((r) => r.parent_id),
        (r) => r.parent_id!,
    );
    const relKey = count(
        rel,
        (r) =>
            `${r.parent_id}|${ttl(r.title)}|${ttl(r.attributes?.color_description)}|${r.attributes?.model_number ?? ""}`,
    );
    const t = (f: (s: string) => boolean) => items.filter((i) => f(i.title ?? ""));
    const ABBREVIATION_END = /(?:(?<!\p{L})\p{L}|\b(?:Co|Jr|Sr|Inc|Ltd|St|Mr|Mrs|Ms|Dr|No|Bros|Corp|Mt|vs))\.$/u;
    const strayEnd = (s: string) => /[.,;:]$/.test(s.trim()) && !ABBREVIATION_END.test(s.trim());
    const people: Record<string, number> = {};
    for (const i of items)
        for (const c of ["maker", "artist"] as const) if (i[c]) people[i[c]!] = (people[i[c]!] ?? 0) + 1;
    const names = Object.keys(people);
    const lev = (a: string, b: string) => {
        const d = Array.from({ length: a.length + 1 }, (_, x) => [x]);
        for (let y = 1; y <= b.length; y++) d[0][y] = y;
        for (let x = 1; x <= a.length; x++)
            for (let y = 1; y <= b.length; y++)
                d[x][y] = Math.min(d[x - 1][y] + 1, d[x][y - 1] + 1, d[x - 1][y - 1] + (a[x - 1] === b[y - 1] ? 0 : 1));
        return d[a.length][b.length];
    };
    let near = 0;
    for (let a = 0; a < names.length; a++)
        for (let b = a + 1; b < names.length; b++) {
            const x = norm(names[a]),
                y = norm(names[b]);
            if (x.length > 6 && y.length > 6 && Math.abs(x.length - y.length) <= 2 && lev(x, y) <= 2) near++;
        }
    return {
        no_mold: rel.filter((r) => !r.parent_id).length,
        wrong_scale: rel.filter(
            (r) => r.parent_id && byId.get(r.parent_id)?.scale && r.scale && byId.get(r.parent_id)!.scale !== r.scale,
        ).length,
        empty_mold: molds.filter((m) => !kids[m.id]).length,
        duplicate_release: Object.values(relKey).filter((n) => n > 1).length,
        mold_name_disagrees: rel.filter(
            (r) =>
                r.parent_id &&
                r.attributes?.mold_name &&
                ttl(String(r.attributes.mold_name).replace(/^g[1-6]\s+/i, "")) !== ttl(byId.get(r.parent_id)?.title),
        ).length,
        title_punctuation: t(strayEnd).length,
        title_lowercase: t((s) => /^[a-z]/.test(s)).length,
        year_as_text: items.filter(
            (i) =>
                typeof i.attributes?.release_year_start === "string" ||
                typeof i.attributes?.release_year_end === "string",
        ).length,
        near_name: near,
    };
}

function fixtureRegistry(): HealthItem[] {
    const sb = mold("Saddlebred", { id: "m1" });
    const trad = mold("Lady Phase", { id: "m2", scale: "Traditional (1:9)" });
    const empty = mold("Citation", { id: "m3" });
    const emptyToo = mold("seabiscuit.", { id: "m4", attributes: { release_year_start: "1976" } });
    const items: CheckRow[] = [
        sb,
        trad,
        empty,
        emptyToo,
        rel("Saddlebred", sb, { model_number: "5002" }),
        rel("Saddlebred", sb, { model_number: "5002" }),
        rel("Pinto Saddlebred", sb, { model_number: "5002", color_description: "Light chestnut pinto" }),
        rel("Saddlebred.", sb, { release_year_start: "1975", mold_name: "Morgan" }),
        rel("Lady Phase", trad, {}, { scale: "Stablemate (1:32)" }),
        rel("lady Phase", trad, { mold_name: "G1 Lady Phase" }, { scale: "Traditional (1:9)" }),
        rel("Orphan", null),
        rel("Orphan", null),
        rel("Co.", null, { release_year_end: "1999" }),
        row({ title: "Resin Pony,", item_type: "artist_resin", maker: "Brigitte Eberl", artist: "Brigitte Eberl" }),
        row({ title: "Resin Foal", item_type: "artist_resin", maker: "Brigette Eberl", artist: null }),
        row({
            title: "Resin Mare",
            item_type: "artist_resin",
            maker: "Kristina Katunina",
            artist: "Kristina Kantunina",
        }),
    ];
    return items as HealthItem[];
}

describe("to-do lists match registry_health.mjs", () => {
    it("every shared count is the scan's count", () => {
        const items = fixtureRegistry();
        const health = healthCounts(items);
        const lists = computeTodoLists(items);
        const count = (key: string, kind?: FlagKey) =>
            lists.find((l) => l.key === key)!.items.filter((i) => !kind || i.kind === kind).length;
        expect({
            no_mold: count("no_mold"),
            wrong_scale: count("wrong_scale"),
            empty_mold: count("empty_mold"),
            duplicate_release: count("duplicates", "duplicate_release"),
            mold_name_disagrees: count("mold_name_disagrees"),
            title_punctuation: count("title_punctuation"),
            title_lowercase: count("title_lowercase"),
            year_as_text: count("year_as_text"),
            near_name: count("near_name"),
        }).toEqual(health);
        // The fixture exercises every count, so a zero can't hide a mismatch.
        for (const [k, v] of Object.entries(health)) expect(v, k).toBeGreaterThan(0);
    });
});

describe("computeTodoLists", () => {
    it("has every list, in the order the Desk shows, with a count equal to its items", () => {
        const lists = computeTodoLists(fixtureRegistry());
        expect(lists.map((l) => l.key)).toEqual(TODO_LISTS.map((d) => d.key));
        for (const l of lists) expect(l.count).toBe(l.items.length);
    });

    it("lists a number clash once per number, and never a set's own pieces", () => {
        const lists = computeTodoLists(fixtureRegistry());
        const clashes = lists.find((l) => l.key === "duplicates")!.items.filter((i) => i.kind === "number_clash");
        expect(clashes).toHaveLength(1);
        expect(clashes[0].title).toMatch(/#5002/);
    });

    it("lists each missing set piece once, however many rows the set has", () => {
        const sb = mold("Saddlebred", { id: "sb" });
        const cit = mold("Citation", { id: "cit" });
        const title = "Gift Set With Saddlebred, Citation, Swaps";
        const lists = computeTodoLists([
            sb,
            cit,
            rel(title, sb, { model_number: "700" }),
            rel(title, cit, { model_number: "700" }),
        ]);
        const missing = lists.find((l) => l.key === "set_missing_pieces")!.items;
        expect(missing.map((i) => i.title)).toEqual(["Gift Set · Swaps"]);
    });

    it("puts Stablemates first", () => {
        const trad = mold("Adios", { scale: "Traditional (1:9)", maker: "Aardvark" });
        const sm = mold("Zebra", { maker: "Zed" });
        const lists = computeTodoLists([trad, sm]);
        expect(lists.find((l) => l.key === "empty_mold")!.items.map((i) => i.title)).toEqual(["Zebra", "Adios"]);
    });

    it("links a release's item to its mold, and a mold's item to itself", () => {
        const sb = mold("Saddlebred", { id: "sb" });
        const lists = computeTodoLists([sb, rel("#5002 Saddlebred", sb)]);
        const item = lists.find((l) => l.key === "number_in_title")!.items[0];
        expect(item).toMatchObject({ moldId: "sb", moldTitle: "Saddlebred" });
        const gen = lists.find((l) => l.key === "mold_no_generation")!.items[0];
        expect(gen).toMatchObject({ id: "sb", moldId: "sb" });
    });
});
