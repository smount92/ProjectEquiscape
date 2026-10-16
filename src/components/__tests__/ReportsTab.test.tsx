// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { resolveReport } = vi.hoisted(() => ({ resolveReport: vi.fn() }));
vi.mock("@/app/actions/moderation", () => ({ resolveReport }));
// AdminTabs pulls in every admin panel; only the Reports tab is under test.
vi.mock("@/app/actions/admin", () => ({}));
vi.mock("@/app/actions/external-shows", () => ({}));

import { ReportsTab } from "../AdminTabs";

const report = {
    id: "r-1",
    targetType: "comment",
    targetId: "c-1",
    reason: "Harassment or bullying",
    details: "Third time this week",
    reporterAlias: "KindMember",
    createdAt: "2026-10-15T12:00:00Z",
    target: {
        summary: "You should quit the hobby",
        name: "You should quit the hobby",
        href: "/community/groups/qh-barn/thread/t-1",
        ownerId: "u-2",
        ownerAlias: "Grumpy",
        state: null,
        takeDownLabel: "Hide the reply",
    },
};

beforeEach(() => {
    resolveReport.mockReset();
    resolveReport.mockResolvedValue({ success: true });
});

describe("Admin › Reports card", () => {
    it("shows what was reported and links to it", () => {
        render(<ReportsTab reports={[report]} />);
        expect(screen.getByText("Reply")).toBeInTheDocument();
        expect(screen.getByText("You should quit the hobby")).toBeInTheDocument();
        expect(screen.getByText("By @Grumpy")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /open it/i })).toHaveAttribute(
            "href",
            "/community/groups/qh-barn/thread/t-1",
        );
        expect(screen.getByText(/Third time this week/)).toBeInTheDocument();
    });

    it("takes it down after a confirm, with the note", async () => {
        const user = userEvent.setup();
        render(<ReportsTab reports={[report]} />);
        await user.type(screen.getByLabelText(/note for the record/i), "Personal attack");
        await user.click(screen.getByRole("button", { name: "Hide the reply" }));
        expect(resolveReport).not.toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Yes, hide the reply" }));
        expect(resolveReport).toHaveBeenCalledWith({ reportId: "r-1", decision: "take_down", note: "Personal attack" });
    });

    it("dismisses after a confirm, and only allows 'another way' with a note", async () => {
        const user = userEvent.setup();
        render(<ReportsTab reports={[report]} />);
        expect(screen.getByRole("button", { name: "Dealt with another way" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Doesn't break the rules" }));
        expect(resolveReport).not.toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.getByRole("button", { name: "Hide the reply" })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Doesn't break the rules" }));
        await user.click(screen.getByRole("button", { name: "Yes, it doesn't break the rules" }));
        expect(resolveReport).toHaveBeenCalledWith({ reportId: "r-1", decision: "dismiss", note: undefined });
    });

    it("says the link opens in a new tab, and the note box is the shared Textarea", () => {
        render(<ReportsTab reports={[report]} />);
        expect(screen.getByRole("link", { name: "Open it (opens in a new tab)" })).toHaveAttribute("target", "_blank");
        expect(screen.getByLabelText(/note for the record/i)).toHaveAttribute("data-slot", "textarea");
    });

    it("links the Deal Room conversation when a take-down waits for a sale", async () => {
        resolveReport.mockResolvedValueOnce({
            success: false,
            error: "This horse is in a sale that's under way. Resolve it in the Deal Room first (/inbox/0a1b2c3d-0000-4000-8000-000000000000), then take the horse down.",
        });
        const user = userEvent.setup();
        render(<ReportsTab reports={[report]} />);
        await user.click(screen.getByRole("button", { name: "Hide the reply" }));
        await user.click(screen.getByRole("button", { name: "Yes, hide the reply" }));
        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Resolve it in the Deal Room first (open it), then take the horse down.");
        expect(screen.getByRole("link", { name: "open it" })).toHaveAttribute(
            "href",
            "/inbox/0a1b2c3d-0000-4000-8000-000000000000",
        );
    });

    it("sends suspension to the Members tab rather than doing it here", async () => {
        const onOpenMember = vi.fn();
        const user = userEvent.setup();
        render(<ReportsTab reports={[report]} onOpenMember={onOpenMember} />);
        await user.click(screen.getByRole("button", { name: "Suspend @Grumpy…" }));
        expect(onOpenMember).toHaveBeenCalledWith("Grumpy");
    });

    it("shows the server's words when an action fails", async () => {
        resolveReport.mockResolvedValueOnce({ success: false, error: "Hiding needs migration 235." });
        const user = userEvent.setup();
        render(<ReportsTab reports={[report]} />);
        await user.click(screen.getByRole("button", { name: "Hide the reply" }));
        await user.click(screen.getByRole("button", { name: "Yes, hide the reply" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Hiding needs migration 235.");
    });

    it("offers no take-down for a private message already removed, and says there is no page", () => {
        render(
            <ReportsTab
                reports={[
                    {
                        ...report,
                        targetType: "message",
                        target: { ...report.target, href: null, state: "Removed", takeDownLabel: null },
                    },
                ]}
            />,
        );
        expect(screen.getByText("Removed")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /hide|remove/i })).not.toBeInTheDocument();
        expect(screen.getByText(/the words above are all of it/)).toBeInTheDocument();
    });
});
