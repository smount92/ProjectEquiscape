import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

const mockClient = createMockSupabaseClient();
/** Typed view of the chainable query mock. */
const q = mockClient._mockQuery as unknown as Record<string, Mock>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));

import { addShowPhotoToHorse } from "@/app/actions/entry-photo";

const HORSE = "123e4567-e89b-42d3-a456-426614174000";
const PATH = `horses/${HORSE}/show_photo_1722500000000.webp`;

/** Queue ONE implicit-await result (count reads) in call order. */
function queueThen(result: Record<string, unknown>) {
    q.then.mockImplementationOnce(((resolve: (value: unknown) => unknown) =>
        Promise.resolve({ error: null, ...result }).then(resolve)) as never);
}

/** Stable storage mocks so removal/getPublicUrl can be asserted. */
function mockStorage() {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const getPublicUrl = vi.fn().mockReturnValue({
        data: { publicUrl: `https://cdn.test/horse-images/${PATH}` },
    });
    mockClient.storage.from = vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove,
        getPublicUrl,
    })) as never;
    return { remove, getPublicUrl };
}

describe("entry-photo — addShowPhotoToHorse", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        q.single.mockReset();
        q.single.mockResolvedValue({ data: null, error: null });
        q.then.mockReset();
        mockClient._setImplicitResolve({ data: null, error: null });
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "t@test.com" } },
        });
    });

    it("rejects a malformed horseId before touching the database", async () => {
        const result = await addShowPhotoToHorse({ horseId: "not-a-uuid", path: PATH });
        expect(result.success).toBe(false);
        expect(mockClient.from).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(addShowPhotoToHorse({ horseId: HORSE, path: PATH })).rejects.toThrow(
            AuthError,
        );
    });

    it("rejects a path outside the horse's own folder", async () => {
        const result = await addShowPhotoToHorse({
            horseId: HORSE,
            path: "horses/999e4567-e89b-42d3-a456-426614174999/x.webp",
        });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toMatch(/invalid photo path/i);
        expect(mockClient.from).not.toHaveBeenCalled();
    });

    it("refuses when the horse isn't the caller's", async () => {
        mockStorage();
        q.single.mockResolvedValueOnce({ data: null, error: null });
        const result = await addShowPhotoToHorse({ horseId: HORSE, path: PATH });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toMatch(/not found or not yours/i);
        expect(q.insert).not.toHaveBeenCalled();
    });

    it("enforces the 5-per-horse cap and removes the orphaned upload", async () => {
        const { remove } = mockStorage();
        q.single.mockResolvedValueOnce({ data: { id: HORSE }, error: null });
        queueThen({ count: 5 }); // cap already full
        const result = await addShowPhotoToHorse({ horseId: HORSE, path: PATH });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toMatch(/show photo limit reached \(5 per horse\)/i);
        expect(remove).toHaveBeenCalledWith([PATH]);
        expect(q.insert).not.toHaveBeenCalled();
    });

    it("attaches the photo under the Other angle and returns it for the grid", async () => {
        mockStorage();
        q.single
            .mockResolvedValueOnce({ data: { id: HORSE }, error: null }) // ownership
            .mockResolvedValueOnce({ data: { id: "img-1" }, error: null }); // insert
        queueThen({ count: 2 }); // room left

        const result = await addShowPhotoToHorse({ horseId: HORSE, path: PATH });
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.photo).toEqual({
            id: "img-1",
            publicUrl: `https://cdn.test/horse-images/${PATH}`,
            angleProfile: "Other",
        });
        expect(q.insert).toHaveBeenCalledWith({
            horse_id: HORSE,
            image_url: `https://cdn.test/horse-images/${PATH}`,
            angle_profile: "Other",
        });
    });

    it("surfaces an insert failure honestly", async () => {
        mockStorage();
        q.single
            .mockResolvedValueOnce({ data: { id: HORSE }, error: null })
            .mockResolvedValueOnce({ data: null, error: { message: "insert broke" } });
        queueThen({ count: 0 });

        const result = await addShowPhotoToHorse({ horseId: HORSE, path: PATH });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toBe("insert broke");
    });
});
