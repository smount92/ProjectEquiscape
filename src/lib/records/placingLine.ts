/**
 * THE placing line — one definition of how a show result reads.
 *
 * The home page promises that a placing links back to "the judge, the
 * date, the size of the field". The size of the field was recorded on
 * every result (total_entries: live entries for a show run here, the
 * "Class size" column of an import) and printed nowhere, because fifteen
 * components each decided for themselves what a placing looks like. A
 * member asked for "3rd out of #" (2026-10-01). Every surface that
 * shows a horse's result now goes through this module, so the next
 * thing a placing should say is added once.
 */

/** A usable class size: a positive whole number, else null. */
export function fieldSize(value: unknown): number | null {
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    const whole = Math.floor(n);
    return whole >= 1 && whole <= 5000 ? whole : null;
}

const ORDINAL = /^(\d{1,3})(st|nd|rd|th)$/i;

/**
 * "3rd of 12" when the placing is an ordinal and the field is known and
 * plausible; "Champion · 12 in class" for a named award; the bare
 * placing when the field is unknown. Null when there is no placing.
 */
export function placingWithField(
    placing: string | null | undefined,
    totalEntries: unknown,
): string | null {
    const text = (placing ?? "").trim();
    if (!text) return null;
    const size = fieldSize(totalEntries);
    if (size === null) return text;
    const ordinal = ORDINAL.exec(text);
    if (ordinal) {
        // A field smaller than the place is a typo somewhere; say only what is certain.
        return Number(ordinal[1]) <= size ? `${text} of ${size}` : text;
    }
    return `${text} · ${size} in class`;
}

/** Hover / screen-reader gloss for the field size. */
export function fieldTitle(totalEntries: unknown): string | undefined {
    const size = fieldSize(totalEntries);
    if (size === null) return undefined;
    return `${size} ${size === 1 ? "horse" : "horses"} in the class`;
}
