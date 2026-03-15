"use server";

import { createClient } from "@/lib/supabase/server";
import type { ReferenceMatch } from "@/lib/types/csv-import";
import { sanitizeText } from "@/lib/utils/validation";

// ============================================================
// CSV Import — Server Action (matching is now client-side)
// ============================================================

// ============================================================
// executeBatchImport — Insert confirmed matches via RPC transaction
// ============================================================

interface ImportRow {
    customName: string;
    condition: string;
    finishType: string;
    purchasePrice: string;
    estimatedValue: string;
    notes: string;
    selectedMatch: ReferenceMatch | null;
}

export async function executeBatchImport(
    confirmedRows: ImportRow[]
): Promise<{ success: boolean; imported?: number; error?: string }> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Build the JSONB payload for the RPC function
        const horsesPayload = confirmedRows.map((row) => {
            const horse: Record<string, string | null> = {
                custom_name: sanitizeText(row.customName) || "Unnamed Import",
                finish_type: row.finishType || "OF",
                condition_grade: row.condition || "Not Graded",
                asset_category: "model",
                catalog_id: null,
                purchase_price: row.purchasePrice || null,
                estimated_value: row.estimatedValue || null,
            };

            if (row.selectedMatch) {
                horse.catalog_id = row.selectedMatch.id;
            }

            return horse;
        });

        const { data, error } = await supabase.rpc("batch_import_horses", {
            p_user_id: user.id,
            p_horses: horsesPayload,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        const result = data as { success: boolean; imported: number };
        return { success: true, imported: result.imported };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to import horses",
        };
    }
}
