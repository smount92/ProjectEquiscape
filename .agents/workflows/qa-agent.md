---
description: QA Agent testing workflow — automated browser-based tests against live/dev deployment. Requires test accounts to be pre-created.
---

# QA Agent Workflow

## Prerequisites
Before running this workflow, the USER must:
1. Create 3 test accounts via `/signup` using Gmail `+` aliases (see Phase 0 below)
2. Confirm all 3 emails
3. Provide the site URL and credentials

## Phase 0: Account Setup (USER does this manually)

Create these accounts at `{SITE_URL}/signup`:

| Actor | Alias | Suggested Email | Password |
|-------|-------|----------------|----------|
| Actor A (Seller) | `QA_Seller` | `smount92+seller@gmail.com` | `QaTest2026!` |
| Actor B (Buyer) | `QA_Buyer` | `smount92+buyer@gmail.com` | `QaTest2026!` |
| Actor C (Competitor) | `QA_Racer` | `smount92+racer@gmail.com` | `QaTest2026!` |

After creating, log into each and:
- Actor A: Add at least 5 horses with photos, create an Art Studio profile, set 2 horses as "For Sale"
- Actor B: Add at least 2 horses, add 3 items to wishlist
- Actor C: Add at least 1 horse

Once done, tell the agent to proceed with Phase 1.

---

## Phase 1: Form Validation & Read-Only Tests (as QA_Seller)

### Test Auth-01: Alias Boundary Testing
1. Open `{SITE_URL}/signup` in the browser
2. Enter alias `a!` (too short + special char), fill valid email/password, click submit
3. **Verify:** Error message rejects the alias (either "too short" or "invalid characters")
4. Try alias `admin!@#` — verify rejection
5. Try alias `QA_Seller` (existing) — verify "alias already taken" error
6. Screenshot all error states
7. **Return:** Pass/Fail for each sub-case

### Test Add-01: Category Toggle (Tack)
1. Login as QA_Seller at `{SITE_URL}/login`
2. Navigate to `{SITE_URL}/add-horse`
3. In the Category selector, choose "Tack & Gear"
4. **Verify:** "Finish Type", "Condition Grade", and "Life Stage" fields are NOT visible in the DOM
5. Fill in required fields (name: "Test Halter"), submit
6. **Verify:** Success — horse appears in stable
7. Navigate to the new horse's passport page
8. **Verify:** No "Finish Type" or "Condition" rows in the detail card
9. **Return:** Pass/Fail + screenshot

### Test Cat-01: Breyer Adios Split Search
1. Navigate to `{SITE_URL}/add-horse`
2. In the Reference Search field, type "Breyer Adios"
3. **Verify:** At least 1 result appears matching the Adios mold by Breyer
4. **Return:** Pass/Fail + screenshot of results

### Test Art-01: Manual Artist Spoof
1. Navigate to `{SITE_URL}/add-horse`
2. Fill required fields, type "Brigitte Eberl" in the "Finishing Artist" field
3. Submit the horse
4. Navigate to the horse's passport page
5. **Verify:** "Finished by" shows "Brigitte Eberl" but NO ✅ checkmark/badge
6. **Return:** Pass/Fail + screenshot

### Test Sho-01: Handler Time Conflict
1. Navigate to `{SITE_URL}/shows/planner`
2. Create a new show string named "QA Conflict Test"
3. Add Horse A to Class "Arabian Stallion" with time slot "10:00 AM"
4. Add Horse B to Class "Morgan Mare" with time slot "10:00 AM"
5. **Verify:** ⚠️ conflict warning appears with "Handler Time Conflict" or similar
6. **Return:** Pass/Fail + screenshot

### Test Sho-02: String Duplication
1. On the show planner page, find the show string with entries
2. Click the 📋 (Duplicate) button
3. **Verify:** A new show string appears with "(copy)" or similar suffix, with the same entry count
4. **Return:** Pass/Fail + screenshot

### Test Sho-03: Batch Results UX
1. Expand the duplicated show string
2. Click "🏆 Enter Results"
3. Tab through and enter: 1st, 2nd, 3rd for the first 3 entries
4. **Verify:** NAN Points summary updates in real-time
5. Click "💾 Save Results"
6. **Verify:** "✅ Saved!" appears
7. **Return:** Pass/Fail + screenshot

### Test CSV-02: XSS Sanitization
1. Navigate to `{SITE_URL}/stable/import`
2. Create a CSV file with content:
   ```
   Name,Finish Type,Condition
   <script>alert('hack')</script>,OF,Excellent
   ```
3. Upload and import
4. Navigate to the dashboard
5. **Verify:** The horse name renders as literal text `<script>alert('hack')</script>`, NOT executing JavaScript
6. **Return:** Pass/Fail + screenshot

### Test Soc-03: Private Group Leakage
1. Note: This test requires a private group to exist. If none exists, skip.
2. Login as QA_Buyer (non-member)
3. Navigate directly to `/community/groups/{private-group-slug}`
4. **Verify:** Access is blocked (redirect or "Not a member" message)
5. **Return:** Pass/Fail + screenshot

---

## Phase 2: Commerce & Transfer Tests (requires Actor switching)

### Test Com-05: Buyer Retraction
1. Login as QA_Buyer
2. Navigate to a "For Sale" horse owned by QA_Seller
3. Click "Make Offer", enter $50, submit
4. **Verify:** Redirected to DM/inbox with offer card showing "⏳ Waiting for seller response"
5. Click "↩️ Retract Offer"
6. **Verify:** Offer status changes to "❌ Offer Declined" / cancelled
7. **Return:** Pass/Fail + screenshot

### Test Com-04: Ghosting Buyer
1. Login as QA_Buyer, make a new offer on a QA_Seller horse
2. Login as QA_Seller, go to inbox, accept the offer
3. **Verify:** Status shows "pending_payment"
4. (Do NOT mark as paid — simulating ghost)
5. Click "🚫 Cancel / Dispute"
6. **Verify:** Transaction cancelled, horse re-listed
7. **Return:** Pass/Fail + screenshot

### Test Com-02: State Locking
1. Login as QA_Buyer, make offer on a QA_Seller horse
2. Login as QA_Seller, accept the offer
3. Navigate to Edit Horse page for that horse
4. Attempt to change trade status back to "For Sale"
5. **Verify:** The system blocks this (either the field is disabled or save fails with error)
6. Cancel the transaction to clean up
7. **Return:** Pass/Fail + screenshot

### Test Com-03: Rug Pull Defense
1. Set up an accepted offer in pending_payment state (repeat steps above)
2. As QA_Seller, navigate to the horse passport
3. Click "Delete Horse"
4. **Verify:** Error message appears: "Cannot delete a horse locked in an active transaction" (or similar)
5. Cancel the transaction to clean up
6. **Return:** Pass/Fail + screenshot

### Test Trn-02: Self-Claim
1. Login as QA_Seller
2. Navigate to a horse's passport page
3. Click "Transfer" → generate a transfer PIN
4. Navigate to `/claim`
5. Enter the PIN
6. **Verify:** System rejects with "Cannot claim your own transfer" or similar
7. **Return:** Pass/Fail + screenshot

### Test Stu-01: Missing Link (Commission Horse Picker)
1. Login as QA_Buyer
2. Navigate to QA_Seller's Art Studio page (if exists)
3. Click "Request Commission"
4. **Verify:** A horse selector dropdown/picker appears in the form
5. Select a horse from QA_Buyer's stable
6. **Return:** Pass/Fail + screenshot (don't submit unless testing full flow)

### Test Stu-02: WIP Privacy
1. (Requires an active commission between QA_Seller and QA_Buyer)
2. Login as QA_Seller (artist), navigate to the commission
3. Add a WIP update, UNCHECK "Visible to client"
4. Login as QA_Buyer (client), navigate to the same commission
5. **Verify:** The private WIP update is NOT visible
6. **Return:** Pass/Fail + screenshot

---

## Phase 3: Show Engine & Expert Judging

### Test Sho-04: Expert Judged Protection
1. Login as QA_Seller
2. Navigate to `/community/events/create`
3. Create a show with judging_method = "Expert Judge"
4. Navigate to the event detail page
5. Login as QA_Buyer, enter a horse
6. **Verify:** No vote/heart button visible for normal users
7. Login as QA_Seller (creator), navigate to event detail
8. **Verify:** "🏅 Assign Placings" section is visible
9. **Return:** Pass/Fail + screenshot

### Test Sho-05: Self-Voting Block
1. Login as QA_Seller
2. Enter a horse in a community-voted show
3. Attempt to click the vote button on your own entry
4. **Verify:** Vote is rejected (button disabled, error, or count unchanged)
5. **Return:** Pass/Fail + screenshot

---

## Phase 4: Human-Only Tests

The following tests MUST be done by the human operator. They are listed here for tracking:

### DB Verification Tests (Supabase Dashboard)
- [ ] Del-03: Query `users` for deleted actor — verify alias_name = "[Deleted Collector]"
- [ ] Del-04: Query `user_horses` for orphan state
- [ ] Trn-03: Verify `financial_vault` data wiped post-transfer
- [ ] Trn-04: Manually set `expires_at` to past, test `/claim`

### DevTools / Network Tests
- [ ] Auth-04: Console RLS leak test
- [ ] Inf-01: WebSocket tab across 5 browser tabs
- [ ] Inf-02: Verify image compression network payload

### Email Tests
- [ ] Auth-02: Double password reset token race

### Multi-Session Concurrency
- [ ] Com-01: Simultaneous offers from 2 actors
- [ ] Trn-01: Double claim race condition

### Storage Inspection
- [ ] Add-03: Watermark bytes in Supabase Storage
- [ ] Bulk-02: Ghost file GC — verify storage cleanup

### Full Commerce Pipeline
- [ ] Mkt-01/02/03: Requires completing transactions, triggering cron, verifying /market
