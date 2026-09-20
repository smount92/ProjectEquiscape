/**
 * Artist-resin identity (migration 217): what a resin is made of, whether
 * it is hollow or solid, who cast it and who prepped it. Asked for by the
 * first professional artist on the site — a white urethane cast from MVS
 * and a print from a home printer are different objects, and the passport
 * should say which.
 *
 * Four nullable columns on user_horses. The owner pastes migrations by
 * hand, so every read and write here tolerates their absence: reads come
 * back empty, saves retry without them (see `isMissingResinColumn`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const RESIN_COLUMNS = ["resin_material", "resin_body", "cast_by", "prep_artist"] as const;
export type ResinColumn = (typeof RESIN_COLUMNS)[number];

export type ResinMaterial = "cast_resin" | "printed_resin" | "injection_molded";
export type ResinBody = "hollow" | "solid";

export const RESIN_MATERIAL_LABEL: Record<ResinMaterial, string> = {
    cast_resin: "Cast resin",
    printed_resin: "3D-printed resin",
    injection_molded: "Injection-molded resin",
};

export const RESIN_BODY_LABEL: Record<ResinBody, string> = {
    hollow: "Hollow",
    solid: "Solid",
};

export interface ResinIdentity {
    resinMaterial: ResinMaterial | null;
    resinBody: ResinBody | null;
    castBy: string | null;
    prepArtist: string | null;
}

export const EMPTY_RESIN_IDENTITY: ResinIdentity = {
    resinMaterial: null,
    resinBody: null,
    castBy: null,
    prepArtist: null,
};

function text(v: unknown): string | null {
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Map a raw row (any shape, any subset of the columns) to the identity. */
export function resinIdentityFrom(row: Record<string, unknown> | null | undefined): ResinIdentity {
    if (!row) return EMPTY_RESIN_IDENTITY;
    const material = text(row.resin_material);
    const body = text(row.resin_body);
    return {
        resinMaterial: material && material in RESIN_MATERIAL_LABEL ? (material as ResinMaterial) : null,
        resinBody: body && body in RESIN_BODY_LABEL ? (body as ResinBody) : null,
        castBy: text(row.cast_by),
        prepArtist: text(row.prep_artist),
    };
}

export function hasResinIdentity(r: ResinIdentity): boolean {
    return !!(r.resinMaterial || r.resinBody || r.castBy || r.prepArtist);
}

/** The material and body as one line: "Cast resin · hollow". */
export function resinMakeupLine(r: ResinIdentity): string | null {
    const material = r.resinMaterial ? RESIN_MATERIAL_LABEL[r.resinMaterial] : null;
    const body = r.resinBody ? RESIN_BODY_LABEL[r.resinBody] : null;
    if (material && body) return `${material} · ${body.toLowerCase()}`;
    return material ?? body;
}

/**
 * True when a save or read failed only because migration 217 is not in
 * the database yet (undefined column, or PostgREST's schema-cache miss).
 */
export function isMissingResinColumn(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
    if (!err) return false;
    const code = err.code ?? "";
    const message = err.message ?? "";
    if (code !== "42703" && code !== "PGRST204") return false;
    return RESIN_COLUMNS.some((c) => message.includes(c));
}

/** Strip the four columns from a row about to be written (pre-paste retry). */
export function withoutResinColumns<T extends Record<string, unknown>>(row: T): T {
    const copy = { ...row };
    for (const c of RESIN_COLUMNS) delete copy[c];
    return copy;
}

/** Read the identity for one horse; empty (never an error) when the columns are not there yet. */
export async function readResinIdentity(client: SupabaseClient, horseId: string): Promise<ResinIdentity> {
    try {
        const { data, error } = await client
            .from("user_horses")
            .select(RESIN_COLUMNS.join(", "))
            .eq("id", horseId)
            .maybeSingle();
        if (error) return EMPTY_RESIN_IDENTITY;
        return resinIdentityFrom(data as unknown as Record<string, unknown> | null);
    } catch {
        return EMPTY_RESIN_IDENTITY;
    }
}
