// @vitest-environment jsdom
/**
 * Wave 2 — the staff scratch door gets its console UI. The panel
 * only OFFERS the button where scratchEntry would say yes (staff
 * roles, show not completed); the action stays the authority and
 * its refusals surface verbatim in the confirm dialog.
 *
 * Show moderation — the bar list and the one-motion "Remove & bar",
 * which is owner-grained (every entry they hold goes) and therefore
 * offered per owner, not per entry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ShowEntriesPanel from "@/components/shows/ShowEntriesPanel";
import type {
    ConsoleBarredEntrant,
    ConsoleDivision,
    ConsoleEntry,
} from "@/lib/shows/console";
import type { ShowStatus, StaffRole } from "@/lib/shows/types";

const actions = vi.hoisted(() => ({
    scratchEntry: vi.fn(),
    setFeePaid: vi.fn(),
}));
vi.mock("@/app/actions/shows-v2", () => actions);

const v4 = vi.hoisted(() => ({
    barEntrant: vi.fn(),
    liftBar: vi.fn(),
    removeEntrantFromShow: vi.fn(),
    strikeEntryFromResults: vi.fn(),
}));
vi.mock("@/app/actions/shows-v4", () => v4);

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";
const CLASS_ID = "323e4567-e89b-42d3-a456-426614174000";
const ENTRY_ID = "623e4567-e89b-42d3-a456-426614174000";

const DIVISIONS: ConsoleDivision[] = [
    {
        id: "d1",
        name: "Halter",
        axis: "halter",
        sortOrder: 0,
        sections: [
            {
                id: "s1",
                name: "Breed",
                sortOrder: 0,
                classes: [
                    {
                        id: CLASS_ID,
                        name: "Quarter Horse",
                        classNumber: "110",
                        status: "scheduled",
                        maxPerEntrant: null,
                        allowedScales: null,
                        allowedFinishes: null,
                        isQualifying: true,
                        sortOrder: 0,
                        entryCount: 1,
                        exhibitorCount: 1,
                    },
                ],
            },
        ],
    },
];

function entry(overrides: Partial<ConsoleEntry> = {}): ConsoleEntry {
    return {
        id: ENTRY_ID,
        classId: CLASS_ID,
        horseName: "Duns Blazing",
        ownerId: "owner-1",
        ownerAlias: "pintopines",
        handlerAlias: null,
        entryNumber: 12,
        status: "entered",
        ...overrides,
    };
}

function renderPanel(input: {
    entries?: ConsoleEntry[];
    showStatus?: ShowStatus;
    viewerRole?: StaffRole;
    viewerId?: string;
    barred?: ConsoleBarredEntrant[];
}) {
    return render(
        <ShowEntriesPanel
            showId={SHOW_ID}
            divisions={DIVISIONS}
            entries={input.entries ?? [entry()]}
            showStatus={input.showStatus ?? "entries_closed"}
            feePaidUserIds={[]}
            barred={input.barred ?? []}
            feeInfo={null}
            canManage
            viewerRole={input.viewerRole ?? "host"}
            viewerId={input.viewerId ?? "host-1"}
        />,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    actions.scratchEntry.mockResolvedValue({ success: true });
    v4.barEntrant.mockResolvedValue({ success: true });
    v4.liftBar.mockResolvedValue({ success: true });
    v4.strikeEntryFromResults.mockResolvedValue({ success: true });
    v4.removeEntrantFromShow.mockResolvedValue({
        success: true,
        removedEntries: 2,
        removedClasses: 1,
        newlyBarred: true,
    });
});

describe("ShowEntriesPanel — who gets the scratch button", () => {
    it("offers scratch to host, co-host, and steward on live entries", () => {
        for (const role of ["host", "co_host", "steward"] as const) {
            const { unmount } = renderPanel({ viewerRole: role });
            expect(screen.getByRole("button", { name: "Scratch Duns Blazing" })).toBeInTheDocument();
            unmount();
        }
    });

    it("never offers scratch to a judge, after completion, or on an already-scratched entry", () => {
        const { unmount } = renderPanel({ viewerRole: "judge" });
        expect(screen.queryByRole("button", { name: /^Scratch/ })).not.toBeInTheDocument();
        unmount();

        const second = renderPanel({ showStatus: "completed" });
        expect(screen.queryByRole("button", { name: /^Scratch/ })).not.toBeInTheDocument();
        second.unmount();

        renderPanel({ entries: [entry({ status: "scratched" })] });
        expect(screen.queryByRole("button", { name: /^Scratch/ })).not.toBeInTheDocument();
    });

    it("dims scratched entries and stamps them red — the audit trail stays visible", () => {
        renderPanel({
            entries: [entry(), entry({ id: "723e4567-e89b-42d3-a456-426614174000", status: "scratched", horseName: "Silver Aspen" })],
        });
        const scratched = screen.getByTestId("entry-row-scratched");
        expect(scratched.className).toContain("opacity-60");
        expect(scratched).toHaveTextContent("Silver Aspen");
        expect(scratched.querySelector(".stamp-red")).not.toBeNull();
        expect(screen.getByTestId("entry-row").className).not.toContain("opacity-60");
    });
});

describe("ShowEntriesPanel — the scratch confirm flow", () => {
    it("passes the trimmed reason through and reports the owner notification", async () => {
        renderPanel({ viewerRole: "steward", viewerId: "steward-1" });
        fireEvent.click(screen.getByRole("button", { name: "Scratch Duns Blazing" }));

        expect(await screen.findByText("Scratch Duns Blazing?")).toBeInTheDocument();
        expect(screen.getByText(/@pintopines will be notified/i)).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText(/entered twice/i), {
            target: { value: "  Model broke in transit  " },
        });
        fireEvent.click(screen.getByTestId("scratch-confirm"));

        await waitFor(() =>
            expect(actions.scratchEntry).toHaveBeenCalledWith({
                entryId: ENTRY_ID,
                reason: "Model broke in transit",
            }),
        );
        expect(
            await screen.findByText("Entry scratched — the owner has been notified."),
        ).toBeInTheDocument();
    });

    it("omits the reason entirely when left blank and skips the notified copy for your own entry", async () => {
        renderPanel({ viewerRole: "host", viewerId: "owner-1" });
        fireEvent.click(screen.getByRole("button", { name: "Scratch Duns Blazing" }));
        expect(await screen.findByText(/this is your own entry/i)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("scratch-confirm"));
        await waitFor(() =>
            expect(actions.scratchEntry).toHaveBeenCalledWith({ entryId: ENTRY_ID }),
        );
        expect(await screen.findByText("Entry scratched.")).toBeInTheDocument();
    });

    it("surfaces the action's refusal verbatim and keeps the dialog open", async () => {
        actions.scratchEntry.mockResolvedValue({
            success: false,
            error: "This show's results are final — entries can no longer be scratched.",
        });
        renderPanel({});
        fireEvent.click(screen.getByRole("button", { name: "Scratch Duns Blazing" }));
        fireEvent.click(await screen.findByTestId("scratch-confirm"));

        expect(
            await screen.findByText(
                "This show's results are final — entries can no longer be scratched.",
            ),
        ).toBeInTheDocument();
        // Dialog still open for a retry/cancel.
        expect(screen.getByText("Scratch Duns Blazing?")).toBeInTheDocument();
    });
});

const BARRED: ConsoleBarredEntrant[] = [
    {
        userId: "owner-2",
        alias: "sloptrough",
        reason: "Joke entries after a warning",
        barredAt: "2026-08-20T10:00:00.000Z",
    },
];

describe("ShowEntriesPanel — the bar list", () => {
    it("lists barred members with the staff-only reason and an Unbar control", () => {
        renderPanel({ barred: BARRED });
        expect(screen.getByText("Bar List")).toBeInTheDocument();
        expect(screen.getByText("@sloptrough")).toBeInTheDocument();
        expect(screen.getByText("Joke entries after a warning")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Unbar @sloptrough" })).toBeInTheDocument();
    });

    it("says plainly when nobody is barred", () => {
        renderPanel({});
        expect(screen.getByText("No one is barred from this show.")).toBeInTheDocument();
    });

    it("lifts a bar and reports it", async () => {
        renderPanel({ barred: BARRED });
        fireEvent.click(screen.getByRole("button", { name: "Unbar @sloptrough" }));

        await waitFor(() =>
            expect(v4.liftBar).toHaveBeenCalledWith({ showId: SHOW_ID, userId: "owner-2" }),
        );
        expect(
            await screen.findByText("@sloptrough may enter this show again."),
        ).toBeInTheDocument();
    });

    it("surfaces an unbar refusal verbatim", async () => {
        v4.liftBar.mockResolvedValue({
            success: false,
            error: "Only the host, a co-host, or the site admin can lift a bar.",
        });
        renderPanel({ barred: BARRED });
        fireEvent.click(screen.getByRole("button", { name: "Unbar @sloptrough" }));

        expect(
            await screen.findByText(
                "Only the host, a co-host, or the site admin can lift a bar.",
            ),
        ).toBeInTheDocument();
    });

    it("shows a steward the bar list without the Unbar or Remove controls", () => {
        renderPanel({ viewerRole: "steward", barred: BARRED });
        expect(screen.getByText("@sloptrough")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Unbar/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Remove and bar/ })).not.toBeInTheDocument();
    });

    it("still renders after the last entry is removed — the bar must stay liftable", () => {
        renderPanel({ entries: [], barred: BARRED });
        expect(screen.getByText("No Entries Yet")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Unbar @sloptrough" })).toBeInTheDocument();
    });
});

describe("ShowEntriesPanel — remove & bar", () => {
    const TWO_ENTRIES = [
        entry(),
        entry({
            id: "723e4567-e89b-42d3-a456-426614174000",
            horseName: "Silver Aspen",
            status: "scratched",
        }),
    ];

    it("offers removal per OWNER, never per entry, and never for yourself", () => {
        // Two entries, one owner → exactly one control.
        const { unmount } = renderPanel({ entries: TWO_ENTRIES });
        expect(screen.getAllByRole("button", { name: /^Remove and bar/ })).toHaveLength(1);
        unmount();

        renderPanel({ entries: TWO_ENTRIES, viewerId: "owner-1" });
        expect(
            screen.queryByRole("button", { name: /^Remove and bar/ }),
        ).not.toBeInTheDocument();
        expect(screen.getByText("No other entrants to remove.")).toBeInTheDocument();
    });

    it("counts scratched entries in the owner summary — removal takes them too", () => {
        renderPanel({ entries: TWO_ENTRIES });
        expect(screen.getByText(/2 entries in 1 class/)).toBeInTheDocument();
    });

    it("spells out what disappears, then removes with the trimmed reason", async () => {
        renderPanel({ entries: TWO_ENTRIES });
        fireEvent.click(screen.getByRole("button", { name: "Remove and bar @pintopines" }));

        expect(
            await screen.findByText("Remove @pintopines from this show?"),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/deletes all 2 entries they hold across 1 class/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/scratched entries included/i)).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText(/Joke entries/i), {
            target: { value: "  Joke entries after a warning  " },
        });
        fireEvent.click(screen.getByTestId("remove-entrant-confirm"));

        await waitFor(() =>
            expect(v4.removeEntrantFromShow).toHaveBeenCalledWith({
                showId: SHOW_ID,
                userId: "owner-1",
                reason: "Joke entries after a warning",
            }),
        );
        expect(
            await screen.findByText("@pintopines removed — 2 entries deleted and re-entry blocked."),
        ).toBeInTheDocument();
    });

    it("omits the reason entirely when left blank", async () => {
        renderPanel({ entries: TWO_ENTRIES });
        fireEvent.click(screen.getByRole("button", { name: "Remove and bar @pintopines" }));
        fireEvent.click(await screen.findByTestId("remove-entrant-confirm"));

        await waitFor(() =>
            expect(v4.removeEntrantFromShow).toHaveBeenCalledWith({
                showId: SHOW_ID,
                userId: "owner-1",
            }),
        );
    });

    it("surfaces the action's refusal verbatim and keeps the dialog open", async () => {
        v4.removeEntrantFromShow.mockResolvedValue({
            success: false,
            error:
                "This show's results are published — entries can no longer be removed. Strike the individual placings instead (Strike voids the card and cleans the record with it); the bar list still governs future shows.",
        });
        renderPanel({ entries: TWO_ENTRIES });
        fireEvent.click(screen.getByRole("button", { name: "Remove and bar @pintopines" }));
        fireEvent.click(await screen.findByTestId("remove-entrant-confirm"));

        expect(
            await screen.findByText(/entries can no longer be removed/i),
        ).toBeInTheDocument();
        expect(screen.getByText("Remove @pintopines from this show?")).toBeInTheDocument();
    });
});
