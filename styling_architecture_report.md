# Model Horse Hub — Styling Architecture Report
**Date:** March 20, 2026  
**Purpose:** Provide a researcher with the full picture of current CSS architecture so they can recommend a more efficient layout.

---

## Executive Summary

The app uses **three coexisting styling approaches** with no unified strategy:

| Approach | File Count | Lines | % of Total |
|----------|-----------|-------|------------|
| **globals.css** (monolith) | 1 | 4,674 | 28.8% |
| **Plain CSS** (co-located) | 33 | 8,579 | 53.0% |
| **CSS Modules** (scoped) | 20 | 2,945 | 18.2% |
| **Inline `style={{}}`** | — | ~1,036 instances | N/A |
| **Total** | **54 files** | **16,200 lines** | **358 KB** |

The styling is functional but architecturally inconsistent. globals.css still contains the design system tokens AND component styles. Co-located files are split roughly 60/40 between plain CSS and CSS Modules, with no clear rule for which approach is used where. And 1,036 inline `style={{}}` instances add a third layer of styling that bypasses both.

---

## 1. File Inventory (sorted by size)

### Top 10 Largest CSS Files

| File | Lines | KB | Type | Selectors | @media | var() | Hardcoded #hex |
|------|------:|---:|------|----------:|-------:|------:|---------------:|
| [app/globals.css](file:///c:/Project%20Equispace/model-horse-hub/src/app/globals.css) | 4,674 | 107.9 | plain | 347 | 28 | 1,084 | 60 |
| `app/catalog/reference.css` | 1,130 | 22.1 | plain | 151 | 2 | 276 | 22 |
| `app/competition.css` | 783 | 17.5 | plain | 98 | 3 | 179 | 21 |
| `app/WelcomeOnboarding.css` | 841 | 17.4 | plain | 78 | 3 | 162 | 9 |
| `app/add-horse/gallery.css` | 667 | 14.0 | plain | 51 | 3 | 131 | 4 |
| `app/studio.css` | 519 | 12.2 | plain | 55 | 3 | 107 | 11 |
| `app/admin/admin.css` | 537 | 11.8 | plain | 55 | 1 | 130 | 9 |
| `components/CsvImport.css` | 525 | 11.8 | plain | 54 | 1 | 170 | 2 |
| `app/shows/shows.css` | 408 | 8.7 | plain | 41 | 2 | 66 | 6 |
| `app/stable/passport.css` | 356 | 8.2 | plain | 28 | 3 | 83 | 8 |

### All CSS Files (54 total)

#### CSS Modules (20 files, 2,945 lines)

| File | Lines | KB |
|------|------:|---:|
| `components/StableLedger.module.css` | 200 | 4.5 |
| `app/inbox/inbox.module.css` | 189 | 3.8 |
| `app/settings/settings.module.css` | 187 | 3.8 |
| `components/ChatThread.module.css` | 182 | 3.7 |
| `app/dashboard/dashboard.module.css` | 139 | 2.9 |
| [components/ShowHistoryWidget.module.css](file:///c:/Project%20Equispace/model-horse-hub/src/components/ShowHistoryWidget.module.css) | 138 | 2.7 |
| `components/GroupDetailClient.module.css` | 132 | 3.0 |
| `components/OfferCard.module.css` | 125 | 2.6 |
| `components/MatchmakerMatches.module.css` | 111 | 2.3 |
| `components/DashboardShell.module.css` | 100 | 2.4 |
| `components/FeaturedHorseCard.module.css` | 92 | 2.0 |
| `app/discover/discover.module.css` | 70 | 1.6 |
| [components/DashboardToast.module.css](file:///c:/Project%20Equispace/model-horse-hub/src/components/DashboardToast.module.css) | 69 | 1.7 |
| `components/RatingForm.module.css` | 55 | 1.3 |
| `components/WishlistButton.module.css` | 54 | 1.1 |
| `components/GroupFiles.module.css` | 51 | 1.1 |
| `components/FavoriteButton.module.css` | 47 | 1.0 |
| `components/GroupAdminPanel.module.css` | 45 | 0.9 |
| `components/MakeOfferModal.module.css` | 41 | 0.8 |
| `app/page.module.css` | 2 | 0.1 |

#### Plain CSS (34 files, 13,255 lines)

| File | Lines | KB |
|------|------:|---:|
| [app/globals.css](file:///c:/Project%20Equispace/model-horse-hub/src/app/globals.css) | 4,674 | 107.9 |
| `app/catalog/reference.css` | 1,130 | 22.1 |
| `app/competition.css` | 783 | 17.5 |
| `app/WelcomeOnboarding.css` | 841 | 17.4 |
| `app/add-horse/gallery.css` | 667 | 14.0 |
| `app/studio.css` | 519 | 12.2 |
| `app/admin/admin.css` | 537 | 11.8 |
| `components/CsvImport.css` | 525 | 11.8 |
| `app/shows/shows.css` | 408 | 8.7 |
| `app/stable/passport.css` | 356 | 8.2 |
| `app/market/market.css` | 366 | 8.0 |
| `components/Provenance.css` | 330 | 7.3 |
| `app/stable/PhotoUpload.css` | 300 | 6.1 |
| `components/Ratings.css` | 248 | 5.5 |
| `app/community/HelpId.css` | 232 | 5.0 |
| `app/shows/ShowBuilder.css` | 220 | 4.5 |
| `app/about/static.css` | 189 | 4.0 |
| `components/CommentSection.css` | 180 | 3.9 |
| `components/ChatGuardrails.css` | 156 | 3.7 |
| [components/SocialFoundation.css](file:///c:/Project%20Equispace/model-horse-hub/src/components/SocialFoundation.css) | 191 | 3.7 |
| `components/TrophyCase.css` | 180 | 3.6 |
| `components/VaultReveal.css` | 153 | 3.6 |
| `components/FollowFeed.css` | 148 | 3.3 |
| `components/Footer.css` | 142 | 3.2 |
| [components/Notifications.css](file:///c:/Project%20Equispace/model-horse-hub/src/components/Notifications.css) | 132 | 2.7 |
| `app/faq/faq.css` | 101 | 2.6 |
| `app/stable/BatchResults.css` | 78 | 2.2 |
| `components/CookieConsent.css` | 73 | 1.8 |
| `app/shows/RingConflict.css` | 65 | 1.6 |
| `components/GroupRegistry.css` | 54 | 1.6 |
| `components/RichEmbed.css` | 60 | 1.6 |
| `app/stable/VisibilitySelector.css` | 54 | 1.5 |
| `components/BackToTop.css` | 42 | 1.3 |
| `app/stable/PhotoReorder.css` | 37 | 1.1 |

---

## 2. globals.css Breakdown

**4,674 lines / 108 KB** — the monolith. Contains 114 sections:

### What globals.css owns (should stay global):

| Section | Lines | Purpose |
|---------|------:|---------|
| CSS custom properties (`:root` tokens) | ~96 | Design system: colors, spacing, typography, shadows |
| Simple Mode override | ~55 | Accessibility: +30% fonts, 60px buttons |
| Utility classes | ~40 | `.form-error`, `.animate-*`, `.sr-only` |
| Header | ~351 | Navigation, mobile menu, hamburger |
| Forms system | ~232 | `.form-group`, `.form-label`, `.form-input`, `.form-select` |
| Buttons | ~79 | `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm` |
| **Subtotal (true globals)** | **~853** | **18% of file** |

### What globals.css owns (could be extracted):

| Section | Lines | Natural owner |
|---------|------:|---------------|
| Unified Reference Search | ~324 | `components/UnifiedReferenceSearch.css` |
| Community page styles | ~120 | `app/community/community.css` |
| Profile page styles | ~82 | `app/profile/profile.css` |
| Collections system | ~200 | `components/Collections.css` |
| Search bar | ~110 | `components/SearchBar.css` |
| Modal system | ~92 | `components/Modal.css` |
| Analytics/Share | ~64 | `components/Analytics.css` |
| Toggle switch | ~44 | `components/ToggleSwitch.css` |
| Landing page | ~194 | `app/page.css` |
| Responsive overrides (mobile) | ~263 | co-located with each section |
| Edit page system | ~74 | `app/stable/edit.css` |
| Wishlist search | ~226 | `components/WishlistSearch.css` or existing `WishlistButton.module.css` |
| Parked Export & CoA | ~279 | `components/ParkedExportPanel.css` |
| **Subtotal (extractable)** | **~2,072** | **44% of file** |

### Remaining ~1,749 lines
Various scattered styles including responsive breakpoints that span multiple sections, keyframe animations, and styles that serve multiple components.

---

## 3. Inline Style Analysis

**1,036 `style={{}}` instances across 113 TSX files.**

### Top 15 Inline Style Offenders

| Instances | File | Pattern |
|----------:|------|---------|
| 68 | `app/community/events/[id]/manage/page.tsx` | Heavy layout inline |
| 41 | `components/UniversalFeed.tsx` | Feed item spacing/alignment |
| 35 | `app/shows/[id]/page.tsx` | Show detail layout |
| 34 | `components/CommissionTimeline.tsx` | Status timeline styling |
| 34 | `app/community/events/[id]/page.tsx` | Event detail layout |
| 31 | `app/claim/page.tsx` | Claim flow styling |
| 31 | `app/stable/[id]/edit/page.tsx` | Edit form layout |
| 28 | `app/studio/[slug]/page.tsx` | Artist studio page |
| 26 | `app/add-horse/page.tsx` | Form layout |
| 23 | `app/settings/page.tsx` | Settings layout |
| 21 | [components/ExpertJudgingPanel.tsx](file:///c:/Project%20Equispace/model-horse-hub/src/components/ExpertJudgingPanel.tsx) | Judging UI |
| 20 | `components/ShowStringManager.tsx` | Show planning |
| 19 | `components/PedigreeCard.tsx` | Pedigree tree layout |
| 19 | `components/SuggestReferenceModal.tsx` | Modal content layout |
| 17 | `app/studio/[slug]/request/page.tsx` | Commission request form |

### Common Inline Style Patterns

Most inline styles fall into a few patterns:
- **Spacing/margins:** `marginBottom: "var(--space-md)"` — using design tokens but inline
- **Colors:** `color: "var(--color-text-secondary)"` — using tokens but inline
- **Layout:** `display: "flex"`, `gap`, `justifyContent` — basic flex layouts inline
- **One-off tweaks:** `fontSize: "calc(0.8rem * var(--font-scale))"` — page-specific sizing

> [!IMPORTANT]
> The inline styles are mostly NOT hardcoded values — they reference CSS custom properties like `var(--space-md)`. The issue is **ergonomics and consistency**, not design token violations.

---

## 4. Import Architecture

| Import Type | Count | Notes |
|-------------|------:|-------|
| CSS Module imports | 19 | `import styles from "./Foo.module.css"` |
| Plain CSS imports | 34 | `import "./foo.css"` — global scope |
| globals.css | 1 | Imported in `layout.tsx` — applies everywhere |

### How Styles Reach Components

```
layout.tsx
  └── imports globals.css (4,674 lines → always loaded)

Page files (e.g. app/shows/page.tsx)
  └── import "./shows.css"  (plain, global scope)
  └── inline style={{}} (1-68 instances per file)

Component files (e.g. components/StableLedger.tsx)
  └── import styles from "./StableLedger.module.css"  (scoped)
  └── OR import "./Provenance.css"  (plain, global scope)
  └── inline style={{}} (1-41 instances per file)
```

> [!WARNING]
> Plain CSS files can collide with each other because they use global class names. CSS Modules avoid this by generating unique class names. Currently 34 files use plain CSS — they all rely on manually unique class names.

---

## 5. Design Token Usage

| Metric | Count | Notes |
|--------|------:|-------|
| `var(--*)` references | 4,047 | ✅ Excellent token adoption |
| Hardcoded `#hex` colors | 203 | ⚠️ Bypassing design tokens |
| Hardcoded `px` values | 593 | ⚠️ Bypassing spacing tokens |

### Hardcoded Color Hotspots

| File | #hex Count | Notes |
|------|----------:|-------|
| globals.css | 60 | Some are in `:root` definitions (expected) |
| reference.css | 22 | Catalog-specific accent colors |
| competition.css | 21 | Show ribbon/medal colors |
| Provenance.css | 20 | Timeline colors |
| studio.css | 11 | Artist studio accents |
| WelcomeOnboarding.css | 9 | Onboarding flow colors |
| admin/admin.css | 9 | Admin panel colors |

---

## 6. Architectural Problems

### Problem 1: Three Styling Systems, No One Strategy
- globals.css (monolith, always loaded)
- Plain co-located CSS (global scope, collision risk)
- CSS Modules (scoped, safe)
- Inline styles (scattered, un-cacheable)

### Problem 2: globals.css is 82% Non-Global
Only ~853 lines (18%) are truly global (tokens, resets, header, forms, buttons). The rest are component/page styles that ended up here.

### Problem 3: 1,036 Inline Styles
Many are `var(--token)` values which is good, but they can't be:
- Cached by the browser
- Media-queried for responsive design
- Reused across components
- Linted or audited

### Problem 4: No Naming Convention
Plain CSS files use BEM-ish names (`.show-ring-card`), CSS Modules use camelCase (`styles.ringCard`), and globals uses a mix. No documented convention.

### Problem 5: Responsive Styles Split Across Locations
Some `@media` queries live in globals.css for components whose other styles live in co-located files. This makes it hard to know the full styling picture for any component.

---

## 7. Recommendations for Researcher

### Questions to Investigate

1. **Unified approach:** Should everything migrate to CSS Modules, or would a utility-class system (Tailwind or custom) be more efficient?
2. **globals.css scope:** What should remain truly global after extraction? Just tokens + resets + header?
3. **Inline style strategy:** Should inline styles be banned, or are some patterns acceptable (e.g., dynamic values from JS)?
4. **Design token gaps:** The 203 hardcoded hex colors and 593 hardcoded px values — should these all become tokens?
5. **Responsive strategy:** Should each component own its own `@media` queries, or should there be a responsive layer?
6. **Build output:** Currently 260 KB of CSS in 10 chunks. Is tree-shaking/purging needed?

### File Tree for Context

```
src/
├── app/
│   ├── globals.css              ← 4,674 lines (monolith)
│   ├── layout.tsx               ← imports globals.css
│   ├── page.module.css          ← 2 lines (empty)
│   ├── competition.css          ← 783 lines (shows system)
│   ├── studio.css               ← 519 lines (artist studios)
│   ├── WelcomeOnboarding.css    ← 841 lines
│   ├── add-horse/gallery.css    ← 667 lines
│   ├── admin/admin.css          ← 537 lines
│   ├── catalog/reference.css    ← 1,130 lines (biggest co-located)
│   ├── community/HelpId.css     ← 232 lines
│   ├── dashboard/dashboard.module.css  ← 139 lines
│   ├── discover/discover.module.css    ← 70 lines
│   ├── faq/faq.css              ← 101 lines
│   ├── inbox/inbox.module.css   ← 189 lines
│   ├── market/market.css        ← 366 lines
│   ├── settings/settings.module.css    ← 187 lines
│   ├── shows/
│   │   ├── shows.css            ← 408 lines
│   │   ├── ShowBuilder.css      ← 220 lines
│   │   └── RingConflict.css     ← 65 lines
│   ├── stable/
│   │   ├── passport.css         ← 356 lines
│   │   ├── PhotoUpload.css      ← 300 lines
│   │   ├── BatchResults.css     ← 78 lines
│   │   ├── PhotoReorder.css     ← 37 lines
│   │   └── VisibilitySelector.css ← 54 lines
│   └── about/static.css         ← 189 lines
├── components/
│   ├── *.module.css             ← 19 CSS Module files
│   ├── *.css                    ← 15 plain CSS files
│   └── (113 TSX files with 1,036 inline styles)
└── lib/
    └── (no CSS)
```
