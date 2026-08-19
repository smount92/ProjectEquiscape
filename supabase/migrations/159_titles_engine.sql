-- ============================================================
-- 159: Titles engine — permanent horse titles + exhibitor
-- distinctions (Championship program §3, build item 4).
--
--   horse_titles          CH / ROM / SUP, one grant per title per
--                         horse, forever (titles are history —
--                         they are never revoked).
--   exhibitor_distinctions PSA-style cumulative stars per person.
--
-- Grants are computed in the app (src/lib/shows/titles.ts rules +
-- grantTitlesForShow I/O) when results publish, written by the
-- service role with ON CONFLICT DO NOTHING — re-runs are free.
-- RLS: world-readable (titles are public record, same posture as
-- badges in 085), no client INSERT/UPDATE/DELETE policies.
--
-- Also: v_horse_hoofprint gains a 7th UNION branch so a title
-- lands on the horse's Hoofprint timeline (the view is the only
-- write-less path — the timeline table was dropped in 052).
-- ============================================================

CREATE TABLE horse_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id UUID NOT NULL REFERENCES user_horses(id) ON DELETE CASCADE,
  title_code TEXT NOT NULL CHECK (title_code IN ('CH', 'ROM', 'SUP')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The show year the qualifying record completed in (context only).
  show_year INTEGER,
  -- Human-auditable basis: cards/shows/judges counts or careerPoints.
  evidence JSONB,
  UNIQUE (horse_id, title_code)
);

CREATE INDEX idx_horse_titles_horse ON horse_titles (horse_id);

ALTER TABLE horse_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Titles are public record"
  ON horse_titles FOR SELECT
  TO authenticated, anon
  USING (true);
-- No INSERT/UPDATE/DELETE policies: service-role writes only.

CREATE TABLE exhibitor_distinctions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  distinction_code TEXT NOT NULL CHECK (
    distinction_code IN ('STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5')
  ),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence JSONB,
  PRIMARY KEY (user_id, distinction_code)
);

ALTER TABLE exhibitor_distinctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Distinctions are public record"
  ON exhibitor_distinctions FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── Hoofprint: recreate the view (exact 092 body) + title branch ──

CREATE OR REPLACE VIEW v_horse_hoofprint
WITH (security_invoker = true) AS

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

-- 5. Customization work (from customization_logs) — includes image_urls
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
  AND p.author_id = uh3.owner_id

UNION ALL

-- 7. Titles (159): a permanent title lands on the Hoofprint.
SELECT
  ht.id AS source_id,
  ht.horse_id,
  uh4.owner_id AS user_id,
  'title_granted' AS event_type,
  'Title earned: ' ||
    CASE ht.title_code
      WHEN 'CH' THEN 'Champion'
      WHEN 'ROM' THEN 'Register of Merit'
      WHEN 'SUP' THEN 'Superior'
      ELSE ht.title_code
    END AS title,
  uh4.custom_name || ' earned the MHH ' ||
    CASE ht.title_code
      WHEN 'CH' THEN 'Champion (CH)'
      WHEN 'ROM' THEN 'Register of Merit (ROM)'
      WHEN 'SUP' THEN 'Superior (SUP)'
      ELSE ht.title_code
    END || ' title.' AS description,
  ht.granted_at::date AS event_date,
  jsonb_build_object('title_code', ht.title_code, 'evidence', ht.evidence) AS metadata,
  true AS is_public,
  ht.granted_at AS created_at,
  'horse_titles' AS source_table
FROM horse_titles ht
JOIN user_horses uh4 ON uh4.id = ht.horse_id;
