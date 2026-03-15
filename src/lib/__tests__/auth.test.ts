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

import { requireAuth, optionalAuth, AuthError } from "@/lib/auth";

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
