/**
 * The Registry Desk editor shows EVERY field (owner, 2026-10-16: "make sure
 * that all of the information is available to edit, not just the few fields
 * that show up"). These tests hold that: every real column, every key the
 * member form knows, every other attribute on the row, and the import
 * plumbing, with the record's own facts read-only.
 */
import { describe, expect, it } from "vitest";
import {
    CATALOG_EDITABLE_FIELDS,
    DESK_FIELDS,
    DESK_GROUP_ORDER,
    HIDDEN_ATTRIBUTES,
    addableFields,
    buildDeskFields,
    deskChanges,
    deskFieldFor,
    type DeskSource,
} from "@/lib/catalog/editableFields";
import { CATALOG_REAL_COLUMNS } from "@/lib/catalog/corrections";

function row(over: Partial<DeskSource> = {}): DeskSource {
    return {
        id: "70794b6b-0000-0000-0000-000000000000",
        item_type: "plastic_release",
        parent_id: "mold-1",
        title: "Saddlebred",
        maker: "Breyer",
        maker_slug: "breyer",
        slug: "saddlebred-5002",
        scale: "Stablemate (1:32)",
        artist: null,
        manufacturer: "Breyer",
        attributes: {},
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
        ...over,
    };
}

const keysOf = (item: DeskSource) => buildDeskFields(item).map((f) => f.key);

describe("DESK_FIELDS", () => {
    it("covers every real column on catalog_items", () => {
        const keys = new Set(DESK_FIELDS.map((f) => f.key));
        for (const c of CATALOG_REAL_COLUMNS) expect(keys, c).toContain(c);
    });

    it("covers every key the member form can edit", () => {
        const keys = new Set(DESK_FIELDS.map((f) => f.key));
        for (const f of CATALOG_EDITABLE_FIELDS) expect(keys, f.key).toContain(f.key);
    });

    it("adds the release facts the member form never had: run details and the set", () => {
        const keys = DESK_FIELDS.map((f) => f.key);
        expect(keys).toContain("run_detail");
        expect(keys).toContain("set_name");
    });

    it("gives every field a group from the known order and a plain label", () => {
        for (const f of DESK_FIELDS) {
            expect(DESK_GROUP_ORDER).toContain(f.group);
            expect(f.label.trim().length, f.key).toBeGreaterThan(1);
            expect(["release", "mold", "all"]).toContain(f.appliesTo);
        }
    });

    it("leaves the member's list exactly as it was", () => {
        expect(CATALOG_EDITABLE_FIELDS.map((f) => f.key)).toEqual([
            "title",
            "maker",
            "item_type",
            "scale",
            "model_number",
            "color_description",
            "release_year_start",
            "release_year_end",
            "run_type",
            "run_count",
            "retail_price",
            "material",
            "mold_name",
            "sculptor",
            "breed",
            "gender",
            "registry_notes",
        ]);
    });
});

describe("buildDeskFields: a release", () => {
    it("shows every release field whether filled or not, once each", () => {
        const keys = keysOf(row());
        expect(new Set(keys).size).toBe(keys.length);
        for (const k of [
            "title",
            "item_type",
            "maker",
            "artist",
            "manufacturer",
            "parent_id",
            "scale",
            "model_number",
            "color_description",
            "release_year_start",
            "release_year_end",
            "run_type",
            "run_detail",
            "run_count",
            "retail_price",
            "set_name",
            "mold_name",
            "material",
            "sculptor",
            "breed",
            "gender",
            "registry_notes",
        ]) {
            expect(keys, k).toContain(k);
        }
    });

    it("reads columns and attributes into strings, and the mold by its title", () => {
        const fields = buildDeskFields(
            row({ attributes: { model_number: "5002", release_year_start: 1975, run_count: null } }),
            { parentTitle: "Saddlebred (G1)" },
        );
        const by = Object.fromEntries(fields.map((f) => [f.key, f]));
        expect(by.title.original).toBe("Saddlebred");
        expect(by.model_number.original).toBe("5002");
        expect(by.release_year_start.original).toBe("1975");
        expect(by.run_count.original).toBe("");
        expect(by.parent_id.original).toBe("mold-1");
        expect(by.parent_id.display).toBe("Saddlebred (G1)");
        expect(by.parent_id.kind).toBe("mold");
    });

    it("puts every other attribute under Everything else, editable, lists included", () => {
        const fields = buildDeskFields(
            row({ attributes: { finish: "Matte", fits_molds: ["a", "b"], odd_key: "x", blank: "" } }),
        );
        const finish = fields.find((f) => f.key === "finish")!;
        expect(finish.group).toBe("extras");
        expect(finish.readOnly).toBeFalsy();
        expect(finish.original).toBe("Matte");
        expect(finish.label).toBe("Finish");
        // A list is typed as comma-separated words; the writer checks it.
        const list = fields.find((f) => f.key === "fits_molds")!;
        expect(list.group).toBe("extras");
        expect(list.readOnly).toBeFalsy();
        expect(list.kind).toBe("list");
        expect(list.original).toBe("a, b");
        expect(fields.find((f) => f.key === "odd_key")).toMatchObject({ group: "extras", label: "Odd key" });
        expect(fields.find((f) => f.key === "blank")).toBeUndefined();
        // Nobody is told the owner has to do it by hand any more.
        expect(fields.some((f) => /by hand/.test(f.help ?? ""))).toBe(false);
    });

    it("keeps the import details editable, folded away", () => {
        const fields = buildDeskFields(row({ attributes: { source: "idyb", source_id: "123" } }));
        for (const k of HIDDEN_ATTRIBUTES) {
            const f = fields.find((x) => x.key === k)!;
            expect(f, k).toBeDefined();
            expect(f.group).toBe("import");
            expect(f.readOnly).toBeFalsy();
            expect(f.collapsed).toBe(true);
        }
        expect(fields.find((f) => f.key === "source")!.original).toBe("idyb");
    });

    it("shows the record's own facts read-only, with the page address", () => {
        const fields = buildDeskFields(row());
        const record = fields.filter((f) => f.group === "record");
        expect(record.map((f) => f.key)).toEqual(["id", "page_address", "created_at", "updated_at"]);
        expect(record.every((f) => f.readOnly)).toBe(true);
        expect(record.find((f) => f.key === "page_address")!.original).toBe("/reference/breyer/saddlebred-5002");
    });
});

describe("buildDeskFields: a mold", () => {
    const mold = row({ item_type: "plastic_mold", parent_id: null, attributes: { sculptor: "Chris Hess" } });

    it("asks for the sculpture, not for release facts", () => {
        const keys = keysOf(mold);
        for (const k of ["sculptor", "breed", "gender", "material", "release_year_start", "registry_notes"]) {
            expect(keys, k).toContain(k);
        }
        for (const k of ["parent_id", "model_number", "color_description", "run_type", "run_detail", "mold_name"]) {
            expect(keys, k).not.toContain(k);
        }
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("files the mold's first year and material under the sculpture", () => {
        const fields = buildDeskFields(mold);
        expect(fields.find((f) => f.key === "release_year_start")!.group).toBe("sculpture");
        expect(fields.find((f) => f.key === "material")!.group).toBe("sculpture");
    });

    it("still shows a release fact the mold happens to carry, so nothing is hidden", () => {
        const keys = keysOf(row({ item_type: "plastic_mold", parent_id: null, attributes: { model_number: "5002" } }));
        expect(keys).toContain("model_number");
    });
});

describe("deskChanges", () => {
    it("sends only what changed, trimmed, and an emptied box as empty", () => {
        const fields = buildDeskFields(row({ attributes: { model_number: "5002", color_description: "Bay" } }));
        expect(
            deskChanges(fields, {
                title: "Saddlebred",
                model_number: " 5002 ",
                color_description: "",
                run_detail: " Sears Holiday Catalog, 1998 ",
            }),
        ).toEqual({ color_description: "", run_detail: "Sears Holiday Catalog, 1998" });
    });

    it("never sends a read-only field", () => {
        const fields = buildDeskFields(row({ attributes: { nested: { a: 1 } } }));
        expect(deskChanges(fields, { id: "x", updated_at: "y", nested: "z" })).toEqual({});
    });

    it("edits a list stored under a key that holds text as one line, and saves it as text", () => {
        const fields = buildDeskFields(row({ attributes: { odd_tags: ["Bay", "Pinto"] } }));
        const f = fields.find((x) => x.key === "odd_tags")!;
        expect(f).toMatchObject({ kind: "text", original: "Bay, Pinto", readOnly: false });
        expect(deskChanges(fields, { odd_tags: "Bay, Pinto, Roan" })).toEqual({ odd_tags: "Bay, Pinto, Roan" });
    });

    it("sends a list as its values, and nothing when only the spacing changed", () => {
        const fields = buildDeskFields(row({ attributes: { materials: ["Leather", "Brass"] } }));
        expect(deskChanges(fields, { materials: "Leather,Brass " })).toEqual({});
        expect(deskChanges(fields, { materials: "Leather, Brass, Silver" })).toEqual({
            materials: ["Leather", "Brass", "Silver"],
        });
        expect(deskChanges(fields, { materials: "" })).toEqual({ materials: "" });
    });

    it("counts a year stored as text as a change once touched, so saving stores a number", () => {
        const fields = buildDeskFields(row({ attributes: { release_year_start: "1975", release_year_end: 1988 } }));
        expect(fields.find((f) => f.key === "release_year_start")!.storedAsText).toBe(true);
        expect(fields.find((f) => f.key === "release_year_end")!.storedAsText).toBeFalsy();
        // Untouched and nothing else changed: no save.
        expect(deskChanges(fields, {})).toEqual({});
        // "Use this" fills the same text: that is a change.
        expect(deskChanges(fields, { release_year_start: "1975" })).toEqual({ release_year_start: "1975" });
        // Any other change carries the plain year along.
        expect(deskChanges(fields, { color_description: "Bay" })).toEqual({
            color_description: "Bay",
            release_year_start: "1975",
        });
    });

    it("leaves an unusual year stored as text for a person", () => {
        const fields = buildDeskFields(row({ attributes: { release_year_start: "1975-1988" } }));
        expect(deskChanges(fields, { color_description: "Bay" })).toEqual({ color_description: "Bay" });
    });

    it("never carries along a year the Registry would refuse, so an unrelated save still goes through", () => {
        // Out of range (years run from 1900).
        const old = buildDeskFields(row({ attributes: { release_year_end: "1890" } }));
        expect(deskChanges(old, { color_description: "Bay" })).toEqual({ color_description: "Bay" });
        // A text last year before the first year.
        const backwards = buildDeskFields(row({ attributes: { release_year_start: 1990, release_year_end: "1985" } }));
        expect(deskChanges(backwards, { color_description: "Bay" })).toEqual({ color_description: "Bay" });
        // Both as text, in the wrong order: neither rides along.
        const both = buildDeskFields(row({ attributes: { release_year_start: "1990", release_year_end: "1985" } }));
        expect(deskChanges(both, { color_description: "Bay" })).toEqual({ color_description: "Bay" });
        // The order is read with what is being saved: a first year moved back makes the text last year fine.
        expect(deskChanges(backwards, { release_year_start: "1980" })).toEqual({
            release_year_start: "1980",
            release_year_end: "1985",
        });
        // A good pair still rides along.
        const good = buildDeskFields(row({ attributes: { release_year_start: "1985", release_year_end: "1990" } }));
        expect(deskChanges(good, { color_description: "Bay" })).toEqual({
            color_description: "Bay",
            release_year_start: "1985",
            release_year_end: "1990",
        });
    });
});

describe("resin, tack and prop fields", () => {
    const resinKeys = ["cast_medium", "edition_size", "finish", "finish_type", "coa", "auction_sale_price", "species"];
    const tackKeys = ["tack_type", "discipline", "materials", "fits_molds", "working_parts"];
    const propKeys = ["prop_category", "dimensions", "terrain_setting", "materials"];
    const sceneKeys = ["scene_theme", "components", "base_dimensions", "documentation_notes", "discipline"];

    it("shows each kind's own keys by default, empty, under Everything else", () => {
        const cases: [string, string[]][] = [
            ["artist_resin", resinKeys],
            ["factory_resin", resinKeys],
            ["tack", tackKeys],
            ["prop", propKeys],
            ["diorama", sceneKeys],
        ];
        for (const [type, keys] of cases) {
            const fields = buildDeskFields(row({ item_type: type, parent_id: null }));
            for (const k of keys) {
                const f = fields.find((x) => x.key === k);
                expect(f, `${type} ${k}`).toBeDefined();
                expect(f!.group).toBe("extras");
                expect(f!.readOnly).toBeFalsy();
            }
        }
    });

    it("keeps them off a plastic release unless it carries one", () => {
        const keys = keysOf(row());
        for (const k of [...resinKeys, ...tackKeys, ...propKeys, ...sceneKeys]) expect(keys, k).not.toContain(k);
        expect(keysOf(row({ attributes: { edition_size: "50" } }))).toContain("edition_size");
    });

    it("edits materials and working parts as lists", () => {
        const fields = buildDeskFields(row({ item_type: "tack", parent_id: null }));
        expect(fields.find((f) => f.key === "materials")!.kind).toBe("list");
        expect(fields.find((f) => f.key === "working_parts")!.kind).toBe("list");
    });
});

describe("Add a field", () => {
    it("offers every key the Registry keeps that the editor doesn't show, in words, A to Z", () => {
        const shown = buildDeskFields(row());
        const known = ["model_number", "cast_medium", "edition_size", "source", "brand_new_key", "page_address"];
        const offered = addableFields(shown, known);
        expect(offered.map((o) => o.key)).toEqual(["brand_new_key", "cast_medium", "edition_size"]);
        expect(offered.find((o) => o.key === "cast_medium")!.label).toBe("Cast in");
        expect(offered.find((o) => o.key === "brand_new_key")!.label).toBe("Brand new key");
    });

    it("never offers a column or a fact of the record", () => {
        const offered = addableFields([], ["title", "maker", "parent_id", "id", "created_at", "updated_at", "slug"]);
        expect(offered).toEqual([]);
    });

    it("adds the field empty, ready to type into, and saves it like any other", () => {
        const fields = buildDeskFields(row(), { added: ["cast_medium", "materials"] });
        const added = fields.find((f) => f.key === "cast_medium")!;
        expect(added).toMatchObject({ original: "", group: "extras", label: "Cast in" });
        expect(deskFieldFor("materials").kind).toBe("list");
        expect(deskChanges(fields, { cast_medium: "Resin", materials: "Leather, Brass" })).toEqual({
            cast_medium: "Resin",
            materials: ["Leather", "Brass"],
        });
    });
});
