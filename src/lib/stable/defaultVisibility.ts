/**
 * Where a member's new horses start: Public, Unlisted or Private.
 *
 * The one reader of the member's choice (Settings › Privacy & Defaults),
 * used by Add Horse, Quick Add and CSV import (MHH-005). Until migration
 * 234 is pasted the three-way column does not exist, so the older on/off
 * default_horse_public decides: off means Private.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type HorseVisibility = "public" | "unlisted" | "private";

export function isHorseVisibility(v: unknown): v is HorseVisibility {
    return v === "public" || v === "unlisted" || v === "private";
}

/** The older on/off setting, read as the three-way one. */
export function fromLegacyPublic(defaultHorsePublic: boolean | null | undefined): HorseVisibility {
    return defaultHorsePublic === false ? "private" : "public";
}

type Row = { default_horse_visibility?: unknown; default_horse_public?: boolean | null };

export async function readDefaultVisibility(supabase: unknown, userId: string): Promise<HorseVisibility> {
    // Untyped on purpose: the column enters the generated types after 234.
    const db = supabase as SupabaseClient;
    const { data, error } = await db
        .from("users")
        .select("default_horse_visibility, default_horse_public")
        .eq("id", userId)
        .maybeSingle();
    if (!error && data) {
        const row = data as Row;
        return isHorseVisibility(row.default_horse_visibility)
            ? row.default_horse_visibility
            : fromLegacyPublic(row.default_horse_public);
    }
    const { data: legacy } = await db.from("users").select("default_horse_public").eq("id", userId).maybeSingle();
    return fromLegacyPublic((legacy as Row | null)?.default_horse_public);
}

/** Is this error a missing default_horse_visibility column (234 not pasted)? */
export function isMissingVisibilityColumn(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    return (
        (error.code === "42703" || error.code === "PGRST204") && /default_horse_visibility/.test(error.message ?? "")
    );
}
