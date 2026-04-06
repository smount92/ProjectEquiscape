import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("CRON_SECRET", "test-cron-secret");

const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

// Chainable query builder that evaluateComplexBadges expects from admin.from()
const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((resolve: (v: { data: null; error: null }) => void) => resolve({ data: null, error: null })),
};
const mockFrom = vi.fn(() => mockQueryBuilder);

vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => ({ rpc: mockRpc, from: mockFrom })),
}));

import { GET } from "@/app/api/cron/refresh-market/route";

function mockRequest(headers: Record<string, string> = {}) {
    return new NextRequest(new URL("http://localhost:3000/api/cron/refresh-market"), {
        headers,
    });
}

describe("GET /api/cron/refresh-market", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRpc.mockResolvedValue({ data: null, error: null });
    });

    it("returns 200 with valid CRON_SECRET header", async () => {
        const req = mockRequest({ authorization: "Bearer test-cron-secret" });
        const res = await GET(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.refreshedAt).toBeDefined();
    });

    it("returns 401 with missing auth header", async () => {
        const req = mockRequest();
        const res = await GET(req);
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error).toBe("Unauthorized");
    });

    it("returns 401 with wrong auth header", async () => {
        const req = mockRequest({ authorization: "Bearer wrong-secret" });
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it("returns 500 when RPC throws", async () => {
        mockRpc.mockRejectedValueOnce(new Error("DB crash"));
        const req = mockRequest({ authorization: "Bearer test-cron-secret" });
        const res = await GET(req);
        expect(res.status).toBe(500);
    });
});
