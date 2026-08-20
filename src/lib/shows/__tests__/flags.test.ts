/**
 * Wave 4b — the album page ships DARK: the flag defaults off, and
 * only the literal "1" turns it on.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { showPageV3Enabled, showStandingsEnabled } from "@/lib/shows/flags";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("showPageV3Enabled", () => {
    it("is OFF by default (unset)", () => {
        vi.stubEnv("NEXT_PUBLIC_SHOW_PAGE_V3", "");
        expect(showPageV3Enabled()).toBe(false);
    });

    it("is ON only for the literal '1'", () => {
        vi.stubEnv("NEXT_PUBLIC_SHOW_PAGE_V3", "1");
        expect(showPageV3Enabled()).toBe(true);
        vi.stubEnv("NEXT_PUBLIC_SHOW_PAGE_V3", "true");
        expect(showPageV3Enabled()).toBe(false);
        vi.stubEnv("NEXT_PUBLIC_SHOW_PAGE_V3", "0");
        expect(showPageV3Enabled()).toBe(false);
    });
});

describe("the sibling flags keep their contracts", () => {
    it("showStandingsEnabled reads its own var", () => {
        vi.stubEnv("NEXT_PUBLIC_SHOW_STANDINGS", "");
        vi.stubEnv("NEXT_PUBLIC_SHOW_PAGE_V3", "");
        expect(showStandingsEnabled()).toBe(false);
        expect(showPageV3Enabled()).toBe(false);
        vi.stubEnv("NEXT_PUBLIC_SHOW_STANDINGS", "1");
        expect(showStandingsEnabled()).toBe(true);
    });
});
