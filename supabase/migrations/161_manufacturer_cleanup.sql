-- ============================================================
-- 161: Manufacturer facet cleanup (MHI report 2026-08-19) +
-- planner statistics refresh.
--
-- The 156 backfill set manufacturer = maker for every factory-
-- category row. Rows carrying a PERSON in maker (artist sculptures
-- imported under mold/release categories) and the literal
-- placeholder 'Artist Resin' polluted the Manufacturer dropdown
-- with artist names. Rule: manufacturer keeps only recognized
-- companies (KNOWN_MANUFACTURERS in src/lib/catalog/taxonomy.ts —
-- keep the two lists in sync); everything else moves to artist.
-- ============================================================

-- The junk placeholder is neither a company nor a person.
UPDATE catalog_items
SET manufacturer = NULL
WHERE lower(trim(manufacturer)) IN ('artist resin', 'unknown', 'other');

-- Person-named "manufacturers" become the artist credit (never
-- overwriting an existing artist value), then clear.
UPDATE catalog_items
SET artist = COALESCE(artist, manufacturer),
    manufacturer = NULL
WHERE manufacturer IS NOT NULL
  AND lower(trim(manufacturer)) NOT IN (
    'animal artistry', 'beswick', 'border fine arts', 'breyer',
    'collecta', 'conversation concepts', 'copperfox', 'country artists',
    'grand champions', 'hagen-renaker', 'hartland', 'horsing around',
    'julip', 'north light', 'pacific giftware', 'peter stone',
    'royal doulton', 'safari ltd', 'safari', 'schleich',
    'stone critters', 'stone horses', 'wia'
  );

-- Spelling unification for the survivors that vary in data.
UPDATE catalog_items SET manufacturer = 'Peter Stone'
WHERE lower(trim(manufacturer)) = 'stone horses';
UPDATE catalog_items SET manufacturer = 'Safari Ltd'
WHERE lower(trim(manufacturer)) = 'safari';

-- ── Planner statistics ──
-- catalog_items was mass-updated several times today (154-157
-- backfills); stale statistics + dead tuples make the planner
-- misjudge the browse/facet queries until the next autovacuum.
ANALYZE catalog_items;
ANALYZE show_placings;
ANALYZE show_class_entries;
ANALYZE user_horses;
ANALYZE horse_images;
ANALYZE qualification_cards;
