import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() =>
        Promise.resolve({
            auth: { getUser: mockGetUser },
        })
    ),
}));

import { requireAuth, optionalAuth, getUserTier, AuthError } from "@/lib/auth";

describe("requireAuth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns supabase + user when authenticated", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "a@b.com" } },
        });
        const result = await requireAuth();
        expect(result.user.id).toBe("user-1");
        expect(result.supabase).toBeDefined();
    });

    it("throws AuthError when not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        await expect(requireAuth()).rejects.toThrow(AuthError);
    });
});

describe("optionalAuth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns user when authenticated", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: { id: "user-1" } },
        });
        const result = await optionalAuth();
        expect(result.user?.id).toBe("user-1");
    });

    it("returns null user when anonymous", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        const result = await optionalAuth();
        expect(result.user).toBeNull();
        expect(result.supabase).toBeDefined();
    });
});

// ══════════════════════════════════════════════════════════════
// getUserTier — where the entitlement clock is actually enforced.
//
// Every gate on the site reads this. If it were possible for an expired
// term to come back "pro" here, nothing else in the feature would
// matter; and if it were possible for a member with NO clock to come
// back "free", the site would cancel its entire membership base.
//
// `cache()` from React memoizes resolveViewer per request; under Node
// with no request context each call re-resolves, which is what lets
// these cases run independently.
// ══════════════════════════════════════════════════════════════
describe("getUserTier — read-time expiry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
    });

    function signedInWith(app_metadata: Record<string, unknown>) {
        mockGetUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "member@example.com", app_metadata } },
        });
    }

    it("is free for an anonymous visitor", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        expect(await getUserTier()).toBe("free");
    });

    // ── The recurring subscriber, who must not notice this feature ──
    it("a paid tier with NO paid_through is unaffected — Stripe and open-ended PayPal", async () => {
        signedInWith({ tier: "pro", stripe_customer_id: "cus_live_1" });
        expect(await getUserTier()).toBe("pro");
    });

    it("a studio subscriber with no clock stays studio", async () => {
        signedInWith({ tier: "studio", paypal_subscription_id: "I-SUB-1" });
        expect(await getUserTier()).toBe("studio");
    });

    it("an explicitly null paid_through means no expiry, not expired", async () => {
        signedInWith({ tier: "pro", paid_through: null });
        expect(await getUserTier()).toBe("pro");
    });

    // ── The term holder ──
    it("a term still running reads as the tier it bought", async () => {
        signedInWith({ tier: "pro", paid_through: new Date(Date.now() + 86_400_000).toISOString() });
        expect(await getUserTier()).toBe("pro");
    });

    it("a term that ran out reads as free on the very next request", async () => {
        signedInWith({ tier: "pro", paid_through: new Date(Date.now() - 1000).toISOString() });
        expect(await getUserTier()).toBe("free");
    });

    it("an expired studio term reads as free, not as pro", async () => {
        signedInWith({ tier: "studio", paid_through: "2020-01-01T00:00:00Z" });
        expect(await getUserTier()).toBe("free");
    });

    it("keeps the tier when the stored date is unreadable", async () => {
        signedInWith({ tier: "pro", paid_through: "soon-ish" });
        expect(await getUserTier()).toBe("pro");
    });

    it("the admin bypass still wins, clock or no clock", async () => {
        vi.stubEnv("ADMIN_EMAIL", "boss@example.com");
        mockGetUser.mockResolvedValue({
            data: {
                user: {
                    id: "admin-1",
                    email: "boss@example.com",
                    app_metadata: { tier: "free", paid_through: "2020-01-01T00:00:00Z" },
                },
            },
        });
        expect(await getUserTier()).toBe("pro");
    });
});
