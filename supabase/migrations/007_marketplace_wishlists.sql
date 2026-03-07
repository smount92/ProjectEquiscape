-- ============================================================
-- Migration 007: Marketplace Status + Wishlists
-- ============================================================

-- 1. Add trade_status to user_horses
-- Values: 'Not for Sale' (default), 'For Sale', 'Open to Offers'
ALTER TABLE user_horses
  ADD COLUMN IF NOT EXISTS trade_status TEXT NOT NULL DEFAULT 'Not for Sale';

-- Enforce allowed values via CHECK constraint
ALTER TABLE user_horses
  ADD CONSTRAINT chk_trade_status
  CHECK (trade_status IN ('Not for Sale', 'For Sale', 'Open to Offers'));

-- 2. Create user_wishlists table
CREATE TABLE IF NOT EXISTS user_wishlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mold_id     UUID REFERENCES reference_molds(id) ON DELETE SET NULL,
  release_id  UUID REFERENCES reference_releases(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE user_wishlists ENABLE ROW LEVEL SECURITY;

-- Users can only see their own wishlist items
CREATE POLICY "Users can view own wishlist"
  ON user_wishlists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert into their own wishlist
CREATE POLICY "Users can add to own wishlist"
  ON user_wishlists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own wishlist
CREATE POLICY "Users can update own wishlist"
  ON user_wishlists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete from their own wishlist
CREATE POLICY "Users can delete from own wishlist"
  ON user_wishlists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Indexes
CREATE INDEX idx_user_wishlists_user_id
  ON user_wishlists (user_id);

-- Prevent duplicate wishlist entries (same user + mold + release)
CREATE UNIQUE INDEX idx_user_wishlists_unique
  ON user_wishlists (user_id, COALESCE(mold_id, '00000000-0000-0000-0000-000000000000'), COALESCE(release_id, '00000000-0000-0000-0000-000000000000'));
