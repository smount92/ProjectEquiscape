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

import { AuthError, SUSPENDED_AUTH_ERROR } from "@/lib/auth";
import { resolveReport, submitReport } from "@/app/actions/moderation";
import { ACCOUNT_SUSPENDED, NOT_LOGGED_IN } from "@/lib/actions/result";
import type { FakeQuery } from "@/__tests__/mocks/fakeDb";

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

    it("tells a suspended member they are suspended, not to log in", async () => {
        requireAuth.mockRejectedValueOnce(new AuthError(SUSPENDED_AUTH_ERROR));
        const result = await submitReport({ targetType: "post", targetId: TARGET, reason: "Spam or scam" });
        expect(result).toEqual({ success: false, error: ACCOUNT_SUSPENDED });
        expect(memberDb.queries).toEqual([]);
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

describe("resolveReport (MHH-025)", () => {
    const REPORT = "22222222-2222-4222-8222-222222222222";
    const ADMIN = { id: "admin-1", email: "admin@test.com" };

    const isClaim = (q: FakeQuery) => q.op === "update" && adminDb.filter(q, "eq", "id") === REPORT;

    /**
     * An open report. The claim (update … where id and status open) gets
     * `claimed` back; closing the other reports on the same thing gets
     * `others`.
     */
    function openReport(
        targetType = "post",
        targetId = "p1",
        claimed: { id: string; reporter_id: string }[] = [{ id: REPORT, reporter_id: MEMBER.id }],
        others: { id: string; reporter_id: string }[] = [],
    ) {
        adminDb.on("user_reports", (q) =>
            q.op === "select"
                ? { data: { id: REPORT, target_type: targetType, target_id: targetId, status: "open" }, error: null }
                : isClaim(q)
                  ? { data: claimed, error: null }
                  : { data: others, error: null },
        );
    }

    const notices = () => createNotification.mock.calls.map(([n]) => n as Record<string, unknown>);

    beforeEach(() => {
        requireAdmin.mockResolvedValue({ supabase: adminDb, user: ADMIN });
    });

    it("is for the admin only", async () => {
        requireAdmin.mockRejectedValueOnce(new AuthError("Admin access required."));
        const result = await resolveReport({ reportId: REPORT, decision: "dismiss" });
        expect(result).toEqual({ success: false, error: "Admin access required." });
        expect(adminDb.queries).toEqual([]);
    });

    it("dismisses one report, claimed while open, with a note on the record", async () => {
        openReport();
        const result = await resolveReport({ reportId: REPORT, decision: "dismiss" });
        expect(result).toEqual({ success: true });
        const writes = adminDb.writes("user_reports");
        expect(writes).toHaveLength(1);
        expect(writes[0].payload).toMatchObject({
            status: "dismissed",
            admin_notes: "Dismissed: it doesn't break the rules.",
            resolved_by: ADMIN.id,
        });
        expect(adminDb.filter(writes[0], "eq", "id")).toBe(REPORT);
        expect(adminDb.filter(writes[0], "eq", "status")).toBe("open");
        expect(adminDb.writes("posts")).toEqual([]);
    });

    it("claims the report before taking the content down, then closes every open report on it", async () => {
        openReport("comment", "r1", undefined, [{ id: "other", reporter_id: "rep-2" }]);
        adminDb.on("posts", (q) =>
            q.op === "update"
                ? { data: [{ id: "r1", author_id: "u-author", parent_id: "t1", group_id: null }], error: null }
                : { data: [{ id: "r1", content: "you are all  idiots", author_id: "u-author" }], error: null },
        );
        const result = await resolveReport({ reportId: REPORT, decision: "take_down", note: "Slur in reply" });
        expect(result).toEqual({ success: true });

        const order = adminDb.queries.filter((q) => q.op === "update").map((q) => q.table);
        expect(order[0]).toBe("user_reports"); // the claim comes first
        expect(order).toContain("posts");
        expect(adminDb.writes("posts")[0].payload).toMatchObject({ hidden_by: ADMIN.id });

        const [claim, close] = adminDb.writes("user_reports");
        expect(claim.payload).toMatchObject({ status: "actioned", admin_notes: "Slur in reply" });
        expect(adminDb.filter(close, "eq", "target_type")).toBe("comment");
        expect(adminDb.filter(close, "eq", "target_id")).toBe("r1");
        expect(adminDb.filter(close, "eq", "status")).toBe("open");

        expect(notices()).toContainEqual({
            userId: "u-author",
            type: "moderation",
            content:
                'We hid your reply "you are all idiots" because it breaks our Community Conduct rules (Terms, section 6). If you think we got it wrong, write to us through the contact page.',
            linkUrl: "/contact?category=report",
        });
        expect(notices().map((n) => n.userId)).toEqual(["u-author", MEMBER.id, "rep-2"]);
    });

    it("does nothing, and tells nobody, when someone else closed it first", async () => {
        openReport("post", "p1", []);
        adminDb.on("posts", () => ({ data: [{ id: "p1", author_id: "u1" }], error: null }));
        const result = await resolveReport({ reportId: REPORT, decision: "take_down" });
        expect(result).toEqual({ success: false, error: "This report has already been dealt with." });
        expect(adminDb.writes("posts")).toEqual([]);
        expect(createNotification).not.toHaveBeenCalled();
    });

    it("puts the report back in the queue when the take-down can't happen", async () => {
        openReport("post", "p1");
        adminDb.on("posts", (q) =>
            q.op === "update"
                ? { data: null, error: { code: "42703", message: "column hidden_at does not exist" } }
                : OK,
        );
        const result = await resolveReport({ reportId: REPORT, decision: "take_down" });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/migration 235/);
        const [claim, reopen] = adminDb.writes("user_reports");
        expect(claim.payload).toMatchObject({ status: "actioned" });
        expect(reopen.payload).toEqual({ status: "open", admin_notes: null, resolved_by: null, resolved_at: null });
        expect(adminDb.filter(reopen, "eq", "id")).toBe(REPORT);
        expect(createNotification).not.toHaveBeenCalled();
    });

    it("needs a note to close a report handled another way, and closes every open report on it", async () => {
        openReport("user", MEMBER.id, undefined, [{ id: "other", reporter_id: "rep-2" }]);
        expect(await resolveReport({ reportId: REPORT, decision: "handled" })).toEqual({
            success: false,
            error: "Write a note saying what you did.",
        });
        expect(await resolveReport({ reportId: REPORT, decision: "handled", note: "Suspended for a week" })).toEqual({
            success: true,
        });
        const [claim, close] = adminDb.writes("user_reports");
        expect(claim.payload).toMatchObject({ status: "actioned", admin_notes: "Suspended for a week" });
        expect(adminDb.filter(close, "eq", "target_type")).toBe("user");
        expect(adminDb.filter(close, "eq", "target_id")).toBe(MEMBER.id);
        expect(adminDb.filter(close, "eq", "status")).toBe("open");
        expect(notices().map((n) => n.userId)).toEqual([MEMBER.id, "rep-2"]);
        for (const n of notices()) {
            expect(n.content).toMatch(/We've reviewed your report and closed it\.$/);
            expect(n.content).not.toMatch(/suspend/i);
        }
    });

    it("tells the reporter it doesn't break the rules, naming what they reported (MHH-024)", async () => {
        openReport("horse", "h1");
        adminDb.on("user_horses", () => ({
            data: [{ id: "h1", custom_name: "Bramble", owner_id: "u1" }],
            error: null,
        }));
        await resolveReport({ reportId: REPORT, decision: "dismiss" });
        expect(createNotification).toHaveBeenCalledWith({
            userId: MEMBER.id,
            type: "moderation",
            content:
                "Thank you for reporting that horse. We looked, and it doesn't break our Community Conduct rules (Terms, section 6), so we've left it up.",
        });
    });

    it("tells every reporter 'we removed it', and nothing about the member (MHH-024)", async () => {
        openReport("message", "m1", [{ id: REPORT, reporter_id: "rep-1" }], [{ id: "other", reporter_id: "rep-2" }]);
        adminDb.on("messages", (q) =>
            q.op === "select"
                ? {
                      data: [
                          { id: "m1", kind: "chat", sender_id: "sender-1", conversation_id: null, content: "pay me" },
                      ],
                      error: null,
                  }
                : OK,
        );
        await resolveReport({ reportId: REPORT, decision: "take_down", note: "Threats" });
        const toReporters = notices().filter((n) => String(n.userId).startsWith("rep-"));
        expect(toReporters.map((n) => n.userId)).toEqual(["rep-1", "rep-2"]);
        for (const n of toReporters) {
            expect(n.content).toBe("Thank you for reporting that message. We looked into it and removed it.");
            expect(n.content).not.toMatch(/Threats|sender|suspend/i);
        }
    });

    it("withdraws open offers on a horse it takes down, and tells each buyer plainly", async () => {
        openReport("horse", "h1");
        adminDb.on("user_horses", (q) =>
            q.op === "select" && q.filters.some((f) => f[0] === "in")
                ? { data: [{ id: "h1", custom_name: "Bramble", owner_id: "u-owner" }], error: null }
                : q.op === "select"
                  ? {
                        data: { id: "h1", owner_id: "u-owner", trade_status: "For Sale", moderation_hidden_at: null },
                        error: null,
                    }
                  : OK,
        );
        adminDb.on("transactions", (q) =>
            q.op === "update"
                ? { data: [{ id: "t1", party_b_id: "buyer-1", conversation_id: "c1" }], error: null }
                : { data: [], error: null },
        );
        const result = await resolveReport({ reportId: REPORT, decision: "take_down" });
        expect(result).toEqual({ success: true });
        expect(notices()).toContainEqual({
            userId: "buyer-1",
            type: "offer",
            content: "Your offer on Bramble was withdrawn because the horse is no longer for sale.",
            conversationId: "c1",
            linkUrl: "/inbox/c1",
        });
        const toOwner = notices().find((n) => n.userId === "u-owner");
        expect(toOwner?.content).toMatch(/your horse "Bramble" private.*The open offer on it was withdrawn\./);
    });

    it("won't handle a report twice", async () => {
        adminDb.on("user_reports", () => ({
            data: { id: REPORT, target_type: "post", target_id: "p1", status: "dismissed" },
            error: null,
        }));
        const result = await resolveReport({ reportId: REPORT, decision: "take_down" });
        expect(result).toEqual({ success: false, error: "This report has already been dealt with." });
        expect(adminDb.writes("posts")).toEqual([]);
    });
});
