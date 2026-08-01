import type { CSSProperties } from "react";

/**
 * Fixed parchment-ink palette for the tan ledger card on the passport.
 *
 * The card background is a hardcoded tan (`#C8B596`), but the global theme
 * tokens flip to light text in dark mode — so `text-secondary-foreground` /
 * `text-muted-foreground` become cream (~1.1:1 on tan → invisible) and the
 * forest link lightens (`#3A6B55`, lower contrast). Spreading this onto the
 * card wrapper pins the color tokens to their day (dark-ink-on-parchment)
 * values for the whole subtree, so the card reads correctly in BOTH themes.
 */
export const PARCHMENT_INK = {
    "--foreground": "#2D2318",
    "--secondary-foreground": "#594A3C",
    "--muted-foreground": "#5A4A34",
    "--card": "#FEFCF8",
    "--muted": "#EAE1CD",
    "--input": "#E0D5C1",
    "--color-forest": "#234838",
    /* Status tokens pinned to their day (ink-on-parchment) values so
       badges routed through them (market value, condition tones, info
       notes) stay legible on the tan card in Lamplight — the night
       overrides lighten these for the dark ground, which would wash
       them out here. */
    "--color-success": "#356845",
    "--color-warning": "#B8860B",
    "--color-info": "#3b82f6",
    "--destructive": "#9B3028",
} as CSSProperties;
