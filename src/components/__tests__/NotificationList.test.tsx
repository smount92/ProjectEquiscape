// @vitest-environment jsdom
/**
 * The notifications list as a reader meets it: badged by kind, filterable
 * by kind, and — the part that actually matters — every row pointing at
 * the thing that happened rather than back at the list.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const actions = vi.hoisted(() => ({
    markNotificationRead: vi.fn().mockResolvedValue({ success: true }),
    markAllNotificationsRead: vi.fn().mockResolvedValue({ success: true }),
    clearNotifications: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/app/actions/notifications", () => actions);

const refreshNotificationCount = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/context/NotificationProvider", () => ({
    useNotifications: () => ({
        unreadNotifications: 0,
        unreadMessages: 0,
        refreshNotificationCount,
        refreshMessageCount: vi.fn(),
    }),
}));

// The global setup renders next/link as nothing, which would hide every
// href on the page. Real anchors here so destinations can be asserted.
vi.mock("next/link", () => ({
    default: ({
        children,
        href,
        ...props
    }: {
        children: React.ReactNode;
        href: string;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

import NotificationList, { type NotifItem } from "@/components/NotificationList";

const base: NotifItem = {
    id: "n0",
    type: "system",
    content: "Something",
    actorAlias: null,
    horseId: null,
    conversationId: null,
    linkUrl: null,
    isRead: false,
    createdAt: new Date().toISOString(),
};

const rows = (): NotifItem[] => [
    {
        ...base,
        id: "n1",
        type: "show_result",
        content: "Bramble placed 2nd in Halter",
        linkUrl: "/shows/s1/results",
    },
    {
        ...base,
        id: "n2",
        type: "offer",
        content: "Amanda offered $180 for Comet",
        linkUrl: "/inbox/deal-7",
        isRead: true,
    },
    { ...base, id: "n3", type: "comment", content: "Bea commented on Sable", horseId: "h3" },
    { ...base, id: "n4", type: "follow", content: "Cass followed you", actorAlias: "Cass" },
];

beforeEach(() => {
    vi.clearAllMocks();
});

describe("NotificationList — reading the stream", () => {
    it("renders every row with its content", () => {
        render(<NotificationList initialNotifications={rows()} />);
        expect(screen.getByText("Bramble placed 2nd in Halter")).toBeInTheDocument();
        expect(screen.getByText("Amanda offered $180 for Comet")).toBeInTheDocument();
        expect(screen.getByText("Cass followed you")).toBeInTheDocument();
    });

    it("badges each row with its kind", () => {
        render(<NotificationList initialNotifications={rows()} />);
        // One Shows badge, one Market badge, two Social badges.
        expect(screen.getAllByText("Shows")).not.toHaveLength(0);
        expect(screen.getAllByText("Market")).not.toHaveLength(0);
        expect(screen.getAllByText("Social").length).toBeGreaterThanOrEqual(2);
    });

    it("uses the emitter's link_url as the row destination", () => {
        render(<NotificationList initialNotifications={rows()} />);
        const link = screen.getByText("Bramble placed 2nd in Halter").closest("a");
        expect(link).toHaveAttribute("href", "/shows/s1/results");
    });

    it("falls back sensibly when a row has no link_url", () => {
        render(<NotificationList initialNotifications={rows()} />);
        expect(screen.getByText("Bea commented on Sable").closest("a")).toHaveAttribute(
            "href",
            "/community/h3",
        );
        expect(screen.getByText("Cass followed you").closest("a")).toHaveAttribute(
            "href",
            "/profile/Cass",
        );
    });

    it("never leaves a row with nothing to say", () => {
        render(
            <NotificationList
                initialNotifications={[{ ...base, id: "x", content: null, type: "mystery" }]}
            />,
        );
        expect(screen.getByText(/Something happened/)).toBeInTheDocument();
    });
});

describe("NotificationList — filtering by kind", () => {
    it("offers a tab only for the kinds actually present", () => {
        render(<NotificationList initialNotifications={rows()} />);
        expect(screen.getByRole("button", { name: /Shows/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Market/ })).toBeInTheDocument();
        // Nothing in this fixture is a barn notification.
        expect(screen.queryByRole("button", { name: /Barns/ })).not.toBeInTheDocument();
    });

    it("narrows the list to one kind and back again", () => {
        render(<NotificationList initialNotifications={rows()} />);
        fireEvent.click(screen.getByRole("button", { name: /Market/ }));
        expect(screen.getByText("Amanda offered $180 for Comet")).toBeInTheDocument();
        expect(screen.queryByText("Bramble placed 2nd in Halter")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /^All/ }));
        expect(screen.getByText("Bramble placed 2nd in Halter")).toBeInTheDocument();
    });

    it("counts unread per kind on the tab", () => {
        render(<NotificationList initialNotifications={rows()} />);
        const showsTab = screen.getByRole("button", { name: /Shows/ });
        // one Shows row, unread
        expect(within(showsTab).getByText("1")).toBeInTheDocument();
    });
});

describe("NotificationList — actions", () => {
    it("marks a single row read on click and refreshes the header count", async () => {
        render(<NotificationList initialNotifications={rows()} />);
        fireEvent.click(screen.getByText("Bramble placed 2nd in Halter"));
        await waitFor(() => expect(actions.markNotificationRead).toHaveBeenCalledWith("n1"));
        await waitFor(() => expect(refreshNotificationCount).toHaveBeenCalled());
    });

    it("marks all read and drops the button once nothing is unread", async () => {
        render(<NotificationList initialNotifications={rows()} />);
        fireEvent.click(screen.getByRole("button", { name: /Mark all read/ }));
        await waitFor(() => expect(actions.markAllNotificationsRead).toHaveBeenCalled());
        await waitFor(() =>
            expect(screen.queryByRole("button", { name: /Mark all read/ })).not.toBeInTheDocument(),
        );
    });

    it("makes clearing a two-step action and says what it destroys", async () => {
        render(<NotificationList initialNotifications={rows()} />);
        fireEvent.click(screen.getByRole("button", { name: /Clear all/ }));
        // Nothing deleted yet — a confirmation appeared instead.
        expect(actions.clearNotifications).not.toHaveBeenCalled();
        expect(screen.getByText(/permanently deletes all 4 notifications/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Delete all 4/ }));
        await waitFor(() => expect(actions.clearNotifications).toHaveBeenCalled());
        await waitFor(() =>
            expect(screen.getByText(/Nothing has come in/)).toBeInTheDocument(),
        );
    });

    it("lets the confirmation be backed out of", () => {
        render(<NotificationList initialNotifications={rows()} />);
        fireEvent.click(screen.getByRole("button", { name: /Clear all/ }));
        fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
        expect(actions.clearNotifications).not.toHaveBeenCalled();
        expect(screen.getByText("Bramble placed 2nd in Halter")).toBeInTheDocument();
    });
});

describe("NotificationList — empty states are honest", () => {
    it("says nothing has arrived, and points somewhere useful", () => {
        render(<NotificationList initialNotifications={[]} />);
        expect(screen.getByText("Nothing has come in")).toBeInTheDocument();
        expect(screen.getByText(/Notification settings/)).toBeInTheDocument();
    });

    it("distinguishes an empty FILTER from an empty inbox", () => {
        // Only social rows exist; filtering to Shows is not "all caught up".
        render(
            <NotificationList
                initialNotifications={[
                    { ...base, id: "s1", type: "comment", content: "A comment" },
                    { ...base, id: "s2", type: "show_result", content: "A result" },
                ]}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /Shows/ }));
        expect(screen.getByText("A result")).toBeInTheDocument();
        expect(screen.queryByText("A comment")).not.toBeInTheDocument();
        expect(screen.queryByText("Nothing has come in")).not.toBeInTheDocument();
    });
});
