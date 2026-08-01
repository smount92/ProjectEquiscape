// @vitest-environment jsdom
/**
 * Wave 2 — the staff scratch door gets its console UI. The panel
 * only OFFERS the button where scratchEntry would say yes (staff
 * roles, show not completed); the action stays the authority and
 * its refusals surface verbatim in the confirm dialog.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ShowEntriesPanel from "@/components/shows/ShowEntriesPanel";
import type { ConsoleDivision, ConsoleEntry } from "@/lib/shows/console";
import type { ShowStatus, StaffRole } from "@/lib/shows/types";

const actions = vi.hoisted(() => ({
    scratchEntry: vi.fn(),
    setFeePaid: vi.fn(),
}));
vi.mock("@/app/actions/shows-v2", () => actions);

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
}) {
    return render(
        <ShowEntriesPanel
            showId={SHOW_ID}
            divisions={DIVISIONS}
            entries={input.entries ?? [entry()]}
            showStatus={input.showStatus ?? "entries_closed"}
            feePaidUserIds={[]}
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
