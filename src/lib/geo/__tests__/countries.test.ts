import { describe, expect, it } from "vitest";

import { COUNTRIES, countryName, flagEmoji, isCountryCode } from "../countries";

describe("countries", () => {
    it("lists every ISO alpha-2 country once, alphabetically", () => {
        expect(COUNTRIES.length).toBeGreaterThan(240);
        expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
        const names = COUNTRIES.map((c) => c.name);
        expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
    });

    it("resolves codes case-insensitively and rejects the rest", () => {
        expect(isCountryCode("pl")).toBe(true);
        expect(isCountryCode("ZZ")).toBe(false);
        expect(isCountryCode("POL")).toBe(false);
        expect(countryName("PL")).toBe("Poland");
        expect(countryName("us")).toBe("United States");
        expect(countryName(null)).toBeNull();
    });

    it("builds the regional-indicator flag", () => {
        expect(flagEmoji("PL")).toBe("🇵🇱");
        expect(flagEmoji("gb")).toBe("🇬🇧");
        expect(flagEmoji("??")).toBeNull();
    });
});
