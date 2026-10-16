// @vitest-environment jsdom
/**
 * Admin › Mailbox: failures are said out loud (a failed delete, a thrown
 * load), resolved cards wear a chip instead of fading below contrast,
 * the filter is a set of pressed buttons, and "Load older" can't fire
 * twice.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { listMailbox, setMailboxStatus, deleteContactMessage } = vi.hoisted(() => ({
    listMailbox: vi.fn(),
    setMailboxStatus: vi.fn(),
    deleteContactMessage: vi.fn(),
}));
vi.mock("@/app/actions/admin-mailbox", () => ({ listMailbox, setMailboxStatus }));
vi.mock("@/app/actions/admin", () => ({ deleteContactMessage }));
vi.mock("@/components/AdminReplyForm", () => ({ default: () => null }));
vi.mock("@/components/MarkReadButton", () => ({ default: () => null }));

import AdminMailbox from "@/components/AdminMailbox";
import type { MailboxMessage } from "@/app/actions/admin-mailbox";

const msg = (over: Partial<MailboxMessage> = {}): MailboxMessage => ({
    id: "m-1",
    name: "Pat",
    email: "pat@example.com",
    subject: "Hello",
    message: "See https://example.com/a/very/long/path/that/would/overflow/a/phone/screen/without/wrapping",
    isRead: false,
    createdAt: "2026-10-15T12:00:00Z",
    category: "billing",
    status: "open",
    errorRef: null,
    sender: null,
    ...over,
});

const page = (messages: MailboxMessage[], more = false) => ({ success: true, triage: true, more, messages });

beforeEach(() => {
    listMailbox.mockReset();
    setMailboxStatus.mockReset();
    deleteContactMessage.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("AdminMailbox", () => {
    it("says so when a delete fails, and keeps the message", async () => {
        listMailbox.mockResolvedValue(page([msg()]));
        deleteContactMessage.mockResolvedValue({ success: false, error: "permission denied" });
        const user = userEvent.setup();
        render(<AdminMailbox />);
        await user.click(await screen.findByRole("button", { name: "Delete" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("The message from Pat couldn't be deleted.");
        expect(screen.getByRole("article", { name: "Message from Pat" })).toBeInTheDocument();
    });

    it("a thrown load shows an error, not 'Loading…' forever", async () => {
        listMailbox.mockRejectedValue(new Error("Not authenticated."));
        render(<AdminMailbox />);
        expect(await screen.findByRole("alert")).toHaveTextContent("The mailbox couldn't load just now.");
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });

    it("marks resolved cards with a chip, never by fading them", async () => {
        listMailbox.mockResolvedValue(page([msg({ status: "resolved" })]));
        render(<AdminMailbox />);
        const card = await screen.findByRole("article", { name: "Message from Pat, resolved" });
        expect(card.className).not.toMatch(/opacity/);
        expect(card).toHaveTextContent("✓ Resolved");
        expect(card).toHaveClass("[overflow-wrap:anywhere]");
    });

    it("shows the owner's word for the category", async () => {
        listMailbox.mockResolvedValue(page([msg()]));
        render(<AdminMailbox />);
        expect(await screen.findByText("Billing")).toBeInTheDocument();
    });

    it("the filter is pressed buttons, not tabs without a panel", async () => {
        listMailbox.mockResolvedValue(page([]));
        const user = userEvent.setup();
        render(<AdminMailbox />);
        expect(screen.queryByRole("tab")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-pressed", "true");
        await user.click(screen.getByRole("button", { name: "Resolved" }));
        expect(screen.getByRole("button", { name: "Resolved" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Open" })).toHaveAttribute("aria-pressed", "false");
        await waitFor(() => expect(listMailbox).toHaveBeenLastCalledWith("resolved"));
    });

    it("Load older shows it is busy and ignores a second click", async () => {
        listMailbox.mockResolvedValueOnce(page([msg()], true));
        let finish: (v: unknown) => void = () => {};
        listMailbox.mockImplementationOnce(() => new Promise((r) => (finish = r)));
        const user = userEvent.setup();
        render(<AdminMailbox />);

        const older = await screen.findByRole("button", { name: "Load older messages" });
        await user.click(older);
        await user.click(older);
        expect(listMailbox).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("button", { name: "Loading older messages…" })).toBeDisabled();

        finish(page([msg({ id: "m-2", name: "Sam" })], false));
        expect(await screen.findByRole("article", { name: "Message from Sam" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /older messages/ })).not.toBeInTheDocument();
    });
});
