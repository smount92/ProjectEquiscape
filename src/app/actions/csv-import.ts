"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { sanitizeText } from "@/lib/utils/validation";
import {
    normalizeFinishType,
    normalizeCondition,
    normalizePrice,
    CONDITION_GRADES,
} from "@/lib/csv-import/validation";

// ============================================================
// CSV Import — Server Action (matching is client-side)
// ============================================================
// Prefers batch_import_horses_v2 (migration 144): per-row errors,
// Notes, and an honored publish flag. Feature-detects v2 and falls
// back to the legacy batch_import_horses RPC (whole-batch
// transaction, no notes, always-private) until 144 is applied —
// the result flags the fallback so the UI can say so.
// ============================================================

const importRowSchema = z.object({
    /** The user's spreadsheet row number (header = 1, first data row = 2). */
    rowNumber: z.number().int().positive().max(100000),
    customName: z.string().max(300),
    condition: z.string().max(100),
    finishType: z.string().max(100),
    purchasePrice: z.string().max(50),
    estimatedValue: z.string().max(50),
    notes: z.string().max(2000),
    catalogId: z.string().uuid().nullable(),
});

const importInputSchema = z.object({
    rows: z.array(importRowSchema).min(1).max(1000),
    publish: z.boolean(),
});

export interface ImportRowError {
    rowNumber: number;
    name: string;
    message: string;
}

export interface BatchImportResult {
    success: boolean;
    /** Rows that actually landed in the stable. */
    imported?: number;
    /** Per-row failures (v2 path — plain English, spreadsheet row numbers). */
    rowErrors?: ImportRowError[];
    /** True when migration 144 isn't applied yet and the legacy RPC ran
     *  (all-or-nothing, notes dropped, horses imported private). */
    usedFallback?: boolean;
    /** Whole-call failure. */
    error?: string;
}

/** PostgREST/Postgres "function does not exist" — migration 144 not applied. */
function isMissingFunctionError(err: { code?: string; message?: string }): boolean {
    return (
        err.code === "PGRST202" ||
        err.code === "42883" ||
        /could not find the function|does not exist/i.test(err.message ?? "")
    );
}

/**
 * Execute a batch import of horses from parsed/validated CSV data.
 * Validates + normalizes every row first (same rules as the client
 * pre-check and migration 144), so invalid rows come back as structured
 * errors instead of aborting the batch.
 */
export async function executeBatchImport(
    input: z.infer<typeof importInputSchema>,
): Promise<BatchImportResult> {
    try {
        const parsed = importInputSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Invalid import payload." };
        }
        const { rows, publish } = parsed.data;

        const { supabase, user } = await requireAuth();

        // ── Normalize + validate (defense in depth — the client already
        //    pre-checked; direct callers get the same truth) ──
        const rowErrors: ImportRowError[] = [];
        const payload: Record<string, string | number | boolean | null>[] = [];

        for (const row of rows) {
            const name = sanitizeText(row.customName).trim();
            const finish = normalizeFinishType(row.finishType);
            const condition = normalizeCondition(row.condition);
            const purchase = normalizePrice(row.purchasePrice);
            const estimated = normalizePrice(row.estimatedValue);

            const fail = (message: string) =>
                rowErrors.push({ rowNumber: row.rowNumber, name: name || `Row ${row.rowNumber}`, message });

            if (!name) fail("Name is required — this row has no name.");
            if (finish === null)
                fail(`Finish Type must be OF, Custom, or Artist Resin — got '${row.finishType.trim()}'.`);
            if (condition === null)
                fail(`Condition must be one of ${CONDITION_GRADES.join(", ")} — got '${row.condition.trim()}'.`);
            if (!purchase.ok)
                fail(`Purchase Price must be a number — got '${row.purchasePrice.trim()}'.`);
            if (!estimated.ok)
                fail(`Estimated Value must be a number — got '${row.estimatedValue.trim()}'.`);

            if (!name || finish === null || condition === null || !purchase.ok || !estimated.ok) {
                continue;
            }

            payload.push({
                row_number: row.rowNumber,
                custom_name: name,
                finish_type: finish,
                condition_grade: condition,
                notes: sanitizeText(row.notes).trim() || null,
                purchase_price: purchase.value,
                estimated_value: estimated.value,
                catalog_id: row.catalogId,
            });
        }

        if (payload.length === 0) {
            return { success: true, imported: 0, rowErrors };
        }

        // ── Preferred path: v2 (migration 144). The cast is the house
        //    feature-detect idiom (see likes.ts): the RPC only reaches the
        //    generated types once 144 is applied + gen-types has run. ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await supabase.rpc("batch_import_horses_v2" as any, {
            rows: payload,
            p_is_public: publish,
        });

        if (!error) {
            const result = data as unknown as {
                inserted: number;
                errors: { row_number: number; name: string; message: string }[];
            };
            return {
                success: true,
                imported: result.inserted ?? 0,
                rowErrors: [
                    ...rowErrors,
                    ...(result.errors ?? []).map((e) => ({
                        rowNumber: e.row_number,
                        name: e.name,
                        message: e.message,
                    })),
                ].sort((a, b) => a.rowNumber - b.rowNumber),
            };
        }

        if (!isMissingFunctionError(error)) {
            return { success: false, error: error.message };
        }

        // ── Fallback: legacy RPC (pre-144). Old limitations apply:
        //    whole-batch transaction, no notes, always private. ──
        const legacyPayload = payload.map((row) => ({
            custom_name: row.custom_name,
            finish_type: row.finish_type,
            condition_grade: row.condition_grade,
            asset_category: "model",
            catalog_id: row.catalog_id,
            purchase_price: row.purchase_price,
            estimated_value: row.estimated_value,
        }));

        const { data: legacyData, error: legacyError } = await supabase.rpc("batch_import_horses", {
            p_user_id: user.id,
            p_horses: legacyPayload,
        });

        if (legacyError) {
            return { success: false, error: legacyError.message, usedFallback: true };
        }

        const legacyResult = legacyData as { success: boolean; imported: number };
        return {
            success: true,
            imported: legacyResult.imported ?? 0,
            rowErrors,
            usedFallback: true,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to import horses",
        };
    }
}

/**
 * The caller's existing (non-deleted) horse names — powers the client-side
 * "N rows match horses already in your stable" dedupe warning before import.
 */
export async function getExistingHorseNames(): Promise<string[]> {
    try {
        const { supabase, user } = await requireAuth();
        const { data } = await supabase
            .from("user_horses")
            .select("custom_name")
            .eq("owner_id", user.id)
            .is("deleted_at", null)
            .limit(5000);
        return ((data ?? []) as { custom_name: string | null }[])
            .map((r) => r.custom_name ?? "")
            .filter(Boolean);
    } catch {
        // Dedupe is a courtesy check — never block the import flow on it.
        return [];
    }
}
