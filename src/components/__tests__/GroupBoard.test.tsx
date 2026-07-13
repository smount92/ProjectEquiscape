// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GroupBoard from "../groups/GroupBoard";
import type { BoardThread } from "@/lib/groups/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

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

const { getGroupBoard, createThread, markGroupRead, createGroupChannel } = vi.hoisted(() => ({
    getGroupBoard: vi.fn(),
    createThread: vi.fn(),
    markGroupRead: vi.fn(),
    createGroupChannel: vi.fn(),
}));
vi.mock("@/app/actions/groups-forum", () => ({
    getGroupBoard,
    createThread,
    markGroupRead,
}));
vi.mock("@/app/actions/groups", () => ({
    createGroupChannel,
}));

const GROUP_ID = "123e4567-e89b-42d3-a456-426614174000";

function thread(overrides: Partial<BoardThread> = {}): BoardThread {
    return {
        id: "t-1",
        displayTitle: "Region 4 Live — who's going?",
        authorId: "u-1",
        authorAlias: "DappleGreyFan",
        authorAvatarUrl: null,
        repliesCount: 23,
        lastReplyAlias: "BlackFoxFarm",
        lastActivity: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        isPinned: false,
        channelId: null,
        unread: true,
        createdAt: "2026-07-01T00:00:00Z",
        ...overrides,
    };
}

const CHANNELS = [
    { id: "ch-1", name: "Show Talk", slug: "show-talk", description: null, sortOrder: 0 },
];

function renderBoard(threads: BoardThread[], props: Partial<Parameters<typeof GroupBoard>[0]> = {}) {
    return render(
        <GroupBoard
            groupId={GROUP_ID}
            slug="pnw-breyer"
            channels={CHANNELS}
            initialThreads={threads}
            initialHasMore={false}
            isAdmin={false}
            {...props}
        />,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    markGroupRead.mockResolvedValue({ success: true });
    getGroupBoard.mockResolvedValue({ success: true, threads: [], hasMore: false });
    createThread.mockResolvedValue({ success: true, threadId: "new-thread-1" });
});

describe("GroupBoard", () => {
    it("renders thread rows with titles, reply counts, and starter subline", () => {
        renderBoard([thread()]);
        expect(screen.getByText("Region 4 Live — who's going?")).toBeInTheDocument();
        expect(screen.getByText("23")).toBeInTheDocument();
        expect(screen.getByText("replies")).toBeInTheDocument();
        expect(screen.getByText("@DappleGreyFan")).toBeInTheDocument();
        expect(screen.getByText("@BlackFoxFarm")).toBeInTheDocument();
    });

    it("shows a brass dot on unread threads and none on read ones", () => {
        renderBoard([
            thread({ id: "t-unread", unread: true }),
            thread({ id: "t-read", displayTitle: "Old news", unread: false }),
        ]);
        expect(screen.getAllByTestId("unread-dot")).toHaveLength(1);
    });

    it("marks pinned threads with a pin instead of a dot", () => {
        renderBoard([thread({ id: "t-pin", isPinned: true, unread: true, displayTitle: "Club rules" })]);
        expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
        expect(screen.queryByTestId("unread-dot")).not.toBeInTheDocument();
        expect(screen.getByText(/· pinned/)).toBeInTheDocument();
    });

    it("fires markGroupRead once on mount (dots reflect load-time state)", async () => {
        renderBoard([thread()]);
        await waitFor(() => expect(markGroupRead).toHaveBeenCalledTimes(1));
        expect(markGroupRead).toHaveBeenCalledWith({ groupId: GROUP_ID });
    });

    it("navigates into a thread on row click", async () => {
        const user = userEvent.setup();
        renderBoard([thread({ id: "t-42" })]);
        await user.click(screen.getByText("Region 4 Live — who's going?"));
        expect(mockPush).toHaveBeenCalledWith("/community/groups/pnw-breyer/thread/t-42");
    });

    it("filters by channel via the channel tabs", async () => {
        const user = userEvent.setup();
        renderBoard([thread()]);
        await user.click(screen.getByRole("tab", { name: "Show Talk" }));
        await waitFor(() =>
            expect(getGroupBoard).toHaveBeenCalledWith({ groupId: GROUP_ID, channelId: "ch-1", offset: 0 }),
        );
    });

    it("creates a new thread and navigates into it", async () => {
        const user = userEvent.setup();
        renderBoard([]);
        await user.click(screen.getByText("+ New Thread"));

        await user.type(screen.getByLabelText("Thread title"), "Body-box score in Olympia");
        await user.type(screen.getByLabelText("Thread content"), "Pics inside, you will not believe it.");
        await user.click(screen.getByText("Post Thread"));

        await waitFor(() =>
            expect(createThread).toHaveBeenCalledWith({
                groupId: GROUP_ID,
                channelId: undefined,
                title: "Body-box score in Olympia",
                content: "Pics inside, you will not believe it.",
            }),
        );
        await waitFor(() =>
            expect(mockPush).toHaveBeenCalledWith("/community/groups/pnw-breyer/thread/new-thread-1"),
        );
    });

    it("disables Post Thread until the title is long enough", async () => {
        const user = userEvent.setup();
        renderBoard([]);
        await user.click(screen.getByText("+ New Thread"));
        await user.type(screen.getByLabelText("Thread content"), "content");
        expect(screen.getByText("Post Thread")).toBeDisabled();
        await user.type(screen.getByLabelText("Thread title"), "abc");
        expect(screen.getByText("Post Thread")).not.toBeDisabled();
    });

    it("offers the add-channel affordance to admins only", async () => {
        const user = userEvent.setup();
        const { unmount } = renderBoard([]);
        expect(screen.queryByText("+ Channel")).not.toBeInTheDocument();
        unmount();

        createGroupChannel.mockResolvedValue({ success: true, channelId: "ch-new" });
        renderBoard([], { isAdmin: true });
        await user.click(screen.getByText("+ Channel"));
        await user.type(screen.getByPlaceholderText("Channel name"), "Sales & ISO");
        await user.click(screen.getByText("Add"));
        await waitFor(() => expect(createGroupChannel).toHaveBeenCalledWith(GROUP_ID, "Sales & ISO"));
        // new channel appears as a tab
        expect(await screen.findByRole("tab", { name: "Sales & ISO" })).toBeInTheDocument();
    });
});
