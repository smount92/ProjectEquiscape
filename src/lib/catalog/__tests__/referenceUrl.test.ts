import { describe, it, expect } from "vitest";
import { slugify, referenceHref } from "../referenceUrl";

describe("slugify", () => {
    it("lowercases, hyphenates, and trims", () => {
        expect(slugify("Family Arabian Stallion")).toBe("family-arabian-stallion");
        expect(slugify("  Misty of Chincoteague  ")).toBe("misty-of-chincoteague");
        expect(slugify("Man O' War")).toBe("man-o-war");
    });

    it("collapses runs of punctuation and strips symbols", () => {
        expect(slugify("Birka & Ribe")).toBe("birka-ribe");
        expect(slugify("#712 — Misty!!!")).toBe("712-misty");
        expect(slugify("A---B")).toBe("a-b");
    });

    it("strips Latin accents to match the SQL catalog_slugify()", () => {
        expect(slugify("Blóm")).toBe("blom");
        expect(slugify("Öjvind")).toBe("ojvind"); // uppercase accent
        expect(slugify("Skógafoss")).toBe("skogafoss");
        expect(slugify("Stjärna")).toBe("stjarna");
        expect(slugify("Vegvísir")).toBe("vegvisir");
        expect(slugify("Støvel")).toBe("stovel"); // ø is not NFD-decomposable
    });

    it("handles empty / nullish input", () => {
        expect(slugify("")).toBe("");
        expect(slugify(null)).toBe("");
        expect(slugify(undefined)).toBe("");
        expect(slugify("!!!")).toBe("");
    });
});

describe("referenceHref", () => {
    it("prefers stored slugs", () => {
        expect(
            referenceHref({ id: "abc", maker: "Breyer", title: "Midnattssol", maker_slug: "breyer", slug: "midnattssol" }),
        ).toBe("/reference/breyer/midnattssol");
    });

    it("falls back to slugifying maker/title when slugs are absent", () => {
        expect(referenceHref({ id: "abc12345", maker: "Peter Stone", title: "Ideal Stock Horse" })).toBe(
            "/reference/peter-stone/ideal-stock-horse",
        );
    });

    it("falls back to a short id when the title has no sluggable chars", () => {
        expect(referenceHref({ id: "deadbeef-1111", maker: "Breyer", title: "!!!" })).toBe(
            "/reference/breyer/item-deadbeef",
        );
    });

    it("uses 'unknown' when maker is missing", () => {
        expect(referenceHref({ id: "abcdef00", maker: null, title: "Thing", slug: "thing" })).toBe(
            "/reference/unknown/thing",
        );
    });
});
