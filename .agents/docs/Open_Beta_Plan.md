# 🚀 SYSTEM DIRECTIVE: MHH Open Beta & Freemium Architecture Blueprint

**Agent Role:** You are "AntiGravity", the Lead Principal Engineer and PostgreSQL DBA for Model Horse Hub (MHH). 
**Target Stack:** Next.js 16.1 (App Router), React 19, Supabase (PostgreSQL 14, RPCs, RLS), Tailwind CSS v4, and Vercel Serverless.
**Objective:** Execute a 3-phase infrastructure hardening and feature rollout plan to transition MHH from a 20-user Closed Beta to a 500+ user Open Beta, culminating in the "MHH Pro" Freemium launch.

### 📜 STRICT ENGINEERING CONSTRAINTS:
1. **Type Safety (Zero Casts):** Eliminate the "Type Safety Illusion". Do not use manual type casting (`as unknown as`, `as { ... }[]`). Use Supabase's generated `Tables<"table_name">` and `Database` generics natively so TypeScript infers directly from the schema.
2. **CSS Architecture:** Enforce Tailwind CSS v4. Do NOT add new component-specific classes to `globals.css` or create new CSS Modules. Use inline utility classes exclusively.
3. **Transactions & Locks:** Any logic involving multi-row state mutations (especially commerce) MUST be executed in Postgres RPCs using `BEGIN...COMMIT` blocks and `SELECT ... FOR UPDATE` row-locks. Do not manage concurrency in Node.js.
4. **Zero-Latency Premium:** Do NOT query a `subscriptions` table for feature flags. Rely strictly on Supabase Auth JWT `app_metadata` claims for UI and RLS gating.
5. **Observability:** Do not leave `catch { /* non-blocking */ }` blocks empty inside Next.js `after()` hooks. Pipe all catches to `logger.error("Domain", "Message", err)` to prevent silent background failures.
6. **Execution Flow:** You MUST stop execution completely at every `[🛑 HUMAN VERIFICATION GATE]`. Do not proceed to the next phase until the human developer provides the exact approval phrase.

---

## 🛠️ PHASE 1: Infrastructure Hardening & Liability Shield (Days 1–30)
**Goal:** Patch critical data-loss risks, eliminate DDoS-style polling, fix state-tearing race conditions, and legally distance the platform from P2P payments.

### Task 1.1: The "Tombstone" Fix (Data Integrity)
*   **Target File:** `src/app/actions/horse.ts` (Function: `deleteHorse`)
*   **Action:** The current function executes a hard delete (`await supabase.from("user_horses").delete()`). Because of `ON DELETE CASCADE`, this wipes out Hoofprint™ provenance for previous owners. Rewrite `deleteHorse` to execute a true soft-delete.
*   **Logic:** 
    *   Retain the Supabase Storage image deletion logic to save costs.
    *   Delete rows from `horse_images`.
    *   Update `user_horses`: `UPDATE user_horses SET life_stage = 'orphaned', visibility = 'private', custom_name = '[Deleted]', trade_status = 'Not for Sale' WHERE id = horseId AND owner_id = user.id`.

### Task 1.2: Commerce Race Conditions (Concurrency)
*   **Target Files:** `supabase/migrations/[next_number]_commerce_locks.sql` (Create new), `src/app/actions/transactions.ts`
*   **Action:** `makeOffer` and `respondToOffer` currently manage state checks in Node.js memory, making them vulnerable to TOCTOU race conditions.
    *   In the new migration, write two PL/pgSQL RPCs: `make_offer_atomic` and `respond_to_offer_atomic`.
    *   Use `SELECT ... FOR UPDATE` to lock the `user_horses` and `transactions` rows during the state check to prevent double-booking.
    *   Update `transactions.ts` to call these new RPCs via `getAdminClient().rpc(...)`.

### Task 1.3: Neutralize the Polling DDoS (Performance)
*   **Target File:** `src/components/NotificationBell.tsx`
*   **Action:** The `setInterval(fetchCount, 60_000)` will destroy our Supabase connection pool at 500+ active background tabs. Remove it.
*   **Logic:** Wrap the interval logic in a Page Visibility check. Use `document.visibilityState === 'visible'` so it *only* polls if the user is actively looking at the tab. Add a `visibilitychange` event listener to trigger an immediate fetch when the user returns to the tab.

### Task 1.4: Defuse the Client-Side Search Bomb (Memory/Bandwidth)
*   **Target Files:** `src/app/api/reference-dictionary/route.ts`, `supabase/migrations/[next_number]_fuzzy_search_rpc.sql`, `src/app/actions/csv-import.ts`, `src/components/CsvImport.tsx`
*   **Action:** Fetching 10,500 rows to the client for `fuzzysort` will crash mobile devices.
    *   DELETE `/api/reference-dictionary/route.ts` entirely.
    *   Create an RPC `search_catalog_fuzzy(search_term TEXT)` utilizing the `pg_trgm` extension on `catalog_items`.
    *   Create a new server action `matchCsvRowsBatch` in `csv-import.ts`.
    *   Refactor `CsvImport.tsx` Step 2 to pass parsed rows to the server action with a strict 400ms debounce.

### Task 1.5: Escrow Liability UX & Observability (Legal/UX)
*   **Target Files:** `src/components/OfferCard.tsx`, `src/components/MakeOfferModal.tsx`, `src/components/TransactionActions.tsx`, All files with `after()` hooks.
*   **Action:** 
    *   Aggressively distance MHH from payments. Change "I Have Paid" ➡️ **"External Payment Sent"**. Change "Confirm Funds & Release" ➡️ **"Acknowledge External Payment & Release PIN"**.
    *   In `MakeOfferModal.tsx`, add a required checkbox: *"I understand MHH does not process payments and cannot mediate financial disputes."*
    *   Replace all silent `catch { /* non-blocking */ }` blocks inside `after()` hooks with `logger.error("Domain", "Message", err)`.

> ### 🛑 HUMAN VERIFICATION GATE 1 🛑
> **Agent Instructions:** Halt all code generation. Print the following checklist for the human developer. Do not proceed to Phase 2 until the user replies with exactly: **"Phase 1 Verified. Proceed to Phase 2."**
> 
> *Developer Verification Checklist:*
> - [ ] Test `deleteHorse`: Ensure the UUID remains in the DB, PII is scrubbed, and the previous owner's Hoofprint timeline is intact.
> - [ ] Test `makeOffer` RPC: Simulate simultaneous clicks; verify locks prevent duplicate active transactions.
> - [ ] Network Tab: Verify `NotificationBell` stops polling when the browser tab is hidden.
> - [ ] CSV Import: Test with a 50-row file; ensure successful server-side matching without the 1MB payload.

---

## 🤝 PHASE 2: Trust Engine & Zero-Latency Monetization (Days 31–60)
**Objective:** Replace manual moderation with algorithmic trust and lay the webhook plumbing for monetization.

### Task 2.1: "Community Verified" Algorithm (Database & UI)
*   **Target Files:** `supabase/migrations/[next_number]_trusted_sellers.sql`, `src/components/MessageSellerButton.tsx`, `src/components/OfferCard.tsx`
*   **Action:** Create a trust algorithm to badge safe sellers without MHH staff manual underwriting.
    *   Create `MATERIALIZED VIEW mv_trusted_sellers`.
    *   Logic: `SELECT user_id FROM users` where: Account age > 60 days AND COUNT of completed `horse_transfers` to *distinct* `claimed_by` UUIDs >= 5 AND AVG(`reviews.stars`) >= 4.8.
    *   Add the refresh of this view to the existing daily cron job in `/api/cron/refresh-market/route.ts`.
    *   On the frontend, query this view. If true, display a gold 🛡️ "Community Trusted" badge next to the seller's alias.

### Task 2.2: Stripe Webhook & JWT Custom Claims
*   **Target Files:** `src/app/api/webhooks/stripe/route.ts` (New), `src/lib/auth.ts`
*   **Action:** We need zero-latency premium checks.
    *   Implement a Stripe webhook listener for `checkout.session.completed` and `customer.subscription.updated`/`deleted`.
    *   Map the Stripe `client_reference_id` to the Supabase `user_id`. Use the Supabase Admin Auth API to update the user's JWT: `await getAdminClient().auth.admin.updateUserById(userId, { app_metadata: { tier: 'pro' } });`
    *   In `src/lib/auth.ts`, export a helper: `export const getUserTier = async () => { const { data } = await supabase.auth.getSession(); return data.session?.user?.app_metadata?.tier || 'free'; }`.

> ### 🛑 HUMAN VERIFICATION GATE 2 🛑
> **Agent Instructions:** Halt all code generation. Print the following checklist for the human developer. Do not proceed to Phase 3 until the user replies with exactly: **"Phase 2 Verified. Proceed to Phase 3."**
>
> *Developer Verification Checklist:*
> - [ ] Audit `mv_trusted_sellers` logic in Supabase to ensure alt-account trading loops don't trigger the badge.
> - [ ] Stripe CLI: Trigger `stripe trigger checkout.session.completed`. Verify the user's Supabase JWT `app_metadata` updates instantly.

---

## 💎 PHASE 3: Freemium Rollout & AI "Stablemaster" (Days 61–90)
**Objective:** Lock high-value features behind zero-latency RLS policies and deploy the AI appraisal agent.

### Task 3.1: Zero-Latency Premium RLS Policies
*   **Target File:** `supabase/migrations/[next_number]_pro_rls.sql`
*   **Action:** Protect premium data at the Postgres level using the JWT claims injected in Phase 2.
    *   *Example snippet:* `CREATE POLICY "Pro_Only" ON advanced_analytics_view FOR SELECT USING (coalesce((auth.jwt()->'app_metadata'->>'tier'), 'free') = 'pro');`

### Task 3.2: Blue Book PRO (Interactive Analytics)
*   **Target Files:** `src/app/market/page.tsx`, `src/components/BlueBookProCharts.tsx` (New)
*   **Action:** Use `getUserTier()`. 
    *   If `tier === 'free'`, render standard median/avg text, but overlay the chart area with a blurred CSS backdrop and an "Upgrade to MHH Pro for 5-Year Historical Trends" CTA linking to Stripe.
    *   If `tier === 'pro'`, render full `recharts` scatter plots of historical transaction data.

### Task 3.3: LSQ Photo Suite+ & Automated Insurance PDF
*   **Target Files:** `src/app/actions/horse.ts`, `src/lib/utils/imageCompression.ts`, `src/app/actions/insurance-report.ts`
*   **Action:** Enforce upload and generation limits based on `tier`.
    *   If `tier === 'free'`, cap Extra Detail Photos at 10 and apply WebP compression.
    *   If `tier === 'pro'`, increase cap to 30 and bypass WebP downscaling to allow lossless storage.
    *   In the PDF generator, if `tier === 'pro'`, dynamically pull the latest `average_price` from `mv_market_prices` for every horse in the stable and stamp the PDF with a dynamic "Current Market Replacement Value".

### Task 3.4: "Stablemaster" AI Agent
*   **Target File:** `src/app/api/cron/stablemaster-agent/route.ts` (New)
*   **Action:** Create a monthly Vercel cron endpoint (secured by `CRON_SECRET`).
    *   Query all users where `app_metadata->>tier = 'pro'`.
    *   For each Pro user, aggregate their `financial_vault` deltas (changes in the last 30 days) and join against `mv_market_prices`.
    *   Pass this JSON payload to the Google Gemini API (reusing the initialization from `/api/identify-mold`).
    *   *System Prompt:* "Act as an expert equine appraiser. Summarize the value changes in this collection over the last 30 days in 3 concise paragraphs based on the provided market shifts. Do not hallucinate financial advice."
    *   Pipe the text response into a React Email template and send via `Resend` (`src/lib/email.ts`).
    *   Wrap the Gemini/Resend calls in `try/catch` and use `logger.error` so a single failure doesn't crash the loop for other Pro users.

> ### 🛑 FINAL HUMAN VERIFICATION GATE 3 🛑
> **Agent Instructions:** Halt execution. Print the final checklist. Await human input: **"Phase 3 Verified. Mission Complete."**
>
> *Developer Verification Checklist:*
> - [ ] Free User Test: Verify the Photo limit blocks at 10, and Blue Book PRO charts are effectively blurred and un-inspectable via DevTools (enforced by RLS).
> - [ ] Pro User Test: Upgrade an account and verify the UI unlocks without requiring a hard refresh.
> - [ ] AI Test: Run the Stablemaster cron manually. Verify the Gemini prompt produces a natural, accurate financial summary via Resend.