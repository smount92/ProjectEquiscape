# 🗺️ Master Blueprint: V16 Integrity Sprint & Hobby-Native Deep Dives

> **Target Audience:** Antigravity Architect Agent
> **Developer Agent:** Claude 3.7 / Opus (Requires strict architectural boundaries)
> **Context:** Model Horse Hub has completed its Grand Unification (V10) and Ecosystem Expansion (V11-V15). The database is highly relational, polymorphic, and event-sourced. 
> **Current State:** The human founder has accurately identified that while the app *functions* perfectly, it suffers from "CRUD-itis." It feels like a generic B2B SaaS application (e-commerce grids, tax-form-like data entry) rather than a bespoke, tactile tool designed specifically for the obsessive model horse collecting community. Furthermore, there are hidden scale bottlenecks and SEO failures that must be addressed.
> **Architect Directive:** You are entering a FEATURE FREEZE on new product concepts. Your immediate goal is to execute **Epic 1 (Integrity Sprint)** to plug critical data leaks. Following that, you will adopt the **Hobby-Native UX Manifesto** and conduct **Epic 2 (Pillar Deep Dives)** to perfect the UX, before proceeding to the **Future Roadmap (Epics 3+)**.

---

## 🧱 EPIC 1: The V16 Integrity Sprint (Critical Hardening)

**Goal:** Fix data loss vectors, prevent out-of-memory (OOM) crashes for Super-Collectors, and align with Next.js/Vercel serverless best practices.

### Task 1.1: The Batch Import RPC Fix
* **The Bug:** `batch_import_horses` (Migration 023) still references dropped legacy columns (`reference_mold_id`, etc.), causing CSV imports to 500 crash globally.
* **Action:** Write a SQL migration (`056_fix_batch_import.sql`) to recreate `batch_import_horses`. Update the JSON payload parsing to write to the new `catalog_id` and `asset_category` columns.

### Task 1.2: The "Blue Book" Data Pipeline
* **The Bug:** `claim_transfer_atomic` and `claim_parked_horse_atomic` (Migrations 035/036/038) do not return the `sale_price`. `createTransaction()` saves empty price metadata, starving the Market Price Guide.
* **Action:** Update the SQL RPCs to return `v_transfer.sale_price`. Update `src/app/actions/parked-export.ts` and `hoofprint.ts` to map `result.sale_price` into the `metadata` object passed to `createTransaction`.

### Task 1.3: Server-Side SEO for the Price Guide
* **The Bug:** `src/app/market/page.tsx` is a `"use client"` component. Search engines see a blank loading spinner instead of the actual pricing data, killing SEO.
* **Action:** Refactor `/market/page.tsx` into a true React Server Component. Move search/sort state into the URL via `searchParams`. Await `searchMarketPrices()` directly in the server render.

### Task 1.4: Serverless Execution Safety (`next/server`)
* **The Bug:** Un-awaited promises (notifications, emails) are killed instantly when Vercel returns the HTTP response. Hard redirects abort client-side async calls.
* **Action:** Globally implement the `after()` API from `next/server` for background tasks. Remove the `window.location.href` hard redirect in `src/app/stable/[id]/edit/page.tsx` and replace it with `router.push()` or `redirect()`.

### Task 1.5: Vercel Cron for Materialized Views
* **The Bug:** Triggering `REFRESH MATERIALIZED VIEW CONCURRENTLY` on every single transaction will DDOS the database at scale.
* **Action:** Remove the inline refresh from `completeTransaction`. Create `src/app/api/cron/refresh-market/route.ts`. Secure it using Vercel's `CRON_SECRET`. (The human will configure `vercel.json`).

### Task 1.6: Super-Collector Dashboard Pagination
* **The Bug:** Fetching 2,000+ horses and generating 2,000 Signed URLs simultaneously will cause OOM crashes on the Dashboard.
* **Action:** Implement cursor-based pagination on `src/app/dashboard/page.tsx` using the `IntersectionObserver` pattern. Only fetch/sign URLs for the first 24 horses initially.

### Task 1.7: Database Type Generation
* **The Bug:** Hand-written TypeScript interfaces in `database.ts` mask nullability changes made in the DB (like `finish_type` becoming optional in Epic 2), leading to silent TS errors.
* **Action:** Implement `supabase gen types typescript` to eradicate manual table interfaces. Use Supabase's `QueryData` to infer complex join shapes.

---

## 🎨 THE HOBBY-NATIVE UX MANIFESTO

Before starting Epic 2, the Architect Agent must internalize these rules. Generic SaaS UI is a failure state. Every component must pass the "Is this proper for a model horse collector?" test.

1. **The "Super-Collector" Data Density Rule:** A collector with 800 Breyers does not want to scroll through 80 pages of large cards. The UI must offer a "Binder / Spreadsheet View" for rapid scanning and inline editing of condition, finish, and value.
2. **The "Conga Line" vs. "Tax Form" Rule:** Adding a horse currently feels like doing taxes (a 4-step wizard). We must build a "Rapid Intake" mode. Search catalog -> Select Finish/Condition -> Done. Add a "Duplicate to New" button for identical molds in different finishes.
3. **The LSQ (Live Show Quality) Photography Standard:** Generic file dropzones are insufficient. The Photo Studio UI should visually map to the physical object (e.g., wireframe silhouettes of a horse for Near-Side, Off-Side, etc.) to guide the user.
4. **Context-Aware Provenance:** The Hoofprint Timeline cannot look like a Jira commit history. It must feel like a premium physical certificate. "Accolades" (NAN cards) should literally look like real ribbons on the timeline.
5. **Hobby Vocabulary:** Stop using generic terms. Use "PPD" (Postage Paid Domestic), "TP" (Time Payments), "Body Quality", and "LPU" (Local Pick Up) in the UI.

---

## 🔍 EPIC 2: Foundational Pillar Deep Dives

**Goal:** Apply the Hobby-Native UX Manifesto to our three core pillars, transforming them from "functional" to "experientially perfect."

### Deep Dive A: The Collection Pillar (Digital Stable)
* **Action 2A.1 (The Binder View):** Build a toggle on the Dashboard to switch between `StableGrid` (Gallery) and `StableLedger` (High-density table).
* **Action 2A.2 (Bulk Operations):** Implement a "Select Mode" to move multiple horses into a Collection, change Trade Status, or Bulk Delete in one click.
* **Action 2A.3 (Frictionless Intake):** Redesign `AddHorsePage` to prioritize the "Rapid Intake" flow for batch uploading.
* **Action 2A.4 (Photo Reordering):** Allow drag-and-drop reordering of the LSQ Photo Suite without deleting/re-uploading.

### Deep Dive B: The Sharing & Social Pillar
* **Action 2B.1 (Granular Privacy):** "Public" vs "Private" is too binary. Add an "Unlisted" toggle. The horse is hidden from the Show Ring, but the owner can generate a secure share link for a specific buyer.
* **Action 2B.2 (OpenGraph Previews):** Implement `generateMetadata` dynamically so when a user texts a Horse Passport URL to a friend, it generates a beautiful iMessage/Facebook preview card showing the horse's photo and name.
* **Action 2B.3 (Rich Media Embeds):** Allow users to tag/embed a specific horse passport natively inside a text post on the Universal Feed.

### Deep Dive C: The Groups & Events Pillar
* **Action 2C.1 (Batch Show Results):** Returning from a 50-class live show and entering results one-by-one is agonizing. Build a "Post-Show Results Grid" where users select a show string and rapidly tab through inputs (`[Placing] [NAN Checkbox] [Judge Note]`) in one atomic save.
* **Action 2C.2 (Ring Conflict UI):** The Show String planner must visually resemble a time-block matrix. It must flag overlaps in red if a horse is double-booked in conflicting classes.
* **Action 2C.3 (Group Registries):** Allow groups to maintain a "Registry" where members can submit their horses for official Group Certification (e.g., The Arabian Model Horse Registry).

---

## 🚀 EPIC 3: The "Fairground" Native/Offline Experience
**Goal:** Model horse shows happen in metal fairground buildings with zero Wi-Fi. The platform must work offline.
* **Task 3.1: PWA Service Worker:** Implement `@serwist/next` to cache the core UI shell.
* **Task 3.2: Local Storage Stable:** Cache the user's `user_horses` data and base64 thumbnails to `IndexedDB` on load.
* **Task 3.3: Offline Mutation Queue:** Allow users to log Show Records while offline. Queue these in IndexedDB and sync to Supabase when `navigator.onLine` fires.

---

## 💳 EPIC 4: Pro Features & NAMHSA Integration (Monetization)
**Goal:** Introduce sustainable monetization without gating core features, and build the ultimate competitive moat.
* **Task 4.1: NAMHSA Export:** Generate official, perfectly formatted NAMHSA show entry and result CSV/PDFs directly from the Show String planner. 
* **Task 4.2: Pro Tier Subscription:** Offer "MHH Pro" via Stripe. Features: Advanced analytics (historical collection value graphs), unlimited high-res photo storage, and custom profile themes.

---
**Architect Execution Protocol:**
1. Acknowledge this Master Blueprint and the Hobby-Native UX Manifesto.
2. Generate the step-by-step workflow file `.agents/workflows/v16-integrity-sprint.md` for the Developer Agent to execute Epic 1.
3. Wait for the human to confirm Epic 1 is complete before moving to Epic 2.