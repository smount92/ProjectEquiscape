/**
 * Wave 4b — the album page ships DARK: the flag defaults off, and
 * only the literal "1" turns it on.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { showPageV3Enabled, showsV2Enabled, showStandingsEnabled } from "@/lib/shows/flags";

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
    it("showsV2Enabled / showStandingsEnabled read their own vars", () => {
        vi.stubEnv("NEXT_PUBLIC_SHOWS_V2", "1");
        vi.stubEnv("NEXT_PUBLIC_SHOW_STANDINGS", "");
        vi.stubEnv("NEXT_PUBLIC_SHOW_PAGE_V3", "");
        expect(showsV2Enabled()).toBe(true);
        expect(showStandingsEnabled()).toBe(false);
        expect(showPageV3Enabled()).toBe(false);
    });
});
