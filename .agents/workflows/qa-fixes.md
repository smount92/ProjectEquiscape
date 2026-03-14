---
description: Fix critical security and architecture issues identified in the project audit. Run this before scaling beyond trusted beta testers.
---

# QA Fixes Sprint

> **Source:** 35 total tests (16 automated + 19 manual) on 2026-03-13/14
> **Evidence:** `.agents/docs/QA_Phase1_Results.md`
> **Rule:** FEATURE FREEZE — no new features until all P0/P1 items are resolved.

---

## Phase 1: P0 Fixes (Blocks Core Functionality)

### Fix 1 — Session/Header Auth Sync
**Bug:** Header drops to "logged out" across routes while user is authenticated. Every multi-page flow affected.
**Investigate:**
- `src/components/Header.tsx` — how it reads auth state
- `src/lib/supabase/client.ts` — client singleton
- `src/middleware.ts` — cookie refresh logic
**Fix approach:**
1. Audit Header's auth state source (server-side `getUser()` vs client-side `onAuthStateChange`)
2. Ensure `middleware.ts` refreshes the session cookie on ALL routes
3. If client-side: add a loading/skeleton state before auth resolves
**Verify:** Navigate Stable → Inbox → Studio → Groups → Events without header dropping

---

### Fix 2 — Cancel/Dispute Button (Com-04)
**Bug:** Cancel / Dispute button does nothing. Sellers cannot exit a ghosted `pending_payment` transaction. The button exists but produces no visible state change.
**Investigate:**
- `src/components/OfferCard.tsx` — the Cancel button's `onClick`
- `src/app/actions/transactions.ts` — `cancelTransaction()` server action
- Check if `revalidatePath` is called after the status update
**Fix approach:**
1. Verify `cancelTransaction()` actually updates the DB `status` to `"cancelled"`
2. Ensure the action calls `revalidatePath(/inbox/...)` after update
3. Ensure the UI re-renders the OfferCard after the action resolves (may need `router.refresh()`)
4. Bonus: Fix Make Offer modal flicker/offscreen issue found during this test
**Verify:** As seller, accept an offer → as buyer do nothing → as seller click Cancel → transaction should show "Cancelled"

---

### Fix 3 — Account Deletion Blocked (Del-03)
**Bug:** Users cannot delete their account. Error: `user_horses_life_stage_check` constraint violation.
**Root Cause:** The deletion flow likely tries to nullify or anonymize horse data, setting `life_stage` to a value not in the check constraint's allowed list.
**Investigate:**
- `src/app/actions/account.ts` or equivalent — the delete account server action
- Supabase migration files — find the `user_horses_life_stage_check` constraint definition
- Check what value `life_stage` is being set to during deletion
**Fix approach:**
1. Find the constraint: `grep -r "life_stage_check" supabase/migrations/`
2. Either:
   - a) Delete the user's horses before deleting the user account, OR
   - b) Transfer horses to an "[Orphaned]" system user, OR
   - c) Add NULL or a "deleted" value to the `life_stage_check` constraint's allowed list
3. Test the full deletion flow end-to-end
**Verify:** Create a throwaway account with 1 horse → delete it → verify alias becomes "[Deleted Collector]"

---

## Phase 2: P1 Fixes (Critical Commerce/Shows)

### Fix 4 — Horse State Locking (Com-02)
**Bug:** Horse marketplace status can be changed during an active transaction. Seller can relist while buyer is paying.
**Fix approach:**
1. In the Edit Horse server action, check for active transactions:
```typescript
const { data: activeTxn } = await supabase
  .from("transactions")
  .select("id, status")
  .eq("horse_id", horseId)
  .in("status", ["offer_made", "offer_accepted", "pending_payment", "payment_sent"])
  .limit(1)
  .single();

if (activeTxn) {
  return { error: "Cannot change status while a transaction is active." };
}
```
2. In the Edit Horse UI, disable the Marketplace Status dropdown when locked
**Verify:** Accept an offer → try to edit horse status → should be blocked

---

### Fix 5 — Expired PIN Limbo (Trn-04)
**Bug:** After a transfer PIN expires, the horse is stuck showing "Transfer in progress..." with no way to generate a new PIN or cancel.
**Investigate:**
- Transfer PIN generation and consumption logic
- Where "Transfer in progress..." message is rendered
**Fix approach:**
1. On the horse passport/transfer page, check if the active transfer's PIN has expired
2. If expired: auto-clear the transfer state OR show "Transfer expired — Generate New PIN" button
3. Consider adding an on-access check:
```typescript
if (transfer && new Date(transfer.expires_at) < new Date()) {
  // Auto-cancel the expired transfer
  await supabase.from("horse_transfers").update({ status: "expired" }).eq("id", transfer.id);
}
```
**Verify:** Generate PIN → expire it in Supabase → visit horse passport → should show "Generate New PIN" or cleared state

---

### Fix 6 — Expert Judge Show Flow (Sho-04)
**Bug:** Multiple issues — can't assign judges, can't accept entries, can't re-edit shows.
**This is a larger fix — scope to minimum viable:**
1. **Entries not accepted:** Debug the entry acceptance logic — shows in the right state should allow entries
2. **No Edit Event button:** Add an "Edit" link on event detail pages when `event.created_by === currentUser.id`
3. **Judge assignment:** Add a simple judge selector to event settings (user search → assign as judge)
4. Defer full "Assign Placings" flow if it's too complex for this sprint
**Verify:** Create expert-judged show → other user can enter → creator can edit settings

---

### Fix 7 — Blue Book Price Pipeline (Mkt-02)
**Bug:** Completed transactions don't show up in `/market` price data.
**Investigate:**
- `src/app/api/cron/refresh-market-prices/route.ts` — the cron handler
- The materialized view or aggregation query
- Whether transactions with `status = "completed"` are being picked up
**Fix approach:**
1. Check if the cron endpoint works when triggered manually: `curl http://localhost:3000/api/cron/refresh-market-prices`
2. Verify the materialized view query includes the completed transaction
3. If the view exists but is stale: refresh it
4. If there's no aggregation pipeline: build a simple one that unions transaction prices with catalog data
**Verify:** Complete a transaction → trigger cron → check `/market` for the price

---

### Fix 8 — Signup Error Display (Auth-01)
**Bug:** `useActionState` resets form before error state renders. Users get zero feedback.
**File:** `src/app/signup/page.tsx`
**Fix:** Switch from `useActionState` to `useState` + manual server action call:
```typescript
const [error, setError] = useState<string | null>(null);
const [isPending, setIsPending] = useState(false);

async function handleSubmit(formData: FormData) {
  setIsPending(true);
  setError(null);
  const result = await signupAction({error: null, success: false}, formData);
  if (result.error) setError(result.error);
  else if (result.success) { /* success flow */ }
  setIsPending(false);
}
```
**Verify:** Signup with alias `ab` → should show "at least 3 characters" error

---

### Fix 9 — Chat Guardrails in Make Offer Modal (Com-07)
**Bug:** `RISKY_PAYMENT_REGEX` only in `ChatThread.tsx`, missing from `MakeOfferModal.tsx`.
**Fix:**
1. Extract regex to `src/lib/safety.ts`
2. Import in both `ChatThread.tsx` and `MakeOfferModal.tsx`
3. Add warning banner to Make Offer modal message textarea
**Verify:** Type "venmo" in Make Offer message → warning banner appears

---

## Phase 3: P2 Fixes (UX & Polish)

### Fix 10 — Post-Retraction "Transaction is open" (Com-05)
**Bug:** After retracting an offer, conversation footer still shows "Transaction is open" + "Mark as Complete."
**Fix:** Filter out `cancelled` status from transaction banner render logic:
```typescript
if (transaction && !["cancelled", "completed", "disputed"].includes(transaction.status)) {
  // render transaction controls
}
```
**Verify:** Retract offer → conversation should NOT show "Transaction is open"

---

### Fix 11 — Make Offer on Passport Page (Com-01 bonus)
**Bug:** "Make Offer" button only appears on Show Ring, not on individual horse passport pages.
**Fix:** Add `<MessageSellerButton>` (which wraps `MakeOfferModal`) to the horse passport page when `trade_status === "for_sale"` and the viewer is not the owner.
**Verify:** Visit a "For Sale" horse passport → "Make Offer" button should be visible

---

### Fix 12 — Delete Horse Redirect (Bulk-02 bonus)
**Bug:** Deleting a horse redirects to landing page instead of dashboard.
**Fix:** Change `redirect("/")` to `redirect("/dashboard")` in the delete horse server action.
**Verify:** Delete a horse → should land on dashboard

---

### Fix 13 — Make Offer Modal Flicker (Com-04 bonus)
**Bug:** Make Offer button/modal blinks in and out or renders offscreen.
**Investigate:** Likely a conditional render race (auth state check + show/hide toggle competing).
**Fix:** Stabilize the render condition. If the button depends on auth, add a loading state.
**Verify:** View a "For Sale" horse → Make Offer button should be stable

---

## Phase 4: Verification

// turbo
1. Run `npx next build` from `c:\Project Equispace\model-horse-hub`
2. Verify zero build errors
3. Spot-check all fixed items in browser

---

## Completion Checklist

**P0 (must fix):**
- [ ] Fix 1: Header auth sync
- [ ] Fix 2: Cancel/Dispute button works
- [ ] Fix 3: Account deletion unblocked

**P1 (fix before launch):**
- [ ] Fix 4: Horse state locking
- [ ] Fix 5: Expired PIN recovery
- [ ] Fix 6: Expert Judge minimum viable
- [ ] Fix 7: Blue Book price pipeline
- [ ] Fix 8: Signup error display
- [ ] Fix 9: Chat guardrails in offer modal

**P2 (polish):**
- [ ] Fix 10: Post-retraction state
- [ ] Fix 11: Make Offer on passport
- [ ] Fix 12: Delete redirect
- [ ] Fix 13: Make Offer flicker

**Deferred to future sprints:**
- FR-1: Counter-offer negotiation flow
- FR-2: Watermark style customization
- FR-3: Comment visibility in Stable view
- Art-01: Artist verification system (is_verified column + badges)
