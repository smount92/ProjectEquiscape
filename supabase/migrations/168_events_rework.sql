-- ══════════════════════════════════════════════════════════════
-- 168 — Events rework: FB-style pages for OUTSIDE-MHH happenings
-- ══════════════════════════════════════════════════════════════
--
-- Events stopped being "the legacy shows table wearing a hat". They
-- are now listing pages for things happening elsewhere in the hobby:
-- external shows (OMHPS, MEPSA, Facebook shows, live halls), meetups,
-- club gatherings. Shows hosted ON MHH are created at /shows/host and
-- live in `shows` (v2).
--
-- This migration only WIDENS the event_type CHECK constraint so the
-- two honest new categories can be stored:
--
--   external_show — a show happening off-platform
--   club          — a club meeting / chapter gathering
--
-- 'live_show' and 'photo_show' STAY in the constraint: existing rows
-- carry them and the legacy show system (shows.ts, the transition
-- cron, profile stats) still reads them. The application refuses to
-- CREATE new events with those values — see createEvent().
--
-- Until this is pasted the app degrades cleanly: createEvent catches
-- the check violation and stores 'other' (external_show) or 'meetup'
-- (club) instead. Nothing errors, the label is just less specific.
--
-- Idempotent — safe to run more than once.
-- ══════════════════════════════════════════════════════════════

DO $$
BEGIN
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check;
  ALTER TABLE events ADD CONSTRAINT events_event_type_check CHECK (
    event_type IN (
      -- outside-MHH happenings (creatable)
      'external_show', 'meetup', 'club', 'swap_meet',
      'breyerfest', 'studio_opening', 'auction', 'workshop', 'other',
      -- legacy, display + legacy-show-system only (NOT creatable)
      'live_show', 'photo_show'
    )
  );
END $$;

-- Browse/index reads are always "upcoming, soonest first", optionally
-- narrowed by type. The existing indexes cover neither shape.
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at);
CREATE INDEX IF NOT EXISTS idx_events_type_starts_at ON events (event_type, starts_at);
