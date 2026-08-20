/**
 * The surviving show flag ships dark: it defaults off, and only
 * the literal "1" turns it on.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { showStandingsEnabled } from "@/lib/shows/flags";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("showStandingsEnabled", () => {
    it("is OFF by default (unset)", () => {
        vi.stubEnv("NEXT_PUBLIC_SHOW_STANDINGS", "");
        expect(showStandingsEnabled()).toBe(false);
    });

    it("is ON only for the literal '1'", () => {
        vi.stubEnv("NEXT_PUBLIC_SHOW_STANDINGS", "1");
        expect(showStandingsEnabled()).toBe(true);
        vi.stubEnv("NEXT_PUBLIC_SHOW_STANDINGS", "true");
        expect(showStandingsEnabled()).toBe(false);
        vi.stubEnv("NEXT_PUBLIC_SHOW_STANDINGS", "0");
        expect(showStandingsEnabled()).toBe(false);
    });
});
