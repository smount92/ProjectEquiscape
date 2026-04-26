---
description: "V44 Visual QA Phase 0 — Surface Inventory. Catalog all 63 page routes and 149 components by layout archetype and priority tier. Output: visual-qa-surface-inventory.json + visual-qa-checklist.md."
---

# V44 Visual QA — Phase 0: Surface Inventory

> **Epic:** V44 Site-Wide Visual QA Audit
> **Goal:** Catalog every user-facing surface so Phases 1–7 have an explicit, tiered hit list. No guessing, no missed pages.
> **Output:** Two files — `visual-qa-surface-inventory.json` (machine-readable) and `.agents/docs/visual-qa-checklist.md` (human-readable living doc).

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.

**Palette constraint:** All new UI encountered during audit must use warm parchment palette. `bg-[#FEFCF8]` cards, `border-[#E0D5C1]` borders, Hunter Green `#2C5545` accent. Cold palette (`bg-white`, `bg-stone-50`) is BANNED — log violations for Phase 1–6 to fix.

// turbo-all

---

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

```
cd c:\Project Equispace\model-horse-hub && git log --oneline -5
```

---

## Task 0.1: Enumerate all page routes

Run this command to list every `page.tsx` with its line count:

```
cd c:\Project Equispace\model-horse-hub && Get-ChildItem -Path "src\app" -Filter "page.tsx" -Recurse | ForEach-Object { $rel = $_.FullName.Replace("c:\Project Equispace\model-horse-hub\", ""); $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines; "$rel ($lines lines)" } | Sort-Object
```

Record the output. Expected: ~63 page files.

---

## Task 0.2: Enumerate all non-UI components

```
cd c:\Project Equispace\model-horse-hub && Get-ChildItem -Path "src\components" -Filter "*.tsx" -Recurse | Where-Object { $_.FullName -notlike "*\ui\*" -and $_.FullName -notlike "*__tests__*" } | ForEach-Object { $rel = $_.FullName.Replace("c:\Project Equispace\model-horse-hub\", ""); $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines; "$rel ($lines lines)" } | Sort-Object
```

Record the output. These are the components that render user-facing content.

---

## Task 0.3: Enumerate shadcn primitives

```
cd c:\Project Equispace\model-horse-hub && Get-ChildItem -Path "src\components\ui" -Filter "*.tsx" | ForEach-Object { $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines; "$($_.Name) ($lines lines)" }
```

Expected: 11 primitives (badge, button, card, dialog, input, popover, select, separator, skeleton, table, textarea).

---

## Task 0.4: Scan for cold palette violations

Find all files still using banned cold palette values:

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\app\**\page.tsx","src\components\**\*.tsx" -Pattern "bg-white|bg-stone-50\b" -Recurse | Select-Object -First 50 | ForEach-Object { "$($_.Filename):$($_.LineNumber)" }
```

Record these — they become fix targets in later phases.

---

## Task 0.5: Scan for bare `<select>` and `<input>` (non-shadcn)

Find native HTML form elements that bypass our design system:

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\app\**\page.tsx","src\components\**\*.tsx" -Pattern "<select[\s>]|<input[\s>]" -Recurse | Where-Object { $_.Line -notmatch "Select\.|Input " } | Select-Object -First 50 | ForEach-Object { "$($_.Filename):$($_.LineNumber) => $($_.Line.Trim().Substring(0, [Math]::Min(80, $_.Line.Trim().Length)))" }
```

These are inconsistency risks — native elements won't have our focus rings, palette, or Simple Mode scaling.

---

## Task 0.6: Classify pages by tier and archetype

Using the data from Tasks 0.1–0.5, create the file `.agents/docs/visual-qa-checklist.md` with this structure:

```markdown
# V44 Visual QA Checklist

> Living document. Updated as each phase completes.
> Generated: YYYY-MM-DD

## Tier 1 — Daily Use (audit FIRST)

| Page | Route | Archetype | Lines | Phase Target |
|------|-------|-----------|-------|-------------|
| Dashboard | `/dashboard` | CommandCenter | ~XXX | P2, P3 |
| Add to Stable | `/add-horse` | FocusLayout | ~1684 | P2 |
| Stable Detail | `/stable/[id]` | Scrapbook | ~XXX | P4 |
| Stable Edit | `/stable/[id]/edit` | FocusLayout | ~XXX | P2 |
| Community Detail | `/community/[id]` | Scrapbook | ~XXX | P4 |
| Inbox / Chat | `/inbox/[id]` | FocusLayout | ~XXX | P2, P5 |
| Market | `/market` | Explorer | ~XXX | P2, P3 |
| Settings | `/settings` | FocusLayout | ~XXX | P2 |
| Catalog | `/catalog` | Explorer | ~XXX | P3 |
| Profile | `/profile/[alias_name]` | Scrapbook | ~XXX | P4 |
| Notifications | `/notifications` | Explorer | ~XXX | P4 |
| Feed | `/feed` | Explorer | ~XXX | P4 |

## Tier 2 — Weekly Use (audit SECOND)

| Page | Route | Archetype | Lines | Phase Target |
|------|-------|-----------|-------|-------------|
| Shows List | `/shows` | Explorer | | P3 |
| Show Detail | `/shows/[id]` | Scrapbook | | P3, P4 |
| Show Results | `/shows/[id]/results` | Explorer | | P3 |
| Show Planner | `/shows/planner` | FocusLayout | | P2 |
| Event Detail | `/community/events/[id]` | Scrapbook | | P4 |
| Event Manage | `/community/events/[id]/manage` | CommandCenter | | P2, P3 |
| Event Create | `/community/events/create` | FocusLayout | | P2 |
| Groups | `/community/groups` | Explorer | | P3 |
| Group Detail | `/community/groups/[slug]` | Scrapbook | | P4 |
| Help ID | `/community/help-id` | Explorer | | P4 |
| Studio Landing | `/studio` | Explorer | | P4 |
| Studio Dashboard | `/studio/dashboard` | CommandCenter | | P3 |
| Studio Profile | `/studio/[slug]` | Scrapbook | | P4 |
| Commission Detail | `/studio/commission/[id]` | FocusLayout | | P4 |
| Commission Request | `/studio/[slug]/request` | FocusLayout | | P2 |
| Catalog Item | `/catalog/[id]` | Scrapbook | | P4 |
| Catalog Suggestion | `/catalog/suggestions/[id]` | FocusLayout | | P2, P3 |
| Catalog New Suggestion | `/catalog/suggestions/new` | FocusLayout | | P2 |
| Hoofprint | `/community/[id]/hoofprint` | Scrapbook | | P4 |
| Collection | `/stable/collection/[id]` | Explorer | | P3 |
| CSV Import | `/stable/import` | FocusLayout | | P2, P3 |
| Discover | `/discover` | Explorer | | P3 |
| Wishlist | `/wishlist` | Explorer | | P3 |
| Upgrade | `/upgrade` | FocusLayout | | P4 |

## Tier 3 — Rare / Static (audit LAST, light touch)

| Page | Route | Notes |
|------|-------|-------|
| Landing | `/` | Marketing — check mobile hero only |
| About | `/about` | Static |
| FAQ | `/faq` | Static |
| Terms | `/terms` | Static |
| Privacy | `/privacy` | Static |
| Contact | `/contact` | Static |
| Getting Started | `/getting-started` | Onboarding guide |
| Login | `/login` | Auth |
| Signup | `/signup` | Auth |
| Forgot Password | `/forgot-password` | Auth |
| Reset Password | `/auth/reset-password` | Auth |
| Auth Error | `/auth/auth-code-error` | Error |
| Claim | `/claim` | Transfer claim |
| Admin | `/admin` | Internal only |
| Quick Add | `/add-horse/quick` | Minimal form |
| Photo Share | `/photo/[slug]` | OG preview |
| Offline | `/~offline` | PWA fallback |

## Cold Palette Violations Found

(Paste output from Task 0.4 here)

## Bare Native Form Elements

(Paste output from Task 0.5 here)
```

Fill in actual line counts from Task 0.1 output. The `~XXX` placeholders must be replaced with real numbers.

---

## Task 0.7: Create machine-readable inventory

Create `visual-qa-surface-inventory.json` in `.agents/docs/`:

```json
{
  "generated": "YYYY-MM-DD",
  "pages": {
    "tier1": [
      { "route": "/dashboard", "file": "src/app/dashboard/page.tsx", "archetype": "CommandCenter", "lines": 0, "phases": ["P2","P3"] }
    ],
    "tier2": [],
    "tier3": []
  },
  "primitives": ["badge.tsx", "button.tsx", ...],
  "coldPaletteViolations": [],
  "bareNativeElements": [],
  "componentCount": 149,
  "pageCount": 63
}
```

Populate with real data from all previous tasks. This file is consumed by Phase 7 automation.

---

## Task 0.8: Verify and commit

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Verify both output files exist and are well-formed:

```
cd c:\Project Equispace\model-horse-hub && Test-Path ".agents/docs/visual-qa-checklist.md" && Test-Path ".agents/docs/visual-qa-surface-inventory.json"
```

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "chore(v44): phase 0 — visual QA surface inventory (63 pages, 149 components cataloged)"
```

---

## ✅ DONE Protocol

Mark this phase complete when:
- [ ] `visual-qa-checklist.md` exists with all 63 pages classified into Tier 1/2/3
- [ ] `visual-qa-surface-inventory.json` exists with real data
- [ ] Cold palette violations list is populated (count may be 0)
- [ ] Bare native form element list is populated (count may be 0)
- [ ] Build passes with 0 errors
- [ ] Committed to git

**Next:** Run `/v44-visual-qa-phase1-primitives` for shadcn primitive audit.
