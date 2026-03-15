-- ============================================================
-- 078: Make horse-images bucket public for reads
-- Signed URLs are a scaling bottleneck. Public reads + private
-- writes gives us CDN-cacheable URLs without security loss.
-- ============================================================

-- NOTE: Supabase bucket visibility is set via the Dashboard or
-- supabase.storage.updateBucket API, not raw SQL.
-- This migration documents the intent. Execute via Dashboard:
--   Storage → horse-images → Policies → Toggle "Public" ON

-- Verify that INSERT/UPDATE/DELETE policies remain owner-only:
-- Policy: "Users can upload images to their own horse folder"
-- Policy: "Users can delete their own horse images"
