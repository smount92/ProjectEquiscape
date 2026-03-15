---
description: V28 Beta Feedback Sprint — Show Bio, expanded ribbons, fuzzy dates, currency preference, Show Record detail fields, reference link prominence. All items from Beta_Feedback_Round1.md.
---

# V28 Beta Feedback Sprint

> **Source:** `.agents/docs/Beta_Feedback_Round1.md`
> **Context:** A power-user beta tester provided critical feedback regarding the competitive showing experience. This sprint implements ALL items — no deferrals.
> **Pre-requisites:** Clean build. Current migration is 071.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Run `npx next build` after every task and note the result

---

# Phase 1: Database Migrations

> **Philosophy:** One migration per concern. Clear, auditable, reversible.

---

## Task 1.1 — Migration 072: Show Bio & Detail Fields on user_horses

Create `supabase/migrations/072_show_bio_fields.sql`:

```sql
-- ============================================================
-- Migration 072: Show Bio & Detail Fields
-- Adds show identity, finish details, public notes, and regional ID
-- ============================================================

-- Finish surface description (Glossy, Matte, Satin, Chalky, Semi-Gloss)
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS finish_details TEXT;
COMMENT ON COLUMN user_horses.finish_details IS 'Surface finish description (e.g., Glossy, Matte, Satin, Chalky).';

-- Public-facing notes visible on the passport (quirks, accessories, provenance notes)
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS public_notes TEXT;
COMMENT ON COLUMN user_horses.public_notes IS 'Public notes visible on passport (e.g., comes with original box, factory rubs on near leg).';

-- Show Bio: The show persona assigned by the collector for competition
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS assigned_breed TEXT;
COMMENT ON COLUMN user_horses.assigned_breed IS 'Show persona breed (e.g., Andalusian, Arabian). Used for breed division classes.';

ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS assigned_gender TEXT;
COMMENT ON COLUMN user_horses.assigned_gender IS 'Show persona gender (e.g., Stallion, Mare, Gelding). Used for gender division classes.';

ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS assigned_age TEXT;
COMMENT ON COLUMN user_horses.assigned_age IS 'Show persona age (e.g., Foal, Yearling, Adult, 5 years). Stored as text for flexibility.';

-- Regional show system ID (e.g., RX, Texas System)
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS regional_id TEXT;
COMMENT ON COLUMN user_horses.regional_id IS 'Regional show system identifier (e.g., RX number, Texas System ID).';
```

**Action:** Write this file, then apply via the Supabase SQL Editor.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.2 — Migration 073: Show Record Detail Fields

Create `supabase/migrations/073_show_record_details.sql`:

```sql
-- ============================================================
-- Migration 073: Show Record Detail Fields
-- Adds location, section, award category, competition level, and fuzzy date
-- ============================================================

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS show_location TEXT;
COMMENT ON COLUMN show_records.show_location IS 'Show location (e.g., Dallas TX, Ontario Canada).';

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS section_name TEXT;
COMMENT ON COLUMN show_records.section_name IS 'Show section (e.g., Halter, Performance, Collectibility).';

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS award_category TEXT;
COMMENT ON COLUMN show_records.award_category IS 'Award judging category (e.g., Breed, Workmanship, Color, Gender).';

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS competition_level TEXT;
COMMENT ON COLUMN show_records.competition_level IS 'Competition level (e.g., Open, Novice, Intermediate, Youth).';

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS show_date_text TEXT;
COMMENT ON COLUMN show_records.show_date_text IS 'Fuzzy show date for when exact date is unknown (e.g., Spring 2023, Summer 2015).';
```

**Action:** Write this file, then apply via the Supabase SQL Editor.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.3 — Migration 074: Currency Preference

Create `supabase/migrations/074_currency_preference.sql`:

```sql
-- ============================================================
-- Migration 074: Currency Preference
-- Adds per-user currency symbol for international collectors
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(5) DEFAULT '$';
COMMENT ON COLUMN users.currency_symbol IS 'Preferred currency symbol (e.g., $, £, €, ¥). Defaults to USD.';
```

**Action:** Write this file, then apply via the Supabase SQL Editor.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.4 — Migration 075: Fuzzy Purchase Date

Create `supabase/migrations/075_fuzzy_purchase_date.sql`:

```sql
-- ============================================================
-- Migration 075: Fuzzy Purchase Date
-- Adds text-based approximate date for financial vault
-- ============================================================

ALTER TABLE financial_vault
  ADD COLUMN IF NOT EXISTS purchase_date_text TEXT;
COMMENT ON COLUMN financial_vault.purchase_date_text IS 'Approximate purchase date text (e.g., BreyerFest 2017, Summer 2015). Displayed when exact date is unavailable.';
```

**Action:** Write this file, then apply via the Supabase SQL Editor.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 2: TypeScript Types

## Task 2.1 — Update database.ts

**File:** `src/lib/types/database.ts`

### UserHorse interface (currently lines 55–74)

Add these 6 fields after the existing `edition_size` field:

```typescript
  finish_details: string | null;
  public_notes: string | null;
  assigned_breed: string | null;
  assigned_gender: string | null;
  assigned_age: string | null;
  regional_id: string | null;
```

### ShowRecord interface (currently lines 126–139)

Add these 5 fields after the existing `notes` field:

```typescript
  show_location: string | null;
  section_name: string | null;
  award_category: string | null;
  competition_level: string | null;
  show_date_text: string | null;
```

### FinancialVault interface (currently lines 76–83)

Add after `insurance_notes`:

```typescript
  purchase_date_text: string | null;
```

### User interface (currently lines 32–42)

Add after `created_at`:

```typescript
  currency_symbol: string;
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 3: Server Action Updates

## Task 3.1 — Update horse.ts (createHorseRecord + updateHorseAction)

**File:** `src/app/actions/horse.ts`

### In `createHorseRecord` (around line 280):

The function builds a horse insert payload. After the existing fields like `finish_type`, add:

```typescript
  finish_details: data.finishDetails?.trim() || null,
  public_notes: data.publicNotes?.trim() || null,
  assigned_breed: data.assignedBreed?.trim() || null,
  assigned_gender: data.assignedGender?.trim() || null,
  assigned_age: data.assignedAge?.trim() || null,
  regional_id: data.regionalId?.trim() || null,
```

Also add `purchaseDateText` to the vault insert payload:

```typescript
  purchase_date_text: data.purchaseDateText?.trim() || null,
```

### In `updateHorseAction` (around line 141):

Add the new fields to `HORSE_ALLOWED`:

```typescript
const HORSE_ALLOWED = [
    'custom_name', 'sculptor', 'finishing_artist', 'finishing_artist_verified', 'finish_type',
    'condition_grade', 'is_public', 'visibility', 'trade_status', 'listing_price',
    'marketplace_notes', 'collection_id', 'catalog_id', 'life_stage',
    'edition_number', 'edition_size', 'asset_category',
    'finish_details', 'public_notes', 'assigned_breed', 'assigned_gender',
    'assigned_age', 'regional_id',
];
```

Add to `VAULT_ALLOWED`:

```typescript
const VAULT_ALLOWED = [
    'purchase_price', 'purchase_date', 'estimated_current_value',
    'insurance_notes', 'horse_id', 'purchase_date_text',
];
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 3.2 — Update provenance.ts (addShowRecord + updateShowRecord)

**File:** `src/app/actions/provenance.ts`

### In `addShowRecord` (line 14):

Add to the function's data parameter type:

```typescript
export async function addShowRecord(data: {
    horseId: string;
    showName: string;
    showDate?: string;
    division?: string;
    placing?: string;
    ribbonColor?: string;
    judgeName?: string;
    isNan?: boolean;
    notes?: string;
    // NEW: Beta feedback fields
    showLocation?: string;
    sectionName?: string;
    awardCategory?: string;
    competitionLevel?: string;
    showDateText?: string;
}): Promise<{ success: boolean; error?: string }> {
```

Add the new fields to the insert object (after `notes`):

```typescript
    show_location: data.showLocation?.trim() || null,
    section_name: data.sectionName?.trim() || null,
    award_category: data.awardCategory?.trim() || null,
    competition_level: data.competitionLevel?.trim() || null,
    show_date_text: data.showDateText?.trim() || null,
```

**Date Fallback Logic:** If `showDateText` is provided but `showDate` is empty, attempt to parse a year:

```typescript
    // Fuzzy date fallback — extract a year for sorting if exact date is missing
    let resolvedShowDate = data.showDate || null;
    if (!resolvedShowDate && data.showDateText) {
        const yearMatch = data.showDateText.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            resolvedShowDate = `${yearMatch[0]}-01-01`;
        }
    }
```

Then use `resolvedShowDate` instead of `data.showDate || null` in the insert.

### In `updateShowRecord` (line 63):

Add the same 5 fields to the data parameter type and to the `updateData` mapping:

```typescript
    if (data.showLocation !== undefined) updateData.show_location = data.showLocation.trim() || null;
    if (data.sectionName !== undefined) updateData.section_name = data.sectionName.trim() || null;
    if (data.awardCategory !== undefined) updateData.award_category = data.awardCategory.trim() || null;
    if (data.competitionLevel !== undefined) updateData.competition_level = data.competitionLevel.trim() || null;
    if (data.showDateText !== undefined) updateData.show_date_text = data.showDateText.trim() || null;
```

Apply the same fuzzy date fallback logic for `showDate` when `showDateText` is present but `showDate` is empty.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 3.3 — Update settings.ts (getProfile + updateProfile)

**File:** `src/app/actions/settings.ts`

### In `getProfile` (line 12):

Add `currency_symbol` to the return type:

```typescript
export async function getProfile(): Promise<{
    aliasName: string;
    bio: string;
    avatarUrl: string | null;
    email: string;
    notificationPrefs: Record<string, boolean>;
    defaultHorsePublic: boolean;
    watermarkPhotos: boolean;
    currencySymbol: string;  // NEW
} | null> {
```

Add `currency_symbol` to the `.select()` call (line 27):

```typescript
.select("alias_name, bio, avatar_url, notification_prefs, default_horse_public, watermark_photos, currency_symbol")
```

Add to the type cast (line 32):

```typescript
    currency_symbol: string | null;
```

Add to the return object (line 50):

```typescript
    currencySymbol: d.currency_symbol || "$",
```

### In `updateProfile` (line 71):

Add `currencySymbol` to the input type:

```typescript
export async function updateProfile(data: {
    aliasName?: string;
    bio?: string;
    defaultHorsePublic?: boolean;
    watermarkPhotos?: boolean;
    currencySymbol?: string;  // NEW
}): Promise<{ success: boolean; error?: string }> {
```

Add the update logic after `watermarkPhotos` handling (after line 109):

```typescript
    if (data.currencySymbol !== undefined) {
        const symbol = data.currencySymbol.trim().slice(0, 5);
        if (!symbol) return { success: false, error: "Currency symbol cannot be empty." };
        updates.currency_symbol = symbol;
    }
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 4: Form UI — Show Record Form

## Task 4.1 — Overhaul ShowRecordForm.tsx

**File:** `src/components/ShowRecordForm.tsx`

### Step 1: Replace RIBBON_COLORS array (lines 6–20)

Replace the entire RIBBON_COLORS array with:

```typescript
const RIBBON_COLORS = [
    { value: "", label: "Select ribbon/award…" },
    { value: "Blue", label: "🔵 Blue" },
    { value: "Red", label: "🔴 Red" },
    { value: "Yellow", label: "🟡 Yellow" },
    { value: "White", label: "⚪ White" },
    { value: "Pink", label: "🩷 Pink" },
    { value: "Green", label: "🟢 Green" },
    { value: "Purple", label: "🟣 Purple" },
    { value: "Brown", label: "🟤 Brown (8th)" },
    { value: "Gray", label: "🔘 Gray (9th)" },
    { value: "Light Blue", label: "🧊 Light Blue (10th)" },
    { value: "Grand Champion", label: "🏆 Grand Champion" },
    { value: "Reserve Grand Champion", label: "🥈 Reserve Grand Champion" },
    { value: "Champion", label: "🏆 Champion" },
    { value: "Reserve Champion", label: "🥈 Reserve Champion" },
    { value: "Honorable Mention", label: "🎖️ Honorable Mention (HM)" },
    { value: "Top 3", label: "🏅 Top 3" },
    { value: "Top 5", label: "🏅 Top 5" },
    { value: "Top 10", label: "🏅 Top 10" },
    { value: "Participant", label: "🎀 Participant" },
    { value: "Other", label: "Other" },
];
```

Key changes:
- Removed "(1st)", "(2nd)" placing from color labels — placing has its own field
- Removed "NAN Top Ten" and "NAN Card" — NAN is handled by the NAN checkbox
- Added Brown (8th), Gray (9th), Light Blue (10th)
- Added Champion, Reserve Champion, Honorable Mention, Top 3/5/10, Participant

### Step 2: Update ShowRecordFormProps and existingRecord interface

Add the new fields to the `existingRecord` type and props interface:

```typescript
interface ShowRecordFormProps {
    horseId: string;
    existingRecord?: {
        id: string;
        showName: string;
        showDate: string | null;
        division: string | null;
        placing: string | null;
        ribbonColor: string | null;
        judgeName: string | null;
        isNan: boolean;
        notes: string | null;
        // NEW: Beta feedback fields
        showLocation: string | null;
        sectionName: string | null;
        awardCategory: string | null;
        competitionLevel: string | null;
        showDateText: string | null;
    };
    onSave: () => void;
    onCancel: () => void;
}
```

### Step 3: Add state variables

After the existing state declarations (line 54), add:

```typescript
    const [showLocation, setShowLocation] = useState(existingRecord?.showLocation ?? "");
    const [sectionName, setSectionName] = useState(existingRecord?.sectionName ?? "");
    const [awardCategory, setAwardCategory] = useState(existingRecord?.awardCategory ?? "");
    const [competitionLevel, setCompetitionLevel] = useState(existingRecord?.competitionLevel ?? "");
    const [showDateText, setShowDateText] = useState(existingRecord?.showDateText ?? "");
    const [showAdvanced, setShowAdvanced] = useState(
        !!(existingRecord?.showLocation || existingRecord?.sectionName ||
           existingRecord?.awardCategory || existingRecord?.competitionLevel)
    );
```

### Step 4: Update formData in handleSubmit

Add the new fields to the `formData` object (after `notes`):

```typescript
    const formData = {
        showName,
        showDate: showDate || undefined,
        division: division || undefined,
        placing: placing || undefined,
        ribbonColor: ribbonColor || undefined,
        judgeName: judgeName || undefined,
        isNan,
        notes: notes || undefined,
        // NEW fields
        showLocation: showLocation || undefined,
        sectionName: sectionName || undefined,
        awardCategory: awardCategory || undefined,
        competitionLevel: competitionLevel || undefined,
        showDateText: showDateText || undefined,
    };
```

### Step 5: Add UI inputs for fuzzy date and advanced fields

After the Show Date input row (currently lines 110–132), add a fuzzy date field **below the date picker**:

```tsx
                {/* Fuzzy Date fallback */}
                <div className="form-group">
                    <label className="form-label">Approximate Date</label>
                    <input
                        className="form-input"
                        type="text"
                        value={showDateText}
                        onChange={(e) => setShowDateText(e.target.value)}
                        placeholder="e.g. Spring 2023, BreyerFest 2015"
                        id="show-record-date-text"
                    />
                    <small style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                        Use this when you don&apos;t know the exact date.
                    </small>
                </div>
```

After the Ribbon row, add an "Advanced Details" toggle and collapsible section:

```tsx
                {/* Advanced Details Toggle */}
                <div className="form-group">
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{ width: "100%" }}
                        id="show-record-advanced-toggle"
                    >
                        {showAdvanced ? "▾ Hide" : "▸ Show"} Advanced Details
                    </button>
                </div>

                {showAdvanced && (
                    <>
                        <div className="show-record-form-row">
                            <div className="form-group">
                                <label className="form-label">Location</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={showLocation}
                                    onChange={(e) => setShowLocation(e.target.value)}
                                    placeholder="e.g. Dallas TX, Ontario Canada"
                                    id="show-record-location"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Section</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={sectionName}
                                    onChange={(e) => setSectionName(e.target.value)}
                                    placeholder="e.g. Halter, Performance"
                                    id="show-record-section"
                                />
                            </div>
                        </div>

                        <div className="show-record-form-row">
                            <div className="form-group">
                                <label className="form-label">Award Category</label>
                                <select
                                    className="form-select"
                                    value={awardCategory}
                                    onChange={(e) => setAwardCategory(e.target.value)}
                                    id="show-record-award-category"
                                >
                                    <option value="">Select category…</option>
                                    <option value="Breed">Breed</option>
                                    <option value="Collectibility">Collectibility</option>
                                    <option value="Workmanship">Workmanship</option>
                                    <option value="Color">Color</option>
                                    <option value="Gender">Gender</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Competition Level</label>
                                <select
                                    className="form-select"
                                    value={competitionLevel}
                                    onChange={(e) => setCompetitionLevel(e.target.value)}
                                    id="show-record-competition-level"
                                >
                                    <option value="">Select level…</option>
                                    <option value="Open">Open</option>
                                    <option value="Novice">Novice</option>
                                    <option value="Intermediate">Intermediate</option>
                                    <option value="Youth">Youth</option>
                                </select>
                            </div>
                        </div>
                    </>
                )}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 5: Form UI — Add/Edit Horse Forms

## Task 5.1 — Update Add Horse Page

**File:** `src/app/add-horse/page.tsx`

### Step 1: Add new state variables

After the existing state declarations (around line 128), add:

```typescript
    const [finishDetails, setFinishDetails] = useState("");
    const [publicNotes, setPublicNotes] = useState("");
    const [assignedBreed, setAssignedBreed] = useState("");
    const [assignedGender, setAssignedGender] = useState("");
    const [assignedAge, setAssignedAge] = useState("");
    const [regionalId, setRegionalId] = useState("");
    const [purchaseDateText, setPurchaseDateText] = useState("");
```

### Step 2: Pass new fields to createHorseRecord in handleSubmit

In the `handleSubmit` function (around line 310), add the new fields to the call:

```typescript
    finishDetails: finishDetails || undefined,
    publicNotes: publicNotes || undefined,
    assignedBreed: assignedBreed || undefined,
    assignedGender: assignedGender || undefined,
    assignedAge: assignedAge || undefined,
    regionalId: regionalId || undefined,
    purchaseDateText: purchaseDateText || undefined,
```

### Step 3: Add Finish Details input

In the Identity section (Step 3 of the form), **after** the Finish Type dropdown, add:

```tsx
                    {/* Finish Details */}
                    <div className="form-group">
                        <label className="form-label">Finish Details</label>
                        <input
                            className="form-input"
                            type="text"
                            value={finishDetails}
                            onChange={(e) => setFinishDetails(e.target.value)}
                            placeholder="e.g. Glossy, Matte, Satin, Chalky"
                            maxLength={100}
                            id="finish-details"
                        />
                    </div>
```

### Step 4: Add Public Notes textarea

After Finish Details:

```tsx
                    {/* Public Notes */}
                    <div className="form-group">
                        <label className="form-label">Public Notes</label>
                        <textarea
                            className="form-input"
                            value={publicNotes}
                            onChange={(e) => setPublicNotes(e.target.value)}
                            placeholder="Visible on your passport — e.g. comes with original box, factory rubs on near leg"
                            maxLength={500}
                            rows={2}
                            id="public-notes"
                        />
                        <small style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                            These notes will be visible to anyone viewing this horse&apos;s passport.
                        </small>
                    </div>
```

### Step 5: Add Show Bio section

After the Public Notes, add a collapsible Show Bio section:

```tsx
                    {/* ── Show Bio (Optional) ── */}
                    <div className="form-divider" style={{ margin: "var(--space-lg) 0 var(--space-md)" }}>
                        <h4 style={{ fontSize: "var(--font-size-md)", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                            🏅 Show Bio <span style={{ fontWeight: 400, fontSize: "var(--font-size-sm)" }}>(Optional)</span>
                        </h4>
                        <small style={{ color: "var(--color-text-muted)", display: "block", marginTop: "var(--space-xs)" }}>
                            The show identity you assign for competition — breed, gender, and age for show ring divisions.
                        </small>
                    </div>

                    <div className="form-row" style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
                        <div className="form-group" style={{ flex: "1 1 200px" }}>
                            <label className="form-label">Assigned Breed</label>
                            <input
                                className="form-input"
                                type="text"
                                value={assignedBreed}
                                onChange={(e) => setAssignedBreed(e.target.value)}
                                placeholder="e.g. Andalusian, Arabian, Quarter Horse"
                                maxLength={100}
                                id="assigned-breed"
                            />
                        </div>
                        <div className="form-group" style={{ flex: "1 1 150px" }}>
                            <label className="form-label">Assigned Gender</label>
                            <select
                                className="form-select"
                                value={assignedGender}
                                onChange={(e) => setAssignedGender(e.target.value)}
                                id="assigned-gender"
                            >
                                <option value="">Select…</option>
                                <option value="Stallion">Stallion</option>
                                <option value="Mare">Mare</option>
                                <option value="Gelding">Gelding</option>
                                <option value="Foal">Foal</option>
                                <option value="Colt">Colt</option>
                                <option value="Filly">Filly</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row" style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
                        <div className="form-group" style={{ flex: "1 1 150px" }}>
                            <label className="form-label">Assigned Age</label>
                            <input
                                className="form-input"
                                type="text"
                                value={assignedAge}
                                onChange={(e) => setAssignedAge(e.target.value)}
                                placeholder="e.g. Foal, Yearling, Adult, 5 years"
                                maxLength={50}
                                id="assigned-age"
                            />
                        </div>
                        <div className="form-group" style={{ flex: "1 1 200px" }}>
                            <label className="form-label">Regional Show ID</label>
                            <input
                                className="form-input"
                                type="text"
                                value={regionalId}
                                onChange={(e) => setRegionalId(e.target.value)}
                                placeholder="e.g. RX number, Texas System ID"
                                maxLength={50}
                                id="regional-id"
                            />
                        </div>
                    </div>
```

### Step 6: Add Fuzzy Purchase Date to Vault section

In the Financial Vault section (Step 4, around line 1100), after the existing `Purchase Date` input, add:

```tsx
                    {/* Fuzzy Purchase Date */}
                    <div className="form-group">
                        <label className="form-label">Approximate Purchase Date</label>
                        <input
                            className="form-input"
                            type="text"
                            value={purchaseDateText}
                            onChange={(e) => setPurchaseDateText(e.target.value)}
                            placeholder="e.g. BreyerFest 2017, Summer 2015, Christmas 2020"
                            id="purchase-date-text"
                        />
                        <small style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                            Use this when you don&apos;t remember the exact date.
                        </small>
                    </div>
```

### Step 7: Remove hardcoded ($) from price labels

Find and replace:
- `Purchase Price ($)` → `Purchase Price`
- `Listing Price ($)` → `Listing Price`

The currency symbol will come from settings (see Phase 6).

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 5.2 — Update Edit Horse Page

**File:** `src/app/stable/[id]/edit/page.tsx`

Apply the same additions as Task 5.1:

1. Load the new fields from the database in `loadHorse()` — add `finish_details, public_notes, assigned_breed, assigned_gender, assigned_age, regional_id` to the `.select()` query
2. Add state variables initialized from the loaded data
3. Add the same form fields (Finish Details, Public Notes, Show Bio section)
4. Add the new fields to the `handleSave()` payload
5. Load `purchase_date_text` from the vault data and add the fuzzy date input
6. Add `purchase_date_text` to the `VaultData` type in this file
7. Remove the hardcoded `($)` from price labels

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 6: Currency Support

## Task 6.1 — Settings Page: Currency Symbol Input

**File:** `src/app/settings/page.tsx`

### Step 1: Add state variable

In the component's state declarations (around line 45), add:

```typescript
    const [currencySymbol, setCurrencySymbol] = useState("$");
```

### Step 2: Populate from getProfile

In the `load()` function, after setting other profile fields:

```typescript
    setCurrencySymbol(profile.currencySymbol || "$");
```

### Step 3: Add UI input

In the Profile section of the settings form, add a new field:

```tsx
                    {/* Currency Preference */}
                    <div className="form-group">
                        <label className="form-label">Preferred Currency Symbol</label>
                        <select
                            className="form-select"
                            value={currencySymbol}
                            onChange={(e) => setCurrencySymbol(e.target.value)}
                            id="currency-symbol"
                        >
                            <option value="$">$ (USD)</option>
                            <option value="£">£ (GBP)</option>
                            <option value="€">€ (EUR)</option>
                            <option value="¥">¥ (JPY/CNY)</option>
                            <option value="C$">C$ (CAD)</option>
                            <option value="A$">A$ (AUD)</option>
                            <option value="kr">kr (SEK/NOK/DKK)</option>
                        </select>
                        <small style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                            Shown next to prices in your private vault and listings.
                        </small>
                    </div>
```

### Step 4: Save via updateProfile

In `handleSaveProfile`, include:

```typescript
    const result = await updateProfile({
        aliasName: alias,
        bio: bio,
        defaultHorsePublic,
        watermarkPhotos,
        currencySymbol,  // NEW
    });
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 6.2 — Thread Currency Through Components

### VaultReveal.tsx

**File:** `src/components/VaultReveal.tsx`

Add `currencySymbol` to props:

```typescript
interface VaultRevealProps {
    vault: VaultData | null;
    currencySymbol?: string;  // NEW
}
```

Update `formatCurrency` to accept a symbol:

```typescript
function formatCurrency(value: number, symbol: string = "$"): string {
    // Format the number, then replace the currency symbol
    const formatted = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
    return `${symbol}${formatted}`;
}
```

Pass the symbol in the component:

```typescript
export default function VaultReveal({ vault, currencySymbol = "$" }: VaultRevealProps) {
```

And use it: `{formatCurrency(vault.purchase_price, currencySymbol)}`

Also add the fuzzy purchase date display in the vault grid:

```tsx
    {vault.purchase_date_text && !vault.purchase_date && (
        <div className="vault-data-item">
            <div className="vault-data-label">Purchase Date</div>
            <div className="vault-data-value">
                {vault.purchase_date_text}
            </div>
        </div>
    )}
```

Update VaultData to include the new field:

```typescript
interface VaultData {
    purchase_price: number | null;
    purchase_date: string | null;
    estimated_current_value: number | null;
    insurance_notes: string | null;
    purchase_date_text: string | null;  // NEW
}
```

### Passport Page: Pass currencySymbol to VaultReveal

**File:** `src/app/stable/[id]/page.tsx`

Fetch the user's `currency_symbol` alongside horse data (it's on the `users` table):

```typescript
// In the data query, join or separately fetch:
const { data: ownerProfile } = await supabase
    .from("users")
    .select("currency_symbol")
    .eq("id", horse.owner_id)
    .single();
```

Pass to VaultReveal:

```tsx
<VaultReveal vault={vault} currencySymbol={ownerProfile?.currency_symbol || "$"} />
```

### MakeOfferModal.tsx

**File:** `src/components/MakeOfferModal.tsx`

The `$` on line 77 is hardcoded in the offer amount input. Update to accept `currencySymbol` as a prop:

```typescript
<span className={styles.currency}>{currencySymbol || "$"}</span>
```

### MarketValueBadge.tsx

**File:** `src/components/MarketValueBadge.tsx`

This component shows Blue Book market prices — these are aggregate USD values from `mv_market_prices` and should remain in USD. **Do NOT change this component** — market prices are a community benchmark in a single currency.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 7: Display UI — Passport & Timeline

## Task 7.1 — Update Passport Page (Private)

**File:** `src/app/stable/[id]/page.tsx`

### Step 1: Update the SELECT query

Add the new fields to the horse data query (line ~108):

```sql
finish_details, public_notes, assigned_breed, assigned_gender, assigned_age, regional_id
```

Also fetch `purchase_date_text` from `financial_vault`.

### Step 2: Model Details section

After the Finish Type display (line ~325), add Finish Details:

```tsx
    {horse.finish_details && (
        <div className="passport-detail-row">
            <span className="passport-detail-label">Finish</span>
            <span className="passport-detail-value">{horse.finish_details}</span>
        </div>
    )}
```

### Step 3: Show Bio card

After the Model Details section, add a Show Bio card (only if any show bio fields exist):

```tsx
    {(horse.assigned_breed || horse.assigned_gender || horse.assigned_age || horse.regional_id) && (
        <div className="passport-section">
            <h3>🏅 Show Identity</h3>
            <div className="passport-detail-grid">
                {horse.assigned_breed && (
                    <div className="passport-detail-row">
                        <span className="passport-detail-label">Breed</span>
                        <span className="passport-detail-value">{horse.assigned_breed}</span>
                    </div>
                )}
                {horse.assigned_gender && (
                    <div className="passport-detail-row">
                        <span className="passport-detail-label">Gender</span>
                        <span className="passport-detail-value">{horse.assigned_gender}</span>
                    </div>
                )}
                {horse.assigned_age && (
                    <div className="passport-detail-row">
                        <span className="passport-detail-label">Age</span>
                        <span className="passport-detail-value">{horse.assigned_age}</span>
                    </div>
                )}
                {horse.regional_id && (
                    <div className="passport-detail-row">
                        <span className="passport-detail-label">Regional ID</span>
                        <span className="passport-detail-value">{horse.regional_id}</span>
                    </div>
                )}
            </div>
        </div>
    )}
```

### Step 4: Public Notes

Display public notes as a distinct section (only if present):

```tsx
    {horse.public_notes && (
        <div className="passport-section">
            <h3>📝 Notes</h3>
            <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                {horse.public_notes}
            </p>
        </div>
    )}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 7.2 — Update Passport Page (Public)

**File:** `src/app/community/[id]/page.tsx`

Apply the same display additions as Task 7.1:
- Show Finish Details next to Finish Type
- Show Bio card (if data exists)
- Public Notes section
- Fetch `currency_symbol` from owner for the listing price display (if applicable)

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 7.3 — Update ShowRecordTimeline.tsx

**File:** `src/components/ShowRecordTimeline.tsx`

### Step 1: Update ShowRecordDisplay interface

Add the new fields:

```typescript
interface ShowRecordDisplay {
    id: string;
    showName: string;
    showDate: string | null;
    division: string | null;
    placing: string | null;
    ribbonColor: string | null;
    judgeName: string | null;
    isNan: boolean;
    notes: string | null;
    // NEW
    showLocation: string | null;
    sectionName: string | null;
    awardCategory: string | null;
    competitionLevel: string | null;
    showDateText: string | null;
}
```

### Step 2: Update formatShowDate

Support fuzzy date fallback:

```typescript
function formatShowDate(dateStr: string | null, dateText: string | null): string {
    if (dateStr) {
        return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }
    if (dateText) return dateText;
    return "Date unknown";
}
```

Update the call site in the template:

```tsx
<span>📅 {formatShowDate(record.showDate, record.showDateText)}</span>
```

### Step 3: Update getRibbonClass

Add mappings for new ribbon types:

```typescript
function getRibbonClass(ribbon: string | null): string {
    if (!ribbon) return "";
    const lower = ribbon.toLowerCase();
    if (lower.includes("grand champion")) return "ribbon-grand";
    if (lower.includes("reserve grand")) return "ribbon-reserve-grand";
    if (lower === "champion") return "ribbon-champion";
    if (lower === "reserve champion") return "ribbon-reserve-champion";
    const map: Record<string, string> = {
        blue: "ribbon-blue",
        red: "ribbon-red",
        yellow: "ribbon-yellow",
        white: "ribbon-white",
        pink: "ribbon-pink",
        green: "ribbon-green",
        purple: "ribbon-purple",
        brown: "ribbon-brown",
        gray: "ribbon-gray",
        "light blue": "ribbon-light-blue",
    };
    return map[lower] || "";
}
```

### Step 4: Display new fields in the record meta

After the existing meta spans, add:

```tsx
    {record.showLocation && <span>📍 {record.showLocation}</span>}
    {record.sectionName && <span>📂 {record.sectionName}</span>}
    {record.awardCategory && <span>🏷️ {record.awardCategory}</span>}
    {record.competitionLevel && <span>🎯 {record.competitionLevel}</span>}
```

### Step 5: Update where ShowRecordTimeline data is fetched (passport pages)

In both `src/app/stable/[id]/page.tsx` and `src/app/community/[id]/page.tsx`, update the show_records query to include the new columns and map them properly.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 7.4 — Add Ribbon CSS Colors

**File:** `src/app/globals.css`

Find the existing `.show-record-item.ribbon-*::before` rules and add the missing ones:

```css
/* ── Additional Ribbon Colors (Beta Feedback) ── */
.show-record-item.ribbon-brown::before { background: #8B4513; }
.show-record-item.ribbon-gray::before { background: #9CA3AF; }
.show-record-item.ribbon-light-blue::before { background: #7DD3FC; }
.show-record-item.ribbon-champion::before { background: linear-gradient(135deg, #3B82F6, #8B5CF6); }
.show-record-item.ribbon-reserve-champion::before { background: linear-gradient(135deg, #F59E0B, #EF4444); }
.show-record-item.ribbon-reserve-grand::before { background: linear-gradient(135deg, #EF4444, #F59E0B); }
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 8: Reference Data Prominence

## Task 8.1 — Enhance UnifiedReferenceSearch Selection Display

**File:** `src/components/UnifiedReferenceSearch.tsx`

When a catalog item is selected (the badge is showing), add a one-line success callout below it:

```tsx
    {/* Database Link Active callout */}
    {selectedCatalogId && (
        <div style={{
            background: "rgba(61, 90, 62, 0.08)",
            border: "1px solid rgba(61, 90, 62, 0.25)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-sm) var(--space-md)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
            marginTop: "var(--space-sm)",
        }}>
            🔗 <strong>Linked</strong> — Manufacturer, scale, and release info will auto-fill on your passport.
        </div>
    )}
```

Place this after the selected item badge, but only when the releases panel is not open.

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

# Phase 9: Final Verification

## Task 9.1 — Full Build

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Must return 0 errors.

## Task 9.2 — Manual Testing Checklist

- [ ] **Add Horse:** Fill out all new fields (finish details, public notes, show bio, fuzzy purchase date). Submit. Verify they appear on the passport.
- [ ] **Edit Horse:** Open the horse just created. Verify all new fields are pre-populated. Change some values. Save. Verify updates on passport.
- [ ] **Show Record:** Add a new show record. Use the fuzzy date "Spring 2023". Select "Brown" ribbon. Fill in Location, Section, Award Category, Competition Level. Save. Verify it appears on the timeline with all metadata.
- [ ] **Ribbon Colors:** Verify Brown, Gray, Light Blue render with the correct dot colors. Verify Champion renders with the gradient.
- [ ] **Currency:** Go to Settings. Change currency to £. Go to a horse passport with vault data. Verify the vault shows £ instead of $.
- [ ] **Reference Link Prominence:** On the Add Horse form, select a mold reference. Verify the green "🔗 Linked" callout appears below the badge.
- [ ] **Public Passport:** View a public passport. Verify Show Bio and Public Notes display correctly. Verify Finish Details appears next to Finish Type.

## Task 9.3 — Commit & Push

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "V28: Beta Feedback Sprint — Show Bio, expanded ribbons, fuzzy dates, currency, Show Record details, reference link prominence" && git push
```

---

# ═══════════════════════════════════════
# SIGN-OFF CHECKLIST
# ═══════════════════════════════════════

- [ ] Migrations 072–075 created and applied to Supabase
- [ ] database.ts types updated for all 4 tables
- [ ] horse.ts server actions updated (create + update + HORSE_ALLOWED + VAULT_ALLOWED)
- [ ] provenance.ts server actions updated (add + update + fuzzy date fallback)
- [ ] settings.ts updated (getProfile + updateProfile + currencySymbol)
- [ ] ShowRecordForm.tsx fully overhauled (ribbon colors + advanced fields + fuzzy date)
- [ ] Add Horse page updated (finish details, public notes, show bio, fuzzy vault date)
- [ ] Edit Horse page updated (same fields + pre-population)
- [ ] Passport pages updated (private + public — show bio card, public notes, finish details)
- [ ] ShowRecordTimeline updated (new fields + ribbon classes + fuzzy date display)
- [ ] VaultReveal updated (currency symbol prop + fuzzy purchase date)
- [ ] Settings page updated (currency selector)
- [ ] Ribbon CSS colors added (brown, gray, light blue, champion, reserve champion)
- [ ] UnifiedReferenceSearch enhanced (linked callout)
- [ ] All hardcoded ($) removed from price labels
- [ ] Build passes with 0 errors
- [ ] Committed and pushed
