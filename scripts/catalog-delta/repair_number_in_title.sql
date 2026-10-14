-- Move a model number out of a release title into attributes.model_number
-- (2026-10-14).
--
-- The suggestion form had no model-number field, so members typed it into
-- the title: "#5022 Silky Sullivan", "#710897 JCPenney Holiday Catalog
-- 12-Piece Stablemates Set". The number is then unsearchable (search and
-- the linker read attributes.model_number) and the title reads as a code.
-- 46 Breyer releases carry a leading number with no model_number stored;
-- 28 of them are one member's additions from this week.
--
-- Scope is deliberately narrow: titles that START with a hash and digits.
-- Bare years ("2001 Atlantis Bey V") and letter-prefixed codes ("P55016")
-- are left alone; those need eyes, not a regex.
--
-- Run 1 (dry run) first. Run 2 touches exactly those rows.

-- 1. Dry run
SELECT id, title AS before,
       btrim(regexp_replace(title, '^#\s*\d{3,7}\s+', '')) AS title_after,
       substring(title from '^#\s*(\d{3,7})') AS model_number_after,
       maker, scale
FROM public.catalog_items
WHERE item_type = 'plastic_release'
  AND title ~ '^#\s*\d{3,7}\s+\S'
  AND coalesce(attributes->>'model_number', '') = ''
  AND length(btrim(regexp_replace(title, '^#\s*\d{3,7}\s+', ''))) > 0
ORDER BY created_at DESC;

-- 2. The repair
UPDATE public.catalog_items
SET attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('model_number', substring(title from '^#\s*(\d{3,7})')),
    title = btrim(regexp_replace(title, '^#\s*\d{3,7}\s+', ''))
WHERE item_type = 'plastic_release'
  AND title ~ '^#\s*\d{3,7}\s+\S'
  AND coalesce(attributes->>'model_number', '') = ''
  AND length(btrim(regexp_replace(title, '^#\s*\d{3,7}\s+', ''))) > 0;
