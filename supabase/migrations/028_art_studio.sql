-- ============================================================
-- Migration 028: Art Studio — Artist Profiles & Commissions
-- ============================================================

-- ── Artist Profiles ──
CREATE TABLE IF NOT EXISTS artist_profiles (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  studio_name        TEXT NOT NULL,
  studio_slug        TEXT UNIQUE NOT NULL,
  specialties        TEXT[] DEFAULT '{}',
  mediums            TEXT[] DEFAULT '{}',
  scales_offered     TEXT[] DEFAULT '{}',
  bio_artist         TEXT,
  portfolio_visible  BOOLEAN DEFAULT true,
  status             TEXT NOT NULL DEFAULT 'closed'
    CHECK (status IN ('open', 'waitlist', 'closed')),
  max_slots          INTEGER DEFAULT 5 CHECK (max_slots BETWEEN 1 AND 20),
  turnaround_min_days INTEGER,
  turnaround_max_days INTEGER,
  price_range_min    DECIMAL(10,2),
  price_range_max    DECIMAL(10,2),
  terms_text         TEXT,
  paypal_me_link     TEXT,
  accepting_types    TEXT[] DEFAULT '{}',
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE artist_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view artist profiles"
  ON artist_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner inserts own artist profile"
  ON artist_profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Owner updates own artist profile"
  ON artist_profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Owner deletes own artist profile"
  ON artist_profiles FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE INDEX idx_artist_profiles_slug ON artist_profiles (studio_slug);
CREATE INDEX idx_artist_profiles_status ON artist_profiles (status);

-- ── Commissions ──
CREATE TABLE IF NOT EXISTS commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id         UUID NOT NULL REFERENCES users(id),
  client_id         UUID REFERENCES users(id),
  client_email      TEXT,
  horse_id          UUID REFERENCES user_horses(id) ON DELETE SET NULL,
  commission_type   TEXT NOT NULL,
  description       TEXT NOT NULL,
  reference_images  TEXT[] DEFAULT '{}',
  slot_number       INTEGER,
  estimated_start   DATE,
  estimated_completion DATE,
  actual_start      DATE,
  actual_completion DATE,
  price_quoted      DECIMAL(10,2),
  deposit_amount    DECIMAL(10,2),
  deposit_paid      BOOLEAN DEFAULT false,
  final_paid        BOOLEAN DEFAULT false,
  status            TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested', 'accepted', 'declined', 'cancelled',
      'in_progress', 'review', 'revision',
      'completed', 'delivered'
    )),
  is_public_in_queue BOOLEAN DEFAULT true,
  last_update_at    TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT artist_not_client CHECK (artist_id != client_id)
);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artist views own commissions"
  ON commissions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = artist_id);
CREATE POLICY "Client views own commissions"
  ON commissions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = client_id);
CREATE POLICY "Public queue visibility"
  ON commissions FOR SELECT TO authenticated
  USING (is_public_in_queue = true AND status IN ('accepted', 'in_progress'));
CREATE POLICY "Artist manages commissions"
  ON commissions FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = artist_id)
  WITH CHECK ((SELECT auth.uid()) = artist_id);
CREATE POLICY "Artist deletes commissions"
  ON commissions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = artist_id);
CREATE POLICY "Client creates commission requests"
  ON commissions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = client_id);
CREATE POLICY "Artist creates own commissions"
  ON commissions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = artist_id);

CREATE INDEX idx_commissions_artist ON commissions (artist_id, status);
CREATE INDEX idx_commissions_client ON commissions (client_id);

-- ── Commission Updates (WIP Photos, Status Changes, Messages) ──
CREATE TABLE IF NOT EXISTS commission_updates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id         UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  author_id             UUID NOT NULL REFERENCES users(id),
  update_type           TEXT NOT NULL CHECK (update_type IN (
    'wip_photo', 'status_change', 'message',
    'revision_request', 'approval', 'milestone'
  )),
  title                 TEXT,
  body                  TEXT,
  image_urls            TEXT[] DEFAULT '{}',
  old_status            TEXT,
  new_status            TEXT,
  requires_payment      BOOLEAN DEFAULT false,
  is_visible_to_client  BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE commission_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artist views all updates for own commissions"
  ON commission_updates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM commissions c WHERE c.id = commission_id AND c.artist_id = (SELECT auth.uid())
  ));
CREATE POLICY "Client views visible updates for own commissions"
  ON commission_updates FOR SELECT TO authenticated
  USING (
    is_visible_to_client = true
    AND EXISTS (
      SELECT 1 FROM commissions c WHERE c.id = commission_id AND c.client_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Commission participants create updates"
  ON commission_updates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM commissions c WHERE c.id = commission_id
    AND (c.artist_id = (SELECT auth.uid()) OR c.client_id = (SELECT auth.uid()))
  ));

CREATE INDEX idx_commission_updates ON commission_updates (commission_id, created_at DESC);

-- ============================================================
-- ✅ Migration 028 Complete
-- Created: artist_profiles, commissions, commission_updates
-- RLS: Artists manage own profiles/commissions, clients see own,
--      public queue visible, updates scoped to participants.
-- All auth.uid() calls use (SELECT auth.uid()) for performance.
-- ============================================================
