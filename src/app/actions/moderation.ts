"use server";

import { z } from "zod";
import { requireAuth, requireAdmin, AuthError } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { logger } from "@/lib/logger";
import { NOT_LOGGED_IN, fail, safeError, type ActionResult } from "@/lib/actions/result";
import {
    ADMIN_REPORTS_URL,
    REPORT_DETAILS_MAX,
    REPORT_REASONS,
    REPORT_TARGET_NOUN,
    REPORT_TARGET_TYPES,
    REPORT_TARGET_TYPES_BEFORE_235,
    withArticle,
    type ReportTargetType,
} from "@/lib/moderation/reports";

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
        if (err instanceof AuthError) return fail(NOT_LOGGED_IN);
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

    return (data as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        reporterId: r.reporter_id as string,
        reporterAlias: aliasMap.get(r.reporter_id as string) || "Unknown",
        targetType: r.target_type as string,
        targetId: r.target_id as string,
        reason: r.reason as string,
        details: r.details as string | null,
        status: r.status as string,
        adminNotes: r.admin_notes as string | null,
        createdAt: r.created_at as string,
    }));
}

/** Admin: dismiss a report */
export async function dismissReport(reportId: string, notes?: string): Promise<{ success: boolean; error?: string }> {
    const { user } = await requireAdmin(); // was requireAuth — any user could resolve reports

    const admin = getAdminClient();
    const { error } = await admin
        .from("user_reports")
        .update({
            status: "dismissed",
            admin_notes: notes || "Dismissed — no action needed.",
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
        })
        .eq("id", reportId);

    if (error) return safeError("Moderation", error, "Could not dismiss the report.");
    revalidatePath("/admin");
    return { success: true };
}

/** Admin: action a report (mark as handled) */
export async function actionReport(reportId: string, notes: string): Promise<{ success: boolean; error?: string }> {
    const { user } = await requireAdmin(); // was requireAuth — any user could action reports

    const admin = getAdminClient();
    const { error } = await admin
        .from("user_reports")
        .update({
            status: "actioned",
            admin_notes: notes,
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
        })
        .eq("id", reportId);

    if (error) return safeError("Moderation", error, "Could not save the report.");
    revalidatePath("/admin");
    return { success: true };
}
