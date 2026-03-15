---
description: Option 10 — Beta Feedback Round 1. Implements highly requested show competitor features: Show Bio (Breed/Gender/Age), expanded Ribbon Colors, Show Record details, currency preference, and fuzzy dates.
---

# V11 Beta Feedback Round 1 (Show Competitor Features)

> **Context:** A power-user beta tester provided critical feedback regarding the competitive showing experience. We need to expand the `user_horses` and `show_records` schemas, decouple ribbon colors from placings, allow fuzzy dates for purchases/shows, add a currency preference, and prominently display reference data in the UI so users know they don't need to manually type factory specs.
> **Pre-requisites:** V10 Universal Ledger complete. Clean build.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Run `npx next build` after every task and note the result

---

## Phase 1: Database Migration (Schema Expansion & Fuzzy Dates)

### Task 1.1 — Migration 052: Beta Feedback 1

Create `supabase/migrations/052_beta_feedback_1.sql`:

```sql
-- ============================================================
-- Migration 052: Beta Feedback 1 (Show Competitor Updates)
-- Adds Show Bio fields, detailed Show Record fields, currency, and fuzzy dates
-- ============================================================

-- 1. Add Show Bio & Detail fields to user_horses
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS finish_details TEXT, -- e.g., Glossy, Matte, Satin
  ADD COLUMN IF NOT EXISTS public_notes TEXT,   -- e.g., Quirks, accessories
  ADD COLUMN IF NOT EXISTS assigned_breed TEXT,    -- For show rings
  ADD COLUMN IF NOT EXISTS assigned_gender TEXT,   -- For show rings
  ADD COLUMN IF NOT EXISTS assigned_age TEXT,      -- Stored as text (e.g. "5 years", "Adult")
  ADD COLUMN IF NOT EXISTS regional_id TEXT;       -- e.g., RX, Texas System

-- 2. Add detailed Show Record fields to show_records
ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS show_location TEXT,       -- State/Province/Country
  ADD COLUMN IF NOT EXISTS section_name TEXT,        -- Section grouping
  ADD COLUMN IF NOT EXISTS award_category TEXT,      -- Breed, Collectibility, Workmanship
  ADD COLUMN IF NOT EXISTS competition_level TEXT,   -- Open, Novice, Youth
  ADD COLUMN IF NOT EXISTS show_date_text TEXT;      -- For fuzzy dates like "Spring 2025"

-- 3. Add Currency Preference to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(5) DEFAULT '$';

-- 4. Add fuzzy date to financial_vault
ALTER TABLE financial_vault 
  ADD COLUMN IF NOT EXISTS purchase_date_text TEXT;
Action: Write this file and apply it via the Supabase SQL editor.

Phase 2: Updating Types & Server Actions
Task 2.1 — Update database.ts
Update src/lib/types/database.ts:

In UserHorse, add the 6 new text columns (all string | null).

In ShowRecord, add show_location, section_name, award_category, competition_level, show_date_text (all string | null).

In FinancialVault, add purchase_date_text (string | null).

In User, add currency_symbol: string.

Update the Database Supabase type mappings to match these additions.

Task 2.2 — Update Server Actions
src/app/actions/horse.ts: In createHorseRecord and updateHorseAction: Add finishDetails, publicNotes, assignedBreed, assignedGender, assignedAge, and regionalId to the allowed payload/whitelist. In updateHorseAction, make sure to add these to the HORSE_ALLOWED array! Add purchaseDateText to vault payload.

src/app/actions/provenance.ts: In addShowRecord and updateShowRecord: Add showLocation, sectionName, awardCategory, competitionLevel, showDateText to the payload.

Date Fallback Logic: If showDateText is provided (e.g., "2015") but showDate is empty, try to parse a rough date (e.g., "2015-01-01") to save into the show_date DATE column so timeline sorting still works!

src/app/actions/settings.ts: In getProfile(), fetch and return currencySymbol (defaulting to $). In updateProfile(), allow updating currencySymbol.

src/app/actions/header.ts: Fetch currency_symbol from the profile and return it so the layout/client can use it.

Phase 3: Form UI Updates
Task 3.1 — Make Reference Data Visually Obvious
In src/components/UnifiedReferenceSearch.tsx:
When selectedReleaseId or selectedMoldId is active, the component currently shows a small badge.
Enhance this: Below the badge, render a distinct, highly visible success card (e.g., background: rgba(34, 197, 94, 0.1), border: rgba(34, 197, 94, 0.3)) that says:
✨ Database Link Active: Manufacturer, scale, original release years, and model number will automatically be attached to your horse's passport.

Task 3.2 — Overhaul ShowRecordForm.tsx
Modify src/components/ShowRecordForm.tsx:

Add New Inputs: Add text inputs for Location, Section Name, Category of Award (Breed, Collectibility, Workmanship, Color, Gender), and Level of Competition (Open, Novice, Intermediate, Youth).

Fuzzy Date: Add a showDateText input for "Approximate Date (e.g. Spring 2023)" alongside the exact date picker.

Decouple Ribbon Colors: Replace the RIBBON_COLORS array with this culturally agnostic version. Notice we removed "NAN" (handled by the checkbox) and places from the colors:

TypeScript
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
    { value: "Other", label: "Other" },
];
Task 3.3 — Update Add/Edit Horse Forms
Modify src/app/add-horse/page.tsx and src/app/stable/[id]/edit/page.tsx:

New Fields: Under the Identity section, add a text input for finishDetails (Placeholder: "Glossy, Matte, Satin, etc."). Add a publicNotes textarea.

New Section "Show Bio (Optional)": Add a visual divider and inputs for assignedBreed, assignedGender, assignedAge, and regionalId.

Fuzzy Purchase Date: In the Vault section, add purchaseDateText input for "Approximate Date (e.g. 2015)" next to the exact date picker.

Currency Agnosticism: Remove the hardcoded ($) from the "Purchase Price", "Estimated Value", and "Listing Price" labels.

Phase 4: Display UI & Settings Updates
Task 4.1 — Currency Settings
In src/app/settings/page.tsx:

Add a new input in the Profile section for "Preferred Currency Symbol" (e.g., $, £, €, ¥). Map it to the updateProfile action.

Update global components (VaultReveal.tsx, ShowRingGrid.tsx, StableGrid.tsx, Passport) to use the user's preferred currency symbol instead of a hardcoded $. Note: for public views like the Show Ring, you'll need to fetch the owner's currency symbol in the server component.

Task 4.2 — Update Passports & Timeline
Update src/app/community/[id]/page.tsx and src/app/stable/[id]/page.tsx:

Render the new finish_details next to the Finish Type.

Create a new "Show Bio" card below the Model Details if assigned_breed, assigned_gender, assigned_age, or regional_id exist.

Render public_notes as a distinct section.

Join users to get currency_symbol for pricing display.

Update src/components/ShowRecordTimeline.tsx:

Display the new fields (location, section_name, award_category, competition_level) gracefully alongside existing metadata.

If showDateText exists, display it. Otherwise use showDate. If both are missing, default to "Date unknown".

Update src/app/globals.css:

Add the missing ribbon colors to match the new dots:

CSS
.show-record-item.ribbon-brown::before { background: #8B4513; }
.show-record-item.ribbon-gray::before { background: #9CA3AF; }
.show-record-item.ribbon-light-blue::before { background: #7DD3FC; }
.show-record-item.ribbon-champion::before { background: linear-gradient(135deg, #3B82F6, #8B5CF6); }
.show-record-item.ribbon-reserve-champion::before { background: linear-gradient(135deg, #EF4444, #F59E0B); }
Final Verification
Run npx next build — must be 0 errors.

Test adding a new horse: ensure the new "Show Bio" fields save and display correctly on the passport.

Test adding a show record: enter a fuzzy date (e.g., "Summer 2012") and a Brown ribbon, and verify it renders on the timeline.