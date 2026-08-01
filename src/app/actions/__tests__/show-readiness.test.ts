import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

const mockClient = createMockSupabaseClient();
/** Typed view of the chainable query mock. */
const q = mockClient._mockQuery as unknown as Record<string, Mock>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

import { getMyShowReadiness, listMyEntrantHorses } from "@/app/actions/show-readiness";

/** Queue ONE implicit-await result (list reads) in call order. */
function queueThen(result: Record<string, unknown>) {
    q.then.mockImplementationOnce(((
        resolve: (value: unknown) => unknown,
    ) => Promise.resolve({ error: null, ...result }).then(resolve)) as never);
}

describe("show-readiness — getMyShowReadiness", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        q.then.mockReset();
        mockClient._setImplicitResolve({ data: null, error: null });
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "t@test.com" } },
        });
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(getMyShowReadiness()).rejects.toThrow(AuthError);
    });

    it("empty stable → all-zero counts without a photo query", async () => {
        queueThen({ data: [] });
        const result = await getMyShowReadiness();
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.readiness).toEqual({
            totalHorses: 0,
            publicHorses: 0,
            horsesWithPhotos: 0,
            eligibleCount: 0,
        });
        // Only the horses query ran.
        expect(q.then).toHaveBeenCalledTimes(1);
    });

    it("computes the four buckets from horses × photo presence", async () => {
        queueThen({
            data: [
                { id: "h1", is_public: true }, // public + photo → eligible
                { id: "h2", is_public: true }, // public, no photo
                { id: "h3", is_public: false }, // private + photo
                { id: "h4", is_public: false }, // private, no photo
            ],
        });
        queueThen({ data: [{ horse_id: "h1" }, { horse_id: "h1" }, { horse_id: "h3" }] });

        const result = await getMyShowReadiness();
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.readiness).toEqual({
            totalHorses: 4,
            publicHorses: 2,
            horsesWithPhotos: 2,
            eligibleCount: 1,
        });
    });

    it("surfaces a query error", async () => {
        queueThen({ data: null, error: { message: "boom" } });
        const result = await getMyShowReadiness();
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toBe("boom");
    });
});

describe("show-readiness — listMyEntrantHorses", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        q.then.mockReset();
        mockClient._setImplicitResolve({ data: null, error: null });
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "t@test.com" } },
        });
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(listMyEntrantHorses()).rejects.toThrow(AuthError);
    });

    it("maps rows and prefers the Primary_Thumbnail image", async () => {
        queueThen({
            data: [
                {
                    id: "h1",
                    custom_name: "Maple",
                    finish_type: "OF",
                    catalog_items: { scale: "Traditional" },
                },
            ],
        });
        queueThen({
            data: [
                { horse_id: "h1", image_url: "https://x/other.webp", angle_profile: "Other" },
                {
                    horse_id: "h1",
                    image_url: "https://x/primary.webp",
                    angle_profile: "Primary_Thumbnail",
                },
            ],
        });

        const result = await listMyEntrantHorses();
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.horses).toEqual([
            {
                id: "h1",
                name: "Maple",
                thumbnailUrl: "https://x/primary.webp",
                scale: "Traditional",
                finish: "OF",
            },
        ]);
    });

    it("returns an empty list without a photo query", async () => {
        queueThen({ data: [] });
        const result = await listMyEntrantHorses();
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.horses).toEqual([]);
        expect(q.then).toHaveBeenCalledTimes(1);
    });
});
