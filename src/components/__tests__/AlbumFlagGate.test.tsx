// @vitest-environment jsdom
/**
 * Wave 4b — THE FLAG GATE. Two promises, both test-asserted:
 *
 *  1. The /shows/[id] route hands a v2 show to AlbumShowPage ONLY
 *     when NEXT_PUBLIC_SHOW_PAGE_V3=1; off, it stays with
 *     PublicShowV2Page (instant rollback).
 *  2. With the flag off, the rendered legacy tree is unchanged
 *     where the e2e looks: `show-state-banner` present, no album
 *     testids anywhere.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { PublicShow } from "@/lib/shows/public";
// Static imports (mocks below are hoisted above them). The flag is
// read at CALL time inside the route, so env stubs per-test still
// steer the branch.
import ShowDetailPage from "@/app/shows/[id]/page";
import AlbumShowPage from "@/components/shows/AlbumShowPage";
import PublicShowV2Page from "@/components/shows/PublicShowV2Page";

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

// The route's other branch — never rendered in these tests, but the
// module import must not drag the legacy page's server-only graph in.
vi.mock("@/app/shows/[id]/LegacyShowPage", () => ({
    default: () => null,
}));

vi.mock("@/lib/shows/resolver", () => ({
    resolveShowRoute: vi.fn().mockResolvedValue("v2"),
}));

vi.mock("@/lib/shows/queries", () => ({
    getShowRole: vi.fn().mockResolvedValue({ role: null }),
    getAliases: vi.fn().mockResolvedValue(new Map()),
}));

const show: PublicShow = {
    id: "show-1",
    title: "Summerween Live",
    mode: "online",
    judging: "judged",
    status: "entries_open",
    hostAlias: "maggie",
    venueName: null,
    venueAddress: null,
    showDate: null,
    entriesOpenAt: "2026-07-01T12:00:00.000Z",
    entriesCloseAt: "2026-07-20T12:00:00.000Z",
    judgingEndsAt: null,
    aboutMd: null,
    rulesMd: null,
    feeInfo: null,
    capacity: null,
    isMhhQualifying: false,
    sanctioningNote: null,
};

const actions = vi.hoisted(() => ({
    getPublicShow: vi.fn(),
    getMyShowEntries: vi.fn().mockResolvedValue({ success: true, entries: [] }),
    getMyEntrantHorses: vi.fn().mockResolvedValue({ success: true, horses: [] }),
    getShowGallery: vi.fn().mockResolvedValue({
        success: true,
        gallery: {
            votingEnabled: false,
            votingOpen: false,
            revealed: false,
            resultsPublished: false,
            classes: [],
        },
    }),
    castVote: vi.fn(),
    removeVote: vi.fn(),
    scratchEntry: vi.fn(),
}));
vi.mock("@/app/actions/shows-v2", () => actions);
vi.mock("@/app/actions/shows-v2-ring", () => ({
    getShowChampions: vi.fn().mockResolvedValue({ success: false, error: "none" }),
}));
vi.mock("@/app/actions/show-readiness", () => ({
    listMyEntrantHorses: vi.fn().mockResolvedValue({ success: true, horses: [] }),
}));

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("the /shows/[id] route branch", () => {
    it("flag OFF → the v2 branch is PublicShowV2Page", async () => {
        vi.stubEnv("NEXT_PUBLIC_SHOW_PAGE_V3", "");
        const element = await ShowDetailPage({ params: Promise.resolve({ id: "show-1" }) });
        expect(element.type).toBe(PublicShowV2Page);
    }, 15000);

    it("flag ON → the v2 branch is AlbumShowPage", async () => {
        vi.stubEnv("NEXT_PUBLIC_SHOW_PAGE_V3", "1");
        const element = await ShowDetailPage({ params: Promise.resolve({ id: "show-1" }) });
        expect(element.type).toBe(AlbumShowPage);
    }, 15000);
});

describe("flag OFF — the legacy tree renders unchanged", () => {
    it("keeps the state banner testid and renders NO album testids", async () => {
        vi.stubEnv("NEXT_PUBLIC_SHOW_PAGE_V3", "");
        actions.getPublicShow.mockResolvedValue({
            success: true,
            show,
            divisions: [],
            entryCount: 0,
        });
        // Async server component: resolve the tree, then render it.
        const tree = await PublicShowV2Page({ showId: "show-1" });
        render(tree);

        // The e2e's anchor — the masthead lifecycle banner.
        expect(screen.getByTestId("show-state-banner")).toBeInTheDocument();
        // No album surface leaks into the flag-off page.
        expect(screen.queryByTestId("album-status-line")).not.toBeInTheDocument();
        expect(screen.queryByTestId("album-cta-row")).not.toBeInTheDocument();
        expect(screen.queryByTestId("album-wall")).not.toBeInTheDocument();
        expect(screen.queryByTestId("album-filter-chips")).not.toBeInTheDocument();
    }, 15000);
});
