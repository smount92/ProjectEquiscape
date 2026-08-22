import { vi, describe, it, expect, beforeEach, afterAll, type Mock } from "vitest";
import { createMockSupabaseClient, createMockAdminClient } from "@/__tests__/mocks/supabase";
import { AuthError } from "@/lib/auth";

const mockClient = createMockSupabaseClient();
const mockAdmin = createMockAdminClient();
/** Typed views of the chainable query mocks. */
const q = mockClient._mockQuery as unknown as Record<string, Mock>;
const aq = mockAdmin._mockQuery as unknown as Record<string, Mock>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => mockAdmin),
}));
// The public list reads through a COOKIE-LESS anon client now.
vi.mock("@/lib/supabase/anon", () => ({
    createAnonClient: vi.fn(() => mockClient),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
    // Pass-through: the cache wrapper is Next's job, not this suite's.
    unstable_cache: <T>(fn: T) => fn,
}));

import {
    listApprovedExternalShows,
    listPendingExternalShows,
    reviewExternalShow,
    submitExternalShow,
} from "@/app/actions/external-shows";
import type { SubmitExternalShowInput } from "@/lib/external-shows/schemas";

const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;
afterAll(() => {
    process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
});

function isoDaysFromNow(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

function validInput(overrides: Partial<SubmitExternalShowInput> = {}): SubmitExternalShowInput {
    return {
        title: "Autumn Gold Photo Show",
        url: "https://example.com/autumn-gold",
        venueType: "online_photo",
        hostName: "Autumn Gold Crew",
        platform: "facebook",
        startsOn: isoDaysFromNow(30),
        ...overrides,
    };
}

beforeEach(() => {
    // clearAllMocks clears call history but keeps implementations —
    // the query mock's implicit-await `then` must stay alive, driven
    // by _setImplicitResolve below.
    vi.clearAllMocks();
    mockClient._setImplicitResolve({ data: null, error: null });
    mockAdmin._setImplicitResolve({ data: null, error: null });
    process.env.ADMIN_EMAIL = "admin@test.com";
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "member@test.com" } },
    });
});

describe("submitExternalShow — validation", () => {
    it("rejects unauthenticated users", async () => {
        mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
        await expect(submitExternalShow(validInput())).rejects.toThrow(AuthError);
    });

    it("rejects javascript: URLs", async () => {
        const result = await submitExternalShow(
            validInput({ url: "javascript:alert(1)" }),
        );
        expect(result.success).toBe(false);
        expect(q.insert).not.toHaveBeenCalled();
    });

    it("rejects non-http(s) schemes (ftp, data)", async () => {
        for (const url of ["ftp://example.com/show", "data:text/html,hi"]) {
            const result = await submitExternalShow(validInput({ url }));
            expect(result.success).toBe(false);
        }
        expect(q.insert).not.toHaveBeenCalled();
    });

    it("rejects plain non-URLs", async () => {
        const result = await submitExternalShow(validInput({ url: "not a url" }));
        expect(result.success).toBe(false);
    });

    it("accepts http and https URLs", async () => {
        for (const url of ["https://example.com/a", "http://example.com/b"]) {
            const result = await submitExternalShow(validInput({ url }));
            expect(result.success).toBe(true);
        }
    });

    it("rejects a show dated before yesterday", async () => {
        const result = await submitExternalShow(
            validInput({ startsOn: isoDaysFromNow(-2) }),
        );
        expect(result.success).toBe(false);
        expect(q.insert).not.toHaveBeenCalled();
    });

    it("accepts a show dated today and yesterday (timezone grace)", async () => {
        for (const startsOn of [isoDaysFromNow(0), isoDaysFromNow(-1)]) {
            const result = await submitExternalShow(validInput({ startsOn }));
            expect(result.success).toBe(true);
        }
    });

    it("rejects entries closing after the show date", async () => {
        const result = await submitExternalShow(
            validInput({
                startsOn: isoDaysFromNow(10),
                entriesCloseOn: isoDaysFromNow(11),
            }),
        );
        expect(result.success).toBe(false);
    });

    it("accepts entries closing on or before the show date", async () => {
        const result = await submitExternalShow(
            validInput({
                startsOn: isoDaysFromNow(10),
                entriesCloseOn: isoDaysFromNow(10),
            }),
        );
        expect(result.success).toBe(true);
    });

    it("rejects descriptions over 500 characters", async () => {
        const result = await submitExternalShow(
            validInput({ description: "x".repeat(501) }),
        );
        expect(result.success).toBe(false);
    });
});

describe("submitExternalShow — the status guard", () => {
    it("always inserts as pending, owned by the caller", async () => {
        const result = await submitExternalShow(validInput());
        expect(result.success).toBe(true);
        expect(q.insert).toHaveBeenCalledTimes(1);
        expect(q.insert).toHaveBeenCalledWith(
            expect.objectContaining({ status: "pending", submitted_by: "user-1" }),
        );
    });

    it("a submitter cannot smuggle an approved status or a foreign owner", async () => {
        // A hostile caller spikes the payload; zod strips unknown-key
        // survivors and the action builds the row from parsed data
        // only — the spoofed fields never reach the insert.
        const spiked = {
            ...validInput(),
            status: "approved",
            submitted_by: "someone-else",
            reviewed_by: "someone-else",
        } as unknown as SubmitExternalShowInput;

        const result = await submitExternalShow(spiked);
        expect(result.success).toBe(true);
        const payload = q.insert.mock.calls[0][0] as Record<string, unknown>;
        expect(payload.status).toBe("pending");
        expect(payload.submitted_by).toBe("user-1");
        expect("reviewed_by" in payload).toBe(false);
    });

    it("strips markup from free-text fields before storage", async () => {
        await submitExternalShow(
            validInput({ title: "Big <script>alert(1)</script> Show" }),
        );
        const payload = q.insert.mock.calls[0][0] as Record<string, unknown>;
        expect(payload.title).not.toContain("<script>");
    });

    it("returns a friendly error pre-migration (missing table)", async () => {
        mockClient._setImplicitResolve({
            data: null,
            error: { code: "42P01", message: 'relation "public.external_shows" does not exist' },
        });
        const result = await submitExternalShow(validInput());
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toMatch(/isn't accepting/);
    });
});

describe("listApprovedExternalShows", () => {
    it("returns approved rows via the anon-safe client", async () => {
        const row = {
            id: "ext-1",
            title: "Prairie Live",
            url: "https://example.com",
            venue_type: "live",
            host_name: "Club",
            platform: "facebook",
            starts_on: "2026-09-01",
            entries_close_on: null,
            location: null,
            description: "",
        };
        mockClient._setImplicitResolve({ data: [row], error: null });
        const result = await listApprovedExternalShows();
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.shows).toEqual([row]);
        expect(q.eq).toHaveBeenCalledWith("status", "approved");
    });

    it("degrades to an empty list pre-migration instead of failing the page", async () => {
        mockClient._setImplicitResolve({
            data: null,
            error: { code: "42P01", message: 'relation "public.external_shows" does not exist' },
        });
        const result = await listApprovedExternalShows();
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.shows).toEqual([]);
    });

    it("surfaces real query errors", async () => {
        mockClient._setImplicitResolve({ data: null, error: { message: "boom" } });
        const result = await listApprovedExternalShows();
        expect(result.success).toBe(false);
    });
});

describe("admin gate — listPendingExternalShows / reviewExternalShow", () => {
    it("refuses a non-admin member", async () => {
        const list = await listPendingExternalShows();
        expect(list).toEqual({ success: false, error: "Admin access required." });

        const review = await reviewExternalShow({
            id: "3b8f0f2e-6f3a-4d2b-9c1e-2a7d8e9f0a1b",
            decision: "approved",
        });
        expect(review).toEqual({ success: false, error: "Admin access required." });
        expect(aq.update).not.toHaveBeenCalled();
    });

    it("refuses when ADMIN_EMAIL is unset (fail closed)", async () => {
        delete process.env.ADMIN_EMAIL;
        const review = await reviewExternalShow({
            id: "3b8f0f2e-6f3a-4d2b-9c1e-2a7d8e9f0a1b",
            decision: "approved",
        });
        expect(review).toEqual({ success: false, error: "Admin access required." });
    });

    it("lets the admin approve — stamping reviewer and time", async () => {
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "admin-1", email: "admin@test.com" } },
        });
        const result = await reviewExternalShow({
            id: "3b8f0f2e-6f3a-4d2b-9c1e-2a7d8e9f0a1b",
            decision: "approved",
        });
        expect(result.success).toBe(true);
        expect(aq.update).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "approved",
                reviewed_by: "admin-1",
                reviewed_at: expect.any(String),
            }),
        );
        // Only pending rows are reviewable (no re-flipping decided rows).
        expect(aq.eq).toHaveBeenCalledWith("status", "pending");
    });

    it("lets the admin reject with a note", async () => {
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "admin-1", email: "admin@test.com" } },
        });
        const result = await reviewExternalShow({
            id: "3b8f0f2e-6f3a-4d2b-9c1e-2a7d8e9f0a1b",
            decision: "rejected",
            note: "Dead link.",
        });
        expect(result.success).toBe(true);
        expect(aq.update).toHaveBeenCalledWith(
            expect.objectContaining({ status: "rejected", review_note: "Dead link." }),
        );
    });

    it("rejects an invalid decision even from the admin", async () => {
        mockClient.auth.getUser.mockResolvedValue({
            data: { user: { id: "admin-1", email: "admin@test.com" } },
        });
        const result = await reviewExternalShow({
            id: "3b8f0f2e-6f3a-4d2b-9c1e-2a7d8e9f0a1b",
            decision: "pending" as never,
        });
        expect(result.success).toBe(false);
        expect(aq.update).not.toHaveBeenCalled();
    });
});
