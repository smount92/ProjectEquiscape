-- Re-parent releases that were added with no parent mold (2026-10-14).
--
-- Every release a member added through the suggestion form before this
-- week was inserted with parent_id NULL and the typed mold kept only as
-- attributes.mold_name ("G1 Arabian Stallion"). Such a release never
-- shows under its mold, in the old picker's "Releases for" panel, or in
-- the new linker. 517 releases had no parent on 2026-10-12; 302 of them
-- name a mold in text.
--
-- This resolves the typed name the way the approval path now does:
-- same maker, same scale, same name with a leading "G1".."G6" or a
-- trailing "(G1)" stripped. Where two molds share that name (48 such
-- pairs exist), the one already carrying the most releases wins, then
-- the older one, so a duplicate stops collecting children. A release
-- whose name resolves to nothing is left alone for the linker to catch.
--
-- Run 1 (dry run) first and read it. Run 2 touches only those rows.

-- 1. Dry run: each orphan and the mold it would be filed under
WITH candidates AS (
  SELECT r.id AS release_id, r.title AS release_title, r.maker, r.scale,
         r.attributes->>'mold_name' AS typed,
         m.id AS mold_id, m.title AS mold_title, m.created_at AS mold_created,
         (SELECT count(*) FROM public.catalog_items c WHERE c.parent_id = m.id AND c.item_type = 'plastic_release') AS mold_releases
  FROM public.catalog_items r
  JOIN public.catalog_items m
    ON m.item_type = 'plastic_mold'
   AND lower(m.maker) = lower(r.maker)
   AND coalesce(m.scale, '') = coalesce(r.scale, '')
   AND lower(btrim(regexp_replace(m.title, '\(\s*G[1-6]\s*\)|^\s*G[1-6]\s+|\s+G[1-6]\s*$', '', 'gi')))
     = lower(btrim(regexp_replace(r.attributes->>'mold_name', '\(\s*G[1-6]\s*\)|^\s*G[1-6]\s+|\s+G[1-6]\s*$', '', 'gi')))
  WHERE r.item_type = 'plastic_release'
    AND r.parent_id IS NULL
    AND coalesce(r.attributes->>'mold_name', '') <> ''
),
chosen AS (
  SELECT DISTINCT ON (release_id) *
  FROM candidates
  ORDER BY release_id, mold_releases DESC, mold_created ASC
)
SELECT release_title, maker, scale, typed, mold_title, mold_releases, mold_id
FROM chosen
ORDER BY typed, release_title;

-- 2. The repair (same rows as the dry run)
WITH candidates AS (
  SELECT r.id AS release_id,
         m.id AS mold_id, m.created_at AS mold_created,
         (SELECT count(*) FROM public.catalog_items c WHERE c.parent_id = m.id AND c.item_type = 'plastic_release') AS mold_releases
  FROM public.catalog_items r
  JOIN public.catalog_items m
    ON m.item_type = 'plastic_mold'
   AND lower(m.maker) = lower(r.maker)
   AND coalesce(m.scale, '') = coalesce(r.scale, '')
   AND lower(btrim(regexp_replace(m.title, '\(\s*G[1-6]\s*\)|^\s*G[1-6]\s+|\s+G[1-6]\s*$', '', 'gi')))
     = lower(btrim(regexp_replace(r.attributes->>'mold_name', '\(\s*G[1-6]\s*\)|^\s*G[1-6]\s+|\s+G[1-6]\s*$', '', 'gi')))
  WHERE r.item_type = 'plastic_release'
    AND r.parent_id IS NULL
    AND coalesce(r.attributes->>'mold_name', '') <> ''
),
chosen AS (
  SELECT DISTINCT ON (release_id) release_id, mold_id
  FROM candidates
  ORDER BY release_id, mold_releases DESC, mold_created ASC
)
UPDATE public.catalog_items r
SET parent_id = chosen.mold_id
FROM chosen
WHERE r.id = chosen.release_id
  AND r.parent_id IS NULL;
