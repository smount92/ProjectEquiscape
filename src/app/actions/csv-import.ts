"use server";

import { createClient } from "@/lib/supabase/server";
import type { MatchResult, ReferenceMatch } from "@/lib/types/csv-import";
import fuzzysort from "fuzzysort";

// ============================================================
// matchCsvBatch — Fuzzy-match mapped CSV rows against the reference DB
// ============================================================

interface MappedRow {
    name: string;
    mold: string;
    manufacturer: string;
    condition: string;
    finish_type: string;
    purchase_price: string;
    estimated_value: string;
    notes: string;
}

interface RefRelease {
    id: string;
    release_name: string;
    model_number: string | null;
    color_description: string | null;
    release_year_start: number | null;
    release_year_end: number | null;
    reference_molds: {
        mold_name: string;
        manufacturer: string;
        scale: string;
    } | null;
}

interface RefResin {
    id: string;
    resin_name: string;
    sculptor_alias: string;
    scale: string | null;
}

export async function matchCsvBatch(
    rows: MappedRow[]
): Promise<{ success: boolean; results?: MatchResult[]; error?: string }> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated." };

        // Fetch all reference releases with joined mold data
        const { data: rawReleases } = await supabase
            .from("reference_releases")
            .select(
                `id, release_name, model_number, color_description, 
         release_year_start, release_year_end,
         reference_molds(mold_name, manufacturer, scale)`
            )
            .limit(10000);

        const releases = (rawReleases as unknown as RefRelease[]) ?? [];

        // Fetch all artist resins
        const { data: rawResins } = await supabase
            .from("artist_resins")
            .select("id, resin_name, sculptor_alias, scale")
            .limit(5000);

        const resins = (rawResins as unknown as RefResin[]) ?? [];

        // Build search targets for fuzzysort
        const releaseTargets = releases.map((r) => {
            const mold = r.reference_molds;
            const display = [
                mold?.manufacturer,
                r.model_number ? `#${r.model_number}` : null,
                "—",
                r.release_name,
                mold?.mold_name,
                r.release_year_start
                    ? `(${r.release_year_start}${r.release_year_end ? `-${r.release_year_end}` : ""})`
                    : null,
            ]
                .filter(Boolean)
                .join(" ");

            // Combine searchable text: release name + mold name + color + model number
            const searchText = [
                r.release_name,
                mold?.mold_name,
                r.color_description,
                r.model_number,
                mold?.manufacturer,
            ]
                .filter(Boolean)
                .join(" ");

            return {
                id: r.id,
                display,
                searchText,
                manufacturer: mold?.manufacturer ?? "Unknown",
                mold_name: mold?.mold_name ?? "Unknown",
                release_name: r.release_name,
                prepared: fuzzysort.prepare(searchText),
            };
        });

        const resinTargets = resins.map((r) => {
            const display = `${r.sculptor_alias} — ${r.resin_name}${r.scale ? ` (${r.scale})` : ""}`;
            const searchText = `${r.resin_name} ${r.sculptor_alias}`;

            return {
                id: r.id,
                display,
                searchText,
                sculptor_alias: r.sculptor_alias,
                resin_name: r.resin_name,
                prepared: fuzzysort.prepare(searchText),
            };
        });

        // Process each row
        const results: MatchResult[] = rows.map((row, index) => {
            const searchQuery = [row.name, row.mold, row.manufacturer]
                .filter(Boolean)
                .join(" ")
                .trim();

            if (!searchQuery) {
                return {
                    csvRow: row as unknown as Record<string, string>,
                    rowIndex: index,
                    status: "no_match" as const,
                    matches: [],
                    selectedMatch: null,
                    customName: row.name || `Import Row ${index + 1}`,
                };
            }

            // Search releases
            const releaseResults = fuzzysort.go(searchQuery, releaseTargets, {
                key: "searchText",
                limit: 3,
                threshold: -2000,
            });

            // Search resins
            const resinResults = fuzzysort.go(searchQuery, resinTargets, {
                key: "searchText",
                limit: 3,
                threshold: -2000,
            });

            // Combine and sort all matches
            const allMatches: ReferenceMatch[] = [];

            for (const result of releaseResults) {
                allMatches.push({
                    id: result.obj.id,
                    score: result.score,
                    display: result.obj.display,
                    manufacturer: result.obj.manufacturer,
                    mold_name: result.obj.mold_name,
                    release_name: result.obj.release_name,
                    table: "reference_releases",
                });
            }

            for (const result of resinResults) {
                allMatches.push({
                    id: result.obj.id,
                    score: result.score,
                    display: result.obj.display,
                    manufacturer: result.obj.sculptor_alias,
                    mold_name: result.obj.resin_name,
                    release_name: result.obj.resin_name,
                    table: "artist_resins",
                });
            }

            // Sort by score descending (higher = better match)
            allMatches.sort((a, b) => b.score - a.score);
            const topMatches = allMatches.slice(0, 3);
            const bestScore = topMatches[0]?.score ?? -Infinity;

            // Determine status
            let status: "perfect" | "review" | "no_match";
            if (bestScore >= -50) {
                status = "perfect";
            } else if (bestScore >= -200) {
                status = "review";
            } else if (topMatches.length > 0) {
                status = "review";
            } else {
                status = "no_match";
            }

            return {
                csvRow: row as unknown as Record<string, string>,
                rowIndex: index,
                status,
                matches: topMatches,
                selectedMatch: status === "perfect" ? topMatches[0] : null,
                customName: row.name || `Import Row ${index + 1}`,
            };
        });

        return { success: true, results };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to match CSV rows",
        };
    }
}

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
                custom_name: row.customName || "Unnamed Import",
                finish_type: row.finishType || "OF",
                condition_grade: row.condition || "Not Graded",
                reference_mold_id: null,
                artist_resin_id: null,
                release_id: null,
                purchase_price: row.purchasePrice || null,
                estimated_value: row.estimatedValue || null,
            };

            if (row.selectedMatch) {
                if (row.selectedMatch.table === "reference_releases") {
                    horse.release_id = row.selectedMatch.id;
                } else if (row.selectedMatch.table === "artist_resins") {
                    horse.artist_resin_id = row.selectedMatch.id;
                }
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
