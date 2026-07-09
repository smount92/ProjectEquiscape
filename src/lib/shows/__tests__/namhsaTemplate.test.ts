import { describe, it, expect } from "vitest";
import {
    NAMHSA_CORE_TEMPLATE,
    countTemplateClasses,
    getClasslistTemplate,
} from "@/lib/shows/namhsaTemplate";
import { SHOW_TEMPLATES } from "@/lib/constants/showTemplates";

describe("namhsaTemplate — NAMHSA core classlist", () => {
    it("resolves by key", () => {
        expect(getClasslistTemplate("namhsa_core")).toBe(NAMHSA_CORE_TEMPLATE);
        expect(getClasslistTemplate("nope")).toBeNull();
    });

    it("has three divisions with correct axes", () => {
        expect(NAMHSA_CORE_TEMPLATE.divisions.map((d) => d.axis)).toEqual([
            "halter",
            "performance",
            "collectibility",
        ]);
    });

    it("carries the full legacy classlist: 10 sections, 41 classes", () => {
        // (the legacy file's own descriptions undercount — 20+13+8 = 41)
        const sections = NAMHSA_CORE_TEMPLATE.divisions.flatMap((d) => d.sections);
        expect(sections).toHaveLength(10);
        expect(countTemplateClasses(NAMHSA_CORE_TEMPLATE)).toBe(41);
    });

    it("preserves every class from the legacy showTemplates.ts source", () => {
        // The legacy file stays intact; the new template must carry
        // every class name + number from all three legacy templates.
        const legacy = SHOW_TEMPLATES.flatMap((t) =>
            t.divisions.flatMap((d) => d.classes.map((c) => `${c.classNumber}:${c.name}`)),
        );
        const ported = NAMHSA_CORE_TEMPLATE.divisions.flatMap((d) =>
            d.sections.flatMap((s) => s.classes.map((c) => `${c.classNumber}:${c.name}`)),
        );
        expect(new Set(ported)).toEqual(new Set(legacy));
        expect(ported).toHaveLength(legacy.length);
    });

    it("class numbers are unique across the template", () => {
        const numbers = NAMHSA_CORE_TEMPLATE.divisions.flatMap((d) =>
            d.sections.flatMap((s) => s.classes.map((c) => c.classNumber)),
        );
        expect(new Set(numbers).size).toBe(numbers.length);
    });

    it("fun classes are excluded from qualification", () => {
        const funSection = NAMHSA_CORE_TEMPLATE.divisions
            .find((d) => d.axis === "collectibility")!
            .sections.find((s) => s.name === "Fun Classes")!;
        expect(funSection.classes.every((c) => c.isQualifying === false)).toBe(true);
    });

    it("halter classes default to qualifying", () => {
        const halter = NAMHSA_CORE_TEMPLATE.divisions.find((d) => d.axis === "halter")!;
        const classes = halter.sections.flatMap((s) => s.classes);
        expect(classes.every((c) => c.isQualifying !== false)).toBe(true);
    });
});
