import { describe, it, expect } from "vitest";
import { registryClaim, REGISTRY_CLAIM_FALLBACK } from "@/lib/stats/registryClaim";

describe("registryClaim", () => {
    it("rounds down to the nearest hundred and adds a plus", () => {
        expect(registryClaim(11794)).toBe("11,700+");
        expect(registryClaim(11700)).toBe("11,700+");
        expect(registryClaim(10549)).toBe("10,500+");
    });

    it("falls back when there is no count", () => {
        expect(registryClaim(null)).toBe(REGISTRY_CLAIM_FALLBACK);
        expect(registryClaim(undefined)).toBe(REGISTRY_CLAIM_FALLBACK);
        expect(registryClaim(Number.NaN)).toBe(REGISTRY_CLAIM_FALLBACK);
        expect(registryClaim(12)).toBe(REGISTRY_CLAIM_FALLBACK);
    });
});
