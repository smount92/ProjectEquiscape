"use server";

/**
 * External shows server actions — the calendar of record's write
 * and read layer (Wave 3).
 *
 * Trust model, in one breath: any member can SUBMIT a listing, only
 * an admin can APPROVE one, and only approved rows ever face the
 * public. Three independent layers enforce "a submitter cannot
 * publish their own listing":
 *   1. this file never sends a status other than 'pending' on
 *      insert (zod strips unknown keys, so a spoofed `status`
 *      field in the input dies at parse),
 *   2. RLS (migration 143) WITH CHECKs status = 'pending' and
 *      submitted_by = auth.uid() on INSERT, and grants clients no
 *      UPDATE policy at all,
 *   3. a BEFORE trigger force-resets the moderation columns for
 *      anon/authenticated roles.
 * Approve/reject run on the service-role client strictly behind
 * requireAdmin().
 *
 * Pre-migration the table doesn't exist: the list reads degrade to
 * empty (the page hides the external layer) and submit returns a
 * friendly error — the app never hard-fails on a missing relation.
 */

import { revalidatePath } from "next/cache";

import { requireAdmin, requireAuth } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/utils/validation";
import {
    firstZodError,
    reviewExternalShowSchema,
    submitExternalShowSchema,
    type ReviewExternalShowInput,
    type SubmitExternalShowInput,
} from "@/lib/external-shows/schemas";
import type { ApprovedExternalShow } from "@/lib/external-shows/calendar";

type ActionResult<T = object> =
    | ({ success: true } & T)
    | { success: false; error: string };

/** A pending row as the admin queue shows it (moderation surface —
 *  includes the submitter, unlike the public read). */
export interface PendingExternalShow {
    id: string;
    title: string;
    url: string;
    venue_type: string;
    host_name: string;
    platform: string;
    starts_on: string;
    entries_close_on: string | null;
    location: string | null;
    description: string;
    submitted_by: string;
    submitter_alias: string;
    created_at: string;
}

/** Missing-table detection (migration 143 not applied yet): the
 *  feature-detect that lets /calendar and /admin render without the
 *  external layer instead of erroring. */
function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    if (error.code === "42P01") return true;
    return /does not exist|schema cache/i.test(error.message ?? "");
}

const DISPLAY_COLUMNS =
    "id, title, url, venue_type, host_name, platform, starts_on, entries_close_on, location, description";

// ── Submit (any member; always lands pending) ──

export async function submitExternalShow(
    input: SubmitExternalShowInput,
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const parsed = submitExternalShowSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const v = parsed.data;

    // Free-text fields are stripped of any markup before storage.
    // The URL is NOT sanitised as text (it's rendered as an href,
    // never as HTML) — its safety comes from the http/https pin in
    // the schema + the DB CHECK + rel="noopener nofollow" at render.
    const { error } = await supabase.from("external_shows").insert({
        title: sanitizeText(v.title),
        url: v.url,
        venue_type: v.venueType,
        host_name: sanitizeText(v.hostName),
        platform: v.platform,
        starts_on: v.startsOn,
        entries_close_on: v.entriesCloseOn ?? null,
        location: v.location ? sanitizeText(v.location) : null,
        description: v.description ? sanitizeText(v.description) : "",
        submitted_by: user.id,
        // Layer 1 of three: the action never sends anything else.
        status: "pending",
    });

    if (error) {
        if (isMissingRelation(error)) {
            return {
                success: false,
                error: "The calendar isn't accepting community listings quite yet — please try again soon.",
            };
        }
        return { success: false, error: error.message };
    }

    revalidatePath("/admin");
    return { success: true };
}

// ── Public read (anon-safe; RLS shows approved rows only) ──

export async function listApprovedExternalShows(): Promise<
    ActionResult<{ shows: ApprovedExternalShow[] }>
> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("external_shows")
        .select(DISPLAY_COLUMNS)
        .eq("status", "approved")
        .order("starts_on", { ascending: true })
        .limit(500);

    if (error) {
        // Pre-migration (or any read failure): the calendar simply
        // renders without the external layer rather than 500ing a
        // public SEO page.
        if (isMissingRelation(error)) return { success: true, shows: [] };
        return { success: false, error: error.message };
    }
    return { success: true, shows: (data ?? []) as unknown as ApprovedExternalShow[] };
}

// ── Admin: moderation queue ──

export async function listPendingExternalShows(): Promise<
    ActionResult<{ shows: PendingExternalShow[] }>
> {
    try {
        await requireAdmin();
    } catch {
        return { success: false, error: "Admin access required." };
    }

    const admin = getAdminClient();
    const { data, error } = await admin
        .from("external_shows")
        .select(`${DISPLAY_COLUMNS}, submitted_by, created_at`)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(100);

    if (error) {
        if (isMissingRelation(error)) return { success: true, shows: [] };
        return { success: false, error: error.message };
    }

    const rows = (data ?? []) as unknown as Omit<PendingExternalShow, "submitter_alias">[];

    // Two-step alias enrich (FK chains to users; house pattern).
    const aliasById = new Map<string, string>();
    const submitterIds = [...new Set(rows.map((r) => r.submitted_by))];
    if (submitterIds.length > 0) {
        const { data: users } = await admin
            .from("users")
            .select("id, alias_name")
            .in("id", submitterIds);
        for (const u of (users ?? []) as { id: string; alias_name: string }[]) {
            aliasById.set(u.id, u.alias_name);
        }
    }

    return {
        success: true,
        shows: rows.map((r) => ({
            ...r,
            submitter_alias: aliasById.get(r.submitted_by) ?? "Unknown",
        })),
    };
}

// ── Admin: approve / reject ──

export async function reviewExternalShow(
    input: ReviewExternalShowInput,
): Promise<ActionResult> {
    let adminUserId: string;
    try {
        const { user } = await requireAdmin();
        adminUserId = user.id;
    } catch {
        return { success: false, error: "Admin access required." };
    }

    const parsed = reviewExternalShowSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { id, decision, note } = parsed.data;

    // Service-role write: clients have no UPDATE policy on this
    // table at all (migration 143) — moderation state can ONLY
    // change through this admin-gated path.
    const admin = getAdminClient();
    const { error } = await admin
        .from("external_shows")
        .update({
            status: decision,
            review_note: note ? sanitizeText(note) : null,
            reviewed_by: adminUserId,
            reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending");

    if (error) return { success: false, error: error.message };

    revalidatePath("/calendar");
    revalidatePath("/admin");
    return { success: true };
}
