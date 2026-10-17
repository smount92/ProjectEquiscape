// @vitest-environment jsdom
/**
 * Admin › Members: the Registry moderators strip and the Make moderator /
 * Remove moderator buttons on member rows (Registry Desk Phase 1).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const admin = vi.hoisted(() => ({
    searchMembers: vi.fn(),
    suspendUser: vi.fn(),
    unsuspendUser: vi.fn(),
    listRegistryModerators: vi.fn(),
    grantRegistryModerator: vi.fn(),
    removeRegistryModerator: vi.fn(),
}));
vi.mock("@/app/actions/admin", () => admin);
vi.mock("@/components/AdminModerationCard", () => ({ default: () => null }));
vi.mock("@/components/AdminDisputesCard", () => ({ default: () => null }));
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import AdminMembersTab from "@/components/AdminMembersTab";

const member = (id: string, alias: string) => ({
    id,
    alias,
    email: null,
    createdAt: "2026-01-01T00:00:00Z",
    isSuspended: false,
    suspendedAt: null,
    suspendedReason: null,
    isSupporter: false,
    horseCount: 3,
});

beforeEach(() => {
    vi.clearAllMocks();
    admin.searchMembers.mockResolvedValue({ success: true, members: [member("u-1", "Maple"), member("u-2", "Bay")] });
    admin.listRegistryModerators.mockResolvedValue({
        success: true,
        ready: true,
        moderators: [
            {
                userId: "u-1",
                alias: "Maple",
                status: "active",
                startedAt: "2026-10-16T00:00:00Z",
                termEndsAt: "2027-10-16T00:00:00Z",
                lastActionAt: null,
                removedAt: null,
            },
        ],
    });
    admin.grantRegistryModerator.mockResolvedValue({ success: true });
    admin.removeRegistryModerator.mockResolvedValue({ success: true });
});

describe("AdminMembersTab: Registry moderators", () => {
    it("lists the seats and offers Make moderator only to members without one", async () => {
        render(<AdminMembersTab />);
        await screen.findByText("@Bay");
        expect(screen.getByText(/Registry moderators/)).toBeTruthy();
        expect(screen.getByText("Registry moderator")).toBeTruthy(); // Maple's chip
        expect(screen.getAllByRole("button", { name: "Make moderator" })).toHaveLength(1);

        // It asks first, saying what the seat gives.
        fireEvent.click(screen.getByRole("button", { name: "Make moderator" }));
        expect(admin.grantRegistryModerator).not.toHaveBeenCalled();
        const ask = screen.getByRole("group", { name: "Make @Bay a Registry moderator?" });
        expect(ask.textContent).toContain("This gives @Bay the Registry Desk and a public Registry moderator badge.");
        fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
        await waitFor(() => expect(admin.grantRegistryModerator).toHaveBeenCalledWith("u-2"));
    });

    it("lets Cancel back out of making a moderator", async () => {
        render(<AdminMembersTab />);
        await screen.findByText("@Bay");
        fireEvent.click(screen.getByRole("button", { name: "Make moderator" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.queryByRole("group", { name: /Registry moderator\?/ })).toBeNull();
        expect(admin.grantRegistryModerator).not.toHaveBeenCalled();
    });

    it("says a failed load failed, not that update 242 is missing, and can try again", async () => {
        admin.listRegistryModerators.mockResolvedValueOnce({
            success: false,
            error: "Could not read the moderator list.",
        });
        render(<AdminMembersTab />);
        await screen.findByText("@Bay");
        expect((await screen.findByRole("alert")).textContent).toMatch(/Could not read the moderator list/);
        expect(screen.queryByText(/update 242/)).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
        expect(admin.listRegistryModerators).toHaveBeenCalledTimes(2);
    });

    it("links to the Registry Desk and the moderators' guide", async () => {
        render(<AdminMembersTab />);
        await screen.findByText("@Bay");
        expect(screen.getByRole("link", { name: "Open the Registry Desk" }).getAttribute("href")).toBe("/catalog/desk");
        expect(screen.getByRole("link", { name: "The moderators' guide" }).getAttribute("href")).toBe(
            "/catalog/desk/guide",
        );
    });

    it("ends a seat with a private reason", async () => {
        render(<AdminMembersTab />);
        await screen.findByText("@Bay");
        fireEvent.click(screen.getAllByRole("button", { name: "Remove moderator" })[0]);
        fireEvent.change(screen.getByLabelText("Reason for ending Maple's moderator seat"), {
            target: { value: "stepping back" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Confirm remove" }));
        await waitFor(() => expect(admin.removeRegistryModerator).toHaveBeenCalledWith("u-1", "stepping back"));
    });

    it("before update 242 says so and offers no buttons", async () => {
        admin.listRegistryModerators.mockResolvedValue({ success: true, ready: false, moderators: [] });
        render(<AdminMembersTab />);
        await screen.findByText("@Bay");
        expect(screen.getByText(/open once you add update 242/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Make moderator" })).toBeNull();
    });
});
