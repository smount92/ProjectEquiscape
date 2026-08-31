"use server";

/**
 * Shows v4 server actions — safety-native showing + the class room.
 *
 * Follows the shows-v2 contract: zod-parse → requireAuth → explicit
 * role check → { success, error? }. RLS-first on the user client;
 * the TWO admin-client uses in this file are documented at the call
 * sites (strike-from-results must delete platform records the host
 * cannot reach under owner-scoped RLS, and admin void of a card the
 * admin has no card-people row for).
 *
 * Targets migration 148 (owner applies manually). Nothing here is
 * reachable from the UI until the v4 surfaces ship; actions are
 * safe to deploy ahead of the migration — they fail with a plain
 * "relation does not exist" error rather than corrupting anything.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { canApplyCardAction } from "@/lib/shows/cards";
import { championLabel } from "@/lib/shows/placings";
import { MAX_ENTRIES_PER_OWNER_FOR_SIZE, placementPoints } from "@/lib/shows/points";
import {
    GALLERY_STATUSES,
    RESULTS_STATUSES,
    isOwnerRevealed,
    type ClassRoomData,
    type ClassRoomEntry,
} from "@/lib/shows/gallery";
import {
    getAliases,
    getEntryPhotoUrls,
    getHorseNames,
    getShowRole,
    loadClassContexts,
} from "@/lib/shows/queries";
import {
    attachDocumentToEntrySchema,
    barEntrantSchema,
    createHorseDocumentSchema,
    deleteHorseDocumentSchema,
    firstZodError,
    liftBarSchema,
    listBarredEntrantsSchema,
    publishClassResultsSchema,
    removeEntrantFromShowSchema,
    strikeEntrySchema,
    unpublishClassResultsSchema,
    setClassRubricSchema,
    updateHorseDocumentSchema,
    voidCardSchema,
    writeCritiqueSchema,
    writeEntryScoreSchema,
} from "@/lib/shows/schemas";
import { classAverages, cleanScores, parseRubric, rubricTemplate, weightedTotal } from "@/lib/shows/rubrics";
import type { CardStatus } from "@/lib/shows/types";

type ActionResult = { success: true } | { success: false; error: string };

function isPlatformAdmin(email: string | undefined): boolean {
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    return !!adminEmail && !!email && email.toLowerCase() === adminEmail;
}

// ══════════════════════════════════════════════════════════════
// Barred entrants — the sticky scratch
// ══════════════════════════════════════════════════════════════

/**
 * Bar a user from a show (host/co-host). Optionally staff-scratches
 * every live entry they hold at this show in the same motion — the
 * sloptrough fix: scratch no longer means "free to re-enter".
 */
export async function barEntrant(
    input: z.input<typeof barEntrantSchema>,
): Promise<ActionResult> {
    const parsed = barEntrantSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const roleResult = await getShowRole(supabase, v.showId, user.id);
    if ("error" in roleResult) return { success: false, error: roleResult.error };
    if (roleResult.role !== "host" && roleResult.role !== "co_host") {
        return { success: false, error: "Only the host or a co-host can bar an entrant." };
    }
    if (v.userId === user.id) {
        return { success: false, error: "You cannot bar yourself from your own show." };
    }

    const { error: insertError } = await supabase.from("show_barred_entrants").insert({
        show_id: v.showId,
        user_id: v.userId,
        barred_by: user.id,
        reason: v.reason ?? null,
    });
    if (insertError && insertError.code !== "23505") {
        // 23505 = already barred — treat as success and continue to
        // the scratch sweep (the bar is what matters).
        return { success: false, error: insertError.message };
    }

    let scratched = 0;
    if (v.scratchEntries) {
        // RESULTS ARE FINAL (audit SEV-1/H5): scratching entries on a
        // completed/archived show retroactively rewrites published
        // points (class sizes recompute at read time) while cards and
        // records stand — the ledgers would disagree forever. The bar
        // row above still lands (it governs the future); for published
        // results, per-entry corrections go through Strike, which
        // voids the card and cleans the record with it.
        const { data: showRow } = await supabase
            .from("shows")
            .select("status")
            .eq("id", v.showId)
            .maybeSingle();
        const finalized = ["completed", "archived"].includes(
            (showRow?.status as string) ?? "",
        );
        if (finalized) {
            return {
                success: false,
                error:
                    "This show's results are published — the bar is in place, but entries can only be removed one at a time with Strike (which also voids cards and cleans records).",
            };
        }
        const { data: rows, error: scratchError } = await supabase
            .from("show_class_entries")
            .update({
                status: "scratched",
                note: `Barred by show staff${v.reason ? `: ${v.reason}` : ""}`,
            })
            .eq("show_id", v.showId)
            .eq("owner_id", v.userId)
            .neq("status", "scratched")
            .select("id");
        if (scratchError) return { success: false, error: scratchError.message };
        scratched = rows?.length ?? 0;
    }

    // Tell the entrant once, plainly. createNotification self-guards
    // and respects prefs; the bar itself does not depend on delivery.
    try {
        const { createNotification } = await import("@/lib/notifications/createNotification");
        await createNotification({
            userId: v.userId,
            type: "show_moderation",
            actorId: null,
            content:
                scratched > 0
                    ? `Your ${scratched === 1 ? "entry was" : "entries were"} scratched and you may not re-enter this show. Contact the host with questions.`
                    : "You may not enter this show. Contact the host with questions.",
            linkUrl: `/shows/${v.showId}`,
        });
    } catch {
        // Notification is best-effort.
    }

    revalidatePath(`/shows/${v.showId}`);
    return { success: true };
}

export interface RemoveEntrantResult {
    success: true;
    /** Entry rows actually deleted (entered AND scratched alike). */
    removedEntries: number;
    /** Distinct classes those entries sat in — for the host's receipt. */
    removedClasses: number;
    /** False when the bar row was already there (the re-run case). */
    newlyBarred: boolean;
}

/**
 * REMOVE AND BAR — the one-motion troll cleanup (host/co-host, or
 * the platform admin).
 *
 * The two existing tools each do half the job, which is why the
 * sloptrough incident has twice been cleaned up with hand-written
 * SQL: Scratch leaves the entry standing on the host's ledger and
 * does not stop re-entry; Bar stops the next entry but leaves the
 * ones already in. This deletes every entry the owner holds at this
 * show — ENTERED AND ALREADY-SCRATCHED ALIKE, because a scratched
 * joke entry is still a joke entry in the ledger — clears the
 * placings hanging off them, and lands the bar row that migrations
 * 148/151 enforce re-entry against.
 *
 * NOT an after-publish tool: see the results guard below.
 */
export async function removeEntrantFromShow(
    input: z.input<typeof removeEntrantFromShowSchema>,
): Promise<RemoveEntrantResult | { success: false; error: string }> {
    const parsed = removeEntrantFromShowSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const roleResult = await getShowRole(supabase, v.showId, user.id);
    if ("error" in roleResult) return { success: false, error: roleResult.error };

    // A hidden button is not authorization — the gate lives here.
    const admin = isPlatformAdmin(user.email);
    const isStaff = roleResult.role === "host" || roleResult.role === "co_host";
    if (!isStaff && !admin) {
        return {
            success: false,
            error: "Only the host, a co-host, or the site admin can remove an entrant from a show.",
        };
    }

    if (v.userId === user.id) {
        return {
            success: false,
            error: "You cannot remove yourself with this tool — scratch your own entries instead.",
        };
    }
    if (v.userId === roleResult.show.host_id) {
        return {
            success: false,
            error: "The host's own entries cannot be removed this way — scratch them instead.",
        };
    }

    // RESULTS ARE FINAL (the same rule barEntrant's sweep and Strike
    // both answer to). Deleting entries after results publish orphans
    // the placings, cards and trophy-case records hanging off them and
    // silently recomputes the class sizes the published points were
    // figured from. After publish the correct tool is per-placing
    // Strike, which voids the card and cleans the record with it.
    const status = roleResult.show.status;
    if (status === "results_review" || status === "completed" || status === "archived") {
        return {
            success: false,
            error:
                "This show's results are published — entries can no longer be removed. Strike the individual placings instead (Strike voids the card and cleans the record with it); the bar list still governs future shows.",
        };
    }

    // The platform admin usually holds no show_staff row, so every RLS
    // policy on entries/placings/bars (all keyed to show_role_check)
    // would quietly filter their writes to a no-op. THIRD documented
    // admin-client use in this file, reached only past the explicit
    // gate above; show staff keep the RLS backstop on the user client.
    const db = isStaff ? supabase : getAdminClient();

    const { data: entryRows, error: entriesError } = await db
        .from("show_class_entries")
        .select("id, class_id")
        .eq("show_id", v.showId)
        .eq("owner_id", v.userId);
    if (entriesError) return { success: false, error: entriesError.message };
    const entries = (entryRows ?? []) as { id: string; class_id: string }[];
    const entryIds = entries.map((e) => e.id);
    const removedClasses = new Set(entries.map((e) => e.class_id)).size;

    const { data: existingBar, error: barReadError } = await db
        .from("show_barred_entrants")
        .select("user_id")
        .eq("show_id", v.showId)
        .eq("user_id", v.userId)
        .maybeSingle();
    if (barReadError) return { success: false, error: barReadError.message };
    const alreadyBarred = !!existingBar;

    if (entryIds.length === 0 && alreadyBarred) {
        return {
            success: false,
            error: "That member is already barred from this show and has no entries left to remove.",
        };
    }

    // THE BAR LANDS FIRST, deliberately. If the sweep below fails
    // halfway the show is left in the old Bar-only state — untidy but
    // safe, and the troll cannot enter again while the host retries.
    // The other order would delete the entries and leave the door
    // open. ignoreDuplicates is ON CONFLICT DO NOTHING: a re-run must
    // never overwrite the original reason or barred_by.
    const { error: barError } = await db.from("show_barred_entrants").upsert(
        {
            show_id: v.showId,
            user_id: v.userId,
            barred_by: user.id,
            reason: v.reason?.length ? v.reason : null,
        },
        { onConflict: "show_id,user_id", ignoreDuplicates: true },
    );
    if (barError) return { success: false, error: barError.message };

    let removedEntries = 0;
    if (entryIds.length > 0) {
        // show_placings.entry_id is ON DELETE CASCADE (117), but the
        // judge queue and ring console read placings directly — clearing
        // them first means no window where the tray points at ghosts.
        const { error: placingsError } = await db
            .from("show_placings")
            .delete()
            .in("entry_id", entryIds);
        if (placingsError) return { success: false, error: placingsError.message };

        // .select() makes the delete self-verifying — an RLS-filtered
        // no-op must never report success.
        const { data: deleted, error: deleteError } = await db
            .from("show_class_entries")
            .delete()
            .eq("show_id", v.showId)
            .eq("owner_id", v.userId)
            .select("id");
        if (deleteError) return { success: false, error: deleteError.message };
        removedEntries = deleted?.length ?? 0;
        if (removedEntries === 0) {
            return {
                success: false,
                error: "Those entries could not be removed — please refresh and try again. The bar is already in place.",
            };
        }
    }

    // Plain, non-inflammatory, and deliberately REASON-FREE: the
    // host's reason is bookkeeping that stays on the bar row for staff
    // and the site admin. It was never written to be read by the
    // person it is about.
    try {
        const { createNotification } = await import("@/lib/notifications/createNotification");
        await createNotification({
            userId: v.userId,
            type: "show_moderation",
            actorId: null,
            content:
                removedEntries > 0
                    ? `Your ${removedEntries === 1 ? "entry was" : "entries were"} removed from this show by the host, and you cannot re-enter it. Contact the host with questions.`
                    : "The host has barred you from entering this show. Contact the host with questions.",
            linkUrl: `/shows/${v.showId}`,
        });
    } catch {
        // Notification is best-effort — the removal stands either way.
    }

    revalidatePath(`/shows/${v.showId}`);
    revalidatePath(`/shows/host/${v.showId}`);
    return { success: true, removedEntries, removedClasses, newlyBarred: !alreadyBarred };
}

/**
 * Lift a bar (host/co-host, or the platform admin — the same trio
 * that can remove an entrant can undo it). Does NOT restore removed
 * or scratched entries; the member simply may enter again.
 */
export async function liftBar(
    input: z.input<typeof liftBarSchema>,
): Promise<ActionResult> {
    const parsed = liftBarSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const roleResult = await getShowRole(supabase, v.showId, user.id);
    if ("error" in roleResult) return { success: false, error: roleResult.error };
    const isStaff = roleResult.role === "host" || roleResult.role === "co_host";
    if (!isStaff && !isPlatformAdmin(user.email)) {
        return {
            success: false,
            error: "Only the host, a co-host, or the site admin can lift a bar.",
        };
    }

    // Same admin-client rationale as removeEntrantFromShow: the DELETE
    // policy on show_barred_entrants is show_role_check-keyed, so an
    // admin who holds no staff row would get a silent no-op.
    const db = isStaff ? supabase : getAdminClient();

    const { error } = await db
        .from("show_barred_entrants")
        .delete()
        .eq("show_id", v.showId)
        .eq("user_id", v.userId);
    if (error) return { success: false, error: error.message };

    revalidatePath(`/shows/${v.showId}`);
    return { success: true };
}

export interface BarredEntrantRow {
    userId: string;
    alias: string;
    reason: string | null;
    barredAt: string;
}

/** The bar list with aliases (staff view). */
export async function listBarredEntrants(
    input: z.input<typeof listBarredEntrantsSchema>,
): Promise<{ success: true; barred: BarredEntrantRow[] } | { success: false; error: string }> {
    const parsed = listBarredEntrantsSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const roleResult = await getShowRole(supabase, v.showId, user.id);
    if ("error" in roleResult) return { success: false, error: roleResult.error };
    if (!roleResult.role) {
        return { success: false, error: "Only show staff can view the bar list." };
    }

    const { data, error } = await supabase
        .from("show_barred_entrants")
        .select("user_id, reason, created_at")
        .eq("show_id", v.showId)
        .order("created_at", { ascending: false });
    if (error) return { success: false, error: error.message };

    const rows = (data ?? []) as { user_id: string; reason: string | null; created_at: string }[];
    const aliases = await getAliases(supabase, rows.map((r) => r.user_id));
    const aliasMap = "error" in aliases ? new Map<string, string>() : aliases;

    return {
        success: true,
        barred: rows.map((r) => ({
            userId: r.user_id,
            alias: aliasMap.get(r.user_id) ?? "Unknown",
            reason: r.reason,
            barredAt: r.created_at,
        })),
    };
}

// ══════════════════════════════════════════════════════════════
// Card void + strike-from-results — the publish escape hatch
// ══════════════════════════════════════════════════════════════

/**
 * Void a qualification card (host/co-host of the card's show, or
 * platform admin). The cards state machine has modeled this
 * transition since 117 — this is the first caller.
 */
export async function voidCard(
    input: z.input<typeof voidCardSchema>,
): Promise<ActionResult> {
    const parsed = voidCardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { data: card, error: cardError } = await supabase
        .from("qualification_cards")
        .select("id, show_id, status")
        .eq("id", v.code)
        .maybeSingle();
    if (cardError) return { success: false, error: cardError.message };

    const admin = isPlatformAdmin(user.email);

    // The admin may not satisfy the card-people SELECT policy — retry
    // the read with the service role. Documented admin-client use:
    // explicit ADMIN_EMAIL check above, single-row read by primary key.
    let cardRow = card as { id: string; show_id: string; status: string } | null;
    if (!cardRow && admin) {
        const { data: adminCard } = await getAdminClient()
            .from("qualification_cards")
            .select("id, show_id, status")
            .eq("id", v.code)
            .maybeSingle();
        cardRow = adminCard as typeof cardRow;
    }
    if (!cardRow) return { success: false, error: "Card not found." };

    if (!admin) {
        const roleResult = await getShowRole(supabase, cardRow.show_id, user.id);
        if ("error" in roleResult) return { success: false, error: roleResult.error };
        if (roleResult.role !== "host" && roleResult.role !== "co_host") {
            return { success: false, error: "Only the show's host, a co-host, or the site admin can void a card." };
        }
    }

    const legal = canApplyCardAction(cardRow.status as CardStatus, "void");
    if (!legal.ok) return { success: false, error: legal.reason };

    const writer = admin ? getAdminClient() : supabase;
    const { error: updateError } = await writer
        .from("qualification_cards")
        .update({
            status: "void",
            voided_at: new Date().toISOString(),
            voided_by: user.id,
            void_reason: v.reason,
        })
        .eq("id", cardRow.id)
        .in("status", ["issued", "transferred"]);
    if (updateError) return { success: false, error: updateError.message };

    // Tell the card holder (audit S8: the bearer token used to go
    // invalid silently). Owner read needs the admin client — the
    // caller may not satisfy the card-people SELECT policy.
    try {
        const { data: holder } = await getAdminClient()
            .from("qualification_cards")
            .select("current_owner_id")
            .eq("id", cardRow.id)
            .maybeSingle();
        const holderId = (holder as { current_owner_id: string } | null)?.current_owner_id;
        if (holderId) {
            const { createNotification } = await import("@/lib/notifications/createNotification");
            await createNotification({
                userId: holderId,
                type: "show_moderation",
                actorId: null,
                content: `Your qualification card ${cardRow.id} was voided: ${v.reason}`,
                linkUrl: `/cards/${cardRow.id}`,
            });
        }
    } catch {
        // Best-effort; the void stands.
    }

    revalidatePath(`/cards/${cardRow.id}`);
    revalidatePath(`/shows/${cardRow.show_id}`);
    return { success: true };
}

/**
 * Strike an entry from published results (host/co-host/admin, only
 * once the show is in results_review or later). Removes the entry's
 * placing, voids its card, deletes the platform-generated trophy-case
 * records this show wrote for the horse, and scratches the entry so
 * galleries and standings exclude it. The safety net for a troll
 * placing discovered after "Complete show" — previously SQL-only.
 *
 * ADMIN CLIENT — required for two deletes the host cannot perform
 * under RLS (show_records and show_placings are owner-scoped): the
 * explicit host/co-host/admin check above is the authorization; every
 * statement is scoped to this entry's ids.
 */
export async function strikeEntryFromResults(
    input: z.input<typeof strikeEntrySchema>,
): Promise<ActionResult> {
    const parsed = strikeEntrySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { data: entry, error: entryError } = await supabase
        .from("show_class_entries")
        .select("id, show_id, class_id, horse_id, owner_id, status")
        .eq("id", v.entryId)
        .maybeSingle();
    if (entryError) return { success: false, error: entryError.message };
    if (!entry) return { success: false, error: "Entry not found." };
    const e = entry as {
        id: string; show_id: string; class_id: string;
        horse_id: string; owner_id: string; status: string;
    };

    const admin = isPlatformAdmin(user.email);
    const roleResult = await getShowRole(supabase, e.show_id, user.id);
    if ("error" in roleResult) return { success: false, error: roleResult.error };
    const isStaff = roleResult.role === "host" || roleResult.role === "co_host";
    if (!isStaff && !admin) {
        return { success: false, error: "Only the host, a co-host, or the site admin can strike an entry." };
    }
    const showStatus = roleResult.show.status;
    if (showStatus !== "results_review" && showStatus !== "completed" && showStatus !== "archived") {
        return {
            success: false,
            error: "Strike is for published results — while judging is open, scratch the entry instead.",
        };
    }

    const adminClient = getAdminClient();

    // 1. Void the card for this (class, horse), if one was minted.
    const { data: card } = await adminClient
        .from("qualification_cards")
        .select("id, status")
        .eq("class_id", e.class_id)
        .eq("horse_id", e.horse_id)
        .maybeSingle();
    if (card && ["issued", "transferred"].includes((card as { status: string }).status)) {
        const { error: voidError } = await adminClient
            .from("qualification_cards")
            .update({
                status: "void",
                voided_at: new Date().toISOString(),
                voided_by: user.id,
                void_reason: `Entry struck from results: ${v.reason}`,
            })
            .eq("id", (card as { id: string }).id);
        if (voidError) return { success: false, error: voidError.message };
    }

    // 2. Remove the placing row (galleries/ribbon rails recompute).
    const { error: placingError } = await adminClient
        .from("show_placings")
        .delete()
        .eq("entry_id", e.id);
    if (placingError) return { success: false, error: placingError.message };

    // 2b. Championship callbacks won BY THIS ENTRY are vacated (audit
    // H2: the public champions section read callbacks unconditionally,
    // so a struck Grand Champion stood forever). Track which champion
    // labels we vacate so step 3 can remove exactly those records.
    const vacatedLabels: string[] = [];
    const { data: cbRows } = await adminClient
        .from("show_callbacks")
        .select("id, scope, champion_entry_id, reserve_entry_id")
        .eq("show_id", e.show_id)
        .or(`champion_entry_id.eq.${e.id},reserve_entry_id.eq.${e.id}`);
    for (const cb of (cbRows ?? []) as {
        id: string;
        scope: "section" | "division" | "show";
        champion_entry_id: string | null;
        reserve_entry_id: string | null;
    }[]) {
        const patch: Record<string, null> = {};
        if (cb.champion_entry_id === e.id) {
            patch.champion_entry_id = null;
            vacatedLabels.push(championLabel("champion", cb.scope));
        }
        if (cb.reserve_entry_id === e.id) {
            patch.reserve_entry_id = null;
            vacatedLabels.push(championLabel("reserve", cb.scope));
        }
        const { error: cbError } = await adminClient
            .from("show_callbacks")
            .update(patch)
            .eq("id", cb.id);
        if (cbError) return { success: false, error: cbError.message };
    }

    // 3. Delete the platform-generated trophy-case records for THE
    // STRUCK CLASS only, plus any championship records this entry's
    // vacated callbacks produced (audit H1: the old horse-wide delete
    // erased every class the horse placed in at this show — and
    // completed shows can never rewrite them).
    const { data: classRow } = await adminClient
        .from("show_classes")
        .select("name")
        .eq("id", e.class_id)
        .maybeSingle();
    const className = (classRow as { name: string } | null)?.name ?? null;
    if (className) {
        const { error: recordsError } = await adminClient
            .from("show_records")
            .delete()
            .eq("show_id", e.show_id)
            .eq("horse_id", e.horse_id)
            .eq("class_name", className)
            .eq("verification_tier", "platform_generated");
        if (recordsError) return { success: false, error: recordsError.message };
    }
    if (vacatedLabels.length > 0) {
        const { error: champRecordsError } = await adminClient
            .from("show_records")
            .delete()
            .eq("show_id", e.show_id)
            .eq("horse_id", e.horse_id)
            .in("placing", vacatedLabels)
            .eq("verification_tier", "platform_generated");
        if (champRecordsError)
            return { success: false, error: champRecordsError.message };
    }

    // 4. Scratch the entry with the reason on its audit note —
    // standings and galleries exclude scratched rows by construction.
    const { error: scratchError } = await adminClient
        .from("show_class_entries")
        .update({
            status: "scratched",
            note: `Struck from results by show staff: ${v.reason}`,
        })
        .eq("id", e.id);
    if (scratchError) return { success: false, error: scratchError.message };

    // Tell the entrant what happened and why (audit S8: strike used
    // to remove placing/card/records with zero notice).
    try {
        const { createNotification } = await import("@/lib/notifications/createNotification");
        await createNotification({
            userId: e.owner_id,
            type: "show_moderation",
            actorId: null,
            content: `Your entry${className ? ` in "${className}"` : ""} was struck from the results: ${v.reason}`,
            linkUrl: `/shows/${e.show_id}`,
        });
    } catch {
        // Notification is best-effort; the strike stands.
    }

    revalidatePath(`/shows/${e.show_id}`);
    revalidatePath(`/shows/${e.show_id}/results`);
    revalidatePath(`/community/${e.horse_id}`);
    return { success: true };
}

// ══════════════════════════════════════════════════════════════
// Per-entry critique — MEPSA's teaching tradition, digitized
// ══════════════════════════════════════════════════════════════

/**
 * Write (or overwrite) the judge's critique on an entry. Judge,
 * host, or co-host; while judging or reviewing results. Critiques
 * become visible to entrants/public only when the entry's class
 * publishes results — the read paths gate on results_published_at.
 */
export async function writeCritique(
    input: z.input<typeof writeCritiqueSchema>,
): Promise<ActionResult> {
    const parsed = writeCritiqueSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { data: entry, error: entryError } = await supabase
        .from("show_class_entries")
        .select("id, show_id, status")
        .eq("id", v.entryId)
        .maybeSingle();
    if (entryError) return { success: false, error: entryError.message };
    if (!entry) return { success: false, error: "Entry not found." };
    const e = entry as { id: string; show_id: string; status: string };
    if (e.status === "scratched") {
        return { success: false, error: "Scratched entries are not judged — no critique to write." };
    }

    const roleResult = await getShowRole(supabase, e.show_id, user.id);
    if ("error" in roleResult) return { success: false, error: roleResult.error };
    if (!roleResult.role || roleResult.role === "steward") {
        return { success: false, error: "Only the judge, host, or a co-host can write critiques." };
    }
    const showStatus = roleResult.show.status;
    if (showStatus !== "judging" && showStatus !== "results_review") {
        return { success: false, error: "Critiques are written during judging or results review." };
    }

    const { error: updateError } = await supabase
        .from("show_class_entries")
        .update({
            critique_text: v.critique?.trim() || null,
            critique_photo_text: v.photoCritique?.trim() || null,
            critique_by: user.id,
            critique_at: new Date().toISOString(),
        })
        .eq("id", e.id);
    if (updateError) return { success: false, error: updateError.message };

    return { success: true };
}

// ══════════════════════════════════════════════════════════════
// Scored judging (205) — "graded on a scale, not on a judge's whim"
// ══════════════════════════════════════════════════════════════

/**
 * Choose (or clear) a class's rubric. Host, co-host, or judge; any
 * time before the class publishes results. The template is
 * DENORMALIZED onto the class row — what a class was judged against
 * never changes underneath it, even if we edit templates later.
 */
export async function setClassRubric(
    input: z.input<typeof setClassRubricSchema>,
): Promise<ActionResult> {
    const parsed = setClassRubricSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { data: cls, error: clsError } = await supabase
        .from("show_classes")
        .select("id, status, show_sections!inner(show_divisions!inner(show_id))")
        .eq("id", v.classId)
        .maybeSingle();
    if (clsError) return { success: false, error: clsError.message };
    if (!cls) return { success: false, error: "Class not found." };
    const showId = (
        cls as unknown as { show_sections: { show_divisions: { show_id: string } } }
    ).show_sections.show_divisions.show_id;

    const roleResult = await getShowRole(supabase, showId, user.id);
    if ("error" in roleResult) return { success: false, error: roleResult.error };
    if (!roleResult.role || roleResult.role === "steward") {
        return { success: false, error: "Only the judge, host, or a co-host can set a rubric." };
    }

    const rubric = v.templateKey === null ? null : rubricTemplate(v.templateKey);
    if (v.templateKey !== null && !rubric) {
        return { success: false, error: "Unknown rubric template." };
    }

    const { error } = await supabase
        .from("show_classes")
        .update({ rubric } as never)
        .eq("id", v.classId);
    if (error) {
        if (error.code === "42703" || error.code === "PGRST204") {
            return { success: false, error: "Scored judging arrives with migration 205." };
        }
        return { success: false, error: error.message };
    }
    return { success: true };
}

/**
 * The judge's score sheet for one entry — the critique lifecycle,
 * with numbers: judge/host/co-host writes it during judging or
 * results review; entrants see it when the class publishes results.
 * A PARTIAL sheet saves (the judge scores as she looks) but only a
 * complete one gets a weighted total, so partial sheets never rank.
 */
export async function writeEntryScore(
    input: z.input<typeof writeEntryScoreSchema>,
): Promise<ActionResult & { total?: number | null }> {
    const parsed = writeEntryScoreSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { data: entry, error: entryError } = await supabase
        .from("show_class_entries")
        .select("id, show_id, class_id, status")
        .eq("id", v.entryId)
        .maybeSingle();
    if (entryError) return { success: false, error: entryError.message };
    if (!entry) return { success: false, error: "Entry not found." };
    const e = entry as { id: string; show_id: string; class_id: string; status: string };
    if (e.status === "scratched") {
        return { success: false, error: "Scratched entries are not judged — no score to write." };
    }

    const roleResult = await getShowRole(supabase, e.show_id, user.id);
    if ("error" in roleResult) return { success: false, error: roleResult.error };
    if (!roleResult.role || roleResult.role === "steward") {
        return { success: false, error: "Only the judge, host, or a co-host can score entries." };
    }
    const showStatus = roleResult.show.status;
    if (showStatus !== "judging" && showStatus !== "results_review" && showStatus !== "running") {
        return { success: false, error: "Scores are written during judging or results review." };
    }

    const { data: clsRow, error: clsError } = await supabase
        .from("show_classes")
        .select("rubric" as never)
        .eq("id", e.class_id)
        .maybeSingle();
    if (clsError) {
        if (clsError.code === "42703" || clsError.code === "PGRST204") {
            return { success: false, error: "Scored judging arrives with migration 205." };
        }
        return { success: false, error: clsError.message };
    }
    const rubric = parseRubric((clsRow as { rubric?: unknown } | null)?.rubric);
    if (!rubric) return { success: false, error: "This class has no rubric — pick one first." };

    const scores = cleanScores(rubric, v.scores);
    const total = weightedTotal(rubric, scores);

    const { error: updateError } = await supabase
        .from("show_class_entries")
        .update({ score_data: scores, score_total: total } as never)
        .eq("id", e.id);
    if (updateError) return { success: false, error: updateError.message };

    return { success: true, total };
}

// ══════════════════════════════════════════════════════════════
// Per-class result reveal — judging as cadence, not a dump
// ══════════════════════════════════════════════════════════════

async function setClassPublished(
    input: { classId: string },
    publishedAt: string | null,
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const { data: cls, error: clsError } = await supabase
        .from("show_classes")
        .select("id, status, show_sections!inner(show_divisions!inner(show_id))")
        .eq("id", input.classId)
        .maybeSingle();
    if (clsError) return { success: false, error: clsError.message };
    if (!cls) return { success: false, error: "Class not found." };

    const showId = (
        cls as unknown as { show_sections: { show_divisions: { show_id: string } } }
    ).show_sections.show_divisions.show_id;

    const roleResult = await getShowRole(supabase, showId, user.id);
    if ("error" in roleResult) return { success: false, error: roleResult.error };
    if (roleResult.role !== "host" && roleResult.role !== "co_host") {
        return { success: false, error: "Only the host or a co-host can publish class results." };
    }

    if (publishedAt !== null && (cls as { status: string }).status !== "placed") {
        return { success: false, error: "Place the class before publishing its results." };
    }

    // Rolling reveal belongs to the judging window (audit M6): a class
    // must not reveal before the show reaches judging, and a completed
    // show's reveals are final (per-entry corrections go through
    // Strike, which cleans cards/records with them).
    const showStatus = roleResult.show.status;
    if (publishedAt !== null && !["running", "judging", "results_review"].includes(showStatus)) {
        return {
            success: false,
            error: "Class results can only be revealed while the show is running or judging.",
        };
    }
    if (publishedAt === null && ["completed", "archived"].includes(showStatus)) {
        return {
            success: false,
            error: "The show's results are published — individual classes can no longer be pulled back.",
        };
    }

    const { error: updateError } = await supabase
        .from("show_classes")
        .update({ results_published_at: publishedAt })
        .eq("id", input.classId);
    if (updateError) return { success: false, error: updateError.message };

    revalidatePath(`/shows/${showId}`);
    return { success: true };
}

/** Publish one placed class's results (rolling reveal). */
export async function publishClassResults(
    input: z.input<typeof publishClassResultsSchema>,
): Promise<ActionResult> {
    const parsed = publishClassResultsSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    return setClassPublished(parsed.data, new Date().toISOString());
}

/** Pull a class's results back (corrections during judging). */
export async function unpublishClassResults(
    input: z.input<typeof unpublishClassResultsSchema>,
): Promise<ActionResult> {
    const parsed = unpublishClassResultsSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    return setClassPublished(parsed.data, null);
}

// ══════════════════════════════════════════════════════════════
// The class room — the v4 spectator read ("the class is the room")
// ══════════════════════════════════════════════════════════════

const getClassRoomSchema = z.object({ classId: z.uuid() });

/**
 * One class as a room: the lineup, and — once THIS class's results
 * are published (rolling reveal, or show completion) — the ribbon
 * rail with per-entry critiques. Anon-safe: the blind rule is
 * enforced server-side exactly as in getShowGallery, and critique
 * columns are not even selected before the class publishes.
 */
export async function getClassRoom(
    input: z.input<typeof getClassRoomSchema>,
): Promise<{ success: true; room: ClassRoomData } | { success: false; error: string }> {
    const parsed = getClassRoomSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    // Generic client type: the 148 tables/columns aren't in the
    // generated types until the owner applies the migration and runs
    // gen-types (same posture as the requireAuth-based actions above).
    const supabase = (await createClient()) as import("@supabase/supabase-js").SupabaseClient;
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Class → section → division → show (the standard context walk).
    const { data: cls, error: cErr } = await supabase
        .from("show_classes")
        .select(
            "id, name, class_number, status, results_published_at, is_qualifying, show_sections!inner(name, show_divisions!inner(name, show_id))",
        )
        .eq("id", parsed.data.classId)
        .maybeSingle();
    if (cErr) return { success: false, error: cErr.message };
    if (!cls) return { success: false, error: "Class not found." };
    const clsRow = cls as unknown as {
        id: string;
        name: string;
        class_number: string | null;
        status: string;
        results_published_at: string | null;
        is_qualifying: boolean | null;
        show_sections: { name: string; show_divisions: { name: string; show_id: string } };
    };
    const showId = clsRow.show_sections.show_divisions.show_id;

    const { data: show, error: shErr } = await supabase
        .from("shows")
        .select("id, title, mode, status, judging, blind_browsing")
        .eq("id", showId)
        .maybeSingle();
    if (shErr) return { success: false, error: shErr.message };
    if (!show || show.status === "draft") return { success: false, error: "Show not found." };
    if (show.mode !== "online") {
        return { success: false, error: "Live shows have no class rooms — see the published results." };
    }
    const status = show.status as import("@/lib/shows/types").ShowStatus;
    if (!GALLERY_STATUSES.includes(status)) {
        return { success: false, error: "The class room opens when entries open." };
    }

    // THIS class's results are public: rolling per-class reveal
    // (results_published_at) or the show-level publish.
    const resultsPublished =
        clsRow.results_published_at !== null || RESULTS_STATUSES.includes(status);
    const revealed = isOwnerRevealed(status, show.blind_browsing as boolean);

    // Scored judging (205): the class's rubric — tolerant of an
    // unpasted database (the whole feature simply hides).
    let rubric: ReturnType<typeof parseRubric> = null;
    {
        const { data: rRow, error: rErr } = await supabase
            .from("show_classes")
            .select("rubric")
            .eq("id", clsRow.id)
            .maybeSingle();
        if (!rErr) rubric = parseRubric((rRow as { rubric?: unknown } | null)?.rubric);
    }

    // Critique columns are selected ONLY once published — the data
    // never rides the wire before the reveal. Scores follow the same
    // rule (205), with a pre-migration fallback.
    const baseColumns = "id, horse_id, owner_id, entry_number, photo_id, status, document_id, created_at";
    const entryColumns = resultsPublished
        ? `${baseColumns}, critique_text, critique_photo_text, score_data, score_total`
        : baseColumns;
    let entryRows: Record<string, unknown>[] | null = null;
    let eErr: { code?: string; message: string } | null = null;
    {
        const res = await supabase
            .from("show_class_entries")
            .select(entryColumns)
            .eq("class_id", clsRow.id)
            .order("created_at", { ascending: true });
        entryRows = res.data as Record<string, unknown>[] | null;
        eErr = res.error;
    }
    if (eErr && resultsPublished && (eErr.code === "42703" || eErr.code === "PGRST204")) {
        const res = await supabase
            .from("show_class_entries")
            .select(`${baseColumns}, critique_text, critique_photo_text`)
            .eq("class_id", clsRow.id)
            .order("created_at", { ascending: true });
        entryRows = res.data as Record<string, unknown>[] | null;
        eErr = res.error;
    }
    if (eErr) return { success: false, error: eErr.message };
    type EntryRow = {
        id: string;
        horse_id: string;
        owner_id: string;
        entry_number: number | null;
        photo_id: string | null;
        status: string;
        document_id: string | null;
        critique_text?: string | null;
        critique_photo_text?: string | null;
    };
    const entries = ((entryRows ?? []) as unknown as EntryRow[]).filter(
        (e) => e.status !== "scratched",
    );

    const photoUrls = await getEntryPhotoUrls(
        supabase,
        entries.flatMap((e) => (e.photo_id ? [e.photo_id] : [])),
    );
    if (!(photoUrls instanceof Map)) return { success: false, error: photoUrls.error };
    const horseNames = await getHorseNames(supabase, entries.map((e) => e.horse_id));
    if (!(horseNames instanceof Map)) return { success: false, error: horseNames.error };

    let aliases = new Map<string, string>();
    if (revealed) {
        const loaded = await getAliases(supabase, entries.map((e) => e.owner_id));
        if (!(loaded instanceof Map)) return { success: false, error: loaded.error };
        aliases = loaded;
    }

    // ── Votes (community-vote shows — the room must carry the same
    // hearts as the gallery, or funneling viewers here breaks voting) ──
    const votingEnabled = show.judging === "community_vote";
    const votingOpen = votingEnabled && status === "judging";
    const voteCounts = new Map<string, number>();
    const viewerVotes = new Set<string>();
    if (votingEnabled && entries.length > 0) {
        const { data: voteRows, error: vErr } = await supabase
            .from("show_entry_votes")
            .select("entry_id, voter_id")
            .in("entry_id", entries.map((e) => e.id));
        if (vErr) return { success: false, error: vErr.message };
        for (const v of voteRows ?? []) {
            const entryId = v.entry_id as string;
            voteCounts.set(entryId, (voteCounts.get(entryId) ?? 0) + 1);
            if (user && v.voter_id === user.id) viewerVotes.add(entryId);
        }
    }

    const placeByEntry = new Map<string, number>();
    if (resultsPublished && entries.length > 0) {
        const { data: placingRows, error: pErr } = await supabase
            .from("show_placings")
            .select("entry_id, place")
            .in("entry_id", entries.map((e) => e.id));
        if (pErr) return { success: false, error: pErr.message };
        for (const p of placingRows ?? []) {
            if (p.place !== null) placeByEntry.set(p.entry_id as string, p.place as number);
        }
    }

    // ── Championship context (season-felt wave): what this class
    // pays and which placings minted cards. Points use the same
    // per-owner-capped payable size as the standings engine; cards
    // come through the announced-only DEFINER RPC (164) and degrade
    // to none until it's applied. ──
    const distinctExhibitors = new Set(entries.map((e) => e.owner_id)).size;
    const perOwnerCounts = new Map<string, number>();
    for (const e of entries) {
        perOwnerCounts.set(e.owner_id, (perOwnerCounts.get(e.owner_id) ?? 0) + 1);
    }
    let payableSize = 0;
    for (const count of perOwnerCounts.values()) {
        payableSize += Math.min(count, MAX_ENTRIES_PER_OWNER_FOR_SIZE);
    }
    const cardByHorse = new Map<string, { code: string; isStakes: boolean }>();
    if (resultsPublished && entries.length > 0) {
        try {
            const rpc = supabase.rpc.bind(supabase) as unknown as (
                fn: string,
                args: { p_class_id: string },
            ) => Promise<{ data: unknown; error: unknown }>;
            const { data: cardRows, error: cardErr } = await rpc("get_class_cards", {
                p_class_id: clsRow.id,
            });
            if (!cardErr && Array.isArray(cardRows)) {
                for (const c of cardRows as {
                    horse_id: string;
                    code: string;
                    is_stakes: boolean | null;
                }[]) {
                    cardByHorse.set(c.horse_id, {
                        code: c.code,
                        isStakes: c.is_stakes === true,
                    });
                }
            }
        } catch {
            // Pre-164: the room simply shows no card chips.
        }
    }

    // Documentation cards (RLS: readable exactly when the entry is).
    const docByEntry = new Map<string, { kind: string; title: string; bodyMd: string }>();
    const docIds = entries.flatMap((e) => (e.document_id ? [e.document_id] : []));
    if (docIds.length > 0) {
        const { data: docRows } = await supabase
            .from("horse_documents")
            .select("id, kind, title, body_md")
            .in("id", docIds);
        const docs = new Map(
            ((docRows ?? []) as { id: string; kind: string; title: string; body_md: string }[]).map(
                (d) => [d.id, { kind: d.kind, title: d.title, bodyMd: d.body_md }],
            ),
        );
        for (const e of entries) {
            if (e.document_id && docs.has(e.document_id)) {
                docByEntry.set(e.id, docs.get(e.document_id)!);
            }
        }
    }

    // ── The program rail: every class in run order with live entry
    // counts — the quick-nav + prev/next "ring walk". One tree load
    // plus one grouped count query. ──
    const tree = await loadClassContexts(supabase, showId);
    if ("error" in tree) return { success: false, error: tree.error };
    const { data: countRows, error: cntErr } = await supabase
        .from("show_class_entries")
        .select("class_id, status")
        .eq("show_id", showId);
    if (cntErr) return { success: false, error: cntErr.message };
    const countByClass = new Map<string, number>();
    for (const r of (countRows ?? []) as { class_id: string; status: string }[]) {
        if (r.status === "scratched") continue;
        countByClass.set(r.class_id, (countByClass.get(r.class_id) ?? 0) + 1);
    }
    const program = tree.contexts
        .filter((ctx) => ctx.status !== "cancelled" && ctx.status !== "combined")
        .map((ctx) => ({
            classId: ctx.classId,
            className: ctx.className,
            classNumber: ctx.classNumber,
            sectionName: ctx.sectionName,
            divisionName: ctx.divisionName,
            entryCount: countByClass.get(ctx.classId) ?? 0,
            isCurrent: ctx.classId === clsRow.id,
        }));
    const currentIndex = program.findIndex((p) => p.isCurrent);
    const navLabel = (p: (typeof program)[number]) =>
        p.classNumber ? `Class ${p.classNumber} — ${p.className}` : p.className;
    const prev = currentIndex > 0 ? program[currentIndex - 1] : null;
    const next =
        currentIndex >= 0 && currentIndex < program.length - 1
            ? program[currentIndex + 1]
            : null;

    const roomEntries: ClassRoomEntry[] = entries.map((e) => ({
        id: e.id,
        horseId: revealed ? e.horse_id : null,
        horseName: horseNames.get(e.horse_id) ?? "Unnamed horse",
        entryNumber: e.entry_number,
        photoUrl: e.photo_id ? (photoUrls.get(e.photo_id) ?? null) : null,
        ownerAlias: revealed ? (aliases.get(e.owner_id) ?? "unknown") : null,
        ownerId: revealed ? e.owner_id : null,
        isOwn: !!user && e.owner_id === user.id,
        place: resultsPublished
            ? ((placeByEntry.get(e.id) as ClassRoomEntry["place"]) ?? null)
            : null,
        pointsEarned:
            resultsPublished && placeByEntry.has(e.id)
                ? placementPoints(placeByEntry.get(e.id) ?? null, payableSize, distinctExhibitors)
                : null,
        cardCode:
            resultsPublished && (placeByEntry.get(e.id) ?? 99) <= 2
                ? (cardByHorse.get(e.horse_id)?.code ?? null)
                : null,
        cardIsStakes:
            resultsPublished && (cardByHorse.get(e.horse_id)?.isStakes ?? false) &&
            (placeByEntry.get(e.id) ?? 99) <= 2,
        critique: resultsPublished ? (e.critique_text ?? null) : null,
        photoCritique: resultsPublished ? (e.critique_photo_text ?? null) : null,
        scoreData: resultsPublished
            ? (((e as Record<string, unknown>).score_data as Record<string, number> | null) ?? null)
            : null,
        scoreTotal:
            resultsPublished && (e as Record<string, unknown>).score_total != null
                ? Number((e as Record<string, unknown>).score_total)
                : null,
        document: docByEntry.get(e.id) ?? null,
        voteCount: voteCounts.get(e.id) ?? 0,
        viewerHasVoted: viewerVotes.has(e.id),
    }));
    if (resultsPublished) {
        roomEntries.sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
    }

    // The dashed polygon: per-criterion class averages, from every
    // published sheet in the room.
    const scoreAverages =
        resultsPublished && rubric
            ? classAverages(
                  rubric,
                  roomEntries
                      .map((r) => r.scoreData)
                      .filter((s): s is Record<string, number> => !!s),
              )
            : null;

    return {
        success: true,
        room: {
            show: {
                id: showId,
                title: show.title as string,
                status,
                blindBrowsing: show.blind_browsing as boolean,
            },
            room: {
                classId: clsRow.id,
                className: clsRow.name,
                classNumber: clsRow.class_number,
                sectionName: clsRow.show_sections.name,
                divisionName: clsRow.show_sections.show_divisions.name,
                classStatus: clsRow.status as ClassRoomData["room"]["classStatus"],
                resultsPublished,
                resultsPublishedAt: clsRow.results_published_at,
                isQualifying: clsRow.is_qualifying === true,
                liveEntryCount: entries.length,
                distinctExhibitors,
            },
            rubric,
            scoreAverages,
            revealed,
            votingEnabled,
            votingOpen,
            authed: !!user,
            entries: roomEntries,
            program,
            prev: prev ? { classId: prev.classId, label: navLabel(prev) } : null,
            next: next ? { classId: next.classId, label: navLabel(next) } : null,
        },
    };
}

// ══════════════════════════════════════════════════════════════
// Documentation — the charter's "digital show binder"
// ══════════════════════════════════════════════════════════════

export async function createHorseDocument(
    input: z.input<typeof createHorseDocumentSchema>,
): Promise<{ success: true; documentId: string } | { success: false; error: string }> {
    const parsed = createHorseDocumentSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { data: horse, error: horseError } = await supabase
        .from("user_horses")
        .select("id, owner_id")
        .eq("id", v.horseId)
        .maybeSingle();
    if (horseError) return { success: false, error: horseError.message };
    if (!horse || (horse as { owner_id: string }).owner_id !== user.id) {
        return { success: false, error: "You can only write documentation for your own horses." };
    }

    const { data: inserted, error } = await supabase
        .from("horse_documents")
        .insert({
            horse_id: v.horseId,
            owner_id: user.id,
            kind: v.kind,
            title: v.title,
            body_md: v.bodyMd,
        })
        .select("id")
        .single();
    if (error || !inserted) {
        return { success: false, error: error?.message ?? "Failed to create the document." };
    }
    return { success: true, documentId: (inserted as { id: string }).id };
}

export async function updateHorseDocument(
    input: z.input<typeof updateHorseDocumentSchema>,
): Promise<ActionResult> {
    const parsed = updateHorseDocumentSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const updates: Record<string, string> = {};
    if (v.kind) updates.kind = v.kind;
    if (v.title) updates.title = v.title;
    if (v.bodyMd) updates.body_md = v.bodyMd;
    if (Object.keys(updates).length === 0) return { success: true };
    updates.updated_at = new Date().toISOString();

    // Owner-scoped RLS is the wall; the .eq is the belt.
    const { data, error } = await supabase
        .from("horse_documents")
        .update(updates)
        .eq("id", v.documentId)
        .eq("owner_id", user.id)
        .select("id");
    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: "Document not found." };
    return { success: true };
}

export async function deleteHorseDocument(
    input: z.input<typeof deleteHorseDocumentSchema>,
): Promise<ActionResult> {
    const parsed = deleteHorseDocumentSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { error } = await supabase
        .from("horse_documents")
        .delete()
        .eq("id", v.documentId)
        .eq("owner_id", user.id);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

/**
 * Attach (or detach: documentId null) one of the horse's documents
 * to an entry. Entry owner only — and in practice only while the
 * show is entries_open: the owner branch of the entries UPDATE
 * policy (118) closes with the entry window, which is the right
 * rule anyway (documentation is part of the entry, not something
 * to swap under a judge mid-class).
 */
export async function attachDocumentToEntry(
    input: z.input<typeof attachDocumentToEntrySchema>,
): Promise<ActionResult> {
    const parsed = attachDocumentToEntrySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const { data: entry, error: entryError } = await supabase
        .from("show_class_entries")
        .select("id, show_id, horse_id, owner_id, status")
        .eq("id", v.entryId)
        .maybeSingle();
    if (entryError) return { success: false, error: entryError.message };
    if (!entry) return { success: false, error: "Entry not found." };
    const e = entry as { id: string; show_id: string; horse_id: string; owner_id: string; status: string };
    if (e.owner_id !== user.id) {
        return { success: false, error: "Only the entry's owner can attach documentation." };
    }
    if (e.status === "scratched") {
        return { success: false, error: "This entry has been scratched." };
    }

    if (v.documentId) {
        const { data: doc, error: docError } = await supabase
            .from("horse_documents")
            .select("id, horse_id, owner_id")
            .eq("id", v.documentId)
            .maybeSingle();
        if (docError) return { success: false, error: docError.message };
        const d = doc as { id: string; horse_id: string; owner_id: string } | null;
        if (!d || d.owner_id !== user.id) {
            return { success: false, error: "Document not found." };
        }
        if (d.horse_id !== e.horse_id) {
            return { success: false, error: "That document belongs to a different horse." };
        }
    }

    const { error: updateError } = await supabase
        .from("show_class_entries")
        .update({ document_id: v.documentId })
        .eq("id", e.id)
        .eq("owner_id", user.id);
    if (updateError) return { success: false, error: updateError.message };

    revalidatePath(`/shows/${e.show_id}`);
    return { success: true };
}
