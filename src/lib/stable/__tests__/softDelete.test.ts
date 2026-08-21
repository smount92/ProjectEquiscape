import { describe, expect, it } from "vitest";

import {
    DELETED_NAME_KEY,
    DELETED_NAME_PLACEHOLDER,
    clearStashedName,
    readStashedName,
    stashDeletedName,
} from "@/lib/stable/softDelete";

describe("softDelete — name stash", () => {
    describe("stashDeletedName", () => {
        it("parks the name under the namespaced key", () => {
            expect(stashDeletedName({}, "Midnight Star")).toEqual({
                [DELETED_NAME_KEY]: "Midnight Star",
            });
        });

        it("keeps the existing attribute bag intact", () => {
            const bag = stashDeletedName({ discipline: "Dressage" }, "Patches");
            expect(bag.discipline).toBe("Dressage");
            expect(bag[DELETED_NAME_KEY]).toBe("Patches");
        });

        it("does not mutate the bag it was handed", () => {
            const original = { discipline: "Dressage" };
            stashDeletedName(original, "Patches");
            expect(original).toEqual({ discipline: "Dressage" });
        });

        it("tolerates a null bag", () => {
            expect(stashDeletedName(null, "Stormy")).toEqual({ [DELETED_NAME_KEY]: "Stormy" });
        });

        it("stashes nothing when the name is already the placeholder", () => {
            // A second delete of an already-scrubbed row must not overwrite
            // the real name with "[Deleted]".
            const bag = stashDeletedName({ [DELETED_NAME_KEY]: "Real Name" }, DELETED_NAME_PLACEHOLDER);
            expect(bag[DELETED_NAME_KEY]).toBe("Real Name");
        });

        it("stashes nothing for an empty or missing name", () => {
            expect(stashDeletedName({}, "")).toEqual({});
            expect(stashDeletedName({}, "   ")).toEqual({});
            expect(stashDeletedName({}, null)).toEqual({});
        });

        it("uses a key no category attribute can collide with", () => {
            // cleanAttributeBag strips keys the category doesn't own; the
            // colon guarantees no FieldSpec.attributeKey ever matches.
            expect(DELETED_NAME_KEY).toContain(":");
        });
    });

    describe("readStashedName", () => {
        it("reads the stash back", () => {
            expect(readStashedName({ [DELETED_NAME_KEY]: "Midnight Star" })).toBe("Midnight Star");
        });

        it("returns null when nothing was stashed (deleted before the shelf shipped)", () => {
            expect(readStashedName({})).toBeNull();
            expect(readStashedName(null)).toBeNull();
            expect(readStashedName({ discipline: "Dressage" })).toBeNull();
        });

        it("returns null for a non-string or blank stash", () => {
            expect(readStashedName({ [DELETED_NAME_KEY]: 42 })).toBeNull();
            expect(readStashedName({ [DELETED_NAME_KEY]: "  " })).toBeNull();
        });
    });

    describe("clearStashedName", () => {
        it("drops the key and leaves the rest alone", () => {
            const bag = clearStashedName({ [DELETED_NAME_KEY]: "Patches", discipline: "Dressage" });
            expect(bag).toEqual({ discipline: "Dressage" });
        });

        it("is a no-op on a bag with no stash", () => {
            expect(clearStashedName({ discipline: "Dressage" })).toEqual({ discipline: "Dressage" });
            expect(clearStashedName(null)).toEqual({});
        });
    });

    it("round-trips a name through delete and restore", () => {
        const live = { discipline: "Dressage" };
        const deleted = stashDeletedName(live, "Midnight Star");
        expect(readStashedName(deleted)).toBe("Midnight Star");
        expect(clearStashedName(deleted)).toEqual(live);
    });
});
