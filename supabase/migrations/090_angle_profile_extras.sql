-- ============================================================
-- Migration 090: Add missing angle_profile enum values
-- ============================================================
-- The frontend (add-horse, edit-horse, PassportGallery) references
-- 'Belly_Makers_Mark' and 'extra_detail' angle profiles, but
-- these values were never added to the PostgreSQL enum.
-- This caused "invalid input value for enum angle_profile" errors
-- when uploading extra detail photos or belly/maker's mark shots.
-- ============================================================

ALTER TYPE angle_profile ADD VALUE IF NOT EXISTS 'Belly_Makers_Mark';
ALTER TYPE angle_profile ADD VALUE IF NOT EXISTS 'extra_detail';
