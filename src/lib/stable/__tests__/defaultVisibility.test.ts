import { describe, expect, it } from "vitest";
import {
    fromLegacyPublic,
    isHorseVisibility,
    isMissingVisibilityColumn,
    readDefaultVisibility,
} from "@/lib/stable/defaultVisibility";

/** A stand-in for supabase.from("users").select(...).eq(...).maybeSingle(). */
function client(responses: { data: unknown; error: unknown }[]) {
    const queue = [...responses];
    const selects: string[] = [];
    return {
        selects,
        from: () => ({
            select: (cols: string) => {
                selects.push(cols);
                return { eq: () => ({ maybeSingle: async () => queue.shift() }) };
            },
        }),
    };
}

describe("where new horses start", () => {
    it("recognises the three choices", () => {
        expect(["public", "unlisted", "private"].every(isHorseVisibility)).toBe(true);
        expect(isHorseVisibility("friends")).toBe(false);
    });

    it("reads the older on/off setting: off means Private", () => {
        expect(fromLegacyPublic(false)).toBe("private");
        expect(fromLegacyPublic(true)).toBe("public");
        expect(fromLegacyPublic(null)).toBe("public");
    });

    it("uses the three-way setting when it is there", async () => {
        const c = client([{ data: { default_horse_visibility: "unlisted", default_horse_public: true }, error: null }]);
        expect(await readDefaultVisibility(c, "u1")).toBe("unlisted");
    });

    it("falls back to the on/off setting before migration 234", async () => {
        const c = client([
            { data: null, error: { code: "42703", message: 'column users.default_horse_visibility does not exist' } },
            { data: { default_horse_public: false }, error: null },
        ]);
        expect(await readDefaultVisibility(c, "u1")).toBe("private");
        expect(c.selects[1]).toBe("default_horse_public");
    });

    it("spots the missing column error only", () => {
        expect(isMissingVisibilityColumn({ code: "PGRST204", message: "Could not find the 'default_horse_visibility' column" })).toBe(true);
        expect(isMissingVisibilityColumn({ code: "PGRST204", message: "Could not find the 'country' column" })).toBe(false);
        expect(isMissingVisibilityColumn(null)).toBe(false);
    });
});
