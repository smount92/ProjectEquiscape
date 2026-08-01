// @vitest-environment jsdom
/**
 * Wave 2 — the announce composer on the console Overview. Wired to
 * announceToEntrants (Batch 2): preview count going in, the server's
 * real recipient count coming back in the success toast.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ShowAnnounceDialog from "@/components/shows/ShowAnnounceDialog";

const actions = vi.hoisted(() => ({
    announceToEntrants: vi.fn(),
}));
vi.mock("@/app/actions/show-announcements", () => actions);

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";

beforeEach(() => {
    vi.clearAllMocks();
    actions.announceToEntrants.mockResolvedValue({ success: true, recipientCount: 4 });
});

describe("ShowAnnounceDialog", () => {
    it("previews the reach and sends the message to the action", async () => {
        render(<ShowAnnounceDialog showId={SHOW_ID} recipientCount={5} />);
        expect(
            screen.getByText(/goes to 5 entrants as an in-app notification/i),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("announce-open"));
        expect(
            await screen.findByText(/goes to 5 entrants — the distinct owners/i),
        ).toBeInTheDocument();

        const textarea = screen.getByLabelText("Announcement message");
        fireEvent.change(textarea, { target: { value: "Judging starts tomorrow!" } });
        expect(screen.getByText("24/1000")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("announce-send"));
        await waitFor(() =>
            expect(actions.announceToEntrants).toHaveBeenCalledWith({
                showId: SHOW_ID,
                message: "Judging starts tomorrow!",
            }),
        );
        // Toast reports the SERVER's count (4), not the preview (5).
        expect(
            await screen.findByText("Announcement sent to 4 entrants."),
        ).toBeInTheDocument();
    });

    it("disables send while the message is empty and when there is no one to reach", () => {
        const { unmount } = render(<ShowAnnounceDialog showId={SHOW_ID} recipientCount={3} />);
        fireEvent.click(screen.getByTestId("announce-open"));
        expect(screen.getByTestId("announce-send")).toBeDisabled();
        fireEvent.change(screen.getByLabelText("Announcement message"), {
            target: { value: "Hello" },
        });
        expect(screen.getByTestId("announce-send")).not.toBeDisabled();
        unmount();

        render(<ShowAnnounceDialog showId={SHOW_ID} recipientCount={0} />);
        expect(
            screen.getByText(/no entrants yet — announcements reach the people entered/i),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("announce-open"));
        fireEvent.change(screen.getByLabelText("Announcement message"), {
            target: { value: "Anyone there?" },
        });
        expect(screen.getByTestId("announce-send")).toBeDisabled();
    });

    it("surfaces the action's refusal verbatim and keeps the dialog open", async () => {
        actions.announceToEntrants.mockResolvedValue({
            success: false,
            error: "Only the host or a co-host can announce to entrants.",
        });
        render(<ShowAnnounceDialog showId={SHOW_ID} recipientCount={2} />);
        fireEvent.click(screen.getByTestId("announce-open"));
        fireEvent.change(screen.getByLabelText("Announcement message"), {
            target: { value: "Test" },
        });
        fireEvent.click(screen.getByTestId("announce-send"));
        expect(
            await screen.findByText("Only the host or a co-host can announce to entrants."),
        ).toBeInTheDocument();
        // Still composing — the message is not lost.
        expect(screen.getByLabelText("Announcement message")).toHaveValue("Test");
    });
});
