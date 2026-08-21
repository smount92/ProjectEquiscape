import { describe, it, expect } from "vitest";
import {
    matchLongestAlias,
    resolveMentions,
    candidateFirstTokens,
    splitMentionSegments,
    tokenizeAlias,
    findMentionQuery,
    applyMentionCompletion,
} from "@/lib/feed/mentionMatch";

const ALIASES = ["black", "black fox farm", "black fox", "Amanda", "Silver Creek Stables"];

describe("tokenizeAlias", () => {
    it("splits on runs of whitespace and drops empties", () => {
        expect(tokenizeAlias("  black   fox farm ")).toEqual(["black", "fox", "farm"]);
    });

    it("returns an empty array for blank input", () => {
        expect(tokenizeAlias("   ")).toEqual([]);
    });
});

describe("matchLongestAlias", () => {
    it("prefers the longest alias over a shorter prefix of it", () => {
        expect(matchLongestAlias("black fox farm loved this", ALIASES)).toBe("black fox farm");
    });

    it("falls back to the shorter alias when the longer one does not fit", () => {
        expect(matchLongestAlias("black fox went home", ALIASES)).toBe("black fox");
    });

    it("matches a single-token alias", () => {
        expect(matchLongestAlias("black is here", ALIASES)).toBe("black");
    });

    it("is case-insensitive but returns the stored casing", () => {
        expect(matchLongestAlias("silver creek stables rocks", ALIASES)).toBe("Silver Creek Stables");
    });

    it("requires whole-token matches — no substring bleed", () => {
        // "farmhouse" is not "farm", so the 3-token alias must not win.
        expect(matchLongestAlias("black fox farmhouse", ALIASES)).toBe("black fox");
    });

    it("returns null when nothing matches", () => {
        expect(matchLongestAlias("nobody at all", ALIASES)).toBeNull();
    });

    it("returns null for an empty candidate", () => {
        expect(matchLongestAlias("   ", ALIASES)).toBeNull();
    });

    it("returns null against an empty alias list", () => {
        expect(matchLongestAlias("black fox farm", [])).toBeNull();
    });
});

describe("resolveMentions", () => {
    it("resolves each candidate to its longest alias", () => {
        expect(resolveMentions(["black fox farm loved this", "Amanda too"], ALIASES)).toEqual([
            "black fox farm",
            "Amanda",
        ]);
    });

    it("de-duplicates case-insensitively and preserves order", () => {
        expect(resolveMentions(["amanda hi", "Amanda again", "black"], ALIASES)).toEqual([
            "Amanda",
            "black",
        ]);
    });

    it("drops unmatched candidates", () => {
        expect(resolveMentions(["ghost user"], ALIASES)).toEqual([]);
    });
});

describe("candidateFirstTokens", () => {
    it("lowercases and de-duplicates first tokens", () => {
        expect(candidateFirstTokens(["Black Fox Farm", "black cat", "Amanda"]).sort()).toEqual([
            "amanda",
            "black",
        ]);
    });

    it("ignores blank candidates", () => {
        expect(candidateFirstTokens(["  ", ""])).toEqual([]);
    });
});

describe("splitMentionSegments", () => {
    it("links a spaced alias as one mention", () => {
        const segments = splitMentionSegments("hey @black fox farm loved this", ALIASES);
        expect(segments).toEqual([
            { type: "text", value: "hey " },
            { type: "mention", value: "black fox farm" },
            { type: "text", value: " loved this" },
        ]);
    });

    it("stops the mention at the alias, not the sentence", () => {
        const segments = splitMentionSegments("@black is fast", ALIASES);
        expect(segments[0]).toEqual({ type: "mention", value: "black" });
        expect(segments[1]).toEqual({ type: "text", value: " is fast" });
    });

    it("keeps legacy quoted mentions working", () => {
        const segments = splitMentionSegments('@"John Smith" said hi', []);
        expect(segments[0]).toEqual({ type: "mention", value: "John Smith" });
    });

    it("keeps legacy bare handles working with no alias list", () => {
        const segments = splitMentionSegments("ping @Alice please", []);
        expect(segments.filter((s) => s.type === "mention")).toEqual([
            { type: "mention", value: "Alice" },
        ]);
    });

    it("does not treat an email address as a mention", () => {
        const segments = splitMentionSegments("mail me at me@example.com", ALIASES);
        expect(segments.every((s) => s.type === "text")).toBe(true);
    });

    it("handles multiple mentions in one line", () => {
        const segments = splitMentionSegments("@Amanda and @black fox farm", ALIASES);
        expect(segments.filter((s) => s.type === "mention").map((s) => s.value)).toEqual([
            "Amanda",
            "black fox farm",
        ]);
    });

    it("returns the whole string as text when there are no mentions", () => {
        expect(splitMentionSegments("no mentions here", ALIASES)).toEqual([
            { type: "text", value: "no mentions here" },
        ]);
    });

    it("returns nothing for an empty string", () => {
        expect(splitMentionSegments("", ALIASES)).toEqual([]);
    });

    it("survives a bare @ and a double @@", () => {
        expect(() => splitMentionSegments("@ @@ @", ALIASES)).not.toThrow();
    });

    it("round-trips every non-mention character", () => {
        const input = 'hey @black fox farm and @Amanda - see @"John Smith" too';
        const rebuilt = splitMentionSegments(input, ALIASES)
            .map((s) => (s.type === "mention" ? `@${s.value}` : s.value))
            .join("");
        // Quoted mentions lose their quotes; everything else is byte-identical.
        expect(rebuilt).toBe('hey @black fox farm and @Amanda - see @John Smith too');
    });
});

describe("findMentionQuery", () => {
    it("finds the mention the caret sits in", () => {
        const text = "hey @bla";
        expect(findMentionQuery(text, text.length)).toEqual({ start: 4, query: "bla" });
    });

    it("keeps matching across spaces so spaced aliases can be typed", () => {
        const text = "hey @black fox";
        expect(findMentionQuery(text, text.length)).toEqual({ start: 4, query: "black fox" });
    });

    it("gives up once the run looks like prose, not a name", () => {
        const text = "@black fox farm loved this a lot";
        expect(findMentionQuery(text, text.length)).toBeNull();
    });

    it("ignores an email address", () => {
        const text = "write to me@example";
        expect(findMentionQuery(text, text.length)).toBeNull();
    });

    it("does not reach across a newline", () => {
        const text = "@alice\nnext line";
        expect(findMentionQuery(text, text.length)).toBeNull();
    });

    it("returns null when there is no @ before the caret", () => {
        expect(findMentionQuery("nothing here", 5)).toBeNull();
    });

    it("handles a bare @ as an empty query", () => {
        expect(findMentionQuery("@", 1)).toEqual({ start: 0, query: "" });
    });

    it("clamps an out-of-range caret", () => {
        expect(findMentionQuery("@bob", 999)).toEqual({ start: 0, query: "bob" });
    });
});

describe("applyMentionCompletion", () => {
    it("replaces the partial mention with the full alias plus a space", () => {
        const text = "hey @bla";
        const range = findMentionQuery(text, text.length)!;
        expect(applyMentionCompletion(text, range, text.length, "black fox farm")).toEqual({
            text: "hey @black fox farm ",
            caret: 20,
        });
    });

    it("preserves text after the caret", () => {
        const text = "hey @bla rest";
        const range = findMentionQuery(text, 8)!;
        const result = applyMentionCompletion(text, range, 8, "black");
        expect(result.text).toBe("hey @black  rest");
    });
});
