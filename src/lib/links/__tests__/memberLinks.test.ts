import { describe, it, expect } from "vitest";
import { linkEntries, normalizeMemberLinks, PROFILE_LINK_KEYS, STUDIO_LINK_KEYS } from "@/lib/links/memberLinks";

describe("member links", () => {
    it("keeps a feedback board link only as https, and only for the slots asked for", () => {
        const typed = {
            facebook: "@modelhorsetraders",
            feedback: "facebook.com/groups/mh-transaction-board/posts/123",
            website: "javascript:alert(1)",
            instagram: "equicollect",
        };
        expect(normalizeMemberLinks(typed, PROFILE_LINK_KEYS)).toEqual({
            facebook: "https://www.facebook.com/modelhorsetraders",
            feedback: "https://facebook.com/groups/mh-transaction-board/posts/123",
            instagram: "https://www.instagram.com/equicollect/",
        });
        // A storefront never carries the feedback slot.
        expect(normalizeMemberLinks(typed, STUDIO_LINK_KEYS)).not.toHaveProperty("feedback");
    });

    it("drops junk, blanks and non-http schemes", () => {
        expect(normalizeMemberLinks({ website: "ftp://x.y", feedback: "   ", facebook: 42 })).toEqual({});
        expect(normalizeMemberLinks(null)).toEqual({});
    });

    it("renders in the order of the slots, with the feedback glyph", () => {
        const entries = linkEntries({ feedback: "https://a.b/c", facebook: "https://www.facebook.com/x" }, PROFILE_LINK_KEYS);
        expect(entries.map((e) => e.key)).toEqual(["facebook", "feedback"]);
        expect(entries[1]).toMatchObject({ label: "Feedback board", glyph: "🤝", href: "https://a.b/c" });
    });
});
