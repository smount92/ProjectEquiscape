/**
 * Shared CSV field escaping — the single implementation (previously
 * copy-pasted into every export route).
 *
 * Two escapes compose here:
 * 1. RFC-4180 quoting for commas / quotes / newlines.
 * 2. Formula-injection neutralization: horse names and aliases are
 *    user-controlled, and a value starting with = + - @ executes as a
 *    formula when the CSV opens in Excel/Sheets. Results CSVs are the
 *    artifact hosts share publicly, so a troll entry named
 *    `=HYPERLINK(...)` would otherwise run on the host's machine.
 *    Standard mitigation: prefix a single quote.
 */
export function escapeCSV(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return "";
    let str = String(value);
    if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
    }
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
