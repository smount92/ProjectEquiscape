import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

let mockClient: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => {
        return Promise.resolve(mockClient);
    }),
}));

import { GET } from "@/app/api/auth/me/route";

describe("GET /api/auth/me", () => {
    beforeEach(() => {
        mockClient = createMockSupabaseClient();
    });

    it("returns userId for authenticated user", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: "test-user-id", email: "t@test.com" } },
        });
        const res = await GET();
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.userId).toBe("test-user-id");
    });

    it("returns null userId for unauthenticated user", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({
            data: { user: null },
        });
        const res = await GET();
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.userId).toBe(null);
    });
});
