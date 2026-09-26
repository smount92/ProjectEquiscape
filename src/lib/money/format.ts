/**
 * Money in the member's own currency symbol.
 *
 * Every member has a preferred symbol (Settings → currency, migration
 * 074). Vault figures are whatever the member typed, in their own money:
 * we never convert, we only label. A euro member's purchase price of
 * 120 is €120, full stop. The Blue Book is the one exception — it is
 * built from recorded USD sales and always says so.
 *
 * Placement follows the symbol's own habit: "€120", "£120", "CHF 120",
 * "120 kr", "120 zł".
 */

const SUFFIX = new Set(["kr", "zł"]);
const SPACED_PREFIX = new Set(["CHF", "R$"]);

export const DEFAULT_CURRENCY_SYMBOL = "$";

export function formatMoney(
    value: number,
    symbol: string | null | undefined = DEFAULT_CURRENCY_SYMBOL,
    options: { decimals?: number } = {},
): string {
    const sym = (symbol ?? "").trim() || DEFAULT_CURRENCY_SYMBOL;
    const decimals = options.decimals ?? 0;
    const number = value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
    if (SUFFIX.has(sym)) return `${number} ${sym}`;
    if (SPACED_PREFIX.has(sym)) return `${sym} ${number}`;
    return `${sym}${number}`;
}

/** "Purchase Price (€)" — the symbol on a money field's label. */
export function moneyLabel(label: string, symbol: string | null | undefined): string {
    const sym = (symbol ?? "").trim() || DEFAULT_CURRENCY_SYMBOL;
    return `${label} (${sym})`;
}
