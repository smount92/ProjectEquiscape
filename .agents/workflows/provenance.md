---
description: Implement the Provenance Tracking feature (Show Records & Pedigree Card) — step-by-step through 4 atomic tasks
---

# Provenance Tracking Implementation Workflow

This workflow builds Show Records (🏅) and Pedigree Cards (🧬) for horse passports. Execute each task in order — each one depends on the previous.

> **IMPORTANT:** Run `/onboard` first if this is your first time in this session.

---

## Pre-flight Check

1. Confirm you understand the project conventions by reviewing the developer conventions document in the brain artifacts directory (02_developer_conventions.md).
2. Read the full implementation plan in the brain artifacts directory (04_provenance_tracking_plan.md).
3. Confirm the dev server runs without errors:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run dev
```

---

## Task 1: Database Migration

**Goal:** Create the `show_records` and `horse_pedigrees` tables with RLS.

1. Read the full task spec from the brain artifacts directory (task_5_prov_migration.md).

2. Create the file `supabase/migrations/011_provenance_tracking.sql` with the exact SQL from the spec.

3. Inform the user:
   > "Migration file created. Please run `supabase/migrations/011_provenance_tracking.sql` in your Supabase Dashboard SQL Editor, then confirm when done."

4. **STOP and wait for user confirmation** before proceeding.

---

## Task 2: TypeScript Types + Server Actions

**Goal:** Add types for provenance tables and create `provenance.ts` server actions.

1. Read the full task spec from the brain artifacts directory (task_6_prov_types_actions.md).

2. Edit `src/lib/types/database.ts`:
   - Add `ShowRecord` and `HorsePedigree` interfaces
   - Add `show_records` and `horse_pedigrees` to `Database.public.Tables`

3. Create `src/app/actions/provenance.ts` with 5 functions:
   - `addShowRecord` — Insert new record, show_name required
   - `updateShowRecord` — Partial update by record ID
   - `deleteShowRecord` — Delete by ID, RLS enforces ownership
   - `savePedigree` — Upsert: insert or update based on existence
   - `deletePedigree` — Delete pedigree for a horse

4. Verify TypeScript compiles:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npx tsc --noEmit
```

---

## Task 3: Components + CSS

**Goal:** Build ShowRecordForm, ShowRecordTimeline, and PedigreeCard components.

1. Read the full task spec from the brain artifacts directory (task_7_prov_components.md).

2. Create `src/components/ShowRecordForm.tsx`:
   - Modal form with: Show Name*, Date, Division, Placing, Ribbon Color dropdown, Judge, NAN checkbox, Notes
   - Handles both Add and Edit modes via `existingRecord` prop
   - Calls `addShowRecord` or `updateShowRecord` actions

3. Create `src/components/ShowRecordTimeline.tsx`:
   - Vertical timeline with ribbon-colored dots
   - NAN ⭐ badges, owner-only Edit/Delete buttons
   - Local state management for add/edit/delete without page reload
   - Empty state: "No show records yet"

4. Create `src/components/PedigreeCard.tsx`:
   - Glassmorphism card with sire, dam, sculptor, cast/edition rows
   - Inline edit mode for owners
   - "Add Pedigree" CTA for owners when no data exists

5. Add all CSS to `src/app/globals.css` (see task spec for complete styles)

6. Verify the build:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

---

## Task 4: Page Integration

**Goal:** Wire provenance into Private Passport, Public Passport, and Dashboard.

1. Read the full task spec from the brain artifacts directory (task_8_prov_page_integration.md).

2. Modify `src/app/stable/[id]/page.tsx` (Private Passport):
   - Import `ShowRecordTimeline` and `PedigreeCard`
   - Add queries for `show_records` and `horse_pedigrees`
   - Place components between Model Details and Financial Vault
   - Pass `isOwner={true}`

3. Modify `src/app/community/[id]/page.tsx` (Public Passport):
   - Same imports and queries
   - Place components between actions bar and comments section
   - Pass `isOwner={false}`
   - Only render if data exists

4. Modify `src/app/dashboard/page.tsx` (Dashboard):
   - Add count query for user's total show records
   - Add "Show Placings" stat to analytics widget

5. Verify the build:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

6. **Test in browser:**
   - Private passport: add/edit/delete show records and pedigree
   - Public passport: verify read-only provenance display
   - Dashboard: verify show placings counter

---

## Final Verification

1. Run the full build:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

2. Walk through the test checklist:
   - [ ] Owner can add a show record from private passport
   - [ ] Show record appears in timeline with correct ribbon color dot
   - [ ] Owner can edit an existing show record
   - [ ] Owner can delete a show record
   - [ ] NAN records display with ⭐ badge
   - [ ] Timeline sorted by date newest-first
   - [ ] Records visible read-only on public passport
   - [ ] Non-owner cannot see Add/Edit/Delete buttons
   - [ ] Pedigree card: owner can add/edit data
   - [ ] Pedigree card: visible read-only on public passport
   - [ ] Empty state: provenance sections hidden when no data (public)
   - [ ] Dashboard: "Show Placings" stat accurate

3. Commit and push:
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: Provenance Tracking — Show Records & Pedigree Card" && git push
```

---

## Documentation Update (MANDATORY)

> **You are NOT done until this step is complete.** Skipping documentation is not acceptable.

4. Update the **Master Architecture Report** (`00_master_architecture.md` in brain artifacts):
   - Bump version (V1.2 → V1.3)
   - Add `provenance.ts` to actions list
   - Add `ShowRecordForm.tsx`, `ShowRecordTimeline.tsx`, `PedigreeCard.tsx` to components list
   - Add `011_provenance_tracking.sql` to migrations list
   - Add `show_records` and `horse_pedigrees` to DB schema table
   - Add "Provenance Tracking (Show Records + Pedigree)" as completed feature #16
   - Move Provenance from roadmap to completed; update NEXT to "User-to-User Feedback"

5. Update **Provenance Plan** (`04_provenance_tracking_plan.md`):
   - Add `> [!NOTE]` completion banner with date

6. Update **Future Roadmap** (`03_future_roadmap.md`):
   - Mark Provenance as DONE in priority queue
   - Set "User-to-User Feedback" as NEXT

7. Mark task files (`task_5_prov_migration.md`, `task_6_prov_types_actions.md`, `task_7_prov_components.md`, `task_8_prov_page_integration.md`) as COMPLETE

8. Inform the user: **"✅ Provenance Tracking — Complete!"** with:
   - Summary of files created and modified
   - Confirmation that all documentation has been updated
   - What the next feature on the roadmap is
