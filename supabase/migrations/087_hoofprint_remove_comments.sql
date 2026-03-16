-- ============================================================
-- Migration 087: Remove Posts/Comments from Hoofprint View
-- Comments on horses are social, not provenance events.
-- They clutter the Hoofprint timeline with non-meaningful entries.
-- ============================================================

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

-- 5. Customization work (from customization_logs)
SELECT
  cl.id AS source_id,
  cl.horse_id,
  uh2.owner_id AS user_id,
  'customization' AS event_type,
  cl.work_type || COALESCE(' by ' || cl.artist_alias, '') AS title,
  cl.materials_used AS description,
  cl.date_completed AS event_date,
  jsonb_build_object('work_type', cl.work_type, 'artist_alias', cl.artist_alias) AS metadata,
  true AS is_public,
  COALESCE(cl.date_completed::timestamptz, now()) AS created_at,
  'customization_logs' AS source_table
FROM customization_logs cl
JOIN user_horses uh2 ON uh2.id = cl.horse_id

UNION ALL

-- 6. Owner-authored timeline notes ONLY (not visitor comments)
-- Posts where the author is the horse's owner are provenance notes.
-- Posts by other users are social comments and belong in the Comments section.
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
  AND p.parent_id IS NULL          -- top-level posts only, not replies
  AND p.author_id = uh3.owner_id;  -- ONLY the owner's notes, not visitor comments

-- NOTE: Visitor comments on horses are displayed via the UniversalFeed
-- component on the passport page, not in the Hoofprint timeline.
