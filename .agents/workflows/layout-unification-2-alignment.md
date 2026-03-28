---
description: Layout Unification Part 2 — Systematically refactor all 50+ page.tsx files to use the 4 Layout Archetype components, removing custom container divs.
status: "✅ COMPLETE (2026-03-27)"
---

# Layout Unification Part 2: The Great Alignment

> ## ✅ STATUS: COMPLETE (2026-03-27)
> All 55+ pages migrated. Build passes, 245 tests green. Only the root landing page retains bespoke layout.

> **Source Plan:** `.agents/docs/Layout_Unification.md` (Phase 3)
> **Scope:** Refactor all page.tsx files to use ExplorerLayout, ScrapbookLayout, CommandCenterLayout, or FocusLayout
> **Prerequisite:** Complete `layout-unification-1-archetypes.md` first
> **Last Updated:** 2026-03-27
> **Critical Rule:** DO NOT alter any Supabase queries, server actions, or async data fetching. This is PURELY DOM/CSS restructuring.

// turbo-all

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# Page Classification Map

Every `page.tsx` using `mx-auto max-w-[var(--max-width)]` has been classified into one of the 4 archetypes.

## Explorer Pages (browsing grids & lists)

| File | Current Container | Notes |
|------|-------------------|-------|
| `community/page.tsx` | `mx-auto max-w-[var(--max-width)] px-6 py-8` | Show Ring — has filter controls |
| `discover/page.tsx` | same | Discover grid |
| `market/page.tsx` | same | Blue Book market |
| `catalog/page.tsx` | same | Reference catalog browse |
| `shows/page.tsx` | same | Show listing |
| `community/groups/page.tsx` | same | Group browser |
| `community/events/page.tsx` | same | Event browser |
| `community/help-id/page.tsx` | same | Help ID requests |
| `studio/page.tsx` | same | Artist directory |
| `feed/page.tsx` | same | Activity feed |
| `wishlist/page.tsx` | same | Wishlist items |
| `notifications/page.tsx` | same | Notification list |
| `inbox/page.tsx` | same | Conversations list |
| `stable/collection/[id]/page.tsx` | same | Collection detail |
| `catalog/changelog/page.tsx` | same | Catalog changes |

## Scrapbook Pages (split-view details)

| File | Current Container | Notes |
|------|-------------------|-------|
| `stable/[id]/page.tsx` | `mx-auto max-w-[var(--max-width)]` + `grid-cols-[1.5fr_1fr]` | Private passport — already partially aligned |
| `community/[id]/page.tsx` | same | Public passport — already partially aligned |
| `studio/[slug]/page.tsx` | same | Artist studio profile |
| `community/events/[id]/page.tsx` | same | Event detail |
| `community/groups/[slug]/page.tsx` | same | Group detail |
| `community/[id]/hoofprint/page.tsx` | same | Full hoofprint page |
| `community/help-id/[id]/page.tsx` | same | Help ID detail |
| `catalog/[id]/page.tsx` | same | Catalog item detail |
| `profile/[alias_name]/page.tsx` | same | User profile |
| `shows/[id]/page.tsx` | same | Show detail |
| `studio/commission/[id]/page.tsx` | same | Commission detail |

## Command Center Pages (dashboards)

| File | Current Container | Notes |
|------|-------------------|-------|
| `dashboard/page.tsx` | `mx-auto max-w-[var(--max-width)]` | Main stable dashboard |
| `admin/page.tsx` | same | Admin panel |
| `studio/dashboard/page.tsx` | same | Artist dashboard |
| `studio/my-commissions/page.tsx` | same | Commission management |
| `shows/planner/page.tsx` | same | Show planning dashboard |

## Focus Pages (forms & data entry)

| File | Current Container | Notes |
|------|-------------------|-------|
| `add-horse/page.tsx` | max-w wrapper | Multi-step add form |
| `add-horse/quick/page.tsx` | same | Quick-add form |
| `stable/[id]/edit/page.tsx` | same | Edit horse |
| `settings/page.tsx` | same | User settings |
| `claim/page.tsx` | same | Claim transfer |
| `login/page.tsx` | auth-page wrapper | Auth form |
| `signup/page.tsx` | same | Auth form |
| `forgot-password/page.tsx` | same | Auth form |
| `auth/reset-password/page.tsx` | same | Auth form |
| `contact/page.tsx` | same | Contact form |
| `studio/setup/page.tsx` | same | Studio initial setup |
| `studio/[slug]/request/page.tsx` | same | Commission request form |
| `community/events/create/page.tsx` | same | Event creation |
| `community/events/[id]/manage/page.tsx` | same | Event management |
| `community/groups/create/page.tsx` | same | Group creation |
| `stable/import/page.tsx` | same | CSV import |
| `catalog/suggestions/new/page.tsx` | same | Catalog suggestion |

## Special Pages (keep as-is)

| File | Reason |
|------|---------|
| `page.tsx` (landing) | Unique hero layout, not a standard archetype |
| `inbox/[id]/page.tsx` | Full-height chat layout with custom scroll |
| `loading.tsx` | Global skeleton |
| `error.tsx` | Error boundary |
| `not-found.tsx` | 404 page |

> **Note:** `terms`, `privacy`, `faq`, `getting-started`, `upgrade`, `feed/[id]`, `catalog/suggestions`, `catalog/suggestions/[id]` were all migrated to ExplorerLayout despite initially being classified as "special". Only the root landing page and inbox chat remain bespoke.

---

# ═══════════════════════════════════════
# BATCH A: Explorer Pages (15 files)
# ═══════════════════════════════════════

## Pattern

For each Explorer page:

1. Add import: `import ExplorerLayout from "@/components/layouts/ExplorerLayout";`
2. Find the root `<div className="mx-auto max-w-[var(--max-width)] px-6 py-8">`
3. Replace with `<ExplorerLayout title="..." description="..." controls={...}>`
4. Move filter/search bars into the `controls` prop
5. Move header action buttons into `headerActions` prop
6. Leave grid content as `children`
7. Remove the old container div's closing tag

**Example transform:**
```tsx
// BEFORE:
return (
    <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
        <h1 className="font-serif text-3xl font-bold ...">Show Ring</h1>
        <p className="text-muted ...">Browse community horses</p>
        <div className="sticky ...">
            {/* filters */}
        </div>
        <ShowRingGrid ... />
    </div>
);

// AFTER:
return (
    <ExplorerLayout
        title="Show Ring"
        description="Browse community horses"
        controls={/* filters JSX */}
    >
        <ShowRingGrid ... />
    </ExplorerLayout>
);
```

### Batch A files:
1. `src/app/community/page.tsx`
2. `src/app/discover/page.tsx`
3. `src/app/market/page.tsx`
4. `src/app/catalog/page.tsx`
5. `src/app/shows/page.tsx`
6. `src/app/community/groups/page.tsx`
7. `src/app/community/events/page.tsx`
8. `src/app/community/help-id/page.tsx`

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

### Batch A continued:
9. `src/app/studio/page.tsx`
10. `src/app/feed/page.tsx`
11. `src/app/wishlist/page.tsx`
12. `src/app/notifications/page.tsx`
13. `src/app/inbox/page.tsx`
14. `src/app/stable/collection/[id]/page.tsx`
15. `src/app/catalog/changelog/page.tsx`

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# BATCH B: Scrapbook Pages (11 files)
# ═══════════════════════════════════════

## Pattern

For each Scrapbook page:

1. Add import: `import ScrapbookLayout from "@/components/layouts/ScrapbookLayout";`
2. Find the root container + grid
3. Replace with `<ScrapbookLayout breadcrumbs={...} leftContent={...} rightContent={...}>`
4. Move gallery/timeline/visual content into `leftContent`
5. Move data card/info sidebar into `rightContent`
6. Move any below-fold content (show records, comments) into `belowContent`

**Special notes:**
- `stable/[id]/page.tsx` and `community/[id]/page.tsx` already have the `grid-cols-[1.5fr_1fr]` layout applied — extract it into the ScrapbookLayout wrapper
- Preserve all data fetching in the parent Server Component — only restructure the JSX return

### Batch B files:
1. `src/app/stable/[id]/page.tsx` — leftContent: PassportGallery; rightContent: ledger card with all horse data
2. `src/app/community/[id]/page.tsx` — same pattern as above (public view)
3. `src/app/studio/[slug]/page.tsx` — leftContent: portfolio gallery; rightContent: artist info card
4. `src/app/community/events/[id]/page.tsx` — leftContent: event details; rightContent: RSVP/actions
5. `src/app/community/groups/[slug]/page.tsx` — leftContent: group info; rightContent: member list

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

6. `src/app/community/[id]/hoofprint/page.tsx`
7. `src/app/community/help-id/[id]/page.tsx`
8. `src/app/catalog/[id]/page.tsx`
9. `src/app/profile/[alias_name]/page.tsx`
10. `src/app/shows/[id]/page.tsx`
11. `src/app/studio/commission/[id]/page.tsx`

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# BATCH C: Command Center Pages (5 files)
# ═══════════════════════════════════════

## Pattern

For each Command Center page:

1. Add import: `import CommandCenterLayout from "@/components/layouts/CommandCenterLayout";`
2. Replace root container with `<CommandCenterLayout title="..." mainContent={...} sidebarContent={...}>`
3. Move the primary content grid into `mainContent`
4. Move sidebar widgets into `sidebarContent`

**Special notes:**
- `dashboard/page.tsx` — mainContent: DashboardShell (horse grid + pagination); sidebarContent: analytics cards, NAN widget, transfer history
- `admin/page.tsx` — mainContent: admin stats + user list; sidebarContent: contact messages
- Dashboard is a Server Component with Suspense boundaries — preserve all `<Suspense>` wrappers

### Batch C files:
1. `src/app/dashboard/page.tsx`
2. `src/app/admin/page.tsx`
3. `src/app/studio/dashboard/page.tsx`
4. `src/app/studio/my-commissions/page.tsx`
5. `src/app/shows/planner/page.tsx`

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# BATCH D: Focus Pages (17 files)
# ═══════════════════════════════════════

## Pattern

For each Focus page:

1. Add import: `import FocusLayout from "@/components/layouts/FocusLayout";`
2. Replace root container + heading with `<FocusLayout title="..." description="..." backLink={...}>`
3. Pass the form content as `children`
4. Remove any custom `max-w-[680px]`, `max-w-[500px]`, etc. — FocusLayout provides `max-w-2xl`

**Special notes:**
- Auth pages (login, signup, etc.) may have their own centered card. Keep the card but let FocusLayout handle the outer centering.
- Multi-step forms (add-horse) — FocusLayout wraps the entire stepper, the steps are children
- `stable/[id]/edit/page.tsx` has 3 loading states — wrap each returned JSX in FocusLayout

### Batch D files:
1. `src/app/login/page.tsx`
2. `src/app/signup/page.tsx`
3. `src/app/forgot-password/page.tsx`
4. `src/app/auth/reset-password/page.tsx`
5. `src/app/contact/page.tsx`
6. `src/app/claim/page.tsx`
7. `src/app/settings/page.tsx`
8. `src/app/add-horse/page.tsx`

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

9. `src/app/add-horse/quick/page.tsx`
10. `src/app/stable/[id]/edit/page.tsx`
11. `src/app/studio/setup/page.tsx`
12. `src/app/studio/[slug]/request/page.tsx`
13. `src/app/community/events/create/page.tsx`
14. `src/app/community/events/[id]/manage/page.tsx`
15. `src/app/community/groups/create/page.tsx`
16. `src/app/stable/import/page.tsx`
17. `src/app/catalog/suggestions/new/page.tsx`

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# FINAL VERIFICATION
# ═══════════════════════════════════════

### Verify no leftover custom containers

Search for orphaned `max-w-[var(--max-width)]` on page root divs:
```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\app\**\page.tsx" -Pattern "max-w-\[var\(--max-width\)\]" -List
```

> **Expected:** Only special pages (landing, inbox/[id], terms, privacy, FAQ, etc.) should appear. All classified pages should now use layout components.

### Full build + test

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

### Checklist
- [x] 15+ Explorer pages use `ExplorerLayout`
- [x] 11 Scrapbook pages use `ScrapbookLayout`
- [x] 5 Command Center pages use `CommandCenterLayout`
- [x] 17+ Focus pages use `FocusLayout`
- [x] Special pages (landing, inbox/[id]) intentionally excluded
- [x] No data fetching or server action logic was modified
- [x] All 245 tests pass
- [x] Build passes cleanly
- [x] All pages render correctly

> **Additional pages migrated beyond original scope:** `feed/[id]`, `catalog/suggestions`, `catalog/suggestions/[id]`, `add-horse/quick`, `stable/[id]`, `stable/[id]/edit`, `community/[id]`, `community/events/[id]/manage`, `privacy`, `terms`, `getting-started`, `upgrade`, `faq`, `about`

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat(ui): layout unification — 48 pages migrated to 4 layout archetypes, custom containers removed"
```
