import { describe, it, expect } from "vitest";
import { decodeHtmlEntities } from "@/lib/utils/decodeEntities";

describe("decodeHtmlEntities", () => {
    it("decodes a simple named entity", () => {
        expect(decodeHtmlEntities("Smoke &amp; Mirrors")).toBe("Smoke & Mirrors");
    });

    it("decodes a numeric entity", () => {
        expect(decodeHtmlEntities("Rock&#39;n Roll")).toBe("Rock'n Roll");
    });

    it("collapses double-encoded entities", () => {
        expect(decodeHtmlEntities("Smoke &amp;amp; Mirrors")).toBe("Smoke & Mirrors");
    });

    it("leaves plain strings untouched", () => {
        expect(decodeHtmlEntities("Man o' War")).toBe("Man o' War");
    });
});
