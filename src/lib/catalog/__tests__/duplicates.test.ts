import { describe, it, expect } from "vitest";
import { duplicateReportRefusal, duplicateTarget, isMissingDuplicateType } from "@/lib/catalog/duplicates";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("duplicate reports", () => {
    it("reads the entry to keep out of field_changes", () => {
        expect(duplicateTarget({ duplicate_of: B, duplicate_of_title: "Adios" })).toEqual({
            duplicate_of: B,
            duplicate_of_title: "Adios",
        });
        expect(duplicateTarget({ duplicate_of: "not-a-uuid" })).toBeNull();
        expect(duplicateTarget(null)).toBeNull();
    });

    it("must be filed from an entry, name another entry, and not itself", () => {
        expect(duplicateReportRefusal({ catalogItemId: null, fieldChanges: { duplicate_of: B } })).toMatch(/from the entry/);
        expect(duplicateReportRefusal({ catalogItemId: A, fieldChanges: {} })).toMatch(/Pick the entry/);
        expect(duplicateReportRefusal({ catalogItemId: A, fieldChanges: { duplicate_of: A } })).toMatch(/same entry/);
        expect(duplicateReportRefusal({ catalogItemId: A, fieldChanges: { duplicate_of: B } })).toBeNull();
    });

    it("recognises the pre-migration CHECK refusal", () => {
        expect(isMissingDuplicateType({ code: "23514", message: 'violates check constraint "catalog_suggestions_suggestion_type_check"' })).toBe(true);
        expect(isMissingDuplicateType({ code: "42501", message: "permission denied" })).toBe(false);
        expect(isMissingDuplicateType(null)).toBe(false);
    });
});
