// @vitest-environment jsdom
/**
 * Settings › Subscription: a /settings#subscription link lands on the
 * leaf once settings have loaded (the anchor doesn't exist while they
 * load), and a member billed through Stripe sees Manage billing first,
 * with plans as the quieter "Compare plans".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { getProfile, getUser } = vi.hoisted(() => ({ getProfile: vi.fn(), getUser: vi.fn() }));

vi.mock("@/app/actions/settings", () => ({
    getProfile,
    updateProfile: vi.fn(),
    updateNotificationPrefs: vi.fn(),
    changePassword: vi.fn(),
    uploadAvatar: vi.fn(),
    deleteAccount: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        auth: { getUser },
        from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
    }),
}));
vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));
vi.mock("@/components/InsuranceReportButton", () => ({ default: () => null }));
vi.mock("@/components/ExportButton", () => ({ default: () => null }));
vi.mock("@/components/SupporterLedgerToggle", () => ({ default: () => null }));
vi.mock("@/components/MembershipDisplayToggle", () => ({ default: () => null }));

import SettingsClient from "../SettingsClient";

const profile = {
    aliasName: "Pat",
    bio: "",
    avatarUrl: null,
    email: "pat@example.com",
    notificationPrefs: {},
    defaultHorsePublic: true,
    defaultHorseVisibility: "public",
    watermarkPhotos: false,
    watermarkText: "",
    currencySymbol: "$",
    showBadges: true,
    showPhotosOnReference: true,
    exhibitorNumber: "",
    country: "",
    shipsTo: "",
    shipsNotTo: "",
    openToTrades: false,
    lookingFor: "",
};

const scrolled: string[] = [];

beforeEach(() => {
    scrolled.length = 0;
    getProfile.mockResolvedValue(profile);
    getUser.mockResolvedValue({ data: { user: { id: "u-1", app_metadata: {} } } });
    Element.prototype.scrollIntoView = function (this: Element) {
        scrolled.push(this.id);
    };
    window.history.replaceState(null, "", "/settings");
});

afterEach(() => {
    window.history.replaceState(null, "", "/settings");
});

describe("Settings › Subscription", () => {
    it("goes to the leaf the link named once loading ends", async () => {
        window.history.replaceState(null, "", "/settings#subscription");
        render(<SettingsClient />);
        await screen.findByRole("link", { name: /View plans/ });
        await waitFor(() => expect(scrolled).toEqual(["subscription"]));
    });

    it("does not scroll without a hash", async () => {
        render(<SettingsClient />);
        await screen.findByRole("link", { name: /View plans/ });
        expect(scrolled).toEqual([]);
    });

    it("a Stripe member sees Manage billing first, and Compare plans instead of the brass upgrade", async () => {
        getUser.mockResolvedValue({ data: { user: { id: "u-1", app_metadata: { stripe_customer_id: "cus_1" } } } });
        render(<SettingsClient />);
        const manage = await screen.findByRole("button", { name: "Manage billing" });
        const compare = screen.getByRole("link", { name: "Compare plans" });
        expect(manage.compareDocumentPosition(compare) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(manage).toHaveAttribute("data-variant", "default");
        expect(compare).not.toHaveClass("btn-brass");
        expect(screen.queryByRole("link", { name: /View plans/ })).not.toBeInTheDocument();
        expect(
            screen.getByText("Opens Stripe, our payment service, to update your card, see receipts or cancel."),
        ).toBeInTheDocument();
    });

    it("everyone else keeps the brass View plans & upgrade", async () => {
        render(<SettingsClient />);
        expect(await screen.findByRole("link", { name: "View plans & upgrade" })).toHaveClass("btn-brass");
        expect(screen.queryByRole("button", { name: "Manage billing" })).not.toBeInTheDocument();
    });
});
