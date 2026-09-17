/**
 * Season 1 sanctioning requests ride in `shows.sanctioning_note` as a
 * marker string: a non-admin host asks, the marker lands in the note,
 * /admin's queue lists every unsanctioned show carrying it, and the
 * grant/dismiss actions strip it. One place owns the marker so the
 * create path, the settings path and the admin queue can never
 * disagree about what a request looks like.
 */

export const SANCTIONING_REQUEST_MARKER = "[Host requested MHH sanctioning]";

export function hasSanctioningRequest(note: string | null | undefined): boolean {
    return !!note && note.includes(SANCTIONING_REQUEST_MARKER);
}

/** The host's own words, marker removed; null when nothing is left. */
export function stripSanctioningMarker(note: string | null | undefined): string | null {
    if (!note) return null;
    const stripped = note.split(SANCTIONING_REQUEST_MARKER).join(" ").replace(/\s+/g, " ").trim();
    return stripped.length > 0 ? stripped : null;
}

/** The host's words plus the marker (idempotent). */
export function withSanctioningMarker(note: string | null | undefined): string {
    const own = stripSanctioningMarker(note);
    return own ? `${own} ${SANCTIONING_REQUEST_MARKER}` : SANCTIONING_REQUEST_MARKER;
}
