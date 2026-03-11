---
description: Phase 3 — Unified Competition Engine. Merge `photo_shows` into `events`, unify `show_entries` + `show_string_entries` into `event_entries`, auto-generate `show_records` from virtual show results. Everything is an Event.
---

# Phase 3: Unified Competition Engine

> **Grand Unification Plan — Phase 3 of 5**
> **Pre-requisites:** Phase 2 complete. Migrations 001–044 applied, build clean.
> **Iron Laws in effect:**
> - Zero Data Loss Migrations
> - Atomic RPCs for vote counting
> - Everything competitive lives in `events` + `event_entries`

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

Virtual shows and real-world shows are completely fractured:

| Feature | Virtual Shows | Physical Shows |
|---|---|---|
| **Where they live** | `photo_shows` | `events` |
| **Entries** | `show_entries` | `show_string_entries` (planning only) |
| **Voting** | `show_votes` | N/A (judge-scored) |
| **Results** | Manual status change | `show_records` (manual entry) |
| **Calendar** | Not on calendar | On community event calendar |
| **Discussion** | Phase 1 added `posts.show_id` | Phase 1 added `posts.event_id` |

A user hunting for competitions has to look in **two different places**, and virtual shows don't appear on the community calendar. This fractures the competitive community.

## The Solution

**Everything is an Event.** A virtual photo show is simply an `event` where `event_type = 'photo_show'` with entries and voting. Physical show planning uses the same `event_entries` table. Results feed into `show_records` either manually (physical) or automatically (virtual, based on vote count).

---

## What We're Replacing

| Legacy Table | Destination |
|---|---|
| `photo_shows` | `events` (with `event_type = 'photo_show'`) |
| `show_entries` (virtual show horse entries) | `event_entries` |
| `show_votes` (virtual show voting) | `event_votes` |
| `show_string_entries` (physical show planning) | `event_entries` (with `entry_type = 'planned'`) |

**Tables NOT touched:**
- `events` (extended, not replaced)
- `event_rsvps` (stays as-is)
- `show_records` (stays — receives auto-generated records after virtual shows close)
- `show_strings` (stays — personal planning containers)
- `posts` with `show_id` → will be re-pointed to `event_id` after migration

---

## Task 1 — Migration 046: Unified Competition Engine

> ⚠️ **HUMAN REVIEW REQUIRED** before applying this migration.

Create `supabase/migrations/046_unified_competition_engine.sql`:

```sql
-- ============================================================
-- Migration 046: Unified Competition Engine (Phase 3)
-- Grand Unification Plan — merge photo_shows into events
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: EXTEND EVENTS TABLE
-- ══════════════════════════════════════════════════════════════

-- Add virtual show management columns to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_status TEXT
  CHECK (show_status IN ('open', 'judging', 'closed'));
  -- NULL for non-show events, 'open'/'judging'/'closed' for shows

ALTER TABLE events ADD COLUMN IF NOT EXISTS show_theme TEXT;
  -- Theme/prompt for photo shows

ALTER TABLE events ADD COLUMN IF NOT EXISTS is_nan_qualifying BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS sanctioning_body TEXT;

-- Update event_type check to ensure 'photo_show' is included
-- (Already exists in migration 031, but let's be safe)
DO $$
BEGIN
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check;
  ALTER TABLE events ADD CONSTRAINT events_event_type_check CHECK (
    event_type IN (
      'live_show', 'photo_show', 'swap_meet', 'meetup',
      'breyerfest', 'studio_opening', 'auction', 'workshop', 'other'
    )
  );
END $$;

-- ══════════════════════════════════════════════════════════════
-- STEP 2: CREATE UNIFIED EVENT ENTRIES TABLE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  horse_id        UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Entry classification
  entry_type      TEXT NOT NULL DEFAULT 'entered' CHECK (entry_type IN (
    'entered',     -- Actually entered in a virtual show
    'planned'      -- Planned for a physical show (show string)
  )),
  class_name      TEXT DEFAULT 'General',
  division        TEXT,
  
  -- Virtual show fields
  votes_count     INTEGER NOT NULL DEFAULT 0,
  judge_critique  TEXT,
  judge_score     DECIMAL(5,2),
  
  -- Physical show planning fields (from show_string_entries)
  show_string_id  UUID REFERENCES show_strings(id) ON DELETE CASCADE,
  time_slot       TEXT,
  notes           TEXT,
  
  -- Results (populated when show closes)
  placing         TEXT,       -- '1st', '2nd', etc.
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One horse per event per user
  CONSTRAINT event_entries_unique UNIQUE (event_id, horse_id)
);

ALTER TABLE event_entries ENABLE ROW LEVEL SECURITY;

-- ── Event Votes ──
CREATE TABLE IF NOT EXISTS event_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES event_entries(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_votes_unique UNIQUE (entry_id, user_id)
);

ALTER TABLE event_votes ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- STEP 3: INDEXES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX idx_event_entries_event     ON event_entries (event_id, votes_count DESC);
CREATE INDEX idx_event_entries_user      ON event_entries (user_id);
CREATE INDEX idx_event_entries_horse     ON event_entries (horse_id);
CREATE INDEX idx_event_entries_string    ON event_entries (show_string_id) WHERE show_string_id IS NOT NULL;

CREATE INDEX idx_event_votes_entry      ON event_votes (entry_id);
CREATE INDEX idx_event_votes_user       ON event_votes (user_id);

CREATE INDEX idx_events_show_status     ON events (show_status, starts_at DESC) WHERE show_status IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- STEP 4: RLS POLICIES
-- ══════════════════════════════════════════════════════════════

-- ── Event Entries ──
-- Anyone can view entries for any event
CREATE POLICY "event_entries_select" ON event_entries FOR SELECT TO authenticated
USING (true);

-- Users can enter their own horses
CREATE POLICY "event_entries_insert" ON event_entries FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can update their own entries (notes, class changes)
CREATE POLICY "event_entries_update" ON event_entries FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Users can withdraw their own entries
CREATE POLICY "event_entries_delete" ON event_entries FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- ── Event Votes ──
CREATE POLICY "event_votes_select" ON event_votes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "event_votes_insert" ON event_votes FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "event_votes_delete" ON event_votes FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 5: ATOMIC RPC — Vote for an entry
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION vote_for_entry(p_entry_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists BOOLEAN;
  v_entry_user_id UUID;
BEGIN
  -- Cannot vote for your own entry
  SELECT user_id INTO v_entry_user_id FROM event_entries WHERE id = p_entry_id;
  IF v_entry_user_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot vote for your own entry');
  END IF;

  SELECT EXISTS(SELECT 1 FROM event_votes WHERE entry_id = p_entry_id AND user_id = p_user_id) INTO v_exists;
  IF v_exists THEN
    -- Unvote
    DELETE FROM event_votes WHERE entry_id = p_entry_id AND user_id = p_user_id;
    UPDATE event_entries SET votes_count = GREATEST(votes_count - 1, 0) WHERE id = p_entry_id;
    RETURN jsonb_build_object('success', true, 'action', 'unvoted');
  ELSE
    -- Vote
    INSERT INTO event_votes (entry_id, user_id) VALUES (p_entry_id, p_user_id);
    UPDATE event_entries SET votes_count = votes_count + 1 WHERE id = p_entry_id;
    RETURN jsonb_build_object('success', true, 'action', 'voted');
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- STEP 6: ATOMIC RPC — Close a virtual show and assign placings
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION close_virtual_show(p_event_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event RECORD;
  v_entry RECORD;
  v_rank INTEGER := 0;
  v_records_created INTEGER := 0;
BEGIN
  -- Validate: must be event creator and event must be a photo_show
  SELECT id, name, created_by, event_type, show_status, starts_at
  INTO v_event FROM events WHERE id = p_event_id;

  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;
  IF v_event.created_by != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the event creator can close the show');
  END IF;
  IF v_event.event_type != 'photo_show' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This event is not a photo show');
  END IF;
  IF v_event.show_status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This show is already closed');
  END IF;

  -- Update show status
  UPDATE events SET show_status = 'closed' WHERE id = p_event_id;

  -- Assign placings based on vote count (descending), then created_at (earlier = tiebreaker)
  FOR v_entry IN
    SELECT ee.id, ee.horse_id, ee.user_id, ee.votes_count, ee.class_name
    FROM event_entries ee
    WHERE ee.event_id = p_event_id AND ee.entry_type = 'entered'
    ORDER BY ee.votes_count DESC, ee.created_at ASC
  LOOP
    v_rank := v_rank + 1;

    -- Update the entry's placing
    UPDATE event_entries SET placing =
      CASE v_rank
        WHEN 1 THEN '1st'
        WHEN 2 THEN '2nd'
        WHEN 3 THEN '3rd'
        ELSE v_rank || 'th'
      END
    WHERE id = v_entry.id;

    -- Auto-generate a show_record for top 10
    IF v_rank <= 10 THEN
      INSERT INTO show_records (
        horse_id, user_id, show_name, show_date, placing, division,
        show_type, class_name, total_entries, verification_tier
      ) VALUES (
        v_entry.horse_id,
        v_entry.user_id,
        v_event.name,
        v_event.starts_at::date,
        CASE v_rank
          WHEN 1 THEN '1st'
          WHEN 2 THEN '2nd'
          WHEN 3 THEN '3rd'
          ELSE v_rank || 'th'
        END,
        v_entry.class_name,
        'photo_mhh',
        v_entry.class_name,
        (SELECT count(*) FROM event_entries WHERE event_id = p_event_id AND entry_type = 'entered'),
        'mhh_auto'
      );
      v_records_created := v_records_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'entries_ranked', v_rank,
    'records_created', v_records_created
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- STEP 7: DATA MIGRATION
-- ══════════════════════════════════════════════════════════════

-- 7a: Migrate photo_shows → events
-- photo_shows already have a linked event via events.show_id
-- But some may not have an event row yet. Create event rows for orphaned shows.
INSERT INTO events (
  name, description, event_type, starts_at, ends_at,
  is_virtual, show_status, show_theme, show_id,
  created_by, is_nan_qualifying, sanctioning_body, created_at
)
SELECT
  ps.title,
  ps.description,
  'photo_show',
  ps.start_at,
  ps.end_at,
  true,
  ps.status,
  ps.theme,
  ps.id,
  ps.created_by,
  COALESCE(ps.is_nan_qualifying, false),
  ps.sanctioning_body,
  ps.created_at
FROM photo_shows ps
WHERE NOT EXISTS (
  SELECT 1 FROM events e WHERE e.show_id = ps.id
);

-- For existing events that already link to shows, copy show metadata
UPDATE events e SET
  show_status = ps.status,
  show_theme = ps.theme,
  is_nan_qualifying = COALESCE(ps.is_nan_qualifying, false),
  sanctioning_body = ps.sanctioning_body
FROM photo_shows ps
WHERE e.show_id = ps.id
  AND e.show_status IS NULL;

-- 7b: Migrate show_entries → event_entries
INSERT INTO event_entries (id, event_id, horse_id, user_id, entry_type, class_name, votes_count, judge_critique, judge_score, created_at)
SELECT
  se.id,
  e.id,    -- the event that links to this show
  se.horse_id,
  se.user_id,
  'entered',
  COALESCE(se.class_name, 'General'),
  se.votes,
  se.judge_critique,
  se.judge_score,
  se.created_at
FROM show_entries se
JOIN events e ON e.show_id = se.show_id
ON CONFLICT (id) DO NOTHING;

-- 7c: Migrate show_votes → event_votes
INSERT INTO event_votes (id, entry_id, user_id, created_at)
SELECT
  sv.id,
  sv.entry_id,    -- same UUID, now in event_entries
  sv.user_id,
  sv.created_at
FROM show_votes sv
WHERE EXISTS (SELECT 1 FROM event_entries ee WHERE ee.id = sv.entry_id)
ON CONFLICT (id) DO NOTHING;

-- 7d: Migrate show_string_entries → event_entries
-- Show string entries are "planned" entries — they need an event_id
-- If the show_string has a show_date, try to find a matching event.
-- Otherwise, create them without event_id linkage (we'll handle orphans in app logic).
-- NOTE: show_string_entries reference show_strings, NOT events directly.
-- We keep show_string_id as a FK on event_entries for backward compat.
-- Skip this for now — show_string_entries stay as-is because they reference
-- show_strings, not events. They'll be migrated when the user converts them
-- via convertShowStringToResults(). No data loss needed.

-- 7e: Re-point posts.show_id → posts.event_id for photo_show posts
-- Posts from Phase 1 have show_id pointing to photo_shows.
-- Re-point them to the corresponding event_id.
UPDATE posts p SET
  event_id = e.id,
  show_id = NULL
FROM events e
WHERE e.show_id = p.show_id
  AND p.show_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════
-- STEP 8: VERIFICATION (run manually)
-- ══════════════════════════════════════════════════════════════
-- SELECT 'photo_shows' AS source, count(*) FROM photo_shows
-- UNION ALL SELECT 'events (photo_show)', count(*) FROM events WHERE event_type = 'photo_show'
-- UNION ALL SELECT 'show_entries', count(*) FROM show_entries
-- UNION ALL SELECT 'event_entries (entered)', count(*) FROM event_entries WHERE entry_type = 'entered'
-- UNION ALL SELECT 'show_votes', count(*) FROM show_votes
-- UNION ALL SELECT 'event_votes', count(*) FROM event_votes
-- UNION ALL SELECT 'posts with show_id', count(*) FROM posts WHERE show_id IS NOT NULL;
-- ^ Should be 0 after migration (all re-pointed to event_id)

-- ══════════════════════════════════════════════════════════════
-- STEP 9: DROP LEGACY — separate migration 047 AFTER code migrated
-- ══════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS show_votes CASCADE;
-- DROP TABLE IF EXISTS show_entries CASCADE;
-- DROP TABLE IF EXISTS photo_shows CASCADE;
-- ALTER TABLE events DROP COLUMN IF EXISTS show_id;
-- ALTER TABLE posts DROP COLUMN IF EXISTS show_id;
-- DROP FUNCTION IF EXISTS toggle_show_vote CASCADE;  -- if exists
```

**Action:** Write this file. **DO NOT apply yet** — wait for human review.

**Key design decisions:**
- `event_entries` unifies virtual show entries and physical show planning into one table. The `entry_type` column distinguishes `'entered'` (actually competing) from `'planned'` (show string planning).
- `show_string_entries` stay as-is initially. The `show_string_id` FK on `event_entries` allows backward compatibility with the show string planner.
- `close_virtual_show()` RPC auto-assigns placings by vote count and auto-generates `show_records` for top 10.
- Posts with `show_id` are re-pointed to `event_id` so the Phase 1 `UniversalFeed` works seamlessly on the unified event page.

---

## Task 2 — Server Actions: Unified Competition

Refactor `src/app/actions/shows.ts` to read from `events` + `event_entries` + `event_votes` instead of `photo_shows` + `show_entries` + `show_votes`.

### Functions to update:

```typescript
// ── getPhotoShows() ──
// Change: Query events WHERE event_type = 'photo_show' instead of photo_shows table.
// Return same ShowDisplay shape.

// ── getShowEntries(showId) ──
// Change: showId is now event_id. Query event_entries WHERE event_id = showId.
// Votes come from event_votes, not show_votes.
// Return same ShowEntryDisplay shape.

// ── enterShow(showId, horseId) ──
// Change: Insert into event_entries WHERE event_id = showId AND entry_type = 'entered'.
// Keep existing duplicate and ownership checks.

// ── voteForEntry(entryId) ──
// Change: Call vote_for_entry RPC instead of manual show_votes insert + counter update.

// ── createPhotoShow(data) ──
// Change: Insert into events with event_type = 'photo_show', show_status = 'open'.
// No longer insert into photo_shows.

// ── updateShowStatus(showId, newStatus) ──
// Change: Update events.show_status instead of photo_shows.status.
// If newStatus === 'closed', call close_virtual_show RPC to auto-assign placings.

// ── deleteShow(showId) ──
// Change: Delete from events instead of photo_shows.

// ── withdrawEntry(entryId) ──
// Change: Delete from event_entries instead of show_entries.
```

---

## Task 3 — Update Show String Planner

Refactor `src/app/actions/competition.ts`:

### Functions to update:

```typescript
// ── addShowStringEntry(data) ──
// Change: Insert into event_entries with entry_type = 'planned' and show_string_id.
// Need to handle: event_id may be NULL for planned entries that aren't linked to a specific event yet.
// Approach: If show_string has a show_date, try to find a matching event. Otherwise, leave event_id NULL.
// NOTE: event_entries_unique constraint (event_id, horse_id) won't fire when event_id is NULL.

// ── removeShowStringEntry(entryId) ──
// Change: Delete from event_entries instead of show_string_entries.

// ── getShowStringEntries(showStringId) ──
// Change: Query event_entries WHERE show_string_id = showStringId.

// ── convertShowStringToResults() ──
// Change: Read from event_entries instead of show_string_entries.
// Still creates show_records manually (physical shows aren't auto-closed).

// ── detectConflicts() ──
// Change: Read from event_entries WHERE show_string_id = showStringId.
```

---

## Task 4 — Wire Pages to Unified System

| Page | Change |
|---|---|
| `/shows/page.tsx` | Query `events WHERE event_type = 'photo_show'` instead of `photo_shows` |
| `/shows/[id]/page.tsx` | `showId` is now `eventId`. Use `getShowEntries(eventId)`. Show discussion via `<UniversalFeed context={{ eventId }}>` (remove `showId` context) |
| `/shows/planner/page.tsx` | Show strings still work. `getShowStringEntries()` reads from `event_entries` |
| `/community/events/page.tsx` | Virtual photo shows now appear on the community calendar automatically (no code change needed — they're just events now) |

**Critical:** The `/shows/[id]/page.tsx` was using `<UniversalFeed context={{ showId }}>`. After migration, posts have been re-pointed from `show_id` → `event_id`. Update to `<UniversalFeed context={{ eventId }}>`.

---

## Task 5 — Update Legacy References

- Remove `posts.show_id` references from `getPosts()` in `posts.ts` — the `show_id` context is deprecated. All show discussion now uses `event_id`.
- Update `UniversalFeed.tsx` props to remove `showId` from context type.
- Remove `events.show_id` column usage — no longer needed after migration.

---

## Task 6 — Virtual Show Auto-Close Integration

When a virtual show's `ends_at` passes and it's still `status = 'open'`:

### Option A (Recommended): Manual close by creator
- On the show detail page, show a "Close Show & Calculate Results" button when `show_status = 'open'` and `ends_at < now()`.
- Button calls `close_virtual_show` RPC.
- Display results with placings after close.

### Option B (Future): Cron job
- A Supabase Edge Function runs on a schedule and calls `close_virtual_show` for expired shows.
- Not needed for MVP — manual close is fine.

---

## Task 7 — Cleanup & Verification

1. Run `npx next build` — must be 0 errors.
2. Run the verification queries from Step 8 of the migration.
3. Confirm:
   - Virtual photo shows appear on the community event calendar.
   - Entering a virtual show works (entries go into `event_entries`).
   - Voting works via atomic RPC.
   - Closing a show assigns placings and auto-creates `show_records`.
   - Show string planner still works (entries in `event_entries` with `entry_type = 'planned'`).
   - Post comments on shows use `event_id` context (not `show_id`).
4. `posts.show_id` should have 0 rows (all re-pointed to `event_id`).

---

## Completion Checklist

**Schema & Migration**
- [ ] Migration 046 written (`046_unified_competition_engine.sql`)
- [ ] Human reviewed and approved SQL
- [ ] Migration applied to production
- [ ] Verification queries confirm 0 data loss
- [ ] `close_virtual_show` RPC tested
- [ ] `vote_for_entry` RPC tested

**Server Actions**
- [ ] `shows.ts` reads from `events` + `event_entries` + `event_votes`
- [ ] `competition.ts` reads from `event_entries` for show strings
- [ ] `createPhotoShow()` inserts into `events` (not `photo_shows`)
- [ ] `voteForEntry()` uses `vote_for_entry` RPC
- [ ] `updateShowStatus("closed")` calls `close_virtual_show` RPC
- [ ] `convertShowStringToResults()` reads from `event_entries`

**Pages Wired**
- [ ] `/shows/page.tsx` — lists events where `event_type = 'photo_show'`
- [ ] `/shows/[id]/page.tsx` — uses `eventId` not `showId`, `<UniversalFeed context={{ eventId }}>`
- [ ] `/shows/planner/page.tsx` — show strings read from `event_entries`
- [ ] Virtual shows visible on community event calendar

**Cleanup**
- [ ] `npx next build` — 0 errors
- [ ] `posts.show_id` has 0 rows (all re-pointed)
- [ ] `showId` removed from `UniversalFeed` context type
- [ ] `showId` removed from `getPosts()` context
- [ ] Auto-generated `show_records` appear on horse passports

**DO NOT proceed to Phase 4 until this checklist is fully complete and human has verified.**

**Estimated effort:** ~10-14 hours
