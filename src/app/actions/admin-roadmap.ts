"use server";

/**
 * Admin — the owners' roadmap (goals, problems, chores) and its history.
 *
 * Service role only: migrations 230/231 enable RLS with no policies and
 * revoke the tables from the API roles, so these actions are the only
 * way in and every one re-gates on ADMIN_EMAIL. The vocabulary, the
 * roll-ups and the change descriptions live in src/lib/roadmap/model.ts;
 * this file only moves rows.
 *
 * History is written here, not by the client: every update diffs the
 * row before and after and records the tracked fields that changed, so
 * the thread under an item is the truth about what happened to it.
 */

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
    closedAtFor,
    diffItem,
    AREA_MAX,
    DETAIL_MAX,
    LINK_MAX,
    NOTE_MAX,
    ROADMAP_HORIZONS,
    ROADMAP_KINDS,
    ROADMAP_STATUSES,
    SOURCE_MAX,
    TITLE_MAX,
    type FieldChange,
    type RoadmapEvent,
    type RoadmapEventWithItem,
    type RoadmapItem,
    type RoadmapPriority,
    type RoadmapStatus,
} from "@/lib/roadmap/model";

const ROADMAP_MIGRATION_NOTICE =
    "The roadmap table is not in the database yet — paste supabase/migrations/230_roadmap.sql.";
const HISTORY_MIGRATION_NOTICE =
    "Roadmap history is not in the database yet — paste supabase/migrations/231_roadmap_events.sql.";

function admin() {
    // Untyped on purpose: the generated Database type predates these tables.
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function isMissingTable(error: { code?: string } | null): boolean {
    return error?.code === "42P01" || error?.code === "PGRST205";
}

async function gate(): Promise<string | null> {
    try {
        await requireAdmin();
        return null;
    } catch {
        return "Unauthorized";
    }
}

type Row = {
    id: string;
    title: string;
    detail: string;
    kind: string;
    horizon: string;
    status: string;
    priority: number;
    area: string;
    source: string;
    link: string;
    due_on: string | null;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
};

function toItem(r: Row): RoadmapItem {
    return {
        id: r.id,
        title: r.title,
        detail: r.detail ?? "",
        kind: r.kind as RoadmapItem["kind"],
        horizon: r.horizon as RoadmapItem["horizon"],
        status: r.status as RoadmapStatus,
        priority: r.priority as RoadmapPriority,
        area: r.area ?? "",
        source: r.source ?? "",
        link: r.link ?? "",
        dueOn: r.due_on,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        closedAt: r.closed_at,
    };
}

const COLUMNS =
    "id, title, detail, kind, horizon, status, priority, area, source, link, due_on, created_at, updated_at, closed_at";

type EventRow = {
    id: string;
    item_id: string;
    kind: string;
    body: string;
    changes: unknown;
    created_at: string;
};

const EVENT_COLUMNS = "id, item_id, kind, body, changes, created_at";

function toEvent(r: EventRow): RoadmapEvent {
    return {
        id: r.id,
        itemId: r.item_id,
        kind: r.kind as RoadmapEvent["kind"],
        body: r.body ?? "",
        changes: Array.isArray(r.changes) ? (r.changes as FieldChange[]) : [],
        createdAt: r.created_at,
    };
}

/**
 * Record a history row. A missing 231 is tolerated silently: the item
 * change itself already succeeded, and the tab shows the paste notice
 * where the thread would be.
 */
async function record(
    db: ReturnType<typeof admin>,
    itemId: string,
    kind: RoadmapEvent["kind"],
    body: string,
    changes: FieldChange[] = [],
): Promise<RoadmapEvent | null> {
    const { data, error } = await db
        .from("roadmap_events")
        .insert({ item_id: itemId, kind, body, changes })
        .select(EVENT_COLUMNS)
        .single();
    if (error) return null;
    return toEvent(data as EventRow);
}

const itemInputSchema = z.object({
    title: z.string().trim().min(1, "Give it a title.").max(TITLE_MAX),
    detail: z.string().trim().max(DETAIL_MAX).default(""),
    kind: z.enum(ROADMAP_KINDS),
    horizon: z.enum(ROADMAP_HORIZONS),
    status: z.enum(ROADMAP_STATUSES).default("open"),
    priority: z.coerce.number().int().min(1).max(3).default(2),
    area: z.string().trim().max(AREA_MAX).default(""),
    source: z.string().trim().max(SOURCE_MAX).default(""),
    link: z
        .string()
        .trim()
        .max(LINK_MAX)
        .default("")
        .refine((v) => v === "" || /^https?:\/\//i.test(v), "A link must start with http:// or https://."),
    dueOn: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-31.")
        .nullable()
        .optional()
        .transform((v) => (v ? v : null)),
});

export type RoadmapItemInput = z.input<typeof itemInputSchema>;

type ListResult =
    | { success: true; items: RoadmapItem[]; schemaReady: true }
    | { success: true; items: []; schemaReady: false; notice: string }
    | { success: false; error: string };

export async function listRoadmap(): Promise<ListResult> {
    const denied = await gate();
    if (denied) return { success: false, error: denied };
    const { data, error } = await admin().from("roadmap_items").select(COLUMNS).order("created_at", { ascending: false });
    if (error) {
        if (isMissingTable(error)) return { success: true, items: [], schemaReady: false, notice: ROADMAP_MIGRATION_NOTICE };
        return { success: false, error: error.message };
    }
    return { success: true, items: ((data ?? []) as Row[]).map(toItem), schemaReady: true };
}

type ItemResult = { success: true; item: RoadmapItem } | { success: false; error: string };

export async function createRoadmapItem(input: RoadmapItemInput): Promise<ItemResult> {
    const denied = await gate();
    if (denied) return { success: false, error: denied };
    const parsed = itemInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    const v = parsed.data;
    const now = new Date();
    const db = admin();
    const { data, error } = await db
        .from("roadmap_items")
        .insert({
            title: v.title,
            detail: v.detail,
            kind: v.kind,
            horizon: v.horizon,
            status: v.status,
            priority: v.priority,
            area: v.area,
            source: v.source,
            link: v.link,
            due_on: v.dueOn,
            closed_at: closedAtFor(v.status, null, now),
        })
        .select(COLUMNS)
        .single();
    if (error) return { success: false, error: isMissingTable(error) ? ROADMAP_MIGRATION_NOTICE : error.message };
    const item = toItem(data as Row);
    await record(db, item.id, "created", "Added to the roadmap");
    return { success: true, item };
}

const patchSchema = itemInputSchema.partial();
export type RoadmapItemPatch = z.input<typeof patchSchema>;

export async function updateRoadmapItem(id: string, patch: RoadmapItemPatch): Promise<ItemResult> {
    const denied = await gate();
    if (denied) return { success: false, error: denied };
    if (!z.uuid().safeParse(id).success) return { success: false, error: "Unknown item." };
    const parsed = patchSchema.safeParse(patch);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
    const v = parsed.data;

    const db = admin();
    const { data: currentRow, error: readError } = await db.from("roadmap_items").select(COLUMNS).eq("id", id).maybeSingle();
    if (readError) return { success: false, error: isMissingTable(readError) ? ROADMAP_MIGRATION_NOTICE : readError.message };
    if (!currentRow) return { success: false, error: "That item is gone." };
    const before = toItem(currentRow as Row);

    const now = new Date();
    const update: Record<string, unknown> = { updated_at: now.toISOString() };
    if (v.title !== undefined) update.title = v.title;
    if (v.detail !== undefined) update.detail = v.detail;
    if (v.kind !== undefined) update.kind = v.kind;
    if (v.horizon !== undefined) update.horizon = v.horizon;
    if (v.priority !== undefined) update.priority = v.priority;
    if (v.area !== undefined) update.area = v.area;
    if (v.source !== undefined) update.source = v.source;
    if (v.link !== undefined) update.link = v.link;
    if (v.dueOn !== undefined) update.due_on = v.dueOn;
    if (v.status !== undefined) {
        update.status = v.status;
        update.closed_at = closedAtFor(v.status, before.closedAt, now);
    }

    const { data, error } = await db.from("roadmap_items").update(update).eq("id", id).select(COLUMNS).single();
    if (error) return { success: false, error: error.message };
    const after = toItem(data as Row);

    const changes = diffItem(before, after);
    if (changes.length > 0) await record(db, id, "change", "", changes);
    return { success: true, item: after };
}

export async function deleteRoadmapItem(id: string): Promise<{ success: true } | { success: false; error: string }> {
    const denied = await gate();
    if (denied) return { success: false, error: denied };
    if (!z.uuid().safeParse(id).success) return { success: false, error: "Unknown item." };
    const { error } = await admin().from("roadmap_items").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// ── History ──

type EventsResult =
    | { success: true; events: RoadmapEvent[]; schemaReady: true }
    | { success: true; events: []; schemaReady: false; notice: string }
    | { success: false; error: string };

/** One item's thread, newest first. */
export async function listRoadmapEvents(itemId: string): Promise<EventsResult> {
    const denied = await gate();
    if (denied) return { success: false, error: denied };
    if (!z.uuid().safeParse(itemId).success) return { success: false, error: "Unknown item." };
    const { data, error } = await admin()
        .from("roadmap_events")
        .select(EVENT_COLUMNS)
        .eq("item_id", itemId)
        .order("created_at", { ascending: false })
        .limit(200);
    if (error) {
        if (isMissingTable(error)) return { success: true, events: [], schemaReady: false, notice: HISTORY_MIGRATION_NOTICE };
        return { success: false, error: error.message };
    }
    return { success: true, events: ((data ?? []) as EventRow[]).map(toEvent), schemaReady: true };
}

export async function addRoadmapNote(
    itemId: string,
    body: string,
): Promise<{ success: true; event: RoadmapEvent } | { success: false; error: string }> {
    const denied = await gate();
    if (denied) return { success: false, error: denied };
    if (!z.uuid().safeParse(itemId).success) return { success: false, error: "Unknown item." };
    const text = z.string().trim().min(1, "Write something first.").max(NOTE_MAX).safeParse(body);
    if (!text.success) return { success: false, error: text.error.issues[0]?.message ?? "Check the note." };
    const db = admin();
    const { data, error } = await db
        .from("roadmap_events")
        .insert({ item_id: itemId, kind: "comment", body: text.data, changes: [] })
        .select(EVENT_COLUMNS)
        .single();
    if (error) return { success: false, error: isMissingTable(error) ? HISTORY_MIGRATION_NOTICE : error.message };
    // A note counts as touching the item, so it stops reading as stale.
    await db.from("roadmap_items").update({ updated_at: new Date().toISOString() }).eq("id", itemId);
    return { success: true, event: toEvent(data as EventRow) };
}

/** The latest activity across every item, newest first, with each item's title. */
export async function listRecentRoadmapEvents(
    limit = 25,
): Promise<{ success: true; events: RoadmapEventWithItem[] } | { success: false; error: string }> {
    const denied = await gate();
    if (denied) return { success: false, error: denied };
    const db = admin();
    const { data, error } = await db
        .from("roadmap_events")
        .select(EVENT_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 100));
    if (error) {
        if (isMissingTable(error)) return { success: true, events: [] };
        return { success: false, error: error.message };
    }
    const events = ((data ?? []) as EventRow[]).map(toEvent);
    const itemIds = [...new Set(events.map((e) => e.itemId))];
    const titles = new Map<string, string>();
    if (itemIds.length > 0) {
        const { data: items } = await db.from("roadmap_items").select("id, title").in("id", itemIds);
        for (const it of (items ?? []) as { id: string; title: string }[]) titles.set(it.id, it.title);
    }
    return {
        success: true,
        events: events.map((e) => ({ ...e, itemTitle: titles.get(e.itemId) ?? "(deleted item)" })),
    };
}
