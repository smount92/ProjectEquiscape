-- ============================================================
-- Migration 019: Settings — Avatar + Notification Preferences
-- ============================================================

-- ── 1. Avatar URL on users table ──
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN users.avatar_url IS 'URL to user avatar image in Supabase Storage.';

-- ── 2. Notification Preferences ──
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{
    "show_votes": true,
    "favorites": true,
    "comments": true,
    "new_followers": true,
    "messages": true,
    "show_results": true,
    "transfers": true
  }';

COMMENT ON COLUMN users.notification_prefs IS 'Per-event notification preferences. True = receive notification.';

-- ── 3. Default horse visibility preference ──
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_horse_public BOOLEAN DEFAULT true;

COMMENT ON COLUMN users.default_horse_public IS 'Default value for is_public when adding new horses.';
