/**
 * Formatting for dates that came out of a DATE column.
 *
 * `new Date("2026-08-24")` is parsed as UTC midnight, so anywhere west of
 * UTC it renders as the evening BEFORE — an American reader sees Aug 23
 * for a date stored as Aug 24. Timestamps (which carry a time and an
 * offset) are fine; date-only strings are not.
 *
 * That is how the same show result came to be dated a day apart on one
 * passport: the show-record list appended a local midnight before
 * formatting, and the Hoofprint did not.
 */

/** A bare `YYYY-MM-DD`, i.e. a value with no time and no offset. */
function isDateOnly(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/**
 * Format a stored event date for display. Date-only values are pinned to
 * local midnight first so the calendar day survives; anything carrying a
 * time is left alone, since its offset is already meaningful.
 */
export function formatEventDate(
    value: string | null | undefined,
    options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
    if (!value) return "";
    const raw = value.trim();
    const parsed = new Date(isDateOnly(raw) ? `${raw}T00:00:00` : raw);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString("en-US", options);
}
