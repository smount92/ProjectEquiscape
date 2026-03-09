---
description: Phase 1 — Supply-Side Liquidity. Batch CSV Import, Insurance PDF, and Help ID features. Start here after completing desktop/mobile polish.
---

# Phase 1: Supply-Side Liquidity & Single-Player Value

> **Architecture Reference:** `.agents/docs/master_implementation_blueprint.md` — Phase 1
> **Goal:** Unblock "super-collectors" (200-2000+ models), provide offline-valuable tools, create SEO magnets
> **Commit message pattern:** `feat: Phase 1.[A|B|C] - [Feature Name]`

// turbo-all

## Pre-flight

1. Read the master blueprint for full context:

```
View file: c:\Project Equispace\model-horse-hub\.agents\docs\master_implementation_blueprint.md
```

2. Verify clean build:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# FEATURE 1A: BATCH CSV IMPORT
# ═══════════════════════════════════════

> **What:** Let collectors upload a CSV of their collection, fuzzy-match against the 10,500+ reference database, review matches, and bulk import.
> **Dependencies:** `papaparse`, `fuzzysort`
> **Commit:** `feat: Phase 1.A - Batch CSV Import & Reconciliation`

## Step 1A.1: Install Dependencies

```
cd c:\Project Equispace\model-horse-hub && npm install papaparse fuzzysort && npm install -D @types/papaparse
```

## Step 1A.2: Create Types (`src/lib/types/csv-import.ts`)

Create the TypeScript types for the CSV import flow:

```typescript
export interface CsvRow {
  [key: string]: string;
}

export interface CsvMapping {
  name: string | null;
  mold: string | null;
  manufacturer: string | null;
  condition: string | null;
  finish_type: string | null;
  purchase_price: string | null;
  estimated_value: string | null;
  notes: string | null;
}

export interface MatchResult {
  csvRow: CsvRow;
  rowIndex: number;
  status: 'perfect' | 'review' | 'no_match';
  matches: ReferenceMatch[];
  selectedMatch: ReferenceMatch | null;
  customName: string;
}

export interface ReferenceMatch {
  id: string;
  score: number;
  display: string; // e.g. "Breyer #700195 — Bay Appaloosa SM (1999-2003)"
  manufacturer: string;
  mold_name: string;
  release_name: string;
  table: 'reference_releases' | 'artist_resins';
}
```

## Step 1A.3: Create Server Action (`src/app/actions/csv-import.ts`)

Create two Server Actions:

### `matchCsvBatch`
- Receives mapped JSON rows (NOT the raw CSV — parsing was client-side)
- Fetches `reference_releases` with joined `reference_molds` fields
- Also fetches `artist_resins`
- For each row, uses `fuzzysort` to find top 3 matches
- Returns array of `MatchResult` objects with status (perfect/review/no_match)
- **Perfect match threshold:** Score >= -50
- **Review match threshold:** Score between -50 and -200
- **No match:** Score < -200

### `executeBatchImport`
- Receives confirmed `MatchResult[]` array
- Uses Supabase RPC to wrap the entire batch in a single Postgres transaction
- For each row:
  - Insert into `user_horses` (set `reference_mold_id` or `artist_resin_id` from selected match)
  - If purchase_price or estimated_value provided, insert into `financial_vault`
- Returns `{ success: true, imported: count }` or `{ success: false, error: string }`

**AGENT NOTE:** The RPC function must be created as a migration. Create `supabase/migrations/023_batch_import_rpc.sql`. Present the migration to the user for approval BEFORE writing component code.

## Step 1A.4: Create Client Component (`src/components/CsvImport.tsx`)

**"use client"** component with 4 steps:

1. **Upload Step:** Drag-and-drop zone + file input. `papaparse` reads CSV locally in browser. Show preview of first 5 rows.
2. **Mapping Step:** For each detected CSV column, show a dropdown to map it to an MHH field (name, mold, condition, etc.). Auto-detect common headers.
3. **Reconciliation Step:** Display the 3-state list:
   - ✅ Green cards — perfect matches, ready to import
   - ⚠️ Yellow cards — show dropdown of top 3 matches to select from
   - ❌ Red cards — user can type a custom name, mark as "Custom/Unknown", or search manually
   - Show counts: "42 perfect | 8 review | 3 no match"
4. **Import Step:** "Import X models" button. Progress bar. Success summary.

**CSS:** Add all new styles to `src/app/globals.css`. Use the existing glassmorphism design tokens.

## Step 1A.5: Create Page (`src/app/stable/import/page.tsx`)

Server Component page at `/stable/import`:
- Auth check → redirect to login if unauthenticated
- Render the `<CsvImport />` client component
- Add a link to this page from the dashboard (near the "Add Horse" button)

## Step 1A.6: Create CSV Template

Create `public/templates/mhh_import_template.csv` with example rows:

```csv
Name,Mold/Model,Manufacturer,Condition,Finish Type,Purchase Price,Estimated Value,Notes
"Midnight Dream","Adios","Breyer","Mint","OF","45.00","65.00","From BreyerFest 2024"
"Prairie Rose","SM Standing Stock Horse","Breyer","Near Mint","Custom","120.00","200.00","Custom by Amanda Mount"
```

Add a "Download Template" link in the upload step.

## Step 1A.7: Verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

Test manually:
1. Log in as testbot
2. Navigate to `/stable/import`
3. Upload the template CSV
4. Verify mapping auto-detects columns
5. Verify fuzzy matching returns results
6. Import and verify horses appear in stable

---

# ═══════════════════════════════════════
# FEATURE 1B: INSURANCE PDF GENERATOR
# ═══════════════════════════════════════

> **What:** One-click PDF report of entire collection with photos, values, and condition grades.
> **Dependencies:** `@react-pdf/renderer`
> **Commit:** `feat: Phase 1.B - Insurance PDF Generator`

## Step 1B.1: Install Dependencies

```
cd c:\Project Equispace\model-horse-hub && npm install @react-pdf/renderer
```

## Step 1B.2: Create PDF Template (`src/components/pdf/InsuranceReport.tsx`)

**"use client"** component using `@react-pdf/renderer`:

### Cover Page
- "Collection Insurance Report" header
- User name (alias_name) + date stamp
- Total model count
- Total estimated vault value
- MHH logo/branding watermark

### Summary Table (1 page)
- Table with columns: #, Name, Reference, Condition, Estimated Value
- One row per horse, sorted by value descending
- Total row at bottom

### Detail Pages (4 horses per page)
- For each horse: Primary photo (thumbnail), Name, Finish Type, Condition Grade, Purchase Price, Estimated Value
- If no photo, show placeholder

**AGENT NOTE:** Remote Supabase signed URLs may be blocked by CORS in the PDF renderer. The Server Action must:
1. Fetch each horse's primary image signed URL
2. Fetch the image data and convert to base64 data URI
3. Pass base64 strings to the client component for PDF rendering

## Step 1B.3: Create Server Action (`src/app/actions/insurance-report.ts`)

### `getInsuranceReportData`
- Fetches `user_horses` for authenticated user
- Joins `financial_vault` (PRIVATE — only for own user)
- Joins `horse_images` (primary thumbnail only)
- Fetches each image as base64 via server-side fetch
- Returns: `{ user, horses: [{ name, reference, condition, finish, purchasePrice, estimatedValue, photoBase64 }], totals }`

## Step 1B.4: Create Page / Dashboard Integration

Add "Generate Insurance Report" button to the dashboard (`src/app/(authenticated)/page.tsx`):
- Button in the analytics widget area
- On click: shows loading state → calls server action → renders PDF client-side → opens download dialog
- Button text: "📄 Insurance Report (PDF)"

## Step 1B.5: Verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

Test manually:
1. Log in as testbot (must have horses with financial vault data)
2. Click "Insurance Report" on dashboard
3. Verify PDF generates with cover page, summary, and detail pages
4. Verify photos render (or placeholder if none)
5. Verify vault values are correct and match dashboard totals

---

# ═══════════════════════════════════════
# FEATURE 1C: HELP ME ID THIS MODEL
# ═══════════════════════════════════════

> **What:** Community-powered model identification with upvoting and 1-click add to stable.
> **Commit:** `feat: Phase 1.C - Help Me ID This Model`

## Step 1C.1: Database Migration

Create `supabase/migrations/023_help_id.sql`:

```sql
-- ============================================================
-- Migration 023: Help Me ID This Model
-- ============================================================

CREATE TABLE id_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  accepted_suggestion_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE id_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view requests"
  ON id_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner inserts requests"
  ON id_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates own requests"
  ON id_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_id_requests_status ON id_requests (status, created_at DESC);

---

CREATE TABLE id_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES id_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference_release_id UUID REFERENCES reference_releases(id),
  artist_resin_id UUID REFERENCES artist_resins(id),
  free_text TEXT,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT at_least_one_suggestion CHECK (
    reference_release_id IS NOT NULL OR artist_resin_id IS NOT NULL OR free_text IS NOT NULL
  )
);

ALTER TABLE id_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view suggestions"
  ON id_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can suggest"
  ON id_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates own suggestions"
  ON id_suggestions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_id_suggestions_request ON id_suggestions (request_id, upvotes DESC);
```

**IMPORTANT:** Present this migration to the user for approval. Wait for confirmation that it has been run in Supabase SQL Editor before proceeding.

## Step 1C.2: Create Server Actions (`src/app/actions/help-id.ts`)

- `createIdRequest` — Upload image to storage, create `id_requests` row
- `createSuggestion` — Insert `id_suggestions` with reference search
- `upvoteSuggestion` — Increment upvotes (use RPC to prevent race conditions)
- `acceptSuggestion` — Update request status to 'resolved', set accepted_suggestion_id
- `addIdentifiedHorse` — 1-click create `user_horses` row from accepted suggestion's reference data

## Step 1C.3: Create Page (`src/app/community/help-id/page.tsx`)

Server Component page showing:
- Feed of open requests (most recent first)
- Each request card shows: photo, description, suggestion count, status badge
- Link to individual request page

## Step 1C.4: Create Request Detail Page (`src/app/community/help-id/[id]/page.tsx`)

- Full-size photo of the mystery model
- Description
- List of suggestions with upvote buttons
- If OP: "Accept" button on each suggestion
- If resolved: show accepted answer with "Add to My Stable" CTA

## Step 1C.5: Create Request Form Component

**"use client"** component for submitting new ID requests:
- Photo upload (with compression)
- Description textarea
- "Any identifying marks?" prompt

## Step 1C.6: Add Navigation Link

Add "Help ID" link to the community navigation or Show Ring page header.

## Step 1C.7: Verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

Test manually:
1. Log in as testbot
2. Navigate to `/community/help-id`
3. Submit a test request with a photo
4. Log in as a different user (or use admin)
5. Submit a suggestion linking to a reference release
6. As original poster, accept the suggestion
7. Verify "Add to My Stable" creates a horse entry

---

# ═══════════════════════════════════════
# POST-PHASE CHECKLIST
# ═══════════════════════════════════════

After completing all three features:

1. **Build verification:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

2. **Update documentation:**
   - Update the master blueprint's "What's Shipped" section
   - Update the roadmap workflow
   - Update the onboard workflow if new patterns were established

3. **Git commit:**
```
cd c:\Project Equispace\model-horse-hub && git add -A && git status
```

Review staged files, then:
```
git commit -m "feat: Phase 1 - Supply-Side Liquidity (CSV Import, Insurance PDF, Help ID)"
git push origin main
```
