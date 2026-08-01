/**
 * Wave 4a — the ribbon-tray judging model. The sparse place → entry
 * map (fill lowest empty, clear exactly one, no shifting), the
 * server-contract conversion both ways, and the autosave reducer's
 * one-in-flight / latest-wins / error-preserving decisions.
 */
import { describe, it, expect } from "vitest";

import {
    AUTOSAVE_DEBOUNCE_MS,
    autosaveReducer,
    clearSlot,
    EMPTY_TRAY,
    entryAriaLabel,
    hydrateTray,
    INITIAL_AUTOSAVE,
    lowestEmptySlot,
    needsSave,
    placeOfEntry,
    relaxDelayMs,
    SAVED_JUST_NOW_MS,
    slotAriaLabel,
    tapEntry,
    toServerPlacings,
    trayCount,
    TRAY_FULL_MESSAGE,
    whisperText,
    type AutosaveState,
    type TraySlots,
} from "@/lib/shows/judgeTray";
import { MAX_PLACE } from "@/lib/shows/placings";

describe("judgeTray — sparse tray model", () => {
    it("starts empty", () => {
        expect(trayCount(EMPTY_TRAY)).toBe(0);
        expect(lowestEmptySlot(EMPTY_TRAY)).toBe(1);
        expect(placeOfEntry(EMPTY_TRAY, "a")).toBeNull();
    });

    it("first tap pins 1st", () => {
        const result = tapEntry(EMPTY_TRAY, "a");
        expect(result.kind).toBe("placed");
        expect(result.kind === "placed" && result.place).toBe(1);
        expect(result.slots).toEqual({ 1: "a" });
    });

    it("fills the lowest empty slot, not the next sequential one", () => {
        // 1st and 3rd pinned, 2nd free — the next tap takes 2nd.
        const slots: TraySlots = { 1: "a", 3: "c" };
        const result = tapEntry(slots, "d");
        expect(result.kind === "placed" && result.place).toBe(2);
        expect(result.slots).toEqual({ 1: "a", 2: "d", 3: "c" });
    });

    it("tapping a placed entry removes ONLY its ribbon — nobody shifts", () => {
        const slots: TraySlots = { 1: "a", 2: "b", 3: "c" };
        const result = tapEntry(slots, "a");
        expect(result.kind).toBe("removed");
        expect(result.kind === "removed" && result.place).toBe(1);
        // The anxiety fix: b keeps 2nd, c keeps 3rd.
        expect(result.slots).toEqual({ 2: "b", 3: "c" });
    });

    it("after a removal the freed slot is the lowest empty again", () => {
        const cleared = tapEntry({ 1: "a", 2: "b", 3: "c" }, "b").slots;
        expect(cleared).toEqual({ 1: "a", 3: "c" });
        const refilled = tapEntry(cleared, "d");
        expect(refilled.kind === "placed" && refilled.place).toBe(2);
    });

    it("clearSlot clears exactly that place and nothing else", () => {
        const slots: TraySlots = { 1: "a", 2: "b", 6: "f" };
        expect(clearSlot(slots, 2)).toEqual({ 1: "a", 6: "f" });
        expect(clearSlot(slots, 6)).toEqual({ 1: "a", 2: "b" });
    });

    it("clearSlot on an empty slot is a no-op (same reference)", () => {
        const slots: TraySlots = { 1: "a" };
        expect(clearSlot(slots, 4)).toBe(slots);
    });

    it("refuses the 7th ribbon with the gentle message and unchanged state", () => {
        const full: TraySlots = { 1: "a", 2: "b", 3: "c", 4: "d", 5: "e", 6: "f" };
        expect(trayCount(full)).toBe(MAX_PLACE);
        expect(lowestEmptySlot(full)).toBeNull();
        const result = tapEntry(full, "g");
        expect(result.kind).toBe("refused");
        expect(result.kind === "refused" && result.message).toBe(TRAY_FULL_MESSAGE);
        expect(result.slots).toBe(full);
    });

    it("a full tray still lets a placed entry give its ribbon back", () => {
        const full: TraySlots = { 1: "a", 2: "b", 3: "c", 4: "d", 5: "e", 6: "f" };
        const result = tapEntry(full, "d");
        expect(result.kind === "removed" && result.place).toBe(4);
        expect(result.slots).toEqual({ 1: "a", 2: "b", 3: "c", 5: "e", 6: "f" });
    });

    it("does not mutate its input", () => {
        const slots: TraySlots = { 1: "a" };
        tapEntry(slots, "b");
        tapEntry(slots, "a");
        clearSlot(slots, 1);
        expect(slots).toEqual({ 1: "a" });
    });
});

describe("judgeTray — hydration from saved placings", () => {
    it("rebuilds the sparse map from entry places", () => {
        const slots = hydrateTray([
            { id: "a", place: 2 },
            { id: "b", place: null },
            { id: "c", place: 1 },
        ]);
        expect(slots).toEqual({ 1: "c", 2: "a" });
    });

    it("preserves gaps — a cleared 2nd stays cleared on resume", () => {
        const slots = hydrateTray([
            { id: "a", place: 1 },
            { id: "c", place: 3 },
        ]);
        expect(slots).toEqual({ 1: "a", 3: "c" });
        expect(lowestEmptySlot(slots)).toBe(2);
    });

    it("ignores invalid places defensively", () => {
        const slots = hydrateTray([
            { id: "a", place: 0 },
            { id: "b", place: 7 },
            { id: "c", place: 2.5 },
            { id: "d", place: 4 },
        ]);
        expect(slots).toEqual({ 4: "d" });
    });

    it("first row wins on duplicate places or duplicate entries", () => {
        expect(
            hydrateTray([
                { id: "a", place: 1 },
                { id: "b", place: 1 },
            ]),
        ).toEqual({ 1: "a" });
        expect(
            hydrateTray([
                { id: "a", place: 1 },
                { id: "a", place: 2 },
            ]),
        ).toEqual({ 1: "a" });
    });

    it("round-trips through the server contract", () => {
        const slots: TraySlots = { 1: "a", 3: "c", 6: "f" };
        const rows = toServerPlacings(slots);
        const back = hydrateTray(
            rows.map((r) => ({ id: r.entryId, place: r.place })),
        );
        expect(back).toEqual(slots);
    });
});

describe("judgeTray — server contract conversion", () => {
    it("emits ascending place order with places kept as pinned", () => {
        const rows = toServerPlacings({ 3: "c", 1: "a" });
        expect(rows).toEqual([
            { entryId: "a", place: 1 },
            { entryId: "c", place: 3 },
        ]);
    });

    it("attaches trimmed notes only for placed entries", () => {
        const rows = toServerPlacings(
            { 1: "a", 2: "b" },
            { a: "  Lovely shading.  ", b: "   ", unplaced: "never sent" },
        );
        expect(rows).toEqual([
            { entryId: "a", place: 1, note: "Lovely shading." },
            { entryId: "b", place: 2 },
        ]);
    });

    it("an empty tray becomes an empty slate (replace-all clears)", () => {
        expect(toServerPlacings(EMPTY_TRAY)).toEqual([]);
        expect(toServerPlacings(EMPTY_TRAY, { a: "note" })).toEqual([]);
    });

    it("never exceeds the 6-row cap by construction", () => {
        const full: TraySlots = { 1: "a", 2: "b", 3: "c", 4: "d", 5: "e", 6: "f" };
        expect(toServerPlacings(full)).toHaveLength(MAX_PLACE);
    });
});

describe("judgeTray — aria labels", () => {
    it("labels tray slots for filled and empty states", () => {
        expect(slotAriaLabel(1, "Sandstorm Strike")).toBe(
            "1st place — Sandstorm Strike. Tap to clear.",
        );
        expect(slotAriaLabel(1, null)).toBe("1st place — empty");
    });

    it("labels entry cards for placed and unplaced states", () => {
        expect(entryAriaLabel("Sandstorm Strike", 1)).toBe(
            "Sandstorm Strike — 1st place. Tap to remove.",
        );
        expect(entryAriaLabel("Sandstorm Strike", null)).toBe(
            "Sandstorm Strike — tap to pin the next ribbon",
        );
    });
});

describe("judgeTray — autosave reducer", () => {
    const at = (overrides: Partial<AutosaveState>): AutosaveState => ({
        ...INITIAL_AUTOSAVE,
        ...overrides,
    });

    it("starts idle with nothing to save", () => {
        expect(INITIAL_AUTOSAVE.status).toBe("idle");
        expect(needsSave(INITIAL_AUTOSAVE)).toBe(false);
        expect(whisperText(INITIAL_AUTOSAVE, true)).toBeNull();
    });

    it("a change goes dirty, bumps the version and wants a save", () => {
        const s = autosaveReducer(INITIAL_AUTOSAVE, { type: "change" });
        expect(s.status).toBe("dirty");
        expect(s.version).toBe(1);
        expect(needsSave(s)).toBe(true);
        expect(whisperText(s, false)).toBe("Saving…");
    });

    it("saveStart takes the in-flight token; a second start is a no-op", () => {
        let s = autosaveReducer(INITIAL_AUTOSAVE, { type: "change" });
        s = autosaveReducer(s, { type: "saveStart" });
        expect(s.status).toBe("saving");
        expect(s.inFlightVersion).toBe(1);
        expect(needsSave(s)).toBe(false); // one request at a time
        const again = autosaveReducer(s, { type: "saveStart" });
        expect(again).toBe(s);
    });

    it("success for the latest version lands on saved", () => {
        let s = autosaveReducer(INITIAL_AUTOSAVE, { type: "change" });
        s = autosaveReducer(s, { type: "saveStart" });
        s = autosaveReducer(s, { type: "saveSuccess", version: 1, atMs: 1_000 });
        expect(s.status).toBe("saved");
        expect(s.savedVersion).toBe(1);
        expect(s.inFlightVersion).toBeNull();
        expect(needsSave(s)).toBe(false);
    });

    it("latest state wins: edits during a flight leave it dirty on success", () => {
        let s = autosaveReducer(INITIAL_AUTOSAVE, { type: "change" }); // v1
        s = autosaveReducer(s, { type: "saveStart" }); // flight carries v1
        s = autosaveReducer(s, { type: "change" }); // v2 while in flight
        expect(s.status).toBe("saving"); // whisper stays honest
        expect(needsSave(s)).toBe(false); // still one at a time
        s = autosaveReducer(s, { type: "saveSuccess", version: 1, atMs: 1_000 });
        expect(s.status).toBe("dirty"); // v2 still unsaved
        expect(s.savedVersion).toBe(1);
        expect(needsSave(s)).toBe(true); // caller chases the new version
    });

    it("an error preserves state, surfaces the message and waits", () => {
        let s = autosaveReducer(INITIAL_AUTOSAVE, { type: "change" });
        s = autosaveReducer(s, { type: "saveStart" });
        s = autosaveReducer(s, { type: "saveError", version: 1, error: "Nope." });
        expect(s.status).toBe("error");
        expect(s.error).toBe("Nope.");
        expect(s.version).toBe(1); // local edits stand
        expect(s.inFlightVersion).toBeNull();
        expect(needsSave(s)).toBe(false); // no hot retry loop
        expect(whisperText(s, true)).toBeNull(); // the alert line has taken over
    });

    it("the next change after an error clears it and retries", () => {
        const errored = at({ status: "error", version: 3, savedVersion: 2, error: "Nope." });
        const s = autosaveReducer(errored, { type: "change" });
        expect(s.status).toBe("dirty");
        expect(s.error).toBeNull();
        expect(s.version).toBe(4);
        expect(needsSave(s)).toBe(true);
    });

    it("an explicit retry re-arms without inventing an edit", () => {
        const errored = at({ status: "error", version: 3, savedVersion: 2, error: "Nope." });
        const s = autosaveReducer(errored, { type: "retry" });
        expect(s.status).toBe("dirty");
        expect(s.version).toBe(3); // content did not change
        expect(s.error).toBeNull();
        expect(needsSave(s)).toBe(true);
    });

    it("retry outside an error is a no-op", () => {
        const saved = at({ status: "saved", version: 1, savedVersion: 1, savedAtMs: 5 });
        expect(autosaveReducer(saved, { type: "retry" })).toBe(saved);
    });

    it("a stale success never regresses savedVersion", () => {
        const s = autosaveReducer(
            at({ status: "saving", version: 5, savedVersion: 4, inFlightVersion: 3 }),
            { type: "saveSuccess", version: 3, atMs: 9 },
        );
        expect(s.savedVersion).toBe(4);
        expect(s.status).toBe("dirty");
    });

    it("whisper reads 'just now' while recent, plain Saved after", () => {
        const saved = at({ status: "saved", version: 1, savedVersion: 1, savedAtMs: 10_000 });
        expect(whisperText(saved, true)).toBe("Saved just now ✓");
        expect(whisperText(saved, false)).toBe("Saved ✓");
    });

    it("relaxDelayMs counts down the 30s window and never goes negative", () => {
        expect(relaxDelayMs(10_000, 10_000)).toBe(SAVED_JUST_NOW_MS);
        expect(relaxDelayMs(10_000, 10_000 + SAVED_JUST_NOW_MS - 1)).toBe(1);
        expect(relaxDelayMs(10_000, 10_000 + SAVED_JUST_NOW_MS)).toBe(0);
        expect(relaxDelayMs(10_000, 10_000 + SAVED_JUST_NOW_MS * 5)).toBe(0);
    });

    it("exports a ~900ms debounce for the component to honor", () => {
        expect(AUTOSAVE_DEBOUNCE_MS).toBe(900);
    });
});
