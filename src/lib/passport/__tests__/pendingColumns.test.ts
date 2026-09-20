import { describe, expect, it } from "vitest";

import { colorText, isMissingPendingColumn, PENDING_HORSE_COLUMNS, selectWithPending, withoutPendingColumns } from "../pendingColumns";

describe("pending horse columns", () => {
    it("covers the resin identity and color", () => {
        expect(PENDING_HORSE_COLUMNS).toEqual(["resin_material", "resin_body", "cast_by", "prep_artist", "color"]);
    });

    it("recognises only the pre-paste failure for these columns", () => {
        expect(isMissingPendingColumn({ code: "42703", message: "column user_horses.color does not exist" })).toBe(true);
        expect(isMissingPendingColumn({ code: "42703", message: "column user_horses.bio does not exist" })).toBe(false);
        expect(isMissingPendingColumn({ code: "23505", message: "color" })).toBe(false);
        expect(withoutPendingColumns({ custom_name: "Smoky", color: "bay", cast_by: "MVS" })).toEqual({ custom_name: "Smoky" });
    });

    it("retries a select without the pending columns when they are missing", async () => {
        const calls: string[] = [];
        const result = await selectWithPending(
            async (cols) => {
                calls.push(cols);
                return cols.includes("color")
                    ? { data: null, error: { code: "42703", message: "column user_horses.color does not exist" } }
                    : { data: [{ id: "h" }], error: null };
            },
            "id, assigned_breed",
            "color",
        );
        expect(calls).toEqual(["id, assigned_breed, color", "id, assigned_breed"]);
        expect(result.data).toEqual([{ id: "h" }]);
    });

    it("trims and caps a color", () => {
        expect(colorText("  bay tobiano ")).toBe("bay tobiano");
        expect(colorText("")).toBeNull();
        expect(colorText("x".repeat(80))?.length).toBe(60);
    });
});
