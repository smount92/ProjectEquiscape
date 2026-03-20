-- ============================================================
-- Migration 096: Add link_url to notifications
-- ============================================================
-- Adds a link_url column so each notification can deep-link
-- to the relevant page (show, horse, event, etc.)
-- instead of falling back to the actor's profile.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS link_url TEXT;

COMMENT ON COLUMN notifications.link_url IS 'Deep-link URL for this notification (e.g. /shows/uuid, /community/uuid)';
