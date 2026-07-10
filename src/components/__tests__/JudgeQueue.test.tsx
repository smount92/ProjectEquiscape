// @vitest-environment jsdom
/**
 * Phase E1 — the judge queue's tap-to-place interaction: tapping
 * entries assigns 1st, 2nd, … in tap order; tapping again removes
 * (everyone below steps up); the save button submits the whole
 * slate to recordPlacings.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import JudgeQueue from "@/components/shows/JudgeQueue";
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

function queueEntry(id: string, name: string, overrides: Partial<JudgeQueueEntry> = {}): JudgeQueueEntry {
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

beforeEach(() => {
    vi.clearAllMocks();
    actions.recordPlacings.mockResolvedValue({ success: true, recorded: 2 });
});

describe("JudgeQueue — tap-to-place", () => {
    it("shows progress across classes", () => {
        render(<JudgeQueue queue={queueData()} />);
        expect(screen.getByTestId("judge-progress")).toHaveTextContent(
            "1 of 2 classes placed",
        );
    });

    it("assigns places in tap order and removes on re-tap", () => {
        render(<JudgeQueue queue={queueData()} />);
        const [a, b, c] = screen.getAllByTestId("judge-entry");

        fireEvent.click(b); // Copper Penny → 1st
        fireEvent.click(a); // Dash of Cash → 2nd
        fireEvent.click(c); // Midnight Oil → 3rd

        let chips = screen.getAllByTestId("place-chip");
        expect(chips.map((chip) => chip.textContent)).toEqual(["2nd", "1st", "3rd"]);

        // Re-tap the 1st-place entry: it steps out, the others move up.
        fireEvent.click(b);
        chips = screen.getAllByTestId("place-chip");
        expect(chips.map((chip) => chip.textContent)).toEqual(["1st", "2nd"]);
    });

    it("submits the whole slate (with critique) and marks the class done", async () => {
        render(<JudgeQueue queue={queueData()} />);
        const [a, b] = screen.getAllByTestId("judge-entry");
        fireEvent.click(b); // 1st
        fireEvent.click(a); // 2nd

        // Attach a critique to Copper Penny.
        fireEvent.click(screen.getAllByRole("button", { name: "Critique" })[1]);
        fireEvent.change(screen.getByLabelText("Critique for Copper Penny"), {
            target: { value: "Gorgeous shading." },
        });

        fireEvent.click(screen.getByTestId("save-done"));
        await waitFor(() =>
            expect(actions.recordPlacings).toHaveBeenCalledWith({
                classId: "class-1",
                placings: [
                    { entryId: "entry-b", place: 1, note: "Gorgeous shading." },
                    { entryId: "entry-a", place: 2, note: undefined },
                ],
                markDone: true,
            }),
        );
    });

    it("saves without marking done via the secondary button", async () => {
        render(<JudgeQueue queue={queueData()} />);
        fireEvent.click(screen.getAllByTestId("judge-entry")[0]);
        fireEvent.click(screen.getByTestId("save-placings"));
        await waitFor(() =>
            expect(actions.recordPlacings).toHaveBeenCalledWith(
                expect.objectContaining({ markDone: false }),
            ),
        );
    });

    it("surfaces action refusals verbatim", async () => {
        actions.recordPlacings.mockResolvedValueOnce({
            success: false,
            error: "Placings can only be recorded while the show is judging.",
        });
        render(<JudgeQueue queue={queueData()} />);
        fireEvent.click(screen.getAllByTestId("judge-entry")[0]);
        fireEvent.click(screen.getByTestId("save-placings"));
        expect(
            await screen.findByText(/only be recorded while the show is judging/i),
        ).toBeInTheDocument();
    });

    it("pre-fills the slate from recorded placings", () => {
        const data = queueData();
        data.classes[0].entries = [
            queueEntry("entry-a", "Dash of Cash", { place: 2 }),
            queueEntry("entry-b", "Copper Penny", { place: 1 }),
        ];
        render(<JudgeQueue queue={data} />);
        const chips = screen.getAllByTestId("place-chip");
        expect(chips.map((chip) => chip.textContent)).toEqual(["2nd", "1st"]);
    });

    it("blind judging: no owner aliases in a blind payload render", () => {
        render(<JudgeQueue queue={queueData()} />);
        expect(screen.queryByText(/^@/)).not.toBeInTheDocument();
    });

    it("disables recording outside the judging status", () => {
        const data = queueData();
        data.show.status = "results_review";
        render(<JudgeQueue queue={data} />);
        expect(screen.queryByTestId("save-done")).not.toBeInTheDocument();
        expect(screen.getByText(/results review/i)).toBeInTheDocument();
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
});
