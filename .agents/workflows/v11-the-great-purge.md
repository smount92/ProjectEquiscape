---
description: Epic 1 — The Great Purge. Remove all legacy shims, legacy types, legacy FK columns, and legacy tables. Rewrite UnifiedReferenceSearch to use catalog_items directly. Drop reference_molds, reference_releases, artist_resins, horse_comments, group_posts, user_ratings, photo_shows, show_entries, show_votes, horse_timeline.
---

# Epic 1: The Great Purge — Burn the Ships

> **Ecosystem Expansion Plan — Epic 1 of 5**
> **Pre-requisites:** Grand Unification Plan complete (Migrations 042–050 applied).
> **Directive:** Remove every legacy shim, drop every deprecated table, and rewrite `UnifiedReferenceSearch.tsx` to use `catalog_items` directly. After this epic, zero code references legacy tables.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Check off the item in the Completion Checklist at the bottom
> 3. If you encounter issues or make design decisions, add a brief note under the task
> 4. Run `npx next build` after every task and note the result
> 5. Do NOT skip updating this file — the human uses it to track progress

---

## Execution Order

**Code-first, then schema-drop.** We update all code to stop referencing legacy columns/tables, then we drop them from the database. This prevents broken queries.

```
Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → BUILD → 10
(code)   (code)  (code)  (code)  (code)  (code)  (code)  (code)  (code)      (SQL)
```

---

## Task 1 — Rewrite `UnifiedReferenceSearch.tsx`

**File:** `src/components/UnifiedReferenceSearch.tsx` (619 lines → ~250 lines)

This is the biggest single refactor. The current component has:
- `MoldResult`, `ResinResult`, `ReleaseSearchResult` interfaces (legacy shapes)
- Tab switching logic (`mold` | `resin`)
- Separate click handlers per type
- Imports `getMoldDetailAction`, `getResinDetailAction`, `searchReferencesAction` (legacy shims)

### Rewrite to:

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import { searchCatalogAction, getReleasesForMold, type CatalogItem } from "@/app/actions/reference";

interface UnifiedReferenceSearchProps {
    selectedCatalogId: string | null;
    onCatalogSelect: (catalogId: string | null, item: CatalogItem | null) => void;
    onCustomEntry?: (searchTerm: string) => void;
    externalSearchQuery?: string;
    aiNotice?: React.ReactNode;
}

export default function UnifiedReferenceSearch({
    selectedCatalogId,
    onCatalogSelect,
    onCustomEntry,
    externalSearchQuery,
    aiNotice,
}: UnifiedReferenceSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<CatalogItem[]>([]);
    const [releases, setReleases] = useState<CatalogItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    // ... search logic using searchCatalogAction ...
    // ... single result list with type badges (🏭 🎨 📦) ...
    // ... clicking a mold auto-loads releases via getReleasesForMold() ...
    // ... clicking a release or resin calls onCatalogSelect(item.id, item) ...
}
```

### Key changes:
1. **Remove tabs entirely.** One search bar, one result list.
2. **Remove all legacy interfaces.** Use `CatalogItem` from `reference.ts`.
3. **Remove `SelectionState` interface.** Replace with simple `catalogId: string | null`.
4. **Remove `selectedMoldId`, `selectedResinId`, `selectedReleaseId` props.** Single `selectedCatalogId` prop.
5. **Remove legacy imports** (`getMoldDetailAction`, `getResinDetailAction`, `searchReferencesAction`).
6. **Add type badges** on each result: `🏭 Mold`, `📦 Release`, `🎨 Resin`.
7. **If a mold is clicked**, show its releases inline (via `getReleasesForMold()`). User can then select the mold itself OR a specific release.
8. **Export `ReleaseDetail` type** is no longer needed — remove it.

---

## Task 2 — Update `add-horse/page.tsx`

**File:** `src/app/add-horse/page.tsx`

### Remove:
- `selectedMoldId`, `selectedResinId`, `selectedReleaseId` state variables (3 lines)
- Release cascade `useEffect` (loads releases when mold selected — now handled inside the component)
- `releases`, `loadingReleases` state variables
- `import type { ReleaseDetail } from "@/components/UnifiedReferenceSearch"` — removed
- `import { getReleasesForMoldAction } from "@/app/actions/reference"` — if only used for cascade

### Add:
- `selectedCatalogId` state variable (1 line)
- Updated `UnifiedReferenceSearch` props: `<UnifiedReferenceSearch selectedCatalogId={selectedCatalogId} onCatalogSelect={(id) => setSelectedCatalogId(id)} />`

### Update `createHorseRecord()` call:
```typescript
// BEFORE:
selectedMoldId: selectedMoldId || undefined,
selectedResinId: selectedResinId || undefined,
selectedReleaseId: selectedReleaseId || undefined,

// AFTER:
catalogId: selectedCatalogId || undefined,
```

### Update status badges:
```typescript
// BEFORE: {selectedMoldId ? "Mold" : "Resin"} selected
// AFTER:  "Reference linked" or display the item title
```

### Update `notifyHorsePublic()` call:
```typescript
// BEFORE: moldId: selectedMoldId || null, releaseId: selectedReleaseId || null
// AFTER:  catalogId: selectedCatalogId || null
```

---

## Task 3 — Update `stable/[id]/edit/page.tsx`

**File:** `src/app/stable/[id]/edit/page.tsx`

### Similar changes as Task 2, plus:

#### Load existing data:
```typescript
// BEFORE: reads reference_mold_id, artist_resin_id, release_id from user_horses
// AFTER:  reads catalog_id from user_horses

const { data: horse } = await supabase
    .from("user_horses")
    .select("id, owner_id, custom_name, ..., catalog_id, ...")  // remove reference_mold_id, artist_resin_id, release_id
```

#### Pre-fill search:
```typescript
// BEFORE: if (horse.reference_mold_id) { setSelectedMoldId(...); setDefaultTab("mold"); }
// AFTER:  if (horse.catalog_id) { setSelectedCatalogId(horse.catalog_id); }
```

#### Save handler:
```typescript
// BEFORE: reference_mold_id: selectedMoldId, artist_resin_id: selectedResinId, release_id: selectedReleaseId, catalog_id: ...
// AFTER:  catalog_id: selectedCatalogId
```

### Remove:
- `selectedMoldId`, `selectedResinId`, `selectedReleaseId` state
- `releases`, `loadingReleases`, `defaultTab` state
- Release cascade `useEffect`
- `import type { ReleaseDetail }` 
- `import { getReleasesForMoldAction }` (if no longer needed)

---

## Task 4 — Update `horse.ts` Server Action

**File:** `src/app/actions/horse.ts`

### `updateHorseAction()`:
```typescript
// BEFORE whitelist:
'reference_mold_id', 'artist_resin_id', 'release_id', 'catalog_id'

// AFTER whitelist:
'catalog_id'   // Single FK
```

### `createHorseRecord()`:
```typescript
// BEFORE: sets horseInsert.reference_mold_id, horseInsert.artist_resin_id, horseInsert.release_id + dual-write catalog_id
// AFTER:  sets horseInsert.catalog_id only

if (data.catalogId) {
    horseInsert.catalog_id = data.catalogId;
}
// DELETE the selectedMoldId / selectedResinId / selectedReleaseId blocks
```

### Update the function signature's `data` parameter:
```typescript
// BEFORE: selectedMoldId?: string, selectedResinId?: string, selectedReleaseId?: string
// AFTER:  catalogId?: string
```

---

## Task 5 — Update `csv-import.ts`

**File:** `src/app/actions/csv-import.ts`

### Remove legacy FK mapping:
```typescript
// BEFORE: reference_mold_id: null, artist_resin_id: null,
// AFTER:  (remove these lines — only catalog_id used)

// BEFORE: horse.reference_mold_id = row.selectedMatch.id; ...
// AFTER:  horse.catalog_id = row.selectedMatch.id;
```

---

## Task 6 — Update `help-id.ts`

**File:** `src/app/actions/help-id.ts`

### `createSuggestion()`:
```typescript
// BEFORE: artist_resin_id: data.artistResinId || null,
// AFTER:  catalog_id: data.catalogId || null
```

### `addIdentifiedHorse()` (the function that accepts a Help ID suggestion):
```typescript
// BEFORE: reads s.reference_release_id, s.artist_resin_id from the suggestion
//         sets horseInsert.reference_mold_id, horseInsert.artist_resin_id
// AFTER:  reads s.catalog_id
//         sets horseInsert.catalog_id = s.catalog_id
```

### `getSuggestionsForRequest()`:
```typescript
// BEFORE: joins reference_releases:reference_release_id(...), artist_resins:artist_resin_id(...)
// AFTER:  joins catalog_items:catalog_id(id, title, maker, item_type)
```

---

## Task 7 — Update `wishlist.ts` & `WishlistSearch.tsx` & `wishlist/page.tsx`

### `wishlist.ts`:
```typescript
// BEFORE: addToWishlist(moldId, releaseId, notes)
// AFTER:  addToWishlist(catalogId, notes)

// BEFORE insert: mold_id: moldId || null, release_id: releaseId || null, catalog_id: ...
// AFTER insert:  catalog_id: catalogId || null
```

### `WishlistSearch.tsx`:
```typescript
// BEFORE: imports from("reference_molds") to search for wishlist items
// AFTER:  uses searchCatalogAction from reference.ts
```

### `wishlist/page.tsx`:
```typescript
// BEFORE: reads mold_id, release_id from user_wishlists
//         joins reference_molds, reference_releases for display
//         matches against user_horses.reference_mold_id, release_id
// AFTER:  reads catalog_id from user_wishlists
//         joins catalog_items for display
//         matches against user_horses.catalog_id
```

---

## Task 8 — Update Remaining Legacy Queries

### `community/page.tsx`:
```typescript
// BEFORE: SELECT ... reference_mold_id, release_id ...
//         LEFT JOIN reference_molds, reference_releases
// AFTER:  SELECT ... catalog_id ...
//         LEFT JOIN catalog_items ON catalog_items.id = user_horses.catalog_id
```

### `community/help-id/[id]/page.tsx`:
```typescript
// BEFORE: .from("artist_resins") for display
// AFTER:  .from("catalog_items") WHERE item_type = 'artist_resin'
```

### `api/identify-mold/route.ts`:
```typescript
// BEFORE: .from("reference_molds") for AI mold identification
// AFTER:  .from("catalog_items") WHERE item_type IN ('plastic_mold', 'plastic_release')
```

### `api/reference-dictionary/route.ts`:
```typescript
// BEFORE: .from("artist_resins") for the dictionary
// AFTER:  .from("catalog_items") filtered by type
```

### `actions/suggestions.ts`:
```typescript
// BEFORE: reads from reference_molds for suggestion matching
// AFTER:  reads from catalog_items
```

---

## Task 9 — Purge Legacy Types & Shims

### `src/lib/types/database.ts`:

**Delete these interfaces:**
- `ReferenceMold` (lines 38-44)
- `ReferenceRelease` (lines 46-54)
- `ArtistResin` (lines 56-62)
- `HorseComment` (lines 134-140)
- `UserRating` (lines 171-179)
- `PhotoShow` (lines 220-230)
- `ShowEntry` (lines 232-239)
- `ShowVote` (lines 241-246)

**Delete from `UserHorse` interface:**
- `reference_mold_id` (line 67)
- `artist_resin_id` (line 68)
- `release_id` (line 69)

**Add to `UserHorse` interface:**
- `catalog_id: string | null;`

**Delete from `UserWishlist` interface:**
- `mold_id` (line 121)
- `release_id` (line 122)

**Add to `UserWishlist` interface:**
- `catalog_id: string | null;`

**Delete from `Database.Tables`:**
- `reference_molds` entry (lines 264-269)
- `artist_resins` entry (lines 270-275)
- `reference_releases` entry (lines 276-281)
- `horse_comments` entry (lines 348-356)
- `user_ratings` entry (lines 376-384)
- `photo_shows` entry (lines 422-431)
- `show_entries` entry (lines 432-441)
- `show_votes` entry (lines 442-450)

**Add to `Database.Tables`:**
- `catalog_items` entry
- `posts` entry
- `likes` entry
- `reviews` entry
- `transactions` entry
- `events` / `event_entries` / `event_votes` entries
- `v_horse_hoofprint` view entry

### `src/app/actions/reference.ts`:

**Delete legacy shim functions:**
- `getMoldDetailAction()` (line 108-110)
- `getResinDetailAction()` (line 112-114)
- `getReleasesForMoldAction()` (lines 116-128)
- `searchReferencesAction()` (lines 130-171)

**Keep:**
- `searchCatalogAction()`
- `getCatalogItem()`
- `getReleasesForMold()`
- `CatalogItem` interface
- `mapCatalogRow()` helper

### Dead code files to audit:
- `src/app/actions/social.ts` — if it still references `horse_comments`, delete or rewrite
- `src/app/actions/shows.ts` — if it still references `photo_shows`, delete or rewrite

---

## Task 10 — Migration 052: Drop Legacy Tables & Columns

> ⚠️ **HUMAN REVIEW REQUIRED** before applying.
> **Only run AFTER Tasks 1-9 are complete and `npx next build` passes.**

Create `supabase/migrations/052_the_great_purge.sql`:

```sql
-- ============================================================
-- Migration 052: The Great Purge (Ecosystem Expansion — Epic 1)
-- Drop all legacy tables and columns after code migration
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: DROP LEGACY FK COLUMNS FROM user_horses
-- ══════════════════════════════════════════════════════════════

ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS horse_reference_check;
ALTER TABLE user_horses DROP COLUMN IF EXISTS reference_mold_id;
ALTER TABLE user_horses DROP COLUMN IF EXISTS artist_resin_id;
ALTER TABLE user_horses DROP COLUMN IF EXISTS release_id;

-- ══════════════════════════════════════════════════════════════
-- STEP 2: DROP LEGACY FK COLUMNS FROM user_wishlists
-- ══════════════════════════════════════════════════════════════

ALTER TABLE user_wishlists DROP COLUMN IF EXISTS mold_id;
ALTER TABLE user_wishlists DROP COLUMN IF EXISTS release_id;

-- ══════════════════════════════════════════════════════════════
-- STEP 3: DROP LEGACY FK COLUMNS FROM id_suggestions
-- ══════════════════════════════════════════════════════════════

ALTER TABLE id_suggestions DROP COLUMN IF EXISTS reference_release_id;
ALTER TABLE id_suggestions DROP COLUMN IF EXISTS artist_resin_id;

-- ══════════════════════════════════════════════════════════════
-- STEP 4: DROP LEGACY CATALOG TABLES
-- ══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS reference_releases CASCADE;
DROP TABLE IF EXISTS reference_molds CASCADE;
DROP TABLE IF EXISTS artist_resins CASCADE;

-- ══════════════════════════════════════════════════════════════
-- STEP 5: DROP LEGACY SOCIAL/COMPETITION TABLES
-- (These were replaced in Phases 1-3 of Grand Unification)
-- ══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS horse_comments CASCADE;
DROP TABLE IF EXISTS group_posts CASCADE;
DROP TABLE IF EXISTS group_post_replies CASCADE;
DROP TABLE IF EXISTS user_ratings CASCADE;
DROP TABLE IF EXISTS photo_shows CASCADE;
DROP TABLE IF EXISTS show_entries CASCADE;
DROP TABLE IF EXISTS show_votes CASCADE;

-- ══════════════════════════════════════════════════════════════
-- STEP 6: DROP horse_timeline (if not already dropped)
-- ══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS horse_timeline CASCADE;

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION (run manually)
-- ══════════════════════════════════════════════════════════════
-- Confirm no tables remain:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--   'reference_molds', 'reference_releases', 'artist_resins',
--   'horse_comments', 'group_posts', 'group_post_replies',
--   'user_ratings', 'photo_shows', 'show_entries', 'show_votes',
--   'horse_timeline'
-- );
-- Expected: 0 rows

-- Confirm no legacy columns remain:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'user_horses'
-- AND column_name IN ('reference_mold_id', 'artist_resin_id', 'release_id');
-- Expected: 0 rows
```

---

## Completion Checklist

**Components**
- [x] `UnifiedReferenceSearch.tsx` rewritten — single search bar, no tabs, uses `CatalogItem`
- [x] `WishlistSearch.tsx` uses `searchCatalogAction` instead of `reference_molds`

**Pages**
- [x] `add-horse/page.tsx` — single `selectedCatalogId` state, no mold/resin/release
- [x] `stable/[id]/edit/page.tsx` — reads/writes `catalog_id` only
- [x] `community/page.tsx` — joins `catalog_items` instead of legacy tables
- [x] `community/help-id/[id]/page.tsx` — reads from `catalog_items`
- [x] `wishlist/page.tsx` — reads `catalog_id`, joins `catalog_items`

**Server Actions**
- [x] `horse.ts` — `createHorseRecord()` accepts `catalogId`, no legacy FKs
- [x] `horse.ts` — `updateHorseAction()` whitelist has `catalog_id` only (no legacy)
- [x] `csv-import.ts` — writes `catalog_id` only
- [x] `help-id.ts` — writes `catalog_id`, joins `catalog_items`
- [x] `wishlist.ts` — `addToWishlist(catalogId, notes)`
- [x] `reference.ts` — legacy shims deleted (`searchReferencesAction`, etc.)
- [x] `suggestions.ts` — reads from `catalog_items`

**API Routes**
- [x] `api/identify-mold/route.ts` — reads from `catalog_items`
- [x] `api/reference-dictionary/route.ts` — reads from `catalog_items`

**Types**
- [x] `database.ts` — legacy interfaces deleted (ReferenceMold, ReferenceRelease, ArtistResin, HorseComment, UserRating, PhotoShow, ShowEntry, ShowVote)
- [x] `database.ts` — `UserHorse` uses `catalog_id` (no legacy FKs)
- [x] `database.ts` — `UserWishlist` uses `catalog_id` (no legacy FKs)
- [x] `database.ts` — `Database.Tables` cleaned of legacy table entries
- [x] `database.ts` — new unified table entries added (catalog_items, posts, likes, etc.)

**Dead Code**
- [x] `social.ts` — dead `horse_comments` code removed (recreated with only toggleFavorite)
- [ ] `shows.ts` — dead `photo_shows` code removed (comment only — not blocking)
- [ ] `groups.ts` — dead `group_posts` code removed (still used by groups pages — separate refactor)

**Build & Verification**
- [x] `npx next build` — 0 errors
- [x] `grep -rn "reference_mold_id\|artist_resin_id\|release_id" src/` — 0 results
- [ ] `grep -rn "horse_comments\|group_posts\|photo_shows\|show_entries\|user_ratings" src/` — groups.ts still has group_posts
- [x] `grep -rn "getMoldDetailAction\|getResinDetailAction\|searchReferencesAction\|getReleasesForMoldAction" src/` — 0 results (only in comments)

**Schema Drop**
- [x] Migration 052 written (`052_the_great_purge.sql`)
- [x] Human reviewed and approved SQL
- [x] Migration applied to production (March 11, 2026)
- [ ] Verification queries confirm 0 legacy tables/columns remain

**Estimated effort:** ~8-10 hours
