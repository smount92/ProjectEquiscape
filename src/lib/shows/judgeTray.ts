/**
 * Shows domain — the RIBBON TRAY judging model (Wave 4a). Pure, no I/O.
 *
 * The judge's mental model changes from "ordered list" (tap order is
 * place order; removing 1st shifts everyone up) to "pin ribbons on
 * horses": placings are a SPARSE map place → entryId. Tapping an
 * unplaced entry pins the LOWEST empty ribbon on it; clearing a
 * ribbon frees exactly that place — nobody else moves. That is the
 * anxiety fix: a volunteer judge can take back 3rd without touching
 * her 1st and 2nd.
 *
 * The server contract (recordPlacings) is unchanged: an array of
 * { entryId, place, note? } rows with unique places/entries, max 6,
 * replace-all semantics. `toServerPlacings` converts the sparse map
 * to that array (places kept as-is — never renumbered); `hydrateTray`
 * converts saved placings back.
 *
 * The autosave decision logic lives here too, as a pure reducer, so
 * the debounce / one-in-flight / latest-state-wins rules are testable
 * without a component harness.
 */

import { isValidPlace, MAX_PLACE, PLACES, placeLabel } from "./placings";
import type { Place } from "./types";

// ── The tray: sparse place → entryId map ──────────────────────────

/** Sparse map, place → entryId. Absent key = empty slot. */
export type TraySlots = Readonly<Partial<Record<Place, string>>>;

export const EMPTY_TRAY: TraySlots = Object.freeze({});

/** Gentle refusal copy for the 7th tap (the 6-ribbon cap). */
export const TRAY_FULL_MESSAGE =
    `All ${MAX_PLACE} ribbons are pinned — tap a ribbon in the tray to take one back first.`;

/**
 * Rebuild the tray from saved placings (resume / corrections).
 * Defensive: invalid places are ignored; on a duplicate place or a
 * duplicate entry the first row wins (the server guarantees
 * uniqueness — this is belt and braces, never a crash).
 */
export function hydrateTray(
    entries: readonly { id: string; place: Place | number | null }[],
): TraySlots {
    const slots: Partial<Record<Place, string>> = {};
    const seen = new Set<string>();
    for (const entry of entries) {
        if (entry.place === null || !isValidPlace(entry.place)) continue;
        if (slots[entry.place] !== undefined) continue;
        if (seen.has(entry.id)) continue;
        slots[entry.place] = entry.id;
        seen.add(entry.id);
    }
    return slots;
}

/** The place an entry holds, or null when unplaced. */
export function placeOfEntry(slots: TraySlots, entryId: string): Place | null {
    for (const place of PLACES) {
        if (slots[place] === entryId) return place;
    }
    return null;
}

/** Lowest empty slot (1st before 2nd …), or null when the tray is full. */
export function lowestEmptySlot(slots: TraySlots): Place | null {
    for (const place of PLACES) {
        if (slots[place] === undefined) return place;
    }
    return null;
}

/** Number of pinned ribbons. */
export function trayCount(slots: TraySlots): number {
    return PLACES.filter((place) => slots[place] !== undefined).length;
}

export type TrayTapResult =
    /** Entry was unplaced — it takes the lowest empty ribbon. */
    | { kind: "placed"; place: Place; slots: TraySlots }
    /** Entry held a ribbon — exactly that ribbon comes back; nobody shifts. */
    | { kind: "removed"; place: Place; slots: TraySlots }
    /** Tray full — state unchanged, gentle message for the judge. */
    | { kind: "refused"; message: string; slots: TraySlots };

/**
 * A tap on an entry card. Placed entries give their ribbon back
 * (sparse removal — no shifting); unplaced entries take the lowest
 * empty ribbon; a full tray refuses with a gentle message.
 */
export function tapEntry(slots: TraySlots, entryId: string): TrayTapResult {
    const held = placeOfEntry(slots, entryId);
    if (held !== null) {
        return { kind: "removed", place: held, slots: clearSlot(slots, held) };
    }
    const open = lowestEmptySlot(slots);
    if (open === null) {
        return { kind: "refused", message: TRAY_FULL_MESSAGE, slots };
    }
    return { kind: "placed", place: open, slots: { ...slots, [open]: entryId } };
}

/** Clear exactly one slot; every other ribbon stays where it is. */
export function clearSlot(slots: TraySlots, place: Place): TraySlots {
    if (slots[place] === undefined) return slots;
    const next: Partial<Record<Place, string>> = { ...slots };
    delete next[place];
    return next;
}

// ── Server contract conversion ────────────────────────────────────

export interface ServerPlacing {
    entryId: string;
    place: number;
    note?: string;
}

/**
 * Sparse map → the dense array recordPlacings takes (ascending place
 * order, no holes in the ARRAY — places themselves are kept exactly
 * as pinned, e.g. {1: a, 3: b} → [{a, 1st}, {b, 3rd}]). Notes ride
 * along only for placed entries; blank/whitespace notes are omitted.
 */
export function toServerPlacings(
    slots: TraySlots,
    notes: Readonly<Record<string, string>> = {},
): ServerPlacing[] {
    const rows: ServerPlacing[] = [];
    for (const place of PLACES) {
        const entryId = slots[place];
        if (entryId === undefined) continue;
        const note = notes[entryId]?.trim();
        rows.push(note ? { entryId, place, note } : { entryId, place });
    }
    return rows;
}

// ── Accessible labels (shared by cards + tray slots) ──────────────

/** "1st place — Sandstorm Strike. Tap to clear." / "1st place — empty". */
export function slotAriaLabel(place: Place, horseName: string | null): string {
    return horseName === null
        ? `${placeLabel(place)} place — empty`
        : `${placeLabel(place)} place — ${horseName}. Tap to clear.`;
}

/** "Sandstorm Strike — 1st place. Tap to remove." / "… — tap to pin the next ribbon". */
export function entryAriaLabel(horseName: string, place: Place | null): string {
    return place === null
        ? `${horseName} — tap to pin the next ribbon`
        : `${horseName} — ${placeLabel(place)} place. Tap to remove.`;
}

// ── Autosave decision logic (pure reducer) ────────────────────────

/** Tray changes debounce this long before the whole slate saves. */
export const AUTOSAVE_DEBOUNCE_MS = 900;

/** "Saved just now ✓" relaxes to "Saved ✓" after this long. */
export const SAVED_JUST_NOW_MS = 30_000;

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface AutosaveState {
    status: SaveStatus;
    /** Monotonic count of local edits (each change bumps it). */
    version: number;
    /** Version the in-flight request carries; null = nothing in flight. */
    inFlightVersion: number | null;
    /** Last version the server confirmed. */
    savedVersion: number;
    /** Epoch ms of the last confirmed save (whisper freshness). */
    savedAtMs: number | null;
    /** Server refusal, verbatim, for the role="alert" line. */
    error: string | null;
}

export const INITIAL_AUTOSAVE: AutosaveState = Object.freeze({
    status: "idle",
    version: 0,
    inFlightVersion: null,
    savedVersion: 0,
    savedAtMs: null,
    error: null,
});

export type AutosaveEvent =
    /** The tray or a critique changed — arm the debounce. */
    | { type: "change" }
    /** The judge tapped "Retry save" on the error line. */
    | { type: "retry" }
    /** The (single) request left — carries the current version. */
    | { type: "saveStart" }
    | { type: "saveSuccess"; version: number; atMs: number }
    | { type: "saveError"; version: number; error: string };

/**
 * The autosave state machine. Invariants it enforces:
 * - one request at a time (saveStart is a no-op while in flight);
 * - latest state wins (a success for a stale version leaves the
 *   state dirty so the caller saves again);
 * - an error preserves everything and waits for a change or an
 *   explicit retry — no hot retry loops.
 */
export function autosaveReducer(state: AutosaveState, event: AutosaveEvent): AutosaveState {
    switch (event.type) {
        case "change":
            return {
                ...state,
                version: state.version + 1,
                // A change while a request is out stays "saving" for the
                // whisper; the completion handler chases the new version.
                status: state.inFlightVersion !== null ? "saving" : "dirty",
                error: null,
            };
        case "retry":
            if (state.status !== "error") return state;
            return { ...state, status: "dirty", error: null };
        case "saveStart":
            if (state.inFlightVersion !== null) return state;
            return { ...state, status: "saving", inFlightVersion: state.version, error: null };
        case "saveSuccess": {
            const savedVersion = Math.max(state.savedVersion, event.version);
            const caughtUp = savedVersion >= state.version;
            return {
                ...state,
                status: caughtUp ? "saved" : "dirty",
                inFlightVersion: null,
                savedVersion,
                savedAtMs: event.atMs,
                error: null,
            };
        }
        case "saveError":
            return {
                ...state,
                status: "error",
                inFlightVersion: null,
                error: event.error,
            };
    }
}

/** Should the caller fire a save right now? (Debounce already elapsed.) */
export function needsSave(state: AutosaveState): boolean {
    return (
        state.inFlightVersion === null &&
        state.version > state.savedVersion &&
        state.status !== "error"
    );
}

/**
 * The tray whisper. "Saving…" the moment there is unsaved work,
 * "Saved just now ✓" fresh after a save (savedRecently), relaxing to
 * "Saved ✓"; null when idle or when the error line has taken over.
 * The caller keeps savedRecently with a timer — see relaxDelayMs.
 */
export function whisperText(state: AutosaveState, savedRecently: boolean): string | null {
    switch (state.status) {
        case "dirty":
        case "saving":
            return "Saving…";
        case "saved":
            return savedRecently ? "Saved just now ✓" : "Saved ✓";
        default:
            return null;
    }
}

/** How long until "Saved just now ✓" relaxes to "Saved ✓" (never negative). */
export function relaxDelayMs(savedAtMs: number, nowMs: number): number {
    return Math.max(0, SAVED_JUST_NOW_MS - (nowMs - savedAtMs));
}
