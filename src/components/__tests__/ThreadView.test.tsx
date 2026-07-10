// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThreadView from "../groups/ThreadView";
import type { ThreadPost, ThreadViewData } from "@/lib/groups/types";

const { replyToThread, getThread, togglePostLike, togglePinPost } = vi.hoisted(() => ({
    replyToThread: vi.fn(),
    getThread: vi.fn(),
    togglePostLike: vi.fn(),
    togglePinPost: vi.fn(),
}));
vi.mock("@/app/actions/groups-forum", () => ({ replyToThread, getThread }));
vi.mock("@/app/actions/posts", () => ({ togglePostLike }));
// GroupAdminPanel (PinPostButton's home) imports the full groups action set.
vi.mock("@/app/actions/groups", () => ({
    togglePinPost,
    getGroupMembers: vi.fn().mockResolvedValue([]),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    getGroupChannels: vi.fn().mockResolvedValue([]),
    createGroupChannel: vi.fn(),
    deleteGroupChannel: vi.fn(),
}));

function post(overrides: Partial<ThreadPost> = {}): ThreadPost {
    return {
        id: "op-1",
        authorId: "u-1",
        authorAlias: "DappleGreyFan",
        authorAvatarUrl: null,
        content: "Entries close Friday and I finally committed.",
        likesCount: 6,
        isLikedByMe: false,
        createdAt: "2026-07-09T16:12:00Z",
        ...overrides,
    };
}

function threadData(overrides: Partial<ThreadViewData> = {}): ThreadViewData {
    return {
        id: "op-1",
        groupId: "g-1",
        channelId: "ch-1",
        channelName: "General",
        displayTitle: "Region 4 Live — who's going?",
        isPinned: false,
        repliesCount: 2,
        op: post(),
        replies: [
            post({ id: "r-1", authorAlias: "BlackFoxFarm", content: "We are in! I will bring the folding table." }),
            post({ id: "r-2", authorAlias: "MiniMares", content: "Carpooling yes please." }),
        ],
        hasMoreReplies: false,
        ...overrides,
    };
}

function renderThread(data: ThreadViewData = threadData(), canPin = false) {
    return render(
        <ThreadView
            thread={data}
            groupName="Pacific Northwest Breyer Club"
            groupSlug="pnw-breyer"
            currentUserId="me-1"
            currentUserAlias="SarahJenkins"
            currentUserAvatar={null}
            canPin={canPin}
        />,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    replyToThread.mockResolvedValue({ success: true, replyId: "r-new" });
    getThread.mockResolvedValue({ success: true, thread: threadData() });
    togglePostLike.mockResolvedValue({ success: true });
});

describe("ThreadView", () => {
    it("renders the forest header with breadcrumbs and title", () => {
        renderThread();
        expect(screen.getByText(/Pacific Northwest Breyer Club/)).toBeInTheDocument();
        expect(screen.getByText(/General/)).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /Region 4 Live/ })).toBeInTheDocument();
    });

    it("renders the OP highlighted and all replies", () => {
        renderThread();
        expect(screen.getByTestId("thread-op")).toBeInTheDocument();
        expect(screen.getByText("Entries close Friday and I finally committed.")).toBeInTheDocument();
        expect(screen.getAllByTestId("thread-reply")).toHaveLength(2);
        expect(screen.getByText("We are in! I will bring the folding table.")).toBeInTheDocument();
        expect(screen.getByText("Carpooling yes please.")).toBeInTheDocument();
    });

    it("submits a reply through replyToThread and appends it", async () => {
        const user = userEvent.setup();
        renderThread();
        const box = screen.getByLabelText("Write a reply");
        await user.type(box, "Can we stop at that bakery in Centralia?");
        await user.click(screen.getByText("Reply"));

        await waitFor(() =>
            expect(replyToThread).toHaveBeenCalledWith({
                postId: "op-1",
                content: "Can we stop at that bakery in Centralia?",
            }),
        );
        // optimistic append (generous timeout: flakes at the default 1s
        // when the full suite runs on a loaded machine)
        expect(
            await screen.findByText(
                "Can we stop at that bakery in Centralia?",
                {},
                { timeout: 5000 },
            ),
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getAllByTestId("thread-reply")).toHaveLength(3),
        );
        expect(box).toHaveValue("");
    });

    it("caps the composer at 2000 characters", () => {
        renderThread();
        expect(screen.getByLabelText("Write a reply")).toHaveAttribute("maxlength", "2000");
    });

    it("shows the pin button only to moderators", () => {
        const { unmount } = renderThread(threadData(), false);
        expect(screen.queryByText(/Pin/)).not.toBeInTheDocument();
        unmount();
        renderThread(threadData(), true);
        expect(screen.getByText(/📌 Pin/)).toBeInTheDocument();
    });

    it("offers load-more when there are more replies", async () => {
        const user = userEvent.setup();
        getThread.mockResolvedValue({
            success: true,
            thread: threadData({ replies: [post({ id: "r-3", content: "Late to the party!" })], hasMoreReplies: false }),
        });
        renderThread(threadData({ hasMoreReplies: true }));
        await user.click(screen.getByText("Load more replies"));
        await waitFor(() =>
            expect(getThread).toHaveBeenCalledWith({ postId: "op-1", repliesOffset: 2 }),
        );
        expect(await screen.findByText("Late to the party!")).toBeInTheDocument();
    });
});
