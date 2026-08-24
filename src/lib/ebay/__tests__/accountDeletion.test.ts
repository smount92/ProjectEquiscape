import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
    challengeResponseFor,
    isValidVerificationToken,
} from "@/lib/ebay/accountDeletion";

/* The one thing that can silently fail here is the HASH ORDER —
   challengeCode, then token, then URL, concatenated with no separators.
   Get it wrong and eBay reports "endpoint validation failed" with no
   further detail, and the keyset stays disabled. */

describe("the challenge response", () => {
    it("hashes code + token + url in exactly that order", () => {
        const expected = createHash("sha256")
            .update("abc123" + "t".repeat(32) + "https://modelhorsehub.com/api/webhooks/ebay-account-deletion")
            .digest("hex");
        expect(
            challengeResponseFor(
                "abc123",
                "t".repeat(32),
                "https://modelhorsehub.com/api/webhooks/ebay-account-deletion",
            ),
        ).toBe(expected);
    });

    it("is order-sensitive — swapping token and code must change the digest", () => {
        const a = challengeResponseFor("code", "x".repeat(32), "https://u");
        const b = challengeResponseFor("x".repeat(32), "code", "https://u");
        expect(a).not.toBe(b);
    });

    it("is lowercase hex, 64 chars", () => {
        expect(challengeResponseFor("c", "t".repeat(32), "u")).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe("verification token shape", () => {
    it("accepts eBay's 32-80 char alphanumeric/underscore/hyphen rule", () => {
        expect(isValidVerificationToken("a".repeat(32))).toBe(true);
        expect(isValidVerificationToken("A1_-".repeat(20))).toBe(true);
    });

    it("rejects too short, too long, and forbidden characters", () => {
        expect(isValidVerificationToken("a".repeat(31))).toBe(false);
        expect(isValidVerificationToken("a".repeat(81))).toBe(false);
        expect(isValidVerificationToken("has space".padEnd(40, "x"))).toBe(false);
        expect(isValidVerificationToken("")).toBe(false);
    });
});
