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

import {
    addShowRecord,
    updateShowRecord,
    savePedigree,
    deleteShowRecord,
} from "@/app/actions/provenance";

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

        it("records a qualification card and mirrors NAN into the legacy columns", async () => {
            const result = await addShowRecord({
                horseId: "h1",
                showName: "Fall Classic",
                qualifierProgram: "nan",
                qualifierCard: "green",
                qualifierYear: 2026,
                qualifierCardId: "  NAN-123 ",
            });
            expect(result).toEqual({ success: true, warning: undefined });
            expect(mockClient._mockQuery.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    qualifier_program: "nan",
                    qualifier_card: "green",
                    qualifier_year: 2026,
                    qualifier_card_id: "NAN-123",
                    is_nan_qualifying: true,
                    nan_card_type: "green",
                    nan_year: 2026,
                }),
            );
        });

        it("an OMEQ card leaves the NAN columns alone", async () => {
            await addShowRecord({
                horseId: "h1",
                showName: "Autumn Online Open",
                qualifierProgram: "omeq",
                qualifierCard: "blue",
                qualifierYear: "2026",
            });
            const payload = mockClient._mockQuery.insert.mock.calls[0][0] as Record<string, unknown>;
            expect(payload.qualifier_program).toBe("omeq");
            expect(payload.qualifier_card).toBe("blue");
            expect(payload.qualifier_year).toBe(2026);
            expect(payload.is_nan_qualifying).toBe(false);
            expect(payload.nan_card_type).toBeNull();
        });

        it("refuses a card colour from the wrong program", async () => {
            const result = await addShowRecord({
                horseId: "h1",
                showName: "Autumn Online Open",
                qualifierProgram: "omeq",
                qualifierCard: "green",
                qualifierYear: 2026,
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/OMEQ card colour/);
            expect(mockClient._mockQuery.insert).not.toHaveBeenCalled();
        });

        it("before migration 210 the record still saves and the caller hears the card was not kept", async () => {
            mockClient._mockQuery.then.mockImplementationOnce(((resolve: (v: unknown) => void) =>
                Promise.resolve({
                    data: null,
                    error: { code: "42703", message: 'column "qualifier_program" does not exist' },
                }).then(resolve)) as never);
            const result = await addShowRecord({
                horseId: "h1",
                showName: "Autumn Online Open",
                qualifierProgram: "omeq",
                qualifierCard: "blue",
                qualifierYear: 2026,
            });
            expect(result.success).toBe(true);
            expect(result.warning).toMatch(/card/i);
            expect(mockClient._mockQuery.insert).toHaveBeenCalledTimes(2);
            const retry = mockClient._mockQuery.insert.mock.calls[1][0] as Record<string, unknown>;
            expect(retry).not.toHaveProperty("qualifier_program");
            expect(retry.show_name).toBe("Autumn Online Open");
        });
    });

    describe("updateShowRecord", () => {
        it("'no card' clears the card and the NAN mirror together", async () => {
            const result = await updateShowRecord("rec-1", { qualifierProgram: null });
            expect(result.success).toBe(true);
            expect(mockClient._mockQuery.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    qualifier_program: null,
                    qualifier_card: null,
                    qualifier_year: null,
                    qualifier_card_id: null,
                    is_nan_qualifying: false,
                    nan_card_type: null,
                    nan_year: null,
                }),
            );
        });

        it("pre-210 the rest of the edit still lands, minus the card, with a warning", async () => {
            mockClient._mockQuery.then.mockImplementationOnce(((resolve: (v: unknown) => void) =>
                Promise.resolve({
                    data: null,
                    error: { code: "PGRST204", message: "Could not find the 'qualifier_program' column" },
                }).then(resolve)) as never);
            const result = await updateShowRecord("rec-1", {
                placing: "2nd",
                qualifierProgram: "omeq",
                qualifierCard: "purple",
                qualifierYear: 2026,
            });
            expect(result.success).toBe(true);
            expect(result.warning).toMatch(/card/i);
            expect(mockClient._mockQuery.update).toHaveBeenCalledTimes(2);
            const retry = mockClient._mockQuery.update.mock.calls[1][0] as Record<string, unknown>;
            expect(retry.placing).toBe("2nd");
            expect(retry).not.toHaveProperty("qualifier_program");
            // The NAN mirror is a 030 column and stays in the retry.
            expect(retry.is_nan_qualifying).toBe(false);
        });
    });

    // ── updateShowRecord ──
    // ── deleteShowRecord ──
    //
    // A member owns what they typed in. A placing the site awarded them
    // in an MHH show is the thing a stranger trusts, so it cannot be
    // quietly removed after a bad day.
    describe("deleteShowRecord", () => {
        it("rejects unauthenticated users", async () => {
            mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
            const result = await deleteShowRecord("rec-1");
            expect(result.success).toBe(false);
        });

        it("deletes a self-reported record", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
                data: { id: "rec-1", verification_tier: "self_reported", show_id: null },
                error: null,
            });

            const result = await deleteShowRecord("rec-1");

            expect(result.success).toBe(true);
            expect(mockClient._mockQuery.delete).toHaveBeenCalled();
        });

        it("refuses to delete a placing awarded by an MHH show", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
                data: {
                    id: "rec-1",
                    verification_tier: "platform_generated",
                    show_id: "show-1",
                },
                error: null,
            });

            const result = await deleteShowRecord("rec-1");

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/show on Model Horse Hub/i);
            expect(mockClient._mockQuery.delete).not.toHaveBeenCalled();
        });

        it("refuses a record carrying a show_id even on an older tier", async () => {
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({
                data: { id: "rec-1", verification_tier: "host_verified", show_id: "show-1" },
                error: null,
            });

            const result = await deleteShowRecord("rec-1");

            expect(result.success).toBe(false);
            expect(mockClient._mockQuery.delete).not.toHaveBeenCalled();
        });

        it("does not delete someone else's record", async () => {
            // Scoped by user_id, so another member's row simply isn't found.
            mockClient._mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            const result = await deleteShowRecord("rec-1");

            expect(result.success).toBe(false);
            expect(mockClient._mockQuery.delete).not.toHaveBeenCalled();
        });
    });

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

        // ── Gender validation tests ──

        it("rejects Mare as Sire", async () => {
            // Override from() to return gender data for the sire lookup
            const originalFrom = mockClient.from;
            mockClient.from = vi.fn().mockImplementation((table: string) => {
                const base = originalFrom(table);
                if (table === "user_horses") {
                    return {
                        ...base,
                        select: vi.fn().mockReturnValue({
                            ...base,
                            eq: vi.fn().mockReturnValue({
                                ...base,
                                single: vi.fn().mockResolvedValue({
                                    data: { assigned_gender: "Mare" },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                return base;
            });
            const result = await savePedigree({
                horseId: "h1",
                sireId: "horse-mare",
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Mare.*cannot.*Sire/i);
            mockClient.from = originalFrom;
        });

        it("rejects Stallion as Dam", async () => {
            const originalFrom = mockClient.from;
            mockClient.from = vi.fn().mockImplementation((table: string) => {
                const base = originalFrom(table);
                if (table === "user_horses") {
                    return {
                        ...base,
                        select: vi.fn().mockReturnValue({
                            ...base,
                            eq: vi.fn().mockReturnValue({
                                ...base,
                                single: vi.fn().mockResolvedValue({
                                    data: { assigned_gender: "Stallion" },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                return base;
            });
            const result = await savePedigree({
                horseId: "h1",
                damId: "horse-stallion",
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Stallion.*cannot.*Dam/i);
            mockClient.from = originalFrom;
        });

        it("rejects horse as its own Sire", async () => {
            const result = await savePedigree({
                horseId: "h1",
                sireId: "h1",
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/own Sire/i);
        });

        it("rejects horse as its own Dam", async () => {
            const result = await savePedigree({
                horseId: "h1",
                damId: "h1",
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/own Dam/i);
        });

        it("rejects same horse as both Sire and Dam", async () => {
            const originalFrom = mockClient.from;
            mockClient.from = vi.fn().mockImplementation((table: string) => {
                const base = originalFrom(table);
                if (table === "user_horses") {
                    return {
                        ...base,
                        select: vi.fn().mockReturnValue({
                            ...base,
                            eq: vi.fn().mockReturnValue({
                                ...base,
                                single: vi.fn().mockResolvedValue({
                                    data: { assigned_gender: null },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                return base;
            });
            const result = await savePedigree({
                horseId: "h1",
                sireId: "horse-x",
                damId: "horse-x",
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Sire and Dam cannot be the same/i);
            mockClient.from = originalFrom;
        });

        it("allows horse with no assigned_gender as Sire", async () => {
            const originalFrom = mockClient.from;
            mockClient.from = vi.fn().mockImplementation((table: string) => {
                const base = originalFrom(table);
                if (table === "user_horses") {
                    return {
                        ...base,
                        select: vi.fn().mockReturnValue({
                            ...base,
                            eq: vi.fn().mockReturnValue({
                                ...base,
                                single: vi.fn().mockResolvedValue({
                                    data: { assigned_gender: null },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                if (table === "horse_pedigrees") {
                    return {
                        ...base,
                        select: vi.fn().mockReturnValue({
                            ...base,
                            eq: vi.fn().mockReturnValue({
                                ...base,
                                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                            }),
                        }),
                        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
                    };
                }
                return base;
            });
            const result = await savePedigree({
                horseId: "h1",
                sireId: "horse-unknown",
            });
            expect(result.success).toBe(true);
            mockClient.from = originalFrom;
        });
    });
});
