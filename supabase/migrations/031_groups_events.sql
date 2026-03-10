-- ============================================================
-- Migration 031: Groups & Events
-- NOTE: Tables created first, then RLS policies, to avoid
--       forward-reference errors (groups_select → group_memberships)
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: CREATE ALL TABLES
-- ══════════════════════════════════════════════════════════════

-- ── Groups ──
CREATE TABLE IF NOT EXISTS groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  group_type      TEXT NOT NULL CHECK (group_type IN (
    'regional_club', 'breed_interest', 'scale_interest',
    'show_circuit', 'artist_collective', 'general'
  )),
  region          TEXT,
  visibility      TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'restricted', 'private')),
  banner_url      TEXT,
  icon_url        TEXT,
  member_count    INTEGER DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Group Memberships ──
CREATE TABLE IF NOT EXISTS group_memberships (
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'moderator', 'judge', 'member')),
  joined_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- ── Group Posts ──
CREATE TABLE IF NOT EXISTS group_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  horse_id    UUID REFERENCES user_horses(id) ON DELETE SET NULL,
  image_urls  TEXT[] DEFAULT '{}',
  is_pinned   BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Group Post Replies ──
CREATE TABLE IF NOT EXISTS group_post_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES group_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Events ──
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'live_show', 'photo_show', 'swap_meet', 'meetup',
    'breyerfest', 'studio_opening', 'auction', 'workshop', 'other'
  )),
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  timezone        TEXT DEFAULT 'America/New_York',
  is_all_day      BOOLEAN DEFAULT false,
  is_virtual      BOOLEAN DEFAULT false,
  location_name   TEXT,
  location_address TEXT,
  region          TEXT,
  virtual_url     TEXT,
  group_id        UUID REFERENCES groups(id) ON DELETE SET NULL,
  show_id         UUID REFERENCES photo_shows(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  is_official     BOOLEAN DEFAULT false,
  rsvp_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Event RSVPs ──
CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'going'
    CHECK (status IN ('going', 'interested', 'not_going')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- ══════════════════════════════════════════════════════════════
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ══════════════════════════════════════════════════════════════

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_post_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- STEP 3: CREATE ALL RLS POLICIES
-- (Now safe to cross-reference between tables)
-- ══════════════════════════════════════════════════════════════

-- ── Groups policies ──
CREATE POLICY "groups_select"
  ON groups FOR SELECT TO authenticated
  USING (
    visibility IN ('public', 'restricted')
    OR EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = groups.id AND gm.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "groups_insert"
  ON groups FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);
CREATE POLICY "groups_update"
  ON groups FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = groups.id
      AND gm.user_id = (SELECT auth.uid())
      AND gm.role IN ('owner', 'admin')
  ));

-- ── Group Memberships policies ──
CREATE POLICY "membership_select"
  ON group_memberships FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "membership_insert"
  ON group_memberships FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "membership_delete_self"
  ON group_memberships FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ── Group Posts policies ──
CREATE POLICY "group_posts_select"
  ON group_posts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_memberships gm
    WHERE gm.group_id = group_posts.group_id
      AND gm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "group_posts_insert"
  ON group_posts FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = group_posts.group_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "group_posts_delete"
  ON group_posts FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.group_id = group_posts.group_id
        AND gm.user_id = (SELECT auth.uid())
        AND gm.role IN ('owner', 'admin', 'moderator')
    )
  );

-- ── Group Post Replies policies ──
CREATE POLICY "replies_select"
  ON group_post_replies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_posts gp
    JOIN group_memberships gm ON gm.group_id = gp.group_id
    WHERE gp.id = group_post_replies.post_id
      AND gm.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "replies_insert"
  ON group_post_replies FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "replies_delete"
  ON group_post_replies FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ── Events policies ──
CREATE POLICY "events_select"
  ON events FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "events_insert"
  ON events FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);
CREATE POLICY "events_update"
  ON events FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = created_by);
CREATE POLICY "events_delete"
  ON events FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = created_by);

-- ── Event RSVPs policies ──
CREATE POLICY "rsvps_select"
  ON event_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY "rsvps_insert"
  ON event_rsvps FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "rsvps_update"
  ON event_rsvps FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "rsvps_delete"
  ON event_rsvps FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ══════════════════════════════════════════════════════════════
-- STEP 4: INDEXES + ALTER EXISTING TABLES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX idx_groups_slug ON groups (slug);
CREATE INDEX idx_groups_type ON groups (group_type);
CREATE INDEX idx_group_memberships_user ON group_memberships (user_id);
CREATE INDEX idx_group_posts ON group_posts (group_id, created_at DESC);
CREATE INDEX idx_group_post_replies ON group_post_replies (post_id, created_at);
CREATE INDEX idx_events_date ON events (starts_at);
CREATE INDEX idx_events_group ON events (group_id) WHERE group_id IS NOT NULL;

-- Link shows to groups
ALTER TABLE photo_shows ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- ============================================================
-- ✅ Migration 031 Complete
-- Created: groups, group_memberships, group_posts,
--          group_post_replies, events, event_rsvps
-- Added: photo_shows.group_id
-- ============================================================
