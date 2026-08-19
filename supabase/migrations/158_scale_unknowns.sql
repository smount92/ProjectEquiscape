-- ============================================================
-- 158: Oddball scales → NULL (owner decision 2026-08-19)
--
-- The nine non-scale values the 155 inspection surfaced (pose
-- words, size adjectives, a category leak) are cleared rather
-- than guessed: an absent scale renders as "—" and the community
-- fills in the right value through the correction flow's
-- canonical scale dropdown.
--
-- Observations for later (NOT acted on here):
--   - The ~157 scale='Medallion' rows are actual medallions
--     (Cubequines etc.) — their item_type likely wants to be
--     'medallion' too; separate decision.
--   - The ~180 'Little' rows are artist resins in the hobby's
--     "littlebit" size — if the community converges on Paddock
--     Pal (1:24) for these, a one-line bulk fix can do it.
-- ============================================================

UPDATE catalog_items SET scale = NULL
WHERE scale IN (
  '1:6', 'Cantering', 'Standing', 'Draft Scale',
  'Large Classic', 'Small Classic', 'Little', 'Mini', 'Medallion'
);

-- Classlists in lockstep: strip the cleared values from any
-- allowed_scales arrays (an empty array would mean "no scale may
-- enter", so arrays that lose every element go NULL = any scale).
UPDATE event_classes ec
SET allowed_scales = NULLIF((
  SELECT array_agg(s) FROM unnest(ec.allowed_scales) AS s
  WHERE s NOT IN ('1:6', 'Cantering', 'Standing', 'Draft Scale',
                  'Large Classic', 'Small Classic', 'Little', 'Mini', 'Medallion')
), '{}')
WHERE ec.allowed_scales IS NOT NULL AND array_length(ec.allowed_scales, 1) > 0;

UPDATE show_classes sc
SET allowed_scales = NULLIF((
  SELECT array_agg(s) FROM unnest(sc.allowed_scales) AS s
  WHERE s NOT IN ('1:6', 'Cantering', 'Standing', 'Draft Scale',
                  'Large Classic', 'Small Classic', 'Little', 'Mini', 'Medallion')
), '{}')
WHERE sc.allowed_scales IS NOT NULL AND array_length(sc.allowed_scales, 1) > 0;
