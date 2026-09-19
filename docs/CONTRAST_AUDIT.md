# Contrast audit

Text that reads fine in daylight and vanishes under Lamplight kept
slipping through. This is the check that stops it. Three layers, cheapest
first; the first two run in the pre-commit test hook, the third is a
command you run before a push that touched colour or a page.

## 1. Token pairs — `src/__tests__/theme-contrast.test.ts`

Reads `globals.css`, resolves the palette for day, night, Simple Mode
and the night "lit paper" re-bind, and checks every ink against every
ground it is read on (foreground on card, secondary ink on muted, the
`--ink-*` colours on card and muted, leather text on leather, and so on).
Anything under 4.5:1 fails with the whole pair table printed.

The rule it protects: **surface colours and ink colours are different
tokens.** `--color-forest` is a surface (buttons, chips, borders).
`--ink-forest` is what `text-forest` renders, and it is a different
green at night (`#8FC7A5`) because the surface green is 2.6:1 on the
night card. Same for success, warning, info, studio, destructive.

## 2. Hardcoded palette ratchet — `src/__tests__/hardcoded-colors.test.ts`

Counts `text-gray-500`, `bg-white`, `text-amber-800` and friends across
`src/**/*.tsx`. Those classes ignore the theme. The count may go down
freely; going up fails the test until you either use a token or raise
the baseline in the test file on purpose, in the same commit, with a
reason. The top offenders are printed so a conversion pass knows where
to start.

## 3. Runtime walk — `npm run test:contrast`

`e2e/contrast.spec.ts` opens every anonymous route, logs in as the test
bot and opens the signed-in ones (dashboard, stable, settings, inbox,
the bot's first horse: stable page, edit page, public passport) and
`/dev/contrast-fixtures`, a page that renders every chip and form
variant of the passport with made-up data so rare states (a NAN-qualified,
host-verified, scored record; a private accomplishment; an attached
paper) are measured on every run. Each page is measured in day, night
and Simple Mode.

The walker (`scripts/contrast/walker.js`) visits every visible text node
and every placeholder, composites translucent layers to find the real
ground, knows the flat base colour under the leather / wood / brass
grain, and applies WCAG AA: 4.5:1, or 3:1 for large text. Disabled
controls are exempt. Text on a photo or an unknown gradient is reported
as *unverifiable* with an estimate and never fails the run by itself.

```bash
npm run test:contrast
```

builds and serves the app on :3000 (fixtures switched on for that local
build). Against a dev server you already have running:

```bash
E2E_BASE_URL=http://localhost:3939 npm run test:contrast
```

Report only, never fail:

```bash
CONTRAST_REPORT_ONLY=1 npm run test:contrast
```

Output: `test-results/contrast/report.md` (grouped by theme, with ratio,
ink, ground, the text, where it sits, and the route) and `report.json`.

### The baseline

`e2e/contrast.baseline.json` lists failures the audit tolerates, one
signature per line (`theme|route|kind|path|ink|ground`). The test fails
on anything **not** in the list, so new unreadable text cannot ship. When
a listed failure is fixed the report says so under "Fixed — remove from
baseline"; remove the line. Adding a line is a decision to ship
unreadable text and should say why in the commit.

## On any real page, right now

The walker also runs by hand: open the page (logged in, real data, the
theme you are looking at), open the browser console, paste the whole of
`scripts/contrast/walker.js`, then:

```js
__mhhContrast({ highlight: true })
```

Every failing piece of text gets a red outline with the ratio in its
tooltip, and the console prints a table. That is the fastest way to turn
"this looks light" into a file and a line.

## Fixing what it finds

- Muted text on a muted ground: use `text-secondary-foreground`, not
  `text-muted-foreground`, or put it on the card.
- A brand colour as text: `text-forest`, `text-warning` etc. already go
  through the inks; a hardcoded `text-amber-800`, an arbitrary value
  like `text-[var(--primary)]`, an opacity variant like
  `text-warning/90`, or an inline `style={{ color }}` does not. Switch
  it to the plain utility.
- White text on a brand surface (`bg-warning text-primary-foreground`)
  is safe: every `--color-*` surface is checked against white in every
  theme. Do not put a *ground* token on text (`text-background` on a
  purple button read 2.7:1 at night).
- Cream paper that stays cream at night (`.lit-paper`, `.polaroid`, the
  passport's tan card with `PARCHMENT_INK`): the block in `globals.css`
  re-binds the inks to daylight **and restarts the inherited colour** —
  `body` resolves `color: var(--foreground)` once, to the night cream,
  and children inherit that resolved colour, so re-binding the variable
  alone never reaches text without its own colour utility. Put the
  class on the paper, not on the text. A cream field inside a dark card
  (the feed composer) needs the class on the field.
- Placeholders are text: `input::placeholder, textarea::placeholder`
  is muted ink at full opacity site-wide. Do not re-add
  `placeholder:text-…/60`.
- Text on leather: use `--leather-text` / `-soft` / `-muted`, which are
  checked against `--leather` and `--leather-deep`. In Simple Mode every
  leather surface is flat forest and those three tokens go brighter.
- A dark strip in every theme (the cookie banner): use the leather ramp
  as ink, not the page tokens.

## What the walker knows

- Chromium reports colour-mixed values (`bg-black/70`, `text-white/80`)
  as `oklab(…)` or `color(srgb …)`; the walker converts those itself,
  so translucent overlays and scrims are measured, not skipped.
- A ground painted as a plain gradient between opaque stops (the ledger
  paper, the night page wash) is measured against its **worst** stop.
  Leather, wood and brass are measured against their flat base token
  under the grain. Only photos, noise textures and translucent scrims
  are left as unverifiable.
- Visually hidden text (`sr-only`, a 1 px clipped box) is not measured,
  nor is the body of a closed `<details>` (Chromium also skips its style
  recalculation, so its colours read stale), nor a one- or two-character
  glyph inside `aria-hidden="true"` (an icon), nor text that is only
  emoji (emoji carry their own colours).
- A page that navigates during measurement is retried once, then
  reported as "could not measure" and fails the run — a route that
  redirects on load does not belong in the route list.
- `/stable` has no index page and the signed-in 404 page never goes
  network-idle; idle waits are capped at 8 s for that reason.
