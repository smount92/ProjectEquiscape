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
 *  - the number carries a "#" ("#5038 Silky") and the box is empty: move it there;
 *  - a "#" number and the box disagree: ask the member which is right.
 *
 * A bare number with no "#" may be part of the name ("101 Dalmatians"), so
 * it is only ever taken off silently when it equals the box. Otherwise the
 * forms ask the member (`bare: "ask"`), and the server guard, which has no
 * one to ask, leaves the title as typed (`bare: "keep"`, the default). A
 * bare four-digit year in front of a name ("2019 Holiday Horse") is a year
 * and is never read as a number at all.
 */

/** The model number leading a title, the name after it, and whether it carried a "#"; null when none. */
export function leadingModelNumber(title: string): { number: string; rest: string; hash: boolean } | null {
    const m = title.trim().match(/^(#?)\s*(\d{3,7}[a-z]?)(?:\s*[-–—:·.]\s*|\s+)(\S.*)$/i);
    if (!m) return null;
    const [, hash, number, rest] = m;
    if (!hash && /^(19|20)\d\d$/.test(number)) return null;
    return { number, rest: rest.trim(), hash: !!hash };
}

const clean = (n: string | null | undefined) => (n ?? "").trim().replace(/^#\s*/, "");
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * `inBox` is "" when a bare number leads the title and the box is empty:
 * the question is then whether the number is the model number at all.
 */
export type TitleNumber =
    | { ok: true; title: string; model: string }
    | { ok: false; title: string; inTitle: string; inBox: string };

/**
 * The title and number to store, or the question to put to the member.
 * `bare` says what to do with a number written without "#" that does not
 * equal the box: "keep" leaves the title as typed (the server, which
 * cannot ask); "ask" returns the question (the forms).
 */
export function reconcileTitleNumber(
    title: string,
    modelNumber: string | null | undefined,
    opts: { bare?: "keep" | "ask" } = {},
): TitleNumber {
    const box = clean(modelNumber);
    const lead = leadingModelNumber(title);
    if (!lead) return { ok: true, title: title.trim(), model: box };
    if (box && same(box, lead.number)) return { ok: true, title: lead.rest, model: box };
    if (!lead.hash && (opts.bare ?? "keep") === "keep") return { ok: true, title: title.trim(), model: box };
    if (!box && lead.hash) return { ok: true, title: lead.rest, model: lead.number };
    return { ok: false, title: lead.rest, inTitle: lead.number, inBox: box };
}

/** The question, in words. An empty `inBox` asks whether a bare number is the model number. */
export function titleNumberProblem(inTitle: string, inBox: string): string {
    if (!inBox) return `The name starts with ${inTitle}. Is that the model number?`;
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
 * as typed. A bare number that is not the box's is left in the title: the
 * forms have already asked the member about it. Returns the field changes
 * to file, or the question to ask.
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
        // The box was cleared and the number typed into the title instead: the
        // number leaves the title, so it must land in the box, not vanish.
        else if (r.model && isChange(m) && !clean(String(m.to ?? ""))) out.model_number = { ...m, to: r.model };
    } else {
        out.title = r.title;
        if (r.model) out.model_number = r.model;
    }
    return { ok: true, fieldChanges: out };
}
