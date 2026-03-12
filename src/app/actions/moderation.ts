"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/utils/rateLimit";

// ============================================================
// COMMUNITY MODERATION — Server Actions
// ============================================================

const REPORT_REASONS = [
    "Spam or scam",
    "Harassment or bullying",
    "Inappropriate content",
    "Fake listing or misrepresentation",
    "Copyright violation",
    "Other",
] as const;

/** Get report reasons (wraps constant in async fn for server action export) */
export async function getReportReasons() {
    return [...REPORT_REASONS];
}

/** Submit a report (rate-limited: 10/hour) */
export async function submitReport(data: {
    targetType: "post" | "horse" | "user" | "comment" | "message";
    targetId: string;
    reason: string;
    details?: string;
}): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    // Rate limit
    const allowed = await checkRateLimit(`report:${user.id}`, 10, 60, user.id);
    if (!allowed) return { success: false, error: "Too many reports. Please try again later." };

    // Can't report yourself
    if (data.targetType === "user" && data.targetId === user.id) {
        return { success: false, error: "You cannot report yourself." };
    }

    const { error } = await supabase.from("user_reports").insert({
        reporter_id: user.id,
        target_type: data.targetType,
        target_id: data.targetId,
        reason: data.reason,
        details: data.details?.trim() || null,
    });

    if (error) {
        if (error.code === "23505") return { success: false, error: "You've already reported this." };
        return { success: false, error: error.message };
    }

    return { success: true };
}

/** Admin: get open reports */
export async function getOpenReports() {
    const admin = getAdminClient();

    const { data } = await admin
        .from("user_reports")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);

    if (!data || data.length === 0) return [];

    // Fetch reporter aliases separately
    const reporterIds = [...new Set((data as { reporter_id: string }[]).map(r => r.reporter_id))];
    const { data: users } = await admin
        .from("users")
        .select("id, alias_name")
        .in("id", reporterIds);

    const aliasMap = new Map<string, string>();
    for (const u of (users || []) as { id: string; alias_name: string }[]) {
        aliasMap.set(u.id, u.alias_name);
    }

    return (data as Record<string, unknown>[]).map(r => ({
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
export async function dismissReport(
    reportId: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

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

    if (error) return { success: false, error: error.message };
    revalidatePath("/admin");
    return { success: true };
}

/** Admin: action a report (mark as handled) */
export async function actionReport(
    reportId: string,
    notes: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

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

    if (error) return { success: false, error: error.message };
    revalidatePath("/admin");
    return { success: true };
}
