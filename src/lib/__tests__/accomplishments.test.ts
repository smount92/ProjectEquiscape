import { describe, it, expect } from "vitest";

import { accomplishmentLine, validateAccomplishment } from "@/lib/accomplishments";

const NOW = new Date("2026-09-19T12:00:00Z");

describe("validateAccomplishment", () => {
    it("takes a race record with a real date and a link", () => {
        const r = validateAccomplishment(
            {
                kind: "racing",
                organization: " Express ",
                title: "Autumn Classic (6f)",
                result: "2nd of 9",
                when: "2024-05-18",
                detail: "Chart: https://example.org/chart",
                linkUrl: "example.org/results",
            },
            NOW,
        );
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value).toMatchObject({
            kind: "racing",
            organization: "Express",
            title: "Autumn Classic (6f)",
            result: "2nd of 9",
            happenedOn: "2024-05-18",
            dateText: null,
            linkUrl: "https://example.org/results",
            isPublic: true,
        });
    });

    it("keeps the member's words for a loose date and still sorts it", () => {
        const a = validateAccomplishment({ kind: "award", title: "Year-end high point", when: "Spring 2024" }, NOW);
        expect(a.ok && a.value.happenedOn).toBe("2024-01-01");
        expect(a.ok && a.value.dateText).toBe("Spring 2024");
        const b = validateAccomplishment({ kind: "award", title: "x", when: "2024-05" }, NOW);
        expect(b.ok && b.value.happenedOn).toBe("2024-05-01");
        expect(b.ok && b.value.dateText).toBe("2024-05");
    });

    it("refuses what it can't keep honestly, with a sentence", () => {
        expect(validateAccomplishment({ kind: "racing", title: "" }, NOW)).toMatchObject({ ok: false });
        expect(validateAccomplishment({ kind: "medal", title: "x" }, NOW)).toMatchObject({ ok: false });
        const future = validateAccomplishment({ kind: "racing", title: "x", when: "2031" }, NOW);
        expect(future.ok).toBe(false);
        if (!future.ok) expect(future.error).toMatch(/future/);
        const link = validateAccomplishment({ kind: "racing", title: "x", linkUrl: "javascript:alert(1)" }, NOW);
        expect(link.ok).toBe(false);
        if (!link.ok) expect(link.error).toMatch(/web address/);
    });
});

describe("accomplishmentLine", () => {
    it("joins what's known with middle dots, words before dates", () => {
        expect(accomplishmentLine({ organization: "Express", result: "2nd of 9", happenedOn: "2024-05-18", dateText: null })).toBe(
            "Express · 2nd of 9 · May 18, 2024",
        );
        expect(accomplishmentLine({ organization: "FTRA", result: null, happenedOn: "2024-01-01", dateText: "Spring 2024" })).toBe(
            "FTRA · Spring 2024",
        );
        expect(accomplishmentLine({ organization: null, result: null, happenedOn: null, dateText: null })).toBe("");
    });
});
