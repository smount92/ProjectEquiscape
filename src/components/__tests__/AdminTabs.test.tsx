// @vitest-environment jsdom
/**
 * Admin console tabs follow the URL, not only on first load: a notice
 * clicked while the owner is already on /admin (#mailbox, #members,
 * #calendar, ?tab=reports) switches the tab. The Mailbox badge counts
 * open messages; Members is badged with open deal disputes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
    useSearchParams: () => nav.params,
    usePathname: () => "/admin",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/actions/admin", () => ({}));
vi.mock("@/app/actions/external-shows", () => ({}));
vi.mock("@/app/actions/moderation", () => ({}));

// Every panel is a marker: only which one is showing is under test.
const { marker } = vi.hoisted(() => ({
    marker: (name: string) => ({ default: () => <div data-testid="panel">{name}</div> }),
}));
vi.mock("@/components/AdminMailbox", () => marker("mailbox"));
vi.mock("@/components/AdminMembersTab", () => marker("members"));
vi.mock("@/components/AdminSanctioningCard", () => marker("sanctioning"));
vi.mock("@/components/AdminInsightsTab", () => marker("insights"));
vi.mock("@/components/AdminOpsTab", () => marker("ops"));
vi.mock("@/components/AdminEnvFlagsCard", () => marker("env"));
vi.mock("@/components/AdminErrorsCard", () => marker("errors"));
vi.mock("@/components/AdminCronCard", () => marker("cron"));
vi.mock("@/components/AdminOverdueShowsCard", () => marker("overdue"));
vi.mock("@/components/AdminShowManager", () => marker("shows"));
vi.mock("@/components/FeatureHorseForm", () => marker("feature"));
vi.mock("@/components/AdminAnnouncementsCard", () => marker("announcements"));
vi.mock("@/components/AdminSuggestionsPanel", () => marker("legacy"));
vi.mock("@/components/AdminCatalogMergeCard", () => marker("merge"));
vi.mock("@/components/AdminCatalogDuplicatesCard", () => marker("duplicates"));
vi.mock("@/components/AdminHiddenPricesCard", () => marker("hidden-prices"));

import AdminTabs, { askedAdminTab } from "../AdminTabs";
import type { AdminPulse } from "@/app/actions/admin";

const pulse = (disputes: number): AdminPulse => ({
    totalMembers: 10,
    newMembers7d: 1,
    totalHorses: 20,
    posts7d: 3,
    liveListings: 2,
    openShows: 1,
    openShowEntries: 4,
    pending: {
        reports: 0,
        sanctioning: 0,
        barnJoinRequests: 0,
        catalogSuggestions: 0,
        contactMessages: 3,
        legacySuggestions: 0,
        externalShows: 0,
        disputes,
    },
});

const tabs = (props: Partial<React.ComponentProps<typeof AdminTabs>> = {}) => (
    <AdminTabs openMessages={0} shows={[]} suggestions={[]} reports={[]} {...props} />
);

const showing = () => screen.getByTestId("panel").textContent;

/**
 * What Next does on a <Link> to /admin#x or /admin?tab=x: the history
 * entry first, then a re-render of every useSearchParams reader (with a
 * new params object, a hash-only change included).
 */
function navigate(url: string, rerender: (ui: React.ReactElement) => void) {
    window.history.pushState(null, "", url);
    nav.params = new URLSearchParams(window.location.search);
    act(() => rerender(tabs()));
}

beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/admin");
    nav.params = new URLSearchParams();
});

afterEach(() => {
    window.history.replaceState(null, "", "/");
});

describe("askedAdminTab", () => {
    it("reads #hash and ?tab=, the hash first, and ignores anything that isn't a tab", () => {
        expect(askedAdminTab(null, "#mailbox")).toBe("mailbox");
        expect(askedAdminTab("reports", "")).toBe("reports");
        expect(askedAdminTab("reports", "#members")).toBe("members");
        expect(askedAdminTab("nonsense", "#subscription")).toBeNull();
        expect(askedAdminTab(null, "")).toBeNull();
    });
});

describe("AdminTabs follows the URL", () => {
    it("opens the tab the first URL asked for, over the saved one", () => {
        localStorage.setItem("admin-tab", "ops");
        window.history.replaceState(null, "", "/admin?tab=reports");
        nav.params = new URLSearchParams("tab=reports");
        render(tabs());
        expect(screen.getByText("All Clear")).toBeInTheDocument();
    });

    it("falls back to the last-used tab only on first load", () => {
        localStorage.setItem("admin-tab", "insights");
        render(tabs());
        expect(showing()).toBe("insights");
    });

    it("switches when a notice links to another tab while already on /admin", () => {
        const { rerender } = render(tabs());
        expect(showing()).toBe("mailbox");

        navigate("/admin#members", rerender);
        expect(showing()).toBe("members");

        navigate("/admin#calendar", rerender);
        expect(screen.getByText("No Pending Listings")).toBeInTheDocument();

        navigate("/admin?tab=reports", rerender);
        expect(screen.getByText("All Clear")).toBeInTheDocument();

        navigate("/admin#mailbox", rerender);
        expect(showing()).toBe("mailbox");
    });

    it("switches on a plain hashchange", async () => {
        render(tabs());
        window.location.hash = "#ops";
        await waitFor(() => expect(screen.getByText("ops")).toBeInTheDocument());
    });

    it("a tab click writes the tab into the address, so the same notice works again", async () => {
        const user = userEvent.setup();
        window.history.replaceState(null, "", "/admin?tab=reports");
        nav.params = new URLSearchParams("tab=reports");
        const { rerender } = render(tabs());

        await user.click(screen.getByRole("button", { name: /Insights/ }));
        expect(window.location.pathname + window.location.search + window.location.hash).toBe("/admin#insights");
        expect(localStorage.getItem("admin-tab")).toBe("insights");

        navigate("/admin?tab=reports", rerender);
        expect(screen.getByText("All Clear")).toBeInTheDocument();
    });
});

describe("AdminTabs badges", () => {
    it("Mailbox counts open messages", () => {
        render(tabs({ openMessages: 4 }));
        expect(within(screen.getByRole("button", { name: /Mailbox/ })).getByText("4")).toBeInTheDocument();
    });

    it("Members carries the open dispute count, in red", () => {
        render(tabs({ pulse: pulse(2) }));
        const badge = within(screen.getByRole("button", { name: /Members/ })).getByText("2");
        expect(badge).toHaveClass("bg-destructive");
    });

    it("no disputes, no Members badge", () => {
        render(tabs({ pulse: pulse(0) }));
        expect(screen.getByRole("button", { name: /Members/ })).toHaveTextContent(/^👤Members$/);
    });
});
