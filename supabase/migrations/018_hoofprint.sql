-- ============================================================
-- Migration 018: Hoofprint™ — Living Model Horse Provenance
-- ============================================================

-- ── 1. Life Stage on user_horses ──
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS life_stage TEXT DEFAULT 'completed'
  CHECK (life_stage IN ('blank', 'in_progress', 'completed', 'for_sale'));

COMMENT ON COLUMN user_horses.life_stage IS 'Current life stage of the model: blank resin, WIP, completed, or listed for sale.';

-- ── 2. Horse Timeline (The Hoofprint Log) ──
CREATE TABLE IF NOT EXISTS horse_timeline (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id      UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'acquired',
    'stage_update',
    'customization',
    'photo_update',
    'show_result',
    'listed',
    'sold',
    'transferred',
    'note'
  )),
  title         TEXT NOT NULL,
  description   TEXT,
  event_date    DATE DEFAULT CURRENT_DATE,
  metadata      JSONB DEFAULT '{}',
  is_public     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_timeline ENABLE ROW LEVEL SECURITY;

-- Anyone can see public timeline entries on public horses
CREATE POLICY "View public timeline entries"
  ON horse_timeline FOR SELECT TO authenticated
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_timeline.horse_id AND h.is_public = true
    )
  );

-- Owner can see all their own entries (including private)
CREATE POLICY "Owner views all own timeline"
  ON horse_timeline FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Owner can insert entries for their own horses
CREATE POLICY "Owner adds timeline entries"
  ON horse_timeline FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_timeline.horse_id AND h.owner_id = auth.uid()
    )
  );

-- Owner can update their own entries
CREATE POLICY "Owner updates own timeline"
  ON horse_timeline FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner can delete their own entries
CREATE POLICY "Owner deletes own timeline"
  ON horse_timeline FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_horse_timeline_horse ON horse_timeline (horse_id, event_date DESC, created_at DESC);
CREATE INDEX idx_horse_timeline_user ON horse_timeline (user_id);

-- ── 3. Ownership History (Chain of Custody) ──
CREATE TABLE IF NOT EXISTS horse_ownership_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id          UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  owner_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_alias       TEXT NOT NULL,
  acquired_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at       TIMESTAMPTZ,
  acquisition_type  TEXT NOT NULL DEFAULT 'original' CHECK (acquisition_type IN (
    'original', 'purchase', 'trade', 'gift', 'transfer'
  )),
  sale_price        DECIMAL(10,2),
  is_price_public   BOOLEAN DEFAULT false,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_ownership_history ENABLE ROW LEVEL SECURITY;

-- Anyone can view ownership history on public horses
CREATE POLICY "View ownership history on public horses"
  ON horse_ownership_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_ownership_history.horse_id AND h.is_public = true
    )
  );

-- Owner can view on private horses
CREATE POLICY "Owner views own ownership history"
  ON horse_ownership_history FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

-- Insert handled by service role during transfers (no direct user insert policy needed)

CREATE INDEX idx_ownership_history_horse ON horse_ownership_history (horse_id, acquired_at);
CREATE INDEX idx_ownership_history_owner ON horse_ownership_history (owner_id);

-- ── 4. Photo Stages ──
CREATE TABLE IF NOT EXISTS horse_photo_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id    UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  image_id    UUID NOT NULL REFERENCES horse_images(id) ON DELETE CASCADE,
  stage       TEXT NOT NULL CHECK (stage IN (
    'blank', 'in_progress', 'completed', 'for_sale', 'archive'
  )),
  stage_label TEXT,
  tagged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_photo_stages ENABLE ROW LEVEL SECURITY;

-- Mirrors horse visibility
CREATE POLICY "View photo stages on public horses"
  ON horse_photo_stages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_photo_stages.horse_id AND h.is_public = true
    )
  );

CREATE POLICY "Owner views own photo stages"
  ON horse_photo_stages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_photo_stages.horse_id AND h.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner manages photo stages"
  ON horse_photo_stages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_photo_stages.horse_id AND h.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner deletes photo stages"
  ON horse_photo_stages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_photo_stages.horse_id AND h.owner_id = auth.uid()
    )
  );

CREATE UNIQUE INDEX idx_photo_stages_unique ON horse_photo_stages (image_id);
CREATE INDEX idx_photo_stages_horse ON horse_photo_stages (horse_id, stage);

-- ── 5. Transfer Codes (Pending Transfers) ──
CREATE TABLE IF NOT EXISTS horse_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id        UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id),
  transfer_code   TEXT NOT NULL UNIQUE,
  acquisition_type TEXT NOT NULL DEFAULT 'purchase' CHECK (acquisition_type IN (
    'purchase', 'trade', 'gift', 'transfer'
  )),
  sale_price      DECIMAL(10,2),
  is_price_public BOOLEAN DEFAULT false,
  notes           TEXT,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  claimed_by      UUID REFERENCES auth.users(id),
  claimed_at      TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE horse_transfers ENABLE ROW LEVEL SECURITY;

-- Sender can view their own transfers
CREATE POLICY "Sender views own transfers"
  ON horse_transfers FOR SELECT TO authenticated
  USING (auth.uid() = sender_id);

-- Anyone can look up by transfer code (needed for claiming)
CREATE POLICY "Lookup by transfer code"
  ON horse_transfers FOR SELECT TO authenticated
  USING (status = 'pending');

-- Sender can create transfers for horses they own
CREATE POLICY "Owner creates transfer"
  ON horse_transfers FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM user_horses h WHERE h.id = horse_transfers.horse_id AND h.owner_id = auth.uid()
    )
  );

-- Sender can cancel
CREATE POLICY "Sender cancels transfer"
  ON horse_transfers FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE INDEX idx_transfers_code ON horse_transfers (transfer_code) WHERE status = 'pending';
CREATE INDEX idx_transfers_sender ON horse_transfers (sender_id);
