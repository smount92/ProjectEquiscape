---
description: Phase 2 — Trust Architecture & Viral Loops. Parked Export/CoA, Condition History Ledger, Chat Guardrails. Builds marketplace trust and drives off-platform user acquisition.
---

# Phase 2: Trust Architecture & Viral Loops

> **Architecture Reference:** `.agents/docs/master_implementation_blueprint.md` — Phase 2
> **Goal:** Turn off-platform sales into user acquisition loops. Protect marketplace integrity without escrow.
> **Commit message pattern:** `feat: Phase 2.[A|B|C] - [Feature Name]`
> **Prerequisite:** Phase 1 complete ✅

// turbo-all

## Pre-flight

1. Read the master blueprint for full context:

```
View file: c:\Project Equispace\model-horse-hub\.agents\docs\master_implementation_blueprint.md
```

2. Read the developer conventions:

```
View the 02_developer_conventions.md artifact in the brain directory
```

3. Verify clean build:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# FEATURE 2A: "PARKED" EXPORT & CERTIFICATE OF AUTHENTICITY (CoA)
# ═══════════════════════════════════════

> **What:** When a collector sells a horse off-platform (at a live show, via Facebook, etc.), they can "park" the horse, generate a printable Certificate of Authenticity with a QR code. The buyer scans the QR, creates an MHH account, and claims the horse — inheriting its full Hoofprint™ history.
> **Why:** This is the #1 viral growth mechanism. Every off-platform sale becomes an invitation to join MHH.
> **Dependencies:** `qrcode.react`, `@react-pdf/renderer` (already installed from Phase 1B)
> **Commit:** `feat: Phase 2.A - Parked Export & Certificate of Authenticity`

## Step 2A.1: Install Dependencies

```
cd c:\Project Equispace\model-horse-hub && npm install qrcode.react
```

## Step 2A.2: Database Migration

Create `supabase/migrations/024_parked_export.sql`:

```sql
-- ============================================================
-- Migration 024: Parked Export & CoA
-- ============================================================

-- Extend life_stage to include 'parked'
-- Check existing constraint name first
DO $$
BEGIN
  -- Drop old check constraint if it exists
  ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS user_horses_life_stage_check;

  -- Add updated constraint with 'parked'
  ALTER TABLE user_horses ADD CONSTRAINT user_horses_life_stage_check
    CHECK (life_stage IS NULL OR life_stage IN ('blank', 'in_progress', 'completed', 'for_sale', 'parked'));
END $$;

-- Add claim_pin to horse_transfers if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'horse_transfers' AND column_name = 'claim_pin'
  ) THEN
    ALTER TABLE horse_transfers ADD COLUMN claim_pin VARCHAR(6) UNIQUE;
  END IF;
END $$;

-- Index for fast PIN lookups
CREATE INDEX IF NOT EXISTS idx_horse_transfers_claim_pin
  ON horse_transfers (claim_pin) WHERE claim_pin IS NOT NULL;
```

**IMPORTANT:** Present this migration to the user for approval. Wait for confirmation that it has been run in Supabase SQL Editor before proceeding.

## Step 2A.3: Create Server Actions (`src/app/actions/parked-export.ts`)

### `parkHorse`
- Auth check: must own the horse
- Sets `life_stage = 'parked'` on `user_horses`
- Generates a unique 6-character alphanumeric PIN (uppercase, no ambiguous chars like 0/O, 1/I/L)
- Creates a `horse_transfers` row with `claim_pin` set
- Adds a `horse_timeline` entry: `event_type = 'status_change'`, details indicating horse was parked for off-platform sale
- Returns `{ success: true, pin: string, transferId: string }`

### `unparkHorse`
- Auth check: must own the horse
- Sets `life_stage` back to previous state (default: `completed`)
- Deletes the pending `horse_transfers` row with the PIN
- Returns `{ success: true }`

### `getParkedHorseByPin`
- PUBLIC action (no auth required — this is the viral claim landing page)
- Queries `horse_transfers` by `claim_pin`
- If found, returns horse details (name, primary photo, Hoofprint summary) but NOT the claim — user must be authenticated to claim
- Returns `{ success: true, horse: { name, photo, timelineCount, ownerCount } }` or `{ success: false, error: 'Invalid PIN' }`

### `claimParkedHorse`
- Auth check: authenticated user
- Validates PIN
- Transfers horse ownership from old owner to new owner (similar to existing claim flow in `src/app/actions/hoofprint.ts`)
- Updates `horse_transfers` row as `completed`
- Creates `horse_timeline` entry for the transfer
- Creates `horse_ownership_history` entry
- Returns `{ success: true }`

## Step 2A.4: Create CoA PDF Component (`src/components/pdf/CertificateOfAuthenticity.tsx`)

**"use client"** component using `@react-pdf/renderer`:

### Layout (single page):
- **Header:** "Certificate of Authenticity" + MHH logo/branding
- **Horse Info:** Name, reference (if linked), finish type, condition
- **Hoofprint Summary:** "This model has X timeline events and Y previous owners"
- **QR Code:** Large QR code encoding `https://modelhorsehub.com/claim?pin=[PIN]`
- **PIN:** The 6-character PIN displayed prominently below the QR
- **Instructions:** "Scan this QR code or visit modelhorsehub.com/claim and enter PIN [XXXXXX] to claim this model and inherit its full Hoofprint™ history."
- **Footer:** "Generated [date] by Model Horse Hub — modelhorsehub.com"

**AGENT NOTE:** Use `qrcode.react` to generate the QR as a data URI, then embed in the PDF. The PDF must be generated client-side.

## Step 2A.5: Create "Park & Export" UI on Horse Detail Page

Add a "Sell Off-Platform" button to the horse detail/edit page (visible only to owner):
- Opens a modal/panel explaining the process
- "Park This Horse" button → calls `parkHorse` → shows CoA with "Download PDF" and "Print" buttons
- Display the PIN prominently with a copy button
- Show status: "🔒 This horse is parked. Hoofprint history is frozen until claimed by a new owner."
- "Cancel & Unpark" button to reverse

## Step 2A.6: Create Claim Page (`src/app/claim/page.tsx`)

Update the existing `/claim` page (or create if it doesn't exist):
- If URL has `?pin=XXXXXX` query param, auto-fill the PIN field
- PIN input field (6 chars, uppercase)
- "Look Up" button → calls `getParkedHorseByPin`
- If found: display horse preview card (name, photo, Hoofprint summary)
- If user is authenticated: "Claim This Horse" button → calls `claimParkedHorse`
- If user is NOT authenticated: "Create Free Account to Claim" → redirect to `/signup?redirect=/claim?pin=XXXXXX`
- Success state: "🎉 Welcome home! [Horse Name] is now in your stable. View Hoofprint →"

## Step 2A.7: Verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

Test manually:
1. Log in as testbot, pick a horse, click "Sell Off-Platform"
2. Verify horse is parked, PIN is generated, CoA PDF downloads
3. Open `/claim?pin=[PIN]` in incognito
4. Verify horse preview shows (without auth)
5. Log in as a different user, claim the horse
6. Verify horse appears in new owner's stable with full Hoofprint history

---

# ═══════════════════════════════════════
# FEATURE 2B: CONDITION HISTORY LEDGER
# ═══════════════════════════════════════

> **What:** Every time a horse's condition grade changes, auto-log the change with an optional note. Display on the Hoofprint timeline for accountability.
> **Why:** Creates physical accountability. If a seller says "Mint" but the buyer downgrades to "Very Good" after receiving, that's a permanent record.
> **Commit:** `feat: Phase 2.B - Condition History Ledger`

## Step 2B.1: Database Migration

Create `supabase/migrations/025_condition_history.sql`:

```sql
-- ============================================================
-- Migration 025: Condition History Ledger
-- ============================================================

CREATE TABLE condition_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  old_condition TEXT,
  new_condition TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE condition_history ENABLE ROW LEVEL SECURITY;

-- Anyone can view condition history on public horses
CREATE POLICY "View condition history on public horses"
  ON condition_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_horses h
    WHERE h.id = condition_history.horse_id AND h.is_public = true
  ));

-- Owners can always view their own horse's history
CREATE POLICY "Owner views own condition history"
  ON condition_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_horses h
    WHERE h.id = condition_history.horse_id AND h.user_id = auth.uid()
  ));

-- Only allow inserts from the system (via server actions)
CREATE POLICY "System insert condition history"
  ON condition_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = changed_by);

CREATE INDEX idx_condition_history_horse ON condition_history (horse_id, created_at DESC);
```

**IMPORTANT:** Present this migration to the user for approval.

## Step 2B.2: Update Horse Edit Action

In the existing horse edit Server Action (likely `src/app/actions/horse.ts`), find the function that updates `user_horses`. Add logic:

1. Before updating, fetch the current `condition_grade`
2. After updating, if `condition_grade` changed:
   - Insert a row into `condition_history` with old/new values
   - Also insert a `horse_timeline` entry with `event_type = 'condition_change'`

**AGENT NOTE:** Do NOT use a Postgres trigger for this — the Server Action approach lets us access the optional user note. The user should be prompted for a note when changing condition (optional textarea in the edit form).

## Step 2B.3: Add Note Prompt to Edit Form

In the edit horse form (`src/app/stable/[id]/edit/page.tsx` or its client component):
- When user changes the condition grade dropdown, show an optional textarea: "What happened? (optional — visible on Hoofprint)"
- Placeholder: "e.g., 'Minor rub discovered on left hip during cleaning'"
- This note is passed along with the edit action

## Step 2B.4: Display on Hoofprint Timeline

In the Hoofprint/passport page, when rendering `horse_timeline` entries of type `condition_change`:
- Show badge: "Condition changed from [Old] → [New]"
- Show note if present
- Show who made the change and when

Also add a "Condition History" section to the passport that shows `condition_history` as a compact timeline if there are entries.

## Step 2B.5: Verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

Test:
1. Edit a horse, change condition from "Mint" to "Excellent", add a note
2. Verify the Hoofprint timeline shows the condition change entry
3. Verify `condition_history` table has a row

---

# ═══════════════════════════════════════
# FEATURE 2C: CHAT UI GUARDRAILS & TRUST SIGNALS
# ═══════════════════════════════════════

> **What:** Add safety warnings when users discuss risky payment methods in DMs. Show trust signals in chat headers.
> **Why:** Protects users from scams. Builds platform trust without playing escrow.
> **No new tables.** UI-only changes.
> **Commit:** `feat: Phase 2.C - Chat Guardrails & Trust Signals`

## Step 2C.1: Chat Safety Regex

In the message input component (find it in `src/components/` — likely `MessageInput.tsx` or similar within the inbox components):

Add an `onChange` handler that checks:

```typescript
const RISKY_PAYMENT_REGEX = /(venmo|zelle|paypal\s*f\s*(&|and)\s*f|friends\s*and\s*family|cash\s*app|wire\s*transfer)/i;
```

When matched:
- Show a visually distinct, un-dismissible system banner ABOVE the input:
  - "🛡️ **Protect yourself:** Always use PayPal Goods & Services for off-platform payments. Venmo, Zelle, and PayPal Friends & Family offer NO buyer protection."
- The banner should use a warning color (amber/gold background)
- It should NOT block sending — just warn

## Step 2C.2: Trust Signals in Chat Header

In the conversation view header (where the other user's name is shown), add:
- **Account age:** "Member since March 2026" (calculated from `users.created_at`)
- **Completed transfers:** Count of completed `horse_transfers` where user was sender or receiver
- **Rating badge:** Their average star rating (from `user_ratings`) if they have ratings

This data should come from the existing conversation loading query — extend it to join the other user's profile data.

## Step 2C.3: Rating Constraint Enhancement

In the existing `submitRating` Server Action (`src/app/actions/ratings.ts`):
- Check if a completed `horse_transfers` record exists between the two users before allowing a rating submission
- If no transfer exists, still allow but show a softer indicator: "ℹ️ No verified Hoofprint transfer found between you and this user."
- This is a soft constraint for now (don't block existing functionality) — just adds transparency

## Step 2C.4: Verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

Test:
1. Open a conversation, type "Can you do paypal friends and family?" — verify warning appears
2. Type "venmo me" — verify warning appears
3. Type normal text — verify no warning
4. Check chat header shows member-since date and transfer count

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

3. **Git commit:**
```
cd c:\Project Equispace\model-horse-hub && git add -A && git status
```

Review staged files, then:
```
git commit -m "feat: Phase 2 - Trust Architecture & Viral Loops (Parked Export, Condition History, Chat Guardrails)"
git push origin main
```
