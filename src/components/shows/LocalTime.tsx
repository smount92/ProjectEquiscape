"use client";

/**
 * Viewer-local timestamp — fixes the "2:10 AM" (whose 2 AM?) confusion.
 *
 * With a time (`withTime`): the server can only guess a viewer's
 * timezone, so it renders the honest UTC form ("Jul 3, 2026, 2:10 AM
 * UTC") for first paint and no-JS, then swaps in the viewer's local
 * time WITH its zone abbreviation once hydrated ("Jul 2, 2026, 9:10 PM
 * CDT"). Every rendering names its zone — never a bare wall-clock time.
 * The swap uses useSyncExternalStore's server/client snapshots (the
 * sanctioned "different on the client" pattern — no effect, no
 * cascading render).
 *
 * Date-only values (live show dates) are CALENDAR dates: they render in
 * UTC on purpose so the printed day never shifts across the date line —
 * an Aug 12 live show is Aug 12 at the venue, not "Aug 11" in Honolulu.
 */

import { useSyncExternalStore } from "react";

function format(iso: string, withTime: boolean, timeZone?: string): string | null {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...(withTime ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" } : {}),
        ...(timeZone ? { timeZone } : {}),
    }).format(d);
}

/** The viewer's timezone never changes mid-session — nothing to subscribe to. */
function subscribeNever(): () => void {
    return () => {};
}

export default function LocalTime({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
    // Server snapshot: false (render UTC); client snapshot: true (render local).
    const hydrated = useSyncExternalStore(
        subscribeNever,
        () => true,
        () => false,
    );
    const fallback = format(iso, withTime, "UTC");
    if (!fallback) return null;
    const text = hydrated && withTime ? (format(iso, true) ?? fallback) : fallback;
    return (
        <time dateTime={iso} suppressHydrationWarning>
            {text}
        </time>
    );
}
