import { vi, describe, it, expect, beforeEach } from "vitest";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { uploadImageWithRetry } from "@/lib/utils/uploadWithRetry";

function clientWith(upload: ReturnType<typeof vi.fn>) {
    return { storage: { from: vi.fn(() => ({ upload })) } };
}

describe("uploadImageWithRetry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it("returns clean on first-try success without retrying", async () => {
        const upload = vi.fn().mockResolvedValue({ error: null });
        const result = await uploadImageWithRetry(clientWith(upload), "b", "p", new Blob());
        expect(result.error).toBeNull();
        expect(upload).toHaveBeenCalledTimes(1);
        expect(captureException).not.toHaveBeenCalled();
    });

    it("retries once on transient failure and succeeds silently", async () => {
        const upload = vi
            .fn()
            .mockResolvedValueOnce({ error: { message: "network flake" } })
            .mockResolvedValueOnce({ error: null });
        const result = await uploadImageWithRetry(clientWith(upload), "b", "p", new Blob());
        expect(result.error).toBeNull();
        expect(upload).toHaveBeenCalledTimes(2);
        // retry overwrites the possibly half-written object
        expect(upload.mock.calls[1][2]).toMatchObject({ upsert: true });
        expect(captureException).not.toHaveBeenCalled();
    });

    it("reports to Sentry and returns the error after both attempts fail", async () => {
        const upload = vi.fn().mockResolvedValue({ error: { message: "storage down" } });
        const result = await uploadImageWithRetry(clientWith(upload), "b", "p", new Blob());
        expect(result.error?.message).toBe("storage down");
        expect(upload).toHaveBeenCalledTimes(2);
        expect(captureException).toHaveBeenCalledTimes(1);
    });
});
