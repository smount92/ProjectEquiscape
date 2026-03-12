---
description: "Phase 6 Epic 4 — Safe-Trade Commerce State Machine. Formal offer/accept/pay/release flow with 4-step transaction states. Replaces ad-hoc DM-based trading. 3 tasks across schema, server actions, and UI."
---

# Phase 6 — Epic 4: The Commerce State Machine (Safe-Trade Engine)

> **Master Blueprint:** `docs/Phase6_Master_Blueprint.md` — Epic 4
> **Philosophy:** "Right, not fast." Formalize the commerce flow into an auditable state machine. No more ambiguous "mark as complete" buttons. Every step has a clear owner and action.
> **The Problem:** Currently, trading is ad-hoc: buyers click "Message Seller" → chat in DMs → someone clicks "Mark as Complete" → transaction is recorded. There are no safeguards against scams, no structured offer/acceptance, and no automatic PIN generation at the right moment.
> **The Goal:** Replace this with a strict 4-step state machine: `offer_made` → `pending_payment` → `funds_verified` → `completed`.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:**
> 1. Add `✅ DONE` and the date after each task heading when complete
> 2. Run `npx next build` after every task
> 3. This epic requires database migration `060_commerce_state_machine.sql`
> 4. **Do not break existing conversations or transactions.** All existing completed transactions remain untouched.
> 5. The Offer Card and Safe-Transfer flow render inside the existing `ChatThread` component — not a separate page.

---

## Pre-Flight: Existing Infrastructure

| System | File | Current State |
|---|---|---|
| `transactions` table | Migration `044_universal_trust_engine.sql` | Status: `pending`, `completed`, `cancelled`. Types: `transfer`, `parked_sale`, `commission`, `marketplace_sale` |
| `createTransaction()` | `actions/transactions.ts:14` | Inserts row with type, status, parties, horse, metadata |
| `markTransactionComplete()` | `actions/messaging.ts:241` | Sets `conversation.transaction_status = 'completed'`, creates transaction |
| `createOrFindConversation()` | `actions/messaging.ts:7` | Finds/creates buyer↔seller conversation for a horse |
| `MessageSellerButton` | `components/MessageSellerButton.tsx` | Opens DM. Currently says "Message Seller" for all trade statuses |
| `TransactionActions` | `components/TransactionActions.tsx` | Single "Mark as Complete" button inside inbox thread |
| `ChatThread` | `components/ChatThread.tsx` | Real-time messaging with `RISKY_PAYMENT_REGEX` warning |
| `parkHorse()` | `actions/parked-export.ts:23` | Generates 6-char claim PIN, sets `life_stage = 'parked_sale'` |
| `conversations` table | Schema | Has `buyer_id`, `seller_id`, `horse_id`, `transaction_status` |

---

## The State Machine

```
┌─────────────────┐     Seller Accepts      ┌──────────────────┐
│   offer_made    │ ────────────────────────→│ pending_payment  │
│                 │                          │                  │
│ Buyer submitted │     Seller Declines      │ Horse locked to  │
│ amount + msg    │ ─────→ cancelled         │ "Pending Sale"   │
└─────────────────┘                          └──────────────────┘
                                                      │
                                             Buyer clicks
                                             "I Have Paid"
                                                      │
                                                      ▼
┌─────────────────┐     Seller confirms     ┌──────────────────┐
│    completed    │ ←───────────────────────│ funds_verified   │
│                 │                          │                  │
│ Reviews enabled │     Auto: parkHorse()   │ PIN revealed to  │
│ Feed event      │     generates PIN       │ buyer in chat    │
└─────────────────┘                          └──────────────────┘
```

---

## Task 1 — Schema: Expand Transaction States

### Step 1: Create migration `060_commerce_state_machine.sql`

```sql
-- ══════════════════════════════════════════════════════════════
-- Migration 060: Commerce State Machine
-- Expand transaction status to support offer/payment/verification flow
-- ══════════════════════════════════════════════════════════════

-- Drop and recreate the status CHECK constraint to add new states
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
    CHECK (status IN (
        'pending',          -- Legacy (existing system)
        'offer_made',       -- Buyer submitted offer
        'pending_payment',  -- Seller accepted, waiting for buyer to pay
        'funds_verified',   -- Seller confirmed funds, PIN generated
        'completed',        -- Transaction finalized
        'cancelled'         -- Either party cancelled
    ));

-- Add offer-specific metadata columns
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS offer_amount DECIMAL(10,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS offer_message TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Index for active offers (not completed/cancelled)
CREATE INDEX IF NOT EXISTS idx_transactions_active_offers
    ON transactions (horse_id, status)
    WHERE status IN ('offer_made', 'pending_payment', 'funds_verified');
```

### Step 2: Verify migration doesn't break existing data

All existing transactions have `status = 'completed'` or `status = 'pending'` or `status = 'cancelled'`. The new constraint is a superset — no data migration needed.

---

## Task 2 — Server Actions: Offer/Accept/Pay/Verify Flow

### Step 1: Create commerce server actions

Add the following functions to `src/app/actions/transactions.ts`:

#### `makeOffer()`

```typescript
export async function makeOffer(data: {
    horseId: string;
    sellerId: string;
    amount: number;
    message?: string;
}): Promise<{ success: boolean; transactionId?: string; conversationId?: string; error?: string }>
```

Logic:
1. Authenticate user (buyer)
2. Verify buyer ≠ seller
3. Check horse exists, is public, and has trade_status `For Sale` or `Open to Offers`
4. Check for existing active offer on this horse by this buyer (prevent duplicates)
5. Create or find conversation via `createOrFindConversation(sellerId, horseId)`
6. Insert transaction: `type = 'marketplace_sale'`, `status = 'offer_made'`, `offer_amount`, `offer_message`, `conversation_id`, `horse_id`
7. Send notification to seller: `"@buyer made a $XX offer on HorseName"`
8. Return `{ success: true, transactionId, conversationId }`

#### `respondToOffer()`

```typescript
export async function respondToOffer(
    transactionId: string,
    action: "accept" | "decline"
): Promise<{ success: boolean; error?: string }>
```

Logic:
1. Authenticate user (seller)
2. Verify caller is `party_a_id` (seller) on the transaction
3. Verify current status is `offer_made`
4. If **decline**: set `status = 'cancelled'`, notify buyer
5. If **accept**:
   - Set `status = 'pending_payment'`, `accepted_at = now()`
   - Update horse `trade_status = 'Pending Sale'` (lock it)
   - Notify buyer: `"Your offer on HorseName was accepted! Please send payment."`

#### `markPaymentSent()`

```typescript
export async function markPaymentSent(
    transactionId: string
): Promise<{ success: boolean; error?: string }>
```

Logic:
1. Authenticate user (buyer)
2. Verify caller is `party_b_id` (buyer) on the transaction
3. Verify current status is `pending_payment`
4. Set `paid_at = now()` (status stays `pending_payment` — waiting for seller verification)
5. Notify seller: `"@buyer says they've sent payment for HorseName. Please verify."`

#### `verifyFundsAndRelease()`

```typescript
export async function verifyFundsAndRelease(
    transactionId: string
): Promise<{ success: boolean; pin?: string; error?: string }>
```

Logic:
1. Authenticate user (seller)
2. Verify caller is `party_a_id` (seller)
3. Verify current status is `pending_payment` and `paid_at IS NOT NULL`
4. Call `parkHorse(horseId)` from `parked-export.ts` — this generates the claim PIN
5. Set `status = 'funds_verified'`, `verified_at = now()`
6. Store `pin` in transaction metadata
7. Notify buyer: `"Funds verified! Your claim PIN for HorseName is ready."`
8. Return `{ success: true, pin }`

The buyer then uses the existing `/claim` flow with the PIN to complete the transfer, which sets the transaction to `completed`.

### Step 2: Update claim flow to complete the state machine

In `src/app/actions/parked-export.ts`, update `claimParkedHorse()`:

After the horse is claimed, find the related transaction and update it:

```typescript
// After successful claim, close the state machine
const { data: txn } = await supabase
    .from("transactions")
    .select("id")
    .eq("horse_id", horseId)
    .eq("status", "funds_verified")
    .maybeSingle();

if (txn) {
    await supabase
        .from("transactions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", (txn as { id: string }).id);
}
```

---

## Task 3 — UI: Offer Card & Safe-Transfer Flow

### Step 1: Create `MakeOfferModal` component

Create `src/components/MakeOfferModal.tsx`:

```typescript
"use client";

interface Props {
    horseId: string;
    horseName: string;
    sellerId: string;
    onClose: () => void;
    onSuccess: (conversationId: string) => void;
}
```

The modal contains:
- Amount input (number, with $ prefix)
- Optional message textarea
- Submit button → calls `makeOffer()` → redirects to `/inbox/[conversationId]`

### Step 2: Update `MessageSellerButton` for "Open to Offers" horses

In `src/components/MessageSellerButton.tsx`:

Add a new prop: `tradeStatus?: string`

```tsx
// If trade status is "Open to Offers" or "For Sale" → show "Make Offer" instead
if (tradeStatus === "Open to Offers" || tradeStatus === "For Sale") {
    return (
        <button onClick={() => setShowOfferModal(true)} className="btn btn-primary">
            💰 Make Offer
        </button>
    );
}
// Otherwise, keep the existing "Message Seller" button
```

### Step 3: Create `OfferCard` component for ChatThread

Create `src/components/OfferCard.tsx` — renders inside the chat as a rich card:

```
┌─────────────────────────────────────────┐
│  💰 Offer: $150.00                      │
│  "Really interested in this model!"      │
│                                          │
│  [Accept Offer]   [Decline]              │  ← Only visible to seller
│  ─ or ─                                  │
│  Status: Pending Seller Response          │  ← Visible to buyer
└─────────────────────────────────────────┘
```

States:
- `offer_made`: Seller sees Accept/Decline buttons. Buyer sees "Waiting for response."
- `pending_payment`: Both see payment instructions. Buyer sees "I Have Paid" button.
- `funds_verified`: Buyer sees the claim PIN in a highlighted box. Seller sees "Transfer in progress."
- `completed`: Both see "✅ Complete" badge.

### Step 4: Wire OfferCard into ChatThread

In `src/components/ChatThread.tsx`, add the OfferCard above the message history:

```tsx
// At the top of the chat thread:
{transaction && transaction.status !== 'completed' && (
    <OfferCard
        transaction={transaction}
        currentUserId={currentUserId}
        onAction={handleOfferAction}
    />
)}
```

Pass the transaction data from the inbox `[id]/page.tsx` server component (it already fetches `getTransactionByConversation`).

### Step 5: Update TransactionActions for state machine

Replace the simple "Mark as Complete" button with state-aware actions:

```tsx
// For 'pending_payment' + buyer:
<button onClick={handleMarkPaid}>💳 I Have Paid</button>

// For 'pending_payment' + seller (after buyer marked paid):
<button onClick={handleVerifyAndRelease}>✅ Confirm Funds & Release</button>

// For 'funds_verified' + buyer:
<div className="pin-reveal">
    <span>Your claim PIN:</span>
    <strong>{pin}</strong>
    <Link href="/claim">Go to Claim Page →</Link>
</div>
```

### Step 6: CSS for commerce UI

Add to `globals.css` (or create `OfferCard.module.css` if Epic 2 is done):

```css
/* Offer Card — rich embed in chat */
.offer-card {
    background: rgba(124, 109, 240, 0.08);
    border: 1px solid rgba(124, 109, 240, 0.2);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin: var(--space-md) 0;
}

.offer-amount {
    font-size: calc(var(--font-size-xl) * var(--font-scale));
    font-weight: 700;
    color: var(--color-accent-secondary);
}

.offer-actions {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-md);
}

.pin-reveal {
    background: rgba(92, 224, 160, 0.1);
    border: 2px solid var(--color-accent-success);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    text-align: center;
    font-size: calc(var(--font-size-2xl) * var(--font-scale));
    font-weight: 800;
    letter-spacing: 0.15em;
}
```

### Step 7: Build and verify

1. `npx next build` — 0 errors
2. Manual test: Create an offer → Accept → Mark Paid → Verify Funds → Claim PIN
3. Verify the horse is locked to "Pending Sale" after acceptance
4. Verify the PIN is only visible to the buyer after funds verification
5. Verify cancellation restores the horse's trade status

---

## Completion Checklist

**Task 1 — Schema**
- [ ] Migration 060 created
- [ ] Status CHECK constraint updated (6 states)
- [ ] `offer_amount`, `offer_message`, `accepted_at`, `paid_at`, `verified_at` columns added
- [ ] Index on active offers created
- [ ] Existing data unaffected
- [ ] `npx next build` passes

**Task 2 — Server Actions**
- [ ] `makeOffer()` — creates transaction + conversation
- [ ] `respondToOffer()` — accept (locks horse) or decline
- [ ] `markPaymentSent()` — buyer signals payment
- [ ] `verifyFundsAndRelease()` — seller confirms, calls `parkHorse()`, returns PIN
- [ ] `claimParkedHorse()` updated to close state machine
- [ ] All notifications sent at each state transition
- [ ] `npx next build` passes

**Task 3 — UI Components**
- [ ] `MakeOfferModal.tsx` created (amount + message + submit)
- [ ] `MessageSellerButton` shows "Make Offer" for tradeable horses
- [ ] `OfferCard.tsx` created with 4 state renderings
- [ ] `OfferCard` wired into `ChatThread`
- [ ] `TransactionActions` updated for state-aware buttons
- [ ] PIN reveal component styled and functional
- [ ] CSS for offer card, amount, actions, pin reveal
- [ ] `npx next build` passes

**Estimated effort:** ~8-12 hours across 3 tasks
