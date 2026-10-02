import { describe, it, expect } from "vitest";
import { cameFrom, parseTrail, pathOf, trailPrevious, trailPush, trailReplace, trailTraverse, trailUrl } from "@/lib/nav/trail";

describe("navigation trail", () => {
    it("records forward navigations and ignores a repeat of the top", () => {
        let t = trailPush([], "/market?price=500-1500");
        t = trailPush(t, "/community/abc?from=market");
        t = trailPush(t, "/community/abc?from=market");
        expect(t).toEqual(["/market?price=500-1500", "/community/abc?from=market"]);
        expect(trailPrevious(t)).toBe("/market?price=500-1500");
    });

    it("treats a move to the entry under the top as Back, anything else as a new top", () => {
        const t = ["/market?price=500-1500", "/community/abc"];
        expect(trailTraverse(t, "/market?price=500-1500")).toEqual(["/market?price=500-1500"]);
        expect(trailTraverse(t, "/shows")).toEqual([...t, "/shows"]);
    });

    it("a replace changes the current entry only", () => {
        expect(trailReplace(["/market", "/market?price=1"], "/market?price=2")).toEqual(["/market", "/market?price=2"]);
        expect(trailReplace([], "/x")).toEqual(["/x"]);
    });

    it("knows when the reader came from a page's logical parent, whatever its filters", () => {
        const t = ["/market?price=500-1500&trade=Open+to+Offers", "/community/abc?from=market"];
        expect(cameFrom(t, "/market")).toBe(true);
        expect(cameFrom(t, "/community")).toBe(false);
        expect(cameFrom(["/community/abc"], "/market")).toBe(false);
    });

    it("normalises urls and survives junk storage", () => {
        expect(trailUrl("https://modelhorsehub.com/market?x=1#top")).toBe("/market?x=1");
        expect(pathOf("/market?x=1")).toBe("/market");
        expect(pathOf("/market#top")).toBe("/market");
        expect(parseTrail("not json")).toEqual([]);
        expect(parseTrail('["/a", 3, "/b"]')).toEqual(["/a", "/b"]);
        expect(parseTrail(null)).toEqual([]);
    });
});
