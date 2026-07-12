-- ══════════════════════════════════════════════════════════════
-- Migration 129: catalog_items human slugs (for /reference/[maker]/[slug])
-- ══════════════════════════════════════════════════════════════
-- MOVE 1 (Batch I) needs keyword-rich, stable, unique public URLs per release
-- instead of UUIDs (Iron Law: no raw UUIDs on public routes). Adds maker_slug +
-- slug, backfills them, and installs a BEFORE INSERT trigger so future rows
-- (delta imports, approved suggestions) self-slug. Additive + idempotent.
-- Mirrors the unique-slug approach of migration 112 (photo short_slugs) but
-- produces human-readable, SEO-friendly slugs with deterministic -2/-3 suffixes
-- so URLs stay stable.
-- ══════════════════════════════════════════════════════════════

-- Immutable slugify: lowercase, strip common Latin accents, non-alnum → '-'.
-- (unaccent extension is not installed; translate() covers the accents that
-- actually appear in the catalog — Blóm, Öjvind, Støvel, Vegvísir, Skógafoss…)
CREATE OR REPLACE FUNCTION catalog_slugify(txt TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  -- lower() BEFORE translate() so uppercase accents (Öjvind) map too
  SELECT regexp_replace(
           regexp_replace(
             translate(lower(coalesce(txt, '')),
               'àáâãäåāăąçćèéêëēĕėęěìíîïĩīñòóôõöøōðšśßùúûüũūýÿžźżþ',
               'aaaaaaaaaccceeeeeeeeeiiiiiinoooooooodsssuuuuuuyyzzzt'),
             '[^a-z0-9]+', '-', 'g'),
           '(^-+|-+$)', '', 'g');
$$;

ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS maker_slug TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill maker_slug (maker namespace — no per-row collision handling needed).
UPDATE public.catalog_items
SET maker_slug = public.catalog_slugify(maker)
WHERE maker_slug IS NULL;

-- Backfill slug with deterministic collision suffixes inside each maker_slug:
-- rows that slugify to the same base get -2, -3, … ordered by created_at,id.
WITH ranked AS (
  SELECT id,
         NULLIF(public.catalog_slugify(title), '') AS base,
         row_number() OVER (
           PARTITION BY public.catalog_slugify(maker), public.catalog_slugify(title)
           ORDER BY created_at, id
         ) AS rn
  FROM public.catalog_items
  WHERE slug IS NULL
)
UPDATE public.catalog_items ci
SET slug = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || r.rn END
FROM ranked r
WHERE ci.id = r.id AND r.base IS NOT NULL;

-- Fallback for titles that slugify to empty (all non-Latin): use a short id.
UPDATE public.catalog_items
SET slug = 'item-' || left(id::text, 8)
WHERE slug IS NULL OR slug = '';

-- Unique per (maker_slug, slug) → fast, unambiguous page resolution.
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_items_maker_slug
  ON public.catalog_items (maker_slug, slug);

-- Self-slug future inserts (delta importer, approved additions) so every row
-- always has a resolvable URL.
CREATE OR REPLACE FUNCTION trg_catalog_items_slug()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE base TEXT; candidate TEXT; n INT := 1;
BEGIN
  IF NEW.maker_slug IS NULL THEN
    NEW.maker_slug := public.catalog_slugify(NEW.maker);
  END IF;
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := NULLIF(public.catalog_slugify(NEW.title), '');
    IF base IS NULL THEN base := 'item-' || left(NEW.id::text, 8); END IF;
    candidate := base;
    WHILE EXISTS (
      SELECT 1 FROM public.catalog_items
      WHERE maker_slug = NEW.maker_slug AND slug = candidate
    ) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS catalog_items_slug_biu ON public.catalog_items;
CREATE TRIGGER catalog_items_slug_biu
  BEFORE INSERT ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_catalog_items_slug();

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 129 Complete — catalog_items.maker_slug + slug (unique, indexed,
-- backfilled, self-slugging on insert). After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
