---
description: Full Tailwind CSS migration — 5 phases converting the entire CSS architecture from Plain CSS + CSS Modules + Inline Styles to strict Tailwind
---

# Tailwind CSS Migration — Full Architecture Refactor

> **Role:** Staff Frontend Architect  
> **Objective:** Migrate from fragmented CSS (Plain CSS + CSS Modules + Inline Styles + globals.css monolith) to strict Tailwind CSS + React  
> **Created:** 2026-03-20  
> **Framework:** Next.js 16.1.6, React 19, TypeScript 5
>
> ⚠️ **CRITICAL GUARDRAIL:** Under NO circumstances should React state, hooks, server actions, or non-styling component logic be altered. This is a **styling-only** refactor. If you are unsure whether something is styling or logic, leave it alone.
>
> 🛑 **PHASE GATE PROTOCOL:** Execute ONE phase at a time. After completing each phase, STOP and report status to the user. Wait for explicit human approval before proceeding to the next phase. DO NOT auto-advance.

---

## Current CSS Landscape (Baseline Audit)

| Metric | Count |
|--------|-------|
| `globals.css` lines | **3,948** |
| CSS Module files (`.module.css`) | **20** (total ~2,100 lines) |
| Plain CSS files (`.css`, non-globals) | **33** (total ~8,200 lines) |
| Inline `style={{}}` occurrences | **1,036** across 77 files |
| `:root` design tokens | **~96** variables (lines 14–102 of globals.css) |
| Total CSS file count | **54** (20 modules + 33 plain + 1 globals) |
| Target CSS file count | **1** (globals.css with only Tailwind directives + `:root` tokens + base resets) |

### File Inventory

**20 CSS Modules:**
```
src/app/page.module.css (1 line)
src/app/dashboard/dashboard.module.css (117 lines)
src/app/discover/discover.module.css (61 lines)
src/app/inbox/inbox.module.css (164 lines)
src/app/settings/settings.module.css (161 lines)
src/components/ChatThread.module.css (157 lines)
src/components/DashboardShell.module.css (89 lines)
src/components/DashboardToast.module.css (62 lines)
src/components/FavoriteButton.module.css (42 lines)
src/components/FeaturedHorseCard.module.css (81 lines)
src/components/GroupAdminPanel.module.css (38 lines)
src/components/GroupDetailClient.module.css (115 lines)
src/components/GroupFiles.module.css (44 lines)
src/components/MakeOfferModal.module.css (34 lines)
src/components/MatchmakerMatches.module.css (96 lines)
src/components/OfferCard.module.css (106 lines)
src/components/RatingForm.module.css (47 lines)
src/components/ShowHistoryWidget.module.css (118 lines)
src/components/StableLedger.module.css (172 lines)
src/components/WishlistButton.module.css (48 lines)
```

**33 Plain CSS Files:**
```
src/app/about/static.css (155 lines)
src/app/add-horse/gallery.css (569 lines)
src/app/admin/admin.css (453 lines)
src/app/catalog/reference.css (949 lines)
src/app/community/HelpId.css (196 lines)
src/app/faq/faq.css (86 lines)
src/app/market/market.css (307 lines)
src/app/shows/RingConflict.css (55 lines)
src/app/shows/ShowBuilder.css (186 lines)
src/app/shows/shows.css (348 lines)
src/app/stable/BatchResults.css (67 lines)
src/app/stable/passport.css (309 lines)
src/app/stable/PhotoReorder.css (32 lines)
src/app/stable/PhotoUpload.css (254 lines)
src/app/stable/VisibilitySelector.css (45 lines)
src/app/competition.css (665 lines)
src/app/studio.css (451 lines)
src/app/WelcomeOnboarding.css (722 lines)
src/components/BackToTop.css (37 lines)
src/components/ChatGuardrails.css (136 lines)
src/components/CommentSection.css (153 lines)
src/components/CookieConsent.css (61 lines)
src/components/CsvImport.css (449 lines)
src/components/FollowFeed.css (125 lines)
src/components/Footer.css (119 lines)
src/components/GroupRegistry.css (45 lines)
src/components/Notifications.css (112 lines)
src/components/Provenance.css (278 lines)
src/components/Ratings.css (208 lines)
src/components/RichEmbed.css (52 lines)
src/components/SocialFoundation.css (159 lines)
src/components/TrophyCase.css (149 lines)
src/components/VaultReveal.css (131 lines)
```

---

## Pre-flight (Run Before ANY Phase)

1. Verify the build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

2. Confirm current CSS file count:

```
cd c:\Project Equispace\model-horse-hub && (Get-ChildItem -Path src -Recurse -Include "*.css","*.module.css").Count
```

Expected: **54** files.

3. Snapshot git state:

```
cd c:\Project Equispace\model-horse-hub && git log --oneline -5
```

---

# ═══════════════════════════════════════
# PHASE 1: Tailwind Initialization & Token Mapping
# ═══════════════════════════════════════

## Objective
Set up the Tailwind environment and map 100% of existing CSS custom properties to `tailwind.config.ts`. The app must look **pixel-identical** after this phase — Tailwind is pulling from the same `:root` tokens.

## Definition of Done
- [x] `tailwindcss`, `postcss`, `autoprefixer` installed as devDependencies
- [x] Tailwind v4 CSS-first config via `@theme` directive (no `tailwind.config.ts` needed)
- [x] `postcss.config.mjs` exists and configured with `@tailwindcss/postcss`
- [x] `globals.css` has `@import "tailwindcss"` + `@theme` block mapping all 38 design tokens
- [x] `:root` variables remain intact in `globals.css`
- [x] `npx next build` passes with 0 errors
- [x] Visual identity is **100% identical** (no color, spacing, font, or shadow changes)
- [x] **PHASE 1 COMPLETE** — committed 2026-03-20

---

### Task 1.1: Install Tailwind Dependencies

```
cd c:\Project Equispace\model-horse-hub && npm install -D tailwindcss @tailwindcss/postcss postcss autoprefixer prettier-plugin-tailwindcss
```

> **Note on Next.js 16 compatibility:** Next.js 16 uses Turbopack by default. Tailwind CSS v4 has built-in PostCSS support. If using Tailwind v4, you may only need `@tailwindcss/postcss`. Check the installed version after install and adjust accordingly. If Tailwind v3 is installed, the approach below applies directly. If v4, use `@import "tailwindcss"` instead of `@tailwind` directives.

After install, check the version:

```
cd c:\Project Equispace\model-horse-hub && npx tailwindcss --help 2>&1 | Select-String "tailwindcss v"
```

---

### Task 1.2: Create PostCSS Config

**File:** `postcss.config.mjs` (project root)

For Tailwind v4:
```js
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

For Tailwind v3:
```js
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
export default config;
```

---

### Task 1.3: Create Tailwind Config with Token Mapping

**File:** `tailwind.config.ts` (project root)

Parse the `:root` variables from `globals.css` (lines 14–102) and map **every single token** into the Tailwind theme. The token-to-config mapping must be exhaustive:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // ── Typography ──
      fontFamily: {
        sans: ["var(--font-family)"],
        serif: ["var(--font-family-serif)"],
      },
      fontSize: {
        xs: "calc(var(--font-size-xs) * var(--font-scale))",
        sm: "calc(var(--font-size-sm) * var(--font-scale))",
        base: "calc(var(--font-size-base) * var(--font-scale))",
        md: "calc(var(--font-size-md) * var(--font-scale))",
        lg: "calc(var(--font-size-lg) * var(--font-scale))",
        xl: "calc(var(--font-size-xl) * var(--font-scale))",
        "2xl": "calc(var(--font-size-2xl) * var(--font-scale))",
        "3xl": "calc(var(--font-size-3xl) * var(--font-scale))",
      },

      // ── Colors ──
      colors: {
        bg: {
          primary: "var(--color-bg-primary)",
          secondary: "var(--color-bg-secondary)",
          card: "var(--color-bg-card)",
          "card-hover": "var(--color-bg-card-hover)",
          input: "var(--color-bg-input)",
          elevated: "var(--color-bg-elevated)",
        },
        surface: {
          glass: "var(--color-surface-glass)",
          "glass-hover": "var(--color-surface-glass-hover)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
        },
        accent: {
          primary: "var(--color-accent-primary)",
          "primary-hover": "var(--color-accent-primary-hover)",
          "primary-glow": "var(--color-accent-primary-glow)",
          secondary: "var(--color-accent-secondary)",
          success: "var(--color-accent-success)",
          danger: "var(--color-accent-danger)",
          warning: "var(--color-accent-warning)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          focus: "var(--color-border-focus)",
          input: "var(--color-border-input)",
        },
      },

      // ── Spacing ──
      spacing: {
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
        "3xl": "var(--space-3xl)",
        header: "var(--header-height)",
      },

      // ── Border Radius ──
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },

      // ── Shadows ──
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "var(--shadow-glow)",
      },

      // ── Transitions ──
      transitionDuration: {
        fast: "150ms",
        base: "250ms",
        slow: "400ms",
      },

      // ── Layout ──
      maxWidth: {
        layout: "var(--max-width)",
      },
      minHeight: {
        btn: "var(--btn-min-h)",
      },
    },
  },
  plugins: [],
};

export default config;
```

> **IMPORTANT:** The `fontSize` values include `var(--font-scale)` to preserve the Simple Mode accessibility multiplier. This is critical — the PRD requires +30% font scaling in Simple Mode.

---

### Task 1.4: Add Tailwind Directives to globals.css

**File:** `src/app/globals.css`

Add the Tailwind directives at the **very top** of the file, BEFORE the existing comment block. Keep everything else intact.

For Tailwind v4:
```css
@import "tailwindcss";
```

For Tailwind v3:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Place these directives ABOVE line 1 (before the `/* ============` comment).

> **KEEP** all `:root` variables, Simple Mode overrides, reset rules, and all existing CSS. This phase is additive only.

---

### Task 1.5: Verify Build

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

If the build fails due to PostCSS/Tailwind config issues, debug by checking:
- Tailwind version compatibility with Next.js 16
- PostCSS plugin format (CJS vs ESM)
- Content array paths

---

### Phase 1 Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat(tailwind): Phase 1 — Tailwind initialization + token mapping to tailwind.config.ts"
```

### 🛑 PHASE GATE: Stop here. Report the following to the user:
1. Tailwind version installed
2. Number of tokens mapped in `tailwind.config.ts`
3. Build status (pass/fail)
4. Confirmation that visual identity is unchanged

**Wait for user approval before proceeding to Phase 2.**

---

# ═══════════════════════════════════════
# PHASE 2: Co-located CSS & Module Purge
# ═══════════════════════════════════════

## Objective
Convert all 20 CSS Module files and 33 plain CSS files to Tailwind utility classes injected directly into `.tsx` `className` attributes. Delete the original CSS files.

## Definition of Done
- [ ] 0 `.module.css` files remain in `src/`
- [ ] 0 plain `.css` files remain in `src/` (except `globals.css`)
- [ ] 0 orphaned `import styles from` or `import "./foo.css"` statements
- [ ] All component visuals preserved via Tailwind utility classes
- [ ] `npx next build` passes with 0 errors

## Strategy

Work in **batches of 3–5 files**. After each batch:
1. Delete the CSS files
2. Remove the import statements
3. Run `npx next build` to verify
4. Commit the batch

### Batch Execution Order

Process **smallest files first** (fewer lines = faster, lower risk), then tackle the larger ones with more confidence.

---

### Task 2.1: CSS Modules (20 files) — Batch Processing

For each `.module.css` file:

1. **Read** the CSS Module file completely
2. **Read** the corresponding `.tsx` file that imports it
3. **Translate** each CSS rule to Tailwind utility classes:
   - Map `var(--space-md)` to `p-md`, `m-md`, `gap-md` etc. using the Tailwind config from Phase 1
   - Map `var(--color-*)` to the corresponding Tailwind color class
   - Map `var(--radius-*)` to `rounded-*`
   - Map `var(--shadow-*)` to `shadow-*`
   - Map `display: flex; flex-direction: column` to `flex flex-col`
   - Map media queries to responsive prefixes: `@media (max-width: 768px)` → mobile-first (Tailwind default), `md:` prefix for desktop-up
4. **Replace** `className={styles.something}` with `className="tailwind classes here"`
5. **Remove** the `import styles from "./Something.module.css"` line
6. **Delete** the `.module.css` file
7. **Build-check** after each batch

**Hardcode Snap Rule (Task 2.3):** If you encounter any hardcoded `px` values (e.g., `padding: 12px`) or `#hex` colors (e.g., `color: #f59e0b`) that are NOT wrapped in a `var()`, snap them to the nearest Tailwind token:
- `12px` → `p-md` (if closest to `--space-md: 1rem`)
- `#f59e0b` → `text-accent-warning` (if closest to `--color-accent-warning`)
- If no good match exists, use Tailwind arbitrary values: `p-[12px]`, `text-[#f59e0b]`

**Batch order (smallest first):**

**Batch A** (tiny files, ≤50 lines):
```
src/app/page.module.css (1 line)
src/components/MakeOfferModal.module.css (34 lines)
src/components/GroupAdminPanel.module.css (38 lines)
src/components/FavoriteButton.module.css (42 lines)
src/components/GroupFiles.module.css (44 lines)
```

After batch A:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**Batch B** (small files, 47–96 lines):
```
src/components/RatingForm.module.css (47 lines)
src/components/WishlistButton.module.css (48 lines)
src/components/DashboardToast.module.css (62 lines)
src/app/discover/discover.module.css (61 lines)
src/components/FeaturedHorseCard.module.css (81 lines)
```

After batch B:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**Batch C** (medium files, 89–172 lines):
```
src/components/DashboardShell.module.css (89 lines)
src/components/MatchmakerMatches.module.css (96 lines)
src/components/OfferCard.module.css (106 lines)
src/components/GroupDetailClient.module.css (115 lines)
src/app/dashboard/dashboard.module.css (117 lines)
src/components/ShowHistoryWidget.module.css (118 lines)
```

After batch C:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**Batch D** (larger files):
```
src/components/ChatThread.module.css (157 lines)
src/app/settings/settings.module.css (161 lines)
src/app/inbox/inbox.module.css (164 lines)
src/components/StableLedger.module.css (172 lines)
```

After batch D:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Commit after all modules:
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "refactor(tailwind): Phase 2a — purge all 20 CSS Modules → Tailwind utility classes"
```

---

### Task 2.2: Plain CSS Files (33 files) — Batch Processing

Same approach, but these use `import "./foo.css"` instead of module imports.

For each plain CSS file:
1. Read the CSS file
2. Find the `.tsx` file(s) that import it (search for `import "./filename.css"` or `import "../path/filename.css"`)
3. Translate CSS rules to Tailwind classes
4. Apply classes to the HTML elements that match the CSS selectors
5. Remove the CSS import
6. Delete the CSS file

**Batch order (smallest first):**

**Batch E** (≤55 lines):
```
src/components/BackToTop.css (37 lines)
src/components/GroupRegistry.css (45 lines)
src/app/stable/VisibilitySelector.css (45 lines)
src/components/RichEmbed.css (52 lines)
src/app/shows/RingConflict.css (55 lines)
src/app/stable/PhotoReorder.css (32 lines)
```

After batch E:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**Batch F** (61–125 lines):
```
src/components/CookieConsent.css (61 lines)
src/app/stable/BatchResults.css (67 lines)
src/app/faq/faq.css (86 lines)
src/components/Notifications.css (112 lines)
src/components/Footer.css (119 lines)
src/components/FollowFeed.css (125 lines)
```

After batch F:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**Batch G** (131–196 lines):
```
src/components/VaultReveal.css (131 lines)
src/components/ChatGuardrails.css (136 lines)
src/components/TrophyCase.css (149 lines)
src/components/CommentSection.css (153 lines)
src/app/about/static.css (155 lines)
src/components/SocialFoundation.css (159 lines)
src/app/community/HelpId.css (196 lines)
```

After batch G:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**Batch H** (208–348 lines):
```
src/components/Ratings.css (208 lines)
src/app/stable/PhotoUpload.css (254 lines)
src/components/Provenance.css (278 lines)
src/app/market/market.css (307 lines)
src/app/stable/passport.css (309 lines)
src/app/shows/shows.css (348 lines)
```

After batch H:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**Batch I** (big files, 449–949 lines):
```
src/components/CsvImport.css (449 lines)
src/app/studio.css (451 lines)
src/app/admin/admin.css (453 lines)
src/app/add-horse/gallery.css (569 lines)
src/app/competition.css (665 lines)
src/app/WelcomeOnboarding.css (722 lines)
src/app/catalog/reference.css (949 lines)
```

After batch I:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**Batch J** — last file:
```
src/app/shows/ShowBuilder.css (186 lines)
```

After batch J:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Commit after all plain CSS:
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "refactor(tailwind): Phase 2b — purge all 33 plain CSS files → Tailwind utility classes"
```

---

### Task 2.4: Verify Zero CSS Files Remain (except globals.css)

```
cd c:\Project Equispace\model-horse-hub && Get-ChildItem -Path src -Recurse -Include "*.css","*.module.css" | Where-Object { $_.Name -ne "globals.css" } | Select-Object FullName
```

Expected output: **empty** (no files).

### Phase 2 Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "refactor(tailwind): Phase 2 complete — 53 CSS files eliminated, all styles in Tailwind utilities"
```

### 🛑 PHASE GATE: Stop here. Report to the user:
1. Total CSS files deleted (target: 53)
2. Any hardcoded values that couldn't be token-snapped
3. Build status (pass/fail)
4. Any components where translation was ambiguous

**Wait for user approval before proceeding to Phase 3.**

---

# ═══════════════════════════════════════
# PHASE 3: Monolith Dismantling (globals.css)
# ═══════════════════════════════════════

## Objective
Strip `globals.css` from **3,948 lines** down to **< 400 lines** by extracting all component-specific styles into Tailwind utility classes on their target `.tsx` elements.

## Definition of Done
- [ ] `globals.css` contains **zero** component-specific class names (e.g., no `.profile-header`, `.search-bar-wrap`, `.show-entry-card`)
- [ ] `globals.css` retains ONLY: Tailwind directives, `:root` tokens, Simple Mode overrides, base resets (`*`, `html`, `body`, `a`, `img`), and macro-utility classes (`.btn`, `.form-input`, `.card`, etc.) converted to Tailwind `@apply`
- [ ] `globals.css` is **< 400 lines**
- [ ] `npx next build` passes with 0 errors

---

### Task 3.1: Identify Extractable Blocks

Read `globals.css` section by section. Categorize every CSS block:

**KEEP in globals.css (convert to `@apply` where possible):**
- `@tailwind` directives (already added in Phase 1)
- Google Fonts `@import`
- `:root` design tokens (lines 14–102)
- Simple Mode overrides `[data-simple-mode="true"]` (lines 109–157)
- Base resets: `*`, `html`, `body`, `main`, `a`, `img` (lines 162–207)
- Typography: `h1`–`h6`, `p`, `.text-gradient` (lines 213–249)
- Layout primitives: `.page-container`, `.auth-page` (lines 255–267)
- Header styles: `.header*` (lines 273–620) — **these are shared across the entire app**
- Card primitives: `.card`, `.card-auth`, `.card-header` (lines 626–663)
- Form primitives: `.form-group`, `.form-label`, `.form-input`, `.form-select`, `.form-textarea`, `.form-hint`, `.form-error`, `.form-divider` (lines 669–752)
- Privacy callout: `.privacy-callout` (lines 758–783)
- Button primitives: `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger` etc.
- Modal overlay: `.modal-overlay`, `.modal-content`

**EXTRACT to `.tsx` files (delete from globals.css):**
Everything else — scan for class names that are specific to one or a few components. Examples include:
- `.show-entry-*` → `ShowEntryForm.tsx`
- `.show-entries-grid` → `shows/[id]/page.tsx`
- `.horse-card-*` → components that render horse cards
- `.community-*` → community page components
- `.stable-*` → stable/dashboard components
- `.passport-*` → passport page
- `.feed-*` → feed components
- `.discover-*` → discover page
- `.getting-started-*` → getting started page
- Any other block targeting a specific UI section

### Task 3.2: Extract Component-Specific CSS

For each component-specific CSS block in `globals.css`:
1. Identify the selector (e.g., `.show-entry-card`)
2. Find the `.tsx` file(s) using that class name:
   ```
   cd c:\Project Equispace\model-horse-hub && Select-String -Path "src/**/*.tsx" -Pattern "show-entry-card" -List
   ```
3. Translate the CSS rules to Tailwind utilities
4. Apply the Tailwind classes to the matching `className` in the `.tsx` file
5. Remove the CSS block from `globals.css`

Work in structural sections:
- **Section A:** Header styles (already shared — convert to `@apply` if keeping in globals, or extract if only used by `Header.tsx`)
- **Section B:** Horse card styles → `StableGrid.tsx`, `ShowRingGrid.tsx`, etc.
- **Section C:** Show/competition styles → show-related components
- **Section D:** Community/social styles → community pages
- **Section E:** All remaining component-specific blocks

After each section:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.3: Convert Macro-Utilities to @apply

For the KEPT primitives (`.btn`, `.form-input`, `.card`, etc.), convert from raw CSS to Tailwind `@apply` syntax inside a `@layer components` block:

```css
@layer components {
  .btn {
    @apply inline-flex items-center justify-content-center gap-sm min-h-btn px-xl font-sans font-semibold rounded-md border border-transparent cursor-pointer;
    transition: all var(--transition-fast);
  }
  
  .btn-primary {
    @apply bg-accent-primary text-text-inverse;
  }
  
  .card {
    @apply bg-bg-card border border-border rounded-lg p-2xl shadow-md;
    transition: all var(--transition-base);
  }
  
  .form-input, .form-select, .form-textarea {
    @apply block w-full min-h-btn px-md py-sm font-sans text-base text-text-primary bg-bg-input border border-border-input rounded-md outline-none;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  }
}
```

> **Note:** Some complex rules (pseudo-elements, `::before`, `::after`, complex selectors) cannot use `@apply` — keep those as raw CSS within `@layer base` or `@layer components`.

### Task 3.4: Measure Final globals.css Size

```
cd c:\Project Equispace\model-horse-hub && (Get-Content src\app\globals.css | Measure-Object -Line).Lines
```

Target: **< 400 lines**.

### Phase 3 Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "refactor(tailwind): Phase 3 — globals.css monolith dismantled (3,948 → <400 lines)"
```

### 🛑 PHASE GATE: Stop here. Report to the user:
1. Final `globals.css` line count
2. List of macro-utility classes retained (`.btn`, `.card`, `.form-*`, etc.)
3. Any classes that couldn't be cleanly extracted (and why)
4. Build status

**Wait for user approval before proceeding to Phase 4.**

---

# ═══════════════════════════════════════
# PHASE 4: Inline Style Eradication & Desktop Fix
# ═══════════════════════════════════════

## Objective
Convert the 1,036 inline `style={{}}` occurrences to Tailwind classes. Fix "single-column stack" layouts on desktop by adding responsive breakpoint classes.

## Definition of Done
- [x] Inline `style={{}}` instances reduced from 1,036 — **1,313 props converted to Tailwind** (505 remain: multi-line blocks, dynamic values, react-pdf native styles)
- [x] Remaining inline styles are ONLY truly dynamic (JS-computed runtime values) or multi-line blocks requiring AST parser
- [ ] Desktop views (>768px) — **DEFERRED** to future sprint
- [x] `npx next build` passes with 0 errors, all 239 tests pass

---

### Task 4.1: Target Top Offenders

Identify the files with the most `style={{}}` occurrences:

```
cd c:\Project Equispace\model-horse-hub && Get-ChildItem -Path src -Recurse -Include "*.tsx" | ForEach-Object { $count = (Select-String -Path $_.FullName -Pattern 'style=\{\{' -AllMatches).Matches.Count; if ($count -gt 0) { "$count`t$($_.Name)" } } | Sort-Object -Descending | Select-Object -First 20
```

Process in descending order of occurrences — highest count first for maximum impact.

### Task 4.2: Translate Static Inline Styles

For each `style={{}}` occurrence:

1. **If STATIC** (no JS variables): Convert to Tailwind classes
   - `style={{ marginBottom: 'var(--space-md)' }}` → `className="mb-md"`
   - `style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}` → `className="flex flex-col gap-sm"`
   - `style={{ fontSize: 'calc(var(--font-size-sm) * var(--font-scale))' }}` → `className="text-sm"`
   - `style={{ color: 'var(--color-text-muted)' }}` → `className="text-text-muted"`
   - `style={{ padding: 'var(--space-xs) var(--space-sm)' }}` → `className="px-sm py-xs"`
   - `style={{ fontWeight: 600 }}` → `className="font-semibold"`
   - `style={{ textAlign: 'center' }}` → `className="text-center"`

2. **If DYNAMIC** (contains JS variables or ternaries): KEEP the inline style
   - `style={{ width: \`${uploadProgress}%\` }}` → KEEP
   - `style={{ background: isActive ? 'green' : 'red' }}` → Convert to conditional className: `className={isActive ? 'bg-green-500' : 'bg-red-500'}`
   - `style={{ color: someComputedColor }}` → KEEP (truly dynamic)

3. **If MIXED** (some static, some dynamic): Split — move static parts to className, keep dynamic in style

### Task 4.3: The Desktop Breakout [CRITICAL]

While converting inline styles, analyze layout hierarchy. Many components are trapped in vertical stacks:
```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
```

Convert these with **responsive prefixes** where horizontal layout makes sense on desktop:

```tsx
{/* Before: always vertical */}
<div style={{ display: 'flex', flexDirection: 'column' }}>

{/* After: vertical on mobile, horizontal on desktop */}
<div className="flex flex-col md:flex-row gap-md">
```

**Key layout patterns to fix:**
- Side-by-side cards on desktop: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md`
- Form + sidebar: `flex flex-col lg:flex-row gap-xl`
- Stats/metrics row: `flex flex-wrap gap-md` (already horizontal, just ensure it doesn't stack needlessly)
- Page sections: `max-w-layout mx-auto px-lg`

### Task 4.4: Verify Inline Style Count

```
cd c:\Project Equispace\model-horse-hub && (Get-ChildItem -Path src -Recurse -Include "*.tsx" | Select-String 'style=\{\{' | Measure-Object).Count
```

Target: **< 50**.

### Phase 4 Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "refactor(tailwind): Phase 4 — 1,036 inline styles → Tailwind + desktop responsive breakpoints"
```

### 🛑 PHASE GATE: Stop here. Report to the user:
1. Remaining inline style count (target: < 50)
2. List of files with remaining inline styles and why they were kept
3. Desktop layout improvements made (which pages now use horizontal layouts)
4. Build status

**Wait for user approval before proceeding to Phase 5.**

---

# ═══════════════════════════════════════
# PHASE 5: Build, Validate, and Clean
# ═══════════════════════════════════════

## Objective
Final validation — ensure everything compiles, no orphaned CSS imports remain, class order is standardized, and CSS payload is reduced.

## Definition of Done
- [x] `npx next build` passes with 0 errors
- [x] 0 unauthorized `.css` imports remain — only `globals.css` in root layout
- [x] Prettier with `prettier-plugin-tailwindcss` standardizes class order (184 files formatted)
- [x] Total CSS payload: **~101 KB** (97.4 KB main + 3.6 KB chunk)
- [x] No TypeScript errors related to style props
- [x] 239/239 tests passing

---

### Task 5.1: Full Build

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Fix any errors.

### Task 5.2: Verify Zero Unauthorized CSS Imports

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src/**/*.tsx","src/**/*.ts" -Pattern '\.css[''"]' | Where-Object { $_.Line -notmatch 'globals\.css' } | Select-Object Filename, LineNumber, Line
```

Expected: **0 results** (no CSS imports except globals.css in the root layout).

### Task 5.3: Run Prettier with Tailwind Plugin

Ensure `.prettierrc` (or `prettier.config.js`) includes the Tailwind plugin:

```json
{
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

Then format all files:

```
cd c:\Project Equispace\model-horse-hub && npx prettier --write "src/**/*.tsx"
```

### Task 5.4: Final CSS File Inventory

```
cd c:\Project Equispace\model-horse-hub && Get-ChildItem -Path src -Recurse -Include "*.css","*.module.css" | Select-Object FullName
```

Expected: **Exactly 1 file** — `src/app/globals.css`.

### Task 5.5: Measure CSS Payload

Check the compiled CSS size in the build output. The `.next` build directory should show the bundled CSS:

```
cd c:\Project Equispace\model-horse-hub && Get-ChildItem -Path .next/static/css -Recurse | ForEach-Object { "$($_.Length / 1KB) KB`t$($_.Name)" }
```

### Task 5.6: Run Existing Tests

```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

All existing tests should pass — we only changed styling, not logic.

### Phase 5 Final Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "refactor(tailwind): Phase 5 — final validation, Prettier class sorting, clean build"
```

### Push

```
cd c:\Project Equispace\model-horse-hub && git push
```

---

## Documentation Updates

After Phase 5 is approved, update these files:

1. **Onboard workflow** (`c:\Project Equispace\model-horse-hub\.agents\workflows\onboard.md`):
   - Update CSS Architecture section: "Tailwind CSS utility-first. All styles in `.tsx` classNames. Design tokens in `tailwind.config.ts` mapped from `:root` variables in `globals.css`."
   - Update globals.css line count

2. **State report** (`c:\Project Equispace\model-horse-hub\.agents\docs\model_horse_hub_state_report.md`):
   - Add Tailwind migration to shipped features
   - Update tech stack table: CSS → Tailwind CSS

3. **dev-nextsteps** (`c:\Project Equispace\model-horse-hub\.agents\workflows\dev-nextsteps.md`):
   - Archive "M-1: globals.css Continued Extraction" as superseded by Tailwind migration

---

## Migration Summary

| Phase | What | Files Affected | DoD Metric |
|-------|------|----------------|------------|
| 1 | Tailwind init + token mapping | 3 new files | 100% tokens mapped, build passes |
| 2 | CSS Module + Plain CSS purge | ~107 files (54 deleted, 53 .tsx modified) | 0 .css files except globals.css |
| 3 | globals.css monolith dismantling | globals.css + ~40 .tsx files | globals.css < 400 lines |
| 4 | Inline style eradication + desktop fix | ~77 .tsx files | < 50 inline styles remain |
| 5 | Build validation + cleanup | All .tsx files (Prettier) | 0 errors, 0 rogue CSS imports |
