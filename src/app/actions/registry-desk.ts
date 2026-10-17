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
 * one writer; this file never writes catalog_items or catalog_changelog,
 * and the 30-minute claims on suggestions are the engine's too.
 */

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { AuthError, SUSPENDED_AUTH_ERROR, requireRegistryModerator } from "@/lib/auth";
import { ACCOUNT_SUSPENDED, NOT_LOGGED_IN, fail, safeError, type ActionResult } from "@/lib/actions/result";
import { getAdminClient } from "@/lib/supabase/admin";
import { sanitizeText } from "@/lib/utils/validation";
import { buildDeskFields, deskFieldLabel, type DeskSource } from "@/lib/catalog/editableFields";
import {
    claimSuggestion as engineClaimSuggestion,
    confirmMerge as writeConfirmMerge,
    declineMerge as writeDeclineMerge,
    insertItem,
    knownAttributeKeys,
    linkCounts,
    releaseSuggestionClaim,
    removeItem as writeRemoveItem,
    requestMerge as writeRequestMerge,
    undoReady,
    updateItem,
    type DroppedValue,
} from "@/lib/catalog/write";
import {
    additionDrops,
    decideSuggestion,
    type ExpectedSuggestion as SuggestionExpectation,
} from "@/lib/catalog/suggestionApply";
import {
    FLAG_LABELS,
    moldFlags,
    releaseFlags,
    type CheckRow,
    type FlagKey,
    type NumberMate,
} from "@/lib/registry/checks";
import { suggestedFixes, type RuleInEffect } from "@/lib/registry/fixes";
import { readRulesInEffect } from "@/lib/registry/todo";
import { actorOf, type RegistryActor } from "@/lib/registry/types";

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
    /**
     * The entry's values now, keyed like the Desk's fields (a correction
     * only): Edit then approve can add a field the member didn't touch,
     * starting from what the Registry says.
     */
    current: Record<string, string> | null;
    /** A new entry's values the Registry won't keep, and why: shown before anyone approves it. */
    willDrop: Dropped[];
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
    /**
     * Every attribute key the Registry keeps (write.ts knownAttributeKeys):
     * the editor's "Add a field" offers the ones a row doesn't show yet.
     */
    fieldKeys: string[];
}

export interface MoldHit {
    id: string;
    title: string;
    maker: string;
    scale: string | null;
    releases: number;
}

/** Any Registry entry found by name or model number. */
export interface EntryHit {
    id: string;
    title: string;
    itemType: string;
    maker: string | null;
    scale: string | null;
    modelNumber: string | null;
    moldTitle: string | null;
    href: string;
}

export interface DeskCounts {
    /** Open suggestions across Corrections, New entries and Duplicates. */
    queue: number;
    secondLooks: number;
    /** Rules proposed and waiting for agreement (0 before 244). */
    rules: number;
}

export type DeskLinks = Awaited<ReturnType<typeof linkCounts>>;

/** A value a new entry would lose, and why (the engine's DroppedValue). */
export type Dropped = DroppedValue;

export type SaveResult =
    | {
          success: true;
          item: DeskSource;
          /** The row as saved, with its fresh flags, fixes and links: no second read (null if those failed). */
          entry: DeskRelease | null;
          /** The History entry, for Undo (null before update 242). */
          actionId: string | null;
          /** Saved, but something that follows the save did not finish (a mold's releases not all moved to its new scale). */
          warning?: string;
      }
    | { success: false; error: string; field?: string; conflict?: DeskSource | null };

/** One field's change: text, or a list typed as comma-separated words. */
export type DeskChangeValue = string | string[];

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
        const seat = await requireRegistryModerator();
        // Untyped view: the claim columns and the 242/244 tables are not in
        // the generated types until those updates are pasted.
        const db = getAdminClient() as unknown as SupabaseClient;
        return { ok: true, actor: actorOf(seat), db };
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

/** A row's editable values as the Desk's boxes show them (text; a list as "a, b"). */
function currentValues(row: DeskSource | null | undefined): Record<string, string> | null {
    if (!row) return null;
    return Object.fromEntries(
        buildDeskFields(row)
            .filter((f) => !f.readOnly)
            .map((f) => [f.key, f.original]),
    );
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
                current: null,
                willDrop: [],
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
        const fullRows = new Map<string, DeskSource>();
        for (const part of chunks([...itemIds])) {
            const { data } = await db.from("catalog_items").select(ROW_COLUMNS).in("id", part);
            for (const raw of (data ?? []) as Record<string, unknown>[]) {
                const it = toSource(raw);
                items.set(it.id, it);
                fullRows.set(it.id, it);
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
                current: currentValues(
                    r.suggestion_type === "correction" && r.catalog_item_id ? fullRows.get(r.catalog_item_id) : null,
                ),
                willDrop: [],
            };
        });
        // What each new entry would lose, before anyone approves it. A failed
        // check is no reason to hide the Queue: that card shows no list.
        await Promise.all(
            out.map(async (item, i) => {
                if (item.kind !== "addition" || tab === "auto_applied") return;
                try {
                    item.willDrop = await additionDrops(rows[i].field_changes ?? {});
                } catch {
                    item.willDrop = [];
                }
            }),
        );
        return { success: true, queue: { tab, items: out, counts, notice } };
    } catch (e) {
        return safeError("RegistryDesk.getQueue", e, "The Queue could not be read. Please try again.");
    }
}

type ReviewCheck = { ok: true; row: SuggestionRow } | { ok: false; failure: { success: false; error: string } };

/**
 * The checks before anyone decides a suggestion: it exists, is open, isn't
 * theirs (the site owner may decide their own, as the engine allows: the
 * owner is the last word), isn't someone else's to decide right now.
 */
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
    if (row.user_id === actor.userId && actor.role !== "owner") {
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

/**
 * After a decision, lets go of any claim left (quietly: the decision
 * already cleared it, so "already decided" or "not yours" is expected;
 * only a real failure is logged).
 */
async function dropClaim(actor: RegistryActor, id: string): Promise<void> {
    const r = await releaseSuggestionClaim(actor, id);
    if (!r.success && r.code === "failed") safeError("RegistryDesk.dropClaim", r.error);
}

function refreshQueue(): void {
    revalidatePath("/catalog/desk");
    revalidatePath("/catalog/suggestions");
}

/** What the card showed: a decision is refused if the member changed it since (engine code "changed"). */
function expectation(input: unknown): SuggestionExpectation | undefined {
    if (!input || typeof input !== "object") return undefined;
    const e = input as { fieldChanges?: unknown; catalogItemId?: unknown };
    if (!("fieldChanges" in e)) return undefined;
    return {
        fieldChanges: e.fieldChanges ?? null,
        catalogItemId: typeof e.catalogItemId === "string" ? e.catalogItemId : null,
    };
}

const CHANGED_SINCE =
    "The member changed this suggestion while you were looking at it. Reload the Queue to see what they sent now.";

type DecisionFailure = { success: false; error: string; changed?: boolean; dropped?: Dropped[] };

function decisionFailure(d: { error: string; code?: string; dropped?: Dropped[] }): DecisionFailure {
    if (d.code === "changed") return { success: false, error: CHANGED_SINCE, changed: true };
    return d.dropped?.length
        ? { success: false, error: d.error, dropped: d.dropped }
        : { success: false, error: d.error };
}

/**
 * Opening a suggestion holds it for 30 minutes so two moderators don't
 * decide the same one. A claim whose time is up is free to take. The hold
 * itself is the engine's (claimSuggestion), guarded so that of two
 * moderators clicking at once only one gets it.
 */
export async function claimSuggestion(id: string): Promise<ActionResult<{ claimed: boolean; until: string | null }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db, actor } = gate;

    const check = await reviewable(db, actor, id);
    if (!check.ok) return check.failure;

    try {
        const r = await engineClaimSuggestion(actor, id);
        // The engine's own words (who holds it, for how long).
        if (!r.success) return fail(r.error);
        // Before 242 there are no holds: it opens without one.
        if (!r.claimedUntil) return { success: true, claimed: false, until: null };
        return { success: true, claimed: true, until: r.claimedUntil };
    } catch (e) {
        return safeError("RegistryDesk.claimSuggestion", e);
    }
}

/** Lets go of a claim, so another moderator can pick it up; says why when there was nothing of yours to let go. */
export async function releaseClaim(id: string): Promise<ActionResult> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    try {
        const r = await releaseSuggestionClaim(gate.actor, id);
        if (!r.success) return fail(r.error);
        return { success: true };
    } catch (e) {
        return safeError("RegistryDesk.releaseClaim", e);
    }
}

/**
 * Approve, as filed or as the moderator fixed it ("Edit, then approve").
 * `edited` is the moderator's copy of field_changes, same shape; the
 * member's original is kept and their notice shows what changed.
 * `expected` is what the card showed (the member's field_changes and the
 * entry): if the member changed it since, nothing is decided. `dropped`
 * lists values the Registry refused and left out of a new entry.
 */
export async function approveSuggestion(
    id: string,
    edited?: Record<string, unknown> | null,
    note?: string | null,
    expected?: SuggestionExpectation | null,
): Promise<{ success: true; status: "applied" | "awaiting_second_look"; dropped: Dropped[] } | DecisionFailure> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db, actor } = gate;

    const check = await reviewable(db, actor, id);
    if (!check.ok) return check.failure;
    const cleanNote = note ? sanitizeText(note).slice(0, 1000) : null;

    try {
        // decideSuggestion does the whole decision: it applies the change
        // through the one writer (applySuggestion), stamps the status and
        // role, and sends the member one notice. A duplicate approved by a
        // moderator comes back awaiting_second_look; it is decided when the
        // merge is confirmed, not now.
        const decided = await decideSuggestion(id, {
            reviewer: actor,
            verdict: "approved",
            note: cleanNote ?? undefined,
            edited: edited && Object.keys(edited).length > 0 ? edited : undefined,
            expected: expectation(expected),
        });
        if (!decided.success) return decisionFailure(decided);
        await dropClaim(actor, id);
        refreshQueue();
        return {
            success: true,
            status: decided.status === "awaiting_second_look" ? "awaiting_second_look" : "applied",
            dropped: decided.dropped ?? [],
        };
    } catch (e) {
        return safeError("RegistryDesk.approveSuggestion", e, "It could not be approved. Please try again.");
    }
}

/** Say no, with a reason the member reads (5 letters or more). */
export async function rejectSuggestion(
    id: string,
    reason: string,
    expected?: SuggestionExpectation | null,
): Promise<{ success: true } | DecisionFailure> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db, actor } = gate;

    const words = sanitizeText(reason ?? "").slice(0, 1000);
    if (words.length < 5) return fail("Say why in a few words. The member reads it.");
    const check = await reviewable(db, actor, id);
    if (!check.ok) return check.failure;

    try {
        const decided = await decideSuggestion(id, {
            reviewer: actor,
            verdict: "rejected",
            note: words,
            expected: expectation(expected),
        });
        if (!decided.success) return decisionFailure(decided);
        await dropClaim(actor, id);
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

/** A Desk row as the checks read it (DeskSource carries every CheckRow column). */
const asCheck = <T extends DeskSource>(row: T): T & CheckRow => ({ ...row, attributes: row.attributes ?? {} });

/** The style rules in effect (244), read by Package C's reader; none before 244 is pasted. */
function rulesInEffect(db: SupabaseClient): Promise<RuleInEffect[]> {
    return readRulesInEffect(db as unknown as ReturnType<typeof getAdminClient>);
}

/** Package C's flags, in words. */
function wordsFor(keys: FlagKey[]): DeskFlag[] {
    return keys.map((key) => ({ key, label: FLAG_LABELS[key] ?? key }));
}

/**
 * Package C's suggested fixes, in the shape the editor reads. `mold` is
 * the mold the row is filed under: some fixes need its name (colour out of
 * the title, a set piece's title).
 */
function fixesFor(row: DeskSource, keys: FlagKey[], rules: RuleInEffect[], mold: DeskSource | null): DeskFix[] {
    if (rules.length === 0) return [];
    return suggestedFixes(asCheck(row), keys, rules, { mold: mold ? asCheck(mold) : null }).map((f) => {
        const changes: Record<string, string> = {};
        for (const [k, v] of Object.entries(f.changes)) changes[k] = asText(v);
        return { rule: f.ruleTitle, changes };
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

type DeskMate = DeskSource & NumberMate;

/**
 * Rows elsewhere in the Registry sharing a model number with one of these,
 * same maker, each with the title of the mold it is filed under (the
 * set-pieces check needs it: a piece filed under its own mold is not
 * missing).
 */
async function sameNumberRows(db: SupabaseClient, rows: DeskSource[], maker: string | null): Promise<DeskMate[]> {
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
    const moldTitles = new Map<string, string>();
    const parentIds = [...new Set(out.map((r) => r.parent_id).filter((p): p is string => !!p))];
    for (const part of chunks(parentIds)) {
        const { data } = await db.from("catalog_items").select("id, title").in("id", part);
        for (const m of (data ?? []) as { id: string; title: string }[]) moldTitles.set(m.id, m.title);
    }
    return out.map((r) => ({
        ...asCheck(r),
        mold_title: r.parent_id ? (moldTitles.get(r.parent_id) ?? null) : null,
    }));
}

/**
 * Flags, fixes and links for some releases under one mold. `siblings` are
 * all the rows filed under that mold (the duplicate checks compare against
 * them); by default, the releases given.
 */
async function describeReleases(
    db: SupabaseClient,
    mold: DeskSource | null,
    releases: DeskSource[],
    siblings: DeskSource[] = releases,
): Promise<DeskRelease[]> {
    const ids = releases.map((r) => r.id);
    const [horses, wants, rules, sameNumber] = await Promise.all([
        countLinks(db, "user_horses", ids),
        countLinks(db, "user_wishlists", ids),
        rulesInEffect(db),
        sameNumberRows(db, releases, mold?.maker ?? null),
    ]);
    const siblingChecks = siblings.map(asCheck);
    const byNumber = new Map<string, DeskMate[]>();
    for (const r of sameNumber) {
        const n = asText((r.attributes ?? {}).model_number).trim();
        byNumber.set(n, [...(byNumber.get(n) ?? []), r]);
    }
    return releases.map((row) => {
        const n = asText((row.attributes ?? {}).model_number).trim();
        const keys = releaseFlags(asCheck(row), {
            mold: mold ? asCheck(mold) : null,
            siblings: siblingChecks,
            sameNumber: n ? (byNumber.get(n) ?? []).filter((r) => r.id !== row.id) : [],
        });
        return {
            row,
            flags: wordsFor(keys),
            fixes: fixesFor(row, keys, rules, mold),
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
        const [described, moldEntry] = await Promise.all([
            describeReleases(db, mold, releaseRows),
            describeMold(db, mold, releaseRows),
        ]);
        return {
            success: true,
            view: { mold: moldEntry, releases: described, fieldKeys: [...knownAttributeKeys()].sort() },
        };
    } catch (e) {
        return safeError("RegistryDesk.getMoldView", e, "That mold could not be read. Please try again.");
    }
}

/** A mold's own flags, fixes and links, judged against the releases filed under it. */
async function describeMold(db: SupabaseClient, mold: DeskSource, releaseRows: DeskSource[]): Promise<DeskRelease> {
    const [rules, horses, wants] = await Promise.all([
        rulesInEffect(db),
        countLinks(db, "user_horses", [mold.id]),
        countLinks(db, "user_wishlists", [mold.id]),
    ]);
    const moldKeys = moldFlags(asCheck(mold), releaseRows.map(asCheck));
    return {
        row: mold,
        flags: wordsFor(moldKeys),
        fixes: fixesFor(mold, moldKeys, rules, null),
        horses: horses.get(mold.id) ?? 0,
        wantLists: wants.get(mold.id) ?? 0,
    };
}

/**
 * One row as the Mold view shows it, read fresh after a save: a release
 * judged against its mold and the rows beside it, a mold against its
 * releases. One round trip, so the editor never has to ask again.
 */
async function freshEntry(db: SupabaseClient, row: DeskSource): Promise<DeskRelease> {
    if (row.item_type === "plastic_mold") {
        const { data } = await db.from("catalog_items").select(ROW_COLUMNS).eq("parent_id", row.id).limit(2000);
        return describeMold(db, row, ((data ?? []) as Record<string, unknown>[]).map(toSource));
    }
    let mold: DeskSource | null = null;
    let siblings: DeskSource[] = [row];
    if (row.parent_id) {
        const [m, kids] = await Promise.all([
            readRow(db, row.parent_id),
            db.from("catalog_items").select(ROW_COLUMNS).eq("parent_id", row.parent_id).limit(2000),
        ]);
        mold = m;
        siblings = ((kids.data ?? []) as Record<string, unknown>[])
            .map(toSource)
            .map((s) => (s.id === row.id ? row : s));
        if (!siblings.some((s) => s.id === row.id)) siblings.push(row);
    }
    const [entry] = await describeReleases(db, mold, [row], siblings);
    return entry;
}

/** One row for the editor, with its mold's title and everything that points at it. */
export async function getItemForEdit(
    id: string,
): Promise<
    ActionResult<{ item: DeskRelease; parentTitle: string | null; links: DeskLinks | null; fieldKeys: string[] }>
> {
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
        return {
            success: true,
            item: described,
            parentTitle: mold?.title ?? null,
            links,
            fieldKeys: [...knownAttributeKeys()].sort(),
        };
    } catch (e) {
        return safeError("RegistryDesk.getItemForEdit", e, "It could not be read. Please try again.");
    }
}

/** A change as the writer takes it: text trimmed to size, a list as its words. */
function cleanChange(v: unknown): DeskChangeValue {
    if (Array.isArray(v)) {
        return v
            .map((x) => (typeof x === "string" ? x.trim().slice(0, 500) : ""))
            .filter((x) => x !== "")
            .slice(0, 100);
    }
    return typeof v === "string" ? v.slice(0, 5000) : "";
}

/**
 * Save the editor's changes. Guarded by the row's updated_at: if someone
 * saved it since the editor opened, nothing is written and their version
 * comes back so the moderator can compare. A refused value names its
 * field, so the editor can mark that box. On success the row comes back
 * with its fresh flags, fixes and links, so the editor needs no second
 * read. The reference pages' cache tag is cleared by the writer; the Desk's
 * own pages are not re-rendered for a save (nothing else on them changed).
 */
export async function saveItem(input: {
    id: string;
    updatedAt: string;
    changes: Record<string, DeskChangeValue>;
    note?: string;
}): Promise<SaveResult> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { actor, db } = gate;

    const changes = Object.fromEntries(Object.entries(input.changes ?? {}).map(([k, v]) => [k, cleanChange(v)]));
    if (Object.keys(changes).length === 0) return fail("Nothing has changed yet.");
    try {
        const r = await updateItem(actor, {
            id: input.id,
            expectedUpdatedAt: input.updatedAt,
            changes,
            note: input.note ? sanitizeText(input.note).slice(0, 1000) : undefined,
            kind: "parent_id" in changes ? "refile" : "edit",
        });
        if (!r.success) {
            if (r.code === "conflict") {
                return {
                    success: false,
                    error: "Someone saved this since you opened it.",
                    conflict: r.current ? toSource(r.current as unknown as Record<string, unknown>) : null,
                };
            }
            return r.field ? { success: false, error: r.error, field: r.field } : fail(r.error);
        }
        const item = toSource(r.item as unknown as Record<string, unknown>);
        let entry: DeskRelease | null = null;
        try {
            entry = await freshEntry(db, item);
        } catch {
            // The save is in; only the fresh flags failed. The editor keeps what it had.
            entry = null;
        }
        return {
            success: true,
            item,
            entry,
            actionId: r.actionId ?? null,
            ...(r.warning ? { warning: r.warning } : {}),
        };
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
        if (!r.success) return fail(r.error);
        revalidatePath("/catalog/desk", "layout");
        return { success: true, id: r.id, item: toSource(r.item as unknown as Record<string, unknown>) };
    } catch (e) {
        return safeError("RegistryDesk.addItem", e, "It could not be added. Please try again.");
    }
}

// ── Merge and remove ──

async function readRow(db: SupabaseClient, id: string): Promise<DeskSource | null> {
    const { data } = await db.from("catalog_items").select(ROW_COLUMNS).eq("id", id).maybeSingle();
    return data ? toSource(data as Record<string, unknown>) : null;
}

/**
 * Both entries side by side, with what points at each, before a merge.
 * `undoReady` is false until update 243 is in: then only the owner can
 * merge, and the merge can't be undone, which the dialog says first.
 */
export async function previewMerge(
    keepId: string,
    removeId: string,
): Promise<
    ActionResult<{
        keep: { row: DeskSource; links: DeskLinks | null };
        remove: { row: DeskSource; links: DeskLinks | null };
        undoReady: boolean;
    }>
> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db } = gate;
    if (keepId === removeId) return fail("Pick two different entries.");
    try {
        const [keep, remove, ready] = await Promise.all([
            readRow(db, keepId),
            readRow(db, removeId),
            undoReady().catch(() => false),
        ]);
        if (!keep || !remove) return fail("One of them is not in the Registry any more.");
        const [keepLinks, removeLinks] = await Promise.all([
            linkCounts(keepId).catch(() => null),
            linkCounts(removeId).catch(() => null),
        ]);
        return {
            success: true,
            keep: { row: keep, links: keepLinks },
            remove: { row: remove, links: removeLinks },
            undoReady: ready,
        };
    } catch (e) {
        return safeError("RegistryDesk.previewMerge", e);
    }
}

/**
 * Ask for a merge, release into release or mold into mold (a mold's
 * releases move to the kept mold and take its scale): the owner's applies
 * at once; a moderator's waits for a second look.
 */
export async function requestMerge(
    keepId: string,
    removeId: string,
    note?: string,
): Promise<
    ActionResult<{
        actionId: string | null;
        status: "applied" | "awaiting_second_look";
        summary: string;
        /** The one-way merge ran (the owner, before update 243): it can't be undone. */
        legacy: boolean;
    }>
> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    if (keepId === removeId) return fail("Pick two different entries.");
    const words = sanitizeText(note ?? "").slice(0, 1000) || "The same entry listed twice.";
    try {
        const r = await writeRequestMerge(gate.actor, { keepId, removeId, note: words });
        if (!r.success) return fail(r.error);
        revalidatePath("/catalog/desk", "layout");
        return { success: true, actionId: r.actionId, status: r.status, summary: r.summary, legacy: r.legacy };
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
        if (!r.success) return fail(r.error);
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
        if (!r.success) return fail(r.error);
        refreshQueue();
        return { success: true };
    } catch (e) {
        return safeError("RegistryDesk.declineMerge", e, "It could not be saved. Please try again.");
    }
}

/**
 * Whether a row can be removed. Update 243 first (removing is undoable
 * only with it, so before it nobody removes): the dialog says so before
 * anyone types a reason. Then what points at it: nothing may.
 */
export async function previewRemove(
    id: string,
): Promise<
    ActionResult<
        { ready: false; message: string } | { ready: true; row: DeskSource; links: DeskLinks; canRemove: boolean }
    >
> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    try {
        if (!(await undoReady())) {
            return {
                success: true,
                ready: false,
                message:
                    gate.actor.role === "owner"
                        ? "Removing opens once you add update 243 (Admin › Ops). Until then nothing can be removed."
                        : "Removing opens once the site owner adds update 243. Until then nothing can be removed.",
            };
        }
        const row = await readRow(gate.db, id);
        if (!row) return fail("That entry is not in the Registry any more.");
        const links = await linkCounts(id);
        return { success: true, ready: true, row, links, canRemove: links.total === 0 };
    } catch (e) {
        return safeError("RegistryDesk.previewRemove", e);
    }
}

/** Remove a row nothing points at; hidden at once, undoable for 30 days. */
export async function removeItem(id: string, reason: string): Promise<ActionResult<{ actionId: string | null }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const words = sanitizeText(reason ?? "").slice(0, 1000);
    if (words.length < 3) return fail("Say why it goes, in a few words. It is kept in the history.");
    try {
        const r = await writeRemoveItem(gate.actor, { id, reason: words });
        if (!r.success) return fail(r.error);
        revalidatePath("/catalog/desk", "layout");
        return { success: true, actionId: r.actionId };
    } catch (e) {
        return safeError("RegistryDesk.removeItem", e, "It could not be removed. Please try again.");
    }
}

// ── Finding any entry, the Desk link, the tab counts ──

/**
 * Any Registry entry by name or model number: releases with no mold,
 * resins, tack, props ... everything the mold picker can't reach. Each hit
 * opens in the Desk editor (a release on its mold, anything else on its own).
 */
export async function searchEntries(term: string): Promise<ActionResult<{ entries: EntryHit[] }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db } = gate;

    const words = sanitizeText(term ?? "").slice(0, 100);
    if (words.length < 2) return { success: true, entries: [] };
    const number = words.replace(/^#\s*/, "").trim();
    const cols = "id, title, item_type, maker, scale, parent_id, attributes";
    try {
        const [byTitle, byNumber] = await Promise.all([
            db
                .from("catalog_items")
                .select(cols)
                .ilike("title", `%${escapeLike(words)}%`)
                .order("title")
                .limit(40),
            /^[A-Za-z0-9][A-Za-z0-9.\-/ ]{0,30}$/.test(number)
                ? db.from("catalog_items").select(cols).eq("attributes->>model_number", number).limit(20)
                : Promise.resolve({ data: [], error: null }),
        ]);
        if (byTitle.error)
            return safeError("RegistryDesk.searchEntries", byTitle.error, "The search did not work. Please try again.");
        const seen = new Set<string>();
        const rows: Record<string, unknown>[] = [];
        // A model number match first: it is the exact one.
        const found = [
            ...((byNumber.data ?? []) as Record<string, unknown>[]),
            ...((byTitle.data ?? []) as Record<string, unknown>[]),
        ];
        for (const r of found) {
            const id = String(r.id);
            if (seen.has(id)) continue;
            seen.add(id);
            rows.push(r);
        }
        const parentIds = [...new Set(rows.map((r) => r.parent_id).filter((p): p is string => typeof p === "string"))];
        const molds = new Map<string, string>();
        for (const part of chunks(parentIds)) {
            const { data } = await db.from("catalog_items").select("id, title").in("id", part);
            for (const m of (data ?? []) as { id: string; title: string }[]) molds.set(m.id, m.title);
        }
        return {
            success: true,
            entries: rows.map((r) => {
                const row = {
                    id: String(r.id),
                    item_type: String(r.item_type ?? ""),
                    parent_id: (r.parent_id as string | null) ?? null,
                };
                const n = asText(((r.attributes as Record<string, unknown> | null) ?? {}).model_number).trim();
                return {
                    id: row.id,
                    title: String(r.title ?? ""),
                    itemType: row.item_type,
                    maker: (r.maker as string | null) ?? null,
                    scale: (r.scale as string | null) ?? null,
                    modelNumber: n || null,
                    moldTitle: row.parent_id ? (molds.get(row.parent_id) ?? null) : null,
                    href: deskHrefFor(row),
                };
            }),
        };
    } catch (e) {
        return safeError("RegistryDesk.searchEntries", e, "The search did not work. Please try again.");
    }
}

/**
 * Whether to show "Edit in the Desk" to this viewer. A cached reference
 * page asks from the browser, so the page stays the same for everyone;
 * anyone who isn't a moderator gets the Desk's usual refusal and no link.
 */
export async function canOpenDesk(): Promise<ActionResult<{ role: "owner" | "moderator" }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    return { success: true, role: gate.actor.role === "owner" ? "owner" : "moderator" };
}

/** The numbers on the Desk's tabs and the "waiting for a second look" chip. */
export async function getDeskCounts(): Promise<ActionResult<{ counts: DeskCounts }>> {
    const gate = await deskGate();
    if (!gate.ok) return gate.failure;
    const { db } = gate;
    try {
        const [queue, rules] = await Promise.all([
            queueCounts(db),
            db.from("registry_style_rules").select("id", { count: "exact", head: true }).eq("status", "proposed"),
        ]);
        return {
            success: true,
            counts: {
                queue: queue.corrections + queue.additions + queue.duplicates,
                secondLooks: queue.second_looks,
                rules: rules.error ? 0 : (rules.count ?? 0),
            },
        };
    } catch (e) {
        return safeError("RegistryDesk.getDeskCounts", e);
    }
}
