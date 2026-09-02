// @vitest-environment jsdom
/**
 * Wave 4a — ribbon-tray judging. Tapping a horse pins the LOWEST
 * empty ribbon (sparse map, not an ordered list); tapping a tray
 * slot or a placed card takes back exactly that ribbon — nobody
 * shifts. Every change autosaves (debounced, one in flight); errors
 * preserve the tray; "Class done →" runs the markDone save and
 * advances. Header = navigation (chevrons + All classes dialog).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

import JudgeQueue from "@/components/shows/JudgeQueue";
import { TRAY_FULL_MESSAGE } from "@/lib/shows/judgeTray";
import type { JudgeQueueData, JudgeQueueEntry } from "@/lib/shows/gallery";

const actions = vi.hoisted(() => ({
    recordPlacings: vi.fn().mockResolvedValue({ success: true, recorded: 2 }),
}));
vi.mock("@/app/actions/shows-v2", () => actions);

// The championship round (CallbackLadder) writes through the ring
// actions module — mocked so jsdom never imports the server file.
const ringActions = vi.hoisted(() => ({
    recordCallback: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/app/actions/shows-v2-ring", () => ringActions);

function queueEntry(
    id: string,
    name: string,
    overrides: Partial<JudgeQueueEntry> = {},
): JudgeQueueEntry {
    return {
        id,
        horseName: name,
        entryNumber: null,
        photoUrl: `https://cdn.test/${id}.webp`,
        ownerAlias: null,
        place: null,
        note: null,
        ...overrides,
    };
}

function queueData(overrides: Partial<JudgeQueueData> = {}): JudgeQueueData {
    return {
        show: {
            id: "show-1",
            title: "July Photo Classic",
            status: "judging",
            judging: "judged",
            blindBrowsing: true,
        },
        viewerRole: "judge",
        classes: [
            {
                classId: "class-1",
                className: "OF Quarter Horse",
                classNumber: "1",
                divisionId: "division-1",
                divisionName: "OF Plastic Halter",
                sectionId: "section-1",
                sectionName: "Stock",
                status: "scheduled",
                entries: [
                    queueEntry("entry-a", "Dash of Cash"),
                    queueEntry("entry-b", "Copper Penny"),
                    queueEntry("entry-c", "Midnight Oil"),
                ],
            },
            {
                classId: "class-2",
                className: "OF Appaloosa",
                classNumber: "2",
                divisionId: "division-1",
                divisionName: "OF Plastic Halter",
                sectionId: "section-1",
                sectionName: "Stock",
                status: "placed",
                entries: [],
            },
        ],
        sections: [{ id: "section-1", name: "Stock", divisionId: "division-1" }],
        divisions: [{ id: "division-1", name: "OF Plastic Halter" }],
        callbacks: [],
        ...overrides,
    };
}

/** Two-class fixture where BOTH classes still need judging. */
function twoOpenClasses(): JudgeQueueData {
    const data = queueData();
    data.classes[1].status = "scheduled";
    data.classes[1].entries = [
        queueEntry("entry-d", "Sandstorm Strike"),
        queueEntry("entry-e", "Prairie Rose"),
    ];
    return data;
}

/** Flush the resolved recordPlacings promise through React. */
async function flushAsync() {
    await act(async () => {
        await Promise.resolve();
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    actions.recordPlacings.mockResolvedValue({ success: true, recorded: 2 });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("JudgeQueue — class header navigation", () => {
    it("shows the class position, entry count and placed progress", () => {
        render(<JudgeQueue queue={queueData()} />);
        expect(screen.getByTestId("judge-progress")).toHaveTextContent(
            "Class 1 of 2 · 3 entries · 1 placed ✓",
        );
        expect(screen.getByRole("heading", { name: "1 · OF Quarter Horse" })).toBeInTheDocument();
    });

    it("chevrons step between classes and disable at the ends", () => {
        render(<JudgeQueue queue={queueData()} />);
        expect(screen.getByTestId("prev-class")).toBeDisabled();
        fireEvent.click(screen.getByTestId("next-class"));
        expect(screen.getByTestId("judge-progress")).toHaveTextContent("Class 2 of 2");
        expect(screen.getByTestId("next-class")).toBeDisabled();
        fireEvent.click(screen.getByTestId("prev-class"));
        expect(screen.getByTestId("judge-progress")).toHaveTextContent("Class 1 of 2");
    });

    it("the All classes dialog lists every class by NAME and jumps anywhere", () => {
        render(<JudgeQueue queue={queueData()} />);
        fireEvent.click(screen.getByTestId("all-classes"));
        const rows = screen.getAllByTestId("class-jump");
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveTextContent("OF Quarter Horse");
        expect(rows[0]).toHaveTextContent("3 entries");
        expect(rows[0]).toHaveAttribute("aria-current", "true");
        expect(rows[1]).toHaveTextContent("OF Appaloosa");
        expect(rows[1]).toHaveTextContent("✓ placed");
        fireEvent.click(rows[1]);
        expect(screen.getByTestId("judge-progress")).toHaveTextContent("Class 2 of 2");
    });

    it("shows the first-visit instruction only while nothing is placed anywhere", () => {
        render(<JudgeQueue queue={twoOpenClasses()} />);
        expect(screen.getByTestId("tray-hint")).toHaveTextContent(
            "Tap a horse to pin the next ribbon on it. Tap a ribbon in the tray to take it back. Everything saves as you go.",
        );
    });

    it("hides the instruction once the show has placings", () => {
        render(<JudgeQueue queue={queueData()} />); // class-2 already placed
        expect(screen.queryByTestId("tray-hint")).not.toBeInTheDocument();
    });
});

describe("JudgeQueue — pinning ribbons (sparse tray model)", () => {
    it("each tap pins the lowest empty ribbon in tap order", () => {
        render(<JudgeQueue queue={queueData()} />);
        const [a, b, c] = screen.getAllByTestId("judge-entry");

        fireEvent.click(b); // Copper Penny → 1st
        fireEvent.click(a); // Dash of Cash → 2nd
        fireEvent.click(c); // Midnight Oil → 3rd

        const chips = screen.getAllByTestId("place-chip");
        expect(chips.map((chip) => chip.textContent)).toEqual(["2nd", "1st", "3rd"]);
        expect(
            screen.getByRole("button", { name: "Copper Penny — 1st place. Tap to remove." }),
        ).toHaveAttribute("aria-pressed", "true");
    });

    it("re-tapping a placed horse frees ONLY its ribbon — nobody shifts", () => {
        render(<JudgeQueue queue={queueData()} />);
        const [a, b, c] = screen.getAllByTestId("judge-entry");
        fireEvent.click(b); // 1st
        fireEvent.click(a); // 2nd
        fireEvent.click(c); // 3rd

        fireEvent.click(b); // take back 1st — a keeps 2nd, c keeps 3rd
        let chips = screen.getAllByTestId("place-chip");
        expect(chips.map((chip) => chip.textContent)).toEqual(["2nd", "3rd"]);

        // The freed 1st is now the lowest empty slot — the next tap takes it.
        fireEvent.click(b);
        chips = screen.getAllByTestId("place-chip");
        expect(chips.map((chip) => chip.textContent)).toEqual(["2nd", "1st", "3rd"]);
    });

    it("tapping a filled tray slot clears exactly that placement", () => {
        render(<JudgeQueue queue={queueData()} />);
        const [a, b, c] = screen.getAllByTestId("judge-entry");
        fireEvent.click(b); // 1st
        fireEvent.click(a); // 2nd
        fireEvent.click(c); // 3rd

        expect(screen.getByTestId("tray-slot-2")).toHaveAccessibleName(
            "2nd place — Dash of Cash. Tap to clear.",
        );
        fireEvent.click(screen.getByTestId("tray-slot-2"));

        const chips = screen.getAllByTestId("place-chip");
        expect(chips.map((chip) => chip.textContent)).toEqual(["1st", "3rd"]);
        expect(screen.getByTestId("tray-slot-2")).toHaveAccessibleName("2nd place — empty");
        expect(screen.getByTestId("tray-slot-2")).toHaveAttribute("aria-disabled", "true");
    });

    it("refuses a 7th ribbon with the gentle message and an unchanged tray", () => {
        const data = queueData();
        data.classes[0].entries = "abcdefg"
            .split("")
            .map((letter) => queueEntry(`entry-${letter}`, `Horse ${letter.toUpperCase()}`));
        render(<JudgeQueue queue={data} />);
        const entries = screen.getAllByTestId("judge-entry");
        for (let i = 0; i < 6; i++) fireEvent.click(entries[i]);
        expect(screen.getAllByTestId("place-chip")).toHaveLength(6);

        fireEvent.click(entries[6]);
        expect(screen.getByTestId("tray-refusal")).toHaveTextContent(TRAY_FULL_MESSAGE);
        expect(screen.getAllByTestId("place-chip")).toHaveLength(6);

        // Taking one back clears the message and frees that exact slot.
        fireEvent.click(screen.getByTestId("tray-slot-4"));
        expect(screen.getByTestId("tray-refusal")).toBeEmptyDOMElement();
        fireEvent.click(entries[6]);
        expect(screen.getByTestId("tray-slot-4")).toHaveAccessibleName(
            "4th place — Horse G. Tap to clear.",
        );
    });

    it("pre-fills the tray from recorded placings, gaps preserved", () => {
        const data = queueData();
        data.classes[0].entries = [
            queueEntry("entry-a", "Dash of Cash", { place: 3 }),
            queueEntry("entry-b", "Copper Penny", { place: 1 }),
            queueEntry("entry-c", "Midnight Oil"),
        ];
        render(<JudgeQueue queue={data} />);
        const chips = screen.getAllByTestId("place-chip");
        expect(chips.map((chip) => chip.textContent)).toEqual(["3rd", "1st"]);
        // 2nd is open — the next tap takes it, not 4th.
        fireEvent.click(screen.getAllByTestId("judge-entry")[2]);
        expect(screen.getByTestId("tray-slot-2")).toHaveAccessibleName(
            "2nd place — Midnight Oil. Tap to clear.",
        );
    });

    it("blind judging: no owner aliases in a blind payload render", () => {
        render(<JudgeQueue queue={queueData()} />);
        expect(screen.queryByText(/^@/)).not.toBeInTheDocument();
    });
});

describe("JudgeQueue — autosave", () => {
    it("whispers Saving… immediately and fires ONE save per burst of taps", async () => {
        vi.useFakeTimers();
        render(<JudgeQueue queue={queueData()} />);
        const [a, b, c] = screen.getAllByTestId("judge-entry");
        fireEvent.click(b);
        fireEvent.click(a);
        fireEvent.click(c);

        expect(screen.getByTestId("save-whisper")).toHaveTextContent("Saving…");
        expect(actions.recordPlacings).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(actions.recordPlacings).toHaveBeenCalledTimes(1);
        expect(actions.recordPlacings).toHaveBeenCalledWith({
            classId: "class-1",
            placings: [
                { entryId: "entry-b", place: 1 },
                { entryId: "entry-a", place: 2 },
                { entryId: "entry-c", place: 3 },
            ],
            notes: expect.any(Object),
            markDone: false,
        });
        expect(screen.getByTestId("save-whisper")).toHaveTextContent("Saved just now ✓");

        // Quiet afterwards — no repeat saves without changes.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        expect(actions.recordPlacings).toHaveBeenCalledTimes(1);
    });

    it("saves the sparse slate after a slot clear (places NOT renumbered)", async () => {
        vi.useFakeTimers();
        render(<JudgeQueue queue={queueData()} />);
        const [a, b, c] = screen.getAllByTestId("judge-entry");
        fireEvent.click(b);
        fireEvent.click(a);
        fireEvent.click(c);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        fireEvent.click(screen.getByTestId("tray-slot-1"));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(actions.recordPlacings).toHaveBeenCalledTimes(2);
        expect(actions.recordPlacings).toHaveBeenLastCalledWith({
            classId: "class-1",
            placings: [
                { entryId: "entry-a", place: 2 },
                { entryId: "entry-c", place: 3 },
            ],
            notes: expect.any(Object),
            markDone: false,
        });
    });

    it("relaxes the whisper to Saved ✓ after 30 seconds", async () => {
        vi.useFakeTimers();
        render(<JudgeQueue queue={queueData()} />);
        fireEvent.click(screen.getAllByTestId("judge-entry")[0]);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(screen.getByTestId("save-whisper")).toHaveTextContent("Saved just now ✓");
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30_000);
        });
        expect(screen.getByTestId("save-whisper")).toHaveTextContent(/^Saved ✓$/);
    });

    it("autosaves critiques with the placed entry", async () => {
        vi.useFakeTimers();
        render(<JudgeQueue queue={queueData()} />);
        fireEvent.click(screen.getAllByTestId("judge-entry")[1]); // Copper Penny → 1st
        fireEvent.click(
            screen.getByRole("button", { name: "Add critique for Copper Penny" }),
        );
        fireEvent.change(screen.getByLabelText("Placing note for Copper Penny"), {
            target: { value: "Gorgeous shading." },
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(actions.recordPlacings).toHaveBeenCalledTimes(1);
        expect(actions.recordPlacings).toHaveBeenCalledWith({
            classId: "class-1",
            placings: [{ entryId: "entry-b", place: 1, note: "Gorgeous shading." }],
            notes: expect.any(Object),
            markDone: false,
        });
    });

    it("a failed save alerts verbatim, preserves the tray and retries on demand", async () => {
        vi.useFakeTimers();
        actions.recordPlacings.mockResolvedValueOnce({
            success: false,
            error: "Placings can only be recorded while the show is judging.",
        });
        render(<JudgeQueue queue={queueData()} />);
        const [a, b] = screen.getAllByTestId("judge-entry");
        fireEvent.click(b);
        fireEvent.click(a);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(screen.getByRole("alert")).toHaveTextContent(
            /only be recorded while the show is judging/i,
        );
        // Tray state preserved through the failure.
        const chips = screen.getAllByTestId("place-chip");
        expect(chips.map((chip) => chip.textContent)).toEqual(["2nd", "1st"]);

        fireEvent.click(screen.getByTestId("retry-save"));
        await flushAsync();
        expect(actions.recordPlacings).toHaveBeenCalledTimes(2);
        expect(actions.recordPlacings).toHaveBeenLastCalledWith({
            classId: "class-1",
            placings: [
                { entryId: "entry-b", place: 1 },
                { entryId: "entry-a", place: 2 },
            ],
            notes: expect.any(Object),
            markDone: false,
        });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByTestId("save-whisper")).toHaveTextContent("Saved just now ✓");
    });

    it("keeps one request in flight and chases the latest state", async () => {
        vi.useFakeTimers();
        let resolveFirst: (value: { success: true; recorded: number }) => void = () => {};
        actions.recordPlacings
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveFirst = resolve;
                    }),
            )
            .mockResolvedValue({ success: true, recorded: 2 });

        render(<JudgeQueue queue={queueData()} />);
        const [a, b] = screen.getAllByTestId("judge-entry");
        fireEvent.click(b); // 1st
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000); // first save leaves, hangs
        });
        expect(actions.recordPlacings).toHaveBeenCalledTimes(1);

        fireEvent.click(a); // 2nd — lands while the first save is in flight
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000); // debounce fires but stays queued
        });
        expect(actions.recordPlacings).toHaveBeenCalledTimes(1); // still one in flight

        await act(async () => {
            resolveFirst({ success: true, recorded: 1 });
            await vi.advanceTimersByTimeAsync(0);
        });
        // The completion chases the newer state immediately.
        expect(actions.recordPlacings).toHaveBeenCalledTimes(2);
        expect(actions.recordPlacings).toHaveBeenLastCalledWith(
            expect.objectContaining({
                placings: [
                    { entryId: "entry-b", place: 1 },
                    { entryId: "entry-a", place: 2 },
                ],
            }),
        );
    });
});

describe("JudgeQueue — Class done", () => {
    it("runs the final markDone save and advances to the next unplaced class", async () => {
        render(<JudgeQueue queue={twoOpenClasses()} />);
        const [, b] = screen.getAllByTestId("judge-entry");
        fireEvent.click(b); // 1st
        fireEvent.click(screen.getByTestId("class-done"));

        await waitFor(() =>
            expect(actions.recordPlacings).toHaveBeenCalledWith({
                classId: "class-1",
                placings: [{ entryId: "entry-b", place: 1 }],
                notes: expect.any(Object),
                markDone: true,
            }),
        );
        await waitFor(() =>
            expect(screen.getByTestId("judge-progress")).toHaveTextContent(
                "Class 2 of 2 · 2 entries · 1 placed ✓",
            ),
        );
        expect(screen.getByTestId("judge-toast")).toHaveTextContent(
            "1 · OF Quarter Horse done ✓",
        );
    });

    it("an empty class keeps the mark-done-and-move-on affordance", () => {
        render(<JudgeQueue queue={queueData()} />);
        fireEvent.click(screen.getByTestId("next-class")); // class-2, no entries
        expect(
            screen.getByText(/No live entries in this class — mark it done and move on/i),
        ).toBeInTheDocument();
        expect(screen.getByTestId("class-done")).toBeInTheDocument();
        expect(screen.queryAllByTestId("tray-slot-1")).toHaveLength(0);
    });

    it("celebrates when the final class is done", async () => {
        render(<JudgeQueue queue={queueData()} />); // class-2 already placed
        fireEvent.click(screen.getAllByTestId("judge-entry")[0]);
        fireEvent.click(screen.getByTestId("class-done"));
        await waitFor(() =>
            expect(screen.getByTestId("judging-complete")).toHaveTextContent(
                "All 2 classes judged 🎉 — championship callbacks are ready.",
            ),
        );
        expect(actions.recordPlacings).toHaveBeenCalledWith(
            expect.objectContaining({ markDone: true }),
        );
    });
});

describe("JudgeQueue — gating and the championship round", () => {
    it("disables recording outside the judging status", () => {
        const data = queueData();
        data.show.status = "results_review";
        render(<JudgeQueue queue={data} />);
        expect(screen.queryByTestId("class-done")).not.toBeInTheDocument();
        expect(screen.queryByTestId("ribbon-tray")).not.toBeInTheDocument();
        expect(screen.getByText(/results review/i)).toBeInTheDocument();
        // Cards render read-only.
        expect(screen.getAllByTestId("judge-entry")[0]).toBeDisabled();
    });

    it("opens the championship round once every class is placed", () => {
        const data = queueData();
        data.classes[0].status = "placed";
        data.classes[0].entries = [
            queueEntry("entry-a", "Dash of Cash", { place: 1, entryNumber: 7 }),
            queueEntry("entry-b", "Copper Penny", { place: 2 }),
        ];
        render(<JudgeQueue queue={data} />);
        // The section round is open with the 1st-place entry as candidate.
        expect(screen.getByTestId("ladder-progress")).toHaveTextContent(
            "0 of 3 callbacks decided",
        );
        const candidates = screen.getAllByTestId("callback-candidate");
        expect(candidates).toHaveLength(1);
        expect(candidates[0]).toHaveTextContent("Dash of Cash");
    });

    it("keeps the championship round hidden while classes remain", () => {
        render(<JudgeQueue queue={queueData()} />);
        expect(screen.queryByTestId("ladder-progress")).not.toBeInTheDocument();
    });

    it("shows an empty state when the show has no classes", () => {
        render(<JudgeQueue queue={queueData({ classes: [] })} />);
        expect(screen.getByText(/no classes to judge yet/i)).toBeInTheDocument();
    });
});
