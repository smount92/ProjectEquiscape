"use server";

/**
 * Work records — the studio's atom (202).
 *
 * A stable is what you OWN; a studio is what you've MADE. These
 * actions let an artist log past work on a horse (the three-minute
 * back-fill), build its making-of reel, and let the two parties stamp
 * it: the owner confirms (or hides the reel from the passport), the
 * credited artist disavows false credit. Commission deliveries create
 * their records through the delivery hook in art-studio.ts.
 *
 * TOLERANCE: every read degrades to "feature hidden" until migration
 * 202 is pasted (missing column/table errors are swallowed), the same
 * posture the artists table took pre-200 — which is also why queries
 * go through the `loose()` cast: 202's columns aren't in the
 * generated types yet, so shapes are validated at runtime instead.
 */

import { z } from "zod";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createNotification } from "@/lib/notifications/createNotification";
import { checkRateLimit } from "@/lib/utils/rateLimit";
import { sanitizeText } from "@/lib/utils/validation";
import { decodeHtmlEntities } from "@/lib/utils/decodeEntities";
import { getPublicImageUrl } from "@/lib/utils/storage";
import { SERVICE_TYPES } from "@/lib/studio/services";
import {
    MAX_IMAGES_PER_MOMENT,
    MAX_MOMENTS_PER_RECORD,
    MAX_MOMENT_NOTES,
    MAX_STAGE_LABEL,
    isValidMakingPath,
} from "@/lib/studio/making";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export interface WorkMomentView {
    id: string;
    stage: string;
    caption: string | null;
    imageUrls: string[];
    claimedDate: string | null;
    isPublic: boolean;
    createdAt: string;
}

export interface WorkRecordView {
    id: string;
    horseId: string;
    workType: string;
    artistAlias: string | null;
    artistUserId: string | null;
    summary: string | null;
    materialsUsed: string | null;
    claimedStart: string | null;
    dateCompleted: string | null;
    recordedBy: string;
    ownerConfirmedAt: string | null;
    disavowedAt: string | null;
    reelPublic: boolean;
    commissionId: string | null;
    moments: WorkMomentView[];
    /** Viewer capabilities, computed server-side. */
    viewerIsArtist: boolean;
    viewerIsOwner: boolean;
    /** True when the owner should be prompted to confirm this record. */
    awaitingOwner: boolean;
    /** The artist owns the horse — no counter-signature needed. Carried
     *  explicitly because the anon surface has no ownerId to compare. */
    artistIsOwner?: boolean;
}

interface LogRow {
    id: string;
    horse_id: string;
    work_type: string;
    artist_alias: string | null;
    artist_user_id: string | null;
    materials_used: string | null;
    date_completed: string | null;
    commission_id: string | null;
    summary: string | null;
    claimed_start: string | null;
    recorded_by: string | null;
    owner_confirmed_at: string | null;
    disavowed_at: string | null;
    reel_public: boolean | null;
    created_at: string | null;
}

interface MomentRow {
    id: string;
    log_id: string;
    stage: string | null;
    caption: string | null;
    image_urls: string[] | null;
    claimed_date: string | null;
    is_public: boolean;
    created_at: string;
}

type DbError = { code?: string; message: string } | null;

/**
 * 202's columns/tables enter the generated types only when the owner
 * regenerates them after pasting — until then the typed client calls
 * them errors. Same escape hatch the artists table used pre-200:
 * loosen the client, validate shapes at runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = (c: unknown) => c as { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DbError }> };

/** Postgres "column/table missing" — the pre-202 signature. */
function isMissingSchema(err: DbError): boolean {
    return err?.code === "42703" || err?.code === "42P01" || err?.code === "PGRST204";
}

// ══════════════════════════════════════════════════════════════
// Create + reel
// ══════════════════════════════════════════════════════════════

const createSchema = z.object({
    horseId: z.string().uuid(),
    workType: z.string().min(2).max(60),
    summary: z.string().max(2000).optional(),
    materialsUsed: z.string().max(500).optional(),
    claimedStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    dateCompleted: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/**
 * The artist logs past work. Requires an open studio (artist_profiles
 * row) — records are a studio's claims, not drive-by comments — and a
 * horse the artist can see. Display on the owner's passport still
 * requires the owner's confirmation, so this can only ever populate
 * the artist's own wall.
 */
export async function createWorkRecord(input: z.input<typeof createSchema>): Promise<{
    success: boolean;
    logId?: string;
    error?: string;
}> {
    const { supabase, user } = await requireAuth();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid work record." };
    const data = parsed.data;

    const allowed = await checkRateLimit("work-record-create", 20, 60 * 24, user.id);
    if (!allowed) return { success: false, error: "Daily limit reached — try again tomorrow." };

    // The vocabulary is the studio services list; free text falls to it.
    const workType = (SERVICE_TYPES as readonly string[]).includes(data.workType)
        ? data.workType
        : decodeHtmlEntities(sanitizeText(data.workType)).slice(0, 60);

    const { data: profile } = await supabase
        .from("artist_profiles")
        .select("studio_name")
        .eq("user_id", user.id)
        .single();
    if (!profile) {
        return { success: false, error: "Open a studio first — work records are studio records." };
    }

    // Horse must be visible to the artist (RLS decides), and we need
    // the owner for the notification.
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, owner_id, custom_name")
        .eq("id", data.horseId)
        .is("deleted_at", null)
        .single();
    if (!horse) return { success: false, error: "Horse not found." };

    const { data: inserted, error } = (await loose(supabase)
        .from("customization_logs")
        .insert({
            horse_id: data.horseId,
            work_type: workType,
            artist_alias: profile.studio_name,
            artist_user_id: user.id,
            recorded_by: "artist",
            summary: data.summary ? decodeHtmlEntities(sanitizeText(data.summary)) : null,
            materials_used: data.materialsUsed ? decodeHtmlEntities(sanitizeText(data.materialsUsed)) : null,
            claimed_start: data.claimedStart ?? null,
            date_completed: data.dateCompleted ?? null,
        })
        .select("id")
        .single()) as { data: { id: string } | null; error: DbError };
    if (error || !inserted) {
        if (isMissingSchema(error)) {
            return { success: false, error: "Work records aren't enabled yet (migration 202 pending)." };
        }
        logger.error("WorkRecords", "create failed", { message: error?.message });
        return { success: false, error: "Could not save the work record." };
    }

    // Someone else's horse: tell the owner there's a credit to review.
    if (horse.owner_id !== user.id) {
        after(async () => {
            await createNotification({
                userId: horse.owner_id,
                actorId: user.id,
                type: "work_record",
                content: `${profile.studio_name} recorded past work on ${horse.custom_name} — review and confirm it on the passport.`,
                horseId: horse.id,
                linkUrl: `/stable/${horse.id}`,
            });
        });
    }

    revalidatePath(`/stable/${data.horseId}`);
    revalidatePath(`/community/${data.horseId}`);
    return { success: true, logId: inserted.id };
}

/**
 * Search every stable the artist can SEE for a horse to log work on —
 * the missing half of "yours or a client's" (Amanda's model lived in
 * another stable and the picker only listed her own). RLS does the
 * visibility gating: a stranger's private horse never comes back.
 */
export async function searchWorkTargets(query: string): Promise<
    { id: string; name: string; ownerAlias: string | null; thumbUrl: string | null }[]
> {
    const { supabase } = await requireAuth();
    const q = query.trim();
    if (q.length < 2) return [];
    const { data } = await supabase
        .from("user_horses")
        .select("id, custom_name, owner_id, owner:users!owner_id(alias_name)")
        .ilike("custom_name", `%${q.replace(/[%_]/g, "\\$&")}%`)
        .is("deleted_at", null)
        .order("custom_name")
        .limit(20);
    const rows = data ?? [];
    if (rows.length === 0) return [];

    const { data: thumbs } = await supabase
        .from("horse_images")
        .select("horse_id, image_url")
        .in("horse_id", rows.map((r) => r.id))
        .eq("angle_profile", "Primary_Thumbnail");
    const thumbByHorse = new Map<string, string>();
    for (const t of thumbs ?? []) {
        if (!thumbByHorse.has(t.horse_id)) thumbByHorse.set(t.horse_id, t.image_url);
    }

    return rows.map((r) => {
        const owner = r.owner as unknown as { alias_name: string | null } | null;
        const raw = thumbByHorse.get(r.id) ?? null;
        return {
            id: r.id,
            name: r.custom_name,
            ownerAlias: owner?.alias_name ?? null,
            thumbUrl: raw ? (raw.startsWith("http") ? raw : getPublicImageUrl(raw)) : null,
        };
    });
}

const ownerCreditSchema = z.object({
    horseId: z.string().uuid(),
    workType: z.string().min(2).max(60),
    artistName: z.string().min(2).max(80),
    summary: z.string().max(2000).optional(),
    dateCompleted: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/**
 * The OWNER records a credit — the missing link for chains. The hobby
 * works in relays (sculpted by one artist, cast by another, prepped,
 * painted, restored by others still), and the owner is usually the
 * only person who knows the whole chain; many links are artists who
 * will never have an account. recorded_by='owner' + a free-text
 * artist_alias, honestly labeled "Recorded by owner" until the named
 * studio (if it's on MHH) confirms — or disavows — it.
 */
export async function createOwnerCredit(input: z.input<typeof ownerCreditSchema>): Promise<{
    success: boolean;
    logId?: string;
    error?: string;
}> {
    const { supabase, user } = await requireAuth();
    const parsed = ownerCreditSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid credit." };
    const data = parsed.data;

    const allowed = await checkRateLimit("owner-credit-create", 30, 60 * 24, user.id);
    if (!allowed) return { success: false, error: "Daily limit reached — try again tomorrow." };

    // Your horse only — RLS backs this up (092's owner insert policy).
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, owner_id")
        .eq("id", data.horseId)
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .single();
    if (!horse) return { success: false, error: "Horse not found or not yours." };

    const artistName = decodeHtmlEntities(sanitizeText(data.artistName)).slice(0, 80);
    // If the name matches an MHH studio, link the account so the
    // artist can confirm (or disavow) — the false-credit defense
    // works both directions.
    const { data: studio } = await supabase
        .from("artist_profiles")
        .select("user_id, studio_name")
        .ilike("studio_name", artistName)
        .maybeSingle();

    const { data: inserted, error } = (await loose(supabase)
        .from("customization_logs")
        .insert({
            horse_id: data.horseId,
            work_type: (SERVICE_TYPES as readonly string[]).includes(data.workType)
                ? data.workType
                : decodeHtmlEntities(sanitizeText(data.workType)).slice(0, 60),
            artist_alias: artistName,
            artist_user_id: studio?.user_id ?? null,
            recorded_by: "owner",
            summary: data.summary ? decodeHtmlEntities(sanitizeText(data.summary)) : null,
            date_completed: data.dateCompleted ?? null,
        })
        .select("id")
        .single()) as { data: { id: string } | null; error: DbError };
    if (error || !inserted) {
        if (isMissingSchema(error)) {
            return { success: false, error: "Work records aren't enabled yet (migration 202 pending)." };
        }
        logger.error("WorkRecords", "owner credit failed", { message: error?.message });
        return { success: false, error: "Could not save the credit." };
    }

    if (studio?.user_id && studio.user_id !== user.id) {
        after(async () => {
            await createNotification({
                userId: studio.user_id,
                actorId: user.id,
                type: "work_record",
                content: `An owner credited ${studio.studio_name} with work on their horse — confirm it (or flag it) from the passport.`,
                horseId: data.horseId,
                linkUrl: `/community/${data.horseId}`,
            });
        });
    }

    revalidatePath(`/stable/${data.horseId}`);
    revalidatePath(`/community/${data.horseId}`);
    return { success: true, logId: inserted.id };
}

const momentImageSchema = z.object({
    path: z.string().min(1).max(400),
    stage: z.string().trim().min(1).max(MAX_STAGE_LABEL),
    caption: z.string().max(MAX_MOMENT_NOTES).optional(),
    claimedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    isPublic: z.boolean().optional(),
});

/**
 * Finalize uploaded reel photos into moments. Client uploads
 * compressed WebP to horses/{horseId}/making_* first (the SAME
 * compression pipeline as gallery photos — never raw bytes), then
 * hands the storage paths here. One moment per entry: its images
 * share a stage, a caption and a date.
 */
export async function addWorkMoments(
    logId: string,
    moments: { images: z.input<typeof momentImageSchema>[] }[],
): Promise<{ success: boolean; error?: string; added?: number; skipped?: number }> {
    const { supabase, user } = await requireAuth();
    if (!z.string().uuid().safeParse(logId).success) return { success: false, error: "Bad record id." };
    if (moments.length === 0) return { success: true, added: 0 };

    // Party check under RLS: the record must be readable AND ours to
    // extend (artist or the horse's owner — mirrors the insert policy).
    const { data: logData, error: logErr } = (await loose(supabase)
        .from("customization_logs")
        .select("id, horse_id, artist_user_id, recorded_by")
        .eq("id", logId)
        .single()) as { data: { id: string; horse_id: string } | null; error: DbError };
    if (logErr || !logData) {
        return {
            success: false,
            error: isMissingSchema(logErr) ? "Work records aren't enabled yet." : "Record not found.",
        };
    }

    const { count: existing } = (await loose(supabase)
        .from("work_moments")
        .select("id", { count: "exact", head: true })
        .eq("log_id", logId)) as unknown as { count: number | null };
    const room = Math.max(0, MAX_MOMENTS_PER_RECORD - (existing ?? 0));
    const toAdd = moments.slice(0, room);
    const skippedMoments = moments.length - toAdd.length;

    const rows: Record<string, unknown>[] = [];
    for (const m of toAdd) {
        const images = (m.images ?? []).slice(0, MAX_IMAGES_PER_MOMENT);
        if (images.length === 0) continue;
        const first = momentImageSchema.safeParse(images[0]);
        if (!first.success) continue;
        const urls: string[] = [];
        for (const img of images) {
            const p = momentImageSchema.safeParse(img);
            if (!p.success) continue;
            // D5 lesson: never trust a client-supplied storage path.
            if (!isValidMakingPath(p.data.path, logData.horse_id)) continue;
            urls.push(getPublicImageUrl(p.data.path));
        }
        if (urls.length === 0) continue;
        rows.push({
            log_id: logId,
            author_id: user.id,
            stage: decodeHtmlEntities(sanitizeText(first.data.stage)).slice(0, MAX_STAGE_LABEL) || "progress",
            caption: first.data.caption ? decodeHtmlEntities(sanitizeText(first.data.caption)) : null,
            claimed_date: first.data.claimedDate ?? null,
            is_public: first.data.isPublic ?? true,
            image_urls: urls,
            sort_order: rows.length + (existing ?? 0),
        });
    }
    if (rows.length === 0) return { success: false, error: "No valid photos to attach." };

    const { error } = (await loose(supabase).from("work_moments").insert(rows)) as { error: DbError };
    if (error) {
        logger.error("WorkRecords", "moments insert failed", { message: error.message });
        return { success: false, error: "Could not save the moments." };
    }

    revalidatePath(`/stable/${logData.horse_id}`);
    revalidatePath(`/community/${logData.horse_id}`);
    return { success: true, added: rows.length, skipped: skippedMoments };
}

// ══════════════════════════════════════════════════════════════
// Reads
// ══════════════════════════════════════════════════════════════

/**
 * Every work record the viewer may see for one horse, with reels and
 * viewer capabilities. The owner additionally sees unconfirmed
 * records (they must be able to review a pending credit); the artist
 * sees their own. Disavowed records only show to the disavowing
 * artist.
 */
export async function getMakingForHorse(horseId: string): Promise<WorkRecordView[]> {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const viewerId = auth?.user?.id ?? null;

    const { data: logsData, error } = (await loose(supabase)
        .from("customization_logs")
        .select(
            "id, horse_id, work_type, artist_alias, artist_user_id, materials_used, date_completed, commission_id, summary, claimed_start, recorded_by, owner_confirmed_at, disavowed_at, reel_public, created_at",
        )
        .eq("horse_id", horseId)
        .order("date_completed", { ascending: false, nullsFirst: false })) as {
        data: LogRow[] | null;
        error: DbError;
    };
    if (error || !logsData || logsData.length === 0) {
        if (error && !isMissingSchema(error)) {
            logger.error("WorkRecords", "read failed", { message: error.message });
        }
        return [];
    }

    const { data: horse } = await supabase
        .from("user_horses")
        .select("owner_id")
        .eq("id", horseId)
        .single();
    const ownerId = horse?.owner_id ?? null;

    const ids = logsData.map((l) => l.id);
    const { data: momentsData } = (await loose(supabase)
        .from("work_moments")
        .select("id, log_id, stage, caption, image_urls, claimed_date, is_public, created_at, sort_order")
        .in("log_id", ids)
        .order("sort_order")
        .order("created_at")) as { data: MomentRow[] | null; error: DbError };
    const byLog = new Map<string, WorkMomentView[]>();
    for (const m of momentsData ?? []) {
        const list = byLog.get(m.log_id) ?? [];
        list.push({
            id: m.id,
            stage: m.stage ?? "progress",
            caption: m.caption,
            imageUrls: m.image_urls ?? [],
            claimedDate: m.claimed_date,
            isPublic: m.is_public,
            createdAt: m.created_at,
        });
        byLog.set(m.log_id, list);
    }

    const out: WorkRecordView[] = [];
    for (const l of logsData) {
        const viewerIsArtist = !!viewerId && l.artist_user_id === viewerId;
        const viewerIsOwner = !!viewerId && ownerId === viewerId;
        const artistIsOwner = !!l.artist_user_id && l.artist_user_id === ownerId;
        const confirmed = l.owner_confirmed_at != null;

        if (l.disavowed_at && !viewerIsArtist) continue;
        // Public display rule: confirmed, the artist owns the horse, or
        // the OWNER recorded it (creating the credit IS their consent —
        // the stamp protects owners from artist claims, not from their
        // own entries). Parties always see their own records.
        if (
            !confirmed &&
            !artistIsOwner &&
            l.recorded_by !== "owner" &&
            !viewerIsArtist &&
            !viewerIsOwner
        )
            continue;
        if (!(l.reel_public ?? true) && !viewerIsArtist && !viewerIsOwner) continue;

        out.push({
            id: l.id,
            horseId: l.horse_id,
            workType: l.work_type,
            artistAlias: l.artist_alias,
            artistUserId: l.artist_user_id,
            summary: l.summary ?? null,
            materialsUsed: l.materials_used,
            claimedStart: l.claimed_start ?? null,
            dateCompleted: l.date_completed,
            recordedBy: l.recorded_by ?? "commission",
            ownerConfirmedAt: l.owner_confirmed_at ?? null,
            disavowedAt: l.disavowed_at ?? null,
            reelPublic: l.reel_public ?? true,
            commissionId: l.commission_id ?? null,
            moments: byLog.get(l.id) ?? [],
            viewerIsArtist,
            viewerIsOwner,
            artistIsOwner,
            awaitingOwner:
                viewerIsOwner && !confirmed && !artistIsOwner && l.recorded_by === "artist" && !l.disavowed_at,
        });
    }
    return out;
}

/** Anon surface: the DEFINER RPC (202) does all gating. */
export async function getPublicMaking(horseId: string): Promise<WorkRecordView[]> {
    const supabase = await createClient();
    const { data, error } = await loose(supabase).rpc("get_public_making", { p_horse: horseId });
    if (error || !data) return [];
    const rows = data as Array<{
        id: string; work_type: string; artist_alias: string | null; artist_user_id: string | null;
        summary: string | null; claimed_start: string | null; date_completed: string | null;
        recorded_by: string; verified: boolean;
        moments: Array<{ id: string; stage: string; caption: string | null; image_urls: string[]; claimed_date: string | null; created_at: string }>;
    }>;
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
        id: r.id,
        horseId,
        workType: r.work_type,
        artistAlias: r.artist_alias,
        artistUserId: r.artist_user_id,
        summary: r.summary,
        materialsUsed: null,
        claimedStart: r.claimed_start,
        dateCompleted: r.date_completed,
        recordedBy: r.recorded_by,
        ownerConfirmedAt: r.verified ? "confirmed" : null,
        disavowedAt: null,
        reelPublic: true,
        commissionId: null,
        moments: (r.moments ?? []).map((m) => ({
            id: m.id,
            stage: m.stage ?? "progress",
            caption: m.caption,
            imageUrls: m.image_urls ?? [],
            claimedDate: m.claimed_date,
            isPublic: true,
            createdAt: m.created_at,
        })),
        viewerIsArtist: false,
        viewerIsOwner: false,
        // An unverified artist-recorded row only passes the RPC's
        // display gate when the artist owns the horse.
        artistIsOwner: r.recorded_by === "artist" && !r.verified,
        awaitingOwner: false,
    }));
}

// ══════════════════════════════════════════════════════════════
// Stamps
// ══════════════════════════════════════════════════════════════

async function stamp(
    fn: "confirm_work_record" | "disavow_work_record",
    logId: string,
): Promise<{ success: boolean; error?: string }> {
    const { supabase } = await requireAuth();
    if (!z.string().uuid().safeParse(logId).success) return { success: false, error: "Bad id." };
    const { data, error } = await loose(supabase).rpc(fn, { p_log: logId });
    if (error) {
        logger.error("WorkRecords", `${fn} failed`, { message: error.message });
        return { success: false, error: "Could not update the record." };
    }
    if (!data) return { success: false, error: "Nothing to change — check the record." };
    return { success: true };
}

export async function confirmWorkRecord(logId: string, horseId?: string) {
    const res = await stamp("confirm_work_record", logId);
    if (res.success && horseId) {
        revalidatePath(`/stable/${horseId}`);
        revalidatePath(`/community/${horseId}`);
        // Tell the artist their credit is now verified.
        after(async () => {
            const admin = getAdminClient();
            const { data: log } = (await loose(admin)
                .from("customization_logs")
                .select("artist_user_id, artist_alias, horse_id")
                .eq("id", logId)
                .single()) as { data: { artist_user_id: string | null; horse_id: string } | null };
            if (log?.artist_user_id) {
                await createNotification({
                    userId: log.artist_user_id,
                    type: "work_record",
                    content: "The owner confirmed your work record — the credit is now verified. ✓",
                    horseId: log.horse_id,
                    linkUrl: `/community/${log.horse_id}`,
                });
            }
        });
    }
    return res;
}

export async function disavowWorkRecord(logId: string, horseId?: string) {
    const res = await stamp("disavow_work_record", logId);
    if (res.success && horseId) {
        revalidatePath(`/stable/${horseId}`);
        revalidatePath(`/community/${horseId}`);
    }
    return res;
}

export async function setWorkRecordReelPublic(logId: string, isPublic: boolean, horseId?: string) {
    const { supabase } = await requireAuth();
    if (!z.string().uuid().safeParse(logId).success) return { success: false, error: "Bad id." };
    const { data, error } = await loose(supabase).rpc("set_work_record_reel_public", {
        p_log: logId,
        p_public: isPublic,
    });
    if (error || !data) return { success: false, error: "Could not update visibility." };
    if (horseId) {
        revalidatePath(`/stable/${horseId}`);
        revalidatePath(`/community/${horseId}`);
    }
    return { success: true };
}

/** The artist withdraws their own artist-recorded log (RLS enforces). */
export async function deleteWorkRecord(logId: string, horseId?: string) {
    const { supabase } = await requireAuth();
    if (!z.string().uuid().safeParse(logId).success) return { success: false, error: "Bad id." };
    const { error } = (await loose(supabase)
        .from("customization_logs")
        .delete()
        .eq("id", logId)) as { error: DbError };
    if (error) return { success: false, error: "Could not delete the record." };
    if (horseId) {
        revalidatePath(`/stable/${horseId}`);
        revalidatePath(`/community/${horseId}`);
    }
    return { success: true };
}
