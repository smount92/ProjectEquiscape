/**
 * Set purchases (migration 224): several horses bought for one price.
 *
 * Every member of a set carries the SET price in purchase_price plus a
 * shared purchase_group_id. What a member is "worth" for totals is its
 * equal share of that price, so a $120 family of three adds $120 to the
 * vault, not $360 — unless the owner has set an estimated current value,
 * which is always per horse and wins as before.
 *
 * The columns arrive with a hand-pasted migration, so reads and writes
 * here tolerate their absence (isMissingSetColumn), the same way the
 * resin and colour columns did.
 */

export const SET_COLUMNS = ["purchase_group_id", "purchase_group_label"] as const;
export const SET_LABEL_MAX = 80;
export const SET_MAX_MEMBERS = 50;

export interface SetPurchase {
    groupId: string;
    label: string | null;
    /** The price paid for the whole set. */
    price: number;
    members: { id: string; name: string }[];
}

type DbErr = { code?: string | null; message?: string | null } | null | undefined;

/** True when a query failed only because 224 is not pasted yet. */
export function isMissingSetColumn(err: DbErr): boolean {
    if (!err) return false;
    const code = err.code ?? "";
    const message = err.message ?? "";
    if (code !== "42703" && code !== "PGRST204") return false;
    return SET_COLUMNS.some((c) => message.includes(c));
}

export const SET_MIGRATION_NOTICE = "Linking a set needs migration 224 in the database first.";

/** Each member's equal share of the set price, to the cent. */
export function shareOf(setPrice: number, members: number): number {
    if (!(members > 0)) return setPrice;
    return Math.round((setPrice / members) * 100) / 100;
}

/**
 * What one horse contributes to a vault total: its own estimated value
 * if set; otherwise its purchase price — the whole price for a solo
 * purchase, an equal share for a set member.
 */
export function vaultValueOf(
    row: { purchase_price: number | null; estimated_current_value: number | null; purchase_group_id?: string | null },
    groupSize: number,
): number | null {
    if (row.estimated_current_value != null) return Number(row.estimated_current_value);
    if (row.purchase_price == null) return null;
    const price = Number(row.purchase_price);
    return row.purchase_group_id ? shareOf(price, groupSize) : price;
}

/** Group sizes from the vault rows in hand (owner-scoped queries only). */
export function groupSizes(rows: { purchase_group_id?: string | null }[]): Map<string, number> {
    const sizes = new Map<string, number>();
    for (const r of rows) {
        if (!r.purchase_group_id) continue;
        sizes.set(r.purchase_group_id, (sizes.get(r.purchase_group_id) ?? 0) + 1);
    }
    return sizes;
}

/** "your share of a $120.00 set of 3" — the passport's and report's one-line gloss. */
export function setGloss(price: string, members: number): string {
    return `share of a ${price} set of ${members}`;
}
