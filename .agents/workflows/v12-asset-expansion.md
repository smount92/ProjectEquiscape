---
description: Epic 2 — Universal Asset Expansion. Add tack, props, and dioramas to the inventory. Dynamic intake form with category toggle. Leverages polymorphic catalog_items.
---

# Epic 2: Universal Asset Expansion — Tack, Props & Dioramas

> **Ecosystem Expansion Plan — Epic 2 of 5**
> **Pre-requisites:** Epic 1 complete. Migration 052 applied. Zero legacy references.
> **Directive:** Expand the stable to support non-horse items. The polymorphic `catalog_items` table was designed for this — `item_type` CHECK already includes 'tack', 'medallion', 'micro_mini'. The UI must adapt dynamically.

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

Right now, `user_horses` only supports model horses. But collectors also own:
- **Tack & gear** — Saddles, bridles, blankets
- **Props** — Jumps, fencing, hay bales
- **Dioramas** — Full scene setups with backgrounds

These items:
1. ❌ Don't have a "Finish Type" (OF/Custom/Artist Resin)
2. ❌ Don't have a "Condition Grade" (what's "Mint" for a hay bale?)
3. ❌ Don't have "Life Stage" (blank/in_progress/completed/for_sale)
4. ❌ Don't have "Pedigree" (sire/dam)
5. ✅ DO have names, photos, marketplace status, and financial value
6. ✅ CAN be linked to `catalog_items` (tack, medallion types)

## The Solution

Add `asset_category` column to `user_horses`. Make horse-specific fields nullable. Update the intake/edit forms with a category toggle that conditionally shows/hides fields.

---

## Task 1 — Migration 053: Asset Category Schema

> ⚠️ **HUMAN REVIEW REQUIRED** before applying.

Create `supabase/migrations/053_asset_expansion.sql`:

```sql
-- ============================================================
-- Migration 053: Universal Asset Expansion (Epic 2)
-- Expand user_horses to support tack, props, and dioramas
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: ADD asset_category COLUMN
-- ══════════════════════════════════════════════════════════════

ALTER TABLE user_horses ADD COLUMN IF NOT EXISTS
  asset_category TEXT NOT NULL DEFAULT 'model'
  CHECK (asset_category IN ('model', 'tack', 'prop', 'diorama'));

CREATE INDEX IF NOT EXISTS idx_user_horses_asset_category
  ON user_horses (asset_category);

-- ══════════════════════════════════════════════════════════════
-- STEP 2: MAKE HORSE-SPECIFIC FIELDS NULLABLE
-- These fields are required for 'model' but optional for others.
-- Application logic enforces the requirement per category.
-- ══════════════════════════════════════════════════════════════

-- finish_type: currently NOT NULL with CHECK constraint
-- We need to drop the CHECK, alter to nullable, then re-add a looser CHECK
ALTER TABLE user_horses ALTER COLUMN finish_type DROP NOT NULL;

-- condition_grade: currently TEXT NOT NULL (default 'Mint')
ALTER TABLE user_horses ALTER COLUMN condition_grade DROP NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- STEP 3: ADD TACK/PROP-SPECIFIC CATALOG TYPES (if not present)
-- The CHECK constraint on catalog_items.item_type already allows
-- 'tack', 'medallion', 'micro_mini'. Add 'prop' and 'diorama':
-- ══════════════════════════════════════════════════════════════

-- Drop and recreate the CHECK with expanded types
ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_item_type_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_item_type_check
  CHECK (item_type IN (
    'plastic_mold',
    'plastic_release',
    'artist_resin',
    'tack',
    'medallion',
    'micro_mini',
    'prop',
    'diorama'
  ));

-- ══════════════════════════════════════════════════════════════
-- STEP 4: UPDATE v_horse_hoofprint VIEW
-- Add COALESCE guard for life_stage since tack/props don't have one
-- ══════════════════════════════════════════════════════════════

-- The existing view references uh.life_stage. We need to guard it:
-- Already uses COALESCE(uh.life_stage, 'completed') — no change needed.
-- Verify with: SELECT DISTINCT metadata->>'life_stage' FROM v_horse_hoofprint;

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION (run manually)
-- ══════════════════════════════════════════════════════════════
-- SELECT column_name, is_nullable FROM information_schema.columns
-- WHERE table_name = 'user_horses'
-- AND column_name IN ('finish_type', 'condition_grade', 'asset_category');
-- Expected:
--   finish_type     | YES
--   condition_grade  | YES
--   asset_category   | NO (has default 'model')
```

**Key design decisions:**
- **`asset_category` on `user_horses`**, not a separate table. These are all "items in a stable" — same ownership, photos, marketplace, and timeline system.
- **Application-level required fields**, not DB constraints. The DB allows NULL finish_type/condition_grade. The form enforces "required" only when `asset_category = 'model'`.
- **Default is `'model'`** — zero impact on existing data. All current horses automatically become `model` category.

---

## Task 2 — Update `horse.ts` Server Action

**File:** `src/app/actions/horse.ts`

### `createHorseRecord()`:

Add `assetCategory` to the function signature and insert:

```typescript
export async function createHorseRecord(data: {
    customName: string;
    finishType: string;          // Now optional for non-model categories
    conditionGrade?: string;
    isPublic: boolean;
    tradeStatus?: string;
    lifeStage?: string;
    catalogId?: string;
    selectedCollectionId?: string;
    sculptor?: string;
    finishingArtist?: string;
    editionNumber?: number;
    editionSize?: number;
    listingPrice?: number;
    marketplaceNotes?: string;
    purchasePrice?: number;
    purchaseDate?: string;
    estimatedValue?: number;
    insuranceNotes?: string;
    assetCategory?: string;  // NEW: 'model' | 'tack' | 'prop' | 'diorama'
}) {
    // ...
    const horseInsert: Record<string, unknown> = {
        owner_id: user.id,
        custom_name: data.customName.trim(),
        asset_category: data.assetCategory || 'model',
        // For non-model categories, these can be null
        finish_type: data.finishType || null,
        condition_grade: data.conditionGrade || null,
        is_public: data.isPublic,
        // ...rest same
    };
}
```

### `updateHorseAction()`:

Add `'asset_category'` to the `HORSE_ALLOWED` whitelist:

```typescript
const HORSE_ALLOWED = [
    'custom_name', 'sculptor', 'finishing_artist', 'finish_type',
    'condition_grade', 'is_public', 'trade_status', 'listing_price',
    'marketplace_notes', 'collection_id', 'catalog_id', 'life_stage',
    'edition_number', 'edition_size', 'asset_category',  // NEW
];
```

---

## Task 3 — Update `database.ts` Types

**File:** `src/lib/types/database.ts`

### Add `AssetCategory` type:
```typescript
export type AssetCategory = 'model' | 'tack' | 'prop' | 'diorama';
```

### Update `UserHorse` interface:
```typescript
export interface UserHorse {
    // ...existing fields...
    asset_category: AssetCategory;  // NEW
    finish_type: FinishType | null; // WAS: FinishType (now nullable)
    condition_grade: string | null; // WAS: string (now nullable)
}
```

---

## Task 4 — Update Add Horse Form (Dynamic Category Toggle)

**File:** `src/app/add-horse/page.tsx`

### Add category state:
```typescript
const [assetCategory, setAssetCategory] = useState<'model' | 'tack' | 'prop' | 'diorama'>('model');
```

### Add category toggle UI at the top of the form (before the stepper or as Step 0):

Insert a category toggle at the top, before/above the Photo Gallery step. This should be a visually prominent row of clickable cards:

```tsx
<div className="asset-category-toggle">
    {[
        { value: 'model', icon: '🐎', label: 'Model Horse' },
        { value: 'tack', icon: '🏇', label: 'Tack & Gear' },
        { value: 'prop', icon: '🌲', label: 'Prop' },
        { value: 'diorama', icon: '🎭', label: 'Diorama' },
    ].map((cat) => (
        <button
            key={cat.value}
            className={`category-card ${assetCategory === cat.value ? 'active' : ''}`}
            onClick={() => setAssetCategory(cat.value)}
        >
            <span className="category-icon">{cat.icon}</span>
            <span className="category-label">{cat.label}</span>
        </button>
    ))}
</div>
```

### Conditionally show/hide fields based on category:

**Always visible (all categories):**
- Photo Gallery (all angles)
- Custom Name
- Sculptor / Artist
- Finishing Artist
- UnifiedReferenceSearch (catalog link)
- Marketplace Status
- Community Visibility toggle
- Financial Vault

**Model-only fields (hide for tack/prop/diorama):**
- Finish Type (required for model, hidden for others)
- Condition Grade (required for model, hidden for others)
- Life Stage (model only)
- Edition Info (model only)
- Pedigree section (if it exists on this form)

### Update validation:
```typescript
const canProceedStep = (step: number): boolean => {
    switch (step) {
        case 2: // Identity step
            if (assetCategory === 'model') {
                return customName.trim().length > 0 && finishType !== "" && conditionGrade !== "";
            }
            return customName.trim().length > 0; // Only name required for non-model
        // ...rest same
    }
};
```

### Update submit:
```typescript
const result = await createHorseRecord({
    // ...existing fields...
    assetCategory,
    finishType: assetCategory === 'model' ? finishType : '',
    conditionGrade: assetCategory === 'model' ? conditionGrade : undefined,
});
```

### Update page header dynamically:
```typescript
// BEFORE: "Add to Stable" / "Catalog a new model horse"
// AFTER:
<h1>Add to <span className="text-gradient">Stable</span></h1>
<p>{assetCategory === 'model' ? 'Catalog a new model horse' :
    assetCategory === 'tack' ? 'Catalog tack & gear' :
    assetCategory === 'prop' ? 'Add a prop to your collection' :
    'Document a diorama setup'}</p>
```

---

## Task 5 — Update Edit Horse Form

**File:** `src/app/stable/[id]/edit/page.tsx`

### Load `asset_category` from DB:
```typescript
.select("id, owner_id, custom_name, ..., asset_category, ...")
```

### Add state and pre-fill:
```typescript
const [assetCategory, setAssetCategory] = useState<'model' | 'tack' | 'prop' | 'diorama'>('model');
// In loadHorse():
setAssetCategory(horse.asset_category || 'model');
```

### Same conditional field logic as Task 4.

### Category toggle on edit form:
Show the current category but allow changing it. If changing from `model` to `tack`, clear finish_type and condition_grade (with a confirm dialog).

### Save handler:
```typescript
const horseUpdate: Record<string, unknown> = {
    // ...existing fields...
    asset_category: assetCategory,
    finish_type: assetCategory === 'model' ? finishType : null,
    condition_grade: assetCategory === 'model' ? conditionGrade : null,
};
```

---

## Task 6 — Update Dashboard & Display Pages

### Dashboard (`src/app/dashboard/page.tsx` or similar):
- Show an icon badge on horse cards based on `asset_category`:
  - `model` → 🐎 (or no badge, since it's the default)
  - `tack` → 🏇
  - `prop` → 🌲
  - `diorama` → 🎭

### Horse Passport (`src/app/community/[id]/page.tsx` or `src/app/stable/[id]/page.tsx`):
- Hide "Finish Type" and "Condition Grade" sections if `asset_category !== 'model'`
- Show "Category: Tack & Gear" badge on the passport

### Community Page (`src/app/community/page.tsx`):
- Optional: Add a category filter dropdown to the Show Ring
- Horse cards should display the category badge

---

## Task 7 — CSS for Category Toggle

**File:** `src/app/globals.css` (or wherever component styles live)

Add styles for the category toggle:

```css
/* ── Asset Category Toggle ── */
.asset-category-toggle {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-xl);
}

.category-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-md) var(--space-sm);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface-elevated);
    cursor: pointer;
    transition: all 0.2s ease;
}

.category-card:hover {
    border-color: var(--color-accent-primary);
    transform: translateY(-2px);
}

.category-card.active {
    border-color: var(--color-accent-primary);
    background: rgba(var(--color-accent-primary-rgb), 0.1);
    box-shadow: 0 0 0 1px var(--color-accent-primary);
}

.category-icon {
    font-size: 1.5rem;
}

.category-label {
    font-size: calc(var(--font-size-sm) * var(--font-scale));
    font-weight: 600;
    color: var(--color-text-secondary);
}

.category-card.active .category-label {
    color: var(--color-accent-primary);
}

/* Responsive: stack on mobile */
@media (max-width: 480px) {
    .asset-category-toggle {
        flex-wrap: wrap;
    }
    .category-card {
        flex: 0 0 calc(50% - var(--space-xs));
    }
}
```

---

## Task 8 — Update CSV Import

**File:** `src/app/actions/csv-import.ts`

Add `asset_category` to the CSV import mapping. Default to `'model'` if not specified in the CSV.

```typescript
// In the horse insert object:
asset_category: row.assetCategory || 'model',
```

---

## Task 9 — Verification & Testing

1. Run `npx next build` — must be 0 errors.
2. Test:
   - Add a model horse → finish_type required, condition_grade required ✅
   - Add a tack item → finish_type hidden, condition_grade hidden ✅
   - Add a prop → same as tack ✅
   - Edit a model horse → category shows "Model Horse", can change to tack ✅
   - Dashboard shows category badges ✅
   - Passport hides model-specific fields for tack ✅
   - CSV import defaults to 'model' ✅
3. Check the `v_horse_hoofprint` view still works for non-model items.

---

## Completion Checklist

**Schema**
- [x] Migration 053 written (`053_asset_expansion.sql`)
- [x] Human reviewed and approved SQL
- [x] Migration applied to production (March 11, 2026)
- [x] `asset_category` column exists with default 'model'
- [x] `finish_type` is nullable
- [x] `condition_grade` is nullable
- [x] `catalog_items.item_type` CHECK includes 'prop' and 'diorama'

**Server Actions**
- [x] `horse.ts` — `createHorseRecord()` accepts `assetCategory`
- [x] `horse.ts` — `updateHorseAction()` whitelist includes `asset_category`
- [x] `csv-import.ts` — handles `asset_category`

**Types**
- [x] `database.ts` — `AssetCategory` type added
- [x] `database.ts` — `UserHorse.finish_type` nullable
- [x] `database.ts` — `UserHorse.condition_grade` nullable
- [x] `database.ts` — `UserHorse.asset_category` added

**Components & Pages**
- [x] Add Horse form — category toggle at top
- [x] Add Horse form — conditional field visibility
- [x] Add Horse form — validation adapts to category
- [x] Edit Horse form — loads & saves `asset_category`
- [x] Edit Horse form — conditional field visibility
- [x] Dashboard — category badge on cards
- [x] Passport — hides model-specific sections for non-model items (both public & private)
- [ ] Community page — category badge on cards (deferred — uses same StableGrid)

**CSS**
- [x] Category toggle styles added
- [x] Mobile responsive (2x2 grid on small screens)

**Build & Verification**
- [x] `npx next build` — 0 errors (March 11, 2026)
- [ ] Add model horse → finish_type required ✅
- [ ] Add tack item → finish_type hidden ✅
- [ ] `v_horse_hoofprint` works for non-model items

**Estimated effort:** ~4-6 hours
