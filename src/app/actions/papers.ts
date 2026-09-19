"use server";

/**
 * Papers — breeding certificates, registration papers, pedigree charts
 * filed on a horse (migration 213).
 *
 * The file goes straight from the browser into the PRIVATE horse-papers
 * bucket under the owner's own folder (storage RLS), then the metadata
 * row is written here after the path is re-derived and refused if it is
 * not {owner}/{horse}/{uuid}.{ext}. Reads sign URLs with the service
 * role, only after the caller's own RLS returned the row — so a private
 * horse's papers are never signed for a stranger.
 *
 * Degrades before 213 is pasted: reads return [] and writes explain.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { sanitizeText } from "@/lib/utils/validation";
import { decodeHtmlEntities } from "@/lib/utils/decodeEntities";
import {
    MAX_PAPERS_PER_HORSE,
    MAX_PAPER_BYTES,
    MAX_PAPER_ISSUER,
    MAX_PAPER_NOTES,
    MAX_PAPER_TITLE,
    PAPER_MIMES,
    isPaperKind,
    isValidPaperPath,
    type PaperKind,
} from "@/lib/papers/validate";

const BUCKET = "horse-papers";
/** An hour: long enough to read a certificate, short enough to be a view, not a copy. */
const SIGNED_TTL = 60 * 60;

export interface PaperView {
    id: string;
    horseId: string;
    kind: PaperKind;
    title: string;
    issuedBy: string | null;
    issuedOn: string | null;
    notes: string | null;
    mime: string;
    /** A signed URL, minted for this read. */
    url: string;
    byteSize: number;
    isPublic: boolean;
    createdAt: string;
}

type DbError = { code?: string; message?: string } | null;

function missingSchema(error: DbError): boolean {
    return !!error && (error.code === "42P01" || error.code === "42703" || error.code === "PGRST204");
}

// A loose facade: the 213 table isn't in the generated types yet.
type Row = Record<string, unknown>;
function loose(client: unknown) {
    return client as {
        from: (t: string) => {
            select: (c: string) => {
                eq: (k: string, v: string) => {
                    order: (k: string, o: { ascending: boolean }) => PromiseLike<{ data: Row[] | null; error: DbError }>;
                    maybeSingle: () => PromiseLike<{ data: Row | null; error: DbError }>;
                };
            };
            insert: (row: Row) => { select: (c: string) => { single: () => PromiseLike<{ data: Row | null; error: DbError }> } };
            update: (row: Row) => { eq: (k: string, v: string) => { select: (c: string) => PromiseLike<{ data: Row[] | null; error: DbError }> } };
            delete: () => { eq: (k: string, v: string) => { select: (c: string) => PromiseLike<{ data: Row[] | null; error: DbError }> } };
        };
    };
}

const text = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = decodeHtmlEntities(sanitizeText(v)).trim().slice(0, max);
    return t || null;
};

/**
 * The papers a viewer may see on this horse, newest filing last so the
 * passport reads like a folder. RLS decides: the owner sees all, a
 * visitor sees public papers on a visible horse, anon likewise.
 */
export async function listPapers(horseId: string): Promise<PaperView[]> {
    if (!z.string().uuid().safeParse(horseId).success) return [];
    const supabase = await createClient();
    const { data, error } = await loose(supabase)
        .from("horse_papers")
        .select("id, horse_id, kind, title, issued_by, issued_on, notes, file_path, mime, byte_size, is_public, created_at")
        .eq("horse_id", horseId)
        .order("created_at", { ascending: true });
    if (error || !data || data.length === 0) return [];

    // Sign as the server: the caller's RLS already said yes to the row.
    const paths = data.map((r) => String(r.file_path));
    let signed = new Map<string, string>();
    try {
        const admin = getAdminClient();
        const { data: urls } = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
        signed = new Map((urls ?? []).filter((u) => u.signedUrl).map((u) => [u.path as string, u.signedUrl]));
    } catch (err) {
        logger.error("Papers", "signing failed", err);
        return [];
    }

    return data.flatMap((r) => {
        const url = signed.get(String(r.file_path));
        if (!url) return [];
        return [
            {
                id: String(r.id),
                horseId: String(r.horse_id),
                kind: (isPaperKind(r.kind) ? r.kind : "other") as PaperKind,
                title: String(r.title),
                issuedBy: (r.issued_by as string | null) ?? null,
                issuedOn: (r.issued_on as string | null) ?? null,
                notes: (r.notes as string | null) ?? null,
                mime: String(r.mime),
                url,
                byteSize: Number(r.byte_size ?? 0),
                isPublic: r.is_public !== false,
                createdAt: String(r.created_at),
            },
        ];
    });
}

const createSchema = z.object({
    horseId: z.string().uuid(),
    path: z.string().min(1).max(300),
    mime: z.string(),
    byteSize: z.number().int().positive().max(MAX_PAPER_BYTES),
    kind: z.string(),
    title: z.string().min(1).max(MAX_PAPER_TITLE),
    issuedBy: z.string().max(MAX_PAPER_ISSUER).nullable().optional(),
    issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    notes: z.string().max(MAX_PAPER_NOTES).nullable().optional(),
    isPublic: z.boolean().optional(),
});

/** After the browser uploaded the file: file the paper. */
export async function createPaper(
    input: z.input<typeof createSchema>,
): Promise<{ success: true; paperId: string } | { success: false; error: string }> {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Check the paper's details and try again." };
    const v = parsed.data;
    const { supabase, user } = await requireAuth();

    if (!isValidPaperPath(v.path, user.id, v.horseId)) {
        return { success: false, error: "That file isn't where papers live." };
    }
    if (!PAPER_MIMES.has(v.mime)) return { success: false, error: "Papers can be a photo, a scan or a PDF." };
    if (!isPaperKind(v.kind)) return { success: false, error: "Pick what kind of paper this is." };

    // Yours, and not on the deleted shelf.
    const { data: horse } = await supabase
        .from("user_horses")
        .select("id")
        .eq("id", v.horseId)
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();
    if (!horse) return { success: false, error: "Horse not found or not yours." };

    const admin = getAdminClient();
    const cleanUp = async () => {
        try {
            await admin.storage.from(BUCKET).remove([v.path]);
        } catch {
            /* best effort */
        }
    };

    const { data: existing, error: countError } = await loose(supabase)
        .from("horse_papers")
        .select("id")
        .eq("horse_id", v.horseId)
        .order("created_at", { ascending: true });
    if (countError) {
        await cleanUp();
        return {
            success: false,
            error: missingSchema(countError)
                ? "Papers aren't switched on for this site yet — try again after the next update."
                : "Could not file the paper.",
        };
    }
    if ((existing?.length ?? 0) >= MAX_PAPERS_PER_HORSE) {
        await cleanUp();
        return { success: false, error: `A horse can hold ${MAX_PAPERS_PER_HORSE} papers — remove one first.` };
    }

    const { data: inserted, error } = await loose(supabase)
        .from("horse_papers")
        .insert({
            horse_id: v.horseId,
            owner_id: user.id,
            kind: v.kind,
            title: text(v.title, MAX_PAPER_TITLE) ?? "Papers",
            issued_by: text(v.issuedBy, MAX_PAPER_ISSUER),
            issued_on: v.issuedOn ?? null,
            notes: text(v.notes, MAX_PAPER_NOTES),
            file_path: v.path,
            mime: v.mime,
            byte_size: v.byteSize,
            is_public: v.isPublic !== false,
            sort_order: existing?.length ?? 0,
        })
        .select("id")
        .single();
    if (error || !inserted) {
        await cleanUp();
        logger.error("Papers", "insert failed", { message: error?.message });
        return { success: false, error: "Could not file the paper." };
    }

    revalidatePath(`/stable/${v.horseId}`);
    revalidatePath(`/community/${v.horseId}`);
    return { success: true, paperId: String(inserted.id) };
}

const updateSchema = z.object({
    paperId: z.string().uuid(),
    kind: z.string().optional(),
    title: z.string().min(1).max(MAX_PAPER_TITLE).optional(),
    issuedBy: z.string().max(MAX_PAPER_ISSUER).nullable().optional(),
    issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    notes: z.string().max(MAX_PAPER_NOTES).nullable().optional(),
    isPublic: z.boolean().optional(),
});

export async function updatePaper(
    input: z.input<typeof updateSchema>,
): Promise<{ success: boolean; error?: string }> {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Check the paper's details and try again." };
    const v = parsed.data;
    const { supabase } = await requireAuth();

    const patch: Row = { updated_at: new Date().toISOString() };
    if (v.kind !== undefined) {
        if (!isPaperKind(v.kind)) return { success: false, error: "Pick what kind of paper this is." };
        patch.kind = v.kind;
    }
    if (v.title !== undefined) patch.title = text(v.title, MAX_PAPER_TITLE) ?? "Papers";
    if (v.issuedBy !== undefined) patch.issued_by = text(v.issuedBy, MAX_PAPER_ISSUER);
    if (v.issuedOn !== undefined) patch.issued_on = v.issuedOn;
    if (v.notes !== undefined) patch.notes = text(v.notes, MAX_PAPER_NOTES);
    if (v.isPublic !== undefined) patch.is_public = v.isPublic;

    // Owner-scoped RLS is the wall; the row count is the receipt.
    const { data, error } = await loose(supabase)
        .from("horse_papers")
        .update(patch)
        .eq("id", v.paperId)
        .select("horse_id");
    if (error) return { success: false, error: "Could not save the paper." };
    if (!data || data.length === 0) return { success: false, error: "Paper not found." };
    const horseId = String(data[0].horse_id);
    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    return { success: true };
}

export async function deletePaper(paperId: string): Promise<{ success: boolean; error?: string }> {
    if (!z.string().uuid().safeParse(paperId).success) return { success: false, error: "Bad id." };
    const { supabase } = await requireAuth();

    const { data, error } = await loose(supabase)
        .from("horse_papers")
        .delete()
        .eq("id", paperId)
        .select("horse_id, file_path");
    if (error) return { success: false, error: "Could not remove the paper." };
    if (!data || data.length === 0) return { success: false, error: "Paper not found." };

    // The row is gone (RLS said it was yours); the object follows.
    try {
        const admin = getAdminClient();
        await admin.storage.from(BUCKET).remove([String(data[0].file_path)]);
    } catch (err) {
        logger.error("Papers", "object removal failed (row already gone)", err);
    }
    const horseId = String(data[0].horse_id);
    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    return { success: true };
}
