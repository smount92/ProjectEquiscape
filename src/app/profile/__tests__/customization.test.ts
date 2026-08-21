import { describe, expect, it } from "vitest";

import {
    applyFeaturedOrder,
    DEFAULT_CUSTOMIZATION,
    DEFAULT_THEME_ID,
    isDefaultCustomization,
    MAX_FEATURED,
    MAX_PRONOUNS,
    MAX_TAGLINE,
    PROFILE_SECTIONS,
    PROFILE_THEMES,
    sanitizeCustomization,
    sectionVisible,
    themeById,
    themeStyle,
} from "../customization";

const UUID_A = "11111111-2222-3333-4444-555555555555";
const UUID_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const UUID_C = "99999999-8888-7777-6666-555555555555";

describe("the theme registry", () => {
    // The legibility guarantee is structural, not a matter of taste:
    // a theme restyles the material ramps and nothing else, so the
    // cream text ramp is the same on every profile on the site.
    const MATERIAL_KEYS = [
        "leather-deep",
        "leather",
        "leather-hi",
        "brass-dark",
        "brass",
        "brass-hi",
        "brass-ink",
        "thread",
    ];

    it("gives every theme the full material ramp and nothing else", () => {
        for (const theme of PROFILE_THEMES) {
            expect(Object.keys(theme.vars).sort()).toEqual([...MATERIAL_KEYS].sort());
        }
    });

    it("never lets a theme touch the text-on-leather ramp", () => {
        for (const theme of PROFILE_THEMES) {
            for (const key of Object.keys(theme.vars)) {
                expect(key.startsWith("leather-text")).toBe(false);
            }
        }
    });

    it("only ships literal hex colors — no user input can reach CSS", () => {
        for (const theme of PROFILE_THEMES) {
            for (const value of Object.values(theme.vars)) {
                expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
            }
        }
    });

    it("has unique ids and includes the default", () => {
        const ids = PROFILE_THEMES.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain(DEFAULT_THEME_ID);
    });

    it("falls back to the default for unknown or missing ids", () => {
        expect(themeById("not-a-theme").id).toBe(DEFAULT_THEME_ID);
        expect(themeById(null).id).toBe(DEFAULT_THEME_ID);
        expect(themeById(undefined).id).toBe(DEFAULT_THEME_ID);
        expect(themeById("forest").id).toBe("forest");
    });
});

describe("themeStyle", () => {
    it("emits nothing for the default theme", () => {
        expect(themeStyle(DEFAULT_THEME_ID)).toBeUndefined();
        expect(themeStyle("bogus")).toBeUndefined();
    });

    it("prefixes every key with -- for a custom theme", () => {
        const style = themeStyle("ink");
        expect(style).toBeDefined();
        for (const key of Object.keys(style!)) {
            expect(key.startsWith("--")).toBe(true);
        }
        expect(style!["--leather"]).toBe("#1F2A3C");
    });
});

describe("sanitizeCustomization", () => {
    it("returns the default for anything that isn't an object", () => {
        for (const input of [null, undefined, "", 0, "saddle", [], [1, 2]]) {
            expect(sanitizeCustomization(input)).toEqual(DEFAULT_CUSTOMIZATION);
        }
    });

    it("does not hand back the shared default object", () => {
        const a = sanitizeCustomization(null);
        a.featured.push(UUID_A);
        expect(DEFAULT_CUSTOMIZATION.featured).toEqual([]);
    });

    it("falls back to the default theme for an unknown id", () => {
        expect(sanitizeCustomization({ theme: "#fff" }).theme).toBe(DEFAULT_THEME_ID);
        expect(sanitizeCustomization({ theme: 42 }).theme).toBe(DEFAULT_THEME_ID);
        expect(sanitizeCustomization({ theme: "oxblood" }).theme).toBe("oxblood");
    });

    describe("free text", () => {
        it("collapses whitespace and trims", () => {
            expect(sanitizeCustomization({ tagline: "  two   words  " }).tagline).toBe("two words");
        });

        it("clamps to the advertised maximums", () => {
            const long = "x".repeat(500);
            expect(sanitizeCustomization({ tagline: long }).tagline).toHaveLength(MAX_TAGLINE);
            expect(sanitizeCustomization({ pronouns: long }).pronouns).toHaveLength(MAX_PRONOUNS);
        });

        it("strips control characters, zero-width joiners and bidi overrides", () => {
            // Built from codepoints so the hostile characters are
            // visible in the source rather than lurking as invisibles.
            const BELL = String.fromCharCode(0x0007);
            const ZWSP = String.fromCharCode(0x200b);
            const RLO = String.fromCharCode(0x202e);
            const PDI = String.fromCharCode(0x2069);
            const BOM = String.fromCharCode(0xfeff);

            const nasty = `he${BELL}llo${ZWSP} ${RLO}gnitteb${PDI}${BOM}`;
            expect(sanitizeCustomization({ tagline: nasty }).tagline).toBe("hello gnitteb");
        });

        it("treats a whitespace-only or invisible-only value as absent", () => {
            expect(sanitizeCustomization({ tagline: "   " }).tagline).toBeNull();
            expect(
                sanitizeCustomization({ tagline: String.fromCharCode(0x200b) }).tagline,
            ).toBeNull();
            expect(
                sanitizeCustomization({ tagline: String.fromCharCode(0x0007) }).tagline,
            ).toBeNull();
        });

        it("ignores non-strings", () => {
            expect(sanitizeCustomization({ tagline: 12 }).tagline).toBeNull();
            expect(sanitizeCustomization({ pronouns: {} }).pronouns).toBeNull();
        });
    });

    describe("bannerPath", () => {
        it("accepts a plain storage path", () => {
            const path = `${UUID_A}/banner_1234.webp`;
            expect(sanitizeCustomization({ bannerPath: path }).bannerPath).toBe(path);
        });

        it("rejects traversal, schemes and leading slashes", () => {
            for (const bad of [
                "../../etc/passwd",
                `${UUID_A}/../${UUID_B}/avatar.webp`,
                "https://example.com/x.png",
                "/absolute/path.webp",
                "",
                "   ",
            ]) {
                expect(sanitizeCustomization({ bannerPath: bad }).bannerPath).toBeNull();
            }
        });

        it("rejects an over-long path", () => {
            expect(sanitizeCustomization({ bannerPath: "a".repeat(300) }).bannerPath).toBeNull();
        });
    });

    describe("featured", () => {
        it("keeps order, lowercases, and drops non-uuids", () => {
            const result = sanitizeCustomization({
                featured: [UUID_B.toUpperCase(), "nope", 5, UUID_A],
            });
            expect(result.featured).toEqual([UUID_B, UUID_A]);
        });

        it("dedupes and caps at the maximum", () => {
            const many = Array.from(
                { length: 20 },
                (_, i) => `${String(i).padStart(8, "0")}-2222-3333-4444-555555555555`,
            );
            expect(sanitizeCustomization({ featured: [...many, ...many] }).featured).toHaveLength(
                MAX_FEATURED,
            );
            expect(sanitizeCustomization({ featured: [UUID_A, UUID_A] }).featured).toEqual([UUID_A]);
        });

        it("ignores a non-array", () => {
            expect(sanitizeCustomization({ featured: UUID_A }).featured).toEqual([]);
        });
    });

    describe("hidden sections", () => {
        it("keeps only known section ids", () => {
            const result = sanitizeCustomization({ hidden: ["posts", "nonsense", 7, "barns"] });
            expect(result.hidden).toEqual(["posts", "barns"]);
        });

        it("dedupes", () => {
            expect(sanitizeCustomization({ hidden: ["posts", "posts"] }).hidden).toEqual(["posts"]);
        });

        it("accepts every declared section", () => {
            expect(sanitizeCustomization({ hidden: [...PROFILE_SECTIONS] }).hidden).toEqual([
                ...PROFILE_SECTIONS,
            ]);
        });
    });

    it("is idempotent", () => {
        const once = sanitizeCustomization({
            theme: "pewter",
            tagline: "  Chasing a NAN card  ",
            pronouns: "she/her",
            bannerPath: `${UUID_A}/banner.webp`,
            featured: [UUID_A, UUID_B],
            hidden: ["reviews"],
        });
        expect(sanitizeCustomization(once)).toEqual(once);
    });
});

describe("isDefaultCustomization", () => {
    it("is true for the untouched payload", () => {
        expect(isDefaultCustomization(sanitizeCustomization(null))).toBe(true);
    });

    it("is false once any field is set", () => {
        expect(isDefaultCustomization(sanitizeCustomization({ theme: "ink" }))).toBe(false);
        expect(isDefaultCustomization(sanitizeCustomization({ tagline: "hi" }))).toBe(false);
        expect(isDefaultCustomization(sanitizeCustomization({ hidden: ["posts"] }))).toBe(false);
    });
});

describe("sectionVisible", () => {
    it("shows everything by default", () => {
        const custom = sanitizeCustomization(null);
        for (const section of PROFILE_SECTIONS) {
            expect(sectionVisible(custom, section)).toBe(true);
        }
    });

    it("hides only what was switched off", () => {
        const custom = sanitizeCustomization({ hidden: ["posts"] });
        expect(sectionVisible(custom, "posts")).toBe(false);
        expect(sectionVisible(custom, "barns")).toBe(true);
    });
});

describe("applyFeaturedOrder", () => {
    const horses = [{ id: UUID_A }, { id: UUID_B }, { id: UUID_C }];

    it("returns the original order when nothing is featured", () => {
        expect(applyFeaturedOrder(horses, [])).toEqual(horses);
    });

    it("leads with the featured ids in the chosen order", () => {
        expect(applyFeaturedOrder(horses, [UUID_C, UUID_A])).toEqual([
            { id: UUID_C },
            { id: UUID_A },
            { id: UUID_B },
        ]);
    });

    it("silently drops ids that no longer resolve to a public horse", () => {
        expect(applyFeaturedOrder(horses, ["00000000-0000-0000-0000-000000000000", UUID_B])).toEqual([
            { id: UUID_B },
            { id: UUID_A },
            { id: UUID_C },
        ]);
    });

    it("never duplicates or loses a horse", () => {
        const result = applyFeaturedOrder(horses, [UUID_B, UUID_B, UUID_A]);
        expect(result).toHaveLength(horses.length);
        expect(new Set(result.map((h) => h.id))).toEqual(new Set(horses.map((h) => h.id)));
    });

    it("does not mutate its input", () => {
        const input = [...horses];
        applyFeaturedOrder(input, [UUID_C]);
        expect(input).toEqual(horses);
    });
});
