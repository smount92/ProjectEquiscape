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
 *
 * THE POLICY, stated plainly because it has a visible cost: EVERY value
 * whose first character is one of the five OWASP triggers gets the
 * quote, with no attempt to tell a formula from a name. A horse called
 * "-Dash" therefore exports as `'-Dash`. That is deliberate — the only
 * way to spare "-Dash" is to guess at intent from the rest of the
 * string, and every such guess is the bypass an attacker writes to.
 * A stray apostrophe in a spreadsheet is a typo; `=HYPERLINK` firing on
 * a host's machine is an incident.
 *
 * Leading TAB (0x09) and CR (0x0D) are triggers too: Excel strips
 * leading whitespace before parsing the cell, so "\t=SUM(1+1)" is the
 * same formula wearing a hat.
 */

/** First characters Excel/Sheets will treat as the start of a formula. */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

export function escapeCSV(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return "";
    let str = String(value);
    if (FORMULA_TRIGGERS.test(str)) {
        str = `'${str}`;
    }
    // \r as well as \n: a bare CR inside a value ends the record for
    // half the parsers in the world if it is left unquoted.
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
