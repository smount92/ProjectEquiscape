import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabaseClient, createMockAdminClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();
const mockAdmin = createMockAdminClient();
const q = mockClient._mockQuery as Record<string, ReturnType<typeof vi.fn>>;
const aq = mockAdmin._mockQuery as Record<string, ReturnType<typeof vi.fn>>;

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => mockAdmin),
}));
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));
vi.mock("@/lib/notifications/createNotification", () => ({
    createNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
    barEntrant,
    publishClassResults,
    strikeEntryFromResults,
    voidCard,
    writeCritique,
} from "@/app/actions/shows-v4";
import { createNotification } from "@/lib/notifications/createNotification";

const SHOW_ID = "6b2e0d3c-1111-4444-8888-aaaaaaaaaaaa";
const USER_ID = "6b2e0d3c-2222-4444-8888-bbbbbbbbbbbb";
const ENTRY_ID = "6b2e0d3c-3333-4444-8888-cccccccccccc";
const CLASS_ID = "6b2e0d3c-4444-4444-8888-dddddddddddd";
const CARD_CODE = "AbCd2345";

function signInAs(userId: string) {
    mockClient.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: "t@t.test" } },
    });
}

/** getShowRole reads: shows row, then (if not host) show_staff row. */
function stubRole(input: {
    hostId: string;
    status?: string;
    staffRole?: string | null;
}) {
    q.maybeSingle.mockResolvedValueOnce({
        data: {
            id: SHOW_ID,
            host_id: input.hostId,
            status: input.status ?? "entries_open",
            mode: "online",
            judging: "judged",
        },
        error: null,
    });
    if (input.staffRole !== undefined) {
        q.maybeSingle.mockResolvedValueOnce({
            data: input.staffRole === null ? null : { role: input.staffRole },
            error: null,
        });
    }
}

beforeEach(() => {
    vi.clearAllMocks();
    q.maybeSingle.mockReset();
    q.maybeSingle.mockResolvedValue({ data: null, error: null });
    aq.maybeSingle.mockReset();
    aq.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockClient._setImplicitResolve({ data: [], error: null });
    mockAdmin._setImplicitResolve({ data: [], error: null });
});

describe("barEntrant", () => {
    it("host bars an entrant and staff-scratches their live entries", async () => {
        signInAs("host-1");
        stubRole({ hostId: "host-1" });
        mockClient._setImplicitResolve({ data: [{ id: ENTRY_ID }], error: null });

        const result = await barEntrant({ showId: SHOW_ID, userId: USER_ID, reason: "troll entries" });
        expect(result).toEqual({ success: true });
        expect(q.insert).toHaveBeenCalledWith(
            expect.objectContaining({ show_id: SHOW_ID, user_id: USER_ID, barred_by: "host-1" }),
        );
        expect(q.update).toHaveBeenCalledWith(
            expect.objectContaining({ status: "scratched" }),
        );
        expect(createNotification).toHaveBeenCalledWith(
            expect.objectContaining({ userId: USER_ID, type: "show_moderation" }),
        );
    });

    it("refuses a non-staff caller", async () => {
        signInAs("random-user");
        stubRole({ hostId: "host-1", staffRole: null });

        const result = await barEntrant({ showId: SHOW_ID, userId: USER_ID });
        expect(result.success).toBe(false);
        expect(q.insert).not.toHaveBeenCalled();
    });

    it("refuses a steward (bar is host/co-host only)", async () => {
        signInAs("steward-1");
        stubRole({ hostId: "host-1", staffRole: "steward" });

        const result = await barEntrant({ showId: SHOW_ID, userId: USER_ID });
        expect(result.success).toBe(false);
    });

    it("host cannot bar themself", async () => {
        signInAs("host-1");
        stubRole({ hostId: "host-1" });

        const result = await barEntrant({ showId: SHOW_ID, userId: "host-1" });
        expect(result.success).toBe(false);
        expect(q.insert).not.toHaveBeenCalled();
    });

    it("scratchEntries: false bars without touching entries", async () => {
        signInAs("host-1");
        stubRole({ hostId: "host-1" });

        const result = await barEntrant({
            showId: SHOW_ID,
            userId: USER_ID,
            scratchEntries: false,
        });
        expect(result).toEqual({ success: true });
        expect(q.update).not.toHaveBeenCalled();
    });
});

describe("voidCard", () => {
    it("host voids an issued card with the audit trail", async () => {
        signInAs("host-1");
        // card read → role reads
        q.maybeSingle.mockResolvedValueOnce({
            data: { id: CARD_CODE, show_id: SHOW_ID, status: "issued" },
            error: null,
        });
        stubRole({ hostId: "host-1" });

        const result = await voidCard({ code: CARD_CODE, reason: "AI-generated entry" });
        expect(result).toEqual({ success: true });
        expect(q.update).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "void",
                voided_by: "host-1",
                void_reason: "AI-generated entry",
            }),
        );
    });

    it("refuses to void a redeemed card (state machine)", async () => {
        signInAs("host-1");
        q.maybeSingle.mockResolvedValueOnce({
            data: { id: CARD_CODE, show_id: SHOW_ID, status: "redeemed" },
            error: null,
        });
        stubRole({ hostId: "host-1" });

        const result = await voidCard({ code: CARD_CODE, reason: "some reason" });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain("redeemed");
        expect(q.update).not.toHaveBeenCalled();
    });

    it("refuses a non-staff, non-admin caller", async () => {
        signInAs("random-user");
        q.maybeSingle.mockResolvedValueOnce({
            data: { id: CARD_CODE, show_id: SHOW_ID, status: "issued" },
            error: null,
        });
        stubRole({ hostId: "host-1", staffRole: null });

        const result = await voidCard({ code: CARD_CODE, reason: "some reason" });
        expect(result.success).toBe(false);
        expect(q.update).not.toHaveBeenCalled();
    });

    it("rejects malformed card codes at the schema", async () => {
        const result = await voidCard({ code: "not-a-code!", reason: "some reason" });
        expect(result.success).toBe(false);
    });
});

describe("strikeEntryFromResults", () => {
    function stubEntryRead(status = "entered") {
        q.maybeSingle.mockResolvedValueOnce({
            data: {
                id: ENTRY_ID,
                show_id: SHOW_ID,
                class_id: CLASS_ID,
                horse_id: "horse-1",
                owner_id: USER_ID,
                status,
            },
            error: null,
        });
    }

    it("host strikes after publish: voids card, deletes placing + platform records, scratches", async () => {
        signInAs("host-1");
        stubEntryRead();
        stubRole({ hostId: "host-1", status: "completed" });
        aq.maybeSingle.mockResolvedValueOnce({
            data: { id: CARD_CODE, status: "issued" },
            error: null,
        });

        const result = await strikeEntryFromResults({ entryId: ENTRY_ID, reason: "troll placing" });
        expect(result).toEqual({ success: true });
        expect(aq.update).toHaveBeenCalledWith(
            expect.objectContaining({ status: "void" }),
        );
        expect(aq.delete).toHaveBeenCalledTimes(2); // placing + records
        expect(aq.update).toHaveBeenCalledWith(
            expect.objectContaining({ status: "scratched" }),
        );
    });

    it("refuses while the show is still judging (scratch instead)", async () => {
        signInAs("host-1");
        stubEntryRead();
        stubRole({ hostId: "host-1", status: "judging" });

        const result = await strikeEntryFromResults({ entryId: ENTRY_ID, reason: "some reason" });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain("scratch");
        expect(aq.delete).not.toHaveBeenCalled();
    });

    it("refuses a non-staff caller", async () => {
        signInAs("random-user");
        stubEntryRead();
        stubRole({ hostId: "host-1", status: "completed", staffRole: null });

        const result = await strikeEntryFromResults({ entryId: ENTRY_ID, reason: "some reason" });
        expect(result.success).toBe(false);
        expect(aq.delete).not.toHaveBeenCalled();
    });
});

describe("writeCritique", () => {
    function stubEntryRead(status = "entered") {
        q.maybeSingle.mockResolvedValueOnce({
            data: { id: ENTRY_ID, show_id: SHOW_ID, status },
            error: null,
        });
    }

    it("judge writes model + photo critique during judging", async () => {
        signInAs("judge-1");
        stubEntryRead();
        stubRole({ hostId: "host-1", status: "judging", staffRole: "judge" });

        const result = await writeCritique({
            entryId: ENTRY_ID,
            critique: "Lovely topline; shade the muzzle next time.",
            photoCritique: "Slightly low angle — shoot at barrel height.",
        });
        expect(result).toEqual({ success: true });
        expect(q.update).toHaveBeenCalledWith(
            expect.objectContaining({
                critique_text: "Lovely topline; shade the muzzle next time.",
                critique_photo_text: "Slightly low angle — shoot at barrel height.",
                critique_by: "judge-1",
            }),
        );
    });

    it("refuses a steward", async () => {
        signInAs("steward-1");
        stubEntryRead();
        stubRole({ hostId: "host-1", status: "judging", staffRole: "steward" });

        const result = await writeCritique({ entryId: ENTRY_ID, critique: "nice" });
        expect(result.success).toBe(false);
    });

    it("refuses outside judging/results_review", async () => {
        signInAs("host-1");
        stubEntryRead();
        stubRole({ hostId: "host-1", status: "entries_open" });

        const result = await writeCritique({ entryId: ENTRY_ID, critique: "nice" });
        expect(result.success).toBe(false);
    });

    it("refuses critique on a scratched entry", async () => {
        signInAs("host-1");
        stubEntryRead("scratched");

        const result = await writeCritique({ entryId: ENTRY_ID, critique: "nice" });
        expect(result.success).toBe(false);
    });

    it("requires at least one critique field (schema)", async () => {
        const result = await writeCritique({ entryId: ENTRY_ID });
        expect(result.success).toBe(false);
    });
});

describe("publishClassResults", () => {
    function stubClassRead(status = "placed") {
        q.maybeSingle.mockResolvedValueOnce({
            data: {
                id: CLASS_ID,
                status,
                show_sections: { show_divisions: { show_id: SHOW_ID } },
            },
            error: null,
        });
    }

    it("host publishes a placed class (rolling reveal)", async () => {
        signInAs("host-1");
        stubClassRead("placed");
        stubRole({ hostId: "host-1", status: "judging" });

        const result = await publishClassResults({ classId: CLASS_ID });
        expect(result).toEqual({ success: true });
        expect(q.update).toHaveBeenCalledWith(
            expect.objectContaining({ results_published_at: expect.any(String) }),
        );
    });

    it("refuses to publish an unplaced class", async () => {
        signInAs("host-1");
        stubClassRead("judging");
        stubRole({ hostId: "host-1", status: "judging" });

        const result = await publishClassResults({ classId: CLASS_ID });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain("Place the class");
    });

    it("refuses a judge (publish is host/co-host)", async () => {
        signInAs("judge-1");
        stubClassRead("placed");
        stubRole({ hostId: "host-1", staffRole: "judge" });

        const result = await publishClassResults({ classId: CLASS_ID });
        expect(result.success).toBe(false);
    });
});
