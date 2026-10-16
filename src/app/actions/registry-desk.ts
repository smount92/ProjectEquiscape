"use server";

/**
 * The Registry Desk's actions (Release 3, Phase 1, Package B): the Queue,
 * the Mold view and the editor. docs/design/registry-desk-phase1-plan.md.
 *
 * Every export asks requireRegistryModerator() first, through deskGate(),
 * before it reads or writes anything: a hidden link is not permission, and
 * a moderator removed a minute ago is refused on their next click. Every
 * export returns ActionResult; nothing throws to the browser.
 *
 * Reads use the service role (getAdminClient): members' suggestions are
 * readable only by their authors under RLS, and the claim columns and the
 * history tables (242) are service-role only by design. Every Registry
 * WRITE goes through src/lib/catalog/write.ts or suggestionApply.ts, the
 * one writer; this file never writes catalog_items or catalog_changelog.
 * The only rows it writes itself are the 30-minute claims on suggestions.
 */

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { AuthError, SUSPENDED_AUTH_ERROR, requireRegistryModerator } from "@/lib/auth";
import { ACCOUNT_SUSPENDED, NOT_LOGGED_IN, fail, safeError, type ActionResult } from "@/lib/actions/result";
import { getAdminClient } from "@/lib/supabase/admin";
import { sanitizeText } from "@/lib/utils/validation";
import { deskFieldLabel, type DeskSource } from "@/lib/catalog/editableFields";
import {
    confirmMerge as writeConfirmMerge,
    declineMerge as writeDeclineMerge,
    insertItem,
    linkCounts,
    removeItem as writeRemoveItem,
    requestMerge as writeRequestMerge,
    updateItem,
} from "@/lib/catalog/write";
import { applySuggestion, decideSuggestion } from "@/lib/catalog/suggestionApply";
import { FLAG_LABELS, moldFlags, releaseFlags, type FlagKey } from "@/lib/registry/checks";
import { suggestedFixes } from "@/lib/registry/fixes";
import type { RegistryActor } from "@/lib/registry/types";

// ── Shapes the Desk's screens read (type exports are allowed here) ──

export type QueueTab = "corrections" | "additions" | "duplicates" | "auto_applied" | "second_looks";

export interface QueueChange {
    key: string;
    label: string;
    from: string;
    to: string;
}

export interface QueueItem {
    /** The suggestion's id, or the history action's id on Second looks. */
    id: string;
    tab: QueueTab;
    kind: string;
    kindLabel: string;
    title: string;
    /** The Registry row it is about, and where it opens in the Mold view. */
    itemId: string | null;
    deskHref: string | null;
    moldTitle: string | null;
    who: string;
    mine: boolean;
    createdAt: string;
    reason: string;
    changes: QueueChange[];
    /** The member's field_changes, as filed; Edit then approve starts from these. */
    fields: Record<string, unknown>;
    claim: { by: string; mine: boolean; until: string } | null;
    keep: { id: string; title: string } | null;
    note: string | null;
    /** Edit then approve applies to corrections and new entries. */
    canEdit: boolean;
}

export interface QueueData {
    tab: QueueTab;
    items: QueueItem[];
    counts: Record<QueueTab, number>;
    notice: string | null;
}

export interface DeskFlag {
    key: string;
    label: string;
}

export interface DeskFix {
    rule: string;
    changes: Record<string, string>;
}

export interface DeskRelease {
    row: DeskSource;
    flags: DeskFlag[];
    fixes: DeskFix[];
    horses: number;
    wantLists: number;
}

export interface MoldViewData {
    mold: DeskRelease;
    releases: DeskRelease[];
}

export interface MoldHit {
    id: string;
    title: string;
    maker: string;
    scale: string | null;
    releases: number;
}

export type DeskLinks = Awaited<ReturnType<typeof linkCounts>>;

export type SaveResult =
    | { success: true; item: DeskSource }
    | { success: false; error: string; conflict?: DeskSource | null };

// ── The gate ──

const DESK_ONLY = "The Registry Desk is for Registry moderators.";

type Gate =
    | { ok: true; actor: RegistryActor; db: SupabaseClient }
    | { ok: false; failure: { success: false; error: string } };

/**
 * The role check every export runs first. requireRegistryModerator() reads
 * the moderator's status on each request, so removal takes effect at once.
 */
async function deskGate(): Promise<Gate> {
    try {
        const { user, role, alias } = await requireRegistryModerator();
        // Untyped view: the claim columns and the 242/244 tables are not in
        // the generated types until those updates are pasted.
        const db = getAdminClient() as unknown as SupabaseClient;
        return { ok: true, actor: { userId: user.id, alias, role }, db };
    } catch (e) {
        if (e instanceof AuthError) {
            const words =
                e.message === SUSPENDED_AUTH_ERROR
                    ? ACCOUNT_SUSPENDED
                    : e.message === "Not authenticated."
                      ? NOT_LOGGED_IN
                      : DESK_ONLY;
            return { ok: false, failure: fail(words) };
        }
        return { ok: false, failure: safeError("RegistryDesk", e) };
    }
}

// ── Small helpers ──

const MISSING_SCHEMA = new Set(["42P01", "PGRST205", "PGRST202", "42883", "42703", "PGRST204"]);
type DbError = { code?: string; message?: string } | null | undefined;

/** True when the failure is only that an update (242/243/244) is not pasted yet. */
function isMissingSchema(error: DbError): boolean {
    return !!error && MISSING_SCHEMA.has(error.code ?? "");
}

const ROW_COLUMNS =
    "id, item_type, parent_id, title, maker, maker_slug, slug, scale, artist, manufacturer, attributes, created_at, updated_at";

const CLAIM_MINUTES = 30;
const OPEN_STATUSES = ["pending", "under_review"];
const CHUNK = 150;

const asText = (v: unknown): string => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

function chunks<T>(list: T[], size = CHUNK): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

function toSource(r: Record<string, unknown>): DeskSource {
    return {
        id: String(r.id),
        item_type: String(r.item_type ?? ""),
        parent_id: (r.parent_id as string | null) ?? null,
        title: String(r.title ?? ""),
        maker: (r.maker as string | null) ?? null,
        maker_slug: (r.maker_slug as string | null) ?? null,
        slug: (r.slug as string | null) ?? null,
        scale: (r.scale as string | null) ?? null,
        artist: (r.artist as string | null) ?? null,
        manufacturer: (r.manufacturer as string | null) ?? null,
        attributes: (r.attributes as Record<string, unknown> | null) ?? {},
        created_at: String(r.created_at ?? ""),
        updated_at: String(r.updated_at ?? ""),
    };
}

/** Where a row opens on the Desk: its mold's view with it picked, or its own. */
function deskHrefFor(row: { id: string; item_type: string; parent_id: string | null }): string {
    if (row.item_type === "plastic_mold") return `/catalog/desk/mold/${row.id}`;
    if (row.parent_id) return `/catalog/desk/mold/${row.parent_id}?release=${row.id}`;
    return `/catalog/desk/mold/${row.id}`;
}

async function aliasesFor(db: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const unique = [...new Set(ids.filter(Boolean))];
    for (const part of chunks(unique)) {
        const { data } = await db.from("users").select("id, alias_name").in("id", part);
        for (const u of (data ?? []) as { id: string; alias_name: string | null }[]) {
            map.set(u.id, u.alias_name ?? "a member");
        }
    }
    return map;
}

/** The claim that holds right now, or null (none, or its 30 minutes are up). */
function activeClaim(
    row: { claimed_by?: string | null; claimed_until?: string | null },
    now: Date,
): { by: string; until: string } | null {
    if (!row.claimed_by || !row.claimed_until) return null;
    if (new Date(row.claimed_until).getTime() <= now.getTime()) return null;
    return { by: row.claimed_by, until: row.claimed_until };
}

function clock(iso: string): string {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const KIND_LABELS: Record<string, string> = {
    correction: "Correction",
    addition: "New entry",
    duplicate: "Duplicate",
    removal: "Removal request",
    photo: "Photo",
    merge: "Merge",
    remove: "Removal",
    edit: "Edit",
};

/** A new entry's field_changes keys, in words. */
const ADDITION_LABELS: Record<string, string> = {
    year: "First year",
    year_end: "Last year",
    color: "Colour and markings",
    parent_catalog_id: "Filed under mold",
};

function additionLabel(key: string): string {
    return ADDITION_LABELS[key] ?? deskFieldLabel(key);
}

type SuggestionRow = {
    id: string;
    user_id: string;
    catalog_item_id: string | null;
    suggestion_type: string;
    field_changes: Record<string, unknown> | null;
    reason: string | null;
    status: string;
    admin_notes: string | null;
    created_at: string;
    artist_name?: string | null;
    claimed_by?: string | null;
    claimed_until?: string | null;
};

const SUGGESTION_COLUMNS =
    "id, user_id, catalog_item_id, suggestion_type, field_changes, reason, status, admin_notes, created_at, artist_name";

function tabFilter(tab: QueueTab): { types: string[] | null; statuses: string[]; since: string | null } {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    switch (tab) {
        case "corrections":
            return { types: ["correction", "removal", "photo"], statuses: OPEN_STATUSES, since: null };
        case "additions":
            return { types: ["addition"], statuses: OPEN_STATUSES, since: null };
        case "duplicates":
            return { types: ["duplicate"], statuses: OPEN_STATUSES, since: null };
        case "auto_applied":
            return { types: null, statuses: ["auto_approved"], since: weekAgo };
        default:
            return { types: null, statuses: [], since: null };
    }
}

function suggestionQuery(db: SupabaseClient, tab: QueueTab, columns: string, head = false) {
    const f = tabFilter(tab);
    let q = db
        .from("catalog_suggestions")
        .select(columns, head ? { count: "exact", head: true } : undefined)
        .in("status", f.statuses);
    if (f.types) q = q.in("suggestion_type", f.types);
    if (f.since) q = q.gte("created_at", f.since);
    return q;
}

const QUEUE_TABS: QueueTab[] = ["corrections", "additions", "duplicates", "auto_applied", "second_looks"];

async function queueCounts(db: SupabaseClient): Promise<Record<QueueTab, number>> {
    const counts = { corrections: 0, additions: 0, duplicates: 0, auto_applied: 0, second_looks: 0 };
    await Promise.all(
        QUEUE_TABS.map(async (tab) => {
            if (tab === "second_looks") {
                const { count, error } = await db
                    .from("registry_actions")
                    .select("id", { count: "exact", head: true })
                    .eq("status", "awaiting_second_look");
                counts[tab] = error ? 0 : (count ?? 0);
                return;
            }
            const { count } = await suggestionQuery(db, tab, "id", true);
            counts[tab] = count ?? 0;
        }),
    );
    return counts;
}

// ── Queue ──

/** One tab of the Queue, oldest first, with every tab's count for the badges. */
export async function getQueue(tab: QueueTab): Promise<ActionResult<{ queue: QueueData }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db, actor } = gate;
    if (!QUEUE_TABS.includes(tab)) return fail("That part of the Queue does not exist.");

    try {
        const counts = await queueCounts(db);
        if (tab === "second_looks") {
            const { data, error } = await db
                .from("registry_actions")
                .select("id, kind, actor_id, catalog_item_id, related_item_id, item_title, summary, note, created_at")
                .eq("status", "awaiting_second_look")
                .order("created_at", { ascending: true })
                .limit(50);
            if (error) {
                if (isMissingSchema(error)) {
                    return {
                        success: true,
                        queue: { tab, items: [], counts, notice: "Second looks open once the owner adds update 242." },
                    };
                }
                return safeError("RegistryDesk.getQueue", error, "The Queue could not be read. Please try again.");
            }
            const rows = (data ?? []) as {
                id: string;
                kind: string;
                actor_id: string;
                catalog_item_id: string | null;
                related_item_id: string | null;
                item_title: string | null;
                summary: string;
                note: string | null;
                created_at: string;
            }[];
            const aliases = await aliasesFor(
                db,
                rows.map((r) => r.actor_id),
            );
            const items: QueueItem[] = rows.map((r) => ({
                id: r.id,
                tab,
                kind: r.kind,
                kindLabel: KIND_LABELS[r.kind] ?? r.kind,
                title: r.summary || r.item_title || "A Registry change",
                itemId: r.related_item_id ?? r.catalog_item_id,
                deskHref: r.related_item_id ? `/catalog/desk/mold/${r.related_item_id}` : null,
                moldTitle: null,
                who: `@${aliases.get(r.actor_id) ?? "a moderator"}`,
                mine: r.actor_id === actor.userId,
                createdAt: r.created_at,
                reason: r.note ?? "",
                changes: [],
                fields: {},
                claim: null,
                keep: null,
                note: null,
                canEdit: false,
            }));
            return { success: true, queue: { tab, items, counts, notice: null } };
        }

        // Claims are update 242's columns; before it, read without them.
        let notice: string | null = null;
        let res = await suggestionQuery(db, tab, `${SUGGESTION_COLUMNS}, claimed_by, claimed_until`)
            .order("created_at", { ascending: tab !== "auto_applied" })
            .limit(50);
        if (res.error && isMissingSchema(res.error)) {
            notice = "Claims start once the owner adds update 242; until then, two people can open the same one.";
            res = await suggestionQuery(db, tab, SUGGESTION_COLUMNS)
                .order("created_at", { ascending: tab !== "auto_applied" })
                .limit(50);
        }
        if (res.error)
            return safeError("RegistryDesk.getQueue", res.error, "The Queue could not be read. Please try again.");
        const rows = (res.data ?? []) as unknown as SuggestionRow[];

        // Who filed, who holds a claim, and the rows they are about: one keyed read each.
        const aliases = await aliasesFor(db, [...rows.map((r) => r.user_id), ...rows.map((r) => r.claimed_by ?? "")]);
        const itemIds = new Set<string>();
        for (const r of rows) {
            if (r.catalog_item_id) itemIds.add(r.catalog_item_id);
            const fc = r.field_changes ?? {};
            if (typeof fc.duplicate_of === "string") itemIds.add(fc.duplicate_of);
            if (typeof fc.parent_catalog_id === "string") itemIds.add(fc.parent_catalog_id);
        }
        const items = new Map<string, { id: string; title: string; item_type: string; parent_id: string | null }>();
        for (const part of chunks([...itemIds])) {
            const { data } = await db.from("catalog_items").select("id, title, item_type, parent_id").in("id", part);
            for (const it of (data ?? []) as {
                id: string;
                title: string;
                item_type: string;
                parent_id: string | null;
            }[]) {
                items.set(it.id, it);
            }
        }
        const moldIds = [...items.values()].map((i) => i.parent_id).filter((p): p is string => !!p && !items.has(p));
        for (const part of chunks([...new Set(moldIds)])) {
            const { data } = await db.from("catalog_items").select("id, title, item_type, parent_id").in("id", part);
            for (const it of (data ?? []) as {
                id: string;
                title: string;
                item_type: string;
                parent_id: string | null;
            }[]) {
                items.set(it.id, it);
            }
        }

        const now = new Date();
        const out: QueueItem[] = rows.map((r) => {
            const fc = r.field_changes ?? {};
            const item = r.catalog_item_id ? items.get(r.catalog_item_id) : undefined;
            const mold = item?.parent_id ? items.get(item.parent_id) : undefined;
            const claim = activeClaim(r, now);
            let title = item?.title ?? (typeof fc.title === "string" ? fc.title : "");
            let changes: QueueChange[] = [];
            let keep: QueueItem["keep"] = null;

            if (r.suggestion_type === "addition") {
                title = typeof fc.title === "string" && fc.title ? fc.title : asText(fc.mold_name) || "A new entry";
                changes = Object.entries(fc)
                    .filter(([, v]) => v != null && v !== "")
                    .map(([key, v]) => ({
                        key,
                        label: additionLabel(key),
                        from: "",
                        to: key === "parent_catalog_id" ? (items.get(String(v))?.title ?? asText(v)) : asText(v),
                    }));
            } else if (r.suggestion_type === "duplicate") {
                const keepId = typeof fc.duplicate_of === "string" ? fc.duplicate_of : null;
                const keepTitle = keepId ? (items.get(keepId)?.title ?? asText(fc.duplicate_of_title)) : "";
                keep = keepId ? { id: keepId, title: keepTitle || "the other entry" } : null;
                changes = [
                    {
                        key: "duplicate_of",
                        label: "Merge into",
                        from: title || "this entry",
                        to: keep?.title ?? "the other entry",
                    },
                ];
            } else {
                if (r.artist_name) title = `Artist notes: ${r.artist_name}`;
                changes = Object.entries(fc)
                    .filter(([, v]) => typeof v === "object" && v !== null && "to" in (v as object))
                    .map(([key, v]) => {
                        const c = v as { from?: unknown; to?: unknown };
                        return { key, label: deskFieldLabel(key), from: asText(c.from), to: asText(c.to) };
                    });
            }

            return {
                id: r.id,
                tab,
                kind: r.suggestion_type,
                kindLabel: KIND_LABELS[r.suggestion_type] ?? r.suggestion_type,
                title: title || "Untitled",
                itemId: r.catalog_item_id,
                deskHref: item ? deskHrefFor(item) : null,
                moldTitle: mold?.title ?? null,
                who: `@${aliases.get(r.user_id) ?? "a member"}`,
                mine: r.user_id === actor.userId,
                createdAt: r.created_at,
                reason: r.reason ?? "",
                changes,
                fields: fc,
                claim: claim
                    ? {
                          by: `@${aliases.get(claim.by) ?? "a moderator"}`,
                          mine: claim.by === actor.userId,
                          until: claim.until,
                      }
                    : null,
                keep,
                note: r.admin_notes,
                canEdit:
                    tab !== "auto_applied" && (r.suggestion_type === "correction" || r.suggestion_type === "addition"),
            };
        });
        return { success: true, queue: { tab, items: out, counts, notice } };
    } catch (e) {
        return safeError("RegistryDesk.getQueue", e, "The Queue could not be read. Please try again.");
    }
}

type ReviewCheck = { ok: true; row: SuggestionRow } | { ok: false; failure: { success: false; error: string } };

/** The checks before anyone decides a suggestion: it exists, is open, isn't theirs, isn't someone else's to decide right now. */
async function reviewable(db: SupabaseClient, actor: RegistryActor, id: string): Promise<ReviewCheck> {
    let res = await db
        .from("catalog_suggestions")
        .select(`${SUGGESTION_COLUMNS}, claimed_by, claimed_until`)
        .eq("id", id)
        .maybeSingle();
    if (res.error && isMissingSchema(res.error)) {
        res = await db.from("catalog_suggestions").select(SUGGESTION_COLUMNS).eq("id", id).maybeSingle();
    }
    if (res.error) return { ok: false, failure: safeError("RegistryDesk.reviewable", res.error) };
    const row = res.data as unknown as SuggestionRow | null;
    if (!row) return { ok: false, failure: fail("That suggestion is gone.") };
    if (row.user_id === actor.userId) {
        return { ok: false, failure: fail("This is your own suggestion. Another moderator decides it.") };
    }
    if (!OPEN_STATUSES.includes(row.status)) {
        return { ok: false, failure: fail("This one has already been decided.") };
    }
    const claim = activeClaim(row, new Date());
    if (claim && claim.by !== actor.userId) {
        const who = (await aliasesFor(db, [claim.by])).get(claim.by) ?? "another moderator";
        return { ok: false, failure: fail(`@${who} is looking at this one until ${clock(claim.until)}.`) };
    }
    return { ok: true, row };
}

/** Lets go of a claim this moderator holds (quietly: before 242 there is nothing to let go). */
async function dropClaim(db: SupabaseClient, actor: RegistryActor, id: string): Promise<void> {
    const { error } = await db
        .from("catalog_suggestions")
        .update({ claimed_by: null, claimed_until: null })
        .eq("id", id)
        .eq("claimed_by", actor.userId);
    if (error && !isMissingSchema(error)) safeError("RegistryDesk.dropClaim", error);
}

function refreshQueue(): void {
    revalidatePath("/catalog/desk");
    revalidatePath("/catalog/suggestions");
}

/**
 * Opening a suggestion holds it for 30 minutes so two moderators don't
 * decide the same one. A claim whose time is up is free to take.
 */
export async function claimSuggestion(id: string): Promise<ActionResult<{ claimed: boolean; until: string | null }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db, actor } = gate;

    const check = await reviewable(db, actor, id);
    if (!check.ok) return check.failure;

    const now = new Date();
    const until = new Date(now.getTime() + CLAIM_MINUTES * 60 * 1000).toISOString();
    // Guarded: only while it is free, expired, or already ours. Two
    // moderators clicking at once: one update wins, the other gets 0 rows.
    const { data, error } = await db
        .from("catalog_suggestions")
        .update({ claimed_by: actor.userId, claimed_until: until })
        .eq("id", id)
        .or(`claimed_by.is.null,claimed_until.lt.${now.toISOString()},claimed_by.eq.${actor.userId}`)
        .select("id");
    if (error) {
        if (isMissingSchema(error)) return { success: true, claimed: false, until: null };
        return safeError("RegistryDesk.claimSuggestion", error);
    }
    if (!data || (data as unknown[]).length === 0) {
        return fail("Another moderator picked this one up a moment ago.");
    }
    return { success: true, claimed: true, until };
}

/** Lets go of a claim, so another moderator can pick it up. */
export async function releaseClaim(id: string): Promise<ActionResult> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    await dropClaim(gate.db, gate.actor, id);
    return { success: true };
}

/**
 * Approve, as filed or as the moderator fixed it ("Edit, then approve").
 * `edited` is the moderator's copy of field_changes, same shape; the
 * member's original is kept and their notice shows what changed.
 */
export async function approveSuggestion(
    id: string,
    edited?: Record<string, unknown> | null,
    note?: string | null,
): Promise<ActionResult<{ status: "applied" | "awaiting_second_look" }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db, actor } = gate;

    const check = await reviewable(db, actor, id);
    if (!check.ok) return check.failure;
    const cleanNote = note ? sanitizeText(note).slice(0, 1000) : null;

    try {
        const applied = await applySuggestion(id, { reviewer: actor, edited: edited ?? null });
        if (!applied.ok) return fail(applied.error);
        // A duplicate approved by a moderator waits for a second look; it is
        // decided when the merge is confirmed, not now.
        if (applied.status === "applied") {
            const decided = await decideSuggestion(id, {
                reviewer: actor,
                decision: "approved",
                note: cleanNote,
                edited: edited ?? null,
            });
            if (!decided.ok) return fail(decided.error);
        }
        await dropClaim(db, actor, id);
        refreshQueue();
        return { success: true, status: applied.status };
    } catch (e) {
        return safeError("RegistryDesk.approveSuggestion", e, "It could not be approved. Please try again.");
    }
}

/** Say no, with a reason the member reads (5 letters or more). */
export async function rejectSuggestion(id: string, reason: string): Promise<ActionResult> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db, actor } = gate;

    const words = sanitizeText(reason ?? "").slice(0, 1000);
    if (words.length < 5) return fail("Say why in a few words. The member reads it.");
    const check = await reviewable(db, actor, id);
    if (!check.ok) return check.failure;

    try {
        const decided = await decideSuggestion(id, { reviewer: actor, decision: "rejected", note: words });
        if (!decided.ok) return fail(decided.error);
        await dropClaim(db, actor, id);
        refreshQueue();
        return { success: true };
    } catch (e) {
        return safeError("RegistryDesk.rejectSuggestion", e, "It could not be saved. Please try again.");
    }
}

// ── Mold view ──

function escapeLike(term: string): string {
    return term.replace(/[%_\\]/g, (c) => `\\${c}`);
}

/** Molds by name, with how many releases each holds. */
export async function searchMolds(
    term: string,
    opts: { maker?: string | null; scale?: string | null } = {},
): Promise<ActionResult<{ molds: MoldHit[] }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db } = gate;

    const words = sanitizeText(term ?? "").slice(0, 100);
    if (words.length < 2 && !opts.maker) return { success: true, molds: [] };
    try {
        let q = db.from("catalog_items").select("id, title, maker, scale").eq("item_type", "plastic_mold");
        if (words) q = q.ilike("title", `%${escapeLike(words)}%`);
        if (opts.maker) q = q.eq("maker", opts.maker);
        if (opts.scale) q = q.eq("scale", opts.scale);
        const { data, error } = await q.order("title").limit(40);
        if (error) return safeError("RegistryDesk.searchMolds", error, "The search did not work. Please try again.");
        const molds = (data ?? []) as { id: string; title: string; maker: string; scale: string | null }[];
        const counts = new Map<string, number>();
        for (const part of chunks(molds.map((m) => m.id))) {
            const { data: kids } = await db
                .from("catalog_items")
                .select("parent_id")
                .in("parent_id", part)
                .limit(10000);
            for (const k of (kids ?? []) as { parent_id: string }[]) {
                counts.set(k.parent_id, (counts.get(k.parent_id) ?? 0) + 1);
            }
        }
        return {
            success: true,
            molds: molds.map((m) => ({
                id: m.id,
                title: m.title,
                maker: m.maker,
                scale: m.scale,
                releases: counts.get(m.id) ?? 0,
            })),
        };
    } catch (e) {
        return safeError("RegistryDesk.searchMolds", e, "The search did not work. Please try again.");
    }
}

type RuleList = Parameters<typeof suggestedFixes>[2];
type CheckInput = Parameters<typeof releaseFlags>[0];

/** The style rules in effect (244); none before it is pasted. */
async function rulesInEffect(db: SupabaseClient): Promise<RuleList> {
    const { data, error } = await db
        .from("registry_style_rules")
        .select("id, title, check_key, params")
        .eq("status", "in_effect");
    if (error) return [] as unknown as RuleList;
    return (data ?? []) as unknown as RuleList;
}

/** Package C's flags, in words. */
function wordsFor(keys: FlagKey[]): DeskFlag[] {
    return keys.map((key) => ({ key, label: FLAG_LABELS[key] ?? key }));
}

/** Package C's suggested fixes, in the shape the editor reads. */
function fixesFor(row: DeskSource, keys: FlagKey[], rules: RuleList): DeskFix[] {
    if (!rules || (rules as unknown[]).length === 0) return [];
    return suggestedFixes(row as unknown as CheckInput, keys, rules).map((f) => {
        const fix = f as unknown as {
            ruleTitle?: string;
            rule?: string;
            title?: string;
            changes?: Record<string, unknown>;
        };
        const changes: Record<string, string> = {};
        for (const [k, v] of Object.entries(fix.changes ?? {})) changes[k] = asText(v);
        return { rule: fix.ruleTitle ?? fix.rule ?? fix.title ?? "A Registry rule", changes };
    });
}

async function countLinks(
    db: SupabaseClient,
    table: "user_horses" | "user_wishlists",
    ids: string[],
): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const part of chunks(ids)) {
        const { data } = await db.from(table).select("catalog_id").in("catalog_id", part).limit(50000);
        for (const r of (data ?? []) as { catalog_id: string }[]) {
            map.set(r.catalog_id, (map.get(r.catalog_id) ?? 0) + 1);
        }
    }
    return map;
}

/** Rows elsewhere in the Registry sharing a model number with one of these, same maker. */
async function sameNumberRows(db: SupabaseClient, rows: DeskSource[], maker: string | null): Promise<DeskSource[]> {
    const numbers = [
        ...new Set(rows.map((r) => asText((r.attributes ?? {}).model_number).trim()).filter((n) => n !== "")),
    ];
    const out: DeskSource[] = [];
    for (const part of chunks(numbers)) {
        let q = db.from("catalog_items").select(ROW_COLUMNS).in("attributes->>model_number", part);
        if (maker) q = q.eq("maker", maker);
        const { data } = await q.limit(2000);
        for (const r of (data ?? []) as Record<string, unknown>[]) out.push(toSource(r));
    }
    return out;
}

async function describeReleases(
    db: SupabaseClient,
    mold: DeskSource | null,
    releases: DeskSource[],
): Promise<DeskRelease[]> {
    const ids = releases.map((r) => r.id);
    const [horses, wants, rules, sameNumber] = await Promise.all([
        countLinks(db, "user_horses", ids),
        countLinks(db, "user_wishlists", ids),
        rulesInEffect(db),
        sameNumberRows(db, releases, mold?.maker ?? null),
    ]);
    const byNumber = new Map<string, DeskSource[]>();
    for (const r of sameNumber) {
        const n = asText((r.attributes ?? {}).model_number).trim();
        byNumber.set(n, [...(byNumber.get(n) ?? []), r]);
    }
    return releases.map((row) => {
        const n = asText((row.attributes ?? {}).model_number).trim();
        const keys = releaseFlags(row as unknown as CheckInput, {
            mold: mold as unknown as CheckInput | null,
            siblings: releases as unknown as CheckInput[],
            sameNumber: (n ? (byNumber.get(n) ?? []).filter((r) => r.id !== row.id) : []) as unknown as CheckInput[],
        });
        return {
            row,
            flags: wordsFor(keys),
            fixes: fixesFor(row, keys, rules),
            horses: horses.get(row.id) ?? 0,
            wantLists: wants.get(row.id) ?? 0,
        };
    });
}

/**
 * A mold and ONLY the rows filed under it (parent_id = the mold). A set
 * row filed under another mold whose title names this one is never
 * fetched: the Desk never shows or edits a row from under someone else's
 * parent (DECISIONS: one parent per row).
 */
export async function getMoldView(moldId: string): Promise<ActionResult<{ view: MoldViewData }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db } = gate;

    try {
        const { data: moldRow, error } = await db
            .from("catalog_items")
            .select(ROW_COLUMNS)
            .eq("id", moldId)
            .maybeSingle();
        if (error)
            return safeError("RegistryDesk.getMoldView", error, "That mold could not be read. Please try again.");
        if (!moldRow) return fail("That mold is not in the Registry any more.");
        const mold = toSource(moldRow as Record<string, unknown>);
        if (mold.item_type !== "plastic_mold") return fail("That entry is not a mold.");

        const { data: kids, error: kidsError } = await db
            .from("catalog_items")
            .select(ROW_COLUMNS)
            .eq("parent_id", moldId)
            .order("title")
            .limit(2000);
        if (kidsError) {
            return safeError(
                "RegistryDesk.getMoldView",
                kidsError,
                "Its releases could not be read. Please try again.",
            );
        }
        const releaseRows = ((kids ?? []) as Record<string, unknown>[]).map(toSource);
        const [described, rules, moldLinks] = await Promise.all([
            describeReleases(db, mold, releaseRows),
            rulesInEffect(db),
            Promise.all([countLinks(db, "user_horses", [mold.id]), countLinks(db, "user_wishlists", [mold.id])]),
        ]);
        const moldKeys = moldFlags(mold as unknown as CheckInput, releaseRows as unknown as CheckInput[]);
        return {
            success: true,
            view: {
                mold: {
                    row: mold,
                    flags: wordsFor(moldKeys),
                    fixes: fixesFor(mold, moldKeys, rules),
                    horses: moldLinks[0].get(mold.id) ?? 0,
                    wantLists: moldLinks[1].get(mold.id) ?? 0,
                },
                releases: described,
            },
        };
    } catch (e) {
        return safeError("RegistryDesk.getMoldView", e, "That mold could not be read. Please try again.");
    }
}

/** One row for the editor, with its mold's title and everything that points at it. */
export async function getItemForEdit(
    id: string,
): Promise<ActionResult<{ item: DeskRelease; parentTitle: string | null; links: DeskLinks | null }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db } = gate;

    try {
        const { data, error } = await db.from("catalog_items").select(ROW_COLUMNS).eq("id", id).maybeSingle();
        if (error) return safeError("RegistryDesk.getItemForEdit", error, "It could not be read. Please try again.");
        if (!data) return fail("That entry is not in the Registry any more.");
        const row = toSource(data as Record<string, unknown>);
        let mold: DeskSource | null = null;
        if (row.parent_id) {
            const { data: m } = await db
                .from("catalog_items")
                .select(ROW_COLUMNS)
                .eq("id", row.parent_id)
                .maybeSingle();
            mold = m ? toSource(m as Record<string, unknown>) : null;
        }
        const [described] = await describeReleases(db, mold, [row]);
        let links: DeskLinks | null = null;
        try {
            links = await linkCounts(id);
        } catch {
            links = null;
        }
        return { success: true, item: described, parentTitle: mold?.title ?? null, links };
    } catch (e) {
        return safeError("RegistryDesk.getItemForEdit", e, "It could not be read. Please try again.");
    }
}

/**
 * Save the editor's changes. Guarded by the row's updated_at: if someone
 * saved it since the editor opened, nothing is written and their version
 * comes back so the moderator can compare.
 */
export async function saveItem(input: {
    id: string;
    updatedAt: string;
    changes: Record<string, string>;
    note?: string;
}): Promise<SaveResult> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { actor } = gate;

    const changes = Object.fromEntries(
        Object.entries(input.changes ?? {}).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 5000) : v]),
    );
    if (Object.keys(changes).length === 0) return fail("Nothing has changed yet.");
    try {
        const r = await updateItem(actor, {
            id: input.id,
            expectedUpdatedAt: input.updatedAt,
            changes,
            note: input.note ? sanitizeText(input.note).slice(0, 1000) : undefined,
            kind: "parent_id" in changes ? "refile" : "edit",
        });
        if (!r.ok) {
            if (r.code === "conflict") {
                return {
                    success: false,
                    error: "Someone saved this since you opened it.",
                    conflict: r.current ? toSource(r.current as unknown as Record<string, unknown>) : null,
                };
            }
            return fail(r.error);
        }
        revalidatePath("/catalog/desk", "layout");
        return { success: true, item: toSource(r.item as unknown as Record<string, unknown>) };
    } catch (e) {
        return safeError("RegistryDesk.saveItem", e, "It could not be saved. Please try again.");
    }
}

/** Add a mold, release or other entry directly; a release under a mold takes the mold's maker and scale. */
export async function addItem(input: {
    parentId?: string | null;
    itemType: string;
    fields: Record<string, string>;
}): Promise<ActionResult<{ id: string; item: DeskSource | null }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db, actor } = gate;

    const fields = Object.fromEntries(
        Object.entries(input.fields ?? {})
            .map(([k, v]) => [k, typeof v === "string" ? sanitizeText(v).slice(0, 5000) : ""])
            .filter(([, v]) => v !== ""),
    ) as Record<string, string>;
    if (!fields.title) return fail("Give it a name first.");

    try {
        let mold: DeskSource | null = null;
        if (input.parentId) {
            const { data } = await db.from("catalog_items").select(ROW_COLUMNS).eq("id", input.parentId).maybeSingle();
            mold = data ? toSource(data as Record<string, unknown>) : null;
            if (!mold || mold.item_type !== "plastic_mold") return fail("That mold is not in the Registry any more.");
        }
        const columns = new Set(["title", "maker", "artist", "manufacturer", "scale"]);
        const attributes: Record<string, string> = {};
        const payload: Record<string, unknown> = { item_type: input.itemType };
        for (const [k, v] of Object.entries(fields)) {
            if (columns.has(k)) payload[k] = v;
            else attributes[k] = v;
        }
        if (mold) {
            payload.parent_id = mold.id;
            payload.maker = payload.maker ?? mold.maker;
            payload.manufacturer = payload.manufacturer ?? mold.manufacturer;
            payload.scale = mold.scale;
            if (!attributes.mold_name) attributes.mold_name = mold.title;
        }
        if (!payload.maker) return fail("Say who made it.");
        payload.attributes = attributes;

        const r = await insertItem(actor, { payload });
        if (!r.ok) return fail(r.error);
        const { data: created } = await db.from("catalog_items").select(ROW_COLUMNS).eq("id", r.id).maybeSingle();
        revalidatePath("/catalog/desk", "layout");
        return { success: true, id: r.id, item: created ? toSource(created as Record<string, unknown>) : null };
    } catch (e) {
        return safeError("RegistryDesk.addItem", e, "It could not be added. Please try again.");
    }
}

// ── Merge and remove ──

async function readRow(db: SupabaseClient, id: string): Promise<DeskSource | null> {
    const { data } = await db.from("catalog_items").select(ROW_COLUMNS).eq("id", id).maybeSingle();
    return data ? toSource(data as Record<string, unknown>) : null;
}

/** Both entries side by side, with what points at each, before a merge. */
export async function previewMerge(
    keepId: string,
    removeId: string,
): Promise<
    ActionResult<{
        keep: { row: DeskSource; links: DeskLinks | null };
        remove: { row: DeskSource; links: DeskLinks | null };
    }>
> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db } = gate;
    if (keepId === removeId) return fail("Pick two different entries.");
    try {
        const [keep, remove] = await Promise.all([readRow(db, keepId), readRow(db, removeId)]);
        if (!keep || !remove) return fail("One of them is not in the Registry any more.");
        const [keepLinks, removeLinks] = await Promise.all([
            linkCounts(keepId).catch(() => null),
            linkCounts(removeId).catch(() => null),
        ]);
        return { success: true, keep: { row: keep, links: keepLinks }, remove: { row: remove, links: removeLinks } };
    } catch (e) {
        return safeError("RegistryDesk.previewMerge", e);
    }
}

/** Ask for a merge: the owner's applies at once; a moderator's waits for a second look. */
export async function requestMerge(
    keepId: string,
    removeId: string,
    note?: string,
): Promise<ActionResult<{ actionId: string; status: string }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    if (keepId === removeId) return fail("Pick two different entries.");
    const words = sanitizeText(note ?? "").slice(0, 1000) || "The same entry listed twice.";
    try {
        const r = await writeRequestMerge(gate.actor, { keepId, removeId, note: words });
        if (!r.ok) return fail(r.error);
        revalidatePath("/catalog/desk", "layout");
        return { success: true, actionId: r.actionId, status: r.status };
    } catch (e) {
        return safeError("RegistryDesk.requestMerge", e, "The merge could not be sent. Please try again.");
    }
}

/** Confirm another moderator's merge (never your own). */
export async function confirmMerge(actionId: string): Promise<ActionResult> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    try {
        const r = await writeConfirmMerge(gate.actor, actionId);
        if (!r.ok) return fail(r.error);
        refreshQueue();
        revalidatePath("/catalog/desk", "layout");
        return { success: true };
    } catch (e) {
        return safeError("RegistryDesk.confirmMerge", e, "The merge could not be confirmed. Please try again.");
    }
}

/** Say no to another moderator's merge, with a reason they read. */
export async function declineMerge(actionId: string, note: string): Promise<ActionResult> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const words = sanitizeText(note ?? "").slice(0, 1000);
    if (words.length < 5) return fail("Say why in a few words. The moderator who asked reads it.");
    try {
        const r = await writeDeclineMerge(gate.actor, actionId, words);
        if (!r.ok) return fail(r.error);
        refreshQueue();
        return { success: true };
    } catch (e) {
        return safeError("RegistryDesk.declineMerge", e, "It could not be saved. Please try again.");
    }
}

/** What points at a row, and whether it can be removed (nothing may). */
export async function previewRemove(
    id: string,
): Promise<ActionResult<{ row: DeskSource; links: DeskLinks; canRemove: boolean }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    try {
        const row = await readRow(gate.db, id);
        if (!row) return fail("That entry is not in the Registry any more.");
        const links = await linkCounts(id);
        const canRemove = Object.values(links).every((n) => !n);
        return { success: true, row, links, canRemove };
    } catch (e) {
        return safeError("RegistryDesk.previewRemove", e);
    }
}

/** Remove a row nothing points at; hidden at once, undoable for 30 days. */
export async function removeItem(id: string, reason: string): Promise<ActionResult<{ actionId: string }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const words = sanitizeText(reason ?? "").slice(0, 1000);
    if (words.length < 3) return fail("Say why it goes, in a few words. It is kept in the history.");
    try {
        const r = await writeRemoveItem(gate.actor, { id, reason: words });
        if (!r.ok) return fail(r.error);
        revalidatePath("/catalog/desk", "layout");
        return { success: true, actionId: r.actionId };
    } catch (e) {
        return safeError("RegistryDesk.removeItem", e, "It could not be removed. Please try again.");
    }
}
