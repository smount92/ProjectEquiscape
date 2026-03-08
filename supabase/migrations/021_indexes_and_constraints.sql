-- Migration: 021_indexes_and_constraints
-- Purpose: Add indexes for frequently-filtered columns and business-logic constraints.
-- IMPORTANT: Run this manually in Supabase SQL Editor.

-- ── Activity Feed (actor + chronological feeds) ──
CREATE INDEX IF NOT EXISTS idx_activity_events_actor_id ON activity_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events(created_at DESC);

-- ── Social: follows (who follows whom + unique guard) ──
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- ── Horse images (fast lookup for gallery pages) ──
CREATE INDEX IF NOT EXISTS idx_horse_images_horse_id ON horse_images(horse_id);

-- ── Horses (owner lookup + public listing) ──
CREATE INDEX IF NOT EXISTS idx_user_horses_owner_id ON user_horses(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_horses_is_public ON user_horses(is_public) WHERE is_public = true;

-- ── Favorites (table is horse_favorites; unique + horse_id indexes already exist from migration 010) ──
-- No new indexes needed — idx_horse_favorites_unique and idx_horse_favorites_horse_id already cover this.

-- ── Notifications ──
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ── Messages ──
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- ── Show entries ──
CREATE INDEX IF NOT EXISTS idx_show_entries_show_id ON show_entries(show_id);
CREATE INDEX IF NOT EXISTS idx_show_entries_user_id ON show_entries(user_id);

-- ── Unique constraint: one vote per user per entry ──
CREATE UNIQUE INDEX IF NOT EXISTS idx_show_votes_unique ON show_votes(entry_id, user_id);

-- ── Transfer codes ──
CREATE INDEX IF NOT EXISTS idx_horse_transfers_code ON horse_transfers(transfer_code) WHERE status = 'pending';
