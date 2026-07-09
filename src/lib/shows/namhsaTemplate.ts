/**
 * Shows domain — NAMHSA-style core classlist template, adapted
 * from src/lib/constants/showTemplates.ts (kept intact for the
 * legacy system) into the new three-level shape:
 * divisions (finish × axis) → sections (breed/discipline group)
 * → classes.
 *
 * Free tier gets this 1-click; custom saved templates are Pro
 * (Phase F). Pure data + pure helpers, no I/O.
 */

import type { DivisionAxis } from "./types";

export interface TemplateClass {
    name: string;
    classNumber?: string;
    /** Counts toward MHH qualification cards. Defaults true for halter breeds. */
    isQualifying?: boolean;
}

export interface TemplateSection {
    name: string;
    classes: TemplateClass[];
}

export interface TemplateDivision {
    name: string;
    axis: DivisionAxis;
    sections: TemplateSection[];
}

export interface ShowClasslistTemplate {
    key: string;
    label: string;
    description: string;
    divisions: TemplateDivision[];
}

/**
 * The NAMHSA core classlist: breed halter + performance +
 * collectibility, 10 sections, 41 classes. Section/class content
 * ported from the legacy standard_halter / performance_standard /
 * collectibility_fun templates.
 */
export const NAMHSA_CORE_TEMPLATE: ShowClasslistTemplate = {
    key: "namhsa_core",
    label: "NAMHSA Core Classlist",
    description:
        "Traditional NAMHSA-style show: breed halter (5 sections, 20 classes), " +
        "performance (3 sections, 13 classes), and collectibility & fun " +
        "(2 sections, 8 classes).",
    divisions: [
        {
            name: "Breed Halter",
            axis: "halter",
            sections: [
                {
                    name: "Light Breeds",
                    classes: [
                        { name: "Arabian", classNumber: "101" },
                        { name: "Part-Arabian", classNumber: "102" },
                        { name: "Morgan", classNumber: "103" },
                        { name: "Saddlebred", classNumber: "104" },
                        { name: "Other Light/Gaited", classNumber: "105" },
                    ],
                },
                {
                    name: "Sport Breeds",
                    classes: [
                        { name: "Thoroughbred/Standardbred", classNumber: "106" },
                        { name: "Warmblood", classNumber: "107" },
                        { name: "Carriage Breeds", classNumber: "108" },
                        { name: "Other Sport", classNumber: "109" },
                    ],
                },
                {
                    name: "Stock Breeds",
                    classes: [
                        { name: "Quarter Horse", classNumber: "110" },
                        { name: "Appaloosa", classNumber: "111" },
                        { name: "Paint", classNumber: "112" },
                        { name: "Mustang", classNumber: "113" },
                        { name: "Other Stock", classNumber: "114" },
                    ],
                },
                {
                    name: "Draft & Pony",
                    classes: [
                        { name: "British Draft", classNumber: "115" },
                        { name: "European Draft", classNumber: "116" },
                        { name: "American Pony", classNumber: "117" },
                        { name: "European Pony", classNumber: "118" },
                    ],
                },
                {
                    name: "Other",
                    classes: [
                        { name: "Longears/Exotics", classNumber: "119" },
                        { name: "Foals", classNumber: "120" },
                    ],
                },
            ],
        },
        {
            name: "Performance",
            axis: "performance",
            sections: [
                {
                    name: "Western",
                    classes: [
                        { name: "Western Pleasure", classNumber: "201" },
                        { name: "Western Trail", classNumber: "202" },
                        { name: "Western Games", classNumber: "203" },
                        { name: "Stock Work/Cutting/Roping", classNumber: "204" },
                    ],
                },
                {
                    name: "English",
                    classes: [
                        { name: "Huntseat Pleasure", classNumber: "205" },
                        { name: "Hunter over Fences", classNumber: "206" },
                        { name: "Jumper", classNumber: "207" },
                        { name: "Dressage", classNumber: "208" },
                        { name: "Cross Country", classNumber: "209" },
                    ],
                },
                {
                    name: "Other Performance",
                    classes: [
                        { name: "Harness/Driving", classNumber: "210" },
                        { name: "Costume", classNumber: "211" },
                        { name: "Scene", classNumber: "212" },
                        { name: "Showmanship", classNumber: "213" },
                    ],
                },
            ],
        },
        {
            name: "Collectibility & Fun",
            axis: "collectibility",
            sections: [
                {
                    name: "Breyer Collectibility",
                    classes: [
                        { name: "Vintage (Pre-1990)", classNumber: "301" },
                        { name: "Decorator/Woodgrain", classNumber: "302" },
                        { name: "Glossy Finish", classNumber: "303" },
                        { name: "Limited/Special Run", classNumber: "304" },
                    ],
                },
                {
                    name: "Fun Classes",
                    classes: [
                        // Fun classes don't count toward qualification cards.
                        { name: "Best Customization", classNumber: "305", isQualifying: false },
                        { name: "Unrealistic Color", classNumber: "306", isQualifying: false },
                        { name: "Fails & Flaws", classNumber: "307", isQualifying: false },
                        { name: "Fantasy/Unicorn", classNumber: "308", isQualifying: false },
                    ],
                },
            ],
        },
    ],
};

export const SHOW_CLASSLIST_TEMPLATES: ShowClasslistTemplate[] = [
    NAMHSA_CORE_TEMPLATE,
];

export function getClasslistTemplate(key: string): ShowClasslistTemplate | null {
    return SHOW_CLASSLIST_TEMPLATES.find((t) => t.key === key) ?? null;
}

export function countTemplateClasses(template: ShowClasslistTemplate): number {
    return template.divisions.reduce(
        (dSum, d) =>
            dSum + d.sections.reduce((sSum, s) => sSum + s.classes.length, 0),
        0,
    );
}
