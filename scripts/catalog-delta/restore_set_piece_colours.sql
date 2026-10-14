-- Restore set-row colours overwritten through the reference linker
-- (2026-10-13 / 14).
--
-- The linker listed a set that names a mold ("Stablemate Assortment With
-- Arabian Mare, ..., Silky Sullivan, ...") under that mold, but the Registry
-- stores the set as one row per piece, filed under ANOTHER mold (Draft
-- Horse, Citation, Native Dancer, Appaloosa, Standing Thoroughbred). Its
-- colour is that other piece's colour. "Fill in what you know" offered to
-- set the colour anyway; 14 corrections did, and approving them replaced
-- the Draft Horse / Citation / Native Dancer / Appaloosa / Standing
-- Thoroughbred piece colours with Silky Sullivan or Arabian Mare ones.
-- The linker no longer offers it (commit after 39b8d07).
--
-- This puts each row's colour back to what it held before the first such
-- correction. EXPECT-GUARD: a row is only touched while it still holds the
-- value the last of those corrections wrote, so a later human edit wins.
-- The member's own piece colours are already on her releases under Silky
-- Sullivan and Arabian Stallion; nothing of hers is lost.
--
-- Run 1 (dry run) first. Run 2 changes exactly the rows marked restore = true.

-- 1. Dry run
WITH fx AS (
  SELECT s.catalog_item_id,
         s.created_at,
         s.field_changes -> 'color_description' ->> 'from' AS was,
         s.field_changes -> 'color_description' ->> 'to'   AS became
  FROM public.catalog_suggestions s
  WHERE s.suggestion_type = 'correction'
    AND s.status IN ('approved', 'auto_approved')
    AND s.reason LIKE 'Filled in from the reference linker%'
    AND s.field_changes ? 'color_description'
),
per_row AS (
  SELECT catalog_item_id,
         (array_agg(was    ORDER BY created_at ASC))[1]  AS original,
         (array_agg(became ORDER BY created_at DESC))[1] AS last_written,
         count(*) AS corrections
  FROM fx
  GROUP BY catalog_item_id
)
SELECT ci.title, p.title AS filed_under, ci.attributes ->> 'color_description' AS now,
       r.last_written, r.original AS restore_to, r.corrections,
       (ci.attributes ->> 'color_description') IS NOT DISTINCT FROM r.last_written AS restore
FROM per_row r
JOIN public.catalog_items ci ON ci.id = r.catalog_item_id
LEFT JOIN public.catalog_items p ON p.id = ci.parent_id
ORDER BY p.title, ci.title;

-- 2. The restore
WITH fx AS (
  SELECT s.catalog_item_id,
         s.created_at,
         s.field_changes -> 'color_description' ->> 'from' AS was,
         s.field_changes -> 'color_description' ->> 'to'   AS became
  FROM public.catalog_suggestions s
  WHERE s.suggestion_type = 'correction'
    AND s.status IN ('approved', 'auto_approved')
    AND s.reason LIKE 'Filled in from the reference linker%'
    AND s.field_changes ? 'color_description'
),
per_row AS (
  SELECT catalog_item_id,
         (array_agg(was    ORDER BY created_at ASC))[1]  AS original,
         (array_agg(became ORDER BY created_at DESC))[1] AS last_written
  FROM fx
  GROUP BY catalog_item_id
)
UPDATE public.catalog_items ci
SET attributes = CASE
      WHEN coalesce(r.original, '') = '' THEN ci.attributes - 'color_description'
      ELSE ci.attributes || jsonb_build_object('color_description', r.original)
    END
FROM per_row r
WHERE ci.id = r.catalog_item_id
  AND (ci.attributes ->> 'color_description') IS NOT DISTINCT FROM r.last_written;
