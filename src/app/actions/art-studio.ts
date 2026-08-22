"use server";

import { revalidatePath } from "next/cache";

import { requireAuth, getUserTier } from "@/lib/auth";
import { entitledTier } from "@/lib/entitlement/clock";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStudioColumnSupport } from "@/lib/studio/columnSupport";
import {
    ACTIVE_STATUSES,
    canTransition,
    normalizeStatus,
    slotState,
    intakeFor,
    STATUS_LABELS,
    type CommissionStatus,
    type Party,
    type StudioStatus,
} from "@/lib/studio/pipeline";
import {
    coerceTerms,
    depositFor,
    snapshotTerms,
    type StudioTerms,
    type TermsSnapshot,
} from "@/lib/studio/terms";
import { coerceServices, studioPriceRange, type StudioService } from "@/lib/studio/services";
import { resolveAvatarUrls } from "@/lib/utils/avatars.server";

/**
 * ART STUDIO — server actions.
 *
 * Rebuilt on the pipeline in src/lib/studio/pipeline.ts. Rules that hold
 * everywhere in this file:
 *
 *   1. The state machine is ENFORCED here, never in the UI. Every status
 *      change goes through `transitionCommission`, which asks
 *      `canTransition` and refuses anything it doesn't recognise.
 *   2. PAYMENTS ARE OFF-PLATFORM. Nothing here moves money. Prices,
 *      deposits and "paid" flags are the parties' own records.
 *   3. Notifications go through `createNotification` via dynamic import
 *      inside try/catch — it is server-only and must never take an action
 *      down. (v1 did raw inserts under the user's session against a table
 *      with no INSERT policy, so no studio notification has ever landed.)
 *   4. Every new column from migration 170 is feature-detected. Until it is
 *      pasted, the studio degrades to v1 behaviour rather than 500ing.
 */

// ── Types ─────────────────────────────────────────────────────────────

export interface ArtistProfile {
    userId: string;
    studioName: string;
    studioSlug: string;
    specialties: string[];
    mediums: string[];
    scalesOffered: string[];
    bioArtist: string | null;
    portfolioVisible: boolean;
    status: StudioStatus;
    statusNote: string | null;
    maxSlots: number;
    waitlistOpen: boolean;
    services: StudioService[];
    terms: StudioTerms;
    priceLabel: string;
    paypalMeLink: string | null;
    acceptingTypes: string[];
    ownerAlias: string;
    ownerAvatarUrl: string | null;
}

export interface Commission {
    id: string;
    artistId: string;
    clientId: string | null;
    clientEmail: string | null;
    horseId: string | null;
    commissionType: string;
    serviceScale: string | null;
    description: string;
    referenceImages: string[];
    slotNumber: number | null;
    isWaitlist: boolean;
    estimatedCompletion: string | null;
    budgetAmount: number | null;
    /** The artist's quote, and — once accepted — the agreed price. */
    agreedPrice: number | null;
    quoteNote: string | null;
    termsSnapshot: TermsSnapshot | null;
    depositAmount: number | null;
    depositPaid: boolean;
    finalPaid: boolean;
    paymentNote: string | null;
    revisionsUsed: number;
    revisionsIncluded: number;
    modelReceived: boolean;
    trackingNote: string | null;
    status: CommissionStatus;
    /** The raw column value, for debugging a legacy row. */
    rawStatus: string;
    statusLabel: string;
    isPublicInQueue: boolean;
    closeReason: string | null;
    vaultRecorded: boolean;
    quotedAt: string | null;
    acceptedAt: string | null;
    completedAt: string | null;
    lastUpdateAt: string;
    createdAt: string;
    clientAlias: string | null;
    artistAlias: string;
    guestToken: string | null;
}

export interface CommissionUpdate {
    id: string;
    commissionId: string;
    authorId: string;
    authorAlias: string;
    authorAvatarUrl: string | null;
    updateType: string;
    title: string | null;
    body: string | null;
    imageUrls: string[];
    oldStatus: string | null;
    newStatus: string | null;
    requiresPayment: boolean;
    isVisibleToClient: boolean;
    createdAt: string;
}

/** One finished horse on the artist's receipts wall. */
export interface FinishedHorse {
    horseId: string;
    horseName: string;
    workType: string | null;
    dateCompleted: string | null;
    imageUrls: string[];
    isPublic: boolean;
    verified: boolean;
    showCount: number;
    nanQualifyingCount: number;
    bestPlacing: number | null;
    titles: string[];
}

export interface ActionResult {
    success: boolean;
    error?: string;
}

type Row = Record<string, unknown>;
/** Writes touch columns the generated types don't know about until 170 lands. */
type Patch = Record<string, unknown>;

/**
 * A PostgREST handle for relations the generated types haven't caught up
 * with — specifically migration 170's `v_artist_finished_horses` view.
 * Narrow by hand rather than reaching for `any`: the generated `from()`
 * overloads can't resolve an unknown relation name and tip tsc into
 * "type instantiation is excessively deep".
 */
interface UntypedQuery extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
    select: (columns: string) => UntypedQuery;
    eq: (column: string, value: unknown) => UntypedQuery;
    order: (column: string, options?: { ascending?: boolean }) => UntypedQuery;
    limit: (count: number) => UntypedQuery;
}

function untyped(client: unknown): { from: (relation: string) => UntypedQuery } {
    return client as { from: (relation: string) => UntypedQuery };
}

// ── Small helpers ─────────────────────────────────────────────────────

function str(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function slugify(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function parseArrayField(formData: FormData, field: string): string[] {
    const raw = formData.get(field) as string | null;
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
}

/**
 * Fire-and-forget notification. Dynamic import + try/catch is mandatory:
 * createNotification is `import "server-only"` and must never be reachable
 * from a client bundle or able to fail the parent action.
 */
async function notify(input: {
    userId: string;
    actorId: string;
    content: string;
    linkUrl: string;
    horseId?: string;
}): Promise<void> {
    try {
        const { createNotification } = await import("@/lib/notifications/createNotification");
        await createNotification({ type: "commission", ...input });
    } catch (err) {
        logger.error("ArtStudio", "Notification failed (continuing)", err);
    }
}

function revalidateCommission(commissionId: string, slug?: string | null): void {
    revalidatePath(`/studio/commission/${commissionId}`);
    revalidatePath("/studio/dashboard");
    revalidatePath("/studio/my-commissions");
    if (slug) revalidatePath(`/studio/${slug}`);
}

// ── Mapping ───────────────────────────────────────────────────────────

function mapArtistProfile(p: Row, alias: string, avatarUrl: string | null): ArtistProfile {
    // Services come from the jsonb column when 170 is applied; otherwise we
    // synthesise one from the v1 flat range so the page is never blank.
    let services = coerceServices(p.services);
    if (services.length === 0 && (p.price_range_min != null || p.price_range_max != null)) {
        services = coerceServices([
            {
                id: "legacy-range",
                type: (p.specialties as string[] | null)?.[0] ?? "Commissions",
                scale: (p.scales_offered as string[] | null)?.[0] ?? "Any scale",
                priceMin: p.price_range_min,
                priceMax: p.price_range_max,
                open: true,
            },
        ]);
    }

    // Terms read from the structured columns when present, and fall back to
    // the researched defaults plus the v1 prose blob as an addendum.
    const terms = coerceTerms({
        deposit_percent: p.deposit_percent,
        deposit_refundable_before_start: p.deposit_refundable_before_start,
        revisions_included: p.revisions_included,
        extra_revision_fee: p.extra_revision_fee,
        kill_fee_percent: p.kill_fee_percent,
        turnaround_min_days: p.turnaround_min_days,
        turnaround_max_days: p.turnaround_max_days,
        accepts_rush: p.accepts_rush,
        client_ships_model: p.client_ships_model,
        shipping_note: p.shipping_note,
        terms_text: p.terms_text,
    });

    const rawStatus = String(p.status ?? "closed");
    const status: StudioStatus =
        rawStatus === "open" || rawStatus === "waitlist" ? rawStatus : "closed";

    return {
        userId: String(p.user_id),
        studioName: String(p.studio_name ?? "Studio"),
        studioSlug: String(p.studio_slug ?? ""),
        specialties: (p.specialties as string[]) ?? [],
        mediums: (p.mediums as string[]) ?? [],
        scalesOffered: (p.scales_offered as string[]) ?? [],
        bioArtist: str(p.bio_artist),
        portfolioVisible: p.portfolio_visible !== false,
        status,
        statusNote: str(p.status_note),
        maxSlots: typeof p.max_slots === "number" ? p.max_slots : 5,
        waitlistOpen: p.waitlist_open !== false,
        services,
        terms,
        priceLabel: studioPriceRange(services).label,
        paypalMeLink: str(p.paypal_me_link),
        acceptingTypes: (p.accepting_types as string[]) ?? [],
        ownerAlias: alias,
        ownerAvatarUrl: avatarUrl,
    };
}

function mapCommission(c: Row): Commission {
    const rawStatus = String(c.status ?? "requested");
    const status = normalizeStatus(rawStatus);

    // agreed_price is 170's column; v1 rows carry the number in price_quoted
    // (where it was, wrongly, the CLIENT's budget — but it is the only figure
    // those rows have, so it is what we show).
    const agreedPrice = num(c.agreed_price) ?? num(c.price_quoted);
    const snapshot = (c.terms_snapshot as TermsSnapshot | null) ?? null;

    return {
        id: String(c.id),
        artistId: String(c.artist_id),
        clientId: (c.client_id as string | null) ?? null,
        clientEmail: str(c.client_email),
        horseId: (c.horse_id as string | null) ?? null,
        commissionType: String(c.commission_type ?? "Commission"),
        serviceScale: str(c.service_scale),
        description: String(c.description ?? ""),
        referenceImages: (c.reference_images as string[]) ?? [],
        slotNumber: (c.slot_number as number | null) ?? null,
        isWaitlist: c.is_waitlist === true,
        estimatedCompletion: (c.estimated_completion as string | null) ?? null,
        budgetAmount: num(c.budget_amount),
        agreedPrice,
        quoteNote: str(c.quote_note),
        termsSnapshot: snapshot,
        depositAmount:
            num(c.deposit_amount) ??
            (snapshot ? depositFor(agreedPrice, snapshot.depositPercent) : null),
        depositPaid: c.deposit_paid === true,
        finalPaid: c.final_paid === true,
        paymentNote: str(c.payment_note),
        revisionsUsed: typeof c.revisions_used === "number" ? c.revisions_used : 0,
        revisionsIncluded:
            typeof c.revisions_included === "number"
                ? c.revisions_included
                : (snapshot?.revisionsIncluded ?? 0),
        modelReceived: c.model_received === true,
        trackingNote: str(c.tracking_note),
        status,
        rawStatus,
        statusLabel: STATUS_LABELS[status],
        isPublicInQueue: c.is_public_in_queue !== false,
        closeReason: str(c.close_reason),
        vaultRecorded: c.vault_recorded_at != null,
        quotedAt: (c.quoted_at as string | null) ?? null,
        acceptedAt: (c.accepted_at as string | null) ?? null,
        completedAt: (c.completed_at as string | null) ?? (c.actual_completion as string | null) ?? null,
        lastUpdateAt: String(c.last_update_at ?? c.created_at ?? new Date().toISOString()),
        createdAt: String(c.created_at ?? new Date().toISOString()),
        clientAlias: (c.client as { alias_name: string } | null)?.alias_name ?? null,
        artistAlias: (c.artist as { alias_name: string } | null)?.alias_name ?? "Unknown",
        guestToken: (c.guest_token as string | null) ?? null,
    };
}

const COMMISSION_SELECT =
    "*, client:users!client_id(alias_name), artist:users!artist_id(alias_name)";

// ============================================================
// ARTIST PROFILES
// ============================================================

async function loadOwner(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
): Promise<{ alias: string; avatarUrl: string | null }> {
    const { data } = await supabase
        .from("users")
        .select("alias_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
    const u = data as { alias_name: string; avatar_url: string | null } | null;
    if (!u) return { alias: "Unknown", avatarUrl: null };
    const resolved = u.avatar_url
        ? (await resolveAvatarUrls([u.avatar_url])).get(u.avatar_url) ?? u.avatar_url
        : null;
    return { alias: u.alias_name ?? "Unknown", avatarUrl: resolved };
}

export async function getArtistProfile(userId: string): Promise<ArtistProfile | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("artist_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
    if (!data) return null;
    const owner = await loadOwner(supabase, userId);
    return mapArtistProfile(data as Row, owner.alias, owner.avatarUrl);
}

export async function getArtistProfileBySlug(slug: string): Promise<ArtistProfile | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("artist_profiles")
        .select("*")
        .eq("studio_slug", slug.toLowerCase().trim())
        .maybeSingle();
    if (!data) return null;
    const row = data as Row;
    const owner = await loadOwner(supabase, String(row.user_id));
    return mapArtistProfile(row, owner.alias, owner.avatarUrl);
}

/**
 * How full each artist's bench is.
 *
 * Studio pages are public, so "3 of 5 slots filled" has to be true for a
 * visitor with no account — and a logged-out client cannot read
 * `commissions` at all. Migration 170's SECURITY DEFINER RPC returns the
 * count and nothing else. Without it we fall back to counting rows
 * directly, which is accurate for the artist and their commissioners and
 * simply reads low for anonymous visitors.
 */
async function slotUsageFor(
    supabase: Awaited<ReturnType<typeof createClient>>,
    artistUserIds: string[],
): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (artistUserIds.length === 0) return out;

    try {
        const { data, error } = await supabase.rpc("studio_slot_usage" as never, {
            p_artist_ids: artistUserIds,
        } as never);
        if (!error && Array.isArray(data)) {
            for (const row of data as Row[]) {
                out.set(String(row.artist_id), Number(row.slots_used ?? 0));
            }
            return out;
        }
    } catch {
        // RPC absent (pre-170) — fall through to the direct count.
    }

    const { data: rows } = await supabase
        .from("commissions")
        .select("artist_id")
        .in("artist_id", artistUserIds)
        // Legacy statuses included so a v1 row still occupies its slot.
        .in("status", [...ACTIVE_STATUSES, "review", "revision", "shipping"]);
    for (const row of ((rows as Row[] | null) ?? [])) {
        const id = String(row.artist_id);
        out.set(id, (out.get(id) ?? 0) + 1);
    }
    return out;
}

/** How full one artist's bench is. */
export async function getSlotUsage(artistUserId: string): Promise<number> {
    const supabase = await createClient();
    const usage = await slotUsageFor(supabase, [artistUserId]);
    return usage.get(artistUserId) ?? 0;
}

export async function createArtistProfile(
    formData: FormData,
): Promise<ActionResult & { slug?: string }> {
    const { supabase, user } = await requireAuth();

    const studioName = str(formData.get("studioName"));
    if (!studioName) return { success: false, error: "Your studio needs a name." };

    const slug = slugify(str(formData.get("studioSlug")) || studioName);
    if (!slug) {
        return { success: false, error: "That studio name can't be turned into a web address — try adding a letter or number." };
    }

    const { data: taken } = await supabase
        .from("artist_profiles")
        .select("user_id")
        .eq("studio_slug", slug)
        .maybeSingle();
    if (taken) return { success: false, error: `The address “${slug}” is already taken.` };

    const { data: existing } = await supabase
        .from("artist_profiles")
        .select("studio_slug")
        .eq("user_id", user.id)
        .maybeSingle();
    if (existing) {
        return { success: false, error: "You already have a studio — edit that one instead." };
    }

    const { error } = await supabase.from("artist_profiles").insert({
        user_id: user.id,
        studio_name: studioName,
        studio_slug: slug,
        specialties: parseArrayField(formData, "specialties"),
        mediums: parseArrayField(formData, "mediums"),
        scales_offered: parseArrayField(formData, "scalesOffered"),
        accepting_types: parseArrayField(formData, "acceptingTypes"),
        bio_artist: str(formData.get("bioArtist")),
        // A new studio opens CLOSED. Announcing yourself as open before
        // you have terms or services listed is how artists end up with a
        // queue they never agreed to.
        status: "closed",
        max_slots: Number(formData.get("maxSlots")) || 5,
        paypal_me_link: str(formData.get("paypalMeLink")),
    } as Patch as never);

    if (error) return { success: false, error: error.message };

    revalidatePath("/studio");
    revalidatePath("/studio/setup");
    revalidatePath(`/studio/${slug}`);
    return { success: true, slug };
}

export async function updateArtistProfile(formData: FormData): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const studioName = str(formData.get("studioName"));
    if (!studioName) return { success: false, error: "Your studio needs a name." };

    const requestedSlug = str(formData.get("studioSlug"));
    const newSlug = requestedSlug ? slugify(requestedSlug) : null;

    if (newSlug) {
        const { data: taken } = await supabase
            .from("artist_profiles")
            .select("user_id")
            .eq("studio_slug", newSlug)
            .neq("user_id", user.id)
            .maybeSingle();
        if (taken) return { success: false, error: `The address “${newSlug}” is already taken.` };
    }

    const patch: Patch = {
        studio_name: studioName,
        specialties: parseArrayField(formData, "specialties"),
        mediums: parseArrayField(formData, "mediums"),
        scales_offered: parseArrayField(formData, "scalesOffered"),
        accepting_types: parseArrayField(formData, "acceptingTypes"),
        bio_artist: str(formData.get("bioArtist")),
        paypal_me_link: str(formData.get("paypalMeLink")),
        updated_at: new Date().toISOString(),
    };
    if (newSlug) patch.studio_slug = newSlug;

    const { error } = await supabase
        .from("artist_profiles")
        .update(patch as never)
        .eq("user_id", user.id);
    if (error) return { success: false, error: error.message };

    revalidatePath("/studio");
    revalidatePath("/studio/setup");
    revalidatePath("/studio/dashboard");
    // v1 revalidated an empty path when the slug was unchanged.
    if (newSlug) revalidatePath(`/studio/${newSlug}`);
    return { success: true };
}

/**
 * Intake controls: open/waitlist/closed, slot count, and the note that
 * explains it ("slots open Sept 1"). Separate from the profile editor
 * because artists change this weekly and everything else almost never.
 */
export async function setStudioIntake(input: {
    status: StudioStatus;
    maxSlots: number;
    waitlistOpen: boolean;
    statusNote?: string | null;
}): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    if (!["open", "waitlist", "closed"].includes(input.status)) {
        return { success: false, error: "That isn't a studio status." };
    }
    const maxSlots = Math.min(20, Math.max(1, Math.round(input.maxSlots || 5)));

    const support = await getStudioColumnSupport(supabase as never);
    const patch: Patch = {
        status: input.status,
        max_slots: maxSlots,
        updated_at: new Date().toISOString(),
    };
    if (support.studioTerms) {
        patch.waitlist_open = input.waitlistOpen !== false;
        patch.status_note = str(input.statusNote);
    }

    const { data, error } = await supabase
        .from("artist_profiles")
        .update(patch as never)
        .eq("user_id", user.id)
        .select("studio_slug")
        .maybeSingle();
    if (error) return { success: false, error: error.message };

    revalidatePath("/studio");
    revalidatePath("/studio/dashboard");
    const slug = (data as { studio_slug: string } | null)?.studio_slug;
    if (slug) revalidatePath(`/studio/${slug}`);
    return { success: true };
}

/**
 * The terms editor. Structured fields, not a blob — so they can be shown
 * at the moment of decision and frozen onto an agreement at acceptance.
 */
export async function updateStudioTerms(terms: StudioTerms): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();
    const clean = coerceTerms(terms);

    const support = await getStudioColumnSupport(supabase as never);
    if (!support.studioTerms) {
        // Without 170 we can still persist the human-readable form, so the
        // artist's work isn't lost — it just isn't structured yet.
        const { error } = await supabase
            .from("artist_profiles")
            .update({
                terms_text: clean.extraNote,
                turnaround_min_days: clean.turnaroundMinDays,
                turnaround_max_days: clean.turnaroundMaxDays,
                updated_at: new Date().toISOString(),
            } as Patch as never)
            .eq("user_id", user.id);
        return error ? { success: false, error: error.message } : { success: true };
    }

    const { data, error } = await supabase
        .from("artist_profiles")
        .update({
            deposit_percent: clean.depositPercent,
            deposit_refundable_before_start: clean.depositRefundableBeforeStart,
            revisions_included: clean.revisionsIncluded,
            extra_revision_fee: clean.extraRevisionFee,
            kill_fee_percent: clean.killFeePercent,
            turnaround_min_days: clean.turnaroundMinDays,
            turnaround_max_days: clean.turnaroundMaxDays,
            accepts_rush: clean.acceptsRush,
            client_ships_model: clean.clientShipsModel,
            shipping_note: clean.shippingNote,
            terms_text: clean.extraNote,
            terms_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        } as Patch as never)
        .eq("user_id", user.id)
        .select("studio_slug")
        .maybeSingle();
    if (error) return { success: false, error: error.message };

    const slug = (data as { studio_slug: string } | null)?.studio_slug;
    if (slug) revalidatePath(`/studio/${slug}`);
    revalidatePath("/studio/dashboard");
    return { success: true };
}

/** The rate card: what the artist offers, per scale, with a price range. */
export async function updateStudioServices(services: StudioService[]): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();
    const clean = coerceServices(services);
    if (clean.length > 30) {
        return { success: false, error: "That's more than 30 services — trim the list a little." };
    }

    const support = await getStudioColumnSupport(supabase as never);
    if (!support.studioTerms) {
        return {
            success: false,
            error: "The rate card needs a database update that hasn't been applied yet. Your existing price range still shows.",
        };
    }

    // Keep the legacy flat range in step so anything still reading it
    // (and any un-migrated cache) shows a number consistent with the card.
    const range = studioPriceRange(clean);
    const { data, error } = await supabase
        .from("artist_profiles")
        .update({
            services: clean,
            price_range_min: range.min,
            price_range_max: range.max,
            updated_at: new Date().toISOString(),
        } as Patch as never)
        .eq("user_id", user.id)
        .select("studio_slug")
        .maybeSingle();
    if (error) return { success: false, error: error.message };

    const slug = (data as { studio_slug: string } | null)?.studio_slug;
    if (slug) revalidatePath(`/studio/${slug}`);
    revalidatePath("/studio");
    revalidatePath("/studio/dashboard");
    return { success: true };
}

// ============================================================
// DIRECTORY
// ============================================================

export interface DirectoryEntry extends ArtistProfile {
    slotsUsed: number;
    effectiveStatus: StudioStatus;
    slotLabel: string;
    finishedCount: number;
}

/**
 * The directory. Open studios first — a browsable list that leads with
 * studios who cannot take work is a list nobody scrolls.
 */
export async function browseArtists(): Promise<DirectoryEntry[]> {
    const supabase = await createClient();

    const { data } = await supabase
        .from("artist_profiles")
        .select("*, owner:users!user_id(alias_name, avatar_url)")
        .eq("portfolio_visible", true)
        .order("updated_at", { ascending: false })
        .limit(100);

    const rows = (data as Row[] | null) ?? [];
    if (rows.length === 0) return [];

    const userIds = rows.map((r) => String(r.user_id));

    // Slot usage and proof-of-work for every studio on the page in two
    // passes rather than N round-trips each.
    const [usage, finished] = await Promise.all([
        slotUsageFor(supabase, userIds),
        countFinishedByArtist(supabase, userIds),
    ]);

    const avatarMap = await resolveAvatarUrls(
        rows
            .map((r) => (r.owner as { avatar_url: string | null } | null)?.avatar_url)
            .filter((u): u is string => !!u),
    );

    const entries = rows.map((r) => {
        const owner = r.owner as { alias_name: string; avatar_url: string | null } | null;
        const rawAvatar = owner?.avatar_url ?? null;
        const profile = mapArtistProfile(
            r,
            owner?.alias_name ?? "Unknown",
            rawAvatar ? (avatarMap.get(rawAvatar) ?? rawAvatar) : null,
        );
        const used = usage.get(profile.userId) ?? 0;
        const slots = slotState(used, profile.maxSlots, profile.status);
        return {
            ...profile,
            slotsUsed: used,
            effectiveStatus: slots.effectiveStatus,
            slotLabel: slots.label,
            finishedCount: finished.get(profile.userId) ?? 0,
        };
    });

    const rank: Record<StudioStatus, number> = { open: 0, waitlist: 1, closed: 2 };
    return entries.sort((a, b) => {
        const byStatus = rank[a.effectiveStatus] - rank[b.effectiveStatus];
        if (byStatus !== 0) return byStatus;
        // Then by proof of work, which is the thing worth ranking on.
        return b.finishedCount - a.finishedCount;
    });
}

async function countFinishedByArtist(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userIds: string[],
): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    try {
        const support = await getStudioColumnSupport(supabase as never);
        if (!support.logProvenance) return out;
        const { data } = await supabase
            .from("customization_logs")
            .select("artist_user_id")
            .in("artist_user_id", userIds);
        for (const row of ((data as Row[] | null) ?? [])) {
            const id = String(row.artist_user_id);
            out.set(id, (out.get(id) ?? 0) + 1);
        }
    } catch {
        // A missing column must never take the directory down.
    }
    return out;
}

// ============================================================
// THE RECEIPTS WALL
// ============================================================

/**
 * The horses this artist finished, with what those horses went on to win.
 *
 * This is the thing no other commission platform can render, because no
 * other commission platform owns the show database. An artist whose
 * customs take ribbons proves it here with receipts.
 *
 * Three levels of graceful degradation:
 *   with 170's view      — one query, full show record and titles
 *   with 170's columns   — join customization_logs by artist_user_id
 *   without 170          — match user_horses.finishing_artist by alias
 */
export async function getArtistPortfolio(
    artistUserId: string,
    artistAlias: string,
): Promise<FinishedHorse[]> {
    const supabase = await createClient();

    try {
        const support = await getStudioColumnSupport(supabase as never);

        if (support.receiptsView) {
            const { data, error } = await untyped(supabase)
                .from("v_artist_finished_horses")
                .select("*")
                .eq("artist_user_id", artistUserId)
                .order("date_completed", { ascending: false })
                .limit(60);
            if (!error && Array.isArray(data)) {
                return (data as Row[]).map((r) => ({
                    horseId: String(r.horse_id),
                    horseName: String(r.horse_name ?? "Unnamed"),
                    workType: str(r.work_type),
                    dateCompleted: (r.date_completed as string | null) ?? null,
                    imageUrls: (r.image_urls as string[]) ?? [],
                    isPublic: r.is_public !== false,
                    verified: r.finishing_artist_verified === true,
                    showCount: Number(r.show_count ?? 0),
                    nanQualifyingCount: Number(r.nan_qualifying_count ?? 0),
                    bestPlacing: r.best_placing == null ? null : Number(r.best_placing),
                    titles: (r.titles as string[]) ?? [],
                }));
            }
        }

        // Fallback: find the horses, then decorate them with their record.
        let horseIds: string[] = [];
        const logs = new Map<string, Row>();

        if (support.logProvenance) {
            const { data } = await supabase
                .from("customization_logs")
                .select("horse_id, work_type, date_completed, image_urls")
                .eq("artist_user_id", artistUserId)
                .order("date_completed", { ascending: false })
                .limit(60);
            for (const row of ((data as Row[] | null) ?? [])) {
                logs.set(String(row.horse_id), row);
            }
            horseIds = [...logs.keys()];
        }

        if (horseIds.length === 0 && artistAlias) {
            const { data } = await supabase
                .from("user_horses")
                .select("id")
                .eq("finishing_artist", artistAlias)
                .limit(60);
            horseIds = ((data as Row[] | null) ?? []).map((r) => String(r.id));
        }

        if (horseIds.length === 0) return [];
        return await decorateHorses(supabase, horseIds, logs);
    } catch (err) {
        logger.error("ArtStudio", "Portfolio lookup failed (showing none)", err);
        return [];
    }
}

async function decorateHorses(
    supabase: Awaited<ReturnType<typeof createClient>>,
    horseIds: string[],
    logs: Map<string, Row>,
): Promise<FinishedHorse[]> {
    // RLS decides what actually comes back — a private horse simply is not
    // in this result, so nothing leaks through the artist page.
    const { data: horseRows } = await supabase
        .from("user_horses")
        .select("id, custom_name, is_public, finishing_artist_verified")
        .in("id", horseIds);
    const horses = (horseRows as Row[] | null) ?? [];
    if (horses.length === 0) return [];

    const visibleIds = horses.map((h) => String(h.id));

    const [{ data: recordRows }, { data: titleRows }] = await Promise.all([
        supabase
            .from("show_records")
            .select("horse_id, placing, is_nan_qualifying")
            .in("horse_id", visibleIds),
        supabase.from("horse_titles").select("horse_id, title_code").in("horse_id", visibleIds),
    ]);

    const records = new Map<string, { count: number; nan: number; best: number | null }>();
    for (const row of ((recordRows as Row[] | null) ?? [])) {
        const id = String(row.horse_id);
        const entry = records.get(id) ?? { count: 0, nan: 0, best: null };
        entry.count += 1;
        if (row.is_nan_qualifying === true) entry.nan += 1;
        const digits = String(row.placing ?? "").replace(/\D/g, "");
        if (digits) {
            const place = Number(digits);
            if (Number.isFinite(place) && (entry.best == null || place < entry.best)) {
                entry.best = place;
            }
        }
        records.set(id, entry);
    }

    const titles = new Map<string, string[]>();
    for (const row of ((titleRows as Row[] | null) ?? [])) {
        const id = String(row.horse_id);
        titles.set(id, [...(titles.get(id) ?? []), String(row.title_code)]);
    }

    return horses
        .map((h) => {
            const id = String(h.id);
            const log = logs.get(id);
            const rec = records.get(id);
            return {
                horseId: id,
                horseName: String(h.custom_name ?? "Unnamed"),
                workType: log ? str(log.work_type) : null,
                dateCompleted: (log?.date_completed as string | null) ?? null,
                imageUrls: (log?.image_urls as string[]) ?? [],
                isPublic: h.is_public !== false,
                verified: h.finishing_artist_verified === true,
                showCount: rec?.count ?? 0,
                nanQualifyingCount: rec?.nan ?? 0,
                bestPlacing: rec?.best ?? null,
                titles: (titles.get(id) ?? []).sort(),
            };
        })
        .sort((a, b) => {
            // Decorated horses first: a wall that leads with the ribbons is
            // the whole point of the page.
            if (b.showCount !== a.showCount) return b.showCount - a.showCount;
            return (b.dateCompleted ?? "").localeCompare(a.dateCompleted ?? "");
        });
}

// ============================================================
// COMMISSIONS — reads
// ============================================================

export async function getArtistCommissions(): Promise<Commission[]> {
    const { supabase, user } = await requireAuth();
    const { data } = await supabase
        .from("commissions")
        .select(COMMISSION_SELECT)
        .eq("artist_id", user.id)
        .order("last_update_at", { ascending: false });
    return ((data as Row[] | null) ?? []).map(mapCommission);
}

export async function getClientCommissions(): Promise<Commission[]> {
    const { supabase, user } = await requireAuth();
    const { data } = await supabase
        .from("commissions")
        .select(COMMISSION_SELECT)
        .eq("client_id", user.id)
        .order("last_update_at", { ascending: false });
    return ((data as Row[] | null) ?? []).map(mapCommission);
}

export async function getCommission(commissionId: string): Promise<Commission | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("commissions")
        .select(COMMISSION_SELECT)
        .eq("id", commissionId)
        .maybeSingle();
    return data ? mapCommission(data as Row) : null;
}

export async function getCommissionUpdates(commissionId: string): Promise<CommissionUpdate[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("commission_updates")
        .select("*, author:users!author_id(alias_name, avatar_url)")
        .eq("commission_id", commissionId)
        .order("created_at", { ascending: true });

    const rows = (data as Row[] | null) ?? [];
    if (rows.length === 0) return [];

    const mapped = rows.map((u) => {
        const author = u.author as { alias_name: string; avatar_url: string | null } | null;
        return {
            id: String(u.id),
            commissionId: String(u.commission_id),
            authorId: String(u.author_id),
            authorAlias: author?.alias_name ?? "Unknown",
            authorAvatarUrl: author?.avatar_url ?? null,
            updateType: String(u.update_type),
            title: str(u.title),
            body: str(u.body),
            imageUrls: (u.image_urls as string[]) ?? [],
            oldStatus: (u.old_status as string | null) ?? null,
            newStatus: (u.new_status as string | null) ?? null,
            requiresPayment: u.requires_payment === true,
            isVisibleToClient: u.is_visible_to_client !== false,
            createdAt: String(u.created_at),
        };
    });

    const avatarMap = await resolveAvatarUrls(
        mapped.map((u) => u.authorAvatarUrl).filter((u): u is string => !!u),
    );
    for (const update of mapped) {
        if (update.authorAvatarUrl) {
            update.authorAvatarUrl = avatarMap.get(update.authorAvatarUrl) ?? update.authorAvatarUrl;
        }
    }
    return mapped;
}

// ============================================================
// COMMISSIONS — the pipeline
// ============================================================

/** Load a commission and work out which side of it the caller is on. */
async function loadParty(
    supabase: Awaited<ReturnType<typeof createClient>>,
    commissionId: string,
    userId: string,
): Promise<
    | { ok: true; row: Row; party: Party; status: CommissionStatus }
    | { ok: false; error: string }
> {
    const { data } = await supabase
        .from("commissions")
        .select("*")
        .eq("id", commissionId)
        .maybeSingle();
    if (!data) return { ok: false, error: "That commission no longer exists." };
    const row = data as Row;

    const party: Party | null =
        row.artist_id === userId ? "artist" : row.client_id === userId ? "client" : null;
    if (!party) return { ok: false, error: "You aren't part of this commission." };

    return { ok: true, row, party, status: normalizeStatus(String(row.status)) };
}

/**
 * A commissioner opens a request. This is an INQUIRY — it names a budget,
 * not a price. The artist quotes next. (v1 wrote the client's budget into
 * price_quoted and had the artist "accept" it, which inverted the one
 * negotiation the whole flow exists for.)
 */
export async function createCommission(data: {
    artistId: string;
    commissionType: string;
    serviceScale?: string;
    description: string;
    referenceImages?: string[];
    budget?: number;
    horseId?: string;
}): Promise<ActionResult & { commissionId?: string; waitlisted?: boolean }> {
    const { supabase, user } = await requireAuth();

    if (user.id === data.artistId) {
        return { success: false, error: "You can't commission yourself." };
    }
    const description = str(data.description);
    if (!description) {
        return { success: false, error: "Tell the artist what you're after — a request needs a description." };
    }
    const commissionType = str(data.commissionType);
    if (!commissionType) return { success: false, error: "Pick a service to request." };

    const { data: artistRow } = await supabase
        .from("artist_profiles")
        .select("*")
        .eq("user_id", data.artistId)
        .maybeSingle();
    if (!artistRow) return { success: false, error: "That studio doesn't exist." };
    const artist = artistRow as Row;
    const studioName = String(artist.studio_name ?? "This studio");

    // Intake follows the slot rules: a full bench queues rather than
    // refuses, so the artist keeps the demand signal — unless they've
    // explicitly turned the waitlist off.
    const used = await getSlotUsage(data.artistId);
    const slots = slotState(
        used,
        typeof artist.max_slots === "number" ? artist.max_slots : 5,
        String(artist.status ?? "closed") as StudioStatus,
    );
    const intake = intakeFor(slots, artist.waitlist_open !== false);
    if (!intake.accepting) {
        return { success: false, error: `${studioName} isn't taking commissions right now.` };
    }

    // Only link a horse the requester actually owns — v1 accepted any id.
    let horseId: string | null = null;
    if (data.horseId) {
        const { data: horse } = await supabase
            .from("user_horses")
            .select("id")
            .eq("id", data.horseId)
            .eq("owner_id", user.id)
            .maybeSingle();
        if (!horse) return { success: false, error: "That horse isn't in your stable." };
        horseId = data.horseId;
    }

    const support = await getStudioColumnSupport(supabase as never);
    const budget = num(data.budget);

    const insert: Patch = {
        artist_id: data.artistId,
        client_id: user.id,
        commission_type: commissionType,
        description,
        reference_images: (data.referenceImages ?? []).slice(0, 8),
        horse_id: horseId,
        status: "requested",
    };
    if (support.commissionAgreement) {
        insert.budget_amount = budget;
        insert.service_scale = str(data.serviceScale);
        insert.is_waitlist = intake.asWaitlist;
    } else {
        // v1 shape: the only money column is price_quoted.
        insert.price_quoted = budget;
    }

    const { data: created, error } = await supabase
        .from("commissions")
        .insert(insert as never)
        .select("id")
        .single();
    if (error) return { success: false, error: error.message };

    const commissionId = (created as { id: string }).id;

    await supabase.from("commission_updates").insert({
        commission_id: commissionId,
        author_id: user.id,
        update_type: "message",
        title: intake.asWaitlist ? "Waitlist request" : "Commission requested",
        body: description,
    } as Patch as never);

    await notify({
        userId: data.artistId,
        actorId: user.id,
        content: intake.asWaitlist
            ? `New waitlist request: ${commissionType}`
            : `New commission request: ${commissionType}`,
        linkUrl: `/studio/commission/${commissionId}`,
    });

    revalidateCommission(commissionId, str(artist.studio_slug));
    return { success: true, commissionId, waitlisted: intake.asWaitlist };
}

/**
 * The artist quotes: a price, a timeline, and the terms that apply. This
 * is the stage v1 had no representation for at all.
 *
 * A quote may be revised while it is still outstanding — the commissioner
 * has not agreed to anything yet, so nothing is being rewritten.
 */
/**
 * The free-tier workload cap (owner ruling 2026-08-21): a free studio
 * carries up to THREE active commissions at once; Studio Pro is
 * unlimited. "Active" = accepted through awaiting_approval (raw legacy
 * spellings included) — requests and quotes queue freely, the cap bites
 * when work is actually taken on. Enforced at both commitment points:
 * the artist quoting (their commitment) and the commissioner accepting
 * (which would put the work on the bench).
 */
const FREE_ACTIVE_COMMISSION_CAP = 3;
const ACTIVE_WORKLOAD_STATUSES = [
    "accepted",
    "in_progress",
    "awaiting_approval",
    // legacy v1 spellings that normalize into the two above
    "review",
    "revision",
];

async function countActiveWorkload(artistUserId: string): Promise<number> {
    // Admin client: the commissioner-side check must see the artist's
    // whole bench, not just rows RLS shows the caller.
    const admin = getAdminClient();
    const { count } = await admin
        .from("commissions")
        .select("id", { count: "exact", head: true })
        .eq("artist_id", artistUserId)
        .in("status", ACTIVE_WORKLOAD_STATUSES);
    return count ?? 0;
}

/** The artist's tier when the artist isn't the caller — app_metadata
 *  is only reachable through the auth admin API. Fails open to
 *  "studio" (never block a deal over a tier lookup hiccup). */
async function artistTier(artistUserId: string): Promise<string> {
    try {
        const admin = getAdminClient();
        const { data } = await admin.auth.admin.getUserById(artistUserId);
        // entitledTier applies the clock, so a Studio term that has run
        // out puts the bench cap back exactly as getUserTier would.
        return entitledTier(data.user?.app_metadata);
    } catch {
        return "studio";
    }
}

export async function sendQuote(
    commissionId: string,
    quote: {
        price: number;
        note?: string;
        estimatedCompletion?: string | null;
        revisionsIncluded?: number;
    },
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const loaded = await loadParty(supabase, commissionId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const { row, party, status } = loaded;

    const check = canTransition(status, "quoted", party);
    if (!check.ok) return { success: false, error: check.error };

    // Free-tier cap: quoting is the artist's commitment to take the
    // work on if accepted — a full free bench can't extend new quotes.
    const tier = await getUserTier();
    if (tier !== "studio") {
        const active = await countActiveWorkload(user.id);
        if (active >= FREE_ACTIVE_COMMISSION_CAP) {
            return {
                success: false,
                error: `Your bench is full — free studios carry ${FREE_ACTIVE_COMMISSION_CAP} active commissions at a time. Finish or deliver one, or upgrade to Studio Pro for an unlimited bench.`,
            };
        }
    }

    const price = num(quote.price);
    if (price == null || price <= 0) {
        return { success: false, error: "A quote needs a price." };
    }

    const support = await getStudioColumnSupport(supabase as never);
    const now = new Date().toISOString();

    const patch: Patch = {
        status: "quoted",
        estimated_completion: str(quote.estimatedCompletion),
        last_update_at: now,
        updated_at: now,
    };
    if (support.commissionAgreement) {
        patch.agreed_price = price;
        patch.quote_note = str(quote.note);
        patch.quoted_at = now;
        if (quote.revisionsIncluded != null) {
            patch.revisions_included = Math.max(0, Math.round(quote.revisionsIncluded));
        }
    } else {
        patch.price_quoted = price;
    }

    const { error } = await supabase
        .from("commissions")
        .update(patch as never)
        .eq("id", commissionId);
    if (error) return { success: false, error: error.message };

    await supabase.from("commission_updates").insert({
        commission_id: commissionId,
        author_id: user.id,
        update_type: "status_change",
        title: `Quoted $${price.toLocaleString("en-US")}`,
        body: str(quote.note),
        old_status: String(row.status),
        new_status: "quoted",
    } as Patch as never);

    const clientId = row.client_id as string | null;
    if (clientId) {
        await notify({
            userId: clientId,
            actorId: user.id,
            content: `You have a quote for your ${row.commission_type} commission: $${price.toLocaleString("en-US")}.`,
            linkUrl: `/studio/commission/${commissionId}`,
        });
    }

    revalidateCommission(commissionId);
    return { success: true };
}

/**
 * The one entry point for every status change. Asks the pure state machine
 * whether the move is legal FOR THIS PARTY, then performs the side effects
 * that belong to that particular transition.
 */
export async function transitionCommission(
    commissionId: string,
    to: CommissionStatus,
    note?: string,
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const loaded = await loadParty(supabase, commissionId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const { row, party, status } = loaded;

    const check = canTransition(status, to, party);
    if (!check.ok || !check.transition) {
        return { success: false, error: check.error ?? "That change isn't allowed." };
    }
    const rule = check.transition;

    const support = await getStudioColumnSupport(supabase as never);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const patch: Patch = { status: to, last_update_at: now, updated_at: now };

    if (to === "accepted") {
        // Free-tier cap, commissioner side: accepting a quote puts the
        // work on the artist's bench — a full free bench refuses with
        // an honest explanation rather than overbooking the artist.
        const tier = await artistTier(row.artist_id as string);
        if (tier !== "studio") {
            const active = await countActiveWorkload(row.artist_id as string);
            if (active >= FREE_ACTIVE_COMMISSION_CAP) {
                return {
                    success: false,
                    error: "This studio's bench is full (free studios carry 3 active commissions at a time). The artist needs to finish a piece — or upgrade to Studio Pro — before this one can be accepted.",
                };
            }
        }
    }

    if (to === "accepted") {
        // FREEZE THE AGREEMENT. The artist's terms as they stand right now
        // become this commission's terms, and stay that way whatever the
        // artist changes later. This is the dispute record.
        if (support.commissionAgreement) {
            const { data: profile } = await supabase
                .from("artist_profiles")
                .select("*")
                .eq("user_id", row.artist_id as string)
                .maybeSingle();
            const terms = coerceTerms({
                deposit_percent: (profile as Row | null)?.deposit_percent,
                deposit_refundable_before_start: (profile as Row | null)
                    ?.deposit_refundable_before_start,
                revisions_included:
                    (row.revisions_included as number | null) ??
                    (profile as Row | null)?.revisions_included,
                extra_revision_fee: (profile as Row | null)?.extra_revision_fee,
                kill_fee_percent: (profile as Row | null)?.kill_fee_percent,
                turnaround_min_days: (profile as Row | null)?.turnaround_min_days,
                turnaround_max_days: (profile as Row | null)?.turnaround_max_days,
                accepts_rush: (profile as Row | null)?.accepts_rush,
                client_ships_model: (profile as Row | null)?.client_ships_model,
                shipping_note: (profile as Row | null)?.shipping_note,
                terms_text: (profile as Row | null)?.terms_text,
            });
            const price = num(row.agreed_price) ?? num(row.price_quoted);
            const snapshot = snapshotTerms(terms, price);
            patch.terms_snapshot = snapshot;
            patch.revisions_included = terms.revisionsIncluded;
            patch.deposit_amount = snapshot.depositAmount;
            patch.accepted_at = now;
        }
    }

    if (to === "in_progress") {
        if (rule.consumesRevision) {
            // Count it. v1 had a `revision` status that nothing tallied,
            // which is the commonest source of commission disputes.
            const used = typeof row.revisions_used === "number" ? row.revisions_used : 0;
            if (support.commissionAgreement) patch.revisions_used = used + 1;
        } else if (!row.actual_start) {
            patch.actual_start = today;
            if (support.commissionAgreement) patch.started_at = now;
        }
    }

    if (to === "completed") {
        patch.actual_completion = today;
        if (support.commissionAgreement) patch.completed_at = now;
    }

    if (to === "declined" || to === "cancelled") {
        if (support.commissionAgreement) {
            patch.closed_at = now;
            patch.closed_by = user.id;
            patch.close_reason = str(note);
        }
    }

    const { error } = await supabase
        .from("commissions")
        .update(patch as never)
        .eq("id", commissionId);
    if (error) return { success: false, error: error.message };

    await supabase.from("commission_updates").insert({
        commission_id: commissionId,
        author_id: user.id,
        update_type: rule.consumesRevision ? "revision_request" : "status_change",
        title: rule.consumesRevision ? "Revision requested" : STATUS_LABELS[to],
        body: str(note),
        old_status: String(row.status),
        new_status: to,
    } as Patch as never);

    // Delivery is where a commission becomes a permanent record: a
    // reviewable transaction, the artist's credit on the horse, and the
    // horse's provenance entry. Each is best-effort and independent.
    if (to === "delivered") {
        await runDeliveryHooks(supabase, row, commissionId, user.id);
    }

    // Both sides always hear about it. Whoever did not act gets the ping.
    const other =
        party === "artist" ? (row.client_id as string | null) : (row.artist_id as string);
    if (other) {
        await notify({
            userId: other,
            actorId: user.id,
            content: commissionNotice(to, String(row.commission_type), rule.consumesRevision),
            linkUrl: `/studio/commission/${commissionId}`,
        });
    }

    revalidateCommission(commissionId);
    if (row.horse_id) revalidatePath(`/stable/${String(row.horse_id)}`);
    return { success: true };
}

function commissionNotice(
    to: CommissionStatus,
    type: string,
    isRevision?: boolean,
): string {
    if (isRevision) return `A revision was requested on your ${type} commission.`;
    switch (to) {
        case "accepted":
            return `Your quote for the ${type} commission was accepted.`;
        case "in_progress":
            return `Work has started on your ${type} commission.`;
        case "awaiting_approval":
            return `Your ${type} commission is ready for your approval.`;
        case "completed":
            return `Your ${type} commission was approved.`;
        case "delivered":
            return `Your ${type} commission has been marked delivered.`;
        case "declined":
            return `The ${type} commission was declined.`;
        case "cancelled":
            return `The ${type} commission was cancelled.`;
        default:
            return `Your ${type} commission is now ${STATUS_LABELS[to].toLowerCase()}.`;
    }
}

async function runDeliveryHooks(
    supabase: Awaited<ReturnType<typeof createClient>>,
    row: Row,
    commissionId: string,
    actorId: string,
): Promise<void> {
    const clientId = row.client_id as string | null;
    const artistId = String(row.artist_id);
    const horseId = row.horse_id as string | null;

    if (clientId) {
        try {
            const { createTransaction } = await import("@/app/actions/transactions");
            await createTransaction({
                type: "commission",
                partyAId: artistId,
                partyBId: clientId,
                commissionId,
                horseId: horseId ?? undefined,
                status: "completed",
            });
        } catch (err) {
            logger.error("ArtStudio", "Transaction record failed (continuing)", err);
        }
    }

    if (!horseId) return;

    // The verified-artist stamp. v1 wrote user_horses directly under the
    // artist's session, which RLS has always rejected — so this badge has
    // never once landed. The RPC in migration 170 is a narrow
    // SECURITY DEFINER that touches exactly the two credit columns.
    let artistAlias: string | null = null;
    try {
        const { data: artistUser } = await supabase
            .from("users")
            .select("alias_name")
            .eq("id", artistId)
            .maybeSingle();
        artistAlias = (artistUser as { alias_name: string } | null)?.alias_name ?? null;

        if (actorId === artistId) {
            const { error } = await supabase.rpc("stamp_finishing_artist" as never, {
                p_commission_id: commissionId,
            } as never);
            if (error) logger.error("ArtStudio", "Artist stamp unavailable", error.message);
        }
    } catch (err) {
        logger.error("ArtStudio", "Artist stamp failed (continuing)", err);
    }

    // Provenance: one consolidated customization_log carrying the WIP
    // photos, which surfaces on the horse's Hoofprint and — once 170 is
    // applied — joins back to the artist for their receipts wall.
    try {
        const support = await getStudioColumnSupport(supabase as never);

        const { data: wipRows } = await supabase
            .from("commission_updates")
            .select("title, body, image_urls")
            .eq("commission_id", commissionId)
            .eq("update_type", "wip_photo")
            .eq("is_visible_to_client", true)
            .order("created_at", { ascending: true });

        const images: string[] = [];
        const notes: string[] = [];
        for (const wip of ((wipRows as Row[] | null) ?? [])) {
            const urls = (wip.image_urls as string[]) ?? [];
            images.push(...urls);
            const text = str(wip.body) ?? str(wip.title);
            if (text) notes.push(text);
        }

        const log: Patch = {
            horse_id: horseId,
            work_type: String(row.commission_type),
            artist_alias: artistAlias,
            materials_used: notes.length
                ? notes.join(" • ")
                : `${row.commission_type} commission completed`,
            date_completed: new Date().toISOString().slice(0, 10),
            image_urls: images,
        };
        if (support.logProvenance) {
            log.commission_id = commissionId;
            log.artist_user_id = artistId;
        }

        await supabase.from("customization_logs").insert(log as never);
    } catch (err) {
        logger.error("ArtStudio", "Provenance log failed (continuing)", err);
    }
}

// ============================================================
// COMMISSIONS — the working record
// ============================================================

export async function addCommissionUpdate(
    commissionId: string,
    data: {
        updateType: "wip_photo" | "message" | "milestone";
        title?: string;
        body?: string;
        imageUrls?: string[];
        isVisibleToClient?: boolean;
    },
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const loaded = await loadParty(supabase, commissionId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const { row, party } = loaded;

    if (!str(data.body) && !(data.imageUrls ?? []).length) {
        return { success: false, error: "Add a note or a photo before posting." };
    }

    // Only the artist keeps private notes; a client "private" note would be
    // invisible to the only other person in the conversation.
    const visible = party === "artist" ? data.isVisibleToClient !== false : true;

    const { error } = await supabase.from("commission_updates").insert({
        commission_id: commissionId,
        author_id: user.id,
        update_type: data.updateType,
        title: str(data.title),
        body: str(data.body),
        image_urls: (data.imageUrls ?? []).slice(0, 8),
        is_visible_to_client: visible,
    } as Patch as never);
    if (error) return { success: false, error: error.message };

    await supabase
        .from("commissions")
        .update({ last_update_at: new Date().toISOString() } as Patch as never)
        .eq("id", commissionId);

    if (visible) {
        const other =
            party === "artist" ? (row.client_id as string | null) : (row.artist_id as string);
        const label =
            data.updateType === "wip_photo"
                ? "posted a work-in-progress photo"
                : data.updateType === "milestone"
                  ? "marked a milestone"
                  : "sent a message";
        if (other) {
            await notify({
                userId: other,
                actorId: user.id,
                content: `Commission update — ${label}.`,
                linkUrl: `/studio/commission/${commissionId}`,
            });
        }
    }

    revalidateCommission(commissionId);
    return { success: true };
}

/**
 * Logistics. The commissioner's model physically travelling to the artist
 * is a FLAG, not a pipeline stage — v1 used one `shipping` status for both
 * directions of travel, which made the queue unreadable.
 */
export async function markModelReceived(
    commissionId: string,
    received: boolean,
    trackingNote?: string,
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const loaded = await loadParty(supabase, commissionId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    if (loaded.party !== "artist") {
        return { success: false, error: "Only the artist can confirm the model arrived." };
    }

    const support = await getStudioColumnSupport(supabase as never);
    if (!support.commissionAgreement) {
        return { success: false, error: "Logistics tracking needs a database update that hasn't been applied yet." };
    }

    const now = new Date().toISOString();
    const { error } = await supabase
        .from("commissions")
        .update({
            model_received: received,
            model_received_at: received ? now : null,
            tracking_note: str(trackingNote),
            last_update_at: now,
        } as Patch as never)
        .eq("id", commissionId);
    if (error) return { success: false, error: error.message };

    const clientId = loaded.row.client_id as string | null;
    if (received && clientId) {
        await notify({
            userId: clientId,
            actorId: user.id,
            content: "The artist has confirmed your model arrived safely.",
            linkUrl: `/studio/commission/${commissionId}`,
        });
    }

    revalidateCommission(commissionId);
    return { success: true };
}

/**
 * Off-platform payment bookkeeping.
 *
 * NOTHING HERE PROCESSES MONEY. The artist records that a deposit or a
 * balance arrived, wherever it actually arrived — PayPal, Venmo, a cheque.
 * We store the note so both sides have the same record and the income
 * summary is honest.
 */
export async function recordPayment(
    commissionId: string,
    input: { depositPaid?: boolean; finalPaid?: boolean; note?: string },
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const loaded = await loadParty(supabase, commissionId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    if (loaded.party !== "artist") {
        return { success: false, error: "Only the artist can record a payment." };
    }

    const support = await getStudioColumnSupport(supabase as never);
    const now = new Date().toISOString();
    const patch: Patch = { last_update_at: now, updated_at: now };

    if (input.depositPaid !== undefined) {
        patch.deposit_paid = input.depositPaid;
        if (support.commissionAgreement) {
            patch.deposit_paid_at = input.depositPaid ? now : null;
        }
    }
    if (input.finalPaid !== undefined) {
        patch.final_paid = input.finalPaid;
        if (support.commissionAgreement) {
            patch.final_paid_at = input.finalPaid ? now : null;
        }
    }
    if (support.commissionAgreement && input.note !== undefined) {
        patch.payment_note = str(input.note);
    }

    const { error } = await supabase
        .from("commissions")
        .update(patch as never)
        .eq("id", commissionId);
    if (error) return { success: false, error: error.message };

    revalidateCommission(commissionId);
    return { success: true };
}

export async function linkHorseToCommission(
    commissionId: string,
    horseId: string,
): Promise<ActionResult> {
    const { supabase, user } = await requireAuth();

    const loaded = await loadParty(supabase, commissionId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };

    // v1 let the artist attach ANY horse id, with no ownership check —
    // and that link is what drove the artist-credit stamp. The horse must
    // belong to the commissioner.
    const clientId = loaded.row.client_id as string | null;
    if (!clientId) {
        return { success: false, error: "This commission has no Model Horse Hub client to own the horse." };
    }
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id")
        .eq("id", horseId)
        .eq("owner_id", clientId)
        .maybeSingle();
    if (!horse) {
        return { success: false, error: "That horse isn't in the commissioner's stable." };
    }

    const { error } = await supabase
        .from("commissions")
        .update({ horse_id: horseId } as Patch as never)
        .eq("id", commissionId);
    if (error) return { success: false, error: error.message };

    revalidateCommission(commissionId);
    return { success: true };
}

// ============================================================
// VAULT INTEGRATION
// ============================================================

/**
 * File a completed commission's cost into the horse's financial vault.
 *
 * Only the COMMISSIONER can do this, and only for a horse they own — the
 * vault is the owner's private money record and nothing else may write to
 * it. The cost lands in `commission_cost`, deliberately NOT in
 * `purchase_price`: "what I paid to acquire this horse" and "what I have
 * invested in having it painted" are different numbers, and conflating
 * them would corrupt the Blue Book comparisons and the insurance report.
 *
 * Additive: repeated commissions on the same horse accumulate.
 */
export async function recordCommissionInVault(
    commissionId: string,
): Promise<ActionResult & { total?: number }> {
    const { supabase, user } = await requireAuth();

    const loaded = await loadParty(supabase, commissionId, user.id);
    if (!loaded.ok) return { success: false, error: loaded.error };
    const { row, status } = loaded;

    if (loaded.party !== "client") {
        return { success: false, error: "Only the commissioner can file this into their vault." };
    }
    if (status !== "completed" && status !== "delivered") {
        return { success: false, error: "Wait until the commission is finished." };
    }
    if (row.vault_recorded_at != null) {
        return { success: false, error: "This commission is already in the horse's vault." };
    }

    const horseId = row.horse_id as string | null;
    if (!horseId) {
        return { success: false, error: "Link a horse to this commission first." };
    }

    const support = await getStudioColumnSupport(supabase as never);
    if (!support.vaultCommissionCost) {
        return {
            success: false,
            error: "The vault needs a database update that hasn't been applied yet.",
        };
    }

    // The vault is owner-only at the database. Confirm ownership here too
    // so the failure is a sentence rather than a silent zero-row update.
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .maybeSingle();
    if (!horse) {
        return { success: false, error: "You don't own that horse any more." };
    }

    const price = num(row.agreed_price) ?? num(row.price_quoted);
    if (price == null || price <= 0) {
        return { success: false, error: "This commission has no agreed price to record." };
    }

    const { data: vaultRow } = await supabase
        .from("financial_vault")
        .select("*")
        .eq("horse_id", horseId)
        .maybeSingle();

    const existing = vaultRow as Row | null;
    const previous = num(existing?.commission_cost) ?? 0;
    const total = Math.round((previous + price) * 100) / 100;
    const line = `${String(row.commission_type)} by @${(row.artist as { alias_name?: string } | null)?.alias_name ?? "artist"} — $${price.toLocaleString("en-US")}`;
    const notes = [str(existing?.commission_notes), line].filter(Boolean).join("\n");

    // Split rather than a ternary over two query builders: the union of the
    // two return types is what tips tsc into "excessively deep".
    let writeError: { message: string } | null = null;
    if (existing) {
        const { error } = await supabase
            .from("financial_vault")
            .update({ commission_cost: total, commission_notes: notes } as Patch as never)
            .eq("horse_id", horseId);
        writeError = error;
    } else {
        const { error } = await supabase
            .from("financial_vault")
            .insert({
                horse_id: horseId,
                commission_cost: total,
                commission_notes: notes,
            } as Patch as never);
        writeError = error;
    }

    if (writeError) return { success: false, error: writeError.message };

    // Mark it filed so the offer stops appearing and cannot double-count.
    await supabase
        .from("commissions")
        .update({ vault_recorded_at: new Date().toISOString() } as Patch as never)
        .eq("id", commissionId);

    revalidateCommission(commissionId);
    revalidatePath(`/stable/${horseId}`);
    return { success: true, total };
}
