/**
 * Digital Stable v2 — tokenized badge palettes.
 *
 * Replaces the 13 hardcoded light-only Tailwind palettes
 * (bg-amber-50/text-amber-700 etc.) with semantic token washes.
 * Every token here (--color-warning/info/success, --destructive,
 * --color-forest) is re-bound by the Lamplight night theme
 * (html[data-theme="night"] in globals.css), so the badges stay
 * legible in both modes — the status-chip pattern ShowEntryForm uses.
 *
 * NOTE: Show Ring v2 (ShowRingBrowser) imports finishBadgeClass from
 * here. Legacy ShowRingGrid.tsx still carries its old duplicate
 * light-only map — it is the NEXT_PUBLIC_SHOWRING_V2 flag-off path
 * and goes away with the legacy page.
 */

/** finish_type is a 3-value enum (OF | Custom | Artist Resin). */
export const FINISH_BADGE_CLASSES: Record<string, string> = {
    "OF": "border-warning/40 bg-warning/10 text-warning",
    "Custom": "border-info/40 bg-info/10 text-info",
    "Artist Resin": "border-destructive/40 bg-destructive/10 text-destructive",
    "default": "border-input bg-muted text-secondary-foreground",
};

export function finishBadgeClass(finishType: string): string {
    return FINISH_BADGE_CLASSES[finishType] ?? FINISH_BADGE_CLASSES.default;
}

/** Trade-status chips (ledger table / card meta rows). */
export const TRADE_BADGE_CLASSES: Record<string, string> = {
    "For Sale": "border-success/40 bg-success/10 text-success",
    "Open to Offers": "border-info/40 bg-info/10 text-info",
    "Stolen/Missing": "border-destructive/40 bg-destructive/10 text-destructive",
};

export function tradeBadgeClass(tradeStatus: string): string | null {
    return TRADE_BADGE_CLASSES[tradeStatus] ?? null;
}

/**
 * Rubber-stamp overlays on the card photo (mock: rotated "For Sale"
 * stamp). Card-wash background so they read on any photo, in any theme.
 */
export const TRADE_STAMP_CLASSES: Record<string, string> = {
    "For Sale": "border-destructive text-destructive",
    "Open to Offers": "border-info text-info",
    "Stolen/Missing": "border-destructive text-destructive",
};

export const TRADE_STAMP_LABELS: Record<string, string> = {
    "For Sale": "For Sale",
    "Open to Offers": "Offers",
    "Stolen/Missing": "Missing",
};

/** 🏆 show-record count chip — brass family (warning token). */
export const RIBBON_BADGE_CLASS = "border-warning bg-warning/10 text-warning";

export const CATEGORY_BADGE_ICONS: Record<string, string> = {
    tack: "🏇",
    prop: "🌲",
    diorama: "🎭",
    other_model: "🐄",
};
