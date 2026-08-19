-- ============================================================
-- 154: Catalog Taxonomy v2 — scale normalization, Category
-- expansion, and the "Customs of this mold" RPC.
--
-- 1. Scale had five divergent vocabularies; the canonical spelling
--    is the parenthesized form most production rows already use
--    ("Traditional (1:9)"). This normalizes catalog_items.scale
--    AND both classlists' allowed_scales arrays in lockstep —
--    show entry rules compare these strings exactly, so they must
--    move together (src/lib/shows/entryRules.ts).
-- 2. item_type CHECK gains factory_resin and china (community
--    request via MODEL HORSES INTERNATIONAL). No "custom" type:
--    customs are horses, not catalog rows.
-- 3. get_mold_customs: anon-safe DEFINER read powering the
--    "Customs of this mold" gallery on mold reference pages.
--
-- Mirrors src/lib/catalog/taxonomy.ts — that file is the single
-- source of truth for the vocabulary; keep the two in sync.
-- ============================================================

-- ── 1. Scale normalization ──

CREATE TEMP TABLE scale_map (raw TEXT PRIMARY KEY, canonical TEXT NOT NULL);
INSERT INTO scale_map (raw, canonical) VALUES
  ('traditional',           'Traditional (1:9)'),
  ('animal traditional',    'Traditional (1:9)'),
  ('gallery crystal',       'Traditional (1:9)'),
  ('1:9',                   'Traditional (1:9)'),
  ('classic',               'Classic (1:12)'),
  ('1:12',                  'Classic (1:12)'),
  ('pebbles',               'Pebbles (1:18)'),
  ('1:18',                  'Pebbles (1:18)'),
  ('paddock pal',           'Paddock Pal (1:24)'),
  ('paddock pals',          'Paddock Pal (1:24)'),
  ('paddock pals (1:24)',   'Paddock Pal (1:24)'),
  ('little bit',            'Paddock Pal (1:24)'),
  ('little bits',           'Paddock Pal (1:24)'),
  ('1:24',                  'Paddock Pal (1:24)'),
  ('stablemate',            'Stablemate (1:32)'),
  ('stablemates',           'Stablemate (1:32)'),
  ('stablemates (1:32)',    'Stablemate (1:32)'),
  ('1:32',                  'Stablemate (1:32)'),
  ('mini whinnie',          'Mini Whinnies (1:64)'),
  ('mini whinnies',         'Mini Whinnies (1:64)'),
  ('1:64',                  'Mini Whinnies (1:64)'),
  ('micro mini',            'Micro Mini'),
  ('micro',                 'Micro Mini'),
  ('curio',                 'Curio'),
  ('plush',                 'Plush');

-- Catalog rows: map known variants; already-canonical and unknown
-- values are left untouched (trim-only for the unknowns).
UPDATE catalog_items ci
SET scale = sm.canonical
FROM scale_map sm
WHERE ci.scale IS NOT NULL
  AND lower(trim(ci.scale)) = sm.raw
  AND ci.scale IS DISTINCT FROM sm.canonical;

UPDATE catalog_items
SET scale = trim(scale)
WHERE scale IS NOT NULL AND scale <> trim(scale);

-- Classlists (legacy events + shows v2/v4): normalize each array
-- element through the same map so exact-match entry rules keep
-- working. Dedupe after mapping ('Traditional' and '1:9' in one
-- array collapse to a single canonical entry).
UPDATE event_classes ec
SET allowed_scales = (
  SELECT array_agg(DISTINCT COALESCE(sm.canonical, trim(s)))
  FROM unnest(ec.allowed_scales) AS s
  LEFT JOIN scale_map sm ON sm.raw = lower(trim(s))
)
WHERE ec.allowed_scales IS NOT NULL AND array_length(ec.allowed_scales, 1) > 0;

UPDATE show_classes sc
SET allowed_scales = (
  SELECT array_agg(DISTINCT COALESCE(sm.canonical, trim(s)))
  FROM unnest(sc.allowed_scales) AS s
  LEFT JOIN scale_map sm ON sm.raw = lower(trim(s))
)
WHERE sc.allowed_scales IS NOT NULL AND array_length(sc.allowed_scales, 1) > 0;

DROP TABLE scale_map;

-- ── 2. Category expansion ──

ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_item_type_check;
ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_item_type_check
  CHECK (item_type IN (
    'plastic_mold', 'plastic_release', 'artist_resin',
    'factory_resin', 'china',
    'tack', 'medallion', 'micro_mini', 'prop', 'diorama'
  ));

-- ── 3. Customs of this mold ──
-- Public customs linked to a mold OR to any of its releases (a
-- custom is usually cataloged against the mold; an OF against the
-- release — the gallery unifies both paths). Same visibility
-- predicate as get_public_horse_cards (153): visibility = 'public'
-- and not deleted. Primary thumbnail via horse_images.

CREATE OR REPLACE FUNCTION get_mold_customs(p_catalog_id UUID, p_limit INTEGER DEFAULT 24)
RETURNS TABLE (
  horse_id UUID,
  custom_name TEXT,
  finishing_artist TEXT,
  finishing_artist_verified BOOLEAN,
  image_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT
    uh.id,
    uh.custom_name,
    uh.finishing_artist,
    uh.finishing_artist_verified,
    img.image_url,
    uh.created_at
  FROM public.user_horses uh
  LEFT JOIN LATERAL (
    SELECT hi.image_url
    FROM public.horse_images hi
    WHERE hi.horse_id = uh.id AND hi.angle_profile = 'Primary_Thumbnail'
    LIMIT 1
  ) img ON true
  WHERE uh.finish_type = 'Custom'
    AND uh.visibility = 'public'
    AND uh.deleted_at IS NULL
    AND (
      uh.catalog_id = p_catalog_id
      OR uh.catalog_id IN (
        SELECT c.id FROM public.catalog_items c WHERE c.parent_id = p_catalog_id
      )
    )
  ORDER BY uh.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 60);
$$;
