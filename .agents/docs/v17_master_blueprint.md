# 🗺️ Master Blueprint: V16 UI Overhaul, Integrity & Foundational Deep Dives

> **Target Audience:** Antigravity Architect Agent
> **Developer Agent:** Claude 3.7 Sonnet / Opus 4.6 (Requires strict architectural boundaries)
> **Context:** Model Horse Hub has completed its Grand Unification (V10) and Ecosystem Expansion (V11-V15). The database is highly relational, polymorphic, and event-sourced. 
> **Current State:** The platform suffers from "Developer-Driven UI" — components are stacked vertically in a single column, widescreen space is wasted, native dropdowns look ugly, and secondary widgets (like the NAN tracker) interrupt the primary user flow. Furthermore, there are hidden backend scale bottlenecks.
> **Architect Directive:** You are entering a FEATURE FREEZE for new capabilities. You must execute **Epic 1 (UX Overhaul)** to fix the desktop layout and styling. Then execute **Epic 2 (Integrity Sprint)** to plug critical data leaks. Finally, proceed to **Epics 3-5 (Pillar Deep Dives)** to perfect the core user workflows.

---

## 🎨 EPIC 1: The "Pro Dashboard" UI/UX Overhaul

**Goal:** Eradicate the "Single-Column Stack" design. Utilize widescreen desktop space efficiently, move secondary widgets out of the primary flow, and polish degraded UI components so the app feels like a premium SaaS.

### Task 1.1: The Dashboard Two-Column Layout
* **The Bug:** Massive empty margins on desktop. The Welcome Card, Analytics, Collections, and NAN Widget are stacked vertically, pushing the actual horse grid far below the fold.
* **Architect Action:** Redesign `src/app/dashboard/page.tsx`. 
  * Implement a CSS Grid layout for screens > `1024px` (e.g., `grid-template-columns: 1fr 350px; gap: 2rem;`).
  * **Main Content Area (Left):** Dedicated exclusively to the Search/Sort bar and the `StableGrid`. The horses must be the undisputed hero of the page.
  * **Sidebar (Right):** Move the "Stable Overview" (Analytics stats), "Collections" list, the "NAN Qualification Tracker", and "Transfer History" into a sticky right-hand sidebar.

### Task 1.2: Widescreen Container Expansion
* **The Bug:** The `.page-container-wide` max-width is too restrictive on modern 1440p+ monitors, leaving huge dark gutters.
* **Architect Action:** Update `globals.css`. Increase the max-width of grid-heavy pages to `1600px` or `1800px` (or use `width: 100%; padding: 0 4vw;`). Adjust the CSS Grid columns in `StableGrid` and `ShowRingGrid` to dynamically fill up to 5, 6, or 7 columns on ultra-wide screens using `auto-fill, minmax(260px, 1fr)`.

### Task 1.3: Dropdown & Form Polish ("The Ugly Dropdown" Fix)
* **The Bug:** Native HTML `<select>` elements and the `UnifiedReferenceSearch` dropdown look clunky, lack proper padding, and break the Glassmorphism illusion.
* **Architect Action:** 
  * Refine `.form-select`, `.form-input`, and `.ref-search-input` in `globals.css`. 
  * Remove native browser select styling (`appearance: none; -webkit-appearance: none;`). Add a custom SVG chevron background image for selects.
  * Ensure the `UnifiedReferenceSearch` dropdown menu has a proper backdrop blur, rounded corners, subtle borders, and doesn't look like a raw unstyled list.

---

## 🧱 EPIC 2: The V17 Integrity Sprint (Critical Hardening)

**Goal:** Fix data loss vectors, prevent out-of-memory crashes, and align with Next.js serverless limits.

### Task 2.1: The Batch Import RPC Fix
* **The Bug:** `batch_import_horses` (Migration 023) references dropped legacy columns (`reference_mold_id`), causing CSV imports to 500 crash.
* **Architect Action:** Write a SQL migration (`056_fix_batch_import.sql`) to recreate `batch_import_horses`. Update the JSON payload parsing to write to the new `catalog_id` and `asset_category` columns.

### Task 2.2: The "Blue Book" Data Pipeline
* **The Bug:** `claim_transfer_atomic` and `claim_parked_horse_atomic` do not return the `sale_price`. Therefore, `createTransaction()` saves empty price metadata, starving the Market Price Guide.
* **Architect Action:** Update the SQL RPCs to return `v_transfer.sale_price`. Update server actions to map `result.sale_price` into the `metadata` object passed to `createTransaction`.

### Task 2.3: Serverless Execution Safety (`next/server`)
* **The Bug:** Un-awaited promises (Resend emails, activity logging) are killed instantly when Vercel returns the HTTP response.
* **Architect Action:** Globally implement the `after()` API from `next/server`. Wrap all notification triggers and activity event insertions inside `after(async () => { ... })` across all Server Actions. 
* **Crucial Fix:** Remove the `window.location.href` hard redirect in `src/app/stable/[id]/edit/page.tsx` that aborts background requests like `notifyHorsePublic`.

### Task 2.4: Vercel Cron for Materialized Views
* **The Bug:** Triggering `REFRESH MATERIALIZED VIEW CONCURRENTLY` on every transaction will DDOS the database at scale.
* **Architect Action:** Remove the inline refresh from `completeTransaction`. Create `src/app/api/cron/refresh-market/route.ts` (secured via `CRON_SECRET`).

### Task 2.5: Server-Side SEO for the Price Guide
* **The Bug:** `src/app/market/page.tsx` is a `"use client"` component. Search engines see a blank loading spinner.
* **Architect Action:** Refactor `/market/page.tsx` into a true React Server Component reading from `searchParams` for true SEO indexing.

### Task 2.6: Super-Collector Dashboard Pagination
* **The Bug:** Fetching 2,000+ horses and generating 2,000 Signed URLs simultaneously crashes the Dashboard.
* **Architect Action:** Implement infinite scroll / cursor-based pagination on `src/app/dashboard/page.tsx`. Only fetch and sign URLs for the first 24-36 horses. Use an `IntersectionObserver` client component to load subsequent batches.

---

## 🔍 EPIC 3: Foundational Pillar Deep Dive A — The Collection
**Goal:** Remove friction for daily management of massive herds.
* **Bulk Operations:** Add a "Select Mode" to the Stable Grid. Allow users to check multiple horses and click "Move to Collection", "Change Trade Status", or "Bulk Delete" in one click. Doing this 1-by-1 for 200 horses is a non-starter.
* **Spreadsheet / List View:** Add a toggle to the Stable Grid to switch from "Image Cards" to a "Compact List View" (a high-density data table showing Name, Mold, Condition, and Value) for rapid visual scanning of massive herds.
* **Photo Reordering:** Allow users to drag-and-drop to change which photo is the `Primary_Thumbnail` without deleting and re-uploading.

---

## 🗣️ EPIC 4: Foundational Pillar Deep Dive B — Sharing & Social
**Goal:** Ensure content looks beautiful off-platform and is highly relevant on-platform.
* **OpenGraph (OG) Image Generation:** When a user shares a Horse Passport URL to Facebook/iMessage, it must dynamically generate a beautiful preview card showing the horse's photo, name, and MHH branding (using Next.js `generateMetadata` or `@vercel/og`).
* **Granular Privacy (Unlisted):** "Public" and "Private" is too binary. Add an "Unlisted" toggle. The horse is hidden from the Show Ring and Feed, but the owner can generate a secure share link to send to a specific buyer in a DM.
* **Rich Media Embeds:** Update the `UniversalFeed` so users can paste a Horse Passport URL into a post, and it automatically unfurls into a beautiful embedded card (like Twitter/Discord).

---

## 🏛️ EPIC 5: Foundational Pillar Deep Dive C — Groups & Events
**Goal:** Make clubs feel private, safe, and highly functional, transitioning them from a chat feed into real utility.
* **Group Registries:** Allow groups to maintain a "Registry" where members can submit their horses for official Group Certification (e.g., The Arabian Model Horse Registry).
* **Group-Specific Assets:** Add a "Files/Docs" tab to Groups so admins can upload static PDFs (Club Bylaws, Show Rules, Class Lists).
* **Admin Moderation Tools:** Give Group owners a dashboard to manage join requests, ban users, and pin announcements to the top of the group feed.
* **Sub-Channels:** Evaluate adding "Channels" (e.g., `#general`, `#sales`, `#show-chat`) using a `channel_id` on `group_posts` to prevent the feed from becoming chaotic.