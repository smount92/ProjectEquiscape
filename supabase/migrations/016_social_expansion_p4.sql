-- ============================================================
-- Migration 016: Social Expansion Phase 4 — Public Collections + Photo Shows
-- ============================================================

-- ── Public Collections Toggle ──
ALTER TABLE user_collections
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- ── Virtual Photo Shows ──
CREATE TABLE IF NOT EXISTS photo_shows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  theme       TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'judging', 'closed')),
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  start_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE photo_shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view photo shows"
  ON photo_shows FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_photo_shows_status ON photo_shows (status, start_at DESC);

-- ── Show Entries ──
CREATE TABLE IF NOT EXISTS show_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id     UUID NOT NULL REFERENCES photo_shows(id) ON DELETE CASCADE,
  horse_id    UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  votes       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE show_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view show entries"
  ON show_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can enter shows"
  ON show_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own entries"
  ON show_entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_show_entries_unique ON show_entries (show_id, horse_id);
CREATE INDEX idx_show_entries_show ON show_entries (show_id);
CREATE INDEX idx_show_entries_user ON show_entries (user_id);

-- ── Show Votes ──
CREATE TABLE IF NOT EXISTS show_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES show_entries(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE show_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view votes"
  ON show_votes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can vote"
  ON show_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own votes"
  ON show_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_show_votes_unique ON show_votes (entry_id, user_id);
