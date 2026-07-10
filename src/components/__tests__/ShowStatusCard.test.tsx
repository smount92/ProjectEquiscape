// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ShowStatusCard from "@/components/shows/ShowStatusCard";
import type { ConsoleShow } from "@/lib/shows/console";

const actions = vi.hoisted(() => ({
    transitionShowStatus: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/actions/shows-v2", () => actions);

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";

function consoleShow(overrides: Partial<ConsoleShow> = {}): ConsoleShow {
    return {
        id: SHOW_ID,
        title: "Spring Fling Live",
        mode: "live",
        judging: "judged",
        status: "draft",
        venueName: null,
        venueAddress: null,
        showDate: null,
        entriesOpenAt: null,
        entriesCloseAt: null,
        judgingEndsAt: null,
        rulesMd: null,
        feeInfo: null,
        capacity: null,
        isMhhQualifying: true,
        sanctioningNote: null,
        createdAt: "2026-07-09T00:00:00Z",
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    actions.transitionShowStatus.mockResolvedValue({ success: true });
});

describe("ShowStatusCard — legal transitions", () => {
    it("stamps the current status and offers only the legal next steps for a draft", () => {
        render(<ShowStatusCard show={consoleShow()} entryCount={0} canManage />);

        expect(screen.getByTestId("current-status")).toHaveTextContent("draft");
        expect(screen.getByRole("button", { name: "Publish show" })).toBeInTheDocument();
        // Nothing else is reachable from draft.
        expect(screen.queryByRole("button", { name: "Open entries" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Begin judging" })).not.toBeInTheDocument();
    });

    it("respects mode: a closed live show can start running but never enter judging", () => {
        render(
            <ShowStatusCard
                show={consoleShow({ status: "entries_closed" })}
                entryCount={12}
                canManage
            />,
        );

        expect(screen.getByRole("button", { name: "Start the show" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Open entries" })).toBeInTheDocument(); // reopen valve
        expect(screen.queryByRole("button", { name: "Begin judging" })).not.toBeInTheDocument();
    });

    it("respects mode: a closed online show goes to judging, not running", () => {
        render(
            <ShowStatusCard
                show={consoleShow({ mode: "online", status: "entries_closed" })}
                entryCount={12}
                canManage
            />,
        );

        expect(screen.getByRole("button", { name: "Begin judging" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Start the show" })).not.toBeInTheDocument();
    });

    it("calls transitionShowStatus and hides controls from non-managers", async () => {
        const { unmount } = render(
            <ShowStatusCard show={consoleShow()} entryCount={0} canManage />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Publish show" }));
        await waitFor(() =>
            expect(actions.transitionShowStatus).toHaveBeenCalledWith({
                showId: SHOW_ID,
                to: "published",
            }),
        );
        unmount();

        render(<ShowStatusCard show={consoleShow()} entryCount={0} canManage={false} />);
        expect(screen.queryByRole("button", { name: "Publish show" })).not.toBeInTheDocument();
        expect(screen.getByText(/only the host or a co-host/i)).toBeInTheDocument();
    });
});

describe("ShowStatusCard — refusal path", () => {
    it("surfaces the action's refusal reason verbatim", async () => {
        actions.transitionShowStatus.mockResolvedValueOnce({
            success: false,
            error: "A show cannot go from draft to published. Next steps: none — the show is archived.",
        });
        render(<ShowStatusCard show={consoleShow()} entryCount={0} canManage />);

        fireEvent.click(screen.getByRole("button", { name: "Publish show" }));

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent(
            "A show cannot go from draft to published. Next steps: none — the show is archived.",
        );
    });
});
