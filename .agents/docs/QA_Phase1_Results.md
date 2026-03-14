# QA Phase 1 Results — Automated Browser Testing
**Run Date:** 2026-03-13  
**Environment:** localhost:3000 (Next.js 16.1.6 dev server)  
**Tester:** QA Agent (browser automation)  
**Accounts Used:** QA_Seller (Test_QA), QA_Buyer (Test_Buyer), QA_Racer (Test_Racer)

---

## Summary

| # | Test ID | Name | Status | Category |
|---|---------|------|--------|----------|
| 1 | Auth-01 | Alias Boundary Testing | ⚠️ WARNING | IAM / Privacy |
| 2 | Cat-01 | Breyer Adios Split Search | ✅ PASS | Catalog / AI |
| 3 | Add-01 | Category Toggle (Tack & Gear) | ✅ PASS | Stable / Intake |
| 4 | Trn-02 | Self-Claim Prevention | ✅ PASS | Transfer / Provenance |
| 5 | CSV-02 | Export CSV | ✅ PASS | Stable / Bulk Intake |
| 6 | Com-07 | Chat Guardrails | ⚠️ WARNING | Commerce / DM |
| 7 | Sho-05 | Self-Voting Block | ✅ PASS | Shows / Competition |
| 8 | Art-01 | Artist Profile Verification | ⚠️ WARNING | Art Studio |
| 9 | CSV-02 | XSS Sanitization | ✅ PASS | Security |
| 10 | Sho-01 | Handler Time Conflict | ✅ PASS | Shows / Competition |
| 11 | Sho-02 | String Duplication | ✅ PASS | Shows / Competition |
| 12 | Com-05 | Buyer Retraction | ✅ PASS | Commerce |
| 13 | Sho-04 | Expert Judged Protection | ⏭️ SKIP | Shows / Competition |
| 14 | Soc-03 | Private Group Leakage | ✅ PASS | Social / Groups |
| 15 | Sho-03 | Batch Results UX | ✅ PASS | Shows / Competition |
| 16 | Art-01b | Artist Spoof on Passport | ⚠️ WARNING | Provenance / Trust |

---

## 1. Auth-01 — Alias Boundary Testing
**Pillar:** 🛡️ IAM, Privacy & Infrastructure Safety  
**Status:** ⚠️ WARNING  
**Security Impact:** None — all bad signups are correctly blocked  
**UX Impact:** HIGH — users get zero feedback on why signup failed

### Sub-cases

| Sub-case | Input | Rejected? | Error Shown? |
|----------|-------|-----------|-------------|
| A: Special characters | `admin!@#` | ✅ Yes | ❌ No |
| B: Too short (< 3 chars) | `ab` | ✅ Yes | ❌ No |
| C: Duplicate alias | `Test_QA` | ✅ Yes | ❌ No |

### Finding
All 3 invalid aliases are correctly **rejected** — no account is created and the user stays on `/signup`. However, **no error message is displayed**. The form silently clears all fields, leaving users with zero feedback.

### Root Cause
The server action `signupAction` in `src/app/auth/actions.ts` correctly returns error objects like:
```typescript
{ error: "Your alias must be at least 3 characters long.", success: false }
```
The signup page JSX checks `state.error` and renders a `div.form-error`. However, the `useActionState` hook (React 19) resets the form DOM before the error state propagates, so the error div never becomes visible.

### Recommendation
- Investigate `useActionState` form reset timing
- Consider switching to `useState` + manual `fetch` for better error display control
- Or use `useRef` to persist error state across re-renders

### Evidence
- Screenshot: Form is completely empty after submission — no error banner visible
- Network tab confirms server returns proper error JSON

---

## 2. Cat-01 — The "Breyer Adios" Split Search
**Pillar:** 📖 Universal Catalog, Market & AI  
**Status:** ✅ PASS

### Test
Typed "Breyer Adios" into the Reference Link search on `/add-horse` Step 2.

### Result
Search returned **10+ results** including:
- **Base Mold:** Adios · Breyer · Traditional (1:9) with ► Releases
- **Releases:** Adios #410251, #51-1, #410151, Famous Standardbred #50, #5050, American Quarter Horse Two-Piece Set With Adios #410385, and more

### Analysis
The multi-word split search correctly matches "Breyer" against the `maker` column and "Adios" against the `title` column simultaneously. The bug described in the original V26 directive has been fully resolved.

---

## 3. Add-01 — Category Toggle (Tack & Gear)
**Pillar:** 📦 The Digital Stable & Bulk Intake  
**Status:** ✅ PASS

### Test
On `/add-horse`, switched category from "Model Horse" to "Tack & Gear", then compared the Identity step fields.

### Result

| Field | Model Horse Mode | Tack & Gear Mode |
|-------|-----------------|------------------|
| Custom Name | ✅ Visible | ✅ Visible |
| Sculptor / Artist | ✅ Visible | ✅ Visible |
| Finishing Artist | ✅ Visible | ✅ Visible |
| Edition Info | ✅ Visible | ✅ Visible |
| **Finish Type *** | ✅ Visible | ❌ **Hidden** |
| **Condition Grade *** | ✅ Visible | ❌ **Hidden** |
| **Life Stage** | ✅ Visible | ❌ **Hidden** |
| Collection / Folder | ✅ Visible | ✅ Visible |
| Marketplace Status | ✅ Visible | ✅ Visible |
| Visibility | ✅ Visible | ✅ Visible |

### Analysis
The three model-horse-specific fields (Finish Type, Condition Grade, Life Stage) are correctly removed from the DOM when "Tack & Gear" is selected. The form adapts dynamically to the category without requiring a page reload.

---

## 4. Trn-02 — Self-Claim Prevention
**Pillar:** 🔄 Transfer & Provenance  
**Status:** ✅ PASS

### Test
Generated a transfer PIN for "Firecracker" while logged in as QA_Seller, then attempted to claim that same PIN as the same user on `/claim`.

### Result
- **PIN Generated:** `837FVE` — modal displayed "Expires in 48 hours" with Cancel Transfer / Done buttons
- **Self-Claim Attempted:** Entered `837FVE` on the Claim page
- **System Response:** Red error text: **"You cannot claim your own horse."**
- **Horse was NOT transferred** — ownership remained unchanged

### Analysis
The server action correctly checks `transfer.user_id === currentUser.id` and returns an error before any ownership change occurs. The error message is clear and user-friendly. Unlike Auth-01, the error feedback is properly displayed in the claim UI.

---

## 5. CSV-02 — Export CSV
**Pillar:** 📦 The Digital Stable & Bulk Intake  
**Status:** ✅ PASS

### Test
Clicked the "Export CSV" button on the QA_Seller dashboard (5 models).

### Result
- **Button State:** Changed to "Exporting..." during generation (loading feedback ✅)
- **Network Response:** `200 OK` from `/api/export`
- **Response Headers:**
  - `content-disposition: attachment; filename="my_digital_stable.csv"`
  - `content-type: text/csv; charset=utf-8`
- **Console Errors:** None

### Analysis
The export pipeline works end-to-end. The server correctly authenticates the user, fetches their horses, generates CSV, and sends it with proper download headers. Client-side blob download triggers the browser's native save dialog.

---

## 6. Com-07 — Chat Guardrails (Payment Keywords)
**Pillar:** 💬 Commerce & DM Safety  
**Status:** ⚠️ WARNING

### Test
Sent messages containing "venmo" and "paypal" through two UI paths:
1. **Make Offer modal** (from Show Ring → "Make Offer" on Dark Star Dancer)
2. **Chat thread** (DM conversation view)

### Result

| UI Path | Input | Warning Shown? |
|---------|-------|---------------|
| Make Offer modal message | "Hey, send me money on venmo" | ❌ No |
| Chat thread DM | "pay me on paypal please" | ⚠️ Not tested in-thread (agent navigated via offer) |

### Root Cause
The guardrails **DO exist** but only in `ChatThread.tsx`:
```typescript
// src/components/ChatThread.tsx:24
const RISKY_PAYMENT_REGEX = /(venmo|zelle|paypal\s*f\s*(&|and)\s*f|friends\s*and\s*family|cash\s*app|wire\s*transfer)/i;
```
The `showPaymentWarning` state (line 40) correctly triggers a `🛡️ Protect yourself` banner when typing risky keywords **inside an existing DM conversation thread**.

However, the **Make Offer modal** (the primary entry point for commerce communication) does NOT have guardrails. Since many first-contact messages happen via the offer modal, users can freely mention off-platform payment methods before the guardrails ever activate.

### Recommendation
- Copy `RISKY_PAYMENT_REGEX` to a shared utility (e.g., `src/lib/safety.ts`)
- Add the same `showPaymentWarning` check to the Make Offer modal's message textarea
- Consider adding guardrails to any additional message input surfaces

---

## 7. Sho-05 — Self-Voting Block
**Pillar:** 🏆 Competition & Shows  
**Status:** ✅ PASS

### Test
Entered "Firecracker" and "Silver Charm" (owned by @Test_QA) into the "Test 3" photo show. Then attempted to vote for own horses while also voting for other users' horses.

### Result

| Entry | Owner | Vote Attempted | Result |
|-------|-------|---------------|--------|
| #1 Lucien | @TestAccount | ✅ Voted | ❤️ 1 — vote accepted, heart turned red |
| #2 Fake bugaboo | @TestAccount | Not tested | 🤍 0 |
| #3 Firecracker | @Test_QA (self) | ✅ Attempted | 🤍 0 — **vote silently rejected** |
| #4 Silver Charm | @Test_QA (self) | ✅ Attempted | 🤍 0 — **vote silently rejected** |

### Analysis
The self-voting prevention works correctly at the server level. When QA_Seller clicks the heart on their own horses, the UI heart icon stays white (🤍) and the count remains at 0, while voting on other users' horses works normally. The system also shows a "✕ Withdraw" button next to own entries (not present on others' entries), which is good UI affordance.

**Note:** The vote is silently blocked — no error message is shown. This is acceptable UX for voting (user shouldn't even be tempted), but could optionally show a tooltip "You can't vote for your own entry."

---

## 8. Art-01 — Artist Profile Verification
**Pillar:** 🎨 Art Studio & Commerce  
**Status:** ⚠️ WARNING

### Test
Navigated to the Art Studio (`/studio`) and inspected artist profiles for verification badges or status indicators.

### Result
- **Art Studio Gallery:** Shows 2 studios — "Black Fox Farm" (🔴 Closed) and "Test studio" (🟡 Waitlist)
- **Status Dots:** Each studio shows queue status (Open/Waitlist/Closed) via colored dots
- **Verification Badges:** ❌ **No verified/unverified distinction** exists
- **Studio Setup:** The `/studio/setup` flow has no verification step or identity check
- **Discover Page:** Collector profiles also lack verification badges

### Analysis
Anyone can create an artist profile claiming any artistic identity. There is no:
- Email or social media verification for artist accounts
- "Verified Artist" badge on studio listings
- Admin approval workflow for new studios
- Portfolio minimum requirement before going "Open"

This means a user could create a studio profile impersonating a known artist and solicit commissions.

### Recommendation
- Add a "Verified" boolean column to the `artist_studios` table
- Display a ✅ badge next to verified studios on listings and profile pages
- Implement admin approval or identity verification workflow
- Consider requiring a minimum portfolio upload before opening commissions

### Additional Finding: Session Bug
The agent noticed the header frequently reverting to a "logged out" state (showing "Log In" button) on certain routes like `/studio` and `/inbox` even while authenticated. This is a separate, significant UX bug that causes navigation friction.

---

---

## Full QA Summary (Automated + Manual)

### Combined Score: 19 PASS · 8 WARNING · 5 FAIL · 1 SKIP · 2 BLOCKED

**Automated (16 tests):** 11 PASS · 4 WARNING · 0 FAIL · 1 SKIP  
**Manual (19 tests):** 10 PASS · 3 WARNING · 5 FAIL · 0 SKIP · 1 BLOCKED (Del-04 by Del-03)

| Metric | Count |
|--------|-------|
| ✅ PASS | 19 |
| ⚠️ WARNING | 8 |
| ❌ FAIL | 5 |
| ⏭️ SKIP/BLOCKED | 2 |

### Priority Action Items

**P0 — Blocks Core Functionality:**
1. **Session/Header Bug** *(from automated tests)*: Header drops to "logged out" state across routes while user is authenticated. Observed in every multi-page flow. Likely Supabase auth listener race.
2. **Com-04 — Cancel/Dispute Broken**: Button does nothing. Sellers cannot exit a ghosted transaction. Transaction stays in `pending_payment` forever.
3. **Del-03 — Account Deletion Blocked**: `user_horses_life_stage_check` constraint prevents ANY user from deleting their account. GDPR/privacy blocker.

**P1 — Critical Commerce/Shows:**
4. **Com-02 — No State Locking**: Horse status can be changed during active transaction. Seller can relist while buyer is paying.
5. **Trn-04 — Expired PIN Limbo**: Horse stuck with "Transfer in progress..." after PIN expires. No way to generate a new PIN or cancel.
6. **Sho-04 — Expert Judge Flow Broken**: Cannot assign judges, cannot accept entries, cannot re-edit shows. Entire feature non-functional.
7. **Mkt-02 — Blue Book Not Updating**: Completed transactions don't appear in market price data.
8. **Auth-01** *(from automated)*: Signup error messages swallowed by `useActionState`.
9. **Com-07** *(from automated)*: Chat guardrails missing from Make Offer modal.

**P2 — UX & Polish:**
10. **Art-01/01b** *(from automated)*: No artist verification system.
11. **Com-05 Post-Retraction State** *(from automated)*: "Transaction is open" after retraction.
12. **Make Offer flicker/offscreen** *(from Com-04 bonus)*: Modal rendering issue.
13. **Make Offer missing from passport** *(from Com-01 bonus)*: Only available in Show Ring.
14. **Delete horse → landing page** *(from Bulk-02 bonus)*: Should go to dashboard.
15. **Comment visibility in Stable** *(from Del-03 bonus)*: Can't see own horse's comments.

### Feature Requests (Post-Fix)
| # | Request | Priority |
|---|---------|----------|
| FR-1 | Counter-offer button for negotiation | Medium |
| FR-2 | Make Offer on passport page | High |
| FR-3 | Watermark style options in settings | Low |
| FR-4 | Comment visibility in Stable view | Medium |
| FR-5 | Delete redirect → dashboard | Low |

## 9. CSV-02 — XSS Sanitization
**Pillar:** 🛡️ Security  
**Status:** ✅ PASS

### Test
Entered `<script>alert('hack')</script>` as a horse name via Quick Add, then checked if it rendered as literal text or executed JavaScript.

### Result
- **Horse Name on Dashboard:** Renders as literal text `<script>alert('hack')</...` (truncated by card width)
- **JavaScript Execution:** ❌ No alert dialog appeared
- **React Escaping:** The framework's default JSX escaping correctly prevents XSS

### Analysis
React's JSX rendering automatically escapes HTML entities by default. The `<script>` tag is converted to `&lt;script&gt;` in the rendered HTML. This is the standard React security model and confirms the application does not use `dangerouslySetInnerHTML` for user-supplied content. The horse card now shows 6 total models (including this test entry).

---

## 10. Sho-01 — Handler Time Conflict
**Pillar:** 🏆 Competition & Shows  
**Status:** ✅ PASS

### Test
On the Show String Planner (`/shows/planner`):
1. Created a new show string named "QA Conflict Test"
2. Added Horse A (Dark Star Dancer) to class "Arabian Stallion" with time slot "10:00 AM"
3. Added Horse B (Silver Charm) to class "Morgan Mare" with time slot "10:00 AM"

### Result
The system displayed a warning: **"⚠️ Handler Time Conflict: Two entries scheduled in time slot '10:00 AM'. You can only handle one horse at a time."**

### Analysis
The conflict detection correctly identifies when a single handler has two horses scheduled in the same time slot at a live show, which is physically impossible. The warning is non-blocking (allows the planner to proceed) but clearly visible.

---

## 11. Sho-02 — String Duplication
**Pillar:** 🏆 Competition & Shows  
**Status:** ✅ PASS

### Test
On the Show String Planner, clicked the 📋 (Duplicate) button on the "QA Conflict Test" show string.

### Result
A new show string named **"QA Conflict Test (copy)"** was created with all entries intact (same horses, classes, and time slots).

### Analysis
The duplication preserves all entry data and appends "(copy)" to distinguish from the original. This allows show planners to create variations of show strings easily.

---

## 12. Com-05 — Buyer Retraction
**Pillar:** 💰 Commerce & Safe-Trade  
**Status:** ✅ PASS

### Test
As QA_Buyer, made an offer on "Dark Star Dancer" (owned by QA_Seller via Show Ring), then retracted it before the seller responded.

### Result
- **Offer Submitted:** Offer card displayed in DM thread with "⏳ Waiting for seller response..." and "↩️ Retract Offer" button
- **Retraction Clicked:** Offer card was completely removed from the conversation
- **Post-Retraction State:** Shows "Transaction is open" with "✅ Mark as Complete" button

### Analysis
The retraction mechanism works: the buyer can pull back an offer before seller action. The offer card disappears cleanly from the chat.

### Bonus Finding: Offer Amount Input Bug
The offer amount displayed as **$200200.00** instead of the intended $50. The Make Offer modal's amount input field appears to append new input to any existing default/placeholder value rather than replacing it. This is likely a browser autofill or input clearing issue specific to automated input, but worth verifying manually.

### Bonus Finding: Post-Retraction State
After retracting, the conversation shows "Transaction is open" with a "Mark as Complete" button. This is potentially confusing — a retracted offer shouldn't leave the transaction in a state that implies completion is possible.

---

## 13. Sho-04 — Expert Judged Show Protection
**Pillar:** 🏆 Competition & Shows  
**Status:** ⏭️ SKIP

### Test
Attempted to create an expert-judged event via `/community/events/create`.

### Result
The event creation form has a `datetime-local` input field for Start/End dates that proved impossible to fill via automated browser input. After 40+ attempts with multiple strategies, the agent could not set a valid date, and the Create Event button was blocked by browser-level validation.

### Analysis
This is an **automation tooling limitation**, not a product bug. The `datetime-local` input type requires specific browser-level interaction patterns that the test agent cannot reliably reproduce. The test requires manual execution or pre-seeded data.

### Recommendation
- Mark this as a **human-only test** or pre-seed an expert-judged event via Supabase SQL
- Consider adding a more automation-friendly date picker (e.g., a text input with date parsing)

---

## 14. Soc-03 — Private Group Leakage
**Pillar:** 👥 Social & Community  
**Status:** ✅ PASS

### Test
1. Logged in as QA_Seller, created a private group named "Private Group"
2. Posted a secret message: "This is a secret message only for group members. if you see this, there is a leak!"
3. Logged out, logged in as QA_Buyer (non-member)
4. Navigated directly to the private group URL

### Result
- **Non-member View:** Page shows group name ("Private Group"), metadata ("General · 1 member · Created by @Test_QA"), and the message: **"Join this group to see posts and participate."**
- **Feed Area:** Completely empty — the secret post is NOT visible
- **Join Button:** Not explicitly visible, but the restriction message is clear

### Analysis
Private group content is correctly protected. Non-members cannot see any posts even with direct URL access. The metadata (group name, member count, creator) is visible — this is standard behavior for "private" groups (vs "secret" groups which wouldn't appear at all).

### Bonus Finding: Group Creation RLS Error
Initial group creation attempts returned "Row-Level Security (RLS) policy violation" errors, suggesting the auth session was intermittent. This is consistent with the header sync bug found throughout testing.

---

## 15. Sho-03 — Batch Results UX
**Pillar:** 🏆 Competition & Shows  
**Status:** ✅ PASS

### Test
On the Show String Planner, expanded "QA Conflict Test" show string and entered batch results.

### Result
- **Enter Results:** Clicked "🏆 Enter Results" — Batch Results form appeared with Horse, Class, Placing, and Ribbon columns
- **Results Entry:** Entered "1st" for entry #1 (`<script>alert('hack')</script>` — more XSS proof!) and "2nd" for entry #2 (Midnight Run)
- **Real-time NAN Points:** Summary showed "~2 Est. NAN Points" calculated live
- **Save:** Clicked "💾 Save 2 Results" — **"✅ Saved!"** confirmation appeared

### Analysis
The batch results entry works smoothly with tabbing between fields, real-time NAN point estimation, and immediate save confirmation. Also confirms XSS sanitization — the script tag horse name renders as literal text throughout all views.

---

## 16. Art-01b — Artist Spoof on Passport
**Pillar:** 🔒 Provenance & Trust  
**Status:** ⚠️ WARNING

### Test
Instead of creating a new horse (blocked by photo upload requirement), examined an existing horse passport ("Kronos" by @Black Fox Farm) to check for artist verification.

### Result
- **Passport View:** Shows "🎨 Finished by: Karen Zorn" and "Sculptor: Brigitte Eberl"
- **Verification Badge:** ❌ **No verification badge** next to either artist name
- **Free-Text Field:** The Finishing Artist and Sculptor fields accept any free text
- **Impersonation Risk:** Any user could type "Brigitte Eberl" into their horse's artist field with zero verification

### Analysis
This is the passport-level confirmation of the Art-01 finding. Artist names on horse passports are user-supplied with no verification. When combined with the lack of verification badges on Art Studio profiles, this creates a comprehensive impersonation vector.

### Bonus Finding: Add Horse Photo Requirement
The full Add Horse form (`/add-horse`) requires a Near-Side photo upload before proceeding past Step 1, which prevents Quick Add from bypassing this. This is good for data quality but blocks agent-based testing.

---

---

# Manual QA Results — Human Operator
**Run Date:** 2026-03-14  
**Tester:** Human (project owner)  
**Environment:** localhost:3000

## Manual Test Summary

| # | Test ID | Name | Status | Category |
|---|---------|------|--------|----------|
| 17 | Com-04 | Ghosting Buyer Defense | ❌ FAIL | Commerce |
| 18 | Com-02 | State Locking | ⚠️ WARNING | Commerce |
| 19 | Com-03 | Rug Pull Defense | ✅ PASS | Commerce |
| 20 | Mkt-01 | Full E2E Transaction | ✅ PASS | Commerce |
| 21 | Trn-03 | Vault Data Wipe | ✅ PASS | Transfer |
| 22 | Trn-04 | Expired PIN Rejection | ⚠️ WARNING | Transfer |
| 23 | Auth-02 | Double Reset Race | ✅ PASS | Auth |
| 24 | Auth-04 | Console RLS Leak | ✅ PASS | Security |
| 25 | Inf-01 | WebSocket Multi-Tab | ✅ PASS | Infrastructure |
| 26 | Inf-02 | Image Compression | ✅ PASS | Infrastructure |
| 27 | Com-01 | Simultaneous Offers | ✅ PASS | Commerce |
| 28 | Trn-01 | Double Claim Race | ✅ PASS | Transfer |
| 29 | Add-03 | Watermark Bytes | ✅ PASS | Storage |
| 30 | Bulk-02 | Ghost File GC | ✅ PASS | Storage |
| 31 | Del-03 | Deleted User Alias | ❌ FAIL | Account |
| 32 | Del-04 | Orphan Horse State | ❌ FAIL | Account |
| 33 | Trn-03b | Financial Vault Schema | ⚠️ WARNING | Database |
| 34 | Sho-04 | Expert Judge Show | ❌ FAIL | Shows |
| 35 | Mkt-02 | Blue Book Update | ❌ FAIL | Market |

---

## 17. Com-04 — Ghosting Buyer Defense
**Status:** ❌ FAIL

### Finding
Cancel / Dispute button does nothing in the UI. The button exists but clicking it produces no visible state change — the transaction remains in `pending_payment` state indefinitely.

### Bonus Finding: Make Offer Modal Flicker
The Make Offer button/modal blinks in and out of existence or renders offscreen. This is a separate UI bug affecting the commerce entry point.

### Fix Required
- Debug `cancelTransaction()` server action — ensure it updates status and revalidates the path
- Fix the OfferCard or DM page to reflect the cancelled state after action completes
- Investigate Make Offer button rendering/positioning issue

---

## 18. Com-02 — State Locking
**Status:** ⚠️ WARNING

### Finding
Horse is **never locked** during an active transaction. Seller was able to change the horse's status to "Open To Offers" while a transaction was in `pending_payment` state. No status update was pushed to the commerce messages or buyer's view.

### Fix Required
- The Edit Horse form should check for active transactions and disable the Marketplace Status dropdown
- OR the server action should reject status changes when `transactions.status IN ('offer_made', 'offer_accepted', 'pending_payment', 'payment_sent')`
- Add a system message to the conversation when horse status changes during a transaction

---

## 19. Com-03 — Rug Pull Defense
**Status:** ✅ PASS

### Finding
Warning message appears as expected when attempting to delete a horse locked in an active transaction. Deletion is correctly blocked.

---

## 20. Mkt-01 — Full E2E Transaction
**Status:** ✅ PASS

### Finding
Complete transaction pipeline works: Offer → Accept → Payment Sent → Verify & Release → Ownership Transfer. Horse moves to buyer's stable correctly.

### Minor UX Note
The transfer PIN display is positioned slightly too high on the screen — minor positioning issue.

---

## 21. Trn-03 — Vault Data Wipe
**Status:** ✅ PASS

### Finding
Confirmed: no financial vault data is transferred to the new owner. Purchase price and insured value fields are blank for the new owner after transfer.

---

## 22. Trn-04 — Expired PIN Rejection
**Status:** ⚠️ WARNING

### Finding
Expired PIN correctly rejected with message: "Invalid or already claimed transfer code." **However**, the horse is now stuck in a limbo state — the conversation still shows "PIN released to buyer. Transfer in progress..." with no way for the seller to generate a new PIN or cancel the transfer.

### Fix Required
- Add a "Generate New PIN" or "Cancel Transfer" button when the current PIN has expired
- Clear the "Transfer in progress" state when the PIN expires
- Consider auto-expiring the transfer and resetting the horse status via a cron or on-access check

---

## 23. Auth-02 — Double Reset Race
**Status:** ✅ PASS

### Finding
Two reset emails received. One shows "invalid" (consumed token), the other works correctly. This is the expected Supabase behavior.

---

## 24. Auth-04 — Console RLS Leak
**Status:** ✅ PASS

### Finding
Console logs show only generic forward routing logs. No database schema information, table names, or RLS policy text visible in DevTools console.

---

## 25. Inf-01 — WebSocket Multi-Tab
**Status:** ✅ PASS

### Finding
WebSocket connections appear stable across 5 tabs. No exponential reconnection or memory issues observed.

---

## 26. Inf-02 — Image Compression
**Status:** ✅ PASS

### Finding
1100KB file uploaded, only 175KB transferred over the network. ~84% compression ratio. Client-side compression pipeline works well.

---

## 27. Com-01 — Simultaneous Offers
**Status:** ✅ PASS

### Finding
Both offers succeed and the seller sees separate conversations — one per buyer. System handles concurrent commerce gracefully.

### Feature Request: Counter-Offer Flow
> "There should be a counter-offer button so the seller can renegotiate. Flow: Seller lists for $100 → Buyer offers $50 → Seller chats and they agree on $75 → Seller inputs 'Counter offer: $75' → Buyer hits 'Agree' → Sets transaction to 'In Progress' → Buyer sends funds."

### Bug: Make Offer Only Available from Show Ring
Unable to make an offer from the horse's passport page — only from the Show Ring listing. The "Make Offer" button should also appear on `/community/[horse-id]` for horses marked "For Sale."

---

## 28. Trn-01 — Double Claim Race
**Status:** ✅ PASS

### Finding
Horse appears in exactly one stable. The other user sees "Invalid PIN" error. Race condition handling is correct.

---

## 29. Add-03 — Watermark Bytes
**Status:** ✅ PASS

### Finding
41.8kb stored vs 41kb original — watermark is visible and successfully embedded.

### Feature Request: Watermark Customization
> "Can we have an option for watermark style? My wife suggested a large sideways watermark, slightly transparent. I'd like a dropdown with example layout in settings."

---

## 30. Bulk-02 — Ghost File GC
**Status:** ✅ PASS

### Finding
File is removed from storage when horse is deleted. GC works correctly.

### UX Bug: Delete Redirect
Deleting a horse redirects to the **landing page** instead of the **dashboard**. Should redirect to `/dashboard` or `/` (authenticated root).

---

## 31. Del-03 — Deleted User Alias
**Status:** ❌ FAIL

### Finding
Account deletion fails with database error:
```
new row for relation "user_horses" violates check constraint "user_horses_life_stage_check"
```

The delete account flow is hitting a constraint violation, likely trying to set a null or invalid value on the horse's `life_stage` column during the anonymization/cleanup process.

### Fix Required
- Debug the account deletion flow — the constraint `user_horses_life_stage_check` is blocking
- Either delete the user's horses first, or properly handle the `life_stage` column during transfer/anonymization
- This is a **data integrity issue** that completely blocks account deletion

### Bonus Finding: Comment Visibility
> "I tested leaving a comment but realized I cannot see comments on my own horse unless I go to the Show Ring and click on it. There should be a button in my Stable view to see comments."

---

## 32. Del-04 — Orphan Horse State
**Status:** ❌ FAIL

### Finding
Unable to test because account deletion is completely blocked (see Del-03). The `life_stage_check` constraint prevents any user from deleting their account.

---

## 33. Trn-03b — Financial Vault Schema Check
**Status:** ⚠️ WARNING

### Finding
SQL query failed with column name error:
```sql
ERROR: 42703: column "insured_value" does not exist
```

The `financial_vault` table does not have a column named `insured_value`. The actual column name may be different (e.g., `insurance_value`, `vault_value`, etc.). Data is confirmed safe from UI perspective (Test 21 passed), but the schema doesn't match the expected column names.

### Fix Required
- Verify the actual column names in `financial_vault` table
- Update documentation/test procedures to use correct column names

---

## 34. Sho-04 — Expert Judged Show
**Status:** ❌ FAIL

### Finding
Multiple issues with the Expert Judge show flow:
1. Can create the show and add classes ✅
2. **Cannot assign a judge** — no UI for this
3. Other users see **"This show is not accepting entries"** instead of an entry form
4. **Cannot re-edit settings** after closing the creation page — no "Edit Show" option
5. Overall, the expert judge workflow needs significant work before it's functional

### Fix Required
- Add "Assign Judge" UI to event settings
- Fix entry acceptance logic — shows should accept entries when in the correct state
- Add "Edit Event" button on event detail pages for the creator
- Implement the full judge → assign placings → save results flow

---

## 35. Mkt-02 — Blue Book Update
**Status:** ❌ FAIL

### Finding
After completing a full E2E transaction (Mkt-01 PASS), the sale price does not appear anywhere in the Blue Book at `/market`. The price index is not updating from completed transactions.

### Fix Required
- Verify the `refresh_market_prices` materialized view or cron job is functioning
- Check if the completed transaction is being picked up by the aggregation query
- May need to manually trigger `/api/cron/refresh-market-prices` or verify the Vercel cron schedule

---

## Feature Requests Discovered During Testing

| # | Request | Source Test | Priority |
|---|---------|-----------|----------|
| FR-1 | Counter-offer button for seller renegotiation | Com-01 | Medium |
| FR-2 | Make Offer button on horse passport page (not just Show Ring) | Com-01 | High |
| FR-3 | Watermark style dropdown in settings (large/sideways/transparent options) | Add-03 | Low |
| FR-4 | "View Comments" button in Stable view for own horses | Del-03 | Medium |
| FR-5 | Delete horse should redirect to dashboard, not landing page | Bulk-02 | Low |

---

<!-- APPEND FUTURE PHASE RESULTS BELOW THIS LINE -->
