import { describe, expect, it } from "vitest";

import { GLOSSARY_ENTRIES } from "../glossary/entries";

describe("glossary entries", () => {
    it("covers the promised breadth (~25+ terms)", () => {
        expect(GLOSSARY_ENTRIES.length).toBeGreaterThanOrEqual(25);
    });

    it("has unique, url-safe anchor ids (they are a public deep-link contract)", () => {
        const ids = GLOSSARY_ENTRIES.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) {
            expect(id).toMatch(/^[a-z0-9-]+$/);
        }
    });

    it("keeps the core outsider terms present", () => {
        const ids = new Set(GLOSSARY_ENTRIES.map((e) => e.id));
        for (const required of [
            "of",
            "cm",
            "ar",
            "lsq",
            "halter",
            "performance",
            "breed-assignment",
            "nan",
            "namhsa",
            "mepsa",
            "proxy-showing",
            "blind-judging",
            "split-combine",
            "leg-tag",
            "callback",
            "rosette",
            "body",
        ]) {
            expect(ids.has(required)).toBe(true);
        }
    });

    it("never leaves an empty definition", () => {
        for (const entry of GLOSSARY_ENTRIES) {
            expect(entry.term.length).toBeGreaterThan(1);
            expect(entry.def.length).toBeGreaterThan(40);
        }
    });
});
