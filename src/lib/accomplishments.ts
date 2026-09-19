/**
 * Other accomplishments — what a horse did that isn't a show placing.
 *
 * The show record covers halter and performance classes. Model horses
 * also RACE (the Express, the FTRA — formerly MRF — run pretend race
 * meets with charts and results), get bred, win awards a show didn't
 * give. One vocabulary for the form, the passport and the server.
 */

import { safeHttpUrl } from "@/lib/papers/validate";
import { parseLooseDate } from "@/lib/studio/making";

export type AccomplishmentKind = "racing" | "performance" | "breeding" | "award" | "other";

export const ACCOMPLISHMENT_KINDS: { value: AccomplishmentKind; label: string; glyph: string; hint: string }[] = [
    { value: "racing", label: "Racing", glyph: "🏇", hint: "A race record — the Express, the FTRA, a track day." },
    { value: "performance", label: "Performance", glyph: "🎠", hint: "Trail, dressage, a clinic — anything ridden or driven outside a show ring." },
    { value: "breeding", label: "Breeding", glyph: "🐎", hint: "A breeding granted, a foal produced." },
    { value: "award", label: "Award", glyph: "🎖️", hint: "A year-end award, a hall of fame, a special recognition." },
    { value: "other", label: "Other", glyph: "📌", hint: "Anything else worth keeping with the horse." },
];

export const ACCOMPLISHMENT_LABELS: Record<string, string> = Object.fromEntries(
    ACCOMPLISHMENT_KINDS.map((k) => [k.value, k.label]),
);
export const ACCOMPLISHMENT_GLYPHS: Record<string, string> = Object.fromEntries(
    ACCOMPLISHMENT_KINDS.map((k) => [k.value, k.glyph]),
);

export function isAccomplishmentKind(x: unknown): x is AccomplishmentKind {
    return typeof x === "string" && ACCOMPLISHMENT_KINDS.some((k) => k.value === x);
}

export const MAX_ORG = 120;
export const MAX_TITLE = 160;
export const MAX_RESULT = 160;
export const MAX_DATE_TEXT = 40;
export const MAX_DETAIL = 2000;

export interface AccomplishmentInput {
    kind: unknown;
    organization?: unknown;
    title: unknown;
    result?: unknown;
    /** "2024", "2024-05" or "2024-05-18" — or free words ("Spring 2024"). */
    when?: unknown;
    detail?: unknown;
    linkUrl?: unknown;
    isPublic?: unknown;
}

export interface AccomplishmentValue {
    kind: AccomplishmentKind;
    organization: string | null;
    title: string;
    result: string | null;
    happenedOn: string | null;
    dateText: string | null;
    detail: string | null;
    linkUrl: string | null;
    isPublic: boolean;
}

const str = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim().slice(0, max);
    return t || null;
};

/**
 * One validation for form and server. A date is parsed when it reads as
 * one; anything else ("Spring 2024") is kept as words. The link must be
 * http(s) or it is refused with a sentence, never stored as dead text.
 */
export function validateAccomplishment(
    input: AccomplishmentInput,
    now: Date = new Date(),
): { ok: true; value: AccomplishmentValue } | { ok: false; error: string } {
    if (!isAccomplishmentKind(input.kind)) return { ok: false, error: "Pick what kind of accomplishment this is." };
    const title = str(input.title, MAX_TITLE);
    if (!title) return { ok: false, error: "Give it a title — the race, the award, the event." };

    let happenedOn: string | null = null;
    let dateText: string | null = null;
    const when = str(input.when, MAX_DATE_TEXT);
    if (when) {
        if (/^\d{4}(-\d{1,2}){0,2}$/.test(when)) {
            const parsed = parseLooseDate(when, now);
            if (parsed.error) return { ok: false, error: `When: ${parsed.error}` };
            happenedOn = parsed.iso;
            // Keep the words the member used so "2024-05" doesn't print as May 1.
            dateText = when.length < 10 ? when : null;
        } else {
            dateText = when;
            const year = /\b(19|20)\d{2}\b/.exec(when);
            if (year) happenedOn = `${year[0]}-01-01`;
        }
    }

    const rawLink = typeof input.linkUrl === "string" ? input.linkUrl.trim() : "";
    const linkUrl = rawLink ? safeHttpUrl(rawLink) : null;
    if (rawLink && !linkUrl) return { ok: false, error: "The link should be a web address (https://…)." };

    return {
        ok: true,
        value: {
            kind: input.kind,
            organization: str(input.organization, MAX_ORG),
            title,
            result: str(input.result, MAX_RESULT),
            happenedOn,
            dateText,
            detail: str(input.detail, MAX_DETAIL),
            linkUrl,
            isPublic: input.isPublic !== false,
        },
    };
}

/** "Express · 2nd of 9 · Spring 2024" — the caption line under a title. */
export function accomplishmentLine(a: {
    organization: string | null;
    result: string | null;
    happenedOn: string | null;
    dateText: string | null;
}): string {
    const when =
        a.dateText ??
        (a.happenedOn
            ? new Date(`${a.happenedOn}T00:00:00Z`).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
              })
            : null);
    return [a.organization, a.result, when].filter(Boolean).join(" · ");
}
