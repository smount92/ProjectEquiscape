"use server";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuth, requireAdmin, AuthError, SUSPENDED_AUTH_ERROR } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { logger } from "@/lib/logger";
import { ACCOUNT_SUSPENDED, NOT_LOGGED_IN, fail, safeError, type ActionResult } from "@/lib/actions/result";
import {
    ADMIN_REPORTS_URL,
    REPORT_CONTACT_URL,
    REPORT_DETAILS_MAX,
    REPORT_REASONS,
    REPORT_TAKE_DOWN_LABEL,
    REPORT_TARGET_NOUN,
    REPORT_TARGET_TYPES,
    REPORT_TARGET_TYPES_BEFORE_235,
    TAKE_DOWN_APPEAL,
    isReportTargetType,
    reportOutcomeNotice,
    takeDownNotice,
    withArticle,
    type ReportTargetType,
} from "@/lib/moderation/reports";
import {
    describeReportTargets,
    takeDownReportedContent,
    targetKey,
    type WithdrawnOffer,
} from "@/lib/moderation/reportTargets";

// ============================================================
// COMMUNITY MODERATION — Server Actions
// The vocabulary (what can be reported, the reasons) lives in
// src/lib/moderation/reports.ts.
// ============================================================

/** Postgres check_violation: the database doesn't accept this target type yet. */
const CHECK_VIOLATION = "23514";
/** Postgres unique_violation: this member already has an open report on it. */
const UNIQUE_VIOLATION = "23505";

/** Get report reasons (wraps the constant in an async fn for server action export) */
export async function getReportReasons() {
    return [...REPORT_REASONS];
}

const submitReportSchema = z.object({
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetId: z.uuid(),
    reason: z.enum(REPORT_REASONS),
    details: z.string().max(REPORT_DETAILS_MAX).optional(),
});

/** Submit a report (rate-limited: 10/hour) */
export async function submitReport(data: {
    targetType: ReportTargetType;
    targetId: string;
    reason: string;
    details?: string;
}): Promise<ActionResult> {
    const parsed = submitReportSchema.safeParse(data);
    if (!parsed.success) return fail("Please pick a reason for the report.");
    const input = parsed.data;

    let auth: Awaited<ReturnType<typeof requireAuth>>;
    try {
        auth = await requireAuth();
    } catch (err) {
        if (err instanceof AuthError) {
            return fail(err.message === SUSPENDED_AUTH_ERROR ? ACCOUNT_SUSPENDED : NOT_LOGGED_IN);
        }
        throw err;
    }
    const { supabase, user } = auth;

    const allowed = await checkRateLimit(`report:${user.id}`, 10, 60, user.id);
    if (!allowed) return fail("Too many reports. Please try again later.");

    if (input.targetType === "user" && input.targetId === user.id) {
        return fail("You cannot report yourself.");
    }

    const { error } = await supabase.from("user_reports").insert({
        reporter_id: user.id,
        target_type: input.targetType,
        target_id: input.targetId,
        reason: input.reason,
        details: input.details?.trim() || null,
    });

    if (error) {
        if (error.code === UNIQUE_VIOLATION) return fail("You've already reported this. We'll take a look.");
        if (error.code === CHECK_VIOLATION && !REPORT_TARGET_TYPES_BEFORE_235.includes(input.targetType)) {
            return safeError(
                "Moderation",
                error,
                "Reporting this isn't switched on yet. Please tell us through the contact page for now.",
            );
        }
        return safeError("Moderation", error, "Your report didn't send. Please try again.");
    }

    await ringAdminBell(user.id, input.targetType, input.reason);
    return { success: true };
}

/**
 * Tell the admin a report came in (MHH-021), linking straight to the
 * Reports tab. Best effort: the report is filed whether or not the bell
 * rings, and a failure here never reaches the member.
 */
async function ringAdminBell(reporterId: string, targetType: ReportTargetType, reason: string): Promise<void> {
    try {
        const { createNotification } = await import("@/lib/notifications/createNotification");
        const { adminNotificationTargets } = await import("@/lib/notifications/adminTargets");
        const adminIds = await adminNotificationTargets(getAdminClient());
        const content = `🚩 New report: ${withArticle(REPORT_TARGET_NOUN[targetType])} — "${reason}"`;
        for (const userId of adminIds) {
            await createNotification({
                userId,
                type: "system",
                actorId: reporterId,
                content,
                linkUrl: ADMIN_REPORTS_URL,
            });
        }
    } catch (err) {
        logger.error("Moderation", "Admin report notification failed (the report stands)", err);
    }
}

/** Admin: get open reports */
export async function getOpenReports() {
    await requireAdmin(); // moderation queue leaks reporter identities — admin only
    const admin = getAdminClient();

    const { data } = await admin
        .from("user_reports")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);

    if (!data || data.length === 0) return [];

    // Fetch reporter aliases separately
    const reporterIds = [...new Set((data as { reporter_id: string }[]).map((r) => r.reporter_id))];
    const { data: users } = await admin.from("users").select("id, alias_name").in("id", reporterIds);

    const aliasMap = new Map<string, string>();
    for (const u of (users || []) as { id: string; alias_name: string }[]) {
        aliasMap.set(u.id, u.alias_name);
    }

    const rows = data as Record<string, unknown>[];

    // What each report is about: a summary, a link, who made it, and what
    // can be done about it — so the card can act without hunting.
    const views = await describeReportTargets(
        moderationDb(),
        rows.map((r) => ({ targetType: r.target_type as string, targetId: r.target_id as string })),
    );

    return rows.map((r) => ({
        id: r.id as string,
        reporterId: r.reporter_id as string,
        reporterAlias: aliasMap.get(r.reporter_id as string) || "Unknown",
        targetType: r.target_type as string,
        targetId: r.target_id as string,
        target: views.get(targetKey(r.target_type as string, r.target_id as string)) ?? null,
        reason: r.reason as string,
        details: r.details as string | null,
        status: r.status as string,
        adminNotes: r.admin_notes as string | null,
        createdAt: r.created_at as string,
    }));
}

export type OpenReport = Awaited<ReturnType<typeof getOpenReports>>[number];

/**
 * The service-role client, untyped for the moderation helpers (they touch
 * hidden_at, which postdates the generated types). Every caller in this
 * file is behind requireAdmin().
 */
function moderationDb(): SupabaseClient {
    return getAdminClient() as unknown as SupabaseClient;
}

const resolveReportSchema = z.object({
    reportId: z.uuid(),
    /**
     * dismiss: it doesn't break the rules.
     * take_down: hide / remove / make private / scratch the content.
     * handled: dealt with another way (a word with the member, a suspension).
     */
    decision: z.enum(["dismiss", "take_down", "handled"]),
    note: z.string().trim().max(1000).optional(),
});

/**
 * Admin: close a report, and act on it when asked. The one way a report
 * leaves the queue, so every outcome records a note and a status
 * ('dismissed' or 'actioned').
 *
 * The report is claimed first (closed only if it is still open), so two
 * admins, or two clicks, can't both act on it and send the notices twice.
 * If the take-down then fails, the claim is undone and the report stays
 * in the queue.
 *
 * A take-down, or a report dealt with another way, closes every open report
 * on the same content, since they were all about the thing now dealt with.
 * "Doesn't break the rules" closes just this one.
 */
export async function resolveReport(input: z.input<typeof resolveReportSchema>): Promise<ActionResult> {
    let adminId: string;
    try {
        adminId = (await requireAdmin()).user.id;
    } catch (err) {
        if (err instanceof AuthError) return fail("Admin access required.");
        throw err;
    }
    const parsed = resolveReportSchema.safeParse(input);
    if (!parsed.success) return fail("That report action isn't recognised.");
    const { reportId, decision } = parsed.data;
    const note = parsed.data.note || undefined;
    if (decision === "handled" && !note) return fail("Write a note saying what you did.");

    const db = moderationDb();
    const { data: report, error: readError } = await db
        .from("user_reports")
        .select("id, target_type, target_id, status")
        .eq("id", reportId)
        .maybeSingle();
    if (readError) return safeError("Moderation", readError, "Could not load the report.");
    const r = report as { target_type: string; target_id: string; status: string } | null;
    if (!r) return fail("That report no longer exists.");
    if (r.status !== "open") return fail(ALREADY_DEALT_WITH);

    const targetType = isReportTargetType(r.target_type) ? r.target_type : null;
    if (decision === "take_down" && !targetType) return fail("This kind of report can't be taken down from here.");

    // What the notices call it, read before a take-down changes it.
    const name = targetType
        ? ((await describeReportTargets(db, [{ targetType, targetId: r.target_id }])).get(
              targetKey(targetType, r.target_id),
          )?.name ?? null)
        : null;

    const closing = {
        status: decision === "dismiss" ? "dismissed" : "actioned",
        admin_notes:
            note ??
            (decision === "dismiss"
                ? "Dismissed: it doesn't break the rules."
                : `Taken down: ${targetType ? REPORT_TAKE_DOWN_LABEL[targetType] : "content"}.`),
        resolved_by: adminId,
        resolved_at: new Date().toISOString(),
    };

    // 1. Claim it: only an open report can be closed, and only once.
    const { data: claimed, error: claimError } = await db
        .from("user_reports")
        .update(closing)
        .eq("id", reportId)
        .eq("status", "open")
        .select("id, reporter_id");
    if (claimError) return safeError("Moderation", claimError, "Could not close the report.");
    if (((claimed ?? []) as unknown[]).length === 0) return fail(ALREADY_DEALT_WITH);

    // 2. Act on it.
    let ownerId: string | null = null;
    let withdrawnOffers: WithdrawnOffer[] = [];
    if (decision === "take_down" && targetType) {
        const done = await takeDownReportedContent(db, targetType, r.target_id, adminId);
        if (!done.success) {
            await reopen(db, reportId, adminId);
            return done;
        }
        ownerId = done.ownerId;
        withdrawnOffers = done.withdrawnOffers;
    }

    // 3. Close the other open reports on the same thing.
    let others: unknown[] = [];
    if (decision !== "dismiss") {
        const { data, error } = await db
            .from("user_reports")
            .update(closing)
            .eq("status", "open")
            .eq("target_type", r.target_type)
            .eq("target_id", r.target_id)
            .select("id, reporter_id");
        if (error) logger.error("Moderation", "Closing the other reports on the same thing failed", error);
        others = (data ?? []) as unknown[];
    }

    // 4. Tell the people involved.
    if (decision === "take_down" && ownerId && targetType) {
        await tellTheOwner(ownerId, targetType, name, withdrawnOffers.length);
    }
    if (withdrawnOffers.length > 0) await tellTheBuyers(withdrawnOffers, name);
    const reporters = [
        ...new Set(
            ([...((claimed ?? []) as unknown[]), ...others] as { reporter_id: string | null }[])
                .map((c) => c.reporter_id)
                .filter(Boolean),
        ),
    ] as string[];
    await tellTheReporters(reporters, reportOutcomeNotice(decision, targetType, name));

    revalidatePath("/admin");
    return { success: true };
}

const ALREADY_DEALT_WITH = "This report has already been dealt with.";

/** Put a claimed report back in the queue when its take-down didn't happen. */
async function reopen(db: SupabaseClient, reportId: string, adminId: string): Promise<void> {
    const { error } = await db
        .from("user_reports")
        .update({ status: "open", admin_notes: null, resolved_by: null, resolved_at: null })
        .eq("id", reportId)
        .eq("resolved_by", adminId);
    if (error) logger.error("Moderation", `Report ${reportId} could not be reopened after a failed take-down`, error);
}

/**
 * Everyone who reported it hears the outcome (MHH-024), in words that say
 * what happened to the content and nothing about anyone.
 */
async function tellTheReporters(reporterIds: string[], content: string): Promise<void> {
    if (reporterIds.length === 0) return;
    try {
        const { createNotification } = await import("@/lib/notifications/createNotification");
        for (const userId of reporterIds) {
            await createNotification({ userId, type: "moderation", content });
        }
    } catch (err) {
        logger.error("Moderation", "Report outcome notice failed (the report is closed)", err);
    }
}

/** The member whose content came down hears it from us, naming it, with a way to reply. */
async function tellTheOwner(
    ownerId: string,
    targetType: ReportTargetType,
    name: string | null,
    withdrawnOffers: number,
): Promise<void> {
    const notice = takeDownNotice(targetType, name);
    if (!notice) return;
    const offers =
        withdrawnOffers > 0
            ? ` The ${withdrawnOffers === 1 ? "open offer on it was" : `${withdrawnOffers} open offers on it were`} withdrawn.`
            : "";
    try {
        const { createNotification } = await import("@/lib/notifications/createNotification");
        await createNotification({
            userId: ownerId,
            type: "moderation",
            content: `${notice}${offers} ${TAKE_DOWN_APPEAL}`,
            linkUrl: REPORT_CONTACT_URL,
        });
    } catch (err) {
        logger.error("Moderation", "Take-down notice failed (the take-down stands)", err);
    }
}

/**
 * A buyer whose open offer was withdrawn by a take-down hears it plainly,
 * linking to the conversation. Nothing about why: that is between the
 * seller and us.
 */
async function tellTheBuyers(offers: WithdrawnOffer[], horseName: string | null): Promise<void> {
    try {
        const { createNotification } = await import("@/lib/notifications/createNotification");
        for (const o of offers) {
            await createNotification({
                userId: o.buyerId,
                type: "offer",
                content: `Your offer on ${horseName ?? "a horse"} was withdrawn because the horse is no longer for sale.`,
                ...(o.conversationId
                    ? { conversationId: o.conversationId, linkUrl: `/inbox/${o.conversationId}` }
                    : {}),
            });
        }
    } catch (err) {
        logger.error("Moderation", "Withdrawn-offer notice failed (the offer is withdrawn)", err);
    }
}
