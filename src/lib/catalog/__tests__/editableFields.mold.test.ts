import { describe, it, expect } from "vitest";
import { buildEditableFields } from "@/lib/catalog/editableFields";

const base = { id: "x", title: "Adios", maker: "Breyer", scale: "Traditional (1:9)", attributes: {} };

describe("buildEditableFields — a mold is its own name", () => {
    it("does not offer the Mold field on a mold entry", () => {
        const keys = buildEditableFields({ ...base, item_type: "plastic_mold" }).map((f) => f.key);
        expect(keys).not.toContain("mold_name");
        expect(keys).toContain("title");
    });

    it("still offers the Mold field on a release", () => {
        const keys = buildEditableFields({ ...base, item_type: "plastic_release" }).map((f) => f.key);
        expect(keys).toContain("mold_name");
    });
});
