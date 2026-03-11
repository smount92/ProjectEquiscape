---
description: Phase 4 — Universal Catalog. Merge `reference_molds`, `reference_releases`, `artist_resins` into `catalog_items`. Single polymorphic reference table for 10,500+ models. Future-proofs for tack, medallions, vintage.
---

# Phase 4: Universal Catalog

> **Grand Unification Plan — Phase 4 of 5**
> **Pre-requisites:** Phase 3 complete. Migrations 001–046 applied, build clean.
> **Iron Laws in effect:**
> - Zero Data Loss — all 10,500+ catalog items must survive
> - Single `catalog_id` FK on `user_horses` replaces 3 separate FKs
> - Search must remain fast — fuzzy match "Breyer #700195" in <100ms

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

## The Problem

Searching for a horse requires branching logic across **three separate tables**:

| Table | Count | What It Stores |
|---|---|---|
| `reference_molds` | ~500 | Base mold sculpts (Breyer, Stone, etc.) |
| `reference_releases` | ~1,000 | Specific paint jobs linked to molds |
| `artist_resins` | ~9,000+ | ERD artist resin sculpts |

This means:
1. ❌ `searchReferencesAction()` has a `tab` parameter and runs 2–3 queries depending on which tab is active.
2. ❌ `user_horses` has **3 nullable FKs**: `reference_mold_id`, `artist_resin_id`, `release_id` with a CHECK constraint.
3. ❌ `UnifiedReferenceSearch.tsx` has tab-switching logic with separate result rendering for molds vs resins.
4. ❌ Adding new model types (tack, medallions, vintage) would require yet another FK and more branching.
5. ❌ `user_wishlists` also has `mold_id` and `release_id` FKs into the legacy tables.
6. ❌ `help_requests` has separate `reference_release_id` and `artist_resin_id` FKs.

## The Solution

One polymorphic `catalog_items` table. Each row has an `item_type` and a `parent_id` (for release→mold hierarchy). One FK on `user_horses`: `catalog_id`.

---

## What We're Replacing

| Legacy Table | Destination |
|---|---|
| `reference_molds` | `catalog_items` where `item_type = 'plastic_mold'` |
| `reference_releases` | `catalog_items` where `item_type = 'plastic_release'` with `parent_id` → mold |
| `artist_resins` | `catalog_items` where `item_type = 'artist_resin'` |

**Tables being altered:**
- `user_horses` — drop `reference_mold_id`, `artist_resin_id`, `release_id`; add `catalog_id`
- `user_wishlists` — drop `mold_id`, `release_id`; add `catalog_id`
- `help_requests` — drop `reference_release_id`, `artist_resin_id`; add `catalog_id`

---

## Task 1 — Migration 048: Universal Catalog

> ⚠️ **HUMAN REVIEW REQUIRED** before applying this migration.

Create `supabase/migrations/048_universal_catalog.sql`:

```sql
-- ============================================================
-- Migration 048: Universal Catalog (Phase 4)
-- Grand Unification Plan — Single polymorphic reference table
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: CREATE CATALOG_ITEMS TABLE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS catalog_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type     TEXT NOT NULL CHECK (item_type IN (
    'plastic_mold',       -- Base sculpt (was reference_molds)
    'plastic_release',    -- Specific paint job (was reference_releases)
    'artist_resin',       -- Artist resin sculpt (was artist_resins)
    'tack',               -- Future: tack sets
    'medallion',          -- Future: medallions
    'micro_mini'          -- Future: micro/mini/stablemate
  )),
  parent_id     UUID REFERENCES catalog_items(id) ON DELETE SET NULL,
  -- For releases: points to the mold. For others: NULL.
  
  -- Universal fields
  title         TEXT NOT NULL,
  -- For molds: mold_name. For releases: release_name. For resins: resin_name.
  maker         TEXT NOT NULL,
  -- For molds/releases: manufacturer (Breyer, Stone). For resins: sculptor_alias.
  scale         TEXT,
  -- Traditional, Classic, Stablemate, etc.
  
  -- Type-specific attributes stored in JSONB
  attributes    JSONB DEFAULT '{}',
  -- For molds:    { release_year_start }
  -- For releases: { model_number, color_description, release_year_start, release_year_end }
  -- For resins:   { cast_medium }
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

-- Read-only for all authenticated users (immutable reference data)
CREATE POLICY "catalog_items_select" ON catalog_items FOR SELECT
TO authenticated USING (true);

-- No INSERT/UPDATE/DELETE for regular users — admin/service role only

-- ══════════════════════════════════════════════════════════════
-- STEP 2: INDEXES
-- ══════════════════════════════════════════════════════════════

-- Search index (fuzzy matching on title + maker)
CREATE INDEX idx_catalog_items_title ON catalog_items USING gin (title gin_trgm_ops);
CREATE INDEX idx_catalog_items_maker ON catalog_items USING gin (maker gin_trgm_ops);

-- Type-based filtering
CREATE INDEX idx_catalog_items_type ON catalog_items (item_type);

-- Parent lookups (releases for a mold)
CREATE INDEX idx_catalog_items_parent ON catalog_items (parent_id) WHERE parent_id IS NOT NULL;

-- Composite: for searching within a type
CREATE INDEX idx_catalog_items_type_title ON catalog_items (item_type, title);

-- ══════════════════════════════════════════════════════════════
-- STEP 3: DATA MIGRATION (Zero Data Loss)
-- ══════════════════════════════════════════════════════════════

-- 3a: Migrate reference_molds → catalog_items
-- PRESERVE original UUIDs so FKs stay intact during transition
INSERT INTO catalog_items (id, item_type, title, maker, scale, attributes, created_at)
SELECT
  rm.id,
  'plastic_mold',
  rm.mold_name,
  rm.manufacturer,
  rm.scale,
  jsonb_build_object('release_year_start', rm.release_year_start),
  now()
FROM reference_molds rm
ON CONFLICT (id) DO NOTHING;

-- 3b: Migrate reference_releases → catalog_items
-- parent_id = mold's UUID (which is now also a catalog_items UUID)
INSERT INTO catalog_items (id, item_type, parent_id, title, maker, scale, attributes, created_at)
SELECT
  rr.id,
  'plastic_release',
  rr.mold_id,                  -- parent_id = the mold (same UUID in catalog_items)
  rr.release_name,
  rm.manufacturer,             -- releases inherit manufacturer from their mold
  jsonb_build_object(
    'model_number', rr.model_number,
    'color_description', rr.color_description,
    'release_year_start', rr.release_year_start,
    'release_year_end', rr.release_year_end
  ),
  now()
FROM reference_releases rr
JOIN reference_molds rm ON rm.id = rr.mold_id
ON CONFLICT (id) DO NOTHING;

-- 3c: Migrate artist_resins → catalog_items
INSERT INTO catalog_items (id, item_type, title, maker, scale, attributes, created_at)
SELECT
  ar.id,
  'artist_resin',
  ar.resin_name,
  ar.sculptor_alias,
  ar.scale,
  jsonb_build_object('cast_medium', ar.cast_medium),
  now()
FROM artist_resins ar
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════
-- STEP 4: ADD catalog_id TO REFERENCING TABLES
-- ══════════════════════════════════════════════════════════════

-- 4a: user_horses
ALTER TABLE user_horses ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_horses_catalog ON user_horses (catalog_id) WHERE catalog_id IS NOT NULL;

-- Populate catalog_id from existing FKs
-- Priority: release_id > reference_mold_id > artist_resin_id
UPDATE user_horses SET catalog_id = release_id WHERE release_id IS NOT NULL AND catalog_id IS NULL;
UPDATE user_horses SET catalog_id = reference_mold_id WHERE reference_mold_id IS NOT NULL AND catalog_id IS NULL;
UPDATE user_horses SET catalog_id = artist_resin_id WHERE artist_resin_id IS NOT NULL AND catalog_id IS NULL;

-- 4b: user_wishlists
ALTER TABLE user_wishlists ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL;

UPDATE user_wishlists SET catalog_id = release_id WHERE release_id IS NOT NULL AND catalog_id IS NULL;
UPDATE user_wishlists SET catalog_id = mold_id WHERE mold_id IS NOT NULL AND catalog_id IS NULL;

-- 4c: help_requests
ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES catalog_items(id) ON DELETE SET NULL;

UPDATE help_requests SET catalog_id = reference_release_id WHERE reference_release_id IS NOT NULL AND catalog_id IS NULL;
UPDATE help_requests SET catalog_id = artist_resin_id WHERE artist_resin_id IS NOT NULL AND catalog_id IS NULL;

-- ══════════════════════════════════════════════════════════════
-- STEP 5: VERIFICATION (run manually)
-- ══════════════════════════════════════════════════════════════
-- SELECT 'reference_molds' AS source, count(*) FROM reference_molds
-- UNION ALL SELECT 'catalog (plastic_mold)', count(*) FROM catalog_items WHERE item_type = 'plastic_mold'
-- UNION ALL SELECT 'reference_releases', count(*) FROM reference_releases
-- UNION ALL SELECT 'catalog (plastic_release)', count(*) FROM catalog_items WHERE item_type = 'plastic_release'
-- UNION ALL SELECT 'artist_resins', count(*) FROM artist_resins
-- UNION ALL SELECT 'catalog (artist_resin)', count(*) FROM catalog_items WHERE item_type = 'artist_resin'
-- UNION ALL SELECT 'user_horses with catalog_id', count(*) FROM user_horses WHERE catalog_id IS NOT NULL
-- UNION ALL SELECT 'user_horses with old FKs', count(*) FROM user_horses WHERE reference_mold_id IS NOT NULL OR artist_resin_id IS NOT NULL OR release_id IS NOT NULL;
-- Last two counts should match.

-- ══════════════════════════════════════════════════════════════
-- STEP 6: DROP OLD COLUMNS — separate migration 049 AFTER code migrated
-- ══════════════════════════════════════════════════════════════
-- ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS horse_reference_check;
-- ALTER TABLE user_horses DROP COLUMN IF EXISTS reference_mold_id;
-- ALTER TABLE user_horses DROP COLUMN IF EXISTS artist_resin_id;
-- ALTER TABLE user_horses DROP COLUMN IF EXISTS release_id;
-- ALTER TABLE user_wishlists DROP COLUMN IF EXISTS mold_id;
-- ALTER TABLE user_wishlists DROP COLUMN IF EXISTS release_id;
-- ALTER TABLE help_requests DROP COLUMN IF EXISTS reference_release_id;
-- ALTER TABLE help_requests DROP COLUMN IF EXISTS artist_resin_id;
-- DROP TABLE IF EXISTS reference_releases CASCADE;
-- DROP TABLE IF EXISTS reference_molds CASCADE;
-- DROP TABLE IF EXISTS artist_resins CASCADE;
```

**Action:** Write this file. **DO NOT apply yet** — wait for human review.

**Key design decisions:**
- **UUIDs preserved.** Molds, releases, and resins keep their original UUIDs as `catalog_items.id`. This means the transition is seamless — `user_horses.catalog_id` points to the same UUID that `release_id` or `reference_mold_id` pointed to. No mapping table needed.
- **`parent_id` self-reference.** Releases point to their mold via `parent_id`. This keeps the mold→release hierarchy intact.
- **`attributes JSONB`** stores type-specific data (model_number, color_description, cast_medium) without column sprawl. Common fields (title, maker, scale) are promoted to columns for indexing.
- **Trigram indexes** (`gin_trgm_ops`) enable fast fuzzy search. Requires `pg_trgm` extension (usually enabled on Supabase by default — verify before migration).
- **Priority order** for populating `catalog_id`: release (most specific) > mold > resin.

---

## Task 2 — Server Actions: Unified Catalog Search

Refactor `src/app/actions/reference.ts`:

### Functions to update:

```typescript
// ── searchReferencesAction(query) ──
// REMOVE the `tab` parameter. Search a single table:
//   SELECT * FROM catalog_items
//   WHERE title ILIKE '%query%' OR maker ILIKE '%query%'
//     OR attributes->>'model_number' ILIKE '%query%'
//   ORDER BY item_type, title
//   LIMIT 50;
//
// Return shape: { items: CatalogItem[] }
// CatalogItem = { id, itemType, parentId, title, maker, scale, attributes }

// ── getCatalogItem(id) ──
// Replaces getMoldDetailAction() and getResinDetailAction().
// Single query: SELECT * FROM catalog_items WHERE id = ?

// ── getReleasesForMold(moldId) ──
// Replaces getReleasesForMoldAction().
// SELECT * FROM catalog_items WHERE parent_id = moldId AND item_type = 'plastic_release'

// ── Legacy shims ──
// getMoldDetailAction(id) → getCatalogItem(id)
// getResinDetailAction(id) → getCatalogItem(id)
// getReleasesForMoldAction(moldId) → getReleasesForMold(moldId)
```

---

## Task 3 — Refactor UnifiedReferenceSearch.tsx

Currently has tab logic (`mold` | `resin`) with separate result components.

### Changes:
1. **Remove tabs.** Single search bar queries all catalog items.
2. **Unified result cards.** Each result shows type badge + title + maker.
3. **Cascading select still works:** Clicking a mold shows its releases via `getReleasesForMold()`.
4. **Selection callback** returns `catalogId` instead of `moldId` / `resinId` / `releaseId`.

### Component signature:
```typescript
// Before:
onMoldSelect(moldId: string, releaseId?: string): void
onResinSelect(resinId: string): void

// After:
onSelect(catalogId: string, catalogItem: CatalogItem): void
```

---

## Task 4 — Update Add Horse & Edit Horse Forms

### `src/app/add-horse/page.tsx`
- Replace `reference_mold_id`, `artist_resin_id`, `release_id` form state with single `catalog_id`.
- `UnifiedReferenceSearch` passes `catalogId` to form.
- Insert: `{ catalog_id: selectedCatalogId }` instead of the three separate FKs.

### `src/app/stable/[id]/edit/page.tsx`
- Same changes. Pre-fill the search from the horse's current `catalog_id`.

### `src/app/actions/horses.ts` (or wherever horse creation is)
- Change insert/update to use `catalog_id` instead of the three FKs.
- Verify the batch import RPC (`023_batch_import_rpc.sql`) is updated if it's called directly.

---

## Task 5 — Update Passport & Display Pages

Any page that displays a horse's reference info (mold name, release, sculptor) currently joins across `reference_molds` / `reference_releases` / `artist_resins`. 

### Change to:
```sql
-- Single join:
user_horses
  LEFT JOIN catalog_items AS catalog ON catalog.id = user_horses.catalog_id
  LEFT JOIN catalog_items AS parent_catalog ON parent_catalog.id = catalog.parent_id
```

This gives you:
- `catalog.title` = release name or resin name
- `catalog.maker` = manufacturer or sculptor
- `parent_catalog.title` = mold name (for releases)
- `catalog.attributes->>'model_number'` = model number

### Pages/components affected:
- Horse passport (`/community/[id]`)
- Dashboard horse cards
- Parked export / CoA generation
- Insurance report
- Help ID form
- Any component displaying "Mold: X, Release: Y"

---

## Task 6 — Update Wishlists & Help ID

### `user_wishlists`
- Server actions read/write `catalog_id` instead of `mold_id` / `release_id`.
- Wishlist display joins `catalog_items` instead of `reference_molds` / `reference_releases`.

### `help_requests`
- Server actions read/write `catalog_id` instead of `reference_release_id` / `artist_resin_id`.
- Help ID display joins `catalog_items`.

---

## Task 7 — Update Batch Import

The batch import RPC (`023_batch_import_rpc.sql`) currently accepts `release_id` and `reference_mold_id`. 

### Options:
- **Option A (Recommended):** Update the RPC to accept `catalog_id` instead. The CSV import logic in the app maps mold/release names → `catalog_id` before calling the RPC.
- **Option B:** Leave the RPC as-is during transition, using the legacy columns that are still present. Drop via migration 049 later.

---

## Task 8 — Cleanup & Verification

1. Run `npx next build` — must be 0 errors.
2. Run the verification queries from Step 5 of the migration.
3. Confirm:
   - Search works across all item types in a single query.
   - Adding a horse with a mold reference → `catalog_id` populated correctly.
   - Adding a horse with a resin → `catalog_id` populated correctly.
   - Horse passport displays mold/release/resin info via `catalog_items`.
   - Wishlists work with `catalog_id`.
   - Help ID requests work with `catalog_id`.
   - Batch CSV import still works.
4. No code should reference `reference_mold_id`, `artist_resin_id`, or `release_id` directly (except the batch import RPC if using Option B).

---

## Task 9 — Legacy Table/Column Drop (Migration 049)

**Only AFTER all code reads from `catalog_items`:**

Create `supabase/migrations/049_drop_legacy_catalog.sql`:
```sql
-- Drop old FKs
ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS horse_reference_check;
ALTER TABLE user_horses DROP COLUMN IF EXISTS reference_mold_id;
ALTER TABLE user_horses DROP COLUMN IF EXISTS artist_resin_id;
ALTER TABLE user_horses DROP COLUMN IF EXISTS release_id;
ALTER TABLE user_wishlists DROP COLUMN IF EXISTS mold_id;
ALTER TABLE user_wishlists DROP COLUMN IF EXISTS release_id;
ALTER TABLE help_requests DROP COLUMN IF EXISTS reference_release_id;
ALTER TABLE help_requests DROP COLUMN IF EXISTS artist_resin_id;

-- Drop legacy tables
DROP TABLE IF EXISTS reference_releases CASCADE;
DROP TABLE IF EXISTS reference_molds CASCADE;
DROP TABLE IF EXISTS artist_resins CASCADE;
```

---

## Completion Checklist

**Schema & Migration**
- [ ] Migration 048 written (`048_universal_catalog.sql`)
- [ ] Verified `pg_trgm` extension is enabled on Supabase
- [ ] Human reviewed and approved SQL
- [ ] Migration applied to production
- [ ] Verification queries confirm 0 data loss (all 3 legacy counts match catalog counts)
- [ ] `user_horses.catalog_id` populated for all horses that had old FKs

**Server Actions**
- [ ] `reference.ts` refactored — `searchReferencesAction()` queries `catalog_items` (no tab param)
- [ ] `getCatalogItem()` replaces `getMoldDetailAction()` and `getResinDetailAction()`
- [ ] `getReleasesForMold()` queries `catalog_items WHERE parent_id = moldId`
- [ ] Horse create/update uses `catalog_id` instead of 3 FKs
- [ ] Wishlists use `catalog_id`
- [ ] Help ID uses `catalog_id`

**Components**
- [ ] `UnifiedReferenceSearch.tsx` — single search bar, no tabs, returns `catalogId`
- [ ] Add Horse form uses `catalog_id`
- [ ] Edit Horse form uses `catalog_id`

**Pages Wired**
- [ ] Horse passport displays reference via `catalog_items` join
- [ ] Dashboard horse cards show mold/resin info from `catalog_items`
- [ ] CoA / Insurance report join `catalog_items`
- [ ] Help ID form uses `catalog_id`
- [ ] Wishlist display joins `catalog_items`

**Cleanup**
- [ ] `npx next build` — 0 errors
- [ ] Search: "Breyer #700195" returns correct results in <100ms
- [ ] No code references `reference_mold_id`, `artist_resin_id`, or `release_id` (except batch import if deferred)
- [ ] Batch CSV import tested end-to-end

**DO NOT proceed to Phase 5 until this checklist is fully complete and human has verified.**

**Estimated effort:** ~14-20 hours (largest migration — 10,500+ items + FK rewiring)
