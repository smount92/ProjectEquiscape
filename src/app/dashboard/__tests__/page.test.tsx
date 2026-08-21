// @vitest-environment jsdom
/**
 * Onboarding empty-state coverage: DashboardV2 → StableBrowser renders
 * the shared StableWelcome for a 0-horse user.
 *
 * Server components are async functions, which React's client renderer
 * can't mount, so `resolveServerTree` pre-renders them: it walks the
 * element tree, awaits async function components, and leaves client
 * components for React/RTL to render normally.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

// ── Supabase server client (richer chain than the global setup mock) ──
vi.mock("@/lib/supabase/server", async () => {
    const { createMockSupabaseClient } = await import("@/__tests__/mocks/supabase");
    return { createClient: vi.fn(async () => createMockSupabaseClient()) };
});

vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

// ── Stub the heavy dashboard chrome; the empty state is what's under test ──
vi.mock("@/components/DashboardToast", () => ({ default: () => null }));
vi.mock("@/components/ExportButton", () => ({ default: () => null }));
vi.mock("@/components/InsuranceReportButton", () => ({ default: () => null }));
vi.mock("@/components/TransferHistorySection", () => ({ default: () => null }));
vi.mock("@/components/PendingTransfersSection", () => ({ default: () => null }));
// Stubbed like its neighbours, and for one extra reason: it reaches
// app/inbox/reads.ts, whose `import "server-only"` cannot resolve here.
vi.mock("@/components/dashboard/DealsNeedingAttention", () => ({ default: () => null }));
vi.mock("@/components/NanDashboardWidget", () => ({ default: () => null }));
vi.mock("@/components/ShowHistoryWidget", () => ({ default: () => null }));
vi.mock("@/components/stable/StableMasthead", () => ({
    default: () => <div data-testid="stable-masthead" />,
}));

vi.mock("@/app/actions/shows", () => ({
    getShowHistory: vi.fn(async () => ({ totalRibbons: 0, totalShows: 0, years: [] })),
}));

vi.mock("@/lib/utils/storage", () => ({
    getPublicImageUrls: vi.fn(async () => new Map<string, string>()),
}));

const { getStablePage, getStableSummary, listStableViews } = vi.hoisted(() => ({
    getStablePage: vi.fn(),
    getStableSummary: vi.fn(),
    listStableViews: vi.fn(),
}));
vi.mock("@/app/actions/stable", () => ({
    getStablePage,
    getStableSummary,
    listStableViews,
    loadMoreStable: vi.fn(),
    getMatchingHorseIds: vi.fn(),
    saveStableView: vi.fn(),
    deleteStableView: vi.fn(),
}));
vi.mock("@/app/actions/horse", () => ({
    bulkUpdateHorses: vi.fn(),
    bulkDeleteHorses: vi.fn(),
}));

import DashboardV2 from "../DashboardV2";

// ── Minimal RSC pre-renderer ──
async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
    if (Array.isArray(node)) {
        return Promise.all(node.map((child) => resolveServerTree(child)));
    }
    if (!isValidElement(node)) return node;
    const el = node as ReactElement<Record<string, unknown>>;

    // Async function component (server component): render and recurse.
    if (typeof el.type === "function" && el.type.constructor.name === "AsyncFunction") {
        const output = await (el.type as unknown as (props: unknown) => Promise<ReactNode>)(el.props);
        return resolveServerTree(output);
    }

    // Otherwise resolve any element-bearing props (children, fallback,
    // layout slots like mainContent) and clone.
    const nextProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(el.props)) {
        if (Array.isArray(value)) {
            nextProps[key] = await Promise.all(
                value.map((v) => (isValidElement(v) ? resolveServerTree(v) : Promise.resolve(v))),
            );
        } else if (isValidElement(value)) {
            nextProps[key] = await resolveServerTree(value);
        }
    }
    return Object.keys(nextProps).length > 0 ? cloneElement(el, nextProps) : el;
}

function emptyStablePage() {
    return {
        success: true as const,
        cards: [],
        totalCount: 0,
        hasMore: false,
        facetOptions: { makers: [], scales: [], finishes: [], categories: [] },
    };
}

describe("dashboard onboarding empty states", () => {
    it("DashboardV2 renders the shared welcome for a 0-horse user", async () => {
        getStablePage.mockResolvedValue(emptyStablePage());
        getStableSummary.mockResolvedValue({
            success: true,
            summary: { totalHorses: 0, vaultTotal: 0, forSaleCount: 0, collections: [] },
        });
        listStableViews.mockResolvedValue({ success: true, views: [] });

        const tree = await resolveServerTree(
            <DashboardV2 userId="test-user-id" aliasName="Tester" searchParams={{}} />,
        );
        render(<>{tree}</>);

        expect(screen.getByTestId("stable-welcome")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Welcome to Model Horse Hub!" })).toBeInTheDocument();
        // The masthead landmark stays; the sidebar overview card does not render at 0 horses
        expect(screen.getByTestId("stable-masthead")).toBeInTheDocument();
        expect(screen.queryByText("Stable Overview")).not.toBeInTheDocument();
    });
});
