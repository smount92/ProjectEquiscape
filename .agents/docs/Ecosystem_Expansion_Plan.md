# 🗺️ Master Blueprint: Phase 6 — Ecosystem Expansion & Native Prep

> **Target Audience:** Antigravity Architect Agent & Developer Agents
> **Context:** The Grand Unification Plan (Migrations 042–050) successfully transformed the database into a polymorphic, event-sourced architecture. However, the Next.js UI is still heavily reliant on "Legacy Shims", and the database still retains deprecated columns.
> **Objective:** Purge all legacy UI state, drop the deprecated tables, introduce Tack/Props to the stable, build the strict relational tree for Live Shows, and launch the Market Price Guide.

## 🚨 Architect Directives
1. **Sequential Execution:** You must enforce that the Developer Agent completes Epic 1 (The Great Purge) completely before starting Epic 2. We cannot build new features on top of shims.
2. **Burn the Ships:** The end goal of Epic 1 is to execute `DROP TABLE` on all legacy structures.
3. **Thick DB, Thin API:** We are preparing for a Native React Native App. If a Server Action is doing heavy data massaging, push that logic into a Postgres View or RPC.

---

## 🧹 EPIC 1: The Great Purge (Burn the Ships)
**Target:** Remove legacy foreign keys (`mold_id`, `release_id`, `resin_id`) entirely from the frontend and drop the legacy DB tables.

### Task 1.1: Drop Legacy Tables & Columns (Migrations 043, 045, 047, 049, 051)
*   **Action (SQL):** Create the cleanup migrations to drop the old architecture.
    *   Drop legacy columns: `ALTER TABLE user_horses DROP COLUMN reference_mold_id, DROP COLUMN release_id, DROP COLUMN artist_resin_id;`
    *   Drop legacy reference tables: `DROP TABLE reference_molds, reference_releases, artist_resins CASCADE;`
    *   Drop legacy social tables: `horse_comments`, `group_posts`, `user_ratings`, `photo_shows`, `show_entries`.
    *   Drop `horse_timeline`.

### Task 1.2: Unify the Reference Search Component
*   **File:** `src/components/UnifiedReferenceSearch.tsx`
*   **Action:** Strip out the fake `mold` vs `resin` UI tabs. The component should feature one unified search bar querying `searchCatalogAction`. Render a single list of results with dynamic UI badges (e.g., 🏭 Mold, 🎨 Resin, 📦 Release) driven entirely by `item_type`.

### Task 1.3: Purge Legacy Types
*   **File:** `src/lib/types/database.ts`
*   **Action:** Delete `ReferenceMold`, `ReferenceRelease`, `ArtistResin`, and all other deprecated interfaces. 

---

## 🎨 EPIC 2: Universal Asset Expansion (Tack, Props & Dioramas)
**Target:** Expand the inventory to support non-horse items, leveraging the new polymorphic `catalog_items`.

### Task 2.1: Asset Category Schema
*   **Action (SQL):** `ALTER TABLE user_horses ADD COLUMN asset_category TEXT DEFAULT 'model' CHECK (asset_category IN ('model', 'tack', 'prop', 'diorama'));`
*   **Action (SQL):** Alter `finish_type` and `condition_grade` in `user_horses` to allow `NULL`. A "Leather Western Saddle" shouldn't require an "Original Finish" designation.

### Task 2.2: Dynamic Intake Form
*   **File:** `src/app/add-horse/page.tsx`
*   **Action:** Add a category toggle at the top of the intake form: `[🐎 Model] | [🏇 Tack & Gear] | [🌲 Prop]`.
*   **Action:** If Tack/Prop is selected, filter `UnifiedReferenceSearch` by `item_type IN ('tack', 'medallion', 'micro_mini')`. Conditionally hide "Finish Type" and "Pedigree" fields.

---

## 🏆 EPIC 3: The Live Show Relational Tree
**Target:** Replace free-text show classes with a strict relational tree to support real-world NAMHSA show runners.

### Task 3.1: The Competition Schema Update
*   **Action (SQL):** Create migration `053_live_show_tree.sql`.
    ```sql
    CREATE TABLE event_divisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id UUID REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL, -- e.g., "OF Plastic Halter"
      sort_order INT DEFAULT 0
    );

    CREATE TABLE event_classes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      division_id UUID REFERENCES event_divisions(id) ON DELETE CASCADE,
      name TEXT NOT NULL, -- e.g., "Arabian/Part-Arabian"
      class_number TEXT,  -- e.g., "Class 101"
      is_nan_qualifying BOOLEAN DEFAULT false,
      sort_order INT DEFAULT 0
    );

    ALTER TABLE event_entries ADD COLUMN class_id UUID REFERENCES event_classes(id) ON DELETE CASCADE;
    ```
    *(Note: We leave the old `class_name` text column as nullable for backward compatibility with informal virtual shows).*

### Task 3.2: Show Host Builder UI
*   **Action:** Build a `/community/events/[id]/manage` UI where an event creator can define their Divisions and Classes tree before opening the show for entries.
*   **Action:** Update `ShowStringManager` and `ShowEntryForm` to use cascading dropdowns (Select Division -> Select Class) when `event_divisions` exist for the target event.

---

## 📈 EPIC 4: The Market Price Guide ("The Blue Book")
**Target:** Unleash the unified `transactions` and `catalog_items` data to become the hobby's #1 SEO destination for valuations.

### Task 4.1: Materialized Price Aggregation
*   **Action (SQL):** Create `mv_market_prices`.
    ```sql
    CREATE MATERIALIZED VIEW mv_market_prices AS
    SELECT 
      h.catalog_id,
      MIN(CAST(t.metadata->>'sale_price' AS DECIMAL)) as lowest_price,
      MAX(CAST(t.metadata->>'sale_price' AS DECIMAL)) as highest_price,
      AVG(CAST(t.metadata->>'sale_price' AS DECIMAL)) as average_price,
      COUNT(t.id) as transaction_volume,
      MAX(t.completed_at) as last_sold_at
    FROM transactions t
    JOIN user_horses h ON t.horse_id = h.id
    WHERE t.status = 'completed' 
      AND t.metadata->>'sale_price' IS NOT NULL
    GROUP BY h.catalog_id;
    
    CREATE UNIQUE INDEX idx_mv_market_prices_catalog ON mv_market_prices(catalog_id);
    ```

### Task 4.2: Price Guide UI
*   **Action:** Create a public `/market` route. Display a searchable directory of `catalog_items` sorted by transaction volume or average price.
*   **Action:** Inject a "Market Value" badge into the `UnifiedReferenceSearch` and Public Passport components (e.g., `📈 Est. Market Value: $45 - $65`) if the item exists in the materialized view.

---

## 📡 EPIC 5: Offline-First PWA (The Fairground Fix)
**Target:** Allow collectors to use the Show String Planner and log Show Records inside metal fairgrounds with no Wi-Fi.

### Task 5.1: Offline Capabilities
*   **Infrastructure:** Implement `@serwist/next` to generate a `manifest.json` and service worker.
*   **Offline Data Store:** On `/shows/planner`, add a toggle: *"💾 Make String Available Offline"*. Cache the JSON payload and Base64 thumbnails into `idb-keyval` for the browser.
*   **Mutation Queue:** If `!navigator.onLine`, save Show Results into an `offline_mutations` array in IndexedDB. Use `window.addEventListener('online')` to automatically flush to the server via Server Actions when the user gets cell service.

---
**Agent Execution Protocol:**
Architect Agent: Acknowledge this blueprint. Start by generating `.agents/workflows/v11-epic1-the-purge.md` containing the step-by-step instructions for the Developer Agent to execute the UI Purge and final table drops.