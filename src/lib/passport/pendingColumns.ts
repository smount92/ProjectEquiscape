/**
 * Horse columns that ship in code before their migration is pasted.
 * The owner applies migrations by hand, so for a while the app runs
 * against a table that lacks them. Everything that reads or writes
 * these columns goes through here: a write retries without them, a
 * read comes back without them, and nothing else changes.
 *
 * Add a column here when it ships; remove it once the migration has
 * been in for a while and the paste is history.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { RESIN_COLUMNS } from "@/lib/passport/resinIdentity";

/** 217: the resin identity. 219: color / pattern for the show identity. */
export const PENDING_HORSE_COLUMNS = [...RESIN_COLUMNS, "color"] as const;

export const COLOR_MAX = 60;

type DbErr = { code?: string | null; message?: string | null } | null | undefined;

/** True when a save or read failed only because one of these columns is not in the database yet. */
export function isMissingPendingColumn(err: DbErr): boolean {
    if (!err) return false;
    const code = err.code ?? "";
    const message = err.message ?? "";
    if (code !== "42703" && code !== "PGRST204") return false;
    return PENDING_HORSE_COLUMNS.some((c) => message.includes(c));
}

/** Strip the pending columns from a row about to be written (pre-paste retry). */
export function withoutPendingColumns<T extends Record<string, unknown>>(row: T): T {
    const copy = { ...row };
    for (const c of PENDING_HORSE_COLUMNS) delete copy[c];
    return copy;
}

/** The pending columns for one horse; an empty object (never an error) when they are not there yet. */
export async function readPendingColumns(client: SupabaseClient, horseId: string): Promise<Record<string, unknown>> {
    try {
        const { data, error } = await client
            .from("user_horses")
            .select(PENDING_HORSE_COLUMNS.join(", "))
            .eq("id", horseId)
            .maybeSingle();
        if (error || !data) return {};
        return data as unknown as Record<string, unknown>;
    } catch {
        return {};
    }
}

/**
 * Run a select that names optional (pending) columns; if the database
 * does not have them yet, run it again without. `build` receives the
 * column list to select.
 */
export async function selectWithPending<T>(
    build: (columns: string) => PromiseLike<{ data: T | null; error: DbErr }>,
    base: string,
    pending: string,
): Promise<{ data: T | null; error: DbErr }> {
    const first = await build(`${base}, ${pending}`);
    if (first.error && isMissingPendingColumn(first.error)) return build(base);
    return first;
}

export function colorText(v: unknown): string | null {
    return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, COLOR_MAX) : null;
}
