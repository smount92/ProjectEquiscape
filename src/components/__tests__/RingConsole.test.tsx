// @vitest-environment jsdom
/**
 * Phase E2 — the ring console: leg-tag tap-to-place order, the
 * NOW JUDGING / ON DECK board, guidance outside 'running', and the
 * offline pending-saves indicator (a thrown recordPlacings queues
 * the slate in localStorage).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import RingConsole from "@/components/shows/RingConsole";
import { loadQueue, queueStorageKey } from "@/lib/shows/retryQueue";
import type { RingConsoleData } from "@/lib/shows/ring";

const actions = vi.hoisted(() => ({
    recordPlacings: vi.fn().mockResolvedValue({ success: true, recorded: 2 }),
    updateClass: vi.fn().mockResolvedValue({ success: true }),
    splitClass: vi.fn().mockResolvedValue({ success: true, newClassId: "new-class" }),
    combineClasses: vi.fn().mockResolvedValue({ success: true, newClassId: "new-class" }),
}));
vi.mock("@/app/actions/shows-v2", () => actions);

const ringActions = vi.hoisted(() => ({
    recordCallback: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/app/actions/shows-v2-ring", () => ringActions);

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";

function consoleData(overrides: Partial<RingConsoleData> = {}): RingConsoleData {
    return {
        show: {
            id: SHOW_ID,
            title: "Barn Burner Live",
            mode: "live",
            status: "running",
            venueName: "Fairgrounds Hall B",
            showDate: "2026-07-11",
        },
        viewerRole: "steward",
        classes: [
            {
                classId: "class-1",
                className: "OF Stock Foals",
                classNumber: "14",
                status: "judging",
                sectionId: "section-1",
                sectionName: "Stock",
                divisionId: "division-1",
                divisionName: "OF Plastic Halter",
                entries: [
                    { id: "e1", entryNumber: 7, horseName: "Dash of Cash", place: null },
                    { id: "e2", entryNumber: 12, horseName: "Copper Penny", place: null },
                    { id: "e3", entryNumber: 9, horseName: "Midnight Oil", place: null },
                ],
            },
            {
                classId: "class-2",
                className: "OF Stock Mares",
                classNumber: "15",
                status: "scheduled",
                sectionId: "section-1",
                sectionName: "Stock",
                divisionId: "division-1",
                divisionName: "OF Plastic Halter",
                entries: [
                    { id: "e4", entryNumber: 3, horseName: "River Song", place: null },
                ],
            },
        ],
        sections: [{ id: "section-1", name: "Stock", divisionId: "division-1" }],
        divisions: [{ id: "division-1", name: "OF Plastic Halter" }],
        callbacks: [],
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    actions.recordPlacings.mockResolvedValue({ success: true, recorded: 2 });
});

describe("RingConsole — the board", () => {
    it("shows NOW JUDGING huge with ON DECK next", () => {
        render(<RingConsole data={consoleData()} />);
        expect(screen.getByTestId("now-judging")).toHaveTextContent(
            "14 · OF Stock Foals",
        );
        expect(screen.getByTestId("on-deck")).toHaveTextContent("15 · OF Stock Mares");
        expect(screen.getByTestId("ring-progress")).toHaveTextContent(
            "0 of 2 classes placed",
        );
    });

    it("guides instead of recording when the show isn't running", () => {
        const data = consoleData();
        data.show.status = "entries_closed";
        render(<RingConsole data={data} />);
        expect(screen.getByText(/the ring console opens when/i)).toBeInTheDocument();
        expect(screen.queryByTestId("ring-entry")).not.toBeInTheDocument();
        expect(screen.queryByTestId("call-on-deck")).not.toBeInTheDocument();
    });

    it("calls the on-deck class through the class state machine", async () => {
        render(<RingConsole data={consoleData()} />);
        fireEvent.click(screen.getByTestId("call-on-deck"));
        await waitFor(() =>
            expect(actions.updateClass).toHaveBeenCalledWith({
                classId: "class-2",
                patch: { status: "called" },
            }),
        );
    });
});

describe("RingConsole — the placing recorder", () => {
    it("leads with leg tags and assigns places in tap order", async () => {
        render(<RingConsole data={consoleData()} />);
        const entries = screen.getAllByTestId("ring-entry");
        expect(entries[0]).toHaveTextContent("#7");
        expect(entries[1]).toHaveTextContent("#12");
        expect(entries[2]).toHaveTextContent("#9");

        fireEvent.click(entries[1]); // #12 → 1st
        fireEvent.click(entries[2]); // #9  → 2nd
        fireEvent.click(entries[0]); // #7  → 3rd
        let chips = screen.getAllByTestId("ring-place-chip");
        expect(chips.map((c) => c.textContent)).toEqual(["3rd", "1st", "2nd"]);

        // Re-tap #12: it steps out, the others move up.
        fireEvent.click(entries[1]);
        chips = screen.getAllByTestId("ring-place-chip");
        expect(chips.map((c) => c.textContent)).toEqual(["2nd", "1st"]);

        fireEvent.click(screen.getByTestId("ring-save-done"));
        await waitFor(() =>
            expect(actions.recordPlacings).toHaveBeenCalledWith({
                classId: "class-1",
                placings: [
                    { entryId: "e3", place: 1 },
                    { entryId: "e1", place: 2 },
                ],
                markDone: true,
            }),
        );
    });

    it("surfaces server refusals verbatim (never queued)", async () => {
        actions.recordPlacings.mockResolvedValueOnce({
            success: false,
            error: "Placings can only be recorded while the show is running.",
        });
        render(<RingConsole data={consoleData()} />);
        fireEvent.click(screen.getAllByTestId("ring-entry")[0]);
        fireEvent.click(screen.getByTestId("ring-save-done"));
        expect(
            await screen.findByText(/only be recorded while the show is running/i),
        ).toBeInTheDocument();
        expect(screen.queryByTestId("pending-saves")).not.toBeInTheDocument();
        expect(loadQueue(window.localStorage, SHOW_ID)).toEqual([]);
    });
});

describe("RingConsole — Barn Mode (offline queue)", () => {
    it("queues a thrown save and shows the pending indicator", async () => {
        actions.recordPlacings.mockRejectedValueOnce(new TypeError("fetch failed"));
        render(<RingConsole data={consoleData()} />);

        const entries = screen.getAllByTestId("ring-entry");
        fireEvent.click(entries[0]); // #7 → 1st
        fireEvent.click(screen.getByTestId("ring-save-done"));

        // The banner is the durable indicator (the per-class notice
        // unmounts with the recorder as the run order advances).
        const indicator = await screen.findByTestId("pending-saves");
        expect(indicator).toHaveTextContent("1 save pending");
        expect(indicator).toHaveTextContent(/waiting for signal/i);

        // The slate is durable in localStorage for the retry loop.
        const queued = loadQueue(window.localStorage, SHOW_ID);
        expect(queued).toHaveLength(1);
        expect(queued[0]).toMatchObject({
            classId: "class-1",
            markDone: true,
            placings: [{ entryId: "e1", place: 1 }],
        });

        // Optimistic overlay: the class flipped to placed locally, so
        // the run order advanced to the next class.
        expect(screen.getByTestId("ring-progress")).toHaveTextContent(
            "1 of 2 classes placed",
        );
    });

    it("'Retry now' flushes the queue when the network returns", async () => {
        // Seed a queued save as if a previous session lost signal.
        window.localStorage.setItem(
            queueStorageKey(SHOW_ID),
            JSON.stringify([
                {
                    classId: "class-1",
                    placings: [{ entryId: "e1", place: 1 }],
                    markDone: true,
                    queuedAt: "2026-07-11T09:00:00.000Z",
                },
            ]),
        );
        render(<RingConsole data={consoleData()} />);
        const indicator = await screen.findByTestId("pending-saves");
        expect(indicator).toHaveTextContent("1 save pending");

        fireEvent.click(screen.getByRole("button", { name: "Retry now" }));
        await waitFor(() =>
            expect(actions.recordPlacings).toHaveBeenCalledWith({
                classId: "class-1",
                placings: [{ entryId: "e1", place: 1 }],
                markDone: true,
            }),
        );
        await waitFor(() =>
            expect(screen.queryByTestId("pending-saves")).not.toBeInTheDocument(),
        );
        expect(loadQueue(window.localStorage, SHOW_ID)).toEqual([]);
    });
});
