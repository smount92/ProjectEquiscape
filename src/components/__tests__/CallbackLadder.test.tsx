// @vitest-environment jsdom
/**
 * Phase E2 — the callback round interaction: candidates render per
 * round, tap order picks Champion then Reserve, save submits
 * through recordCallback, waiting rounds stay locked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import CallbackLadder, { type LadderClassInfo } from "@/components/shows/CallbackLadder";
import type { CallbackRecord } from "@/lib/shows/callbacks";

const ringActions = vi.hoisted(() => ({
    recordCallback: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/app/actions/shows-v2-ring", () => ringActions);

const SECTIONS = [
    { id: "section-1", name: "Stock", divisionId: "division-1" },
    { id: "section-2", name: "Light", divisionId: "division-1" },
];
const DIVISIONS = [{ id: "division-1", name: "OF Plastic Halter" }];

function ladderClasses(): LadderClassInfo[] {
    return [
        {
            classId: "class-1",
            sectionId: "section-1",
            divisionId: "division-1",
            status: "placed",
            entries: [
                { id: "e1", horseName: "Dash of Cash", entryNumber: 7, photoUrl: null, place: 1 },
                { id: "e2", horseName: "Copper Penny", entryNumber: 9, photoUrl: null, place: 2 },
            ],
        },
        {
            classId: "class-2",
            sectionId: "section-1",
            divisionId: "division-1",
            status: "placed",
            entries: [
                { id: "e3", horseName: "Midnight Oil", entryNumber: 12, photoUrl: null, place: 1 },
            ],
        },
        {
            classId: "class-3",
            sectionId: "section-2",
            divisionId: "division-1",
            status: "judging",
            entries: [],
        },
    ];
}

function renderLadder(callbacks: CallbackRecord[] = [], canRecord = true) {
    return render(
        <CallbackLadder
            showId="123e4567-e89b-42d3-a456-426614174000"
            canRecord={canRecord}
            classes={ladderClasses()}
            sections={SECTIONS}
            divisions={DIVISIONS}
            callbacks={callbacks}
            onSaved={vi.fn()}
        />,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    ringActions.recordCallback.mockResolvedValue({ success: true });
});

describe("CallbackLadder", () => {
    it("renders the open section round's candidates with leg tags", () => {
        renderLadder();
        const candidates = screen.getAllByTestId("callback-candidate");
        // Stock is open: candidates are the two 1st places (e1, e3).
        expect(candidates).toHaveLength(2);
        expect(candidates[0]).toHaveTextContent("#7");
        expect(candidates[0]).toHaveTextContent("Dash of Cash");
        expect(candidates[1]).toHaveTextContent("#12");
        expect(candidates[1]).toHaveTextContent("Midnight Oil");
        // 2nd-place Copper Penny is NOT a candidate.
        expect(screen.queryByText("Copper Penny")).not.toBeInTheDocument();
    });

    it("keeps unready rounds waiting (Light unplaced; division locked)", () => {
        renderLadder();
        const waits = screen.getAllByTestId("round-waiting");
        // Light section + the division round both wait.
        expect(waits.length).toBeGreaterThanOrEqual(2);
        expect(waits[0]).toHaveTextContent(/every class in this section/i);
    });

    it("tap champion, tap reserve, save — submits through recordCallback", async () => {
        renderLadder();
        const [dash, midnight] = screen.getAllByTestId("callback-candidate");

        fireEvent.click(dash); // Champion
        fireEvent.click(midnight); // Reserve
        const chips = screen.getAllByTestId("champion-chip");
        expect(chips.map((c) => c.textContent)).toEqual([
            "Section Champion",
            "Section Reserve Champion",
        ]);

        fireEvent.click(screen.getByTestId("save-callback"));
        await waitFor(() =>
            expect(ringActions.recordCallback).toHaveBeenCalledWith({
                showId: "123e4567-e89b-42d3-a456-426614174000",
                scope: "section",
                scopeId: "section-1",
                championEntryId: "e1",
                reserveEntryId: "e3",
            }),
        );
    });

    it("re-tapping the champion steps it out (reserve promotes)", () => {
        renderLadder();
        const [dash, midnight] = screen.getAllByTestId("callback-candidate");
        fireEvent.click(dash);
        fireEvent.click(midnight);
        fireEvent.click(dash); // remove champion → midnight promotes
        const chips = screen.getAllByTestId("champion-chip");
        expect(chips).toHaveLength(1);
        expect(chips[0]).toHaveTextContent("Section Champion");
        expect(midnight).toContainElement(chips[0]);
    });

    it("pre-fills decided rounds and surfaces refusals verbatim", async () => {
        ringActions.recordCallback.mockResolvedValueOnce({
            success: false,
            error: "The champion must be one of this section's 1st-place entries.",
        });
        renderLadder([
            {
                scope: "section",
                scopeId: "section-1",
                championEntryId: "e1",
                reserveEntryId: null,
            },
        ]);
        expect(screen.getByTestId("round-decided")).toBeInTheDocument();
        expect(screen.getByTestId("ladder-progress")).toHaveTextContent(
            "1 of 4 callbacks decided",
        );

        // Change the pick: add a reserve, save, get the server refusal.
        const [, midnight] = screen.getAllByTestId("callback-candidate");
        fireEvent.click(midnight);
        fireEvent.click(screen.getByTestId("save-callback"));
        expect(
            await screen.findByText(/must be one of this section's 1st-place entries/i),
        ).toBeInTheDocument();
    });

    it("read-only outside recording windows", () => {
        renderLadder([], false);
        expect(screen.queryByTestId("save-callback")).not.toBeInTheDocument();
        const [dash] = screen.getAllByTestId("callback-candidate");
        fireEvent.click(dash);
        expect(screen.queryAllByTestId("champion-chip")).toHaveLength(0);
    });
});
