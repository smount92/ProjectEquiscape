import { describe, it, expect } from "vitest";
import { isPaddockPin, paddockPinRefusal } from "@/lib/feed/paddockPin";

describe("Paddock pin", () => {
    it("is a pinned, top-level post with no barn", () => {
        expect(isPaddockPin({ is_pinned: true, group_id: null, parent_id: null })).toBe(true);
    });

    it("a barn pin stays in the barn", () => {
        expect(isPaddockPin({ is_pinned: true, group_id: "barn-1", parent_id: null })).toBe(false);
        expect(paddockPinRefusal({ group_id: "barn-1" })).toMatch(/inside the barn/);
    });

    it("replies and unpinned posts are not pins", () => {
        expect(isPaddockPin({ is_pinned: true, parent_id: "root" })).toBe(false);
        expect(isPaddockPin({ is_pinned: false })).toBe(false);
        expect(isPaddockPin({})).toBe(false);
        expect(paddockPinRefusal({ parent_id: "root" })).toMatch(/Replies/);
        expect(paddockPinRefusal({})).toBeNull();
    });
});
