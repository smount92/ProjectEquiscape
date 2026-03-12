-- ══════════════════════════════════════════════════════════════
-- Migration 059: Feed Quality & Integrity
-- Watermark setting, feed quality controls
-- ══════════════════════════════════════════════════════════════

-- Add watermark preference to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_photos BOOLEAN DEFAULT false;
