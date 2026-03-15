-- ============================================================
-- 082: Add class_name to show_records
-- Beta feedback: testers consistently put class name in notes.
-- This gives it a proper field between division and placing.
-- ============================================================

ALTER TABLE show_records
    ADD COLUMN IF NOT EXISTS class_name TEXT;
