/**
 * A model number typed into a title (MHH-079).
 *
 * STANDARDS: a title holds the name only; the model number has its own
 * field, where search and the number path can read it. Members still type
 * "#5038 Silky Sullivan", and the new-entry form kept the number in the
 * title whenever the Model number box was also filled. This is the one rule
 * every path that sets a title uses: the new-entry form, the linker's "Add
 * my release", and createSuggestion as the last guard.
 *
 *  - the title's number equals the box: take it off the title;
 *  - the box is empty: move it there;
 *  - they disagree: ask the member which is right.
 *
 * A bare four-digit year in front of a name ("2019 Holiday Horse") is a
 * year, not a number, unless it carries a "#".
 */

/** The model number leading a title, and the name after it; null when none. */
export function leadingModelNumber(title: string): { number: string; rest: string } | null {
    const m = title.trim().match(/^(#?)\s*(\d{3,7}[a-z]?)(?:\s*[-–—:·.]\s*|\s+)(\S.*)$/i);
    if (!m) return null;
    const [, hash, number, rest] = m;
    if (!hash && /^(19|20)\d\d$/.test(number)) return null;
    return { number, rest: rest.trim() };
}

const clean = (n: string | null | undefined) => (n ?? "").trim().replace(/^#\s*/, "");
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type TitleNumber =
    | { ok: true; title: string; model: string }
    | { ok: false; title: string; inTitle: string; inBox: string };

/** The title and number to store, or the disagreement to put to the member. */
export function reconcileTitleNumber(title: string, modelNumber: string | null | undefined): TitleNumber {
    const box = clean(modelNumber);
    const lead = leadingModelNumber(title);
    if (!lead) return { ok: true, title: title.trim(), model: box };
    if (!box || same(box, lead.number)) return { ok: true, title: lead.rest, model: box || lead.number };
    return { ok: false, title: lead.rest, inTitle: lead.number, inBox: box };
}

/** The question, in words. */
export function titleNumberProblem(inTitle: string, inBox: string): string {
    return `The name starts with #${inTitle} but the model number says ${inBox}. Which is right?`;
}

type Change = { from?: unknown; to: unknown };
const isChange = (v: unknown): v is Change => typeof v === "object" && v !== null && "to" in v;

/**
 * The rule as createSuggestion's last guard, for any path that sets a title.
 * Takes both shapes: an addition ({ title: "...", model_number: "..." }) and
 * a correction ({ title: { from, to } }), where the number to compare is the
 * correction's own model_number or else the entry's current one. Entries
 * with no model number of their own (molds, artist pieces) keep the title
 * as typed. Returns the field changes to file, or the question to ask.
 */
export function applyTitleNumberRule(
    fieldChanges: Record<string, unknown>,
    entry: { hasModelNumber: boolean; currentModel?: string | null },
): { ok: true; fieldChanges: Record<string, unknown> } | { ok: false; error: string } {
    if (!entry.hasModelNumber) return { ok: true, fieldChanges };
    const t = fieldChanges.title;
    const correction = isChange(t);
    const title = correction ? t.to : t;
    if (typeof title !== "string") return { ok: true, fieldChanges };
    const m = fieldChanges.model_number;
    const boxRaw = isChange(m) ? m.to : (m ?? (correction ? entry.currentModel : null));
    const box = typeof boxRaw === "string" ? boxRaw : boxRaw == null ? "" : String(boxRaw);
    const r = reconcileTitleNumber(title, box);
    if (!r.ok) return { ok: false, error: titleNumberProblem(r.inTitle, r.inBox) };
    if (r.title === title.trim() && clean(box) === r.model) return { ok: true, fieldChanges };
    const out = { ...fieldChanges };
    if (correction) {
        out.title = { ...(t as Change), to: r.title };
        if (r.model && !isChange(m) && !clean(entry.currentModel))
            out.model_number = { from: entry.currentModel ?? "", to: r.model };
    } else {
        out.title = r.title;
        if (r.model) out.model_number = r.model;
    }
    return { ok: true, fieldChanges: out };
}
