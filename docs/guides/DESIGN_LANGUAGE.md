# Model Horse Hub — Design Language ("Leather Edition")

The authoritative reference for the site's visual language, shipped July
2026. Any new page, component, or agent MUST follow this. All class names
and token values below are real — verified against `src/app/globals.css`.

---

## 1. The Doctrine: "Leather at the landmarks, parchment for the work"

The hobby is tactile and nostalgic — real tack, wooden display shelves,
brass plaques, ribbon walls. The UI leans into that, but selectively:

- **Landmarks** (emotional, showcase, arrival moments) wear **leather,
  wood, and brass** textures: the page masthead/header, public profile,
  trophy case, show results/champions, the feed, the Hoofprint
  certificate. These say "this is somebody's stable."
- **Working surfaces** (things you read, tap, fill in) wear **calm
  parchment "ledger" paper** with **brass section headings** and a whisper
  of stitching: forms, tables, dashboards, settings, the classlist
  builder, the ring console's data. These stay legible and fast.

Never texture a whole data-dense page. Never leave a landmark flat. When
in doubt, a surface is "working" (parchment) unless it's an arrival/brag
moment.

**Everything is pure CSS** — gradients + two inline SVG `feTurbulence`
noise data-URIs (`--noise`, `--grain`). No image assets, no network
weight, works offline.

---

## 2. Tokens (defined in globals.css)

### Material color ramps (`globals.css:1936-1955`)
```
--leather-deep #3E2414   --leather #5C3A20   --leather-hi #7A4E2C
--wood-deep #2E1E12      --wood #4A3220
--brass-dark #7A5C22     --brass #B08D3E     --brass-hi #E8C878
--brass-ink #2A1D08      --thread #D9B978
```

### Text ON leather/wood (the day-mode trap — read this)
```
--leather-text #EFDDBB        (primary light ink for leather surfaces)
--leather-text-soft #D8BE92   (secondary)
--leather-text-muted #C9AE84  (tertiary / timestamps)
```
**CRITICAL:** never put default page ink on a leather/wood surface. In DAY
mode the foreground token is dark → invisible on leather. Text on any
leather surface uses `--leather-text*` (or the `.text-engraved-light`
class). This is the #1 recurring bug — the show masthead, feed, and
group headers each shipped it once and were fixed.

### "Lit paper" constants (never flip at night)
```
--paper-lit #FEFCF8   --paper-lit-ink #2D2318   --paper-lit-ink-soft #594A3C
```
Physical white objects (post frames, polaroids, brass plaques) stay cream
even in night mode — a photograph is white in a dark room. Use these for
surfaces that must not darken.

### Brand + semantic tokens (the shadcn base — used everywhere else)
`--background --foreground --card --card-foreground --popover --primary
(#2C5545 forest) --secondary --muted --muted-foreground --accent
--destructive --border --input --ring`, plus brand extensions
`--color-forest --color-forest-dark --color-saddle --color-success
--color-warning --color-info` and domain tokens `--color-tier-{gold,
silver,bronze,diamond} --color-border-tan`. These drive the Tailwind
utilities (`bg-card`, `text-foreground`, `border-input`, `text-forest`…).

---

## 3. The material classes (use these; don't hand-roll textures)

| Class | What it is | Where |
|---|---|---|
| `.leather-band` | Leather header band (the landmark header). Brass medallion + embossed title live inside. | page mastheads (stable, group, show ring, profile) |
| `.leather-panel` | Standalone leather block (radial-gradient + noise + inset shadows) | feed panel, activity rail |
| `.stitched` | Adds a dashed `--thread` inset border. Compose with `.leather-band`/`.leather-panel`. | any leather surface |
| `.strap-nav` | Green forest webbing nav strap w/ brass buckles | landing/nav |
| `.wood-panel`, `.shelfwrap`, `.shelfrow`, `.shelf-strip` | Wood-grain cabinet + shelves (trophy case, "Stars of the Stable"). `.shelf-strip` = horizontal scroll strip. | trophy case, profile showcase |
| `.polaroid` | Tilted cream photo card on a shelf | featured horses, profile |
| `.brass-plaque`, `.plaque` | Beveled brass plaque with engraved text + screws | trophy records, awards |
| `.brass-medallion` | Round brass avatar/logo disc | mastheads |
| `.brass-heading` + `.brass-heading-bar` | Brass bar + smallcaps serif title — the standard **working-surface** section header | every ledger page section |
| `.ledger-paper` / `.ledger-card` | Parchment working surface: red margin line + green 28px ruling + forest top border. (Currently equivalent; both exist so they can diverge.) | forms, tables, dashboards |
| `.ledger-tab` | Kraft/forest index tab label sitting on a ledger surface | section labels |
| `.ledger-tile` | Stat tile with double-forest left border | KPI/stat rows |
| `.stamp` / `.stamp-red` | Rubber-stamp status chip (rotated, noise-masked) | statuses, placings |
| `.stats-strap` | Green webbing stat bar with engraved brass numerals | profile stats |
| `.leather-frame` | 6px leather border via `::before`, cream `--paper-lit` face | feed post cards |
| `.workcard-stitched` | Parchment card with 1.5px dashed saddle inset (light stitch accent) | working cards |
| `.text-engraved-light` | Light-on-leather embossed text (drop+highlight shadow) | leather titles |
| `.btn-brass` | Brass button (primary CTA on leather) | Host a Show, Follow, etc. |
| `.btn-ghostleather` | Outline "ghost" button on leather (thread border, light text) | secondary leather actions |
| `.leather-icon-btn`, `.leather-nav-link`, `.leather-menu`, `.leather-footer` | Header/footer leather chrome pieces | Header.tsx, Footer.tsx |

### The masthead pattern (copy this for any new landmark header)
`ShowRingMasthead.tsx`, `StableMasthead.tsx`, `GroupMasthead.tsx` are the
three reference implementations. Shape: `.leather-band.stitched` → brass
medallion (inline radial-gradient) → `.text-engraved-light` serif title
(uppercase, `tracking-[0.12em]`) → `--leather-text-soft` subtitle →
`.btn-ghostleather` action on the right. To make it the page header,
`ExplorerLayout` accepts `noHeader` (suppresses the default brass heading
so the leather masthead stands alone).

---

## 4. The two escape hatches on ExplorerLayout

- `noHeader` — the page brings its own header (leather masthead inside
  children). Suppresses the default `.brass-heading`.
- `frameless` — the child brings its own material (e.g. the feed's leather
  panel); skips the `.ledger-paper` wrapper so it isn't double-framed.

---

## 5. Dark mode = "Lamplight" (`html[data-theme="night"]`)

Not an inversion — "the tack room by lamplight." Leather/wood/brass are
already night materials and barely change. Only the **ambient parchment**
darkens: warm espresso-brown grounds (never blue-gray), cream ink, dim
green ledger ruling, embered red margin. Cream objects (polaroids, post
frames, plaques via `--paper-lit`) stay lit.

Implementation: one `html[data-theme="night"]` block redefines the ~18
semantic tokens + ledger night variants (66 night rules in globals.css).
Because everything routes through tokens, **any surface using `bg-card`,
`text-foreground`, `.ledger-paper`, etc. flips automatically**. The toggle
is a brass disc in the Header (`ThemeToggle.tsx`), persisted to
`localStorage("mhh-theme")`, stamped pre-paint by an inline script in
`layout.tsx` (no flash).

## 6. Simple Mode (`[data-simple-mode="true"]`) — accessibility

Bumps font scale ~1.3×, enlarges touch targets, and **strips all textures
to flat high-contrast tokens** (65 simple-mode rules). Must always remain
usable — never encode meaning in texture alone.

---

## 7. Hard rules (these are how surfaces break — don't)

1. **Tokens only.** NO raw hex (`text-[#ef4444]`), NO `bg-white`, NO
   `bg-stone-*`/`bg-*-50`/`text-*-700` literals. Arbitrary hex is invisible
   to the night-mode override selectors → breaks Lamplight. Use
   `text-destructive`, `bg-card`, `bg-success/10`, `border-input`, etc.
2. **Text on leather/wood uses `--leather-text*`** (or
   `.text-engraved-light`). Dark ink on leather is invisible in day mode.
3. **Use the shared primitives**: `<Button>` (shadcn, tuned to the app's
   variants — default/outline/ghost/destructive/destructive-outline/link,
   sizes default/wide/sm/xs/icon*) and `<Select>` (defaults to
   `position="popper"` — anchored under the trigger). Don't hand-roll
   `<button>`.
4. **Both themes + Simple Mode must work.** If you add a new color, add its
   night override, or use an existing token that already has one.
5. **Materials are CSS-only.** Don't introduce image-asset textures.
6. Reference implementations to copy from, not reinvent: `page.tsx`
   (landing), `about/page.tsx`, the three `*Masthead.tsx`, `ShowStatusCard`,
   `GroupBoard`, `RingConsole`, `TrophyCase`, `StableFilterBar`. The
   prototypes in `design-prototypes/` show the original CSS techniques.

---

## 8. Known design debt (July 2026 — being cleaned up)

Older, pre-leather surfaces still carry violations: the **settings** page
(raw `#ef4444`, duplicate `<h1>`, ad-hoc cards, no `.ledger-card`), the
**admin** console (raw hex, no leather/ledger language at all — reads as
plain shadcn), and the **catalog-suggestion** surfaces (`bg-white`,
hardcoded hex). See the current work-orders doc for the cleanup batch.
