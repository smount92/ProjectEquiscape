-- ============================================================
-- Migration 046: Unified Competition Engine (Phase 3)
-- Grand Unification Plan — merge photo_shows into events
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: EXTEND EVENTS TABLE
-- ══════════════════════════════════════════════════════════════

ALTER TABLE events ADD COLUMN IF NOT EXISTS show_status TEXT
  CHECK (show_status IN ('open', 'judging', 'closed'));

ALTER TABLE events ADD COLUMN IF NOT EXISTS show_theme TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_nan_qualifying BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS sanctioning_body TEXT;

-- Ensure event_type constraint includes all needed types
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

  entry_type      TEXT NOT NULL DEFAULT 'entered' CHECK (entry_type IN (
    'entered',     -- Virtual show entry
    'planned'      -- Physical show planning (show string)
  )),
  class_name      TEXT DEFAULT 'General',
  division        TEXT,

  -- Virtual show fields
  votes_count     INTEGER NOT NULL DEFAULT 0,
  judge_critique  TEXT,
  judge_score     DECIMAL(5,2),

  -- Physical show planning fields
  show_string_id  UUID REFERENCES show_strings(id) ON DELETE CASCADE,
  time_slot       TEXT,
  notes           TEXT,

  -- Results
  "placing"       TEXT,       -- '1st', '2nd', etc.

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

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

CREATE POLICY "event_entries_select" ON event_entries FOR SELECT TO authenticated
USING (true);

CREATE POLICY "event_entries_insert" ON event_entries FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "event_entries_update" ON event_entries FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "event_entries_delete" ON event_entries FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "event_votes_select" ON event_votes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "event_votes_insert" ON event_votes FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "event_votes_delete" ON event_votes FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 5: ATOMIC RPC — Vote for an entry (toggle)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION vote_for_entry(p_entry_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists BOOLEAN;
  v_entry RECORD;
  v_new_votes INTEGER;
BEGIN
  SELECT user_id, event_id INTO v_entry FROM event_entries WHERE id = p_entry_id;
  IF v_entry IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entry not found');
  END IF;

  IF v_entry.user_id = p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot vote for your own entry');
  END IF;

  -- Verify the show is still open
  IF NOT EXISTS(
    SELECT 1 FROM events WHERE id = v_entry.event_id AND show_status = 'open'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voting is closed for this show');
  END IF;

  SELECT EXISTS(SELECT 1 FROM event_votes WHERE entry_id = p_entry_id AND user_id = p_user_id) INTO v_exists;
  IF v_exists THEN
    DELETE FROM event_votes WHERE entry_id = p_entry_id AND user_id = p_user_id;
    UPDATE event_entries SET votes_count = GREATEST(votes_count - 1, 0) WHERE id = p_entry_id RETURNING votes_count INTO v_new_votes;
    RETURN jsonb_build_object('success', true, 'action', 'unvoted', 'new_votes', v_new_votes);
  ELSE
    INSERT INTO event_votes (entry_id, user_id) VALUES (p_entry_id, p_user_id);
    UPDATE event_entries SET votes_count = votes_count + 1 WHERE id = p_entry_id RETURNING votes_count INTO v_new_votes;
    RETURN jsonb_build_object('success', true, 'action', 'voted', 'new_votes', v_new_votes, 'entry_owner', v_entry.user_id);
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
  v_total_entries INTEGER;
BEGIN
  SELECT id, name, created_by, event_type, show_status, starts_at
  INTO v_event FROM events WHERE id = p_event_id;

  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;
  IF v_event.created_by != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the event creator can close the show');
  END IF;
  IF v_event.event_type != 'photo_show' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a photo show');
  END IF;
  IF v_event.show_status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already closed');
  END IF;

  UPDATE events SET show_status = 'closed' WHERE id = p_event_id;

  SELECT count(*) INTO v_total_entries
  FROM event_entries WHERE event_id = p_event_id AND entry_type = 'entered';

  FOR v_entry IN
    SELECT ee.id, ee.horse_id, ee.user_id, ee.votes_count, ee.class_name
    FROM event_entries ee
    WHERE ee.event_id = p_event_id AND ee.entry_type = 'entered'
    ORDER BY ee.votes_count DESC, ee.created_at ASC
  LOOP
    v_rank := v_rank + 1;

    UPDATE event_entries SET "placing" =
      CASE v_rank
        WHEN 1 THEN '1st'
        WHEN 2 THEN '2nd'
        WHEN 3 THEN '3rd'
        ELSE v_rank || 'th'
      END
    WHERE id = v_entry.id;

    -- Auto-generate show_record for top 10
    IF v_rank <= 10 THEN
      INSERT INTO show_records (
        horse_id, user_id, show_name, show_date, "placing", division,
        show_type, class_name, total_entries, verification_tier
      ) VALUES (
        v_entry.horse_id,
        v_entry.user_id,
        v_event.name,
        v_event.starts_at::date,
        CASE v_rank
          WHEN 1 THEN '1st' WHEN 2 THEN '2nd' WHEN 3 THEN '3rd'
          ELSE v_rank || 'th'
        END,
        v_entry.class_name,
        'photo_mhh',
        v_entry.class_name,
        v_total_entries,
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
-- STEP 7: DATA MIGRATION (Zero Data Loss)
-- ══════════════════════════════════════════════════════════════

-- 7a: Migrate photo_shows → events (only orphans without linked event)
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

-- For events that already link to shows, copy show metadata
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
  e.id,
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
  sv.entry_id,
  sv.user_id,
  sv.created_at
FROM show_votes sv
WHERE EXISTS (SELECT 1 FROM event_entries ee WHERE ee.id = sv.entry_id)
ON CONFLICT (id) DO NOTHING;

-- 7d: Re-point posts.show_id → posts.event_id
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

-- ══════════════════════════════════════════════════════════════
-- STEP 9: DROP LEGACY — separate migration 047 AFTER code migrated
-- ══════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS show_votes CASCADE;
-- DROP TABLE IF EXISTS show_entries CASCADE;
-- DROP TABLE IF EXISTS photo_shows CASCADE;
-- ALTER TABLE events DROP COLUMN IF EXISTS show_id;
-- ALTER TABLE posts DROP COLUMN IF EXISTS show_id;
-- DROP FUNCTION IF EXISTS toggle_show_vote CASCADE;
