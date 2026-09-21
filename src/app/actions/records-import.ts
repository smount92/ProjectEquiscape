"use server";

/**
 * Bulk show results for ONE horse from a parsed spreadsheet (see
 * lib/records/import for the template and the parser). The client
 * parses and previews; this re-parses the same cells on the server so a
 * direct caller gets the same truth, checks the horse is the caller's,
 * skips placings the horse already has (unless told to keep them), and
 * writes every good row in one insert stamped with a batch id so the
 * whole file can be undone (220). Rows are self-reported, the same
 * tier as the manual form.
 */
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth";
import { IMPORT_MAX_ROWS, parseImportRows, type ImportRowProblem } from "@/lib/records/import";
import { findDuplicates } from "@/lib/records/importTools";
import { validateQualifier, type QualifierValue } from "@/lib/records/qualifiers";

export interface ImportShowRecordsResult {
    success: boolean;
    error?: string;
    imported?: number;
    problems?: ImportRowProblem[];
    /** Row numbers skipped because the horse already had that placing (or the file repeated it). */
    duplicates?: number[];
    /** The batch id for undo; null when 220 is not in the database yet. */
    batchId?: string | null;
    /** Set when a column is not in the database yet: records kept, that part dropped. */
    warning?: string;
}

/** How long an import can be undone. */
const UNDO_WINDOW_MS = 7 * 24 * 3600 * 1000;

/** The 210 columns. */
function qualifierColumns(q: QualifierValue | null): Record<string, unknown> {
    return q
        ? { qualifier_program: q.program, qualifier_card: q.card, qualifier_year: q.year, qualifier_card_id: q.cardId }
        : {};
}

/** The 030 NAN columns, kept in step so the legacy readers see the same card. */
function nanMirror(q: QualifierValue | null): Record<string, unknown> {
    return q?.program === "nan"
        ? { is_nan_qualifying: true, nan_card_type: q.card, nan_year: q.year }
        : { is_nan_qualifying: false, nan_card_type: null, nan_year: null };
}

function showTypeFor(kind: "photo" | "live", series: string | null): string {
    const s = (series ?? "").toLowerCase();
    if (kind === "live") return /namhsa|nan\b/.test(s) ? "live_namhsa" : "live_regional";
    if (/mepsa/.test(s)) return "photo_mepsa";
    if (/model horse hub|\bmhh\b/.test(s)) return "photo_mhh";
    return "photo_other";
}

function isMissingColumn(error: { code?: string; message?: string } | null, column: string): boolean {
    return (error?.code === "42703" || error?.code === "PGRST204") && (error?.message ?? "").includes(column);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function importShowRecords(
    horseId: string,
    rows: Record<string, string>[],
    options: { includeDuplicates?: boolean } = {},
): Promise<ImportShowRecordsResult> {
    const { supabase, user } = await requireAuth();
    if (!UUID.test(horseId)) return { success: false, error: "That isn't a horse." };
    if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: "The file has no rows." };
    if (rows.length > IMPORT_MAX_ROWS) {
        return { success: false, error: `That is more than ${IMPORT_MAX_ROWS} rows — split the file.` };
    }

    const { data: horse } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .eq("id", horseId)
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();
    if (!horse) return { success: false, error: "Horse not found, or it isn't yours." };

    // Cells only — never trust a client's parsed shape.
    const clean = rows.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).slice(0, 80), String(v ?? "").slice(0, 500)])),
    );
    const parsed = parseImportRows(clean);
    if (parsed.records.length === 0) {
        return { success: false, error: "No rows could be read.", problems: parsed.problems };
    }

    // What the horse already has, for the duplicate check.
    const { data: existingRows } = await supabase
        .from("show_records")
        .select("show_name, show_date, class_name, placing")
        .eq("horse_id", horseId)
        .limit(2000);
    const existing = ((existingRows ?? []) as { show_name: string; show_date: string | null; class_name: string | null; placing: string | null }[]).map((r) => ({
        showName: r.show_name,
        showDate: r.show_date,
        className: r.class_name,
        placing: r.placing,
    }));
    const dupes = findDuplicates(parsed.records, existing);
    const keep = options.includeDuplicates === true;

    const batchId = randomUUID();
    const base: Record<string, unknown>[] = [];
    const withCards: Record<string, unknown>[] = [];
    let anyCard = false;
    for (const { rowNumber, record: r } of parsed.records) {
        if (!keep && dupes.has(rowNumber)) continue;
        const q = validateQualifier({
            program: r.qualifierProgram,
            card: r.qualifierCard,
            year: r.qualifierYear,
            cardId: r.qualifierCardId,
        });
        if (!q.ok) {
            parsed.problems.push({ rowNumber, message: q.error });
            continue;
        }
        if (q.value) anyCard = true;
        const row: Record<string, unknown> = {
            horse_id: horseId,
            user_id: user.id,
            show_name: r.showName,
            show_date: r.showDate,
            show_date_text: r.showDateText,
            // The 030 vocabulary (live_namhsa, live_regional, photo_mepsa,
            // photo_mhh, photo_other, virtual_other), picked from the
            // series where it says so.
            show_type: showTypeFor(r.showType, r.sanctioningBody),
            sanctioning_body: r.sanctioningBody,
            division: r.division,
            section_name: r.sectionName,
            class_name: r.className,
            placing: r.placing,
            ribbon_color: r.ribbonColor,
            total_class_entries: r.classSize,
            total_entries: r.classSize,
            award_category: r.awardCategory,
            competition_level: r.competitionLevel,
            judge_name: r.judgeName,
            show_location: r.showLocation,
            notes: r.notes,
            is_nan: q.value?.program === "nan",
            verification_tier: "self_reported",
            import_batch: batchId,
            ...nanMirror(q.value),
        };
        base.push(row);
        withCards.push({ ...row, ...qualifierColumns(q.value) });
    }
    const duplicates = [...dupes].sort((a, b) => a - b);
    if (base.length === 0) {
        return {
            success: false,
            error: duplicates.length ? "Every row is already on this horse." : "No rows could be read.",
            problems: parsed.problems,
            duplicates,
        };
    }

    const warnings: string[] = [];
    let undoable = true;
    let payload = anyCard ? withCards : base;
    let { error } = await supabase.from("show_records").insert(payload as never);
    if (error && anyCard && isMissingColumn(error, "qualifier")) {
        warnings.push("Card tracking isn't switched on yet, so the cards weren't kept. Edit those records to add them once it is.");
        payload = base;
        ({ error } = await supabase.from("show_records").insert(payload as never));
    }
    if (error && isMissingColumn(error, "import_batch")) {
        // 220 not pasted yet: the records land, there is just no one-click undo.
        undoable = false;
        warnings.push("Undo isn't switched on yet, so this import can only be removed record by record.");
        payload = payload.map((row) => {
            const copy = { ...row };
            delete copy.import_batch;
            return copy;
        });
        ({ error } = await supabase.from("show_records").insert(payload as never));
    }
    if (error) return { success: false, error: error.message, problems: parsed.problems, duplicates };

    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    revalidatePath(`/community/${horseId}/hoofprint`);
    return {
        success: true,
        imported: base.length,
        problems: parsed.problems,
        duplicates,
        batchId: undoable ? batchId : null,
        warning: warnings.length ? warnings.join(" ") : undefined,
    };
}

/** Remove every record a single import created, for seven days after it ran. Owner only. */
export async function undoShowRecordsImport(horseId: string, batchId: string): Promise<{ success: boolean; error?: string; removed?: number }> {
    const { supabase, user } = await requireAuth();
    if (!UUID.test(horseId) || !UUID.test(batchId)) return { success: false, error: "Nothing to undo." };
    const since = new Date(Date.now() - UNDO_WINDOW_MS).toISOString();
    const { data, error } = await supabase
        .from("show_records")
        .delete()
        .eq("horse_id", horseId)
        .eq("user_id", user.id)
        .eq("import_batch", batchId)
        .gte("created_at", since)
        .select("id");
    if (error) {
        if (isMissingColumn(error, "import_batch")) return { success: false, error: "Undo isn't switched on yet." };
        return { success: false, error: error.message };
    }
    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    revalidatePath(`/community/${horseId}/hoofprint`);
    return { success: true, removed: (data ?? []).length };
}
