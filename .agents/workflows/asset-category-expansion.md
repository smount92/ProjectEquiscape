---
description: Expand the Add-to-Stable flow with purpose-built fields for 5 asset categories (Model Horse, Tack, Prop, Diorama, Other Model). Shared field config, dynamic steps, conditional rendering across 14 surfaces.
---

# Asset Category Expansion — Purpose-Built Collection Forms

> **Context:** Beta tester Juanita reported that selecting "Tack & Gear" in the add flow asks the same horse-specific questions (breed, gender, age, finish type). This workflow implements category-aware forms with community-informed fields for each asset type.
> **Architecture docs:** See conversation artifacts `asset_category_deep_dive.md` and `asset_category_risks.md` for full field specs and risk analysis.

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.

**Scope:** 6 phases across ~14 affected surfaces. One DB migration (113). New shared field config system. Component extraction to prevent monolith growth. Category-specific form fields, gallery slots, and display logic.

**Palette constraint:** All new UI must use warm parchment palette. `bg-[#FEFCF8]` cards, `border-[#E0D5C1]` borders, Hunter Green `#2C5545` accent. Cold palette BANNED.

**Key decisions (locked):**
- Shared field config (not duplicated logic) for add + edit pages
- Hoofprint: YES for `model` + `other_model`, NO for `tack`/`prop`/`diorama`
- Insurance reports: include ALL categories, grouped with subtotals
- Digital County Fair: horse-only UI for now, but data model prepped with `non_horse` flag on `event_entries`
- Tack↔Horse cross-linking: V1 = text field, V2 = stable picker (future)
- Reference Link step: YES for `model` + `other_model`, SKIP for `tack`/`prop`/`diorama`
- Route stays `/add-horse` for SEO; visible label → "Add to Stable"
- Documentation card for dioramas: V1 = textarea with guidance

// turbo-all

---

## Pre-flight

Verify the current build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Check recent git history:

```
cd c:\Project Equispace\model-horse-hub && git log --oneline -5
```

Read master docs:

```
cd c:\Project Equispace\model-horse-hub && cat .agents/MASTER_BLUEPRINT.md
```

```
cd c:\Project Equispace\model-horse-hub && cat .agents/MASTER_SUPABASE.md
```

---

# Phase 1: Foundation — Type System & Field Config

## Task 1.1: DB Migration 113 — Add `other_model` to AssetCategory enum

**File:** `supabase/migrations/113_asset_category_other_model.sql`

Create this migration file. The migration adds `other_model` to the existing `asset_category` check constraint or enum on `user_horses`. Check the current constraint definition first.

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "supabase/migrations/*.sql" -Pattern "asset_category" | Select-Object -First 10
```

Write the migration SQL. It should:
1. Add `'other_model'` as a valid value for the `asset_category` column
2. Use `IF NOT EXISTS` guards for idempotency
3. **DO NOT run `supabase db push`** — present SQL for human review

**⚠️ HUMAN REVIEW REQUIRED before pushing migration.**

## Task 1.2: Update TypeScript type

**File:** `src/lib/types/database.ts` (line 28)

**Current:**
```typescript
export type AssetCategory = "model" | "tack" | "prop" | "diorama";
```

**Replace with:**
```typescript
export type AssetCategory = "model" | "tack" | "prop" | "diorama" | "other_model";
```

Also update `database.generated.ts` if it has a matching type.

## Task 1.3: Create shared field config

**File:** `src/lib/config/assetFields.ts` (NEW)

Create a field configuration module that both add and edit pages will consume. This is the **single source of truth** for which fields appear per category.

The config must define, for each `AssetCategory`:
- `label`: Display name (e.g., "Model Horse", "Tack & Gear")
- `icon`: Emoji icon
- `steps`: Array of step definitions (3 or 4 steps depending on category)
- `gallerySlots`: Array of `{ angle, label, primary? }` — category-specific photo slots
- `fields`: Object mapping field names to `{ visible: boolean, label: string, required: boolean }`
- `showReferenceStep`: boolean (true for `model` + `other_model` only)
- `showHoofprint`: boolean (true for `model` + `other_model` only)
- `showShowBio`: boolean (true for `model` only)

**Category-specific fields stored in `attributes` JSONB (no new columns needed):**

For **Tack**: `tack_type`, `discipline`, `materials` (string[]), `fits_molds`, `working_parts` (string[])
For **Props**: `prop_category`, `dimensions`, `terrain_setting`, `materials` (string[])
For **Dioramas**: `scene_theme`, `discipline`, `components`, `base_dimensions`, `documentation_notes`
For **Other Model**: `species`, `breed`, `manufacturer`, `model_number`

Export:
```typescript
export function getAssetConfig(category: AssetCategory): AssetConfig
export function getGallerySlots(category: AssetCategory): GallerySlot[]
export function getSteps(category: AssetCategory): StepDef[]
export function isFieldVisible(category: AssetCategory, fieldName: string): boolean
export function getFieldLabel(category: AssetCategory, fieldName: string): string
export function validateAttributes(category: AssetCategory, attrs: Record<string, unknown>): { valid: boolean; cleaned: Record<string, unknown> }
```

`validateAttributes()` ensures only known keys for the given category are stored, strips unexpected fields, and coerces types (e.g., `materials` must be `string[]`, not a bare string). Called in `createHorseRecord` and `updateHorseAction` before writing to DB.

**Dropdown value arrays to export (used by both add + edit forms):**

```typescript
export const TACK_TYPES = ["Saddle", "Bridle", "Halter", "Blanket/Sheet", "Boots/Wraps", "Breast Collar", "Girth/Cinch", "Harness Set", "Bit", "Reins", "Pad/Numnah", "Martingale", "Complete Set", "Other"] as const;

export const DISCIPLINES = ["Western", "English", "Dressage", "Jumping/Hunter", "Driving/Harness", "Racing", "Endurance", "Arabian/Native", "Costume", "Multi-Discipline", "Other"] as const;

export const MATERIALS = ["Real Leather", "Faux Leather", "Vinyl", "Metal Hardware", "Fabric", "Nylon", "Wire", "Mixed Media"] as const;

export const PROP_CATEGORIES = ["Fence/Gate", "Jump/Standard", "Arena Obstacle", "Trail Obstacle", "Barrel/Pole", "Building/Barn", "Vegetation/Trees", "Ground Cover/Base", "Water Feature", "Feed/Hay", "Vehicle/Trailer", "Sign/Banner", "Scenery/Backdrop", "Other"] as const;

export const TERRAIN_SETTINGS = ["Arena/Ring", "Pasture/Field", "Trail/Cross-Country", "Barn/Stable", "Ranch/Farm", "Show Grounds", "Other"] as const;

export const SCENE_THEMES = ["Performance Show", "Ranch/Farm", "Trail Ride", "Racing", "Parade/Costume", "Fantasy/Creative", "Historical", "Breeding Farm", "Veterinary/Farrier", "Other"] as const;

export const SPECIES_TYPES = ["Cattle", "Dog", "Cat", "Wildlife", "Rider/Doll", "Bird", "Fantasy Creature", "Other"] as const;

export const WORKING_PARTS = ["Working Buckles", "Removable Bit", "Adjustable Girth", "Working Stirrups"] as const;
```

### 1.3 Validation

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 1.5: Component Extraction (Prevent Monolith)

> **Rationale:** `add-horse/page.tsx` is already 1,684 lines. Adding 5 conditional branches + chip toggles would push it past 2,200. Extract reusable form sub-components now to keep the page as orchestration only and share components with the edit page.

## Task 1.5.1: Create `ChipToggle` component

**File:** `src/components/forms/ChipToggle.tsx` (NEW)

Reusable multi-select chip toggle. Used for Materials, Working Parts, and any future chip-based multi-select.

Props:
```typescript
interface ChipToggleProps {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  id: string;
}
```

**WCAG requirements (mandatory):**
- Each chip: `role="checkbox"`, `aria-checked={selected}`, `tabIndex={0}`
- Keyboard: `Space` toggles selection, `Tab` moves between chips
- Touch targets: minimum 44×44px (Simple Mode compatible at 130% font scale)
- Visual: selected = `border-forest bg-forest/5 text-forest font-semibold`, unselected = `border-stone-200 bg-white text-stone-600`
- Warm palette only — no `bg-white` on container (use `bg-[#FEFCF8]`)

## Task 1.5.2: Create per-category form field components

**Files (all NEW):**
```
src/components/forms/TackFormFields.tsx
src/components/forms/PropFormFields.tsx
src/components/forms/DioramaFormFields.tsx
src/components/forms/OtherModelFormFields.tsx
```

Each component:
- Receives state + setState handlers as props (controlled components)
- Imports dropdown arrays from `assetFields.ts`
- Uses `ChipToggle` for multi-select fields
- Uses shadcn/ui `<Input>`, `<Textarea>`, and native `<select>` (matching existing add-horse patterns)
- Renders ONLY the category-specific fields (not shared fields like Custom Name, Visibility, Trade Status)

Shared fields (Custom Name, Sculptor/Maker, Public Notes, Visibility, Trade Status, Vault) remain in the parent page.

## Task 1.5.3: Create `AssetDetailRenderer` component

**File:** `src/components/AssetDetailRenderer.tsx` (NEW)

Read-only display component for category-specific JSONB attributes. Used by:
- `stable/[id]/page.tsx` (owner view)
- `community/[id]/page.tsx` (public view)

Props:
```typescript
interface AssetDetailRendererProps {
  category: AssetCategory;
  attributes: Record<string, unknown>;
}
```

Renders labeled fields appropriate to the category. Example for tack: "Discipline: Western", "Materials: Real Leather, Metal Hardware", "Fits: Ideal Stock Horse, PS Arabian".

Style: warm palette card with `bg-[#FEFCF8] border-[#E0D5C1] rounded-lg p-4`.

### 1.5.3 Validation

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 2: Add Flow — Category-Specific Forms

## Task 2.1: Update the category toggle row

**File:** `src/app/add-horse/page.tsx` (lines 596-614)

Add the 5th category button (`other_model`) after `diorama`:
```typescript
{ value: "other_model" as const, icon: "🐄", label: "Other Model" },
```

## Task 2.2: Dynamic gallery slots

**File:** `src/app/add-horse/page.tsx`

Import `getGallerySlots` from the new config. Replace the static `GALLERY_SLOTS` constant with:
```typescript
const activeGallerySlots = getGallerySlots(assetCategory);
```

Use `activeGallerySlots` in the gallery rendering loop (line 717). The gallery slot labels should change when the user switches categories.

**Gallery slots per category:**

| Category | Slots |
|----------|-------|
| model | Near-Side (req), Off-Side, Front/Chest, Hindquarters, Belly/Mark |
| tack | Main View (req), Detail/Hardware, Maker's Mark, On-Model Fit |
| prop | Main View (req), Scale Reference, Detail, In-Use/Scene |
| diorama | Overview (req), Close-Up 1, Close-Up 2, Documentation Card |
| other_model | Main View (req), Side View, Detail, Maker's Mark |

## Task 2.3: Dynamic step flow

**File:** `src/app/add-horse/page.tsx`

Import `getSteps` from the config. Replace the static `STEPS` constant:
```typescript
const activeSteps = getSteps(assetCategory);
```

For `tack`, `prop`, `diorama`: 3 steps (Gallery → Details → Vault). No Reference step.
For `model`, `other_model`: 4 steps (Gallery → Reference → Identity → Vault).

Update the step indicator rendering and navigation (`goNext`, `goBack`) to use `activeSteps.length` instead of hardcoded `STEPS.length`.

## Task 2.4: Conditional field rendering — Identity/Details step

**File:** `src/app/add-horse/page.tsx` (Step 3, lines 1042-1500+)

Use the extracted components from Phase 1.5. Gate shared fields with `isFieldVisible()` / `getFieldLabel()` from the config. Then render the appropriate category sub-form:

```typescript
{assetCategory === "tack" && <TackFormFields ... />}
{assetCategory === "prop" && <PropFormFields ... />}
{assetCategory === "diorama" && <DioramaFormFields ... />}
{assetCategory === "other_model" && <OtherModelFormFields ... />}
```

**Shared fields to gate (remain in parent page):**

| Field | model | tack | prop | diorama | other_model |
|-------|-------|------|------|---------|-------------|
| Custom Name | ✅ | ✅ (label: "Item Name") | ✅ | ✅ (label: "Scene Name") | ✅ |
| Sculptor | ✅ | ✅ (label: "Maker / Artist") | ✅ (label: "Maker / Artist") | ✅ (label: "Maker / Artist") | ❌ |
| Finishing Artist | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edition Info | ✅ | ❌ | ❌ | ❌ | ❌ |
| Finish Type | ✅ | ❌ | ❌ | ❌ | ✅ |
| Finish Details | ✅ | ❌ | ❌ | ❌ | ❌ |
| Show Bio section | ✅ | ❌ | ❌ | ❌ | ❌ |
| Condition Grade | ✅ | ✅ (simplified) | ✅ (simplified) | ❌ | ✅ (full) |
| Life Stage | ✅ | ❌ | ❌ | ❌ | ✅ |
| Public Notes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Visibility | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trade Status | ✅ | ✅ | ✅ | ✅ | ✅ |

**Category-specific fields live in their extracted sub-form components (from Phase 1.5).** Do NOT inline them in `add-horse/page.tsx`.

## Task 2.5: Wire new fields to `createHorseRecord`

**File:** `src/app/actions/horse.ts`

Add new optional fields to the `createHorseRecord` data parameter:
```typescript
// Category-specific attributes (stored in JSONB)
tackType?: string;
discipline?: string;
materials?: string[];
fitsMolds?: string;
workingParts?: string[];
propCategory?: string;
dimensions?: string;
terrainSetting?: string;
sceneTheme?: string;
components?: string;
baseDimensions?: string;
documentationNotes?: string;
species?: string;
breed?: string;
manufacturer?: string;
modelNumber?: string;
```

Store these in the `attributes` JSONB column on `user_horses`. Check if `attributes` column exists; if not, the migration 113 should add it as `jsonb DEFAULT '{}'::jsonb`.

Build the attributes object from the provided fields. **Use `validateAttributes(category, attrs)` from `assetFields.ts`** to strip unknown keys and coerce types before writing to DB. Include the validated result in `horseInsert`.

## Task 2.6: Guard Hoofprint initialization

**File:** `src/app/add-horse/page.tsx` (line ~527)

Wrap the `initializeHoofprint()` call:
```typescript
if (assetCategory === "model" || assetCategory === "other_model") {
  initializeHoofprint({ horseId, horseName: customName.trim(), lifeStage });
}
```

## Task 2.7: Update activity feed text

**File:** `src/app/add-horse/page.tsx` (line ~514)

Update the `notifyHorsePublic` call to include `assetCategory` so the feed can display "added new tack" vs "added a new model."

### 2.7 Validation

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**Commit checkpoint:**
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: asset category expansion — purpose-built add flow for tack, props, dioramas, other models"
```

---

# Phase 3: Display Surfaces

## Task 3.1: Stable detail page — conditional sections

**File:** `src/app/stable/[id]/page.tsx`

Import `getAssetConfig` from the field config. Read the horse's `asset_category` from the DB query.

1. Gate Show Bio section behind `config.showShowBio`
2. Gate Hoofprint section behind `config.showHoofprint`
3. Gate Finish Type / Condition Grade behind `isFieldVisible()`
4. For tack/prop/diorama/other_model: render the category-specific attributes from the JSONB `attributes` column as labeled display fields
5. Update the page heading: "Model Passport" for horses, "Item Details" for tack, etc.

## Task 3.2: Community detail page — conditional sections

**File:** `src/app/community/[id]/page.tsx`

Same conditional logic as stable detail, but for the public-facing view. This page should use the same `getAssetConfig()` pattern.

## Task 3.3: Edit page — shared field config + extracted components

**File:** `src/app/stable/[id]/edit/page.tsx`

This is **critical** — the edit page must consume the same `assetFields.ts` config AND the same extracted sub-form components (`TackFormFields`, `PropFormFields`, etc.) as the add page. This prevents drift.

1. Import config, read `asset_category` from the loaded horse
2. Show/hide shared fields using `isFieldVisible()`
3. Use `getFieldLabel()` for dynamic labels
4. Render the appropriate `*FormFields.tsx` component for category-specific fields
5. Pre-populate all fields from `attributes` JSONB on load
6. Wire save to `updateHorseAction` — pass attributes through `validateAttributes()` before sending
7. Use `AssetDetailRenderer` in the read-only preview section if one exists

Update `HORSE_ALLOWED` whitelist in `horse.ts` `updateHorseAction` (line 177) to include `attributes`.

## Task 3.4: StableGrid — category badges & filters

**File:** `src/components/StableGrid.tsx`

1. The category overlay badge (line 207-211) already handles tack/prop/diorama. Add `other_model`:
```typescript
horse.assetCategory === "other_model" ? "🐄 Other" : ...
```

2. Add a category filter row above the sort dropdown — chip buttons for each category the user has items in. Filter `filteredCards` by selected category.

## Task 3.5: Dashboard stats

**File:** `src/components/DashboardShell.tsx`

If the dashboard shows a total count label, change "models" to "items" or show breakdown: "42 models, 3 tack, 2 props".

### 3.5 Validation

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**Commit checkpoint:**
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: category-aware display on stable detail, community, edit, and grid"
```

---

# Phase 4: Reports & System Integration

## Task 4.1: Insurance report — multi-category grouping

**File:** `src/components/pdf/InsuranceReport.tsx`

1. Add `assetCategory` to the data interface
2. Group items by category in the PDF output with section headers ("Model Horses", "Tack & Gear", "Props", etc.)
3. Show per-section subtotals and grand total

Also update `src/app/actions/insurance-report.ts` to include `asset_category` in the query.

## Task 4.2: CSV export — add asset_category column

**File:** `src/app/actions/csv-import.ts` (or wherever CSV export lives)

Add `asset_category` as a column in the exported CSV. This allows round-trip import/export.

## Task 4.3: Show tags — category guard

**File:** `src/components/pdf/ShowTags.tsx`

Show tags are horse-only. If the show entry system ever passes non-model items, guard:
```typescript
if (entry.assetCategory && entry.assetCategory !== "model") continue;
```

## Task 4.4: Transfer modal label

**File:** `src/components/TransferModal.tsx`

Update static "Transfer Horse" text to dynamically use the category label: "Transfer Item" or "Transfer Tack" etc.

## Task 4.5: County Fair data-model prep

**File:** `supabase/migrations/113_asset_category_other_model.sql` (append to existing migration)

Add a `non_horse` boolean column to `event_entries` (default `false`) so the data model is ready for future tack/prop show entries without requiring another migration:
```sql
ALTER TABLE event_entries ADD COLUMN IF NOT EXISTS non_horse boolean DEFAULT false;
COMMENT ON COLUMN event_entries.non_horse IS 'Flag for future non-horse entries (tack, props). UI not yet built.';
```

No UI changes — this is data-model prep only. Tack and props DO compete at regional shows; this ensures we don't need a breaking migration when we add that UI later.

### 4.5 Validation

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 5: Tests & Final Gate

## Task 5.1: Update existing tests

Check for any tests that reference `AssetCategory` or hardcode `"model"`:

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src/**/__tests__/*.ts","src/**/__tests__/*.tsx" -Pattern "asset_category|assetCategory|AssetCategory" -Recurse
```

Update any tests that need `other_model` support.

## Task 5.2: Run full test suite

```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

All tests must pass.

## Task 5.3: Final build gate

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**0 errors required.**

## Task 5.4: Final commit & push

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: complete asset category expansion — 5 categories, 14 surfaces updated"
```

```
cd c:\Project Equispace\model-horse-hub && git push
```

---

# Files Modified Summary

| # | File | Change |
|---|------|--------|
| 1 | `supabase/migrations/113_*.sql` | NEW — `other_model` enum + `attributes` JSONB + `event_entries.non_horse` |
| 2 | `src/lib/types/database.ts` | Add `"other_model"` to `AssetCategory` union |
| 3 | `src/lib/config/assetFields.ts` | NEW — shared field config + `validateAttributes()` + dropdown arrays |
| 4 | `src/components/forms/ChipToggle.tsx` | NEW — WCAG-compliant multi-select chip component |
| 5 | `src/components/forms/TackFormFields.tsx` | NEW — tack-specific form inputs |
| 6 | `src/components/forms/PropFormFields.tsx` | NEW — prop-specific form inputs |
| 7 | `src/components/forms/DioramaFormFields.tsx` | NEW — diorama-specific form inputs |
| 8 | `src/components/forms/OtherModelFormFields.tsx` | NEW — other_model-specific form inputs |
| 9 | `src/components/AssetDetailRenderer.tsx` | NEW — read-only JSONB attribute display |
| 10 | `src/app/add-horse/page.tsx` | Dynamic gallery/steps, imports sub-form components |
| 11 | `src/app/actions/horse.ts` | `validateAttributes()`, `attributes` JSONB, `HORSE_ALLOWED` update |
| 12 | `src/app/stable/[id]/page.tsx` | Conditional sections + `AssetDetailRenderer` |
| 13 | `src/app/stable/[id]/edit/page.tsx` | Shared config + sub-form components |
| 14 | `src/app/community/[id]/page.tsx` | Conditional display + `AssetDetailRenderer` |
| 15 | `src/components/StableGrid.tsx` | `other_model` badge, category filter chips |
| 16 | `src/components/DashboardShell.tsx` | Stats breakdown by category |
| 17 | `src/components/pdf/InsuranceReport.tsx` | Multi-category grouping with subtotals |
| 18 | `src/app/actions/insurance-report.ts` | Include `asset_category` in query |
| 19 | `src/components/pdf/ShowTags.tsx` | Category guard (horse-only) |
| 20 | `src/components/TransferModal.tsx` | Dynamic label |
| 21 | `src/app/actions/csv-import.ts` | Add `asset_category` CSV column |

---

## Update dev-nextsteps.md

After all phases complete and build passes, add to `dev-nextsteps.md`:

```markdown
## ✅ Asset Category Expansion — DONE (YYYY-MM-DD)

**Workflow:** `.agents/workflows/asset-category-expansion.md`
**Source:** Beta feedback (Juanita) — tack/prop forms showed horse-specific questions
**Changes:**
1. ✅ 5 asset categories: Model Horse, Tack & Gear, Props, Dioramas, Other Models
2. ✅ Shared field config (`assetFields.ts`) + `validateAttributes()` type guards
3. ✅ Component extraction: `ChipToggle`, 4 sub-form components, `AssetDetailRenderer`
4. ✅ Category-specific gallery slots, form steps, and fields
5. ✅ Conditional rendering on stable detail, community detail, and edit pages
6. ✅ Insurance report grouped by category with subtotals
7. ✅ Hoofprint gated to model + other_model only
8. ✅ Migration 113: `other_model` enum + `attributes` JSONB + `event_entries.non_horse`
9. ✅ WCAG: chip toggles with role=checkbox, keyboard nav, 44px touch targets
**Status:** ✅ COMPLETE — 0 errors, all tests pass
```
