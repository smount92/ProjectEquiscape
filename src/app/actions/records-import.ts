"use server";

/**
 * Bulk show results for ONE horse from a parsed spreadsheet (see
 * lib/records/import for the template and the parser). The client
 * parses and previews; this re-parses the same cells on the server so a
 * direct caller gets the same truth, checks the horse is the caller's,
 * and writes every good row in one insert. Rows are self-reported, the
 * same tier as the manual form.
 */
import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth";
import { IMPORT_MAX_ROWS, parseImportRows, type ImportRowProblem } from "@/lib/records/import";
import { validateQualifier, type QualifierValue } from "@/lib/records/qualifiers";

export interface ImportShowRecordsResult {
    success: boolean;
    error?: string;
    imported?: number;
    problems?: ImportRowProblem[];
    /** Set when the card columns (210) are not in the database: records kept, cards dropped. */
    warning?: string;
}

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

function isMissingColumn(error: { code?: string } | null): boolean {
    return error?.code === "42703" || error?.code === "PGRST204";
}

export async function importShowRecords(
    horseId: string,
    rows: Record<string, string>[],
): Promise<ImportShowRecordsResult> {
    const { supabase, user } = await requireAuth();
    if (!/^[0-9a-f-]{36}$/i.test(horseId)) return { success: false, error: "That isn't a horse." };
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

    const base: Record<string, unknown>[] = [];
    const withCards: Record<string, unknown>[] = [];
    let anyCard = false;
    for (const { rowNumber, record: r } of parsed.records) {
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
            ...nanMirror(q.value),
        };
        base.push(row);
        withCards.push({ ...row, ...qualifierColumns(q.value) });
    }
    if (base.length === 0) return { success: false, error: "No rows could be read.", problems: parsed.problems };

    let warning: string | undefined;
    let { error } = await supabase.from("show_records").insert((anyCard ? withCards : base) as never);
    if (error && anyCard && isMissingColumn(error)) {
        warning = "Imported — but card tracking isn't switched on yet, so the cards weren't kept. Edit those records to add them once it is.";
        ({ error } = await supabase.from("show_records").insert(base as never));
    }
    if (error) return { success: false, error: error.message, problems: parsed.problems };

    revalidatePath(`/stable/${horseId}`);
    revalidatePath(`/community/${horseId}`);
    revalidatePath(`/community/${horseId}/hoofprint`);
    return { success: true, imported: base.length, problems: parsed.problems, warning };
}
