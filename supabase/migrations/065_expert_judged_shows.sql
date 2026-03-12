-- ============================================================
-- Migration 065: Expert-Judged Shows
-- Shows can use community voting or expert judge placings
-- ============================================================

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS judging_method TEXT DEFAULT 'community_vote'
    CHECK (judging_method IN ('community_vote', 'expert_judge'));
