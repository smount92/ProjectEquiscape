import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb, OK } from "@/__tests__/mocks/fakeDb";

const memberDb = fakeDb();
const adminDb = fakeDb();

const { requireAuth, requireAdmin, checkRateLimit } = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    requireAdmin: vi.fn(),
    checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/auth")>()),
    requireAuth,
    requireAdmin,
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => adminDb }));
vi.mock("@/lib/utils/rateLimit", () => ({ checkRateLimit }));

const { createNotification, adminNotificationTargets } = vi.hoisted(() => ({
    createNotification: vi.fn(),
    adminNotificationTargets: vi.fn(),
}));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification }));
vi.mock("@/lib/notifications/adminTargets", () => ({ adminNotificationTargets }));

import { AuthError } from "@/lib/auth";
import { submitReport } from "@/app/actions/moderation";
import { NOT_LOGGED_IN } from "@/lib/actions/result";

const TARGET = "3b8f0f2e-6f3a-4d2b-9c1e-2a7d8e9f0a1b";
const MEMBER = { id: "11111111-1111-4111-8111-111111111111", email: "member@test.com" };

beforeEach(() => {
    vi.clearAllMocks();
    memberDb.reset();
    adminDb.reset();
    requireAuth.mockResolvedValue({ supabase: memberDb, user: MEMBER });
    requireAdmin.mockRejectedValue(new AuthError("Admin access required."));
    checkRateLimit.mockResolvedValue(true);
    createNotification.mockResolvedValue(undefined);
    adminNotificationTargets.mockResolvedValue(["admin-1"]);
});

describe("submitReport", () => {
    it("asks a logged-out visitor to log in instead of crashing", async () => {
        requireAuth.mockRejectedValueOnce(new AuthError());
        const result = await submitReport({ targetType: "post", targetId: TARGET, reason: "Spam or scam" });
        expect(result).toEqual({ success: false, error: NOT_LOGGED_IN });
    });

    it("files every kind of content with its type", async () => {
        for (const targetType of ["post", "comment", "message", "show_entry", "id_request", "id_suggestion"] as const) {
            const result = await submitReport({ targetType, targetId: TARGET, reason: "Other", details: " why " });
            expect(result).toEqual({ success: true });
        }
        const inserts = memberDb.writes("user_reports");
        expect(inserts.map((q) => (q.payload as { target_type: string }).target_type)).toEqual([
            "post",
            "comment",
            "message",
            "show_entry",
            "id_request",
            "id_suggestion",
        ]);
        expect(inserts[0].payload).toEqual({
            reporter_id: MEMBER.id,
            target_type: "post",
            target_id: TARGET,
            reason: "Other",
            details: "why",
        });
    });

    it("refuses an unknown type, reason or id before touching the database", async () => {
        const bad = [
            { targetType: "listing", targetId: TARGET, reason: "Other" },
            { targetType: "post", targetId: TARGET, reason: "I just don't like it" },
            { targetType: "post", targetId: "not-an-id", reason: "Other" },
        ];
        for (const input of bad) {
            const result = await submitReport(input as Parameters<typeof submitReport>[0]);
            expect(result.success).toBe(false);
        }
        expect(memberDb.queries).toEqual([]);
    });

    it("won't let a member report themselves", async () => {
        const result = await submitReport({ targetType: "user", targetId: MEMBER.id, reason: "Other" });
        expect(result).toEqual({ success: false, error: "You cannot report yourself." });
        expect(memberDb.writes("user_reports")).toEqual([]);
    });

    it("says so plainly when the member already reported it", async () => {
        memberDb.on("user_reports", () => ({ data: null, error: { code: "23505", message: "duplicate key" } }));
        const result = await submitReport({ targetType: "post", targetId: TARGET, reason: "Other" });
        expect(result).toEqual({ success: false, error: "You've already reported this. We'll take a look." });
    });

    it("explains, without database words, when a new kind isn't switched on yet (before 235)", async () => {
        memberDb.on("user_reports", () => ({
            data: null,
            error: { code: "23514", message: 'violates check constraint "user_reports_target_type_check"' },
        }));
        const result = await submitReport({ targetType: "show_entry", targetId: TARGET, reason: "Other" });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toMatch(/isn't switched on yet/);
            expect(result.error).not.toMatch(/constraint/);
        }
    });

    it("is rate-limited", async () => {
        checkRateLimit.mockResolvedValueOnce(false);
        const result = await submitReport({ targetType: "post", targetId: TARGET, reason: "Other" });
        expect(result).toEqual({ success: false, error: "Too many reports. Please try again later." });
        expect(memberDb.writes("user_reports")).toEqual([]);
    });

    it("writes nothing else on success", async () => {
        memberDb.on("user_reports", () => OK);
        await submitReport({ targetType: "horse", targetId: TARGET, reason: "Fake listing or misrepresentation" });
        expect(memberDb.queries.map((q) => q.table)).toEqual(["user_reports"]);
    });
});

describe("submitReport rings the admin bell (MHH-021)", () => {
    it("tells every admin what was reported, linking to the Reports tab", async () => {
        adminNotificationTargets.mockResolvedValueOnce(["admin-1", "admin-2"]);
        await submitReport({ targetType: "show_entry", targetId: TARGET, reason: "Inappropriate content" });
        expect(createNotification).toHaveBeenCalledTimes(2);
        expect(createNotification).toHaveBeenCalledWith({
            userId: "admin-1",
            type: "system",
            actorId: MEMBER.id,
            content: '🚩 New report: a show entry — "Inappropriate content"',
            linkUrl: "/admin?tab=reports",
        });
    });

    it("doesn't ring when the report wasn't filed", async () => {
        memberDb.on("user_reports", () => ({ data: null, error: { code: "23505", message: "duplicate" } }));
        await submitReport({ targetType: "post", targetId: TARGET, reason: "Other" });
        expect(createNotification).not.toHaveBeenCalled();
    });

    it("files the report even when the bell fails", async () => {
        adminNotificationTargets.mockRejectedValueOnce(new Error("users table unreachable"));
        const result = await submitReport({ targetType: "post", targetId: TARGET, reason: "Other" });
        expect(result).toEqual({ success: true });
    });
});
