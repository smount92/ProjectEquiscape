/**
 * Purchase notes (migration 241): where and from whom a horse was bought,
 * the receipt or listing link, anything the owner wants to remember.
 * Owner-only, like the rest of the Financial Vault.
 *
 * The column arrives with a hand-pasted migration, so every read and
 * write of it goes through here and tolerates its absence: a read comes
 * back without it, and a write is retried without it, keeping the other
 * vault fields. When that costs the member a note they typed, the caller
 * says so with PURCHASE_NOTES_PENDING_NOTICE. Same pattern as the set
 * columns (224) and the resin columns (217).
 */

export const PURCHASE_NOTES_COLUMN = "purchase_notes";

/** Matches the CHECK in 241. */
export const PURCHASE_NOTES_MAX = 2000;

/** Shown when a typed note could not be kept because 241 is not in yet. */
export const PURCHASE_NOTES_PENDING_NOTICE =
    "Your other vault details are saved. Purchase notes switch on soon, so this note wasn't kept yet. Please add it again in a few days.";

type DbErr = { code?: string | null; message?: string | null } | null | undefined;

/** True when a query failed only because 241 is not pasted yet. */
export function isMissingPurchaseNotes(err: DbErr): boolean {
    if (!err) return false;
    const code = err.code ?? "";
    if (code !== "42703" && code !== "PGRST204") return false;
    return (err.message ?? "").includes(PURCHASE_NOTES_COLUMN);
}

/** True when the value is a note worth keeping (not empty, not just spaces). */
export function hasPurchaseNote(value: unknown): value is string {
    return typeof value === "string" && value.trim() !== "";
}

/** The row without purchase_notes, for the pre-241 retry. */
export function withoutPurchaseNotes<T extends Record<string, unknown>>(row: T): T {
    const copy = { ...row };
    delete copy[PURCHASE_NOTES_COLUMN];
    return copy;
}

/**
 * Write a vault row (insert or update; the caller builds the query). If
 * the database does not have purchase_notes yet, write it again without
 * it. `notesDropped` is true only when that cost the member a real note.
 */
export async function writeVaultRow<T extends Record<string, unknown>>(
    write: (row: T) => PromiseLike<{ error: DbErr }>,
    row: T,
): Promise<{ error: DbErr; notesDropped: boolean }> {
    const first = await write(row);
    if (!first.error || !isMissingPurchaseNotes(first.error) || !(PURCHASE_NOTES_COLUMN in row)) {
        return { error: first.error ?? null, notesDropped: false };
    }
    const retry = await write(withoutPurchaseNotes(row));
    return {
        error: retry.error ?? null,
        notesDropped: !retry.error && hasPurchaseNote(row[PURCHASE_NOTES_COLUMN]),
    };
}

/**
 * Run a select that names purchase_notes; if the database does not have
 * it yet, run it again without. `build` receives the column list.
 */
export async function selectWithPurchaseNotes<T>(
    build: (columns: string) => PromiseLike<{ data: T | null; error: DbErr }>,
    base: string,
): Promise<{ data: T | null; error: DbErr }> {
    const first = await build(`${base}, ${PURCHASE_NOTES_COLUMN}`);
    if (first.error && isMissingPurchaseNotes(first.error)) return build(base);
    return first;
}
