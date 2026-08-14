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
    strikeEntrySchema,
    unpublishClassResultsSchema,
    updateHorseDocumentSchema,
    voidCardSchema,
    writeCritiqueSchema,
} from "@/lib/shows/schemas";
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

/** Lift a bar (host/co-host). Does NOT restore scratched entries. */
export async function liftBar(
    input: z.input<typeof liftBarSchema>,
): Promise<ActionResult> {
    const parsed = liftBarSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const { supabase, user } = await requireAuth();
    const v = parsed.data;

    const roleResult = await getShowRole(supabase, v.showId, user.id);
    if ("error" in roleResult) return { success: false, error: roleResult.error };
    if (roleResult.role !== "host" && roleResult.role !== "co_host") {
        return { success: false, error: "Only the host or a co-host can lift a bar." };
    }

    const { error } = await supabase
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

    // 3. Delete the platform-generated trophy-case records this show
    // wrote for this horse (self-reported records are untouched).
    const { error: recordsError } = await adminClient
        .from("show_records")
        .delete()
        .eq("show_id", e.show_id)
        .eq("horse_id", e.horse_id)
        .eq("verification_tier", "platform_generated");
    if (recordsError) return { success: false, error: recordsError.message };

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
            "id, name, class_number, status, results_published_at, show_sections!inner(name, show_divisions!inner(name, show_id))",
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
        show_sections: { name: string; show_divisions: { name: string; show_id: string } };
    };
    const showId = clsRow.show_sections.show_divisions.show_id;

    const { data: show, error: shErr } = await supabase
        .from("shows")
        .select("id, title, mode, status, blind_browsing")
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

    // Critique columns are selected ONLY once published — the data
    // never rides the wire before the reveal.
    const entryColumns = resultsPublished
        ? "id, horse_id, owner_id, entry_number, photo_id, status, document_id, created_at, critique_text, critique_photo_text"
        : "id, horse_id, owner_id, entry_number, photo_id, status, document_id, created_at";
    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select(entryColumns)
        .eq("class_id", clsRow.id)
        .order("created_at", { ascending: true });
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
        critique: resultsPublished ? (e.critique_text ?? null) : null,
        photoCritique: resultsPublished ? (e.critique_photo_text ?? null) : null,
        document: docByEntry.get(e.id) ?? null,
    }));
    if (resultsPublished) {
        roomEntries.sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
    }

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
            },
            revealed,
            entries: roomEntries,
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
