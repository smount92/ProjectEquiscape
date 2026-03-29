-- ============================================================
-- Migration 103: Core Monetization
-- 1. Promoted listings (is_promoted_until on user_horses)
-- 2. ISO feed bounties (is_boosted_until on wishlist_items)
-- 3. Purchased reports table (a-la-carte PDF access)
-- ============================================================

-- ── Promoted Listings ──
ALTER TABLE user_horses
ADD COLUMN IF NOT EXISTS is_promoted_until TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_horses_promoted
ON user_horses (is_promoted_until)
WHERE is_promoted_until IS NOT NULL;

-- ── ISO Feed Bounties ──
ALTER TABLE user_wishlists
ADD COLUMN IF NOT EXISTS is_boosted_until TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_wishlists_boosted
ON user_wishlists (is_boosted_until)
WHERE is_boosted_until IS NOT NULL;

-- ── Purchased Reports (a-la-carte PDF access) ──
CREATE TABLE IF NOT EXISTS purchased_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    horse_id UUID NOT NULL REFERENCES user_horses(id),
    report_type TEXT NOT NULL DEFAULT 'insurance',
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE purchased_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own purchases"
ON purchased_reports FOR SELECT
USING (auth.uid() = user_id);

-- Prevent duplicate purchases for same report
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchased_reports_unique
ON purchased_reports (user_id, horse_id, report_type);
