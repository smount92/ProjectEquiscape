/**
 * Shows domain — hobby-native show year math. Pure, no I/O.
 *
 * LOCKED decision: the show/card year runs May 1 → April 30
 * (matching the hobby's rhythm — NAN season). A show year is
 * identified by the calendar year it STARTS in:
 * show year 2026 = 2026-05-01 .. 2027-04-30, labeled "2026–27".
 */

/** First month of the show year (1-based): May. */
export const SHOW_YEAR_START_MONTH = 5;

/**
 * The show year a date falls in. Accepts a Date or an ISO string
 * ("2026-05-01" or full timestamp). Date-only strings are treated
 * as calendar dates (no timezone shifting).
 */
export function showYearOf(date: Date | string): number {
    const { year, month } = calendarParts(date);
    return month >= SHOW_YEAR_START_MONTH ? year : year - 1;
}

/** "2026–27" (en dash, two-digit end year). */
export function showYearLabel(showYear: number): string {
    const end = (showYear + 1) % 100;
    return `${showYear}–${String(end).padStart(2, "0")}`;
}

/** Label straight from a date. */
export function showYearLabelOf(date: Date | string): string {
    return showYearLabel(showYearOf(date));
}

/** Inclusive start (May 1) of a show year, as a calendar date string. */
export function showYearStart(showYear: number): string {
    return `${showYear}-05-01`;
}

/** Inclusive end (April 30) of a show year, as a calendar date string. */
export function showYearEnd(showYear: number): string {
    return `${showYear + 1}-04-30`;
}

/** Is the date inside the given show year? */
export function isInShowYear(date: Date | string, showYear: number): boolean {
    return showYearOf(date) === showYear;
}

// ── internals ──

function calendarParts(date: Date | string): { year: number; month: number } {
    if (typeof date === "string") {
        // Date-only strings ("2026-04-30") must not be shifted by the
        // local timezone — parse the calendar parts directly.
        const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) };
        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) throw new RangeError(`Invalid date: ${date}`);
        return { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1 };
    }
    if (isNaN(date.getTime())) throw new RangeError("Invalid date");
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}
