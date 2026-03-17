-- ============================================================
-- Migration 089: Commission System Fixes
-- 1. Add image_urls column to customization_logs for WIP photos
-- 2. Update v_horse_hoofprint view to include image_urls in metadata
-- 3. Add 'shipping' status to commissions workflow
-- 4. RLS: allow commission artists to insert customization_logs
-- 5. Storage: allow reading commission WIP photos
-- ============================================================

-- Add 'shipping' to the commission status CHECK constraint
ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE commissions ADD CONSTRAINT commissions_status_check
  CHECK (status IN (
    'requested', 'accepted', 'declined', 'cancelled',
    'in_progress', 'review', 'revision',
    'completed', 'shipping', 'delivered'
  ));

-- Add image_urls column to customization_logs
ALTER TABLE customization_logs
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

COMMENT ON COLUMN customization_logs.image_urls
  IS 'Photo URLs from WIP commission updates, injected when commission is delivered.';

-- Allow commission artists to insert customization_logs for horses
-- linked to their delivered commissions (the Hoofprint pipeline runs
-- as the artist, who is not the horse owner).
CREATE POLICY "commission_artist_inserts_customization_log"
  ON customization_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commissions c
      WHERE c.horse_id = customization_logs.horse_id
        AND c.artist_id = (SELECT auth.uid())
        AND c.status IN ('completed', 'delivered')
    )
  );
-- ── Storage READ: let anyone read commission WIP photos ──
-- WIP photos stored at {userId}/commissions/... need to be readable
-- by commission participants and eventually by anyone viewing the hoofprint.
DROP POLICY IF EXISTS "Horse image read (public horses)" ON storage.objects;
CREATE POLICY "Horse image read (public horses)" ON storage.objects FOR SELECT TO authenticated, anon
USING (
    bucket_id = 'horse-images'
    AND (
        (storage.foldername(name))[1] = 'social'
        OR (storage.foldername(name))[1] = 'events'
        -- Commission WIP photos: {userId}/commissions/...
        OR (storage.foldername(name))[2] = 'commissions'
        OR (
            (storage.foldername(name))[1] = 'horses'
            AND EXISTS (
                SELECT 1 FROM public.user_horses
                WHERE id = ((storage.foldername(name))[2])::uuid
                AND (is_public = true OR owner_id = (SELECT auth.uid()))
            )
        )
        OR (
            (storage.foldername(name))[1] != 'horses'
            AND (storage.foldername(name))[1] != 'social'
            AND (storage.foldername(name))[1] != 'events'
            AND (storage.foldername(name))[2] != 'commissions'
            AND EXISTS (
                SELECT 1 FROM public.user_horses
                WHERE id = ((storage.foldername(name))[2])::uuid
                AND (is_public = true OR owner_id = (SELECT auth.uid()))
            )
        )
    )
);

-- ── Update Hoofprint View to include image_urls ──
CREATE OR REPLACE VIEW v_horse_hoofprint AS

-- 1. Creation event (from user_horses row itself)
SELECT
  uh.id AS source_id,
  uh.id AS horse_id,
  uh.owner_id AS user_id,
  'acquired' AS event_type,
  'Added to stable' AS title,
  uh.custom_name || ' was registered on Model Horse Hub.' AS description,
  uh.created_at::date AS event_date,
  jsonb_build_object('life_stage', COALESCE(uh.life_stage, 'completed')) AS metadata,
  true AS is_public,
  uh.created_at AS created_at,
  'user_horses' AS source_table
FROM user_horses uh

UNION ALL

-- 2. Ownership transfers (from horse_ownership_history)
SELECT
  oh.id AS source_id,
  oh.horse_id,
  oh.owner_id AS user_id,
  CASE
    WHEN oh.released_at IS NOT NULL THEN 'transferred'
    ELSE 'acquired'
  END AS event_type,
  CASE
    WHEN oh.released_at IS NOT NULL THEN 'Transferred to new owner'
    ELSE 'Acquired by ' || oh.owner_alias
  END AS title,
  oh.notes AS description,
  COALESCE(oh.released_at, oh.acquired_at)::date AS event_date,
  jsonb_build_object(
    'acquisition_type', oh.acquisition_type,
    'sale_price', CASE WHEN oh.is_price_public THEN oh.sale_price ELSE NULL END
  ) AS metadata,
  true AS is_public,
  COALESCE(oh.released_at, oh.acquired_at) AS created_at,
  'horse_ownership_history' AS source_table
FROM horse_ownership_history oh
WHERE oh.acquisition_type != 'original'

UNION ALL

-- 3. Condition changes (from condition_history)
SELECT
  ch.id AS source_id,
  ch.horse_id,
  ch.changed_by AS user_id,
  'condition_change' AS event_type,
  'Condition: ' || ch.new_condition AS title,
  CASE
    WHEN ch.old_condition IS NOT NULL
      THEN 'Changed from ' || ch.old_condition || ' to ' || ch.new_condition
    ELSE 'Condition set to ' || ch.new_condition
  END AS description,
  ch.created_at::date AS event_date,
  jsonb_build_object('old_condition', ch.old_condition, 'new_condition', ch.new_condition) AS metadata,
  true AS is_public,
  ch.created_at,
  'condition_history' AS source_table
FROM condition_history ch

UNION ALL

-- 4. Show records (from show_records)
SELECT
  sr.id AS source_id,
  sr.horse_id,
  sr.user_id,
  'show_result' AS event_type,
  COALESCE(sr."placing", 'Competed') || ' at ' || sr.show_name AS title,
  CASE
    WHEN sr.class_name IS NOT NULL THEN 'Class: ' || sr.class_name
    ELSE NULL
  END AS description,
  sr.show_date AS event_date,
  jsonb_build_object(
    'show_name', sr.show_name,
    'placing', sr."placing",
    'show_type', sr.show_type,
    'is_nan_qualifying', sr.is_nan_qualifying,
    'verification_tier', sr.verification_tier
  ) AS metadata,
  true AS is_public,
  sr.created_at,
  'show_records' AS source_table
FROM show_records sr

UNION ALL

-- 5. Customization work (from customization_logs) — now includes image_urls
SELECT
  cl.id AS source_id,
  cl.horse_id,
  uh2.owner_id AS user_id,
  'customization' AS event_type,
  cl.work_type || COALESCE(' by ' || cl.artist_alias, '') AS title,
  cl.materials_used AS description,
  cl.date_completed AS event_date,
  jsonb_build_object(
    'work_type', cl.work_type,
    'artist_alias', cl.artist_alias,
    'image_urls', COALESCE(cl.image_urls, '{}')
  ) AS metadata,
  true AS is_public,
  COALESCE(cl.date_completed::timestamptz, now()) AS created_at,
  'customization_logs' AS source_table
FROM customization_logs cl
JOIN user_horses uh2 ON uh2.id = cl.horse_id

UNION ALL

-- 6. Owner-authored timeline notes ONLY (not visitor comments)
SELECT
  p.id AS source_id,
  p.horse_id,
  p.author_id AS user_id,
  'note' AS event_type,
  LEFT(p.content, 80) AS title,
  p.content AS description,
  p.created_at::date AS event_date,
  '{}'::jsonb AS metadata,
  true AS is_public,
  p.created_at,
  'posts' AS source_table
FROM posts p
JOIN user_horses uh3 ON uh3.id = p.horse_id
WHERE p.horse_id IS NOT NULL
  AND p.parent_id IS NULL
  AND p.author_id = uh3.owner_id;
