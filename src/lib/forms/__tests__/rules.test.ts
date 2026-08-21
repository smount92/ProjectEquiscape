/**
 * The one required-field rule, and per-category visibility.
 *
 * "A model needs a name, a finish type, and a condition grade unless it's a
 * work in progress" used to be written out four times — `add:412`,
 * `add:426-440`, `add:798-808`, `edit:627-634`. These tests are what stop
 * it becoming five.
 */

import { describe, expect, it } from "vitest";

import { getFieldSpec } from "@/lib/forms/registry";
import {
    canSubmit,
    ctx,
    getActiveGroups,
    getDomId,
    getGroupFields,
    getMissingRequiredFields,
    getRequiredFields,
    getVisibleFields,
    hasValue,
    isFieldDisabled,
    isFieldRequired,
    isFieldVisible,
} from "@/lib/forms/rules";
import type { AssetCategory } from "@/lib/types/database";

const names = (specs: { name: string }[]) => specs.map((s) => s.name);

describe("the required rule", () => {
    it("requires name + finish + condition for a completed model", () => {
        const required = names(getRequiredFields(ctx("model", "create-full", { life_stage: "completed" })));
        expect(required).toEqual(["custom_name", "finish_type", "condition_grade"]);
    });

    it("drops the condition grade for a work in progress — and only that", () => {
        const required = names(
            getRequiredFields(ctx("model", "create-full", { life_stage: "in_progress" })),
        );
        expect(required).toEqual(["custom_name", "finish_type"]);
    });

    it("requires the condition grade when no life stage has been chosen yet", () => {
        // The old forms compared `lifeStage !== "in_progress"`, so an unset
        // value counted as "needs a grade". Preserved exactly.
        const required = names(getRequiredFields(ctx("model", "create-full", {})));
        expect(required).toContain("condition_grade");
    });

    it.each(["tack", "prop", "diorama", "other_model"] as AssetCategory[])(
        "requires only a name for %s",
        (category) => {
            expect(names(getRequiredFields(ctx(category, "create-full", {})))).toEqual([
                "custom_name",
            ]);
        },
    );

    it("lets quick add substitute a catalog reference for a typed name", () => {
        expect(names(getRequiredFields(ctx("model", "create-quick", {})))).toContain("custom_name");
        const withCatalog = ctx("model", "create-quick", { catalog_id: "abc-123" });
        expect(names(getRequiredFields(withCatalog))).not.toContain("custom_name");
    });

    it("never marks an invisible field required", () => {
        // listing_price is only visible when the item is for sale; it has no
        // requiredWhen, but this guards the general invariant.
        for (const category of ["model", "tack", "prop", "diorama", "other_model"] as AssetCategory[]) {
            const context = ctx(category, "create-full", {});
            for (const spec of getRequiredFields(context)) {
                expect(isFieldVisible(spec, context), spec.name).toBe(true);
            }
        }
    });
});

describe("missing-field reporting", () => {
    it("names the empty required fields, in the order they appear on the page", () => {
        const missing = getMissingRequiredFields(ctx("model", "create-full", {}));
        expect(missing).toEqual([
            { name: "custom_name", label: "Custom Name" },
            { name: "finish_type", label: "Finish Type" },
            { name: "condition_grade", label: "Condition Grade" },
        ]);
    });

    it("uses the category's own label for the item name", () => {
        const missing = getMissingRequiredFields(ctx("diorama", "create-full", {}));
        expect(missing).toEqual([{ name: "custom_name", label: "Scene Name" }]);
    });

    it("treats whitespace as empty", () => {
        const missing = getMissingRequiredFields(
            ctx("tack", "create-full", { custom_name: "   " }),
        );
        expect(names(missing)).toEqual(["custom_name"]);
    });

    it("clears once every required field has a value", () => {
        const context = ctx("model", "create-full", {
            custom_name: "Midnight Star",
            finish_type: "OF",
            condition_grade: "Mint",
        });
        expect(getMissingRequiredFields(context)).toEqual([]);
        expect(canSubmit(context)).toBe(true);
    });

    it("blocks submit while anything required is empty", () => {
        expect(canSubmit(ctx("model", "create-full", { custom_name: "x", finish_type: "OF" }))).toBe(
            false,
        );
    });
});

describe("hasValue", () => {
    it.each([
        [undefined, false],
        [null, false],
        ["", false],
        ["  ", false],
        ["x", true],
        [[], false],
        [["Real Leather"], true],
        [0, true],
        [12.5, true],
        [NaN, false],
        [false, true],
    ])("%s → %s", (value, expected) => {
        expect(hasValue(value)).toBe(expected);
    });
});

describe("per-category visibility", () => {
    it("hides finishing artist and edition info outside models", () => {
        for (const category of ["tack", "prop", "diorama", "other_model"] as AssetCategory[]) {
            const visible = names(getVisibleFields(ctx(category, "create-full", {})));
            expect(visible).not.toContain("finishing_artist");
            expect(visible).not.toContain("edition_number");
            expect(visible).not.toContain("edition_size");
        }
    });

    it("hides the maker credit for other models only", () => {
        expect(isFieldVisible(getFieldSpec("sculptor")!, ctx("tack", "create-full"))).toBe(true);
        expect(isFieldVisible(getFieldSpec("sculptor")!, ctx("other_model", "create-full"))).toBe(
            false,
        );
    });

    it("shows the show-bio block for models only", () => {
        expect(getGroupFields(ctx("model", "create-full"), "showbio")).toHaveLength(4);
        for (const category of ["tack", "prop", "diorama", "other_model"] as AssetCategory[]) {
            expect(getGroupFields(ctx(category, "create-full"), "showbio")).toHaveLength(0);
        }
    });

    it("gives each category its own attribute set and nobody else's", () => {
        expect(names(getGroupFields(ctx("tack", "create-full"), "attributes"))).toEqual([
            "tack_type",
            "discipline",
            "materials",
            "fits_molds",
            "working_parts",
        ]);
        expect(names(getGroupFields(ctx("prop", "create-full"), "attributes"))).toEqual([
            "materials",
            "prop_category",
            "dimensions",
            "terrain_setting",
        ]);
        expect(names(getGroupFields(ctx("model", "create-full"), "attributes"))).toEqual([]);
    });

    it("reveals price and seller notes only once the item is for sale", () => {
        const notForSale = ctx("model", "create-full", { trade_status: "Not for Sale" });
        expect(names(getGroupFields(notForSale, "market"))).toEqual(["trade_status"]);

        for (const status of ["For Sale", "Open to Offers"]) {
            const forSale = ctx("model", "create-full", { trade_status: status });
            expect(names(getGroupFields(forSale, "market"))).toEqual([
                "trade_status",
                "listing_price",
                "marketplace_notes",
            ]);
        }
    });

    it("keeps price hidden for a stolen/missing listing", () => {
        const stolen = ctx("model", "create-full", { trade_status: "Stolen/Missing" });
        expect(names(getGroupFields(stolen, "market"))).toEqual(["trade_status"]);
    });
});

describe("mode filtering", () => {
    it("gives quick add a short, curated list", () => {
        const quick = names(getVisibleFields(ctx("model", "create-quick", {})));
        expect(quick).toEqual(["custom_name", "finish_type", "condition_grade", "visibility"]);
    });

    it("gives quick add the tri-state visibility the old boolean couldn't express", () => {
        // The legacy quick form had a boolean and could never produce
        // "unlisted". The engine hands it the same field as the full form.
        const spec = getFieldSpec("visibility")!;
        expect(isFieldVisible(spec, ctx("model", "create-quick"))).toBe(true);
        expect(spec.options?.map((o) => o.value)).toEqual(["public", "unlisted", "private"]);
    });

    it("offers the vault to the full and edit forms, not quick add", () => {
        expect(getGroupFields(ctx("model", "create-quick"), "vault")).toHaveLength(0);
        expect(getGroupFields(ctx("model", "create-full"), "vault").length).toBeGreaterThan(0);
        expect(getGroupFields(ctx("model", "edit"), "vault").length).toBeGreaterThan(0);
    });
});

describe("disabled states", () => {
    it("disables the condition grade on a work in progress", () => {
        const spec = getFieldSpec("condition_grade")!;
        expect(isFieldDisabled(spec, ctx("model", "create-full", { life_stage: "in_progress" }))).toBe(
            true,
        );
        expect(isFieldDisabled(spec, ctx("model", "create-full", { life_stage: "completed" }))).toBe(
            false,
        );
    });

    it("disables both money fields once the item is marked a trade", () => {
        for (const name of ["purchase_price", "estimated_current_value"]) {
            const spec = getFieldSpec(name)!;
            expect(isFieldDisabled(spec, ctx("model", "create-full", { is_trade: true })), name).toBe(
                true,
            );
            expect(isFieldDisabled(spec, ctx("model", "create-full", { is_trade: false })), name).toBe(
                false,
            );
        }
    });
});

describe("group ordering", () => {
    it("walks a model through identity → show bio → market → visibility → vault", () => {
        expect(getActiveGroups(ctx("model", "create-full", {}))).toEqual([
            "identity",
            "showbio",
            "market",
            "visibility",
            "vault",
        ]);
    });

    it("slots a tack item's attributes in after its identity", () => {
        expect(getActiveGroups(ctx("tack", "create-full", {}))).toEqual([
            "identity",
            "attributes",
            "market",
            "visibility",
            "vault",
        ]);
    });
});

describe("getDomId", () => {
    it("returns the recorded id for a mode", () => {
        expect(getDomId(getFieldSpec("custom_name")!, "create-full")).toBe("custom-name");
        expect(getDomId(getFieldSpec("custom_name")!, "edit")).toBe("edit-name");
    });

    it("returns undefined rather than inventing one", () => {
        expect(getDomId(getFieldSpec("custom_name")!, "import")).toBeUndefined();
        expect(getDomId(getFieldSpec("tack_type")!, "create-full")).toBeUndefined();
    });
});
