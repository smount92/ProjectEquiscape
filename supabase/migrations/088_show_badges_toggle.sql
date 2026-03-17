-- ============================================================
-- Migration 088: Add show_badges toggle to users table
-- Lets users control whether their Trophy Case is visible
-- on their public profile. Defaults to true (shown).
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS show_badges boolean NOT NULL DEFAULT true;
