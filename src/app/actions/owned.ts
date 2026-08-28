"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Which of these catalog entries does the signed-in member own?
 *
 * Called client-side from reference pages, which render static/anon on
 * purpose (their SSG+ISR path must stay cookie-free) — ownership is a
 * personal layer painted on after the fact. Anonymous callers get an
 * empty list, never an error: the page is complete without it.
 */
export async function getOwnedCatalogIds(catalogIds: string[]): Promise<string[]> {
    if (!Array.isArray(catalogIds) || catalogIds.length === 0) return [];
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return [];

        const owned = new Set<string>();
        // Chunked .in(): a big mold's id list would blow the URL limit
        // (the priced-filter lesson).
        for (let i = 0; i < catalogIds.length; i += 200) {
            const chunk = catalogIds.slice(i, i + 200).filter((id) => typeof id === "string");
            const { data } = await supabase
                .from("user_horses")
                .select("catalog_id")
                .eq("owner_id", user.id)
                .is("deleted_at", null)
                .in("catalog_id", chunk);
            for (const row of (data ?? []) as { catalog_id: string | null }[]) {
                if (row.catalog_id) owned.add(row.catalog_id);
            }
        }
        return [...owned];
    } catch {
        return [];
    }
}
