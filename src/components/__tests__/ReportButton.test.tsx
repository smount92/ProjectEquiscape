// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportButton from "../ReportButton";

const { submitReport } = vi.hoisted(() => ({ submitReport: vi.fn() }));
vi.mock("@/app/actions/moderation", () => ({ submitReport }));

beforeEach(() => {
    submitReport.mockReset();
    submitReport.mockResolvedValue({ success: true });
});

const ENTRY_ID = "3b8f0f2e-6f3a-4d2b-9c1e-2a7d8e9f0a1b";

describe("ReportButton", () => {
    it("is never shown on your own content", () => {
        const { container } = render(<ReportButton targetType="post" targetId={ENTRY_ID} isOwn />);
        expect(container).toBeEmptyDOMElement();
    });

    it("names what it reports, in both looks", () => {
        render(
            <>
                <ReportButton targetType="show_entry" targetId={ENTRY_ID} />
                <ReportButton targetType="comment" targetId={ENTRY_ID} variant="icon" />
            </>,
        );
        expect(screen.getByRole("button", { name: "Report this show entry" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Report this reply" })).toBeInTheDocument();
    });

    it("opens a dialog, closes on Escape and gives focus back", async () => {
        const user = userEvent.setup();
        render(<ReportButton targetType="message" targetId={ENTRY_ID} variant="icon" />);
        const trigger = screen.getByRole("button", { name: "Report this message" });
        await user.click(trigger);
        expect(screen.getByRole("dialog", { name: "Report this message" })).toBeInTheDocument();

        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(trigger).toHaveFocus();
        expect(submitReport).not.toHaveBeenCalled();
    });

    it("can't be sent until a reason is picked, then sends and thanks the member", async () => {
        const user = userEvent.setup();
        render(<ReportButton targetType="id_suggestion" targetId={ENTRY_ID} />);
        await user.click(screen.getByRole("button", { name: "Report this suggestion" }));

        const send = screen.getByRole("button", { name: "Send report" });
        expect(send).toBeDisabled();

        await user.click(screen.getByRole("radio", { name: "Spam or scam" }));
        await user.type(screen.getByLabelText(/anything else/i), "  Same link posted ten times  ");
        await user.click(send);

        expect(submitReport).toHaveBeenCalledWith({
            targetType: "id_suggestion",
            targetId: ENTRY_ID,
            reason: "Spam or scam",
            details: "Same link posted ten times",
        });
        expect(await screen.findByText(/we.ll let you know what we decide/i)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Done" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(screen.getByRole("status")).toHaveTextContent("Reported");
    });

    it("shows the server's words when it fails, with a log-in link when that is the problem", async () => {
        submitReport.mockResolvedValueOnce({ success: false, error: "Please log in to do that." });
        const user = userEvent.setup();
        render(<ReportButton targetType="user" targetId={ENTRY_ID} />);
        await user.click(screen.getByRole("button", { name: "Report this member" }));
        await user.click(screen.getByRole("radio", { name: "Harassment or bullying" }));
        await user.click(screen.getByRole("button", { name: "Send report" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Please log in to do that.");
        expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    });
});
