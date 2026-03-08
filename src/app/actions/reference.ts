"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Sanitize a search query for safe use in PostgREST .or() filters.
 * Strips characters that could inject filter operators.
 */
function sanitizeSearchQuery(raw: string): string {
    return raw.replace(/[,().%\\]/g, "").trim();
}

export async function getMoldDetailAction(id: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("reference_molds")
        .select("id, manufacturer, mold_name, scale, release_year_start")
        .eq("id", id)
        .single();
    return data;
}

export async function getResinDetailAction(id: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("artist_resins")
        .select("id, sculptor_alias, resin_name, scale, cast_medium")
        .eq("id", id)
        .single();
    return data;
}

export async function getReleasesForMoldAction(moldId: string) {
    const supabase = await createClient();
    const { data } = await supabase
        .from("reference_releases")
        .select(
            "id, mold_id, model_number, release_name, color_description, release_year_start, release_year_end"
        )
        .eq("mold_id", moldId)
        .order("release_year_start", { ascending: false });
    return data || [];
}

export async function searchReferencesAction(tab: "mold" | "resin", query: string) {
    const supabase = await createClient();
    const q = sanitizeSearchQuery(query);
    if (!q) return tab === "mold" ? { molds: [], releases: [] } : { resins: [] };

    if (tab === "mold") {
        const moldPromise = supabase
            .from("reference_molds")
            .select("id, manufacturer, mold_name, scale, release_year_start")
            .or(`mold_name.ilike.%${q}%,manufacturer.ilike.%${q}%`)
            .order("mold_name")
            .limit(20);

        const releasePromise = q
            ? supabase
                .from("reference_releases")
                .select(
                    `id, mold_id, release_name, model_number, color_description,
             release_year_start, release_year_end,
             reference_molds(mold_name, manufacturer)`
                )
                .or(`release_name.ilike.%${q}%,color_description.ilike.%${q}%,model_number.ilike.%${q}%`)
                .limit(20)
            : Promise.resolve({ data: [] });

        const [moldRes, releaseRes] = await Promise.all([moldPromise, releasePromise]);

        return {
            molds: moldRes.data || [],
            releases: releaseRes.data || []
        };
    } else {
        const { data } = await supabase
            .from("artist_resins")
            .select("id, sculptor_alias, resin_name, scale, cast_medium")
            .or(`resin_name.ilike.%${q}%,sculptor_alias.ilike.%${q}%`)
            .order("sculptor_alias")
            .limit(50);

        return { resins: data || [] };
    }
}
