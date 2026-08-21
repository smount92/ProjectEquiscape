-- ══════════════════════════════════════════════════════════════
-- 178: Manufacturer reclassification (MHI's artist-list sweep)
--
-- MODEL HORSES INTERNATIONAL scrolled the whole Artist list
-- (2026-08-19) and found eleven manufacturing companies filed as
-- artists, two under wrong names: "BHR" is Black Horse Ranch, and
-- "Creart" is a long-standing misspelling of Creata. This moves the
-- rows: artist → manufacturer (canonicalized), artist cleared. An
-- existing manufacturer value is never overwritten.
--
-- Companion code change: KNOWN_MANUFACTURERS + MANUFACTURER_ALIASES
-- in src/lib/catalog/taxonomy.ts, so future writes classify right.
-- ══════════════════════════════════════════════════════════════

-- 1. Canonicalize spelling variants wherever they already sit.
UPDATE catalog_items SET manufacturer = 'Black Horse Ranch'
  WHERE manufacturer ILIKE 'BHR';
UPDATE catalog_items SET manufacturer = 'Creata'
  WHERE manufacturer ILIKE 'Creart';
UPDATE catalog_items SET artist = 'Black Horse Ranch'
  WHERE artist ILIKE 'BHR';
UPDATE catalog_items SET artist = 'Creata'
  WHERE artist ILIKE 'Creart';

-- 2. Companies filed as artists move to manufacturer (only when the
--    manufacturer slot is empty), then clear out of artist.
UPDATE catalog_items
SET manufacturer = artist
WHERE manufacturer IS NULL
  AND artist IN (
    'Black Horse Ranch',
    'Border Fine Arts',
    'Conversation Concepts',
    'Country Artists',
    'Creata',
    'Danbury Mint',
    'Horsing Around',
    'Sandicast',
    'Stone Critters',
    'United Design Company'
  );

UPDATE catalog_items
SET artist = NULL
WHERE artist IN (
    'Black Horse Ranch',
    'Border Fine Arts',
    'Conversation Concepts',
    'Country Artists',
    'Creata',
    'Danbury Mint',
    'Horsing Around',
    'Sandicast',
    'Stone Critters',
    'United Design Company'
  );

-- 3. Planner stats after the mass update.
ANALYZE catalog_items;

-- Verify (run separately if curious):
--   SELECT artist, count(*) FROM catalog_items
--   WHERE artist IS NOT NULL GROUP BY artist ORDER BY artist;
