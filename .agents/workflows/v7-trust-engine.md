---
description: Phase 2 — Universal Trust & Commerce Engine. Abstract `transactions` out of DM layer, unified `reviews`. Rate any interaction — transfers, commissions, marketplace. Replaces `user_ratings`.
---

# Phase 2: Universal Trust & Commerce Engine

> **Grand Unification Plan — Phase 2 of 5**
> **Pre-requisites:** Phase 1 complete. Migrations 001–043 applied, build clean.
> **Iron Laws in effect:**
> - Zero Data Loss Migrations (PL/pgSQL data migration scripts)
> - Atomic RPCs for state transitions
> - `UNIQUE(transaction_id, reviewer_id)` — one review per party per transaction

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

Currently, **reviews are locked to DM conversations**:

```
user_ratings.conversation_id → conversations(id)
```

This means:
1. ❌ You **cannot** rate someone for a Hoofprint transfer (transfer code → claim) unless you DM'd them first.
2. ❌ You **cannot** rate an artist for an Art Studio commission — there's no conversation.
3. ❌ A Parked Horse buyer **cannot** rate the seller — the whole point of parked export is off-platform sales with no DM.
4. ❌ The `RatingForm` component only appears in `/inbox/[id]` — the conversation thread page.

## The Solution

Abstract a universal `transactions` table that captures ANY value exchange between two parties. Reviews attach to transactions, not conversations.

---

## What We're Replacing

| Legacy Table | Destination |
|---|---|
| `user_ratings` (bound to `conversations`) | `reviews` (bound to `transactions`) |

**Tables NOT touched:**
- `conversations` (stay — DMs still work)
- `messages` (stay)
- `commissions` (stay — but completed commissions now auto-create `transactions`)
- `horse_transfers` / `parked_transfers` (stay — but claims now auto-create `transactions`)

---

## Task 1 — Migration 044: Universal Trust Engine

> ⚠️ **HUMAN REVIEW REQUIRED** before applying this migration.

Create `supabase/migrations/044_universal_trust_engine.sql`:

```sql
-- ============================================================
-- Migration 044: Universal Trust & Commerce Engine (Phase 2)
-- Grand Unification Plan — reviews decoupled from DM conversations
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: CREATE NEW TABLES
-- ══════════════════════════════════════════════════════════════

-- ── Universal Transactions ──
-- Every value exchange between two parties.
-- Reviews attach here, not to conversations.
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL CHECK (type IN (
    'transfer',          -- Hoofprint transfer code claim
    'parked_sale',       -- Parked Horse PIN claim (off-platform)
    'commission',        -- Art Studio commission delivery
    'marketplace_sale'   -- DM-based marketplace sale (legacy + future)
  )),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'completed', 'cancelled'
  )),
  party_a_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- party_a = seller / artist / sender
  party_b_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  -- party_b = buyer / client / receiver (NULL until claimed for pending transfers)
  horse_id      UUID REFERENCES user_horses(id) ON DELETE SET NULL,
  -- Optional: the horse involved (NULL for non-horse transactions)
  commission_id UUID REFERENCES commissions(id) ON DELETE SET NULL,
  -- Optional: link to the commission (for type=commission)
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  -- Optional: link to the DM conversation (for type=marketplace_sale)
  metadata      JSONB DEFAULT '{}',
  -- Flexible: store sale price, transfer code, PIN, etc.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

-- ── Universal Reviews ──
-- Replaces user_ratings. One review per reviewer per transaction.
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  reviewer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars           SMALLINT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  content         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One review per reviewer per transaction
  CONSTRAINT reviews_unique UNIQUE (transaction_id, reviewer_id),
  -- Cannot review yourself
  CONSTRAINT reviews_no_self CHECK (reviewer_id != target_id)
);

-- ══════════════════════════════════════════════════════════════
-- STEP 2: INDEXES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX idx_transactions_party_a  ON transactions (party_a_id, created_at DESC);
CREATE INDEX idx_transactions_party_b  ON transactions (party_b_id, created_at DESC);
CREATE INDEX idx_transactions_horse    ON transactions (horse_id) WHERE horse_id IS NOT NULL;
CREATE INDEX idx_transactions_status   ON transactions (status) WHERE status = 'completed';
CREATE INDEX idx_transactions_commission ON transactions (commission_id) WHERE commission_id IS NOT NULL;
CREATE INDEX idx_transactions_conversation ON transactions (conversation_id) WHERE conversation_id IS NOT NULL;

CREATE INDEX idx_reviews_target     ON reviews (target_id, created_at DESC);
CREATE INDEX idx_reviews_reviewer   ON reviews (reviewer_id);
CREATE INDEX idx_reviews_txn        ON reviews (transaction_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 3: RLS POLICIES
-- ══════════════════════════════════════════════════════════════

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ── Transactions: Read ──
-- Parties can see their own transactions
CREATE POLICY "txn_select" ON transactions FOR SELECT TO authenticated
USING (
  (SELECT auth.uid()) = party_a_id
  OR (SELECT auth.uid()) = party_b_id
);

-- ── Transactions: Insert ──
-- Service Role only (created by server actions during claim/complete flows)
-- No INSERT policy for regular users — that's intentional.

-- ── Transactions: Update ──
-- Parties can update (for status changes)
CREATE POLICY "txn_update" ON transactions FOR UPDATE TO authenticated
USING (
  (SELECT auth.uid()) = party_a_id
  OR (SELECT auth.uid()) = party_b_id
);

-- ── Reviews: Read ──
-- Public — trust signals are visible to everyone
CREATE POLICY "reviews_select" ON reviews FOR SELECT TO authenticated
USING (true);

-- ── Reviews: Insert ──
-- Reviewer must be a party to the transaction
CREATE POLICY "reviews_insert" ON reviews FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = reviewer_id
  AND reviewer_id != target_id
  AND EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = reviews.transaction_id
    AND t.status = 'completed'
    AND ((SELECT auth.uid()) = t.party_a_id OR (SELECT auth.uid()) = t.party_b_id)
  )
);

-- ── Reviews: Delete ──
-- Reviewer can retract their own review
CREATE POLICY "reviews_delete" ON reviews FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = reviewer_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 4: DATA MIGRATION
-- ══════════════════════════════════════════════════════════════

-- 4a: Create synthetic transactions for existing user_ratings
-- Every existing rating was conversation-based, so type = 'marketplace_sale'
INSERT INTO transactions (id, type, status, party_a_id, party_b_id, conversation_id, completed_at, created_at)
SELECT
  gen_random_uuid(),
  'marketplace_sale',
  'completed',
  -- party_a = the seller (the person who was rated in the conversation)
  ur.reviewed_id,
  -- party_b = the buyer (the reviewer)
  ur.reviewer_id,
  ur.conversation_id,
  ur.created_at,  -- completed_at = when rating was left (best approximation)
  ur.created_at
FROM user_ratings ur
-- Deduplicate: one transaction per conversation (may have 2 ratings)
ON CONFLICT DO NOTHING;

-- However, the above might create duplicate transactions for the same conversation
-- if both parties left ratings. Fix: group by conversation_id
-- Better approach: create one transaction per unique conversation_id that has ratings
DELETE FROM transactions WHERE type = 'marketplace_sale';  -- clean slate

INSERT INTO transactions (type, status, party_a_id, party_b_id, conversation_id, completed_at, created_at)
SELECT DISTINCT ON (ur.conversation_id)
  'marketplace_sale',
  'completed',
  c.seller_id,
  c.buyer_id,
  ur.conversation_id,
  MIN(ur.created_at),
  MIN(ur.created_at)
FROM user_ratings ur
JOIN conversations c ON c.id = ur.conversation_id
GROUP BY ur.conversation_id, c.seller_id, c.buyer_id;

-- 4b: Migrate existing ratings → reviews
INSERT INTO reviews (reviewer_id, target_id, stars, content, created_at, transaction_id)
SELECT
  ur.reviewer_id,
  ur.reviewed_id,
  ur.stars,
  ur.review_text,
  ur.created_at,
  t.id
FROM user_ratings ur
JOIN transactions t ON t.conversation_id = ur.conversation_id AND t.type = 'marketplace_sale';

-- ══════════════════════════════════════════════════════════════
-- STEP 5: ALSO CREATE RETROACTIVE TRANSACTIONS
-- For completed transfers and parked sales that happened before this migration
-- ══════════════════════════════════════════════════════════════

-- 5a: Hoofprint transfers (completed)
INSERT INTO transactions (type, status, party_a_id, party_b_id, horse_id, completed_at, created_at, metadata)
SELECT
  'transfer',
  'completed',
  ht.sender_id,
  ht.claimed_by,
  ht.horse_id,
  ht.claimed_at,
  ht.created_at,
  jsonb_build_object('transfer_code', ht.transfer_code)
FROM horse_transfers ht
WHERE ht.status = 'claimed'
  AND ht.claimed_by IS NOT NULL
  AND ht.claim_pin IS NULL;  -- exclude parked sales (handled in 5b)

-- 5b: Parked horse claims (completed)
-- Parked sales reuse horse_transfers with claim_pin column (not a separate table)
INSERT INTO transactions (type, status, party_a_id, party_b_id, horse_id, completed_at, created_at, metadata)
SELECT
  'parked_sale',
  'completed',
  ht.sender_id,
  ht.claimed_by,
  ht.horse_id,
  ht.claimed_at,
  ht.created_at,
  jsonb_build_object('pin', ht.claim_pin)
FROM horse_transfers ht
WHERE ht.status = 'claimed'
  AND ht.claim_pin IS NOT NULL
  AND ht.claimed_by IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- STEP 6: VERIFICATION (run manually)
-- ══════════════════════════════════════════════════════════════
-- SELECT 'user_ratings' AS source, count(*) FROM user_ratings
-- UNION ALL SELECT 'reviews', count(*) FROM reviews
-- UNION ALL SELECT 'conversations with ratings', count(DISTINCT conversation_id) FROM user_ratings
-- UNION ALL SELECT 'transactions (marketplace_sale)', count(*) FROM transactions WHERE type = 'marketplace_sale'
-- UNION ALL SELECT 'transactions (transfer)', count(*) FROM transactions WHERE type = 'transfer'
-- UNION ALL SELECT 'transactions (parked_sale)', count(*) FROM transactions WHERE type = 'parked_sale';
```

**Action:** Write this file. **DO NOT apply yet** — wait for human review.

**Key design decisions:**
- `party_a` is always the seller/artist/sender; `party_b` is always the buyer/client/receiver. Consistent across all types.
- `conversation_id` on transactions fk-links marketplace sales back to DMs. This preserves the inbox context.
- `commission_id` on transactions links commissions back to their art studio origin.
- `metadata JSONB` stores type-specific data (transfer codes, PINs, prices) without column sprawl.
- Retroactive transactions are created for already-completed transfers and parked sales so those users can now go back and leave reviews.

---

## Task 2 — Server Actions: Universal Trust CRUD

Create `src/app/actions/transactions.ts`:

### Functions to implement:

```typescript
"use server";

// ── createTransaction(data) ──
// Called internally by claim flows. NOT user-facing.
// Params: type, partyAId, partyBId, horseId?, commissionId?, conversationId?, metadata?
// Returns: { success: boolean; transactionId?: string }

// ── completeTransaction(transactionId) ──
// Marks a transaction as completed. Called when:
//   - markTransactionComplete() in messaging.ts
//   - claimTransfer() in hoofprint.ts
//   - claimParkedHorse() in parked-export.ts
//   - updateCommissionStatus() to "delivered" in art-studio.ts

// ── getTransactionsForUser() ──
// Returns all transactions where user is party_a or party_b.
// Include reviews for each transaction.

// ── leaveReview(data) ──
// Replaces leaveRating(). Params: transactionId, targetId, stars, content?
// Constraint: transaction must be completed, user must be a party.

// ── deleteReview(reviewId) ──
// Replaces deleteRating()

// ── getUserReviewSummary(userId) ──
// Replaces getUserRatingSummary(). Reads from reviews table instead.
// Returns: { average, count, reviews[] }

// ── getReviewableTransactions() ──
// Returns completed transactions where the current user has NOT yet left a review.
// This powers a "Leave Review" prompt on the profile page, claim confirmation, etc.
```

---

## Task 3 — Wire Transaction Creation into Claim Flows

Modify these existing actions to auto-create transactions:

### 3a. `src/app/actions/hoofprint.ts` — `claimTransfer()`

After the atomic RPC succeeds, add:
```typescript
// Create a completed transaction for this transfer
import { createTransaction } from "@/app/actions/transactions";
await createTransaction({
    type: "transfer",
    partyAId: result.sender_id!,
    partyBId: user.id,
    horseId: result.horse_id,
    status: "completed",
    metadata: { transfer_code: transferCode },
});
```

### 3b. `src/app/actions/parked-export.ts` — `claimParkedHorse()`

After the atomic RPC succeeds, add:
```typescript
await createTransaction({
    type: "parked_sale",
    partyAId: result.sender_id!,
    partyBId: user.id,
    horseId: result.horse_id,
    status: "completed",
    metadata: { pin },
});
```

### 3c. `src/app/actions/art-studio.ts` — `updateCommissionStatus()`

When status transitions to `"delivered"`, add:
```typescript
await createTransaction({
    type: "commission",
    partyAId: c.artist_id,
    partyBId: c.client_id,
    commissionId: commissionId,
    horseId: c.horse_id,
    status: "completed",
});
```

### 3d. `src/app/actions/messaging.ts` — `markTransactionComplete()`

When marking a conversation complete, add:
```typescript
await createTransaction({
    type: "marketplace_sale",
    partyAId: conversation.seller_id,
    partyBId: conversation.buyer_id,
    conversationId: conversationId,
    horseId: conversation.horse_id,
    status: "completed",
});
```

---

## Task 4 — Update Rating UI

### 4a. Update `RatingForm.tsx`

Currently takes `conversationId` and `reviewedId`. Change to:
- Accept `transactionId` and `targetId` instead
- Call `leaveReview()` from `transactions.ts` instead of `leaveRating()` from `ratings.ts`
- Keep the same star selector + text area UI

### 4b. Update `/inbox/[id]/page.tsx`

When a conversation is marked complete:
1. Look up (or create) the `transaction` for this conversation
2. Pass `transactionId` to `RatingForm` instead of `conversationId`

### 4c. Add Review Prompts to New Surfaces

| Surface | When | What |
|---|---|---|
| `/claim` page (after successful claim) | Transfer or Parked claim succeeds | Show "Rate this seller?" with `RatingForm` + `transactionId` |
| `/studio/commission/[id]` | Commission delivered | Show "Rate this artist?" / "Rate this client?" |
| `/profile/[alias_name]` | User has unreviewed transactions with profile owner | Show "You've done business with this user — leave a review?" |

### 4d. Update `getUserRatingSummary` call sites

In `/profile/[alias_name]/page.tsx`, replace:
```typescript
const ratingSummary = await getUserRatingSummary(profileUser.id);
```
with:
```typescript
const ratingSummary = await getUserReviewSummary(profileUser.id);
```

Also update `RatingBadge.tsx`, `RatingStars.tsx` if they reference old data shapes.

---

## Task 5 — Update Legacy Action Files

- `src/app/actions/ratings.ts`: **DEPRECATE.** Redirect `leaveRating()` to call `leaveReview()`. Redirect `getUserRatingSummary()` to call `getUserReviewSummary()`. These shims allow gradual migration.
- `src/app/actions/messaging.ts`: Update `markTransactionComplete()` to create a `transaction` record.

---

## Task 6 — Cleanup & Verification

1. Run `npx next build` — must be 0 errors.
2. Run the verification queries from Step 6 of the migration.
3. Confirm:
   - Existing ratings appear on user profiles (via `reviews` table).
   - New marketplace complete → review flow works in inbox.
   - Transfer claim → review prompt appears.
   - Parked claim → review prompt appears.
   - Commission delivery → review prompt appears.
4. Legacy `user_ratings` table stays until next cleanup migration (045).

---

## Task 7 — Legacy Table Drop (Migration 045)

**Only AFTER all code reads from `reviews` table:**

Create `supabase/migrations/045_drop_legacy_ratings.sql`:
```sql
-- Safe to run after all code migrated to reviews table
DROP TABLE IF EXISTS user_ratings CASCADE;
```

---

## Completion Checklist

**Schema & Migration**
- [x] Migration 044 written (`044_universal_trust_engine.sql`) ✅ 2026-03-11
- [x] Human reviewed and approved SQL ✅ 2026-03-11
- [x] Migration applied to production ✅ 2026-03-11
- [ ] Verification queries confirm 0 data loss
- [x] Retroactive transactions created for past transfers + parked sales ✅ 2026-03-11
- [x] `discover_users_view` updated to read from `reviews` ✅ 2026-03-11

**Server Actions**
- [x] `src/app/actions/transactions.ts` — createTransaction, completeTransaction, leaveReview, deleteReview, getUserReviewSummary, getReviewableTransactions, getTransactionByConversation ✅ 2026-03-11
- [x] `claimTransfer()` → auto-creates transaction ✅ 2026-03-11
- [x] `claimParkedHorse()` → auto-creates transaction ✅ 2026-03-11
- [x] `updateCommissionStatus("delivered")` → auto-creates transaction ✅ 2026-03-11
- [x] `markTransactionComplete()` → auto-creates transaction ✅ 2026-03-11
- [x] Legacy `ratings.ts` redirected to new functions ✅ 2026-03-11

**UI Components**
- [x] `RatingForm.tsx` updated to accept `transactionId` ✅ 2026-03-11
- [ ] Review prompt on `/claim` page after successful claim
- [ ] Review prompt on `/studio/commission/[id]` after delivery
- [ ] Review prompt on `/profile/[alias_name]` for unreviewed transactions
- [x] `getUserReviewSummary()` used on profile page ✅ 2026-03-11
- [x] Inbox reads reviews from `reviews` table ✅ 2026-03-11

**Cleanup**
- [x] `npx next build` — 0 errors ✅ 2026-03-11
- [ ] Existing ratings display correctly on profiles
- [ ] New review flow works end-to-end (all 4 transaction types)

**DO NOT proceed to Phase 3 until this checklist is fully complete and human has verified.**

**Estimated effort:** ~8-12 hours
