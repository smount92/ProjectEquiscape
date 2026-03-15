import { describe, it, expect } from "vitest";
import { extractMentions } from "@/lib/utils/mentions";

describe("extractMentions", () => {
    it("extracts a single @mention", () => {
        expect(extractMentions("Hello @Alice")).toContain("Alice");
    });

    it("extracts greedy multi-word from @Bob and @Charlie", () => {
        // The regex is greedy — @Bob captures "Bob and" because it grabs up to 5 words
        const result = extractMentions("@Bob and @Charlie");
        // Should have at least one match starting with "Bob"
        expect(result.some((m) => m.startsWith("Bob"))).toBe(true);
    });

    it("extracts quoted multi-word mentions", () => {
        const result = extractMentions('@"John Smith" said hi');
        expect(result).toContain("John Smith");
    });

    it("extracts unquoted multi-word mentions (greedy up to 5 words)", () => {
        const result = extractMentions("@Multi Word Name rest of text");
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toMatch(/^Multi/);
    });

    it("returns empty array for no mentions", () => {
        expect(extractMentions("No mentions here")).toEqual([]);
    });

    it("returns empty array for empty string", () => {
        expect(extractMentions("")).toEqual([]);
    });

    it("handles @@ double-at edge case without crashing", () => {
        const result = extractMentions("@@double");
        expect(Array.isArray(result)).toBe(true);
    });

    it("rejects mentions shorter than 3 characters", () => {
        const result = extractMentions("@ab");
        expect(result).toEqual([]);
    });

    it("extracts alphanumeric aliases", () => {
        expect(extractMentions("Hi @ValidAlias123")).toContain("ValidAlias123");
    });

    it("handles multiple mentions with greedy capture", () => {
        const result = extractMentions("Start @Alice end @Bob.");
        expect(result.length).toBeGreaterThan(0);
        expect(result.some((m) => m.startsWith("Alice"))).toBe(true);
    });

    it("deduplicates quoted repeated mentions", () => {
        const result = extractMentions('@"Alice" and @"Alice" again');
        const aliceCount = result.filter((m) => m === "Alice").length;
        expect(aliceCount).toBe(1);
    });

    it("handles mention at start of string (greedy)", () => {
        const result = extractMentions("@StartMention is here");
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toMatch(/^StartMention/);
    });
});
