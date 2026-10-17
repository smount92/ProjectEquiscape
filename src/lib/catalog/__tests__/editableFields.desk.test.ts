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
    buildDeskFields,
    deskChanges,
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

    it("puts every other attribute under Everything else, editable", () => {
        const fields = buildDeskFields(row({ attributes: { finish: "Matte", fits_molds: ["a", "b"], blank: "" } }));
        const finish = fields.find((f) => f.key === "finish")!;
        expect(finish.group).toBe("extras");
        expect(finish.readOnly).toBeFalsy();
        expect(finish.original).toBe("Matte");
        // A list can't be typed into one box without breaking it: shown, not editable.
        const list = fields.find((f) => f.key === "fits_molds")!;
        expect(list.group).toBe("extras");
        expect(list.readOnly).toBe(true);
        expect(fields.find((f) => f.key === "blank")).toBeUndefined();
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
        const fields = buildDeskFields(row({ attributes: { fits_molds: ["a"] } }));
        expect(deskChanges(fields, { id: "x", updated_at: "y", fits_molds: "z" })).toEqual({});
    });
});
