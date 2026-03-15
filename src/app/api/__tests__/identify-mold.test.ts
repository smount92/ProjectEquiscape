import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

let mockClient: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/utils/rateLimit", () => ({
    checkRateLimit: vi.fn().mockResolvedValue(true),
}));

vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");

import { POST } from "@/app/api/identify-mold/route";
import { checkRateLimit } from "@/lib/utils/rateLimit";

function createMultipartRequest(includeImage = true): NextRequest {
    const formData = new FormData();
    if (includeImage) {
        const blob = new Blob(["fake image data"], { type: "image/jpeg" });
        formData.append("image", new File([blob], "test.jpg", { type: "image/jpeg" }));
    }
    return new NextRequest(new URL("http://localhost:3000/api/identify-mold"), {
        method: "POST",
        body: formData,
    });
}

describe("POST /api/identify-mold", () => {
    beforeEach(() => {
        mockClient = createMockSupabaseClient();
        vi.clearAllMocks();
        (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    });

    it("returns 401 for unauthenticated user", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        const req = createMultipartRequest();
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("returns 429 when rate limited", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: "user-1", email: "t@test.com" } },
        });
        (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
        const req = createMultipartRequest();
        const res = await POST(req);
        expect(res.status).toBe(429);
    });

    it("returns 400 when no image provided", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: "user-1", email: "t@test.com" } },
        });
        const req = createMultipartRequest(false);
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("returns 200 with mold data for successful identification", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({
            data: { user: { id: "user-1", email: "t@test.com" } },
        });
        // Catalog molds lookup (implicit await - .order() chain)
        mockClient._setImplicitResolve({
            data: [{ title: "Adios" }, { title: "Fighting Stallion" }],
            error: null,
        });

        // Mock global fetch for Gemini API call
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: JSON.stringify({
                                            manufacturer: "Breyer",
                                            mold_name: "Adios",
                                            scale: "Traditional",
                                            confidence_score: 0.95,
                                        }),
                                    },
                                ],
                            },
                        },
                    ],
                }),
        });

        try {
            const req = createMultipartRequest();
            const res = await POST(req);
            const json = await res.json();
            expect(res.status).toBe(200);
            expect(json.mold_name).toBe("Adios");
            expect(json.confidence_score).toBe(0.95);
            expect(json.on_answer_key).toBe(true);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
