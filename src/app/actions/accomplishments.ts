"use server";

/**
 * Other accomplishments (migration 214): what a horse did that isn't a
 * show placing — race records, performance, breedings, awards.
 *
 * Owner-kept, RLS-gated, public on a public passport when the owner
 * says so. Degrades before 214 is pasted: reads return [] and writes
 * explain.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { sanitizeText } from "@/lib/utils/validation";
import { decodeHtmlEntities } from "@/lib/utils/decodeEntities";
import {
    MAX_DATE_TEXT,
    MAX_DETAIL,
    MAX_ORG,
    MAX_RESULT,
    MAX_TITLE,
    isAccomplishmentKind,
    validateAccomplishment,
    type AccomplishmentKind,
    type AccomplishmentValue,
} from "@/lib/accomplishments";

export interface AccomplishmentView {
    id: string;
    horseId: string;
    kind: AccomplishmentKind;
    organization: string | null;
    title: string;
    result: string | null;
    happenedOn: string | null;
    dateText: string | null;
    detail: string | null;
    linkUrl: string | null;
    isPublic: boolean;
    createdAt: string;
}

type DbError = { code?: string; message?: string } | null;
type Row = Record<string, unknown>;

function missingSchema(error: DbError): boolean {
    return !!error && (error.code === "42P01" || error.code === "42703" || error.code === "PGRST204");
}

// The 214 table isn't in the generated types yet.
function loose(client: unknown) {
    return client as {
        from: (t: string) => {
            select: (c: string) => {
                eq: (k: string, v: string) => {
                    order: (k: string, o: { ascending: boolean; nullsFirst?: boolean }) => PromiseLike<{ data: Row[] | null; error: DbError }>;
                };
            };
            insert: (row: Row) => { select: (c: string) => { single: () => PromiseLike<{ data: Row | null; error: DbError }> } };
            update: (row: Row) => { eq: (k: string, v: string) => { select: (c: string) => PromiseLike<{ data: Row[] | null; error: DbError }> } };
            delete: () => { eq: (k: string, v: string) => { select: (c: string) => PromiseLike<{ data: Row[] | null; error: DbError }> } };
        };
    };
}

const clean = (v: string | null, max: number): string | null => {
    if (!v) return null;
    const t = decodeHtmlEntities(sanitizeText(v)).trim().slice(0, max);
    return t || null;
};

function mapRow(r: Row): AccomplishmentView {
    return {
        id: String(r.id),
        horseId: String(r.horse_id),
        kind: (isAccomplishmentKind(r.kind) ? r.kind : "other") as AccomplishmentKind,
        organization: (r.organization as string | null) ?? null,
        title: String(r.title),
        result: (r.result as string | null) ?? null,
        happenedOn: (r.happened_on as string | null) ?? null,
        dateText: (r.date_text as string | null) ?? null,
        detail: (r.detail as string | null) ?? null,
        linkUrl: (r.link_url as string | null) ?? null,
        isPublic: r.is_public !== false,
        createdAt: String(r.created_at),
    };
}

/** Newest first; RLS decides who sees what. [] before 214. */
export async function listAccomplishments(horseId: string): Promise<AccomplishmentView[]> {
    if (!z.string().uuid().safeParse(horseId).success) return [];
    const supabase = await createClient();
    const { data, error } = await loose(supabase)
        .from("horse_accomplishments")
        .select("*")
        .eq("horse_id", horseId)
        .order("happened_on", { ascending: false, nullsFirst: false });
    if (error || !data) return [];
    return data.map(mapRow);
}

const inputSchema = z.object({
    kind: z.string(),
    organization: z.string().max(MAX_ORG).nullable().optional(),
    title: z.string().min(1).max(MAX_TITLE),
    result: z.string().max(MAX_RESULT).nullable().optional(),
    when: z.string().max(MAX_DATE_TEXT).nullable().optional(),
    detail: z.string().max(MAX_DETAIL).nullable().optional(),
    linkUrl: z.string().max(600).nullable().optional(),
    isPublic: z.boolean().optional(),
});

function toRow(value: AccomplishmentValue): Row {
    return {
        kind: value.kind,
        organization: clean(value.organization, MAX_ORG),
        title: clean(value.title, MAX_TITLE) ?? "Accomplishment",
        result: clean(value.result, MAX_RESULT),
        happened_on: value.happenedOn,
        date_text: clean(value.dateText, MAX_DATE_TEXT),
        detail: clean(value.detail, MAX_DETAIL),
        link_url: value.linkUrl,
        is_public: value.isPublic,
    };
}

export async function createAccomplishment(
    input: z.input<typeof inputSchema> & { horseId: string },
): Promise<{ success: true; id: string } | { success: false; error: string }> {
    if (!z.string().uuid().safeParse(input.horseId).success) return { success: false, error: "Bad horse id." };
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Check the details and try again." };
    const checked = validateAccomplishment(parsed.data);
    if (!checked.ok) return { success: false, error: checked.error };
    const { supabase, user } = await requireAuth();

    const { data: horse } = await supabase
        .from("user_horses")
        .select("id")
        .eq("id", input.horseId)
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();
    if (!horse) return { success: false, error: "Horse not found or not yours." };

    const { data, error } = await loose(supabase)
        .from("horse_accomplishments")
        .insert({ horse_id: input.horseId, owner_id: user.id, ...toRow(checked.value) })
        .select("id")
        .single();
    if (error || !data) {
        if (missingSchema(error)) {
            return { success: false, error: "Accomplishments aren't switched on for this site yet — try again after the next update." };
        }
        logger.error("Accomplishments", "insert failed", { message: error?.message });
        return { success: false, error: "Could not save the accomplishment." };
    }
    revalidatePath(`/stable/${input.horseId}`);
    revalidatePath(`/community/${input.horseId}`);
    return { success: true, id: String(data.id) };
}

export async function updateAccomplishment(
    input: z.input<typeof inputSchema> & { id: string },
): Promise<{ success: boolean; error?: string }> {
    if (!z.string().uuid().safeParse(input.id).success) return { success: false, error: "Bad id." };
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Check the details and try again." };
    const checked = validateAccomplishment(parsed.data);
    if (!checked.ok) return { success: false, error: checked.error };
    const { supabase } = await requireAuth();

    // Owner-scoped RLS is the wall; the row count is the receipt.
    const { data, error } = await loose(supabase)
        .from("horse_accomplishments")
        .update({ ...toRow(checked.value), updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .select("horse_id");
    if (error) return { success: false, error: "Could not save the accomplishment." };
    if (!data || data.length === 0) return { success: false, error: "Accomplishment not found." };
    const horseId = String(data[0].horse_id);
    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    return { success: true };
}

export async function deleteAccomplishment(id: string): Promise<{ success: boolean; error?: string }> {
    if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Bad id." };
    const { supabase } = await requireAuth();
    const { data, error } = await loose(supabase)
        .from("horse_accomplishments")
        .delete()
        .eq("id", id)
        .select("horse_id");
    if (error) return { success: false, error: "Could not remove the accomplishment." };
    if (!data || data.length === 0) return { success: false, error: "Accomplishment not found." };
    const horseId = String(data[0].horse_id);
    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    return { success: true };
}
