# 🗺️ Project Equispace: The Grand Unification Plan (Architecture V3.0)

> **Date:** March 2026
> **Document Type:** Master Strategic Roadmap
> **Target Audience:** Human Founders, Antigravity Architect Agent
> **Objective:** Dismantle the 5 feature silos (Social/Media, Trust, Competition, Catalog, Ledger) created during MVP iteration. Rebuild using polymorphic relationships, event-sourcing, and unified data graphs without data loss.

## 🏛️ Core Architectural Principles (The "Iron Laws")
1. **Zero Data Loss Migrations:** Every schema change MUST include a robust PL/pgSQL data migration script. We move existing production data *before* we drop old tables. 
2. **Exclusive Arcs:** When linking a universal table (e.g., `posts`, `media`) to specific entities (horses, groups, events), use multiple nullable Foreign Keys combined with a Postgres `CHECK (num_nonnulls(...) <= 1)` constraint to ensure strict referential integrity.
3. **Event Sourcing (Single Source of Truth):** If data exists in a primary domain table (e.g., `show_records`, `horse_transfers`), it must **never** be manually duplicated into a UI timeline table. UI timelines must be driven by PostgreSQL `VIEWS`.
4. **Vercel Payload Compliance:** File payloads must NEVER pass through Next.js Server Actions. Direct-to-storage via the Supabase browser client is mandatory for all media.
5. **Atomic Mutations:** Counters (likes, replies) and complex state transitions must use transactional Postgres RPCs (`FOR UPDATE` row locks).

---

## 📅 PHASE 1: Universal Social & Media Engine (V6 Sprint)
**Target:** Fixes Silo 1 (Social Media) & Silo 2 (Media Scatter)
**Estimated Timeline:** 1-2 Weeks

**The Problem:** Comments, feed posts, and group posts are scattered across multiple tables. Casual images are dumped into text arrays. No threaded replies or `@mentions`.
**The Goal:** A single `posts` table that handles all text content, and a `media_attachments` table that handles all casual image uploads.

### 1. Architectural Blueprint
*   **Table: `posts`**
    *   Replaces: `horse_comments`, `group_posts`, `group_post_replies`, `activity_events` (text posts).
    *   Schema: `id, author_id, content, parent_id` (for threading), `likes_count, replies_count, created_at`.
    *   Exclusive Arc Contexts: `horse_id, group_id, event_id, studio_id, help_request_id`.
*   **Table: `media_attachments`**
    *   Replaces: `image_urls TEXT[]` arrays.
    *   Schema: `id, storage_path, uploader_id, created_at`.
    *   Exclusive Arc Contexts: `post_id, message_id, help_request_id, commission_id`.
    *   *Note: Formal `horse_images` (LSQ angles) remain in their own table due to strict domain constraints.*
*   **Table: `likes`**
    *   Schema: `id, user_id, post_id`.
*   **UI Component:** A single, highly polished `<UniversalFeed />` that handles markdown, `@mentions`, media lightboxes, infinite scroll, and 1-level deep replies.

### 2. Definition of Done (DoD)
- [ ] Migration script successfully moves all existing comments/posts into `posts` without losing timestamps or authors.
- [ ] Users can upload casual "shelfie" images to feed posts and group posts directly to storage, linked via `media_attachments`.
- [ ] Users can "Like" any post, with instant optimistic UI updates via Atomic RPC.
- [ ] Global `@mention` parser linkifies names and triggers notifications.
- [ ] Legacy tables (`group_posts`, `horse_comments`) are safely dropped.

### 3. Testing Requirements
- **Automated:** Verify `CHECK` constraint rejects posts with both `horse_id` and `group_id`.
- **Manual:** Upload a 5MB image to a feed post; verify client-side compression prevents Vercel 413 crashes and inserts a record into `media_attachments`.

---

## 🤝 PHASE 2: Universal Trust & Commerce Engine (V7 Sprint)
**Target:** Fixes Silo 3 (Commerce & Ratings)
**Estimated Timeline:** 1 Week

**The Problem:** You can only rate someone if you talked to them in the native inbox (`conversations`). You cannot rate them for an Art Commission, or for an off-platform Parked Horse sale.
**The Goal:** Abstract transactions out of the DM layer.

### 1. Architectural Blueprint
*   **Table: `transactions`**
    *   Schema: `id, type` (enum: 'transfer', 'commission', 'marketplace_sale'), `status` ('pending', 'completed', 'cancelled'), `party_a_id` (seller/artist), `party_b_id` (buyer/client), `horse_id`, `created_at`, `completed_at`.
*   **Table: `reviews`**
    *   Replaces: `user_ratings`.
    *   Schema: `id, transaction_id, reviewer_id, target_id, stars, content`.
    *   Constraint: `UNIQUE(transaction_id, reviewer_id)`.

### 2. Definition of Done (DoD)
- [ ] Migration script creates synthetic `transactions` for all existing `user_ratings` and migrates the ratings over.
- [ ] Claiming a Parked Horse via PIN automatically generates a `transaction`, allowing the buyer to rate the seller without ever sending a DM.
- [ ] Completing an Art Studio commission allows the client and artist to rate each other.

### 3. Testing Requirements
- **Manual:** Generate a transfer code -> Claim on an alt account -> Leave a 5-star review. Verify the review appears on the seller's profile without a DM ever existing.

---

## 🏆 PHASE 3: Unified Competition Engine (V8 Sprint)
**Target:** Fixes Silo 6 (Virtual vs. Physical Shows)
**Estimated Timeline:** 1-2 Weeks

**The Problem:** Virtual "Photo Shows" (`photo_shows`) and real-world shows (`events`) live in completely different databases, fracturing the competitive community.
**The Goal:** Everything is an `Event`.

### 1. Architectural Blueprint
*   **Merge into `events`:**
    *   Refactor `photo_shows` to simply be an `event` where `is_virtual_show = true` and `event_type = 'photo_show'`. 
*   **Merge Entries:** 
    *   Merge `show_entries` (virtual) and `show_string_entries` (physical planner) into a single `event_entries` table.
    *   Schema: `id, event_id, horse_id, user_id, class_name, placing, judge_critique, votes_count`.

### 2. Definition of Done (DoD)
- [ ] `photo_shows` are migrated into `events`.
- [ ] Virtual entries and physical show strings are merged into `event_entries`.
- [ ] When a virtual show ends, the system automatically assigns `placing` to the `event_entries` based on votes, generating official `show_records`.
- [ ] Virtual Shows appear on the global Community Event Calendar.

### 3. Testing Requirements
- **Concurrency:** Ensure voting on virtual shows remains atomic under the new schema.
- **Integration:** Verify that physical show string planners still function exactly as before, but write to the new `event_entries` table.

---

## 📖 PHASE 4: Universal Catalog (V9 Sprint)
**Target:** Fixes Silo 5 (Reference Catalog Fork)
**Estimated Timeline:** 2 Weeks (High Data Complexity)

**The Problem:** Searching for a horse requires branching logic across three tables (`reference_molds`, `reference_releases`, `artist_resins`).
**The Goal:** Unify all 10,500+ references into one catalog to future-proof against tack, medallions, and vintage models.

### 1. Architectural Blueprint
*   **Table: `catalog_items` (Polymorphic)**
    *   Replaces: `reference_molds`, `reference_releases`, `artist_resins`.
    *   Schema: `id, item_type` ('plastic_mold', 'plastic_release', 'artist_resin', 'tack'), `parent_id` (links release to mold), `maker, title, scale, attributes` (JSONB for specific data like cast medium, color, or year).
*   **Update `user_horses`:**
    *   Drop `reference_mold_id`, `artist_resin_id`, `release_id`. 
    *   Add a single `catalog_id UUID REFERENCES catalog_items(id)`.

### 2. Definition of Done (DoD)
- [ ] Migration script safely transforms `molds`, `releases`, and `resins` into `catalog_items` and updates all `user_horses` foreign keys.
- [ ] `UnifiedReferenceSearch.tsx` drops hundreds of lines of code, querying a single table.
- [ ] The Batch CSV Import script logic is massively simplified.

### 3. Testing Requirements
- **Data Loss Prevention:** Verify `SELECT count(*)` before and after the data migration scripts to prove 0 records were lost.
- **Search Integrity:** Fuzzy search must still properly match "Breyer #700195" accurately.

---

## 🐾 PHASE 5: Universal Ledger - Event Sourcing (V10 Sprint)
**Target:** Fixes Silo 4 (Provenance Double-Writes)
**Estimated Timeline:** 1 Week

**The Problem:** `horse_timeline` is vulnerable to falling out of sync with actual show/transfer records because it requires manual JS inserts.
**The Goal:** Make Hoofprint completely dynamic and derived from reality.

### 1. Architectural Blueprint
*   **View: `v_horse_hoofprint`**
    *   Drop the `horse_timeline` physical table.
    *   Create a SQL `VIEW` that performs a `UNION ALL` across `user_horses` (Creation), `horse_ownership_history` (Transfers), `condition_history` (Condition changes), `show_records` (Wins), and `posts` (where context is `horse_id` for custom notes).

### 2. Definition of Done (DoD)
- [ ] Manual text entries in the old `horse_timeline` are migrated into the Phase 1 `posts` table (`horse_id` context).
- [ ] `horse_timeline` table is dropped.
- [ ] Editing a show record's date automatically updates the chronological order of the Hoofprint UI without any Javascript array manipulation.
- [ ] The codebase is purged of `addTimelineEvent()` calls, significantly speeding up Server Actions.

### 3. Testing Requirements
- **Performance Profiling:** A database View combining 5 tables can be slow if not indexed correctly. Test the Hoofprint UI load time on a horse with 100+ events to ensure it remains <200ms.

---

## 🤖 INSTRUCTIONS FOR THE ARCHITECT AGENT
When the human user commands you to begin a Phase, you must strictly adhere to this protocol:

1. **Acknowledge the Plan:** Confirm you have ingested the 5 Phases and understand the "Iron Laws" (No silos, Views over Double-Writes, Zero-Downtime migrations).
2. **Execute Sequentially:** Do NOT generate Phase 2 until Phase 1 is fully built, tested, and marked `✅ DONE` by the human.
3. **Generate Workflow File:** Create a markdown file in `.agents/workflows/` (e.g., `v6-social-engine.md`) containing the step-by-step instructions for the Developer Agent.
4. **Data Migrations are Mandatory:** The workflow MUST begin with the SQL Data Migration script (`INSERT INTO new_table SELECT FROM old_table`). Ensure all `ON DELETE CASCADE` and Exclusive Arc `CHECK` constraints are perfectly formatted.
5. **Pause for Human Review:** Wait for the human founder to approve the SQL migration and the developer workflow before proceeding to execution.