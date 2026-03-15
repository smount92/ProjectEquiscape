import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin client and next/headers before importing
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
    headers: vi.fn(),
}));

import { checkRateLimit } from "@/lib/utils/rateLimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";

const mockGetAdminClient = vi.mocked(getAdminClient);
const mockHeaders = vi.mocked(headers);

describe("checkRateLimit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: headers returns a map-like object
        mockHeaders.mockResolvedValue({
            get: vi.fn((key: string) => {
                if (key === "x-forwarded-for") return "1.2.3.4";
                return null;
            }),
        } as unknown as Headers);
    });

    it("returns true (allowed) when RPC returns true", async () => {
        const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });
        mockGetAdminClient.mockReturnValue({ rpc: mockRpc } as unknown as ReturnType<typeof getAdminClient>);

        const result = await checkRateLimit("test_endpoint", 5, 15);
        expect(result).toBe(true);
        expect(mockRpc).toHaveBeenCalledWith("check_rate_limit", {
            p_identifier: "1.2.3.4",
            p_endpoint: "test_endpoint",
            p_max_attempts: 5,
            p_window_interval: "15 minutes",
        });
    });

    it("returns false (rate-limited) when RPC returns false", async () => {
        const mockRpc = vi.fn().mockResolvedValue({ data: false, error: null });
        mockGetAdminClient.mockReturnValue({ rpc: mockRpc } as unknown as ReturnType<typeof getAdminClient>);

        const result = await checkRateLimit("test_endpoint", 3, 10);
        expect(result).toBe(false);
    });

    it("fails open (returns true) on RPC error", async () => {
        const mockRpc = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        mockGetAdminClient.mockReturnValue({ rpc: mockRpc } as unknown as ReturnType<typeof getAdminClient>);

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        const result = await checkRateLimit("test_endpoint", 5, 15);
        expect(result).toBe(true);
        consoleSpy.mockRestore();
    });

    it("fails open (returns true) on unexpected exception", async () => {
        mockGetAdminClient.mockImplementation(() => {
            throw new Error("Connection failed");
        });

        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        const result = await checkRateLimit("test_endpoint", 5, 15);
        expect(result).toBe(true);
        consoleSpy.mockRestore();
    });

    it("uses identifierOverride when provided", async () => {
        const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });
        mockGetAdminClient.mockReturnValue({ rpc: mockRpc } as unknown as ReturnType<typeof getAdminClient>);

        await checkRateLimit("test_endpoint", 5, 15, "user-123");
        expect(mockRpc).toHaveBeenCalledWith("check_rate_limit", {
            p_identifier: "user-123",
            p_endpoint: "test_endpoint",
            p_max_attempts: 5,
            p_window_interval: "15 minutes",
        });
    });

    it("extracts IP from x-forwarded-for header", async () => {
        mockHeaders.mockResolvedValue({
            get: vi.fn((key: string) => {
                if (key === "x-forwarded-for") return "10.0.0.1, 192.168.1.1";
                return null;
            }),
        } as unknown as Headers);

        const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });
        mockGetAdminClient.mockReturnValue({ rpc: mockRpc } as unknown as ReturnType<typeof getAdminClient>);

        await checkRateLimit("test_endpoint", 5, 15);
        // Should use first IP from x-forwarded-for
        expect(mockRpc).toHaveBeenCalledWith("check_rate_limit", expect.objectContaining({
            p_identifier: "10.0.0.1",
        }));
    });

    it("falls back to x-real-ip when x-forwarded-for is missing", async () => {
        mockHeaders.mockResolvedValue({
            get: vi.fn((key: string) => {
                if (key === "x-real-ip") return "192.168.0.1";
                return null;
            }),
        } as unknown as Headers);

        const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });
        mockGetAdminClient.mockReturnValue({ rpc: mockRpc } as unknown as ReturnType<typeof getAdminClient>);

        await checkRateLimit("test_endpoint", 5, 15);
        expect(mockRpc).toHaveBeenCalledWith("check_rate_limit", expect.objectContaining({
            p_identifier: "192.168.0.1",
        }));
    });
});
