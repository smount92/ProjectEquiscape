import { describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyCard } from "@/lib/shows/verifyCard";

const mockClient = createMockSupabaseClient();
const supabase = mockClient as unknown as SupabaseClient;

const RPC_ROW = {
    code: "AbCd2345",
    status: "issued",
    earned_place: 1,
    show_year: 2026,
    show_title: "Spring Fling Live",
    class_name: "Quarter Horse",
    issued_at: "2026-07-10T12:00:00Z",
};

beforeEach(() => {
    mockClient.rpc.mockReset();
    mockClient.rpc.mockResolvedValue({ data: null, error: null });
});

describe("verifyCard — the public RPC path", () => {
    it("rejects malformed codes without a round-trip (0/O/1/I are not in the alphabet)", async () => {
        expect(await verifyCard(supabase, "O0O0O0O0")).toBeNull();
        expect(await verifyCard(supabase, "short")).toBeNull();
        expect(await verifyCard(supabase, "")).toBeNull();
        expect(mockClient.rpc).not.toHaveBeenCalled();
    });

    it("maps a verified card, tolerating the pre-120 RPC shape (no horse_name)", async () => {
        mockClient.rpc.mockResolvedValueOnce({ data: [RPC_ROW], error: null });
        const result = await verifyCard(supabase, "AbCd2345");
        expect(mockClient.rpc).toHaveBeenCalledWith("verify_qualification_card", {
            p_code: "AbCd2345",
        });
        expect(result).toEqual({
            code: "AbCd2345",
            status: "issued",
            earnedPlace: 1,
            showYear: 2026,
            showTitle: "Spring Fling Live",
            className: "Quarter Horse",
            issuedAt: "2026-07-10T12:00:00Z",
            horseName: null,
        });
    });

    it("surfaces horse_name once migration 120 adds it", async () => {
        mockClient.rpc.mockResolvedValueOnce({
            data: [{ ...RPC_ROW, horse_name: "Bo Jangles" }],
            error: null,
        });
        const result = await verifyCard(supabase, "AbCd2345");
        expect(result).toMatchObject({ horseName: "Bo Jangles" });
    });

    it("returns null for a well-formed code that matches no card", async () => {
        mockClient.rpc.mockResolvedValueOnce({ data: [], error: null });
        expect(await verifyCard(supabase, "AbCd2345")).toBeNull();
    });

    it("trims surrounding whitespace before validating", async () => {
        mockClient.rpc.mockResolvedValueOnce({ data: [RPC_ROW], error: null });
        const result = await verifyCard(supabase, "  AbCd2345  ");
        expect(result).toMatchObject({ code: "AbCd2345" });
    });

    it("surfaces RPC errors distinctly from not-found", async () => {
        mockClient.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: "rpc down" },
        });
        expect(await verifyCard(supabase, "AbCd2345")).toEqual({ error: "rpc down" });
    });
});
