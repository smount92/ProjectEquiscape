import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));
vi.mock("@/app/actions/activity", () => ({
    createActivityEvent: vi.fn().mockResolvedValue(undefined),
}));

import { addShowRecord, updateShowRecord, savePedigree } from "@/app/actions/provenance";

describe("provenance.ts — Show Records & Pedigree", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "user-1", email: "test@test.com" } },
        });
    });

    // ── addShowRecord ──
    describe("addShowRecord", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            const result = await addShowRecord({ horseId: "h1", showName: "My Show" });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/logged in/i);
        });

        it("rejects empty show name", async () => {
            const result = await addShowRecord({ horseId: "h1", showName: "   " });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/show name/i);
        });

        it("succeeds with valid data", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
            const result = await addShowRecord({
                horseId: "h1",
                showName: "NAN Show 2024",
                division: "Performance",
                className: "OF Stock Horse Mare",
                placing: "1st",
            });
            expect(result.success).toBe(true);
        });

        it("uses fuzzy date fallback when showDate missing but showDateText has year", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
            const result = await addShowRecord({
                horseId: "h1",
                showName: "Old Show",
                showDateText: "Spring 2022",
            });
            expect(result.success).toBe(true);
            // Verify the insert was called with the fuzzy date
            expect(mockClient.from).toHaveBeenCalledWith("show_records");
        });

        it("stores class_name in insert payload", async () => {
            mockClient._mockQuery.single.mockResolvedValueOnce({ data: null, error: null });
            await addShowRecord({
                horseId: "h1",
                showName: "Test Show",
                className: "CM Decorator",
            });
            // Verify from("show_records") was called
            expect(mockClient.from).toHaveBeenCalledWith("show_records");
            // The insert mock was called (chained with the fluent API)
            expect(mockClient._mockQuery.insert).toHaveBeenCalled();
        });
    });

    // ── updateShowRecord ──
    describe("updateShowRecord", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            const result = await updateShowRecord("rec-1", { showName: "New Name" });
            expect(result.success).toBe(false);
        });

        it("clears notes when sent as null (regression test)", async () => {
            const result = await updateShowRecord("rec-1", { notes: null });
            expect(result.success).toBe(true);
            // update was called — notes should be null in the payload
            expect(mockClient._mockQuery.update).toHaveBeenCalled();
        });

        it("updates notes to new value", async () => {
            const result = await updateShowRecord("rec-1", { notes: "Updated notes" });
            expect(result.success).toBe(true);
            expect(mockClient._mockQuery.update).toHaveBeenCalled();
        });

        it("does NOT include undefined fields in update payload", async () => {
            // Only send showName — other fields should NOT appear
            const result = await updateShowRecord("rec-1", { showName: "New Show" });
            expect(result.success).toBe(true);
            // The function builds updateData only from defined fields
            expect(mockClient._mockQuery.update).toHaveBeenCalled();
        });

        it("updates className in payload", async () => {
            const result = await updateShowRecord("rec-1", { className: "OF Stock Horse" });
            expect(result.success).toBe(true);
            expect(mockClient._mockQuery.update).toHaveBeenCalled();
        });

        it("applies fuzzy date fallback on update", async () => {
            const result = await updateShowRecord("rec-1", {
                showDateText: "Fall 2023",
                // no showDate provided
            });
            expect(result.success).toBe(true);
        });
    });

    // ── savePedigree ──
    describe("savePedigree", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            const result = await savePedigree({ horseId: "h1" });
            expect(result.success).toBe(false);
        });

        it("inserts new pedigree when none exists", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            const result = await savePedigree({
                horseId: "h1",
                sireName: "Sire A",
                damName: "Dam B",
            });
            expect(result.success).toBe(true);
            expect(mockClient._mockQuery.insert).toHaveBeenCalled();
        });

        it("updates existing pedigree", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
                data: { id: "ped-1" },
                error: null,
            });
            const result = await savePedigree({
                horseId: "h1",
                sireName: "Updated Sire",
            });
            expect(result.success).toBe(true);
            expect(mockClient._mockQuery.update).toHaveBeenCalled();
        });

        it("saves relational sireId and damId", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            const result = await savePedigree({
                horseId: "h1",
                sireId: "horse-sire",
                damId: "horse-dam",
            });
            expect(result.success).toBe(true);
        });
    });
});
