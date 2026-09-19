/**
 * Theme token contrast — the static half of the contrast audit.
 *
 * Reads src/app/globals.css, resolves the token palette for each theme
 * (day, night, Simple Mode, and the "lit paper" re-bind inside night)
 * and checks every ink/ground pairing the components actually use
 * against WCAG AA (4.5:1). A token that drifts below the line fails
 * here before anyone opens a browser. The runtime half — every piece of
 * text on real pages — is e2e/contrast.spec.ts (npm run test:contrast).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8")
    .replace(/\r\n/g, "\n")
    // comments out first: a comment before a selector would otherwise become part of it
    .replace(/\/\*[\s\S]*?\*\//g, "");

type Palette = Record<string, string>;

/**
 * Every `--name: value;` inside every innermost block whose selector
 * matches. The selector is whatever sits between the previous `}` / `;`
 * / `{` and this block's `{`, so blocks nested in @layer / @media parse
 * as their own selector.
 */
function tokensFor(selector: RegExp): Palette {
    const out: Palette = {};
    const re = /([^{};]*?)\s*\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css))) {
        const sel = m[1].trim();
        if (!selector.test(sel)) continue;
        const body = m[2];
        for (const line of body.split(";")) {
            const d = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*(.+)$/i);
            if (d) out[d[1]] = d[2].trim();
        }
    }
    return out;
}

const root = tokensFor(/^:root$/);
const night = tokensFor(/^html\[data-theme="night"\]$/);
const simple = tokensFor(/^\[data-simple-mode="true"\]$/);
const litPaper = tokensFor(/^html\[data-theme="night"\] \.polaroid,\s*html\[data-theme="night"\] \.lit-paper$/);

const THEMES: Record<string, Palette> = {
    day: { ...root },
    night: { ...root, ...night },
    simple: { ...root, ...simple },
    "night lit-paper": { ...root, ...night, ...litPaper },
};

type RGB = { r: number; g: number; b: number; a: number };

function parse(raw: string, palette: Palette, depth = 0): RGB | null {
    const v = raw.trim();
    const ref = v.match(/^var\((--[a-z0-9-]+)(?:,\s*(.+))?\)$/i);
    if (ref) {
        if (depth > 5) return null;
        const inner = palette[ref[1]];
        return inner ? parse(inner, palette, depth + 1) : ref[2] ? parse(ref[2], palette, depth + 1) : null;
    }
    const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    }
    const rgb = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i);
    if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] === undefined ? 1 : +rgb[4] };
    return null;
}

function luminance(c: RGB): number {
    const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

export function contrast(fg: RGB, bg: RGB): number {
    const over = fg.a < 1 ? { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 } : fg;
    const l1 = luminance(over);
    const l2 = luminance(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Ink → the grounds it is read on. Missing tokens in a theme are
 * skipped (Simple Mode does not define the material ramps, say).
 */
const PAIRS: [ink: string, grounds: string[]][] = [
    ["--foreground", ["--background", "--card", "--muted", "--secondary", "--popover", "--accent"]],
    ["--card-foreground", ["--card"]],
    ["--popover-foreground", ["--popover"]],
    ["--secondary-foreground", ["--background", "--card", "--muted", "--secondary"]],
    ["--muted-foreground", ["--background", "--card", "--muted"]],
    ["--accent-foreground", ["--accent"]],
    // Surfaces are white-safe: `bg-X text-white` must read on every one of them.
    ["--primary-foreground", ["--primary", "--color-forest", "--color-success", "--color-warning", "--color-info", "--color-studio", "--destructive"]],
    ["--ink-forest", ["--background", "--card", "--muted"]],
    ["--ink-success", ["--background", "--card", "--muted"]],
    ["--ink-warning", ["--background", "--card", "--muted"]],
    ["--ink-info", ["--background", "--card", "--muted"]],
    ["--ink-studio", ["--background", "--card", "--muted"]],
    ["--ink-destructive", ["--background", "--card", "--muted"]],
    ["--ink-brass", ["--background", "--card", "--muted"]],
    ["--link", ["--background", "--card"]],
    ["--leather-text", ["--leather", "--leather-deep"]],
    ["--leather-text-soft", ["--leather", "--leather-deep"]],
    ["--leather-text-muted", ["--leather", "--leather-deep"]],
    ["--brass-ink", ["--brass"]],
    ["--paper-lit-ink", ["--paper-lit"]],
    ["--paper-lit-ink-soft", ["--paper-lit"]],
];

const AA = 4.5;

describe("theme token contrast (globals.css)", () => {
    it("parsed every theme block", () => {
        expect(Object.keys(root).length).toBeGreaterThan(20);
        expect(night["--card"]).toBeDefined();
        expect(simple["--foreground"]).toBeDefined();
        expect(litPaper["--foreground"]).toBeDefined();
    });

    for (const [theme, palette] of Object.entries(THEMES)) {
        it(`${theme}: every ink reads at >= ${AA}:1 on its grounds`, () => {
            const failures: string[] = [];
            const table: string[] = [];
            for (const [ink, grounds] of PAIRS) {
                const fg = palette[ink] ? parse(palette[ink], palette) : null;
                if (!fg) continue;
                for (const ground of grounds) {
                    const bg = palette[ground] ? parse(palette[ground], palette) : null;
                    if (!bg || bg.a < 1) continue;
                    const r = contrast(fg, bg);
                    table.push(`${r.toFixed(2).padStart(5)}  ${ink} on ${ground}`);
                    if (r < AA) failures.push(`${ink} on ${ground}: ${r.toFixed(2)}:1 (${palette[ink]} on ${palette[ground]})`);
                }
            }
            expect(table.length, "no pairs measured — did the token names move?").toBeGreaterThan(10);
            expect(failures, `Below AA in ${theme}:\n  ${failures.join("\n  ")}\n\nAll pairs:\n  ${table.join("\n  ")}`).toEqual([]);
        });
    }
});
