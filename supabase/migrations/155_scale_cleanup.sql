-- ============================================================
-- 155: Scale cleanup round 2 — variants the live data revealed
-- after 154 ran (the facet list surfaced them immediately).
--
--   'Pebble'            → 'Pebbles (1:18)'
--   'Micro Mini (1:64)' → 'Micro Mini'
--   'Unknown'           → NULL  (absence, honestly recorded)
--
-- Deliberately NOT touched (need human eyes — see the inspection
-- query at the bottom): '1:6', 'Cantering', 'Standing' (poses that
-- leaked into the scale column), 'Draft Scale', 'Large Classic',
-- 'Small Classic', 'Little', 'Mini', 'Medallion'.
-- ============================================================

UPDATE catalog_items SET scale = 'Pebbles (1:18)'
WHERE lower(trim(scale)) = 'pebble';

UPDATE catalog_items SET scale = 'Micro Mini'
WHERE lower(trim(scale)) = 'micro mini (1:64)';

UPDATE catalog_items SET scale = NULL
WHERE lower(trim(scale)) = 'unknown';

-- Classlists, in lockstep as always (entry rules match exactly).
UPDATE event_classes ec
SET allowed_scales = (
  SELECT array_agg(DISTINCT
    CASE lower(trim(s))
      WHEN 'pebble' THEN 'Pebbles (1:18)'
      WHEN 'micro mini (1:64)' THEN 'Micro Mini'
      ELSE trim(s)
    END)
  FROM unnest(ec.allowed_scales) AS s
  WHERE lower(trim(s)) <> 'unknown'
)
WHERE ec.allowed_scales IS NOT NULL AND array_length(ec.allowed_scales, 1) > 0;

UPDATE show_classes sc
SET allowed_scales = (
  SELECT array_agg(DISTINCT
    CASE lower(trim(s))
      WHEN 'pebble' THEN 'Pebbles (1:18)'
      WHEN 'micro mini (1:64)' THEN 'Micro Mini'
      ELSE trim(s)
    END)
  FROM unnest(sc.allowed_scales) AS s
  WHERE lower(trim(s)) <> 'unknown'
)
WHERE sc.allowed_scales IS NOT NULL AND array_length(sc.allowed_scales, 1) > 0;

-- ── Inspection query (run separately, read-only): what carries the
-- remaining oddball scales, so we can decide their real mapping. ──
-- SELECT scale, maker, count(*), (array_agg(title))[1:5] AS sample_titles
-- FROM catalog_items
-- WHERE scale IN ('1:6', 'Cantering', 'Standing', 'Draft Scale',
--                 'Large Classic', 'Small Classic', 'Little', 'Mini', 'Medallion')
-- GROUP BY scale, maker ORDER BY scale, count(*) DESC;
