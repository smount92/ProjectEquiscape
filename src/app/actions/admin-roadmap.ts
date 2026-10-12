"use server";

/**
 * Admin — the owners' roadmap (goals, problems, chores).
 *
 * Service role only: migration 230 enables RLS with no policies and
 * revokes the table from the API roles, so these actions are the only
 * way in and every one re-gates on ADMIN_EMAIL. The vocabulary and the
 * roll-ups live in src/lib/roadmap/model.ts; this file only moves rows.
 */

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
    closedAtFor,
    AREA_MAX,
    DETAIL_MAX,
    LINK_MAX,
    ROADMAP_HORIZONS,
    ROADMAP_KINDS,
    ROADMAP_STATUSES,
    SOURCE_MAX,
    TITLE_MAX,
    type RoadmapItem,
    type RoadmapPriority,
    type RoadmapStatus,
} from "@/lib/roadmap/model";

const ROADMAP_MIGRATION_NOTICE =
    "The roadmap table is not in the database yet — paste supabase/migrations/230_roadmap.sql.";

function admin() {
    // Untyped on purpose: the generated Database type predates this table.
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
    const { data, error } = await admin()
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
    return { success: true, item: toItem(data as Row) };
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
    const { data: current, error: readError } = await db
        .from("roadmap_items")
        .select("status, closed_at")
        .eq("id", id)
        .maybeSingle();
    if (readError) return { success: false, error: isMissingTable(readError) ? ROADMAP_MIGRATION_NOTICE : readError.message };
    if (!current) return { success: false, error: "That item is gone." };

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
        update.closed_at = closedAtFor(v.status, (current.closed_at as string | null) ?? null, now);
    }

    const { data, error } = await db.from("roadmap_items").update(update).eq("id", id).select(COLUMNS).single();
    if (error) return { success: false, error: error.message };
    return { success: true, item: toItem(data as Row) };
}

export async function deleteRoadmapItem(id: string): Promise<{ success: true } | { success: false; error: string }> {
    const denied = await gate();
    if (denied) return { success: false, error: denied };
    if (!z.uuid().safeParse(id).success) return { success: false, error: "Unknown item." };
    const { error } = await admin().from("roadmap_items").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true };
}
