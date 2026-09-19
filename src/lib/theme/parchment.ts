import type { CSSProperties } from "react";

/**
 * Fixed parchment-ink palette for the tan ledger card on the passport.
 *
 * The card background is a hardcoded tan (`#C8B596`), but the global theme
 * tokens flip to light text in dark mode — so `text-secondary-foreground` /
 * `text-muted-foreground` become cream (~1.1:1 on tan → invisible) and the
 * forest link lightens. Spreading this onto the card wrapper pins the
 * colour tokens to dark-ink-on-parchment values for the whole subtree, so
 * the card reads correctly in BOTH themes.
 *
 * Every ink here is >= 4.5:1 on #C8B596 (the tan is a mid ground, so the
 * daylight inks are not enough: secondary ink measured 4.25:1 and the
 * forest ink 4.2:1 before 2026-09-19). Surfaces (--color-*) stay at their
 * day values so badges routed through them keep their daylight look;
 * text utilities read the --ink-* tokens.
 */
export const PARCHMENT_INK = {
    // Restart inherited colour here: body resolved it to the night cream.
    color: "#2D2318",
    "--foreground": "#2D2318",
    "--secondary-foreground": "#4A3D2C",
    "--muted-foreground": "#4A3D2C",
    "--card": "#FEFCF8",
    "--card-foreground": "#2D2318",
    "--muted": "#EAE1CD",
    "--input": "#E0D5C1",
    "--color-forest": "#234838",
    "--color-success": "#356845",
    "--color-warning": "#946B08",
    "--color-info": "#2563EB",
    "--destructive": "#9B3028",
    "--link": "#1E3D31",
    "--link-hover": "#0F2A1E",
    "--ink-forest": "#1E3D31",
    "--ink-success": "#254A31",
    "--ink-warning": "#5C4304",
    "--ink-info": "#153F8C",
    "--ink-studio": "#4E3373",
    "--ink-destructive": "#7A241E",
    "--ink-brass": "#5C4304",
} as CSSProperties;
