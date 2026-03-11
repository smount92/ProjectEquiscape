---
description: Phase 5 — Universal Ledger (Event Sourcing). Replace `horse_timeline` physical table with `v_horse_hoofprint` materialized view. UNION ALL across 5 source tables. Purge all `addTimelineEvent()` calls.
---

# Phase 5: Universal Ledger — Event Sourcing

> **Grand Unification Plan — Phase 5 of 5 (FINAL)**
> **Pre-requisites:** Phase 4 complete. Migrations 001–048 applied, build clean.
> **Iron Laws in effect:**
> - Views over Double-Writes — the timeline is DERIVED, never manually inserted
> - Zero Data Loss — manual note entries survive by migrating to `posts`
> - Performance Target — Hoofprint UI loads in <200ms even with 100+ events

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

`horse_timeline` is a physical table that requires **manual JS inserts** everywhere an event happens. Every action file that does something meaningful to a horse (`hoofprint.ts`, `horse.ts`, `parked-export.ts`, `art-studio.ts`, `provenance.ts`) must remember to insert a timeline row. This creates:

1. ❌ **Double-writes everywhere.** Every server action does the real work AND inserts a timeline row.
2. ❌ **Data drift.** If someone edits a show record's date, the timeline entry is stale.
3. ❌ **Missing events.** If a developer forgets to add `addTimelineEvent()` to a new feature, the timeline has gaps.
4. ❌ **Performance drag.** Every horse action has an extra DB write for the timeline.
5. ❌ **Fragile `event_type` CHECK constraint.** Had to be relaxed multiple times (migration 025).

### Current `horse_timeline` writers (ALL must be eliminated):

| File | What it writes |
|---|---|
| `hoofprint.ts` — `addTimelineEvent()` | User-created manual notes |
| `hoofprint.ts` — `initializeHoofprint()` | "Added to stable" entry |
| `hoofprint.ts` — `updateLifeStage()` | Stage change entry |
| `hoofprint.ts` — `deleteTimelineEvent()` | Deletes manual entries |
| `hoofprint.ts` — `getHoofprint()` | **READS** timeline |
| `horse.ts` — `createHorseRecord()` | "Horse added to stable" entry |
| `parked-export.ts` — `parkHorse()` | "Horse parked for sale" entry |
| `parked-export.ts` — `claimParkedHorse()` | Reads timeline for CoA |
| `parked-export.ts` — `generateCoA()` | Reads timeline for CoA PDF |
| `art-studio.ts` — `updateCommissionStatus()` | Commission status changes |
| `provenance.ts` — `addShowRecord()` | "Show record added" |
| `community/page.tsx` | "Recent activity" feed reads timeline |
| `stable/[id]/edit/page.tsx` | Calls `addTimelineEvent()` |
| `HoofprintTimeline.tsx` | Calls `addTimelineEvent()`, renders timeline |

## The Solution

**Replace** the physical `horse_timeline` table with a SQL **VIEW** (`v_horse_hoofprint`) that performs a `UNION ALL` across the real source tables. The timeline becomes *derived from reality*, never out of sync.

Manual user notes (the only `horse_timeline` data not derivable) get migrated into Phase 1's `posts` table as `horse_id`-scoped posts.

---

## What We're Replacing

| Legacy | Destination |
|---|---|
| `horse_timeline` rows with `event_type = 'note'` | `posts` with `horse_id` context |
| `horse_timeline` rows with `event_type = 'acquired'` | Derived from `user_horses.created_at` via view |
| `horse_timeline` rows with `event_type = 'stage_update'` | Derived from `condition_history` via view |
| `horse_timeline` rows with `event_type = 'show_result'` | Derived from `show_records` via view |
| `horse_timeline` rows with `event_type = 'transferred'` | Derived from `horse_ownership_history` via view |
| `horse_timeline` rows with `event_type = 'customization'` | Derived from `customization_logs` via view |
| `horse_timeline` rows with `event_type = 'sold'`/`'listed'` | Derived from `horse_transfers` + `horse_ownership_history` |
| `addTimelineEvent()` calls | **DELETED** — no more manual timeline writes |

---

## Task 1 — Migration 050: Universal Ledger

> ⚠️ **HUMAN REVIEW REQUIRED** before applying this migration.

Create `supabase/migrations/050_universal_ledger.sql`:

```sql
-- ============================================================
-- Migration 050: Universal Ledger — Event Sourcing (Phase 5)
-- Grand Unification Plan — FINAL PHASE
-- Replace horse_timeline with v_horse_hoofprint view
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: MIGRATE MANUAL NOTES TO POSTS
-- ══════════════════════════════════════════════════════════════

-- Manual 'note' and 'customization' and other user-authored entries
-- that don't have a source-of-truth table get migrated to posts.
-- This makes them editable, commentable, and visible in the UniversalFeed.

INSERT INTO posts (
  user_id, horse_id, body, created_at
)
SELECT
  ht.user_id,
  ht.horse_id,
  CASE
    WHEN ht.description IS NOT NULL AND ht.description != ''
      THEN ht.title || E'\n\n' || ht.description
    ELSE ht.title
  END,
  COALESCE(ht.event_date::timestamptz, ht.created_at)
FROM horse_timeline ht
WHERE ht.event_type IN ('note', 'photo_update')
  -- Skip auto-generated entries that will be derived from the view
  AND ht.event_type NOT IN ('acquired', 'stage_update', 'show_result', 'transferred', 'customization', 'sold', 'listed', 'status_change', 'condition_change');

-- ══════════════════════════════════════════════════════════════
-- STEP 2: CREATE THE HOOFPRINT VIEW
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_horse_hoofprint AS

-- 1. Creation event (from user_horses row itself)
SELECT
  uh.id AS source_id,
  uh.id AS horse_id,
  uh.owner_id AS user_id,
  'acquired' AS event_type,
  'Added to stable' AS title,
  uh.custom_name || ' was registered on Model Horse Hub.' AS description,
  uh.created_at::date AS event_date,
  jsonb_build_object('life_stage', COALESCE(uh.life_stage, 'completed')) AS metadata,
  true AS is_public,
  uh.created_at AS created_at,
  'user_horses' AS source_table
FROM user_horses uh

UNION ALL

-- 2. Ownership transfers (from horse_ownership_history)
SELECT
  oh.id AS source_id,
  oh.horse_id,
  oh.owner_id AS user_id,
  CASE
    WHEN oh.released_at IS NOT NULL THEN 'transferred'
    WHEN oh.acquisition_type = 'original' THEN 'acquired'
    ELSE 'acquired'
  END AS event_type,
  CASE
    WHEN oh.released_at IS NOT NULL THEN 'Transferred to new owner'
    ELSE 'Acquired by ' || oh.owner_alias
  END AS title,
  oh.notes AS description,
  COALESCE(oh.released_at, oh.acquired_at)::date AS event_date,
  jsonb_build_object(
    'acquisition_type', oh.acquisition_type,
    'sale_price', CASE WHEN oh.is_price_public THEN oh.sale_price ELSE NULL END
  ) AS metadata,
  true AS is_public,
  COALESCE(oh.released_at, oh.acquired_at) AS created_at,
  'horse_ownership_history' AS source_table
FROM horse_ownership_history oh
WHERE oh.acquisition_type != 'original'  -- Skip original acquisition (covered by user_horses row)

UNION ALL

-- 3. Condition changes (from condition_history)
SELECT
  ch.id AS source_id,
  ch.horse_id,
  ch.changed_by AS user_id,
  'condition_change' AS event_type,
  'Condition: ' || ch.new_condition AS title,
  CASE
    WHEN ch.old_condition IS NOT NULL
      THEN 'Changed from ' || ch.old_condition || ' to ' || ch.new_condition
    ELSE 'Condition set to ' || ch.new_condition
  END AS description,
  ch.created_at::date AS event_date,
  jsonb_build_object('old_condition', ch.old_condition, 'new_condition', ch.new_condition) AS metadata,
  true AS is_public,
  ch.created_at,
  'condition_history' AS source_table
FROM condition_history ch

UNION ALL

-- 4. Show records (from show_records)
SELECT
  sr.id AS source_id,
  sr.horse_id,
  sr.user_id,
  'show_result' AS event_type,
  COALESCE(sr."placing", 'Competed') || ' at ' || sr.show_name AS title,
  CASE
    WHEN sr.class_name IS NOT NULL THEN 'Class: ' || sr.class_name
    ELSE NULL
  END AS description,
  sr.show_date AS event_date,
  jsonb_build_object(
    'show_name', sr.show_name,
    'placing', sr."placing",
    'show_type', sr.show_type,
    'is_nan_qualifying', sr.is_nan_qualifying,
    'verification_tier', sr.verification_tier
  ) AS metadata,
  true AS is_public,
  sr.created_at,
  'show_records' AS source_table
FROM show_records sr

UNION ALL

-- 5. Customization work (from customization_logs)
SELECT
  cl.id AS source_id,
  cl.horse_id,
  uh.owner_id AS user_id,
  'customization' AS event_type,
  cl.work_type || COALESCE(' by ' || cl.artist_alias, '') AS title,
  cl.materials_used AS description,
  cl.date_completed AS event_date,
  jsonb_build_object('work_type', cl.work_type, 'artist_alias', cl.artist_alias) AS metadata,
  true AS is_public,
  COALESCE(cl.date_completed::timestamptz, now()) AS created_at,
  'customization_logs' AS source_table
FROM customization_logs cl
JOIN user_horses uh ON uh.id = cl.horse_id

UNION ALL

-- 6. User-authored notes (from posts where horse_id is set and no parent_id)
SELECT
  p.id AS source_id,
  p.horse_id,
  p.user_id,
  'note' AS event_type,
  LEFT(p.body, 80) AS title,
  p.body AS description,
  p.created_at::date AS event_date,
  '{}' AS metadata,
  true AS is_public,
  p.created_at,
  'posts' AS source_table
FROM posts p
WHERE p.horse_id IS NOT NULL
  AND p.parent_id IS NULL   -- top-level posts only, not replies

ORDER BY event_date DESC NULLS LAST, created_at DESC;

-- ══════════════════════════════════════════════════════════════
-- STEP 3: GRANT ACCESS
-- ══════════════════════════════════════════════════════════════

-- Views inherit RLS from underlying tables, but we need
-- the authenticated role to be able to SELECT from the view.
GRANT SELECT ON v_horse_hoofprint TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- STEP 4: VERIFICATION (run manually)
-- ══════════════════════════════════════════════════════════════
-- Compare row counts:
-- SELECT 'horse_timeline total' AS source, count(*) FROM horse_timeline
-- UNION ALL SELECT 'v_hoofprint total', count(*) FROM v_horse_hoofprint
-- UNION ALL SELECT 'timeline notes migrated to posts', count(*) FROM posts WHERE horse_id IS NOT NULL AND parent_id IS NULL;
--
-- Spot-check a specific horse:
-- SELECT * FROM v_horse_hoofprint WHERE horse_id = '<some-horse-uuid>' ORDER BY event_date DESC;

-- ══════════════════════════════════════════════════════════════
-- STEP 5: DROP horse_timeline — separate migration 051 AFTER code migrated
-- ══════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS horse_timeline CASCADE;
```

**Action:** Write this file. **DO NOT apply yet** — wait for human review.

**Key design decisions:**
- **VIEW not MATERIALIZED VIEW.** A regular view is always fresh — no caching lag. For a single horse's timeline (~10-50 events), the UNION ALL is fast enough. If performance is an issue later, we can add `MATERIALIZED VIEW` with a refresh trigger.
- **Manual notes → `posts`.** The Phase 1 `posts` table already has `horse_id` context. Notes migrate there, making them part of the unified social system (commentable, likeable, visible in UniversalFeed).
- **`source_table` column.** The view includes which table each row came from, useful for debugging and for rendering type-specific icons in the UI.
- **RLS inheritance.** The view inherits RLS from the underlying tables. `user_horses` public/private visibility controls what the viewer can see.
- **ORDER BY in view.** Ensures chronological ordering directly in the view — no need for JS array sorting.

---

## Task 2 — Refactor `getHoofprint()` to Read from View

Update `src/app/actions/hoofprint.ts`:

### `getHoofprint(horseId)`:
```typescript
// BEFORE: queries horse_timeline table with PostgREST join
// AFTER:  queries v_horse_hoofprint view

export async function getHoofprint(horseId: string): Promise<{
    timeline: TimelineEvent[];
    ownershipChain: OwnershipRecord[];
    lifeStage: string;
}> {
    const supabase = await createClient();

    // Single query → the view does all the UNION ALL work
    const { data: rawTimeline } = await supabase
        .from("v_horse_hoofprint")
        .select("source_id, horse_id, user_id, event_type, title, description, event_date, metadata, is_public, created_at, source_table")
        .eq("horse_id", horseId)
        .order("event_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

    // Map to TimelineEvent shape (no user alias join — view doesn't include it)
    // Fetch user aliases separately for the unique user IDs in the results
    const userIds = [...new Set((rawTimeline ?? []).map(e => e.user_id).filter(Boolean))];
    const { data: users } = await supabase
        .from("users")
        .select("id, alias_name")
        .in("id", userIds);
    const aliasMap = new Map<string, string>();
    (users ?? []).forEach(u => aliasMap.set(u.id, u.alias_name));

    const timeline: TimelineEvent[] = (rawTimeline ?? []).map(e => ({
        id: e.source_id,       // Use source_id as the event ID
        eventType: e.event_type,
        title: e.title,
        description: e.description,
        eventDate: e.event_date,
        metadata: e.metadata || {},
        isPublic: e.is_public,
        createdAt: e.created_at,
        userAlias: aliasMap.get(e.user_id) || "Unknown",
        userId: e.user_id,
    }));

    // Ownership chain stays the same — direct table query
    // ... (keep existing ownership chain code) ...
}
```

---

## Task 3 — Refactor `addTimelineEvent()` → Create Post

The `addTimelineEvent()` function is used by the UI (`HoofprintTimeline.tsx`, `edit/page.tsx`) for user-authored notes. Replace it:

```typescript
// BEFORE: inserts into horse_timeline
// AFTER:  inserts into posts (Phase 1 unified table)

export async function addTimelineEvent(data: {
    horseId: string;
    eventType: string;      // Now ignored for most types
    title: string;
    description?: string;
    eventDate?: string;
    metadata?: Record<string, unknown>;
    isPublic?: boolean;
}): Promise<{ success: boolean; error?: string }> {
    // Only 'note' type creates a post. System events are now derived from the view.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated." };

    const body = data.description
        ? data.title + "\n\n" + data.description
        : data.title;

    const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        horse_id: data.horseId,
        body,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath(`/stable/${data.horseId}`);
    revalidatePath(`/community/${data.horseId}`);
    return { success: true };
}
```

---

## Task 4 — Purge All System Timeline Inserts

Every server action that was inserting system-generated timeline entries must have those inserts **removed**. The view now derives them automatically.

| File | What to remove |
|---|---|
| `horse.ts` — `createHorseRecord()` | Remove `horse_timeline.insert({ event_type: 'acquired' })` |
| `hoofprint.ts` — `initializeHoofprint()` | Remove `horse_timeline.insert({ event_type: 'acquired' })` |
| `hoofprint.ts` — `updateLifeStage()` | Remove `horse_timeline.insert({ event_type: 'stage_update' })` — view derives from `condition_history` |
| `parked-export.ts` — `parkHorse()` | Remove `horse_timeline.insert()` |
| `art-studio.ts` — `updateCommissionStatus()` | Remove `horse_timeline.insert()` of commission status entries |
| `provenance.ts` — `addShowRecord()` | Remove the dynamic import and `addTimelineEvent()` call |

### Atomic RPCs to update:
Check migrations `035_atomic_mutations.sql`, `036_parked_atomic.sql`, `038_v4_patches.sql` for `horse_timeline` inserts inside RPCs. These will need companion migration 050 to update the RPCs:

```sql
-- Remove horse_timeline INSERT from claim_transfer_atomic RPC
-- Remove horse_timeline INSERT from claim_parked_atomic RPC  
-- Remove horse_timeline INSERT from update_condition_atomic RPC
```

---

## Task 5 — Update `deleteTimelineEvent()`

Currently deletes from `horse_timeline`. After migration:
- Notes are in `posts` → use `deletePost()` from `posts.ts`
- System events (show records, transfers, etc.) should NOT be deletable from the timeline — they're derived from reality

```typescript
export async function deleteTimelineEvent(eventId: string, horseId: string) {
    // Now only deletes posts (user notes). System events are immutable.
    const { deletePost } = await import("@/app/actions/posts");
    return deletePost(eventId);
}
```

---

## Task 6 — Update `HoofprintTimeline.tsx` Component

The component currently:
1. Renders timeline events from `getHoofprint()`
2. Has a "Add Note" form that calls `addTimelineEvent()`
3. Has delete buttons that call `deleteTimelineEvent()`

### Changes:
1. **Rendering** stays largely the same — same `TimelineEvent[]` shape.
2. **Add Note form** now creates a `post` (via the updated `addTimelineEvent()`).
3. **Delete button** — only show on `source_table = 'posts'` events (user notes). System events have no delete button.
4. **Type icons** — use `source_table` to show appropriate icons:
   - `user_horses` → 🏠 (creation)
   - `horse_ownership_history` → 🔄 (transfer)
   - `condition_history` → 📋 (condition change)
   - `show_records` → 🏆 (show result)
   - `customization_logs` → 🎨 (customization)
   - `posts` → 📝 (user note)

---

## Task 7 — Update CoA / Parked Export

`parked-export.ts` reads `horse_timeline` for Certificate of Authenticity generation. Update:

```typescript
// BEFORE: query horse_timeline
// AFTER:  query v_horse_hoofprint
const { data: timeline } = await supabase
    .from("v_horse_hoofprint")
    .select("*")
    .eq("horse_id", horseId)
    .order("event_date", { ascending: true });
```

---

## Task 8 — Update Community Page Activity Feed

`community/page.tsx` line 158 reads from `horse_timeline` for the "Recent Activity" section. Update:

```typescript
// BEFORE: query horse_timeline
// AFTER:  query v_horse_hoofprint (or better: use getPosts() for recent activity)
```

Consider: the community page might be better served by the Phase 1 `getPosts()` for social activity, rather than the Hoofprint view. Evaluate and decide.

---

## Task 9 — Update Atomic RPCs (Migration 050 additions)

Add to migration 050 (or create companion) to remove `horse_timeline` references from existing RPCs:

```sql
-- Update claim_transfer_atomic to NOT insert into horse_timeline
CREATE OR REPLACE FUNCTION claim_transfer_atomic(...)
-- (re-create without the horse_timeline INSERT)

-- Update claim_parked_atomic to NOT insert into horse_timeline
CREATE OR REPLACE FUNCTION claim_parked_atomic(...)
-- (re-create without the horse_timeline INSERT)

-- Update update_condition_atomic to NOT insert into horse_timeline
CREATE OR REPLACE FUNCTION update_condition_atomic(...)
-- (re-create without the horse_timeline INSERT)
```

**Important:** Read the current RPC bodies from migrations 035, 036, 038 and re-create them minus the `horse_timeline` INSERT statements.

---

## Task 10 — Cleanup & Verification

1. Run `npx next build` — must be 0 errors.
2. Run verification queries from Step 4 of the migration.
3. Confirm:
   - Hoofprint page loads for a horse with events from multiple sources.
   - Adding a note via the UI creates a `posts` row, visible in timeline.
   - Deleting a note removes it from the timeline.
   - Transfer events appear automatically (no manual insert needed).
   - Show records appear automatically.
   - Condition changes appear automatically.
   - CoA generation works with the view.
4. **Performance check:** Time the Hoofprint page load. Should be <200ms.
5. **Grep check:** `grep -r "horse_timeline" src/` should return 0 results.

---

## Task 11 — Drop `horse_timeline` (Migration 051)

**Only AFTER all code reads from `v_horse_hoofprint`:**

Create `supabase/migrations/051_drop_horse_timeline.sql`:
```sql
DROP TABLE IF EXISTS horse_timeline CASCADE;
```

---

## Completion Checklist

**Schema & Migration**
- [ ] Migration 050 written (`050_universal_ledger.sql`)
- [ ] Manual notes migrated to `posts` table
- [ ] `v_horse_hoofprint` view created and accessible
- [ ] Human reviewed and approved SQL
- [ ] Migration applied to production
- [ ] Atomic RPCs updated (horse_timeline INSERT removed)
- [ ] Verification queries confirm 0 data loss

**Server Actions**
- [ ] `getHoofprint()` reads from `v_horse_hoofprint` view
- [ ] `addTimelineEvent()` creates `posts` (not timeline rows)
- [ ] `deleteTimelineEvent()` deletes `posts` (not timeline rows)
- [ ] `horse.ts` — timeline insert removed from `createHorseRecord()`
- [ ] `hoofprint.ts` — timeline inserts removed from `initializeHoofprint()`, `updateLifeStage()`
- [ ] `parked-export.ts` — timeline inserts removed, CoA reads from view
- [ ] `art-studio.ts` — timeline inserts removed
- [ ] `provenance.ts` — `addTimelineEvent()` call removed

**Components**
- [ ] `HoofprintTimeline.tsx` — renders from view data, delete only on `posts` events
- [ ] Add Note form works (creates `posts`)
- [ ] System events show correct icons based on `source_table`

**Pages**
- [ ] Horse passport / stable page shows timeline from view
- [ ] Community page activity feed updated
- [ ] CoA PDF generation reads from view

**Cleanup**
- [ ] `npx next build` — 0 errors
- [ ] `grep -r "horse_timeline" src/` — 0 results
- [ ] Hoofprint loads in <200ms
- [ ] No double-writes anywhere in the codebase

**Grand Unification Complete**
- [ ] All 5 phases verified
- [ ] Migration 051 applied (drop horse_timeline)
- [ ] Human final sign-off: 🎉 Grand Unification Plan COMPLETE

**Estimated effort:** ~8-12 hours
